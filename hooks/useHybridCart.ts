// hooks/useHybridCart.ts
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useDbCart } from "@/hooks/useDbCart";

/** עגלה דרך DB בלבד; אורח => עגלה ריקה ופונקציות No-Op */
export function useHybridCart() {
  const db = useDbCart(true);

  // 👇 זה החלק החשוב: עוקבים אחרי ה־session
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isGuest = !session?.user;

  const api = useMemo(() => {
    if (!isGuest && db.cartId) {
      // מחובר: משתמש בנתוני ה־DB
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
        mode: "db" as const,
      };
    }

    // אורח: ריק מידית — מונע הצגת מספר ישן אחרי SIGNED_OUT
    return {
      cart: [] as Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
        image_url: string | null;
      }>,
      addItem: (_p: any) => {},
      updateQty: (_id: string, _delta: number) => {},
      removeItem: (_id: string) => {},
      clearCart: () => {},
      count: 0,
      total: 0,
      hydrated: true,
      mode: "guest" as const,
    };
  }, [isGuest, db.items, db.count, db.total, db.hydrated, db.cartId]);

  return api;
}
