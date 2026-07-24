'use client';

import SettingsForm from '@/components/admin/SettingsForm';

/** Operational configuration: brand, contact, policies, booking rules, restaurant. */
export default function AdminSettings() {
  return (
    <SettingsForm
      section="settings"
      title="Hotel Settings"
      intro="Names, contact details and the rules the booking engine enforces. Everything here is a placeholder until you change it."
    />
  );
}
