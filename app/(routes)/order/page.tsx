"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";
import type { Session } from "@supabase/supabase-js";
import AccountButton from "@/components/AccountButton";
import { useSearchParams } from "next/navigation";

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
  const sp = useSearchParams();
  const showVerified = sp.get("verified") === "1";
  const loginWelcome = sp.get("login") === "1";

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banner, setBanner] = useState<null | "verified" | "login">(null);

  const [selectedCat, setSelectedCat] = useState<
    "all" | "uncategorized" | string
  >("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const { addItem, count } = useHybridCart();

  // מודאל התחברות
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // קובע איזה באנר להראות מרגע העלייה
  useEffect(() => {
    if (showVerified) setBanner("verified");
    else if (loginWelcome) setBanner("login");
  }, [showVerified, loginWelcome]);

  useEffect(() => {
    if (showVerified || loginWelcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete("verified");
      url.searchParams.delete("login");
      const clean = url.pathname + (url.search || "");
      router.replace(clean);
    }
  }, [showVerified, loginWelcome, router]);

  // אופציונלי: להעלים את הבאנר אוטומטית אחרי 5 שניות
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

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
      if (s) setShowLoginPrompt(false);
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

  // ❗ שינוי מרכזי: לא מוסיפים לעגלה אם אין session — פותחים מודאל התחברות
  const addToCart = (product: Product) => {
    const qty = quantities[product.id] || 1;
    if (qty < 1) return;

    if (!session) {
      setShowLoginPrompt(true);
      return; // לא מוסיפים לעגלה
    }

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
        className={`px-3 py-1.5 rounded-full text-sm transition border shadow-xs ${
          active
            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
            : "bg-white/80 text-gray-700 hover:bg-white hover:shadow-sm"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-blue-50"
    >
      {/* Decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute right-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute left-[-10rem] bottom-[-10rem] h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b bg-white/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-600/90 grid place-items-center text-white text-sm font-bold">
              במ
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              הזמנת מוצרים
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white hover:bg-gray-50"
            >
              <span>העגלה</span>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 text-xs rounded-full bg-blue-600 text-white w-5 h-5 grid place-items-center">
                  {count}
                </span>
              )}
            </Link>

            {session ? (
              <AccountButton />
            ) : (
              <Link
                href="/auth"
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                התחבר
              </Link>
            )}
          </div>
        </div>
      </div>
      {banner === "verified" && (
        <div className="bg-green-50 text-green-800 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 py-2 text-sm">
            השינויים אושרו בהצלחה. האימייל המעודכן כבר בתוקף.
          </div>
        </div>
      )}

      {banner === "login" && (
        <div className="bg-green-50 text-green-800 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 py-2 text-sm">
            התחברת בהצלחה.
          </div>
        </div>
      )}

      {/* Hero */}
      <header className="relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mt-6 rounded-3xl border bg-white/70 backdrop-blur p-6 md:p-10 shadow-sm overflow-hidden">
            <div className="text-center space-y-3">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                כל מה שבית מדרש צריך במקום אחד
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                הזמנה קלה, מוצרים איכותיים, ומחירים הוגנים — חוסכים זמן ומשלבים
                הכול בממשק אחד נעים.
              </p>
            </div>
            <div className="mt-6 md:mt-8">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <CategoryPill id="all" label="הכל" />
                {hasUncategorized && (
                  <CategoryPill id="uncategorized" label="ללא קטגוריה" />
                )}
                {categories.map((c) => (
                  <CategoryPill key={c.id} id={c.id} label={c.name} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-max">
          <div className="rounded-2xl border bg-white/80 backdrop-blur p-4 shadow-sm">
            <div className="text-sm text-gray-600 mb-3">סינון לפי קטגוריה</div>
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

        <section>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border bg-white/70 backdrop-blur overflow-hidden animate-pulse shadow-sm"
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
                    className="group rounded-2xl border bg-white/80 backdrop-blur shadow-sm hover:shadow-md hover:-translate-y-0.5 transition overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-[4/3] bg-white border-b">
                      {product.image_url ? (
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

                    <div className="p-4 flex flex-col gap-3 grow">
                      <h3 className="font-semibold text-base leading-6 line-clamp-3 min-h-[4.5rem]">
                        {product.name}
                      </h3>

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
                          className="w-16 text-center border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
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
      </main>

      {/* מודאל התחברות כשמנסים להוסיף לעגלה כאורח */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border p-6">
            <h3 className="text-lg font-bold mb-2">
              כדי להוסיף לעגלה צריך להתחבר
            </h3>
            <p className="text-gray-600 mb-5">
              נראה שאינך מחובר. התחבר/י כדי להוסיף מוצרים לעגלה ולהשלים הזמנה.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="px-4 py-2 rounded-md border hover:bg-gray-50"
              >
                סגור
              </button>
              <button
                onClick={() => router.push("/auth")}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                התחברות עכשיו
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
