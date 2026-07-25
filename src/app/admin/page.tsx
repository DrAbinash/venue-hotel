'use client';

import { useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import AdminPanel from '@/components/admin/AdminPanel';

export default function AdminPage() {
  const { setRooms, setFloors, setBookings, setGallery, setSettings } = useHotelStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [roomsRes, floorsRes, bookingsRes, galleryRes, settingsRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/floors'),
          fetch('/api/bookings'),
          fetch('/api/gallery'),
          fetch('/api/settings'),
        ]);

        setRooms(await roomsRes.json());
        setFloors(await floorsRes.json());
        setBookings(await bookingsRes.json());
        setGallery(await galleryRes.json());
        setSettings(await settingsRes.json());
      } catch (err) {
        console.error('Failed to load admin data:', err);
      }
    };
    loadData();
  }, [setRooms, setFloors, setBookings, setGallery, setSettings]);

  return <AdminPanel />;
}
