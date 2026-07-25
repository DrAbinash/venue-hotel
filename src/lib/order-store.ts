import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartKey, lineTotal, type CartLine, type MenuAddon, type OrderType } from '@/lib/menu';

interface OrderStore {
  lines: CartLine[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;

  add: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;

  count: () => number;
  subtotal: () => number;

  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;

  /** The most recent order, so tracking it is one tap rather than a form. */
  lastOrder: { ref: string; phone: string } | null;
  setLastOrder: (ref: string, phone: string) => void;

  trackOpen: boolean;
  setTrackOpen: (open: boolean) => void;
}

/**
 * The food cart.
 *
 * Persisted to localStorage so a guest who wanders off mid-order — or reloads
 * the tablet by the pool — comes back to the same basket. Prices here are for
 * display only; the server re-prices everything when the order is placed.
 */
export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      lines: [],
      orderType: 'dine_in',
      setOrderType: (orderType) => set({ orderType }),

      add: (line) => {
        const key = cartKey(line.menuItemId, line.size, line.addons as MenuAddon[]);
        set((state) => {
          const existing = state.lines.find((candidate) => candidate.key === key);
          if (existing) {
            return {
              lines: state.lines.map((candidate) =>
                candidate.key === key
                  ? { ...candidate, quantity: Math.min(candidate.quantity + line.quantity, 50) }
                  : candidate,
              ),
            };
          }
          return { lines: [...state.lines, { ...line, key }] };
        });
      },

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((line) => line.key !== key)
              : state.lines.map((line) =>
                  line.key === key ? { ...line, quantity: Math.min(quantity, 50) } : line,
                ),
        })),

      remove: (key) => set((state) => ({ lines: state.lines.filter((line) => line.key !== key) })),
      clear: () => set({ lines: [] }),

      count: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: () => get().lines.reduce((sum, line) => sum + lineTotal(line), 0),

      cartOpen: false,
      setCartOpen: (cartOpen) => set({ cartOpen }),

      lastOrder: null,
      setLastOrder: (ref, phone) => set({ lastOrder: { ref, phone } }),

      trackOpen: false,
      setTrackOpen: (trackOpen) => set({ trackOpen }),
    }),
    {
      name: 'venue-food-cart',
      partialize: (state) => ({ lines: state.lines, orderType: state.orderType, lastOrder: state.lastOrder }),
    },
  ),
);
