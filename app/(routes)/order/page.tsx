"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image"; // ✅ לשימוש בתמונות יפות ומהירות
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";
import type { Session } from "@supabase/supabase-js";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  image_url?: string | null;
};

export default function OrderPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<
    "all" | "uncategorized" | string
  >("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const { addItem, count } = useHybridCart();

  // טעינת קטגוריות ומוצרים
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id,name")
          .order("name");
        const { data: productsData } = await supabase
          .from("products")
          .select("id,name,price,category_id,image_url,created_at")
          .order("created_at", { ascending: false });
        if (cancelled) return;
        setCategories(categoriesData || []);
        setProducts((productsData as Product[]) || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // האזן לשינויים ב־Auth + הבא session בהעלאה
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (selectedCat === "all") return products;
    if (selectedCat === "uncategorized")
      return products.filter((p) => !p.category_id);
    return products.filter((p) => p.category_id === selectedCat);
  }, [products, selectedCat]);

  const setQtyFor = (id: string, next: number) =>
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, Number.isFinite(next) ? next : 1),
    }));

  const addToCart = (product: Product) => {
    const qty = quantities[product.id] || 1;
    if (qty < 1) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: qty,
      image_url: product.image_url ?? null,
    });
    setQtyFor(product.id, 1);
  };

  const hasUncategorized = products.some((p) => !p.category_id);

  const CategoryPill = ({ id, label }: { id: string; label: string }) => {
    const active = selectedCat === id;
    return (
      <button
        onClick={() => setSelectedCat(id)}
        className={`px-3 py-1.5 rounded-full text-sm transition ${
          active
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white hover:bg-gray-50 border"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="border-b bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">הזמנת מוצרים</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/cart"
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50"
            >
              <span>העגלה</span>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 text-xs rounded-full bg-blue-600 text-white w-5 h-5 grid place-items-center">
                  {count}
                </span>
              )}
            </Link>
            {session ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-gray-600">
                  ({session?.user?.email})
                </span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setSession(null); // עדכן מצב מקומי מיד
                    // אפשר להפנות לעמוד התחברות במקום refresh אם תרצה:
                    // router.push("/auth");
                  }}
                  className="px-3 py-1.5 rounded-full border text-red-600 hover:bg-red-50"
                >
                  התנתקות
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                className="px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                התחבר
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-4 h-max">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-600 mb-3">קטגוריות</div>
            <div className="flex flex-wrap gap-2">
              <CategoryPill id="all" label="הכל" />
              {hasUncategorized && (
                <CategoryPill id="uncategorized" label="ללא קטגוריה" />
              )}
              {categories.map((c) => (
                <CategoryPill key={c.id} id={c.id} label={c.name} />
              ))}
            </div>
          </div>
        </aside>

        {/* Products */}
        <section>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border bg-white overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-gray-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-100 rounded w-2/3" />
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-10 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-gray-600">
              אין מוצרים להצגה בקטגוריה שנבחרה.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProducts.map((product) => {
                const q = quantities[product.id] || 1;
                return (
                  <article
                    key={product.id}
                    className="group rounded-2xl border bg-white shadow-sm hover:shadow-md transition overflow-hidden flex flex-col"
                  >
                    {/* Image area – יחס קבוע ותצוגה נקייה */}
                    <div className="relative aspect-[4/3] bg-white border-b">
                      {product.image_url ? (
                        // אם התמונות חיצוניות, צריך להוסיף דומיין ל-next.config.js -> images.domains
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          sizes="(max-width:768px) 50vw, (max-width:1280px) 25vw, 20vw"
                          className="object-contain p-3"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-gray-400 text-sm">
                          ללא תמונה
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-blue-50 text-blue-700 text-sm px-2 py-0.5 shadow-sm">
                        {Number(product.price).toFixed(2)} ₪
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex flex-col gap-3 grow">
                      <h3 className="font-semibold text-base leading-6 line-clamp-3 min-h-[4.5rem]">
                        {product.name}
                      </h3>

                      {/* Quantity */}
                      <div className="mt-auto flex items-center justify-center gap-2">
                        <button
                          aria-label="הפחת כמות"
                          onClick={() => setQtyFor(product.id, q - 1)}
                          className="w-9 h-9 rounded-full border hover:bg-gray-50 grid place-items-center"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={q}
                          onChange={(e) =>
                            setQtyFor(product.id, parseInt(e.target.value))
                          }
                          className="w-14 text-center border rounded-md py-1.5"
                        />
                        <button
                          aria-label="הוסף כמות"
                          onClick={() => setQtyFor(product.id, q + 1)}
                          className="w-9 h-9 rounded-full border hover:bg-gray-50 grid place-items-center"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        className="mt-3 w-full h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99] transition whitespace-nowrap"
                      >
                        הוסף לעגלה
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
