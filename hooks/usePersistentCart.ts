import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CartItem = {
  id: string; // UUID של המוצר
  name: string;
  price: number; // number, לא string
  quantity: number; // תמיד >= 1
  image_url?: string | null;
};

export function usePersistentCart(key: string = "cart") {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // ---- טעינה ראשונית מה-storage ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* no-op */
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, [key]);

  // ---- setter שכותב גם ל-localStorage באופן אטומי ----
  const setCartSafe = useCallback(
    (updater: (prev: CartItem[]) => CartItem[]) => {
      setCart((prev) => {
        const next = updater(prev);
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {
          /* no-op */
        }
        return next;
      });
    },
    [key]
  );

  // ---- סנכרון בין טאבים/חלונות ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue != null) {
        try {
          const parsed = JSON.parse(e.newValue) as CartItem[];
          setCart(parsed);
        } catch {
          /* no-op */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  // ---- פעולות ----
  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      const q = Math.max(1, Number(item.quantity ?? 1));
      setCartSafe((prev) => {
        const idx = prev.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            ...item,
            quantity: next[idx].quantity + q,
          };
          return next;
        }
        return [...prev, { ...item, quantity: q } as CartItem];
      });
    },
    [setCartSafe]
  );

  const updateQty = useCallback(
    (id: string, delta: number) => {
      setCartSafe((prev) =>
        prev
          .map((i) =>
            i.id === id
              ? { ...i, quantity: Math.max(0, i.quantity + delta) }
              : i
          )
          .filter((i) => i.quantity > 0)
      );
    },
    [setCartSafe]
  );

  const removeItem = useCallback(
    (id: string) => {
      setCartSafe((prev) => prev.filter((i) => i.id !== id));
    },
    [setCartSafe]
  );

  const clearCart = useCallback(() => {
    setCartSafe(() => []);
  }, [setCartSafe]);

  // ---- נגזרות ----
  const count = useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity, 0),
    [cart]
  );
  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart]
  );

  return {
    cart,
    hydrated, // true אחרי שה־storage נטען
    addItem,
    updateQty,
    removeItem,
    clearCart,
    setCart: setCartSafe, // אם ממש צריך כתיבה ידנית
    count,
    total,
  };
}
