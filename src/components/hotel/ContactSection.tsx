'use client';

import { useState } from 'react';
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useHotelStore } from '@/lib/store';
import { text } from '@/lib/content';

export default function ContactSection() {
  const { settings } = useHotelStore();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const address = [
    text(settings, 'address'),
    [text(settings, 'city'), text(settings, 'state'), text(settings, 'postalCode')].filter(Boolean).join(', '),
    text(settings, 'country'),
  ].filter(Boolean);

  const whatsapp = text(settings, 'whatsapp', '').replace(/\D/g, '');
  const mapUrl = text(settings, 'mapEmbedUrl', '');

  /**
   * Enquiries open the guest's own mail client. There is no outbound mail
   * service configured, and silently dropping a message would be worse than
   * handing it to something that definitely sends.
   */
  const sendEnquiry = (event: React.FormEvent) => {
    event.preventDefault();
    const to = text(settings, 'email');
    const subject = encodeURIComponent(form.subject || `Enquiry from ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\n—\n${form.name}\n${form.email}`);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">{text(settings, 'contactEyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal">{text(settings, 'contactTitle')}</h2>
          <div className="w-16 h-[1px] bg-gold mx-auto my-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto">{text(settings, 'contactSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="w-5 h-5 text-gold flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Address</p>
                  {address.map((line) => (
                    <p key={line} className="text-charcoal/80">{line}</p>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Phone className="w-5 h-5 text-gold flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Telephone</p>
                  <a href={`tel:${text(settings, 'phone')}`} className="block text-charcoal/80 hover:text-gold transition-colors">
                    {text(settings, 'phone')}
                  </a>
                  {text(settings, 'phoneAlt', '') && (
                    <a href={`tel:${text(settings, 'phoneAlt')}`} className="block text-charcoal/80 hover:text-gold transition-colors">
                      {text(settings, 'phoneAlt')} (reservations)
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Mail className="w-5 h-5 text-gold flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Email</p>
                  <a href={`mailto:${text(settings, 'email')}`} className="block text-charcoal/80 hover:text-gold transition-colors">
                    {text(settings, 'email')}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock className="w-5 h-5 text-gold flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Check-in / Check-out</p>
                  <p className="text-charcoal/80">
                    From {text(settings, 'checkInTime')} · until {text(settings, 'checkOutTime')}
                  </p>
                </div>
              </div>

              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-dark transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Message us on WhatsApp
                </a>
              )}
            </div>

            {mapUrl && (
              <div className="aspect-[4/3] border border-gold/15">
                <iframe
                  src={mapUrl}
                  title="Hotel location"
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>

          <form onSubmit={sendEnquiry} className="bg-cream/40 border border-gold/10 p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="h-11 border-gold/20 bg-white rounded-none focus:border-gold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Email</Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="h-11 border-gold/20 bg-white rounded-none focus:border-gold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Subject</Label>
              <Input
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                className="h-11 border-gold/20 bg-white rounded-none focus:border-gold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Message</Label>
              <Textarea
                required
                rows={5}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                className="border-gold/20 bg-white rounded-none focus:border-gold resize-none"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase py-5 rounded-none"
            >
              <Send className="w-4 h-4 mr-2" /> Send Enquiry
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
