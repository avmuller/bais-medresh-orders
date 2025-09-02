import { useEffect, useMemo, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useDbCart, DbCartLine } from "@/hooks/useDbCart";

// Define a type for a new item being added
type NewCartItemPayload = {
  id: string;
  name: string;

  price: number;
  quantity?: number;
  image_url?: string | null;
};

// Define a type for the item structure used in the UI
type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
};

// Define a type for granular loading states
type CartLoadingStates = {
  clearing: boolean;
  items: Record<string, "updating" | "removing" | "adding">;
};

/**
 * Hook משופר לניהול עגלת קניות היברידית.
 * - מיישם UI אופטימי לעדכונים מיידיים.
 * - מספק מצבי טעינה ושגיאה מפורטים.
 * - מפריד בין משתמש מחובר (DB) לאורח (ריק).
 */
export function useHybridCart() {
  const db = useDbCart(true); // המקור האמיתי של המידע (Source of Truth)

  // --- ניהול אימות ---
  const [session, setSession] = useState<Session | null>(null);
  const [authIsLoading, setAuthIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session ?? null);
        setAuthIsLoading(false);
      }
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) {
        setSession(s ?? null);
        // אם המשתמש התנתק, נקה את המצב האופטימי
        if (!s) setOptimisticItems([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- ניהול מצב אופטימי ---
  const [optimisticItems, setOptimisticItems] = useState<DbCartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState<CartLoadingStates>({
    clearing: false,
    items: {},
  });

  // סנכרון המצב האופטימי עם המידע מה-DB כשהוא משתנה
  useEffect(() => {
    setOptimisticItems(db.items);
  }, [db.items]);

  const isGuest = !session?.user;

  // --- פונקציות אופטימיות (Memoized with useCallback) ---

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
    [isGuest, db.addItem]
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
        // אם הכמות יורדת מתחת ל-1, נסיר את הפריט במקום
        await removeItem(itemId);
        return;
      }

      // 1. עדכון אופטימי מיידי של ה-UI
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
        // 2. שליחת הבקשה ל-DB ברקע
        await db.updateQty(itemId, delta);
      } catch (err: any) {
        setError(err.message || "שגיאה בעדכון כמות.");
        // 3. אם יש שגיאה, החזר את המצב לקדמותו
        setOptimisticItems(originalItems);
      } finally {
        setLoadingStates((prev) => {
          const newItems = { ...prev.items };
          delete newItems[itemId];
          return { ...prev, items: newItems };
        });
      }
    },
    [isGuest, optimisticItems, db.updateQty]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isGuest) return;
      setError(null);

      const originalItems = [...optimisticItems];
      const itemsWithoutRemoved = originalItems.filter(
        (i) => i.product_id !== itemId
      );

      // 1. עדכון אופטימי
      setOptimisticItems(itemsWithoutRemoved);
      setLoadingStates((prev) => ({
        ...prev,
        items: { ...prev.items, [itemId]: "removing" },
      }));

      try {
        // 2. קריאה ל-DB
        await db.removeItem(itemId);
      } catch (err: any) {
        setError(err.message || "שגיאה בהסרת פריט.");
        // 3. החזרה למצב קודם במקרה של שגיאה
        setOptimisticItems(originalItems);
      } finally {
        setLoadingStates((prev) => {
          const newItems = { ...prev.items };
          delete newItems[itemId];
          return { ...prev, items: newItems };
        });
      }
    },
    [isGuest, optimisticItems, db.removeItem]
  );

  const clearCart = useCallback(async () => {
    if (isGuest) return;
    setError(null);

    const originalItems = [...optimisticItems];

    // 1. עדכון אופטימי
    setOptimisticItems([]);
    setLoadingStates((prev) => ({ ...prev, clearing: true }));

    try {
      // 2. קריאה ל-DB
      await db.clearCart();
    } catch (err: any) {
      setError(err.message || "שגיאה בניקוי העגלה.");
      // 3. החזרה למצב קודם
      setOptimisticItems(originalItems);
    } finally {
      setLoadingStates((prev) => ({ ...prev, clearing: false }));
    }
  }, [isGuest, optimisticItems, db.clearCart]);

  // --- הרכבת ה-API שיוחזר מה-Hook ---

  const api = useMemo(() => {
    // פורמט העגלה שיוצג ב-UI
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

    // אם המשתמש הוא אורח או שהאימות עדיין בטעינה, החזר API ריק
    if (isGuest || authIsLoading) {
      return {
        cart: [] as CartItem[],
        addItem: () => {},
        updateQty: () => {},
        removeItem: () => {},
        clearCart: () => {},
        count: 0,
        total: 0,
        hydrated: !authIsLoading, // העגלה "טעונה" כשהאימות הסתיים
        mode: "guest" as const,
        loadingStates,
        error,
      };
    }

    // אם המשתמש מחובר, החזר את ה-API המלא עם הפונקציות האופטימיות
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
