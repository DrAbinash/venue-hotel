'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Lock, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import ImageField from '@/components/admin/ImageField';
import type { SettingField, SettingGroup } from '@/lib/settings-schema';

interface SettingsFormProps {
  /** Which part of the schema to render. */
  section: 'content' | 'settings' | 'payments';
  title: string;
  intro: string;
  /** Rendered above the form — used by the payments tab for its gateway guide. */
  children?: React.ReactNode;
}

/**
 * Renders editors straight off the settings schema.
 *
 * Because the schema is the single source of truth, adding a field to
 * settings-schema.ts makes it appear here automatically — there is no
 * second list of form controls to keep in step.
 */
export default function SettingsForm({ section, title, intro, children }: SettingsFormProps) {
  const { toast } = useToast();
  const setStoreSettings = useHotelStore((state) => state.setSettings);

  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?schema=1');
      if (!res.ok) throw new Error('Could not load settings.');
      const data = await res.json();
      setGroups(data.groups ?? []);
      setValues(data.settings ?? {});
      setSaved(data.settings ?? {});
      setLockedKeys(data.lockedKeys ?? []);
    } catch (error) {
      toast({
        title: 'Could not load settings',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state settles after the await, not synchronously.
  useEffect(() => { load(); }, [load]);

  const dirty = Object.keys(values).some((key) => values[key] !== saved[key]);

  const save = async () => {
    setSaving(true);
    try {
      // Send only what actually changed, so untouched secrets stay untouched.
      const changed = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => value !== saved[key]),
      );
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: changed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed.');

      setValues(data.settings ?? values);
      setSaved(data.settings ?? values);
      setStoreSettings(data.settings ?? values);

      const skipped = (data.skipped ?? []).filter((key: string) => key in changed);
      toast({
        title: `Saved ${data.saved?.length ?? 0} setting(s)`,
        description: skipped.length
          ? `${skipped.length} left unchanged (set by an environment variable, or a secret you did not retype).`
          : undefined,
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: SettingField) => {
    const locked = lockedKeys.includes(field.key);
    const value = values[field.key] ?? '';
    const set = (next: string) => setValues((current) => ({ ...current, [field.key]: next }));

    const label = (
      <Label className="text-xs tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
        {field.label}
        {locked && <Lock className="w-3 h-3 text-gold" />}
      </Label>
    );

    if (field.type === 'boolean') {
      return (
        <div key={field.key} className="flex items-start justify-between gap-4 py-2">
          <div className="min-w-0">
            {label}
            {field.help && <p className="text-[11px] text-muted-foreground mt-1">{field.help}</p>}
          </div>
          <Switch
            checked={value === 'true'}
            disabled={locked}
            onCheckedChange={(checked) => set(checked ? 'true' : 'false')}
          />
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-2">
        {label}

        {field.type === 'textarea' ? (
          <Textarea value={value} onChange={(e) => set(e.target.value)} disabled={locked} rows={4} className="rounded-none border-gold/20 resize-none" />
        ) : field.type === 'json' || field.type === 'list' || field.type === 'imageList' ? (
          <Textarea
            value={value}
            onChange={(e) => set(e.target.value)}
            disabled={locked}
            rows={field.type === 'json' ? 8 : 4}
            spellCheck={false}
            className={`rounded-none border-gold/20 resize-y font-mono text-xs ${
              value && !isValidJson(value) ? 'border-red-400' : ''
            }`}
          />
        ) : field.type === 'image' ? (
          <ImageField value={value} onChange={set} folder={field.key} />
        ) : field.type === 'select' ? (
          <Select value={value} onValueChange={set} disabled={locked}>
            <SelectTrigger className="rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === 'color' ? (
          <div className="flex gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#c9a96e'}
              onChange={(e) => set(e.target.value)}
              disabled={locked}
              className="h-10 w-14 border border-gold/20 cursor-pointer"
            />
            <Input value={value} onChange={(e) => set(e.target.value)} disabled={locked} className="rounded-none border-gold/20" />
          </div>
        ) : (
          <Input
            type={field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => set(e.target.value)}
            disabled={locked}
            autoComplete={field.type === 'secret' ? 'new-password' : undefined}
            placeholder={field.type === 'secret' ? 'Enter a new value to replace the stored one' : undefined}
            className="rounded-none border-gold/20"
          />
        )}

        {(field.type === 'json' || field.type === 'list' || field.type === 'imageList') && value && !isValidJson(value) && (
          <p className="text-[11px] text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> This is not valid JSON yet — the site will keep using the previous value.
          </p>
        )}
        {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
        {locked && (
          <p className="text-[11px] text-gold">Pinned by an environment variable, so it cannot be edited here.</p>
        )}
      </div>
    );
  };

  const visibleGroups = groups.filter((group) => group.section === section);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{intro}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setValues(saved)}
            disabled={!dirty || saving}
            className="border-gold/20 text-xs tracking-wider uppercase rounded-none"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
          </Button>
          <Button
            onClick={save}
            disabled={!dirty || saving}
            className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {children}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <section key={group.key} className="bg-white border border-gold/10 p-6">
              <h3 className="text-sm tracking-widest uppercase text-charcoal">{group.label}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-5">{group.description}</p>
              <div className="space-y-5 max-w-2xl">{group.fields.map(renderField)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
