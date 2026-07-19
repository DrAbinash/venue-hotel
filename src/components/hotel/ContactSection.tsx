'use client';

import { useHotelStore } from '@/lib/store';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function ContactSection() {
  const { settings } = useHotelStore();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({ title: 'Message sent successfully!', description: 'We will get back to you shortly.' });
    setForm({ name: '', email: '', phone: '', message: '' });
    setSending(false);
  };

  const contactInfo = [
    { icon: <MapPin className="w-5 h-5" />, label: 'Address', value: settings.address || '42 Heritage Lane, City Center' },
    { icon: <Phone className="w-5 h-5" />, label: 'Phone', value: settings.phone || '+1 (555) 234-5678' },
    { icon: <Mail className="w-5 h-5" />, label: 'Email', value: settings.email || 'reservations@thevenue.com' },
    { icon: <Clock className="w-5 h-5" />, label: 'Check-in / Check-out', value: `${settings.checkInTime || '14:00'} / ${settings.checkOutTime || '11:00'}` },
  ];

  return (
    <section className="py-20 md:py-28 charcoal-bg text-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: '#c9a96e' }}>
            Get in Touch
          </p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide mb-4">
            Contact Us
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto mb-6" />
          <p className="text-white/60 max-w-2xl mx-auto leading-relaxed">
            Whether you have a question about reservations, events, or special requests,
            our team is here to assist you every step of the way.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-light tracking-wider mb-8" style={{ color: '#c9a96e' }}>
              {settings.hotelName || 'The Venue'}
            </h3>
            <div className="space-y-6">
              {contactInfo.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 border border-gold/30 flex items-center justify-center text-gold">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs tracking-widest uppercase text-white/50 mb-1">{item.label}</p>
                    <p className="text-white/90">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 border border-gold/20">
              <p className="text-xs tracking-widest uppercase mb-3" style={{ color: '#c9a96e' }}>Location</p>
              <div className="w-full h-48 bg-charcoal-light flex items-center justify-center text-white/30 text-sm">
                Map Placeholder
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest uppercase text-white/60">Full Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                    className="bg-charcoal-light border-gold/20 text-white placeholder:text-white/30 rounded-none h-11 focus:border-gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest uppercase text-white/60">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@example.com"
                    className="bg-charcoal-light border-gold/20 text-white placeholder:text-white/30 rounded-none h-11 focus:border-gold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-white/60">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="bg-charcoal-light border-gold/20 text-white placeholder:text-white/30 rounded-none h-11 focus:border-gold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-white/60">Message *</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="How can we help you?"
                  rows={5}
                  className="bg-charcoal-light border-gold/20 text-white placeholder:text-white/30 rounded-none focus:border-gold resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={sending}
                className="w-full bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase h-12 rounded-none transition-all"
              >
                {sending ? 'Sending...' : 'Send Message'}
                <Send className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}