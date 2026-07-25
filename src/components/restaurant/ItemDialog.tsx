'use client';

import { useMemo, useState } from 'react';
import { Flame, Leaf, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/pricing';
import { parseOptions, type MenuAddon, type MenuSize } from '@/lib/menu';
import { useOrderStore } from '@/lib/order-store';
import type { HotelSettings, MenuItem } from '@/lib/types';

interface ItemDialogProps {
  item: MenuItem | null;
  settings: HotelSettings;
  onClose: () => void;
}

/**
 * The size-and-extras picker.
 *
 * Modelled on a quick-service kiosk: sizes are full-width tap targets rather
 * than a dropdown, quantity uses big +/- buttons, and the confirm button
 * carries the running total so a thumb never has to hunt for the price.
 */
export default function ItemDialog({ item, settings, onClose }: ItemDialogProps) {
  const add = useOrderStore((state) => state.add);
  const setCartOpen = useOrderStore((state) => state.setCartOpen);

  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const sizes = useMemo(() => parseOptions<MenuSize>(item?.sizes), [item]);
  const availableAddons = useMemo(() => parseOptions<MenuAddon>(item?.addons), [item]);

  const activeSize = sizes.find((size) => size.label === sizeLabel) ?? sizes[0] ?? null;
  const unitPrice = (item?.basePrice ?? 0) + (activeSize ? Number(activeSize.priceDelta) || 0 : 0);
  const addonTotal = availableAddons
    .filter((addon) => addons.includes(addon.label))
    .reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);
  const total = (unitPrice + addonTotal) * quantity;

  const money = (value: number) => formatMoney(value, settings);

  const reset = () => {
    setSizeLabel(null);
    setAddons([]);
    setQuantity(1);
    setNotes('');
  };

  const confirm = () => {
    if (!item) return;
    add({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      size: activeSize?.label ?? null,
      unitPrice,
      quantity,
      addons: availableAddons.filter((addon) => addons.includes(addon.label)),
      notes: notes.trim() || undefined,
    });
    reset();
    onClose();
    setCartOpen(true);
  };

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto rounded-none border-gold/20 p-0 gap-0">
        {item && (
          <>
            {item.imageUrl && (
              <div className="h-48 sm:h-56 bg-cream bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />
            )}

            <div className="p-5 sm:p-6 space-y-5">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl sm:text-2xl font-light tracking-wide text-charcoal text-left flex items-start gap-2">
                  <span className={`mt-1.5 w-3.5 h-3.5 border flex-shrink-0 flex items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                  </span>
                  {item.name}
                </DialogTitle>
                {item.description && <p className="text-sm text-muted-foreground text-left">{item.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {item.calories ? <span>{item.calories} kcal</span> : null}
                  <span>~{item.prepMinutes} min</span>
                  {item.isVeg && <span className="flex items-center gap-1 text-green-700"><Leaf className="w-3 h-3" /> Vegetarian</span>}
                  {item.spiceLevel > 0 && (
                    <span className="flex items-center gap-0.5 text-red-600">
                      {Array.from({ length: Math.min(3, item.spiceLevel) }).map((_, index) => (
                        <Flame key={index} className="w-3 h-3" />
                      ))}
                    </span>
                  )}
                </div>
              </DialogHeader>

              {sizes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground">Choose a size</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {sizes.map((size) => {
                      const active = (sizeLabel ?? sizes[0].label) === size.label;
                      return (
                        <button
                          key={size.label}
                          type="button"
                          onClick={() => setSizeLabel(size.label)}
                          className={`min-h-14 px-4 py-3 border text-left sm:text-center transition-all cursor-pointer ${
                            active ? 'border-gold bg-gold/10' : 'border-gold/20 hover:border-gold/50'
                          }`}
                        >
                          <span className="block text-sm text-charcoal">{size.label}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {money(item.basePrice + (Number(size.priceDelta) || 0))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableAddons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground">Add extras</p>
                  <div className="space-y-2">
                    {availableAddons.map((addon) => {
                      const checked = addons.includes(addon.label);
                      return (
                        <button
                          key={addon.label}
                          type="button"
                          onClick={() =>
                            setAddons((current) =>
                              checked ? current.filter((label) => label !== addon.label) : [...current, addon.label],
                            )
                          }
                          className={`w-full min-h-12 flex items-center justify-between px-4 py-3 border text-left transition-all cursor-pointer ${
                            checked ? 'border-gold bg-gold/5' : 'border-gold/15 hover:border-gold/40'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`w-4 h-4 border flex items-center justify-center ${checked ? 'bg-gold border-gold' : 'border-charcoal/25'}`}>
                              {checked && <Plus className="w-3 h-3 text-white rotate-45" />}
                            </span>
                            <span className="text-sm text-charcoal">{addon.label}</span>
                          </span>
                          <span className="text-sm text-muted-foreground">+{money(Number(addon.price) || 0)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Anything to note?</p>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Less spicy, no onion, cutlery please…"
                  className="border-gold/20 bg-cream/30 rounded-none resize-none text-base"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center border border-gold/25">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="w-12 h-12 flex items-center justify-center text-charcoal hover:bg-cream cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-light">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(50, value + 1))}
                    className="w-12 h-12 flex items-center justify-center text-charcoal hover:bg-cream cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  onClick={confirm}
                  className="flex-1 h-12 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.2em] uppercase rounded-none"
                >
                  Add · {money(total)}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
