'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDate, inr, notify, notifyError, titleCase, todayIst, DEPARTMENTS } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface Employee {
  id: string; empCode: string; name: string; designation: string | null; department: string;
  phone: string | null; email: string | null; status: string; doj: string | null;
  pan: string | null; aadhaar: string | null; uan: string | null; esiNumber: string | null;
  bankName: string | null; bankAccount: string | null; bankIfsc: string | null;
  basic: number; hra: number; otherAllowances: number; pfOptIn: boolean; esiOptIn: boolean;
  ptApplicable: boolean; tdsMonthly: number; weeklyOff: string; shift: string; leaveBalance: number;
}
interface Attendance { id: string; employeeId: string; date: string; status: string; otHours: number }
interface Leave {
  id: string; employeeId: string; from: string; to: string; days: number; type: string;
  reason: string | null; status: string; employee: { name: string; empCode: string };
}
interface Advance {
  id: string; employeeId: string; amount: number; recovered: number; status: string; date: string;
  reason: string | null; employee: { name: string; empCode: string };
}
interface Payslip {
  id: string; employeeId: string; month: string; monthDays: number; payableDays: number; lopDays: number;
  basic: number; hra: number; otherAllowances: number; otPay: number; grossEarned: number;
  pfEmployee: number; pfEmployer: number; esiEmployee: number; esiEmployer: number; pt: number; tds: number;
  advanceRecovery: number; otherDeductions: number; totalDeductions: number; netPay: number;
  paidOn: string | null;
  employee: { name: string; empCode: string; designation: string | null; department: string; bankAccount: string | null; bankIfsc: string | null; uan: string | null; esiNumber: string | null; pan: string | null };
}
interface Run {
  id: string; month: string; status: string; totalGross: number; totalDeductions: number; totalNet: number;
  employerPf: number; employerEsi: number; payslips: Payslip[];
}
interface Data { employees: Employee[]; month: string; attendance: Attendance[]; leaves: Leave[]; advances: Advance[]; runs: Run[] }

const ATT_CYCLE = ['present', 'absent', 'half_day', 'leave', 'week_off'];
const ATT_LABEL: Record<string, { short: string; className: string }> = {
  present: { short: 'P', className: 'bg-emerald-100 text-emerald-800' },
  absent: { short: 'A', className: 'bg-red-100 text-red-700' },
  half_day: { short: '½', className: 'bg-amber-100 text-amber-900' },
  leave: { short: 'L', className: 'bg-sky-100 text-sky-800' },
  week_off: { short: 'W', className: 'bg-zinc-200 text-zinc-600' },
  holiday: { short: 'H', className: 'bg-violet-100 text-violet-800' },
};

export default function Hr() {
  const [data, setData] = useState<Data | null>(null);
  const [month, setMonth] = useState(todayIst().slice(0, 7));
  const [empEdit, setEmpEdit] = useState<Partial<Employee> | null>(null);

  const load = useCallback(async () => {
    try { setData(await api(`/api/erp/hr?month=${month}`)); }
    catch (error) { notifyError(error); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;
  const active = data.employees.filter((e) => e.status === 'active');

  return (
    <div>
      <PageHeader title="HR & Payroll" subtitle={`${active.length} active employees`}
        actions={<Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>} />

      <Tabs defaultValue="employees">
        <TabsList className="rounded-none bg-white border border-gold/10 flex-wrap h-auto">
          <TabsTrigger value="employees" className="rounded-none">Employees</TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-none">Attendance</TabsTrigger>
          <TabsTrigger value="leaves" className="rounded-none">Leaves & Advances</TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-none">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEmpEdit({})}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Employee
              </Button>
            </div>
            {data.employees.length === 0 ? <EmptyState message="Add your team to run attendance and payroll." /> : (
              <DataTable headers={['Code', 'Name', 'Department', 'Monthly Gross', 'Statutory', 'Status']} minWidth={760}>
                {data.employees.map((emp) => (
                  <tr key={emp.id}>
                    <Td className="font-mono text-xs">{emp.empCode}</Td>
                    <Td>
                      <button className="underline-offset-2 hover:underline cursor-pointer text-left" onClick={() => setEmpEdit(emp)}>
                        {emp.name}
                      </button>
                      <span className="block text-[11px] text-muted-foreground">{emp.designation ?? '—'} · {emp.phone ?? ''}</span>
                    </Td>
                    <Td>{titleCase(emp.department)}<span className="block text-[11px] text-muted-foreground">{titleCase(emp.shift)} shift · off {titleCase(emp.weeklyOff)}</span></Td>
                    <Td right>{inr(emp.basic + emp.hra + emp.otherAllowances)}</Td>
                    <Td className="text-[11px]">
                      {emp.pfOptIn && <span className="mr-1">PF{emp.uan ? ` (${emp.uan})` : ''}</span>}
                      {emp.esiOptIn && <span className="mr-1">ESI</span>}
                      {emp.ptApplicable && <span>PT</span>}
                    </Td>
                    <Td><Chip label={titleCase(emp.status)} className={emp.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'} /></Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceGrid employees={active} attendance={data.attendance} month={month} setMonth={setMonth} reload={load} />
        </TabsContent>

        <TabsContent value="leaves" className="mt-4">
          <LeavesAndAdvances data={data} reload={load} />
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <PayrollTab runs={data.runs} reload={load} />
        </TabsContent>
      </Tabs>

      {empEdit && <EmployeeDialog emp={empEdit} onClose={() => setEmpEdit(null)} onDone={() => { setEmpEdit(null); load(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AttendanceGrid({ employees, attendance, month, setMonth, reload }: {
  employees: Employee[]; attendance: Attendance[]; month: string; setMonth: (m: string) => void; reload: () => void;
}) {
  const [date, setDate] = useState(todayIst());
  const [marks, setMarks] = useState<Map<string, { status: string; otHours: number }>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const forDate = new Map<string, { status: string; otHours: number }>();
    for (const a of attendance) if (a.date === date) forDate.set(a.employeeId, { status: a.status, otHours: a.otHours });
    setMarks(forDate);
  }, [attendance, date]);

  const monthByEmp = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const a of attendance) {
      const counts = map.get(a.employeeId) ?? {};
      counts[a.status] = (counts[a.status] ?? 0) + 1;
      map.set(a.employeeId, counts);
    }
    return map;
  }, [attendance]);

  const cycle = (empId: string) => {
    const current = marks.get(empId)?.status ?? 'present';
    const next = ATT_CYCLE[(ATT_CYCLE.indexOf(current) + 1) % ATT_CYCLE.length];
    setMarks(new Map(marks).set(empId, { status: next, otHours: marks.get(empId)?.otHours ?? 0 }));
  };

  const save = async () => {
    setBusy(true);
    try {
      await act('/api/erp/hr', {
        action: 'attendance_mark', date,
        entries: employees.map((e) => ({
          employeeId: e.id,
          status: marks.get(e.id)?.status ?? 'present',
          otHours: marks.get(e.id)?.otHours ?? 0,
        })),
      });
      notify(`Attendance saved for ${fmtDate(date)}`);
      reload();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-gold/10 p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Field label="Marking Date"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value.slice(0, 7) !== month) setMonth(e.target.value.slice(0, 7)); }} className="w-40" /></Field>
        <Field label="Month Summary"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" /></Field>
        <div className="flex-1" />
        <Button onClick={save} disabled={busy || !employees.length} className="bg-gold hover:bg-gold-dark text-white rounded-none">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Save ${fmtDate(date)}`}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Tap a status chip to cycle P → A → ½ → L → W. Unmarked days count as present at payroll time — mark the exceptions.
      </p>
      {employees.length === 0 ? <EmptyState message="No active employees." /> : (
        <DataTable headers={['Employee', `Status on ${fmtDate(date)}`, 'OT hrs', `Month so far (${month})`]} minWidth={640}>
          {employees.map((emp) => {
            const mark = marks.get(emp.id) ?? { status: 'present', otHours: 0 };
            const meta = ATT_LABEL[mark.status];
            const counts = monthByEmp.get(emp.id) ?? {};
            return (
              <tr key={emp.id}>
                <Td>{emp.name}<span className="block text-[11px] text-muted-foreground">{emp.empCode}</span></Td>
                <Td>
                  <button onClick={() => cycle(emp.id)}
                    className={`w-9 h-9 text-sm font-semibold cursor-pointer ${meta.className}`}
                    title={titleCase(mark.status)}>
                    {meta.short}
                  </button>
                  <span className="ml-2 text-xs text-muted-foreground">{titleCase(mark.status)}</span>
                </Td>
                <Td>
                  <Input type="number" className="h-8 w-16 text-xs" value={mark.otHours || ''}
                    placeholder="0"
                    onChange={(e) => setMarks(new Map(marks).set(emp.id, { ...mark, otHours: Number(e.target.value) || 0 }))} />
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {Object.entries(counts).map(([s, n]) => `${ATT_LABEL[s]?.short ?? s}:${n}`).join('  ') || 'nothing marked'}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LeavesAndAdvances({ data, reload }: { data: Data; reload: () => void }) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const active = data.employees.filter((e) => e.status === 'active');

  const decide = async (leave: Leave, decision: 'approved' | 'rejected') => {
    try { await act('/api/erp/hr', { action: 'leave_decide', leaveId: leave.id, decision }); notify(`Leave ${decision}`); reload(); }
    catch (error) { notifyError(error); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gold/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm tracking-widest uppercase text-charcoal/80">Leave Requests</h3>
          <Button size="sm" variant="outline" className="rounded-none" onClick={() => setLeaveOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Apply
          </Button>
        </div>
        {data.leaves.length === 0 ? <EmptyState message="No leave requests." /> : (
          <div className="space-y-2">
            {data.leaves.slice(0, 30).map((leave) => (
              <div key={leave.id} className="border border-gold/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p>{leave.employee.name} · {leave.days}d {titleCase(leave.type)}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(leave.from)} → {fmtDate(leave.to)}{leave.reason ? ` · ${leave.reason}` : ''}</p>
                </div>
                {leave.status === 'pending' ? (
                  <span className="flex gap-1.5">
                    <Button size="sm" className="rounded-none h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white" onClick={() => decide(leave, 'approved')}>Approve</Button>
                    <Button size="sm" variant="outline" className="rounded-none h-7 text-xs text-red-700" onClick={() => decide(leave, 'rejected')}>Reject</Button>
                  </span>
                ) : (
                  <Chip label={titleCase(leave.status)} className={leave.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gold/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm tracking-widest uppercase text-charcoal/80">Salary Advances</h3>
          <Button size="sm" variant="outline" className="rounded-none" onClick={() => setAdvOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Give Advance
          </Button>
        </div>
        {data.advances.length === 0 ? <EmptyState message="No advances outstanding." /> : (
          <div className="space-y-2">
            {data.advances.slice(0, 30).map((adv) => (
              <div key={adv.id} className="border border-gold/10 px-3 py-2 flex items-center justify-between gap-2 text-sm">
                <div>
                  <p>{adv.employee.name} — {inr(adv.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(adv.date)}{adv.reason ? ` · ${adv.reason}` : ''} · recovered {inr(adv.recovered)}</p>
                </div>
                <Chip label={adv.status === 'recovered' ? 'Recovered' : `Due ${inr(adv.amount - adv.recovered)}`}
                  className={adv.status === 'recovered' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-900 border-amber-200'} />
              </div>
            ))}
          </div>
        )}
      </div>

      {leaveOpen && (
        <QuickDialog title="Apply Leave" onClose={() => setLeaveOpen(false)}
          onSubmit={async (form) => {
            await act('/api/erp/hr', { action: 'leave_save', ...form, days: Number(form.days) || 1 });
            notify('Leave request filed'); setLeaveOpen(false); reload();
          }}
          fields={[
            { key: 'employeeId', label: 'Employee', type: 'select', options: active.map((e) => ({ value: e.id, label: `${e.name} (bal ${e.leaveBalance}d)` })) },
            { key: 'from', label: 'From', type: 'date' },
            { key: 'to', label: 'To', type: 'date' },
            { key: 'days', label: 'Days', type: 'number' },
            { key: 'type', label: 'Type', type: 'select', options: ['casual', 'sick', 'earned', 'unpaid'].map((t) => ({ value: t, label: titleCase(t) })) },
            { key: 'reason', label: 'Reason', type: 'text' },
          ]} />
      )}
      {advOpen && (
        <QuickDialog title="Salary Advance" onClose={() => setAdvOpen(false)}
          onSubmit={async (form) => {
            await act('/api/erp/hr', { action: 'advance_save', ...form, amount: Number(form.amount) });
            notify('Advance recorded'); setAdvOpen(false); reload();
          }}
          fields={[
            { key: 'employeeId', label: 'Employee', type: 'select', options: active.map((e) => ({ value: e.id, label: e.name })) },
            { key: 'amount', label: 'Amount (₹)', type: 'number' },
            { key: 'reason', label: 'Reason', type: 'text' },
          ]} />
      )}
    </div>
  );
}

/** Tiny generic form dialog for the simple flows (leave, advance). */
function QuickDialog({ title, fields, onSubmit, onClose }: {
  title: string;
  fields: { key: string; label: string; type: 'text' | 'number' | 'date' | 'select'; options?: { value: string; label: string }[] }[];
  onSubmit: (form: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-light">{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'select' ? (
                <Select value={form[f.key] ?? ''} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type={f.type} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </Field>
          ))}
          <Button disabled={busy} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none"
            onClick={async () => { setBusy(true); try { await onSubmit(form); } catch (e) { notifyError(e); } finally { setBusy(false); } }}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function PayrollTab({ runs, reload }: { runs: Run[]; reload: () => void }) {
  const [month, setMonth] = useState(todayIst().slice(0, 7));
  const [busy, setBusy] = useState(false);

  const compute = async () => {
    setBusy(true);
    try {
      await act('/api/erp/hr', { action: 'payroll_save', month, slips: [] });
      notify(`Draft payroll built for ${month} — review below, then finalize.`);
      reload();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  const finalize = async (run: Run) => {
    if (!window.confirm(
      `Finalize payroll for ${run.month}?\n\nNet payout ${inr(run.totalNet)}. Advances get recovered, and the salary bill is posted to expenses. This cannot be re-run.`,
    )) return;
    try {
      await act('/api/erp/hr', { action: 'payroll_finalize', runId: run.id });
      notify('Payroll finalized'); reload();
    } catch (error) { notifyError(error); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gold/10 p-4 flex flex-wrap items-end gap-3">
        <Field label="Payroll Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" /></Field>
        <Button onClick={compute} disabled={busy} className="bg-gold hover:bg-gold-dark text-white rounded-none">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Build / Rebuild Draft'}
        </Button>
        <p className="text-[11px] text-muted-foreground max-w-md">
          Computes LOP from attendance, EPF 12% (basic, capped), ESI 0.75%/3.25% within the wage ceiling,
          professional tax by slab, TDS and advance recovery. Rebuilding a draft overwrites it; finalized months are locked.
        </p>
      </div>

      {runs.length === 0 ? <EmptyState message="No payroll runs yet." /> : runs.map((run) => (
        <div key={run.id} className="bg-white border border-gold/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-light tracking-wide">{run.month}</h3>
              <Chip label={run.status === 'finalized' ? 'Finalized' : 'Draft'}
                className={run.status === 'finalized' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-900 border-amber-200'} />
            </div>
            <div className="text-xs text-muted-foreground">
              Gross {inr(run.totalGross)} · Deductions {inr(run.totalDeductions)} · <strong className="text-charcoal">Net {inr(run.totalNet)}</strong>
              {' '}· Employer PF {inr(run.employerPf)} + ESI {inr(run.employerEsi)}
            </div>
            {run.status !== 'finalized' && (
              <Button size="sm" onClick={() => finalize(run)} className="bg-charcoal hover:bg-charcoal-light text-white rounded-none">
                Finalize
              </Button>
            )}
          </div>
          <DataTable headers={['Employee', 'Days', 'Gross', 'PF', 'ESI', 'PT', 'TDS', 'Adv', 'Net', '']} minWidth={860}>
            {run.payslips.map((slip) => (
              <tr key={slip.id}>
                <Td>{slip.employee.name}<span className="block text-[11px] text-muted-foreground">{slip.employee.empCode} · {titleCase(slip.employee.department)}</span></Td>
                <Td right>{slip.payableDays}/{slip.monthDays}{slip.lopDays > 0 && <span className="block text-[11px] text-red-700">LOP {slip.lopDays}</span>}</Td>
                <Td right>{inr(slip.grossEarned)}{slip.otPay > 0 && <span className="block text-[11px] text-muted-foreground">incl OT {inr(slip.otPay)}</span>}</Td>
                <Td right>{inr(slip.pfEmployee)}</Td>
                <Td right>{inr(slip.esiEmployee)}</Td>
                <Td right>{inr(slip.pt)}</Td>
                <Td right>{inr(slip.tds)}</Td>
                <Td right>{inr(slip.advanceRecovery)}</Td>
                <Td right className="font-medium">{inr(slip.netPay)}</Td>
                <Td>
                  <button className="text-muted-foreground hover:text-gold cursor-pointer" title="Print payslip"
                    onClick={() => window.open(`/erp/print/payslip/${slip.id}`, '_blank')}>
                    <Printer className="w-4 h-4" />
                  </button>
                </Td>
              </tr>
            ))}
          </DataTable>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmployeeDialog({ emp, onClose, onDone }: { emp: Partial<Employee>; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: emp.name ?? '', designation: emp.designation ?? '', department: emp.department ?? 'front_office',
    phone: emp.phone ?? '', email: emp.email ?? '', doj: emp.doj ?? '', status: emp.status ?? 'active',
    pan: emp.pan ?? '', aadhaar: emp.aadhaar ?? '', uan: emp.uan ?? '', esiNumber: emp.esiNumber ?? '',
    bankName: emp.bankName ?? '', bankAccount: emp.bankAccount ?? '', bankIfsc: emp.bankIfsc ?? '',
    basic: String(emp.basic ?? ''), hra: String(emp.hra ?? ''), otherAllowances: String(emp.otherAllowances ?? ''),
    tdsMonthly: String(emp.tdsMonthly ?? '0'), weeklyOff: emp.weeklyOff ?? 'monday', shift: emp.shift ?? 'general',
    pfOptIn: emp.pfOptIn ?? true, esiOptIn: emp.esiOptIn ?? true, ptApplicable: emp.ptApplicable ?? true,
  });

  const submit = async () => {
    setBusy(true);
    try {
      await act('/api/erp/hr', {
        action: 'employee_save', id: emp.id, ...form,
        basic: Number(form.basic) || 0, hra: Number(form.hra) || 0,
        otherAllowances: Number(form.otherAllowances) || 0, tdsMonthly: Number(form.tdsMonthly) || 0,
      });
      notify('Employee saved'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-light">{emp.id ? `${emp.empCode} — ${emp.name}` : 'New Employee'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Full Name" className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
          <Field label="Department">
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{titleCase(d)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Date of Joining"><Input type="date" value={form.doj} onChange={(e) => setForm({ ...form, doj: e.target.value })} /></Field>
          <Field label="Shift">
            <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['morning', 'evening', 'night', 'general'].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Weekly Off">
            <Select value={form.weeklyOff} onValueChange={(v) => setForm({ ...form, weeklyOff: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => <SelectItem key={d} value={d}>{titleCase(d)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {emp.id && (
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['active', 'resigned', 'terminated'].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
        </div>

        <p className="text-xs tracking-widest uppercase text-muted-foreground border-t border-gold/10 pt-3">Statutory IDs</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="PAN"><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></Field>
          <Field label="Aadhaar"><Input value={form.aadhaar} onChange={(e) => setForm({ ...form, aadhaar: e.target.value })} /></Field>
          <Field label="UAN (PF)"><Input value={form.uan} onChange={(e) => setForm({ ...form, uan: e.target.value })} /></Field>
          <Field label="ESI No"><Input value={form.esiNumber} onChange={(e) => setForm({ ...form, esiNumber: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Bank"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
          <Field label="Account No"><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></Field>
          <Field label="IFSC"><Input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} /></Field>
        </div>

        <p className="text-xs tracking-widest uppercase text-muted-foreground border-t border-gold/10 pt-3">Monthly Salary Structure</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Basic"><Input type="number" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} /></Field>
          <Field label="HRA"><Input type="number" value={form.hra} onChange={(e) => setForm({ ...form, hra: e.target.value })} /></Field>
          <Field label="Other Allowances"><Input type="number" value={form.otherAllowances} onChange={(e) => setForm({ ...form, otherAllowances: e.target.value })} /></Field>
          <Field label="TDS / month"><Input type="number" value={form.tdsMonthly} onChange={(e) => setForm({ ...form, tdsMonthly: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.pfOptIn} onCheckedChange={(v) => setForm({ ...form, pfOptIn: Boolean(v) })} /> EPF member
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.esiOptIn} onCheckedChange={(v) => setForm({ ...form, esiOptIn: Boolean(v) })} /> ESI member
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.ptApplicable} onCheckedChange={(v) => setForm({ ...form, ptApplicable: Boolean(v) })} /> Professional Tax
          </label>
        </div>

        <Button onClick={submit} disabled={busy || !form.name} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Employee'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
