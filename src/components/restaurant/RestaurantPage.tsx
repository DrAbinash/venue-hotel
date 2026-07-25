'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Beef, Cake, Clock, Coffee, CupSoda, Flame, IceCream, Leaf, Loader2, Pizza, Salad,
  Sandwich, Search, ShoppingBag, Soup, Utensils, Wheat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { useOrderStore } from '@/lib/order-store';
import { formatMoney } from '@/lib/pricing';
import { bool, text } from '@/lib/content';
import { parseOptions, startingPrice, type MenuSize } from '@/lib/menu';
import ItemDialog from '@/components/restaurant/ItemDialog';
import CartSheet from '@/components/restaurant/CartSheet';
import type { MenuCategory, MenuItem } from '@/lib/types';

/** Category icons, chosen in Admin → Restaurant. */
const MENU_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  salad: Salad,
  soup: Soup,
  sandwich: Sandwich,
  beef: Beef,
  cake: Cake,
  icecream: IceCream,
  drink: CupSoda,
  bread: Wheat,
  leaf: Leaf,
};

/**
 * The ordering screen.
 *
 * Laid out for touch first: a horizontally scrolling category rail, tiles big
 * enough to hit with a thumb on a phone and comfortable on a tablet, and a
 * sticky order bar pinned to the bottom of the viewport so the basket is never
 * more than one tap away.
 */
export default function RestaurantPage() {
  const { settings } = useHotelStore();
  const { toast } = useToast();
  const cartCount = useOrderStore((state) => state.count());
  const cartSubtotal = useOrderStore((state) => state.subtotal());
  const setCartOpen = useOrderStore((state) => state.setCartOpen);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const money = useCallback((value: number) => formatMoney(value, settings), [settings]);

  useEffect(() => {
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: 'Could not load the menu', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (vegOnly && !item.isVeg) return false;
          if (!needle) return true;
          return (
            item.name.toLowerCase().includes(needle) ||
            item.description.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((category) => category.items.length > 0)
      .filter((category) => activeCategory === 'all' || category.id === activeCategory);
  }, [categories, query, vegOnly, activeCategory]);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    if (categoryId === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    requestAnimationFrame(() => {
      sectionRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (!bool(settings, 'restaurantEnabled')) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
        <div>
          <Utensils className="w-12 h-12 text-gold mx-auto mb-4" />
          <h2 className="text-2xl font-extralight tracking-wide text-charcoal">Our restaurant is not taking online orders</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Please call {text(settings, 'phone')} and we will take care of you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 lg:pb-12">
      {/* ------------------------------------------------------------ header */}
      <section className="relative h-56 sm:h-72 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-charcoal"
          style={{ backgroundImage: `url(${text(settings, 'restaurantHeroImage')})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-4 flex flex-col justify-end pb-8 text-white">
          <p className="text-xs tracking-[0.4em] uppercase text-gold mb-2">{text(settings, 'restaurantEyebrow')}</p>
          <h1 className="text-3xl sm:text-5xl font-extralight tracking-wide">{text(settings, 'restaurantName')}</h1>
          <p className="text-sm text-white/70 mt-2 max-w-xl">{text(settings, 'restaurantTagline')}</p>
          <p className="flex items-center gap-2 text-xs text-white/60 mt-3">
            <Clock className="w-3.5 h-3.5" />
            {text(settings, 'restaurantOpenTime')} – {text(settings, 'restaurantCloseTime')} · {text(settings, 'restaurantPrepNote')}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- search + category rail */}
      <div className="sticky top-16 lg:top-20 z-30 bg-white/95 backdrop-blur-md border-b border-gold/15">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the menu"
                className="h-12 pl-10 border-gold/20 bg-cream/30 rounded-none text-base"
              />
            </div>
            <button
              type="button"
              onClick={() => setVegOnly((value) => !value)}
              className={`h-12 px-4 border text-xs tracking-widest uppercase whitespace-nowrap transition-all cursor-pointer ${
                vegOnly ? 'border-green-600 bg-green-50 text-green-700' : 'border-gold/20 text-charcoal/70'
              }`}
            >
              <Leaf className="w-4 h-4 inline mr-1.5" /> Veg
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {[{ id: 'all', name: 'Everything', icon: 'utensils' }, ...categories].map((category) => {
              const Icon = MENU_ICONS[category.icon] ?? Utensils;
              const active = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => scrollToCategory(category.id)}
                  className={`flex-shrink-0 min-h-11 flex items-center gap-2 px-4 py-2.5 border text-sm whitespace-nowrap transition-all cursor-pointer ${
                    active ? 'border-gold bg-gold text-white' : 'border-gold/20 text-charcoal/70 hover:border-gold/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- menu */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading the menu…
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            {categories.length === 0
              ? 'The menu is being prepared. Please check back shortly.'
              : 'Nothing matches that search.'}
          </div>
        ) : (
          <div className="space-y-12">
            {visible.map((category) => (
              <section
                key={category.id}
                ref={(element) => { sectionRefs.current[category.id] = element; }}
                className="scroll-mt-44"
              >
                <div className="mb-5">
                  <h2 className="text-2xl font-light tracking-wide text-charcoal">{category.name}</h2>
                  {category.description && (
                    <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                  )}
                  <div className="w-12 h-[1px] bg-gold mt-3" />
                </div>

                {/* Two tiles across on a phone, up to four on a tablet or desktop. */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                  {category.items.map((item, index) => {
                    const sizes = parseOptions<MenuSize>(item.sizes);
                    const from = startingPrice(item.basePrice, sizes);
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04 }}
                        onClick={() => setSelected(item)}
                        className="group bg-white border border-gold/10 hover:border-gold/40 text-left flex flex-col overflow-hidden transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <div className="relative aspect-[4/3] bg-cream overflow-hidden">
                          {item.imageUrl ? (
                            <div
                              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                              style={{ backgroundImage: `url(${item.imageUrl})` }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gold/30">
                              <Utensils className="w-10 h-10" />
                            </div>
                          )}
                          {item.isBestseller && (
                            <span className="absolute top-2 left-2 bg-gold text-white text-[10px] tracking-widest uppercase px-2 py-1">
                              Bestseller
                            </span>
                          )}
                          <span className={`absolute top-2 right-2 w-4 h-4 bg-white border flex items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                          </span>
                        </div>

                        <div className="p-3 sm:p-4 flex flex-col flex-1">
                          <h3 className="text-sm sm:text-base text-charcoal leading-snug line-clamp-2">{item.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">{item.description}</p>

                          <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.prepMinutes}m</span>
                            {item.spiceLevel > 0 && (
                              <span className="flex items-center gap-0.5 text-red-500">
                                {Array.from({ length: Math.min(3, item.spiceLevel) }).map((_, i) => (
                                  <Flame key={i} className="w-3 h-3" />
                                ))}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gold/10">
                            <span className="text-sm sm:text-base font-light text-charcoal">
                              {sizes.length > 1 && <span className="text-[10px] text-muted-foreground mr-1">from</span>}
                              {money(from)}
                            </span>
                            <span className="w-9 h-9 sm:w-10 sm:h-10 bg-gold text-white flex items-center justify-center text-lg leading-none group-hover:bg-gold-dark transition-colors">
                              +
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------ sticky order bar */}
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 bg-gradient-to-t from-black/20 to-transparent"
        >
          <Button
            onClick={() => setCartOpen(true)}
            className="max-w-3xl mx-auto w-full h-14 sm:h-16 bg-charcoal hover:bg-charcoal-light text-white rounded-none flex items-center justify-between px-5 luxury-shadow-lg"
          >
            <span className="flex items-center gap-3">
              <span className="relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 bg-gold text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              </span>
              <span className="text-xs tracking-[0.2em] uppercase">View Order</span>
            </span>
            <span className="text-base font-light text-gold">{money(cartSubtotal)}</span>
          </Button>
        </motion.div>
      )}

      <ItemDialog item={selected} settings={settings} onClose={() => setSelected(null)} />
      <CartSheet />
    </div>
  );
}
