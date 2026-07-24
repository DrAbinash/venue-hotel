'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowLeft, BedDouble, CalendarCheck, Hotel, ImageIcon, Images, LayoutDashboard,
  Layers, Loader2, LogOut, Settings, Type, UtensilsCrossed, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelStore } from '@/lib/store';
import AdminLogin from '@/components/admin/AdminLogin';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminRooms from '@/components/admin/AdminRooms';
import AdminFloors from '@/components/admin/AdminFloors';
import AdminBookings from '@/components/admin/AdminBookings';
import AdminGallery from '@/components/admin/AdminGallery';
import AdminMedia from '@/components/admin/AdminMedia';
import AdminMenu from '@/components/admin/AdminMenu';
import AdminOrders from '@/components/admin/AdminOrders';
import AdminPayments from '@/components/admin/AdminPayments';
import AdminContent from '@/components/admin/AdminContent';
import AdminSettings from '@/components/admin/AdminSettings';

const TABS: { key: string; label: string; icon: React.ReactNode; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, group: 'Overview' },
  { key: 'bookings', label: 'Reservations', icon: <CalendarCheck className="w-4 h-4" />, group: 'Hotel' },
  { key: 'rooms', label: 'Rooms', icon: <BedDouble className="w-4 h-4" />, group: 'Hotel' },
  { key: 'floors', label: 'Floors', icon: <Layers className="w-4 h-4" />, group: 'Hotel' },
  { key: 'orders', label: 'Food Orders', icon: <UtensilsCrossed className="w-4 h-4" />, group: 'Restaurant' },
  { key: 'menu', label: 'Menu', icon: <Type className="w-4 h-4" />, group: 'Restaurant' },
  { key: 'payments', label: 'Payments', icon: <Wallet className="w-4 h-4" />, group: 'Money' },
  { key: 'gallery', label: 'Gallery', icon: <ImageIcon className="w-4 h-4" />, group: 'Content' },
  { key: 'media', label: 'Media', icon: <Images className="w-4 h-4" />, group: 'Content' },
  { key: 'content', label: 'Website Copy', icon: <Type className="w-4 h-4" />, group: 'Content' },
  { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, group: 'Content' },
];

const TAB_COMPONENTS: Record<string, React.FC> = {
  dashboard: AdminDashboard,
  bookings: AdminBookings,
  rooms: AdminRooms,
  floors: AdminFloors,
  orders: AdminOrders,
  menu: AdminMenu,
  payments: AdminPayments,
  gallery: AdminGallery,
  media: AdminMedia,
  content: AdminContent,
  settings: AdminSettings,
};

export default function AdminPanel() {
  const { adminTab, setAdminTab, isAdmin, setIsAdmin, setSettings } = useHotelStore();
  const [checking, setChecking] = useState(true);
  const [defaultPassword, setDefaultPassword] = useState(false);

  /** Admin settings include gateway config, so reload them once signed in. */
  const loadAdminSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) setSettings(await res.json());
  }, [setSettings]);

  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(Boolean(data.authenticated));
        setDefaultPassword(Boolean(data.usingDefaultPassword));
        if (data.authenticated) loadAdminSettings();
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, [setIsAdmin, loadAdminSettings]);

  const signOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setIsAdmin(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLogin
        onSuccess={(usingDefault) => {
          setIsAdmin(true);
          setDefaultPassword(usingDefault);
          loadAdminSettings();
        }}
      />
    );
  }

  const ActiveTab = TAB_COMPONENTS[adminTab] ?? AdminDashboard;
  const groups = [...new Set(TABS.map((tab) => tab.group))];

  return (
    <div className="min-h-screen bg-cream/30">
      <header className="bg-white border-b border-gold/10 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link href="/" className="text-muted-foreground hover:text-gold flex items-center gap-1 text-sm whitespace-nowrap">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Site</span>
            </Link>
            <div className="h-6 w-[1px] bg-gold/20 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <Hotel className="w-5 h-5 text-gold flex-shrink-0" />
              <h1 className="text-base sm:text-lg font-light tracking-wider truncate">Admin Panel</h1>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-charcoal text-xs tracking-wider uppercase">
            <LogOut className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {defaultPassword && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5">
          <p className="max-w-7xl mx-auto text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            This panel is using the built-in default password. Set <code className="mx-1">ADMIN_PASSWORD</code> in the environment before going live.
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <nav className="lg:w-56 flex-shrink-0">
            <div className="bg-white border border-gold/10 p-2 lg:sticky lg:top-6">
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                {groups.map((group) => (
                  <div key={group} className="contents lg:block">
                    <p className="hidden lg:block text-[10px] tracking-widest uppercase text-muted-foreground px-3 pt-3 pb-1">
                      {group}
                    </p>
                    {TABS.filter((tab) => tab.group === group).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setAdminTab(tab.key)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 text-sm whitespace-nowrap transition-all cursor-pointer w-full text-left ${
                          adminTab === tab.key ? 'bg-gold text-white' : 'text-charcoal/70 hover:text-gold hover:bg-cream/50'
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  );
}
