'use client';

import SettingsForm from '@/components/admin/SettingsForm';

/** Every word and image on the public website. */
export default function AdminContent() {
  return (
    <SettingsForm
      section="content"
      title="Website Content"
      intro="All the copy, imagery and SEO metadata on the public site. Nothing is hard-coded — edit it here and it changes everywhere."
    />
  );
}
