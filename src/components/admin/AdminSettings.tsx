'use client';

import { useHotelStore } from '@/lib/store';
import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const defaultSettings: Record<string, { label: string; type: 'text' | 'textarea' }> = {
  hotelName: { label: 'Hotel Name', type: 'text' },
  tagline: { label: 'Tagline', type: 'text' },
  address: { label: 'Address', type: 'text' },
  city: { label: 'City', type: 'text' },
  phone: { label: 'Phone', type: 'text' },
  email: { label: 'Email', type: 'text' },
  checkInTime: { label: 'Check-in Time', type: 'text' },
  checkOutTime: { label: 'Check-out Time', type: 'text' },
  heroSubtitle: { label: 'Hero Subtitle', type: 'text' },
  description: { label: 'Description', type: 'textarea' },
};

export default function AdminSettings() {
  const { settings, setSettings } = useHotelStore();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: form }),
      });
      setSettings(form);
      toast({ title: 'Settings saved successfully' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setForm({ ...settings });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Hotel Settings</h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
            <Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gold/10 p-6 max-w-2xl">
        <p className="text-sm text-muted-foreground mb-6">Configure your hotel details, contact information, and display settings.</p>
        <div className="space-y-5">
          {Object.entries(defaultSettings).map(([key, config]) => (
            <div key={key} className="space-y-2">
              <Label className="text-xs tracking-wider uppercase text-muted-foreground">{config.label}</Label>
              {config.type === 'textarea' ? (
                <Textarea
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  rows={4}
                  className="rounded-none border-gold/20 resize-none"
                />
              ) : (
                <Input
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="rounded-none border-gold/20"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}