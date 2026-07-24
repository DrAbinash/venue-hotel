'use client';

import { useState } from 'react';
import { Hotel, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AdminLoginProps {
  onSuccess: (usingDefaultPassword: boolean) => void;
}

/** Password gate for the admin panel. */
export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-in failed.');
      onSuccess(Boolean(data.usingDefaultPassword));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream/30">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-gold/15 luxury-shadow p-8 space-y-5">
        <div className="text-center">
          <Hotel className="w-8 h-8 text-gold mx-auto mb-3" />
          <h1 className="text-xl font-light tracking-[0.2em] uppercase text-charcoal">Admin Panel</h1>
          <div className="w-10 h-[1px] bg-gold mx-auto mt-3" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs tracking-widest uppercase text-muted-foreground">Password</Label>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-none border-gold/20"
          />
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase py-5 rounded-none"
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in…</> : <><Lock className="w-4 h-4 mr-2" /> Sign In</>}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          Set <code className="text-charcoal">ADMIN_PASSWORD</code> in the environment to change this.
        </p>
      </form>
    </div>
  );
}
