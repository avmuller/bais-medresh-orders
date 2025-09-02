// hooks/useHybridCart.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useDbCart, DbCartLine } from "@/hooks/useDbCart";

type NewCartItemPayload = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  image_url?: string | null;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
};

type CartLoadingStates = {
  clearing: boolean;
  items: Record<string, "updating" | "removing" | "adding">;
};

export function useHybridCart() {
  const db = useDbCart(true);

  const [session, setSession] = useState<Session | null>(null);
  const [authIsLoading, setAuthIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session ?? null);
        setAuthIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) setOptimisticItems([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [optimisticItems, setOptimisticItems] = useState<DbCartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState<CartLoadingStates>({
    clearing: false,
    items: {},
  });

  useEffect(() => setOptimisticItems(db.items), [db.items]);

  const isGuest = !session?.user;

  const addItem = useCallback(
    async (itemPayload: NewCartItemPayload) => {
      if (isGuest) return;
      setError(null);
      setLoadingStates((p) => ({
        ...p,
        items: { ...p.items, [itemPayload.id]: "adding" },
      }));
      try {
        await db.addItem({
          product_id: itemPayload.id,
          name: itemPayload.name,
          price: itemPayload.price,
          image_url: itemPayload.image_url ?? null,
          quantity: itemPayload.quantity ?? 1,
        });
      } catch (err: any) {
        setError(err.message || "שגיאה בהוספת פריט לעגלה.");
      } finally {
        setLoadingStates((p) => {
          const items = { ...p.items };
          delete items[itemPayload.id];
          return { ...p, items };
        });
      }
    },
    [isGuest, db.addItem]
  );

  const updateQty = useCallback(
    async (itemId: string, delta: number) => {
      if (isGuest) return;
      setError(null);

      const original = [...optimisticItems];
      const idx = original.findIndex((i) => i.product_id === itemId);
      if (idx === -1) return;

      const newQty = original[idx].quantity + delta;
      if (newQty < 1) {
        await removeItem(itemId);
        return;
      }

      const updated = [...original];
      updated[idx] = { ...updated[idx], quantity: newQty };
      setOptimisticItems(updated);
      setLoadingStates((p) => ({
        ...p,
        items: { ...p.items, [itemId]: "updating" },
      }));

      try {
        await db.updateQty(itemId, delta);
      } catch (err: any) {
        setError(err.message || "שגיאה בעדכון כמות.");
        setOptimisticItems(original);
      } finally {
        setLoadingStates((p) => {
          const items = { ...p.items };
          delete items[itemId];
          return { ...p, items };
        });
      }
    },
    [isGuest, optimisticItems, db.updateQty]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isGuest) return;
      setError(null);
      const original = [...optimisticItems];
      setOptimisticItems(original.filter((i) => i.product_id !== itemId));
      setLoadingStates((p) => ({
        ...p,
        items: { ...p.items, [itemId]: "removing" },
      }));
      try {
        await db.removeItem(itemId);
      } catch (err: any) {
        setError(err.message || "שגיאה בהסרת פריט.");
        setOptimisticItems(original);
      } finally {
        setLoadingStates((p) => {
          const items = { ...p.items };
          delete items[itemId];
          return { ...p, items };
        });
      }
    },
    [isGuest, optimisticItems, db.removeItem]
  );

  const clearCart = useCallback(async () => {
    if (isGuest) return;
    setError(null);
    const original = [...optimisticItems];
    setOptimisticItems([]);
    setLoadingStates((p) => ({ ...p, clearing: true }));
    try {
      await db.clearCart();
    } catch (err: any) {
      setError(err.message || "שגיאה בניקוי העגלה.");
      setOptimisticItems(original);
    } finally {
      setLoadingStates((p) => ({ ...p, clearing: false }));
    }
  }, [isGuest, optimisticItems, db.clearCart]);

  const api = useMemo(() => {
    const cartForUI = optimisticItems.map((i) => ({
      id: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image_url: i.image_url ?? null,
    }));

    const count = cartForUI.reduce((s, item) => s + item.quantity, 0);
    const total = cartForUI.reduce(
      (s, item) => s + item.price * item.quantity,
      0
    );

    if (isGuest) {
      return {
        cart: [] as CartItem[],
        addItem: () => {},
        updateQty: () => {},
        removeItem: () => {},
        clearCart: () => {},
        count: 0,
        total: 0,
        hydrated: true, // ← אורח מוכן מיד
        mode: "guest" as const,
        loadingStates,
        error,
      };
    }

    if (authIsLoading) {
      return {
        cart: [] as CartItem[],
        addItem: () => {},
        updateQty: () => {},
        removeItem: () => {},
        clearCart: () => {},
        count: 0,
        total: 0,
        hydrated: false,
        mode: "db" as const,
        loadingStates,
        error,
      };
    }

    return {
      cart: cartForUI,
      addItem,
      updateQty,
      removeItem,
      clearCart,
      count,
      total,
      hydrated: db.hydrated,
      mode: "db" as const,
      loadingStates,
      error,
    };
  }, [
    isGuest,
    authIsLoading,
    optimisticItems,
    db.hydrated,
    loadingStates,
    error,
    addItem,
    updateQty,
    removeItem,
    clearCart,
  ]);

  return api;
}
