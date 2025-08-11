// hooks/useDbCart.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type DbCartLine = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
};

type RawItem = {
  id: string;
  product_id: string;
  quantity: number;
  // לפעמים Supabase מחזיר את הקשר בשם alias "product" (object או array)
  product?: ProductRow | ProductRow[] | null;
  // ולפעמים בשם הטבלה "products" (בד"כ array)
  products?: ProductRow[] | null;
};

async function getOrCreateCartId(userId: string) {
  const { data, error } = await supabase
    .from("carts")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("id")
    .single();

  if (error || !data) throw error || new Error("no cart id");
  return data.id as string;
}

export function useDbCart(enabled: boolean = true) {
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<DbCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (!enabled || initRef.current) return;
    initRef.current = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setHydrated(true);
        return;
      }

      const cid = await getOrCreateCartId(user.id);
      setCartId(cid);

      // ⚠️ אם שם ה-FK אצלך שונה, עדכן במקום !cart_items_product_id_fkey
      const { data, error } = await supabase
        .from("cart_items")
        .select(
          `
          id,
          product_id,
          quantity,
          product:products!cart_items_product_id_fkey (
            id, name, price, image_url
          )
        `
        )
        .eq("cart_id", cid);

      if (error) {
        console.error("load cart_items error:", error);
        setHydrated(true);
        return;
      }

      const rows = (data ?? []) as RawItem[];

      const mapped: DbCartLine[] = rows
        .map((r) => {
          const candidate = (r.product ?? r.products) as
            | ProductRow
            | ProductRow[]
            | null
            | undefined;
          const prod = Array.isArray(candidate) ? candidate[0] : candidate;
          if (!prod) return null;

          return {
            product_id: r.product_id,
            name: prod.name,
            price: Number(prod.price),
            quantity: r.quantity,
            image_url: prod.image_url ?? null,
          } as DbCartLine;
        })
        .filter(Boolean) as DbCartLine[];

      setItems(mapped);
      setHydrated(true);
    })();
  }, [enabled]);

  const count = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );
  const total = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items]
  );

  const addItem = useCallback(
    async (
      line: Omit<DbCartLine, "name" | "price" | "image_url"> &
        Partial<DbCartLine>
    ) => {
      if (!enabled || !cartId) return;

      // optimistic
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.product_id === line.product_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + (line.quantity || 1),
          };
          return next;
        }
        return [
          ...prev,
          {
            product_id: line.product_id,
            name: line.name || "",
            price: Number(line.price || 0),
            image_url: line.image_url ?? null,
            quantity: Math.max(1, line.quantity || 1),
          },
        ];
      });

      // merge in DB (upsert)
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cartId)
        .eq("product_id", line.product_id)
        .maybeSingle();

      const newQty =
        (existing?.quantity || 0) + Math.max(1, line.quantity || 1);

      const { error } = await supabase
        .from("cart_items")
        .upsert(
          [{ cart_id: cartId, product_id: line.product_id, quantity: newQty }],
          { onConflict: "cart_id,product_id" }
        );

      if (error) console.error("addItem upsert error:", error);
    },
    [enabled, cartId]
  );

  const updateQty = useCallback(
    async (product_id: string, delta: number) => {
      if (!enabled || !cartId) return;

      setItems((prev) =>
        prev
          .map((i) =>
            i.product_id === product_id
              ? { ...i, quantity: Math.max(0, i.quantity + delta) }
              : i
          )
          .filter((i) => i.quantity > 0)
      );

      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cartId)
        .eq("product_id", product_id)
        .maybeSingle();

      const nextQty = Math.max(0, (existing?.quantity || 0) + delta);

      if (nextQty === 0) {
        await supabase
          .from("cart_items")
          .delete()
          .eq("cart_id", cartId)
          .eq("product_id", product_id);
      } else {
        await supabase
          .from("cart_items")
          .update({ quantity: nextQty })
          .eq("cart_id", cartId)
          .eq("product_id", product_id);
      }
    },
    [enabled, cartId]
  );

  const removeItem = useCallback(
    async (product_id: string) => {
      if (!enabled || !cartId) return;
      setItems((prev) => prev.filter((i) => i.product_id !== product_id));
      await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cartId)
        .eq("product_id", product_id);
    },
    [enabled, cartId]
  );

  const clearCart = useCallback(async () => {
    if (!enabled || !cartId) return;
    setItems([]);
    await supabase.from("cart_items").delete().eq("cart_id", cartId);
  }, [enabled, cartId]);

  return {
    cartId,
    items,
    hydrated,
    addItem,
    updateQty,
    removeItem,
    clearCart,
    count,
    total,
  };
}
