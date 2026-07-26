import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { nextDocNo, nextSeq } from '@/lib/erp/numbering';
import { daysInMonth, istDate } from '@/lib/erp/dates';
import { round2 } from '@/lib/erp/gst';
import { computePayslip, parsePtSlabs } from '@/lib/erp/payroll';
import { getErpSettings, erpNumber } from '@/lib/erp/settings';
import type { Employee } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ATT_STATUSES = ['present', 'absent', 'half_day', 'leave', 'week_off', 'holiday'];

/** GET — employees, one month of attendance, leaves, advances, payroll runs. */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('hr');
  if (auth.denied) return auth.denied;
  const params = request.nextUrl.searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : istDate().slice(0, 7);

  const [employees, attendance, leaves, advances, runs] = await Promise.all([
    db.employee.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] }),
    db.attendanceEntry.findMany({ where: { date: { startsWith: month } } }),
    db.leaveRequest.findMany({
      include: { employee: { select: { name: true, empCode: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
    db.salaryAdvance.findMany({
      include: { employee: { select: { name: true, empCode: true } } },
      orderBy: { date: 'desc' }, take: 100,
    }),
    db.payrollRun.findMany({
      include: { payslips: { include: { employee: { select: { name: true, empCode: true, designation: true, department: true, bankAccount: true, bankIfsc: true, uan: true, esiNumber: true, pan: true } } } } },
      orderBy: { month: 'desc' }, take: 14,
    }),
  ]);

  return NextResponse.json({ employees, month, attendance, leaves, advances, runs });
}

export async function POST(request: NextRequest) {
  const auth = await erpGuard('hr');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    switch (action) {
      case 'employee_save': {
        const name = String(body.name ?? '').trim();
        if (!name) return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
        const str = (k: string, max = 120) => (body[k] !== undefined && body[k] !== null && body[k] !== '' ? String(body[k]).slice(0, max) : null);
        const num = (k: string) => Math.max(0, Number(body[k]) || 0);
        const data = {
          name: name.slice(0, 100),
          designation: str('designation', 60),
          department: String(body.department ?? 'front_office').slice(0, 30),
          phone: str('phone', 20),
          email: str('email'),
          address: str('address', 300),
          dob: str('dob', 10),
          doj: str('doj', 10),
          dol: str('dol', 10),
          status: ['active', 'resigned', 'terminated'].includes(String(body.status)) ? String(body.status) : 'active',
          pan: str('pan', 10),
          aadhaar: str('aadhaar', 12),
          uan: str('uan', 12),
          pfNumber: str('pfNumber', 25),
          esiNumber: str('esiNumber', 17),
          bankName: str('bankName', 60),
          bankAccount: str('bankAccount', 20),
          bankIfsc: str('bankIfsc', 11),
          basic: num('basic'),
          hra: num('hra'),
          otherAllowances: num('otherAllowances'),
          pfOptIn: body.pfOptIn === undefined ? true : Boolean(body.pfOptIn),
          esiOptIn: body.esiOptIn === undefined ? true : Boolean(body.esiOptIn),
          ptApplicable: body.ptApplicable === undefined ? true : Boolean(body.ptApplicable),
          tdsMonthly: num('tdsMonthly'),
          weeklyOff: String(body.weeklyOff ?? 'monday').slice(0, 10),
          shift: String(body.shift ?? 'general').slice(0, 10),
          notes: str('notes', 400),
        };
        if (body.id) {
          await db.employee.update({ where: { id: String(body.id) }, data });
          return NextResponse.json({ ok: true });
        }
        const employee = await db.employee.create({
          data: { ...data, empCode: `EMP-${String(await nextSeq('EMP')).padStart(4, '0')}` },
        });
        await logAudit(session, 'hr.employee_create', {
          entity: 'Employee', entityId: employee.id, summary: `${employee.empCode} ${employee.name} added`,
        });
        return NextResponse.json({ ok: true, employee });
      }

      case 'attendance_mark': {
        const date = String(body.date ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Bad date' }, { status: 400 });
        const entries = Array.isArray(body.entries) ? body.entries : [];
        let count = 0;
        for (const raw of entries) {
          const employeeId = String(raw.employeeId ?? '');
          const status = String(raw.status ?? '');
          if (!employeeId || !ATT_STATUSES.includes(status)) continue;
          await db.attendanceEntry.upsert({
            where: { employeeId_date: { employeeId, date } },
            update: {
              status,
              otHours: Math.max(0, Math.min(12, Number(raw.otHours) || 0)),
              inTime: raw.inTime ? String(raw.inTime).slice(0, 5) : null,
              outTime: raw.outTime ? String(raw.outTime).slice(0, 5) : null,
              markedBy: session.username,
            },
            create: {
              employeeId, date, status,
              otHours: Math.max(0, Math.min(12, Number(raw.otHours) || 0)),
              inTime: raw.inTime ? String(raw.inTime).slice(0, 5) : null,
              outTime: raw.outTime ? String(raw.outTime).slice(0, 5) : null,
              markedBy: session.username,
            },
          });
          count += 1;
        }
        return NextResponse.json({ ok: true, count });
      }

      case 'leave_save': {
        const employee = await db.employee.findUnique({ where: { id: String(body.employeeId ?? '') } });
        if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        const from = String(body.from ?? '');
        const to = String(body.to ?? from);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
          return NextResponse.json({ error: 'Bad leave dates' }, { status: 400 });
        }
        const days = Math.max(0.5, Number(body.days) || 1);
        const leave = await db.leaveRequest.create({
          data: {
            employeeId: employee.id, from, to, days,
            type: ['casual', 'sick', 'earned', 'unpaid'].includes(String(body.type)) ? String(body.type) : 'casual',
            reason: body.reason ? String(body.reason).slice(0, 300) : null,
          },
        });
        return NextResponse.json({ ok: true, leave });
      }

      case 'leave_decide': {
        const leave = await db.leaveRequest.findUnique({ where: { id: String(body.leaveId ?? '') }, include: { employee: true } });
        if (!leave || leave.status !== 'pending') return NextResponse.json({ error: 'Leave not found or already decided' }, { status: 400 });
        const decision = String(body.decision ?? '');
        if (!['approved', 'rejected'].includes(decision)) return NextResponse.json({ error: 'Bad decision' }, { status: 400 });
        await db.$transaction(async (tx) => {
          await tx.leaveRequest.update({
            where: { id: leave.id },
            data: { status: decision, decidedBy: session.username, decidedAt: new Date() },
          });
          if (decision === 'approved' && leave.type !== 'unpaid') {
            await tx.employee.update({
              where: { id: leave.employeeId },
              data: { leaveBalance: round2(Math.max(0, leave.employee.leaveBalance - leave.days)) },
            });
          }
        });
        await logAudit(session, 'hr.leave_decide', {
          entity: 'LeaveRequest', entityId: leave.id,
          summary: `${leave.employee.name}: ${leave.days}d ${leave.type} leave ${decision}`,
        });
        return NextResponse.json({ ok: true });
      }

      case 'advance_save': {
        const employee = await db.employee.findUnique({ where: { id: String(body.employeeId ?? '') } });
        if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
        const advance = await db.salaryAdvance.create({
          data: {
            employeeId: employee.id,
            amount: round2(amount),
            reason: body.reason ? String(body.reason).slice(0, 200) : null,
            approvedBy: session.username,
          },
        });
        await logAudit(session, 'hr.advance', {
          entity: 'SalaryAdvance', entityId: advance.id,
          summary: `Advance ₹${advance.amount.toFixed(2)} to ${employee.name}`,
        });
        return NextResponse.json({ ok: true, advance });
      }

      case 'payroll_compute': return await payrollCompute(String(body.month ?? ''));
      case 'payroll_save': return await payrollSave(body, session.username);
      case 'payroll_finalize': return await payrollFinalize(body, session.username, session);
      case 'payslip_paid': {
        const slip = await db.payslip.findUnique({ where: { id: String(body.payslipId ?? '') } });
        if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
        await db.payslip.update({
          where: { id: slip.id },
          data: { paidOn: new Date(), paymentRef: body.reference ? String(body.reference).slice(0, 60) : null },
        });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('hr action failed', action, error);
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------
//  Payroll
// ---------------------------------------------------------------------------

interface SlipOverride {
  employeeId: string;
  payableDays?: number;
  otHours?: number;
  advanceRecovery?: number;
  otherDeductions?: number;
  tds?: number;
}

async function buildSlips(month: string, overrides: Map<string, SlipOverride>) {
  const settings = await getErpSettings();
  const ptSlabs = parsePtSlabs(settings.erpPtSlabs);
  const pfCapBase = erpNumber(settings, 'erpPfCapBase', 15000);
  const esiWageCeiling = erpNumber(settings, 'erpEsiWageCeiling', 21000);
  const otMultiplier = erpNumber(settings, 'erpOtMultiplier', 2);
  const workingHours = erpNumber(settings, 'erpMonthlyWorkingHours', 208);

  const monthDays = daysInMonth(month);
  const employees = await db.employee.findMany({ where: { status: 'active' } });
  const attendance = await db.attendanceEntry.findMany({ where: { date: { startsWith: month } } });
  const advances = await db.salaryAdvance.findMany({ where: { status: 'open' } });

  const byEmployee = new Map<string, { counts: Record<string, number>; ot: number }>();
  for (const entry of attendance) {
    const bucket = byEmployee.get(entry.employeeId) ?? { counts: {}, ot: 0 };
    bucket.counts[entry.status] = (bucket.counts[entry.status] ?? 0) + 1;
    bucket.ot += entry.otHours;
    byEmployee.set(entry.employeeId, bucket);
  }
  const advanceOutstanding = new Map<string, number>();
  for (const adv of advances) {
    advanceOutstanding.set(adv.employeeId, round2((advanceOutstanding.get(adv.employeeId) ?? 0) + adv.amount - adv.recovered));
  }

  return employees.map((employee: Employee) => {
    const bucket = byEmployee.get(employee.id);
    // Hotels mark exceptions, not every present day: unmarked days count as
    // worked, and absences/half-days subtract from the month.
    const absent = bucket?.counts.absent ?? 0;
    const halfDay = bucket?.counts.half_day ?? 0;
    const defaultPayable = round2(Math.max(0, monthDays - absent - 0.5 * halfDay));

    const override = overrides.get(employee.id);
    const gross = employee.basic + employee.hra + employee.otherAllowances;
    const otRate = workingHours > 0 ? round2((gross / workingHours) * otMultiplier) : 0;
    const outstanding = advanceOutstanding.get(employee.id) ?? 0;
    const defaultRecovery = Math.min(outstanding, round2(gross * 0.25));

    const result = computePayslip({
      basic: employee.basic,
      hra: employee.hra,
      otherAllowances: employee.otherAllowances,
      monthDays,
      payableDays: override?.payableDays ?? defaultPayable,
      otHours: override?.otHours ?? bucket?.ot ?? 0,
      otRatePerHour: otRate,
      pfOptIn: employee.pfOptIn,
      esiOptIn: employee.esiOptIn,
      ptApplicable: employee.ptApplicable,
      tdsMonthly: override?.tds ?? employee.tdsMonthly,
      advanceRecovery: override?.advanceRecovery ?? defaultRecovery,
      otherDeductions: override?.otherDeductions ?? 0,
      pfCapBase,
      esiWageCeiling,
      ptSlabs,
    });
    return { employee, result, advanceOutstanding: outstanding };
  });
}

async function payrollCompute(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Bad month' }, { status: 400 });
  const existing = await db.payrollRun.findUnique({ where: { month } });
  if (existing?.status === 'finalized') {
    return NextResponse.json({ error: `Payroll for ${month} is already finalized` }, { status: 409 });
  }
  const slips = await buildSlips(month, new Map());
  return NextResponse.json({
    month,
    slips: slips.map(({ employee, result, advanceOutstanding }) => ({
      employeeId: employee.id,
      empCode: employee.empCode,
      name: employee.name,
      department: employee.department,
      advanceOutstanding,
      ...result,
    })),
  });
}

async function payrollSave(body: Record<string, unknown>, username: string) {
  const month = String(body.month ?? '');
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Bad month' }, { status: 400 });
  const existing = await db.payrollRun.findUnique({ where: { month } });
  if (existing?.status === 'finalized') {
    return NextResponse.json({ error: `Payroll for ${month} is already finalized` }, { status: 409 });
  }

  const overrides = new Map<string, SlipOverride>();
  for (const raw of Array.isArray(body.slips) ? body.slips : []) {
    const o = raw as SlipOverride;
    if (o.employeeId) {
      overrides.set(String(o.employeeId), {
        employeeId: String(o.employeeId),
        payableDays: o.payableDays !== undefined ? Number(o.payableDays) : undefined,
        otHours: o.otHours !== undefined ? Number(o.otHours) : undefined,
        advanceRecovery: o.advanceRecovery !== undefined ? Number(o.advanceRecovery) : undefined,
        otherDeductions: o.otherDeductions !== undefined ? Number(o.otherDeductions) : undefined,
        tds: o.tds !== undefined ? Number(o.tds) : undefined,
      });
    }
  }

  const slips = await buildSlips(month, overrides);
  const run = await db.$transaction(async (tx) => {
    const upserted = await tx.payrollRun.upsert({
      where: { month },
      update: {},
      create: { month },
    });
    await tx.payslip.deleteMany({ where: { runId: upserted.id } });
    let totalGross = 0, totalDeductions = 0, totalNet = 0, employerPf = 0, employerEsi = 0;
    for (const { employee, result } of slips) {
      totalGross = round2(totalGross + result.grossEarned);
      totalDeductions = round2(totalDeductions + result.totalDeductions);
      totalNet = round2(totalNet + result.netPay);
      employerPf = round2(employerPf + result.pfEmployer);
      employerEsi = round2(employerEsi + result.esiEmployer);
      await tx.payslip.create({
        data: {
          runId: upserted.id,
          employeeId: employee.id,
          month,
          monthDays: result.monthDays,
          payableDays: result.payableDays,
          lopDays: result.lopDays,
          basic: result.basic,
          hra: result.hra,
          otherAllowances: result.otherAllowances,
          otPay: result.otPay,
          grossEarned: result.grossEarned,
          pfEmployee: result.pfEmployee,
          pfEmployer: result.pfEmployer,
          esiEmployee: result.esiEmployee,
          esiEmployer: result.esiEmployer,
          pt: result.pt,
          tds: result.tds,
          advanceRecovery: result.advanceRecovery,
          otherDeductions: result.otherDeductions,
          totalDeductions: result.totalDeductions,
          netPay: result.netPay,
        },
      });
    }
    return tx.payrollRun.update({
      where: { id: upserted.id },
      data: { totalGross, totalDeductions, totalNet, employerPf, employerEsi },
    });
  });
  await logAudit({ username }, 'hr.payroll_save', {
    entity: 'PayrollRun', entityId: run.id,
    summary: `Payroll draft for ${month}: net ₹${run.totalNet.toFixed(2)} across ${slips.length} employees`,
  });
  return NextResponse.json({ ok: true, runId: run.id });
}

async function payrollFinalize(body: Record<string, unknown>, username: string, session: { username: string; uid: string }) {
  const run = await db.payrollRun.findUnique({
    where: { id: String(body.runId ?? '') },
    include: { payslips: true },
  });
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  if (run.status === 'finalized') return NextResponse.json({ error: 'Already finalized' }, { status: 400 });

  await db.$transaction(async (tx) => {
    await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: 'finalized', finalizedBy: username, finalizedAt: new Date() },
    });
    // Advances actually recovered this month reduce the outstanding pots,
    // oldest first.
    for (const slip of run.payslips) {
      let remaining = slip.advanceRecovery;
      if (remaining <= 0) continue;
      const advances = await tx.salaryAdvance.findMany({
        where: { employeeId: slip.employeeId, status: 'open' },
        orderBy: { date: 'asc' },
      });
      for (const advance of advances) {
        if (remaining <= 0) break;
        const due = round2(advance.amount - advance.recovered);
        const take = Math.min(due, remaining);
        remaining = round2(remaining - take);
        await tx.salaryAdvance.update({
          where: { id: advance.id },
          data: {
            recovered: round2(advance.recovered + take),
            status: advance.recovered + take + 0.01 >= advance.amount ? 'recovered' : 'open',
          },
        });
      }
    }
  });

  // The salary bill lands in the expense book automatically.
  await db.expense.create({
    data: {
      voucherNo: await nextDocNo('EXP'),
      date: istDate(),
      category: 'salaries',
      payee: 'Payroll',
      description: `Salaries for ${run.month} (${run.payslips.length} employees)`,
      amount: run.totalNet,
      mode: 'bank',
      createdBy: username,
    },
  });

  await logAudit(session, 'hr.payroll_finalize', {
    entity: 'PayrollRun', entityId: run.id,
    summary: `Payroll ${run.month} finalized — net ₹${run.totalNet.toFixed(2)}, PF employer ₹${run.employerPf.toFixed(2)}, ESI employer ₹${run.employerEsi.toFixed(2)}`,
  });
  return NextResponse.json({ ok: true });
}
