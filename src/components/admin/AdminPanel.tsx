'use client';

import { useHotelStore } from '@/lib/store';
import { ArrowLeft, Hotel, BedDouble, ImageIcon, CalendarCheck, Settings, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminRooms from './AdminRooms';
import AdminFloors from './AdminFloors';
import AdminBookings from './AdminBookings';
import AdminGallery from './AdminGallery';
import AdminSettings from './AdminSettings';

const tabs = [
  { key: 'rooms', label: 'Rooms', icon: <BedDouble className="w-4 h-4" /> },
  { key: 'floors', label: 'Floors', icon: <Layers className="w-4 h-4" /> },
  { key: 'bookings', label: 'Bookings', icon: <CalendarCheck className="w-4 h-4" /> },
  { key: 'gallery', label: 'Gallery', icon: <ImageIcon className="w-4 h-4" /> },
  { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function AdminPanel() {
  const { adminTab, setAdminTab, setView, bookings, rooms } = useHotelStore();

  const TabComponent: Record<string, React.FC> = {
    rooms: AdminRooms,
    floors: AdminFloors,
    bookings: AdminBookings,
    gallery: AdminGallery,
    settings: AdminSettings,
  };

  const ActiveTab = TabComponent[adminTab] || AdminRooms;

  return (
    <div className="min-h-screen bg-cream/30">
      {/* Admin Header */}
      <div className="bg-white border-b border-gold/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => { setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-muted-foreground hover:text-gold -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Site
            </Button>
            <div className="h-6 w-[1px] bg-gold/20" />
            <div className="flex items-center gap-2">
              <Hotel className="w-5 h-5 text-gold" />
              <h1 className="text-lg font-light tracking-wider">Admin Panel</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Badge variant="outline" className="text-xs">{rooms.length} rooms</Badge>
            <Badge variant="outline" className="text-xs">{bookings.length} bookings</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-56 flex-shrink-0">
            <div className="bg-white border border-gold/10 p-2 lg:sticky lg:top-24">
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAdminTab(tab.key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 text-sm whitespace-nowrap transition-all rounded-none cursor-pointer w-full text-left ${
                      adminTab === tab.key
                        ? 'bg-gold text-white'
                        : 'text-charcoal/70 hover:text-gold hover:bg-cream/50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  );
}