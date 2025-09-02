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

  // --- Auth state ---
  const [session, setSession] = useState<Session | null>(null);
  const [authIsLoading, setAuthIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) setSession(data.session ?? null);
      } catch (e) {
        console.error("getSession failed", e);
      } finally {
        if (mounted) setAuthIsLoading(false);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s ?? null);
      if (!s) setOptimisticItems([]); // ניקוי עם התנתקות
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // --- Optimistic state ---
  const [optimisticItems, setOptimisticItems] = useState<DbCartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState<CartLoadingStates>({
    clearing: false,
    items: {},
  });

  useEffect(() => {
    setOptimisticItems(db.items);
  }, [db.items]);

  const isGuest = !session?.user;

  const addItem = useCallback(
    async (itemPayload: NewCartItemPayload) => {
      if (isGuest) return;
      setError(null);
      setLoadingStates((prev) => ({
        ...prev,
        items: { ...prev.items, [itemPayload.id]: "adding" },
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
        setLoadingStates((prev) => {
          const newItems = { ...prev.items };
          delete newItems[itemPayload.id];
          return { ...prev, items: newItems };
        });
      }
    },
    [isGuest, db]
  );

  const updateQty = useCallback(
    async (itemId: string, delta: number) => {
      if (isGuest) return;
      setError(null);

      const originalItems = [...optimisticItems];
      const itemIndex = originalItems.findIndex((i) => i.product_id === itemId);
      if (itemIndex === -1) return;

      const newQuantity = originalItems[itemIndex].quantity + delta;
      if (newQuantity < 1) {
        await removeItem(itemId);
        return;
      }

      const updatedItems = [...originalItems];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        quantity: newQuantity,
      };
      setOptimisticItems(updatedItems);
      setLoadingStates((prev) => ({
        ...prev,
        items: { ...prev.items, [itemId]: "updating" },
      }));

      try {
        await db.updateQty(itemId, delta);
      } catch (err: any) {
        setError(err.message || "שגיאה בעדכון כמות.");
        setOptimisticItems(originalItems);
      } finally {
        setLoadingStates((prev) => {
          const newItems = { ...prev.items };
          delete newItems[itemId];
          return { ...prev, items: newItems };
        });
      }
    },
    [isGuest, optimisticItems, db]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isGuest) return;
      setError(null);

      const originalItems = [...optimisticItems];
      const itemsWithoutRemoved = originalItems.filter(
        (i) => i.product_id !== itemId
      );

      setOptimisticItems(itemsWithoutRemoved);
      setLoadingStates((prev) => ({
        ...prev,
        items: { ...prev.items, [itemId]: "removing" },
      }));

      try {
        await db.removeItem(itemId);
      } catch (err: any) {
        setError(err.message || "שגיאה בהסרת פריט.");
        setOptimisticItems(originalItems);
      } finally {
        setLoadingStates((prev) => {
          const newItems = { ...prev.items };
          delete newItems[itemId];
          return { ...prev, items: newItems };
        });
      }
    },
    [isGuest, optimisticItems, db]
  );

  const clearCart = useCallback(async () => {
    if (isGuest) return;
    setError(null);

    const originalItems = [...optimisticItems];
    setOptimisticItems([]);
    setLoadingStates((prev) => ({ ...prev, clearing: true }));

    try {
      await db.clearCart();
    } catch (err: any) {
      setError(err.message || "שגיאה בניקוי העגלה.");
      setOptimisticItems(originalItems);
    } finally {
      setLoadingStates((prev) => ({ ...prev, clearing: false }));
    }
  }, [isGuest, optimisticItems, db]);

  // --- API ל־UI ---
  const api = useMemo(() => {
    const cartForUI: CartItem[] = optimisticItems.map((i) => ({
      id: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image_url: i.image_url ?? null,
    }));

    const count = cartForUI.reduce((sum, item) => sum + item.quantity, 0);
    const total = cartForUI.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // אורח: מוכן מיד (לא ממתינים לאימות)
    if (isGuest || authIsLoading) {
      return {
        cart: [] as CartItem[],
        addItem: () => {},
        updateQty: () => {},
        removeItem: () => {},
        clearCart: () => {},
        count: 0,
        total: 0,
        hydrated: true, // <<< העדכון החשוב
        mode: "guest" as const,
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
