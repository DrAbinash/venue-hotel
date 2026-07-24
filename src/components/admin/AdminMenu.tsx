'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import ImageField from '@/components/admin/ImageField';
import type { MenuCategory, MenuItem } from '@/lib/types';

const ICON_CHOICES = ['utensils', 'coffee', 'pizza', 'salad', 'soup', 'sandwich', 'beef', 'cake', 'icecream', 'drink', 'bread', 'leaf'];

const EMPTY_ITEM: Partial<MenuItem> = {
  name: '', description: '', imageUrl: '', basePrice: 0, sizes: '[]', addons: '[]',
  isVeg: true, spiceLevel: 0, prepMinutes: 15, isAvailable: true, isBestseller: false, sortOrder: 0,
};

/** Menu management: categories, dishes, sizes and add-ons. */
export default function AdminMenu() {
  const { toast } = useToast();
  const { settings } = useHotelStore();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemDraft, setItemDraft] = useState<(Partial<MenuItem> & { categoryId?: string }) | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<Partial<MenuCategory> | null>(null);
  const [saving, setSaving] = useState(false);

  const money = (value: number) => formatMoney(value, settings);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) setCategories(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveItem = async () => {
    if (!itemDraft?.name || !itemDraft.categoryId) {
      toast({ title: 'A dish needs a name and a category', variant: 'destructive' });
      return;
    }
    for (const key of ['sizes', 'addons'] as const) {
      try {
        JSON.parse(String(itemDraft[key] ?? '[]'));
      } catch {
        toast({ title: `The ${key} list is not valid JSON`, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/menu', {
        method: itemDraft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast({ title: itemDraft.id ? 'Dish updated' : 'Dish added' });
      setItemDraft(null);
      load();
    } catch (error) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryDraft?.name) {
      toast({ title: 'A category needs a name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/menu', {
        method: categoryDraft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...categoryDraft, kind: 'category' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast({ title: categoryDraft.id ? 'Category updated' : 'Category added' });
      setCategoryDraft(null);
      load();
    } catch (error) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: MenuItem) => {
    if (!confirm(`Remove “${item.name}” from the menu?`)) return;
    await fetch(`/api/menu?id=${item.id}&kind=item`, { method: 'DELETE' });
    toast({ title: 'Dish removed' });
    load();
  };

  const removeCategory = async (category: MenuCategory) => {
    if (!confirm(`Delete “${category.name}” and its ${category.items.length} dish(es)?`)) return;
    await fetch(`/api/menu?id=${category.id}&kind=category`, { method: 'DELETE' });
    toast({ title: 'Category deleted' });
    load();
  };

  const toggleAvailability = async (item: MenuItem, isAvailable: boolean) => {
    // Optimistic: the kitchen flips these constantly during service.
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        items: category.items.map((candidate) => (candidate.id === item.id ? { ...candidate, isAvailable } : candidate)),
      })),
    );
    await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, isAvailable }),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Restaurant Menu</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Categories, dishes, sizes and extras. Toggle a dish off to hide it the moment it sells out.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCategoryDraft({ name: '', icon: 'utensils', isActive: true, sortOrder: categories.length + 1 })}
            className="border-gold/20 text-xs tracking-wider uppercase rounded-none"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Category
          </Button>
          <Button
            onClick={() => setItemDraft({ ...EMPTY_ITEM, categoryId: categories[0]?.id })}
            disabled={categories.length === 0}
            className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Dish
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the menu…
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-gold/10 p-12 text-center">
          <UtensilsCrossed className="w-10 h-10 text-gold/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No categories yet. Add one to start building the menu.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <section key={category.id} className="bg-white border border-gold/10">
              <header className="flex items-center justify-between px-5 py-3 border-b border-gold/10 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm tracking-widest uppercase text-charcoal">{category.name}</h3>
                  <Badge variant="outline" className="text-[10px] rounded-none">{category.items.length} items</Badge>
                  {!category.isActive && <Badge variant="outline" className="text-[10px] rounded-none text-muted-foreground">hidden</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setCategoryDraft(category)} className="text-xs">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeCategory(category)} className="text-xs text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setItemDraft({ ...EMPTY_ITEM, categoryId: category.id, sortOrder: category.items.length + 1 })}
                    className="text-xs text-gold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Dish
                  </Button>
                </div>
              </header>

              <div className="divide-y divide-gold/5">
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                    <div
                      className="w-12 h-12 flex-shrink-0 bg-cream bg-cover bg-center"
                      style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal flex items-center gap-2">
                        <span className={`w-3 h-3 border flex items-center justify-center flex-shrink-0 ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                          <span className={`w-1 h-1 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                        </span>
                        {item.name}
                        {item.isBestseller && <Badge variant="outline" className="text-[9px] rounded-none border-gold text-gold">bestseller</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <span className="text-sm text-charcoal whitespace-nowrap">{money(item.basePrice)}</span>
                    <Switch checked={item.isAvailable} onCheckedChange={(checked) => toggleAvailability(item, checked)} />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setItemDraft(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeItem(item)} className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {category.items.length === 0 && (
                  <p className="px-5 py-6 text-sm text-muted-foreground text-center">No dishes in this category yet.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ dish editor */}
      <Dialog open={Boolean(itemDraft)} onOpenChange={(open) => !open && setItemDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none border-gold/20">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">{itemDraft?.id ? 'Edit Dish' : 'New Dish'}</DialogTitle>
          </DialogHeader>

          {itemDraft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Name *</Label>
                  <Input value={itemDraft.name ?? ''} onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })} className="rounded-none border-gold/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Category *</Label>
                  <Select value={itemDraft.categoryId ?? ''} onValueChange={(value) => setItemDraft({ ...itemDraft, categoryId: value })}>
                    <SelectTrigger className="rounded-none border-gold/20"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Description</Label>
                <Textarea rows={2} value={itemDraft.description ?? ''} onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })} className="rounded-none border-gold/20 resize-none" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Photo</Label>
                <ImageField value={itemDraft.imageUrl ?? ''} onChange={(url) => setItemDraft({ ...itemDraft, imageUrl: url })} folder="menu" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Base Price</Label>
                  <Input type="number" value={itemDraft.basePrice ?? 0} onChange={(e) => setItemDraft({ ...itemDraft, basePrice: Number.parseFloat(e.target.value) || 0 })} className="rounded-none border-gold/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Prep (min)</Label>
                  <Input type="number" value={itemDraft.prepMinutes ?? 15} onChange={(e) => setItemDraft({ ...itemDraft, prepMinutes: Number.parseInt(e.target.value, 10) || 0 })} className="rounded-none border-gold/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Calories</Label>
                  <Input type="number" value={itemDraft.calories ?? ''} onChange={(e) => setItemDraft({ ...itemDraft, calories: e.target.value ? Number.parseInt(e.target.value, 10) : null })} className="rounded-none border-gold/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Spice (0–3)</Label>
                  <Input type="number" min={0} max={3} value={itemDraft.spiceLevel ?? 0} onChange={(e) => setItemDraft({ ...itemDraft, spiceLevel: Number.parseInt(e.target.value, 10) || 0 })} className="rounded-none border-gold/20" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Sizes</Label>
                <Textarea
                  rows={4}
                  spellCheck={false}
                  value={itemDraft.sizes ?? '[]'}
                  onChange={(e) => setItemDraft({ ...itemDraft, sizes: e.target.value })}
                  className="rounded-none border-gold/20 font-mono text-xs resize-y"
                />
                <p className="text-[11px] text-muted-foreground">
                  A JSON list, e.g. <code>[{'{'}"label":"Regular","priceDelta":0{'}'},{'{'}"label":"Large","priceDelta":120{'}'}]</code>.
                  Leave as <code>[]</code> for a single size.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Add-ons</Label>
                <Textarea
                  rows={4}
                  spellCheck={false}
                  value={itemDraft.addons ?? '[]'}
                  onChange={(e) => setItemDraft({ ...itemDraft, addons: e.target.value })}
                  className="rounded-none border-gold/20 font-mono text-xs resize-y"
                />
                <p className="text-[11px] text-muted-foreground">
                  e.g. <code>[{'{'}"label":"Extra Cheese","price":60{'}'}]</code>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  ['isVeg', 'Vegetarian'],
                  ['isAvailable', 'Available'],
                  ['isBestseller', 'Bestseller'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between border border-gold/15 px-3 py-2.5">
                    <span className="text-xs tracking-wider uppercase text-muted-foreground">{label}</span>
                    <Switch
                      checked={Boolean(itemDraft[key])}
                      onCheckedChange={(checked) => setItemDraft({ ...itemDraft, [key]: checked })}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setItemDraft(null)} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
                  Cancel
                </Button>
                <Button onClick={saveItem} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null} Save Dish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- category editor */}
      <Dialog open={Boolean(categoryDraft)} onOpenChange={(open) => !open && setCategoryDraft(null)}>
        <DialogContent className="max-w-lg rounded-none border-gold/20">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">{categoryDraft?.id ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>

          {categoryDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Name *</Label>
                <Input value={categoryDraft.name ?? ''} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} className="rounded-none border-gold/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Description</Label>
                <Input value={categoryDraft.description ?? ''} onChange={(e) => setCategoryDraft({ ...categoryDraft, description: e.target.value })} className="rounded-none border-gold/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Icon</Label>
                  <Select value={categoryDraft.icon ?? 'utensils'} onValueChange={(value) => setCategoryDraft({ ...categoryDraft, icon: value })}>
                    <SelectTrigger className="rounded-none border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_CHOICES.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Sort Order</Label>
                  <Input type="number" value={categoryDraft.sortOrder ?? 0} onChange={(e) => setCategoryDraft({ ...categoryDraft, sortOrder: Number.parseInt(e.target.value, 10) || 0 })} className="rounded-none border-gold/20" />
                </div>
              </div>
              <div className="flex items-center justify-between border border-gold/15 px-3 py-2.5">
                <span className="text-xs tracking-wider uppercase text-muted-foreground">Visible on the site</span>
                <Switch checked={categoryDraft.isActive ?? true} onCheckedChange={(checked) => setCategoryDraft({ ...categoryDraft, isActive: checked })} />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setCategoryDraft(null)} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
                  Cancel
                </Button>
                <Button onClick={saveCategory} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
                  Save Category
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
