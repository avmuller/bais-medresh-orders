import { useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  usePersistentCart,
  CartItem as GuestItem,
} from "@/hooks/usePersistentCart";
import { useDbCart } from "@/hooks/useDbCart";

/** אורח => localStorage, משתמש => DB, עם מיזוג אוטומטי אחרי התחברות */
export function useHybridCart() {
  const guest = usePersistentCart("cart");
  const db = useDbCart(true);

  const mode: "guest" | "db" = db.hydrated && db.cartId ? "db" : "guest";

  // מיזוג עגלת אורח ל-DB ברגע שיש משתמש מחובר
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !db.cartId) return;
      if (guest.cart.length === 0) return;

      const map: Record<string, number> = {};
      db.items.forEach((i) => {
        map[i.product_id] = i.quantity;
      });
      guest.cart.forEach((g: GuestItem) => {
        map[g.id] = (map[g.id] || 0) + g.quantity;
      });

      const updates = Object.entries(map).map(([product_id, quantity]) => ({
        cart_id: db.cartId!,
        product_id,
        quantity,
      }));
      if (updates.length) {
        await supabase
          .from("cart_items")
          .upsert(updates, { onConflict: "cart_id,product_id" });
      }
      guest.clearCart();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.cartId]);

  // API אחיד לשני המצבים
  const api = useMemo(() => {
    if (mode === "db") {
      return {
        cart: db.items.map((i) => ({
          id: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image_url: i.image_url ?? null,
        })),
        addItem: (p: {
          id: string;
          name: string;
          price: number;
          quantity?: number;
          image_url?: string | null;
        }) =>
          db.addItem({
            product_id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url ?? null,
            quantity: p.quantity ?? 1,
          }),
        updateQty: (id: string, delta: number) => db.updateQty(id, delta),
        removeItem: (id: string) => db.removeItem(id),
        clearCart: () => db.clearCart(),
        count: db.count,
        total: db.total,
        hydrated: db.hydrated,
        mode,
      };
    }
    return {
      cart: guest.cart.map((g) => ({
        id: g.id,
        name: g.name,
        price: g.price,
        quantity: g.quantity,
        image_url: g.image_url ?? null,
      })),
      addItem: (p: {
        id: string;
        name: string;
        price: number;
        quantity?: number;
        image_url?: string | null;
      }) =>
        guest.addItem({
          id: p.id,
          name: p.name,
          price: p.price,
          quantity: p.quantity ?? 1,
          image_url: p.image_url ?? null,
        }),
      updateQty: (id: string, delta: number) => guest.updateQty(id, delta),
      removeItem: (id: string) => guest.removeItem(id),
      clearCart: () => guest.clearCart(),
      count: guest.count,
      total: guest.total,
      hydrated: true,
      mode,
    };
  }, [
    mode,
    db.items,
    db.count,
    db.total,
    db.hydrated,
    guest.cart,
    guest.count,
    guest.total,
  ]);

  return api;
}
