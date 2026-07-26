'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, BedDouble, Boxes, CalendarRange, ChefHat,
  Hotel, KeyRound, LayoutDashboard, Loader2, LogOut, Moon, PartyPopper, ScrollText,
  Settings, ShieldCheck, SprayCan, UserRound, Users, Wallet, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { act, api, notify, notifyError } from '@/components/erp/lib';
import { Field } from '@/components/erp/ui';
import type { ErpModule } from '@/lib/erp/perms';

import Dashboard from '@/components/erp/Dashboard';
import FrontDesk from '@/components/erp/FrontDesk';
import Reservations from '@/components/erp/Reservations';
import Housekeeping from '@/components/erp/Housekeeping';
import Pos from '@/components/erp/Pos';
import Inventory from '@/components/erp/Inventory';
import Hr from '@/components/erp/Hr';
import Maintenance from '@/components/erp/Maintenance';
import Banquets from '@/components/erp/Banquets';
import Finance from '@/components/erp/Finance';
import Guests from '@/components/erp/Guests';
import Reports from '@/components/erp/Reports';
import UsersAdmin from '@/components/erp/Users';
import AuditTrail from '@/components/erp/AuditTrail';
import ErpSettings from '@/components/erp/ErpSettings';

interface SessionUser {
  username: string;
  name: string;
  role: string;
  modules: string[];
  mustChangePassword: boolean;
}

const NAV: { key: ErpModule; label: string; icon: React.ReactNode; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, group: 'Overview' },
  { key: 'frontdesk', label: 'Front Desk', icon: <BedDouble className="w-4 h-4" />, group: 'Front Office' },
  { key: 'reservations', label: 'Reservations', icon: <CalendarRange className="w-4 h-4" />, group: 'Front Office' },
  { key: 'guests', label: 'Guest CRM', icon: <UserRound className="w-4 h-4" />, group: 'Front Office' },
  { key: 'housekeeping', label: 'Housekeeping', icon: <SprayCan className="w-4 h-4" />, group: 'Operations' },
  { key: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" />, group: 'Operations' },
  { key: 'pos', label: 'Restaurant POS', icon: <ChefHat className="w-4 h-4" />, group: 'F&B' },
  { key: 'banquets', label: 'Banquets & Events', icon: <PartyPopper className="w-4 h-4" />, group: 'F&B' },
  { key: 'inventory', label: 'Stores & Purchase', icon: <Boxes className="w-4 h-4" />, group: 'Back Office' },
  { key: 'hr', label: 'HR & Payroll', icon: <Users className="w-4 h-4" />, group: 'Back Office' },
  { key: 'finance', label: 'Finance & GST', icon: <Wallet className="w-4 h-4" />, group: 'Money' },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" />, group: 'Money' },
  { key: 'users', label: 'Staff Users', icon: <ShieldCheck className="w-4 h-4" />, group: 'System' },
  { key: 'settings', label: 'ERP Settings', icon: <Settings className="w-4 h-4" />, group: 'System' },
  { key: 'audit', label: 'Audit Trail', icon: <ScrollText className="w-4 h-4" />, group: 'System' },
];

const MODULES: Record<string, React.FC> = {
  dashboard: Dashboard,
  frontdesk: FrontDesk,
  reservations: Reservations,
  guests: Guests,
  housekeeping: Housekeeping,
  maintenance: Maintenance,
  pos: Pos,
  banquets: Banquets,
  inventory: Inventory,
  hr: Hr,
  finance: Finance,
  reports: Reports,
  users: UsersAdmin,
  settings: ErpSettings,
  audit: AuditTrail,
};

export default function ErpApp() {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<string>('dashboard');
  const [pwOpen, setPwOpen] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await api<{ authenticated: boolean; needsSetup: boolean; user?: SessionUser }>('/api/erp/session');
      setNeedsSetup(data.needsSetup);
      setUser(data.authenticated && data.user ? data.user : null);
      if (data.authenticated && data.user) {
        setTab((prev) => (data.user!.modules.includes(prev) ? prev : data.user!.modules[0] ?? 'dashboard'));
        if (data.user.mustChangePassword) setPwOpen(true);
      }
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  const signOut = async () => {
    await fetch('/api/erp/session', { method: 'DELETE' });
    setUser(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream/30">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) {
    return <ErpLogin needsSetup={needsSetup} onSuccess={loadSession} />;
  }

  const allowed = NAV.filter((item) => user.modules.includes(item.key));
  const groups = [...new Set(allowed.map((item) => item.group))];
  const Active = MODULES[tab] ?? Dashboard;

  return (
    <div className="min-h-screen bg-cream/30">
      <header className="bg-charcoal text-white px-4 sm:px-6 py-3 sticky top-0 z-40">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Hotel className="w-5 h-5 text-gold flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-light tracking-[0.2em] uppercase truncate">Hotel ERP</h1>
              <p className="text-[10px] text-white/50 tracking-widest uppercase hidden sm:block">Property Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="text-xs text-white/60 hover:text-gold tracking-wider uppercase hidden sm:block">
              Website
            </Link>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/90">{user.name}</p>
              <p className="text-[10px] text-gold tracking-widest uppercase">{user.role}</p>
            </div>
            <Button
              variant="ghost" size="sm" onClick={() => setPwOpen(true)}
              className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2" title="Change password"
            >
              <KeyRound className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="sm" onClick={signOut}
              className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2" title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-3 sm:px-6 py-5">
        <div className="flex flex-col lg:flex-row gap-5">
          <nav className="lg:w-56 flex-shrink-0">
            <div className="bg-white border border-gold/10 p-2 lg:sticky lg:top-16">
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                {groups.map((group) => (
                  <div key={group} className="contents lg:block">
                    <p className="hidden lg:block text-[10px] tracking-widest uppercase text-muted-foreground px-3 pt-3 pb-1">
                      {group}
                    </p>
                    {allowed.filter((item) => item.group === group).map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm whitespace-nowrap transition-all cursor-pointer w-full text-left ${
                          tab === item.key ? 'bg-gold text-white' : 'text-charcoal/70 hover:text-gold hover:bg-cream/50'
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </nav>

          <main className="flex-1 min-w-0">
            <Active />
          </main>
        </div>
      </div>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} forced={user.mustChangePassword} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ErpLogin({ needsSetup, onSuccess }: { needsSetup: boolean; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', adminPassword: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsSetup) {
        await act('/api/erp/session', {
          action: 'setup',
          adminPassword: form.adminPassword,
          username: form.username,
          password: form.password,
          name: form.name,
        });
        notify('Administrator account created. Welcome!');
      } else {
        await act('/api/erp/session', { action: 'login', username: form.username, password: form.password });
      }
      onSuccess();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 border border-gold/40 mb-4">
            <Moon className="w-6 h-6 text-gold" />
          </div>
          <h1 className="text-2xl font-light tracking-[0.3em] uppercase text-white">Staff Login</h1>
          <p className="text-xs tracking-widest uppercase text-gold mt-2">
            {needsSetup ? 'First-time setup' : 'Hotel ERP · Property Management'}
          </p>
        </div>

        <form onSubmit={submit} className="bg-white p-6 sm:p-8 space-y-4">
          {needsSetup && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No staff accounts exist yet. Enter the <strong>website admin password</strong> to
                authorise creation of the first ERP administrator.
              </p>
              <Field label="Website Admin Password">
                <Input type="password" required value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              </Field>
              <Field label="Your Name">
                <Input required value={form.name} placeholder="e.g. Rajesh Kumar"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Username">
            <Input required autoFocus value={form.username} autoComplete="username"
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label={needsSetup ? 'Choose a Password (min 8 chars)' : 'Password'}>
            <Input type="password" required value={form.password} autoComplete="current-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Button type="submit" disabled={busy}
            className="w-full bg-gold hover:bg-gold-dark text-white tracking-widest uppercase text-xs py-5 rounded-none">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : needsSetup ? 'Create Administrator' : 'Sign In'}
          </Button>
          <div className="text-center pt-1">
            <Link href="/" className="text-xs text-muted-foreground hover:text-gold tracking-wider">
              ← Back to website
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordDialog({ open, onOpenChange, forced }: {
  open: boolean; onOpenChange: (open: boolean) => void; forced: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });

  const submit = async () => {
    if (form.next !== form.confirm) { notifyError(new Error('Passwords do not match')); return; }
    setBusy(true);
    try {
      await api('/api/erp/session', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      notify('Password changed');
      setForm({ current: '', next: '', confirm: '' });
      onOpenChange(false);
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">
            {forced ? 'Set a New Password' : 'Change Password'}
          </DialogTitle>
        </DialogHeader>
        {forced && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
            Your password was set by an administrator — please choose your own before continuing.
          </p>
        )}
        <div className="space-y-3">
          <Field label="Current Password">
            <Input type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </Field>
          <Field label="New Password (min 8 chars)">
            <Input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </Field>
          <Field label="Confirm New Password">
            <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="bg-gold hover:bg-gold-dark text-white rounded-none">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
