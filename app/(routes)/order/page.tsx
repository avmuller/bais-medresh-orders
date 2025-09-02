"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";
import type { Session } from "@supabase/supabase-js";
import AccountButton from "@/components/AccountButton";
import { ShoppingCart, Search, ChevronDown } from "lucide-react";

/* ------------ Types ------------ */
type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  slug?: string | null;
};
type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  image_url?: string | null;
  created_at?: string | null;
};

/* Helper: safe replace without trailing '?' */
function replaceWithSearch(router: ReturnType<typeof useRouter>, url: URL) {
  const qs = url.searchParams.toString();
  router.replace(qs ? `${url.pathname}?${qs}` : url.pathname);
}

/* ------------ Wrapper with Suspense ------------ */
export default function OrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderPageInner />
    </Suspense>
  );
}

/* ------------ Banners ------------ */
function OrderBanners() {
  const router = useRouter();
  const sp = useSearchParams();
  const showVerified = sp.get("verified") === "1";
  const loginWelcome = sp.get("login") === "1";
  const [banner, setBanner] = useState<null | "verified" | "login">(null);

  useEffect(() => {
    if (showVerified) setBanner("verified");
    else if (loginWelcome) setBanner("login");
  }, [showVerified, loginWelcome]);

  useEffect(() => {
    if (showVerified || loginWelcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete("verified");
      url.searchParams.delete("login");
      replaceWithSearch(router, url);
    }
  }, [showVerified, loginWelcome, router]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;
  return (
    <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200">
      <div className="max-w-7xl mx-auto px-4 py-2 text-sm">
        {banner === "verified"
          ? "השינויים אושרו בהצלחה. האימייל המעודכן כבר בתוקף."
          : "התחברת בהצלחה."}
      </div>
    </div>
  );
}

/* ------------ utils ------------ */
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ------------ Product Card ------------ */
function ProductCard({
  product,
  quantity,
  onQuantityChange,
  onAddToCart,
}: {
  product: Product;
  quantity: number;
  onQuantityChange: (newQuantity: number) => void;
  onAddToCart: () => void;
}) {
  return (
    <article className="group bg-white rounded-xl p-2 sm:p-3 shadow-sm border border-stone-200/80 hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col">
      <div className="relative aspect-square bg-white rounded-lg mb-2">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, (max-width:1280px) 25vw, 20vw"
            className="object-contain p-1"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-stone-400 text-xs">
            ללא תמונה
          </div>
        )}
      </div>
      <h3 className="font-bold text-stone-800 text-sm leading-5 line-clamp-2 min-h-[2.5rem] grow">
        {product.name}
      </h3>
      <div className="mt-1">
        <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
          {Number(product.price).toFixed(2)} ₪
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1">
        <button
          aria-label="הפחת כמות"
          onClick={() => onQuantityChange(quantity - 1)}
          className="w-7 h-7 rounded-full border border-stone-300 hover:bg-stone-100 grid place-items-center transition-colors text-sm"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value))}
          className="w-12 h-7 text-center border-stone-300 border rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 transition text-sm"
        />
        <button
          aria-label="הוסף כמות"
          onClick={() => onQuantityChange(quantity + 1)}
          className="w-7 h-7 rounded-full border border-stone-300 hover:bg-stone-100 grid place-items-center transition-colors text-sm"
        >
          +
        </button>
      </div>
      <button
        onClick={onAddToCart}
        className="mt-3 w-full h-8 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all whitespace-nowrap text-sm"
      >
        הוסף לעגלה
      </button>
    </article>
  );
}

/* ------------ Page body ------------ */
function OrderPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  type Selection =
    | { kind: "all" }
    | { kind: "uncategorized" }
    | { kind: "category"; id: string }
    | { kind: "subcategory"; id: string };
  const [selected, setSelected] = useState<Selection>({ kind: "all" });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // <--- סטייט חדש לבדיקת אימות
  const { addItem, count } = useHybridCart();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Auth
  useEffect(() => {
    let mounted = true;

    // פונקציה לבדיקת הסשן הראשוני
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session ?? null);
        setAuthLoading(false); // <--- סיימנו לבדוק אימות, אפשר להמשיך
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) {
        setSession(s);
        if (s) setShowLoginPrompt(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Data
  useEffect(() => {
    // <--- אל תרוץ עד שסטטוס האימות ידוע
    if (authLoading) {
      return;
    }

    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id,name,parent_id,slug")
          .order("name");
        const { data: productsData } = await supabase
          .from("products")
          .select("id,name,price,category_id,image_url,created_at")
          .order("created_at", { ascending: false });
        if (cancelled) return;
        setCategories((categoriesData as Category[]) || []);
        setProducts((productsData as Product[]) || []);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [authLoading]); // <--- הוספת תלות בסטטוס האימות

  // Sync selection with URL (also back/forward)
  useEffect(() => {
    if (!categories.length) return;
    const cat = sp.get("cat");
    const sub = sp.get("sub");

    if (cat === "uncategorized") {
      setSelected({ kind: "uncategorized" });
      return;
    }
    if (sub) {
      const match = categories.find((c) => c.id === sub || c.slug === sub);
      if (match) setSelected({ kind: "subcategory", id: match.id });
      return;
    }
    if (cat) {
      const match = categories.find((c) => c.id === cat || c.slug === cat);
      if (match) setSelected({ kind: "category", id: match.id });
      return;
    }
    setSelected({ kind: "all" });
  }, [sp, categories]);

  // Hierarchy
  const { rootCategories, childrenByParent } = useMemo(() => {
    const roots = categories.filter((c) => !c.parent_id);
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parent_id) {
        const arr = map.get(c.parent_id) ?? [];
        arr.push(c);
        map.set(c.parent_id, arr);
      }
    }
    roots.sort((a, b) => a.name.localeCompare(b.name, "he"));
    for (const arr of map.values())
      arr.sort((a, b) => a.name.localeCompare(b.name, "he"));
    return { rootCategories: roots, childrenByParent: map };
  }, [categories]);

  const hasUncategorized = products.some((p) => !p.category_id);

  // Filter + search
  const filteredProducts = useMemo(() => {
    let categoryFiltered: Product[];
    if (selected.kind === "all") categoryFiltered = products;
    else if (selected.kind === "uncategorized")
      categoryFiltered = products.filter((p) => !p.category_id);
    else if (selected.kind === "subcategory")
      categoryFiltered = products.filter((p) => p.category_id === selected.id);
    else {
      const childIds = (childrenByParent.get(selected.id) ?? []).map(
        (c) => c.id
      );
      const ids = new Set<string>([selected.id, ...childIds]);
      categoryFiltered = products.filter(
        (p) => p.category_id && ids.has(p.category_id)
      );
    }
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.toLowerCase();
    return categoryFiltered.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, selected, childrenByParent, searchQuery]);

  // Qty + add to cart
  const setQtyFor = (id: string, next: number) =>
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, Number.isFinite(next) ? next : 1),
    }));

  const addToCart = (product: Product) => {
    const qty = quantities[product.id] || 1;
    if (qty < 1) return;
    if (!session) {
      setShowLoginPrompt(true);
      return;
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

  // Category select -> update URL
  const handleCategorySelect = (selection: Selection) => {
    setSelected(selection);
    const url = new URL(window.location.href);
    url.searchParams.delete("cat");
    url.searchParams.delete("sub");

    if (selection.kind === "category" || selection.kind === "subcategory") {
      const catId =
        selection.kind === "category"
          ? selection.id
          : categories.find((c) => c.id === selection.id)?.parent_id;
      const subId = selection.kind === "subcategory" ? selection.id : null;

      const cat = categories.find((c) => c.id === catId);
      if (cat) url.searchParams.set("cat", cat.slug || cat.id);

      if (subId) {
        const sub = categories.find((c) => c.id === subId);
        if (sub) url.searchParams.set("sub", sub.slug || sub.id);
      }
    }

    replaceWithSearch(router, url);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-yellow-400 to-amber-600 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold">ב״מ</span>
              </div>
              <div className="mr-4">
                <h1 className="text-2xl font-bold text-stone-800">בית המדרש</h1>
                <p className="text-sm text-stone-600">מערכת הזמנות</p>
              </div>
            </div>

            {/* Search */}
            <div className="hidden md:flex flex-1 items-center gap-4 max-w-2xl mx-8">
              <div className="relative w-full">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="חפש מוצרים..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pr-12 pl-4 rounded-2xl border-2 border-stone-200 focus:border-amber-400 focus:outline-none transition-all bg-white/80"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/cart"
                className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-stone-300 bg-white hover:bg-stone-50 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-stone-600" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs rounded-full bg-amber-500 text-white w-5 h-5 grid place-items-center font-bold">
                    {count}
                  </span>
                )}
              </Link>

              {session ? (
                <AccountButton />
              ) : (
                <Link
                  href="/auth"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm whitespace-nowrap"
                >
                  התחבר
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Categories row */}
        <div className="border-t border-stone-200 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center flex-wrap gap-3">
              <button
                onClick={() => handleCategorySelect({ kind: "all" })}
                className={classNames(
                  "px-6 py-2.5 rounded-xl text-base font-medium",
                  selected.kind === "all"
                    ? "bg-amber-500 text-white"
                    : "bg-white border-2 border-stone-200 text-stone-700 hover:bg-stone-50"
                )}
              >
                הכל
              </button>

              {hasUncategorized && (
                <button
                  onClick={() =>
                    handleCategorySelect({ kind: "uncategorized" })
                  }
                  className={classNames(
                    "px-6 py-2.5 rounded-xl text-base font-medium",
                    selected.kind === "uncategorized"
                      ? "bg-amber-500 text-white"
                      : "bg-white border-2 border-stone-200 text-stone-700 hover:bg-stone-50"
                  )}
                >
                  ללא קטגוריה
                </button>
              )}

              {rootCategories.map((cat) => (
                <div key={cat.id} className="relative group">
                  <button
                    onClick={() =>
                      handleCategorySelect({ kind: "category", id: cat.id })
                    }
                    className={classNames(
                      "px-6 py-2.5 rounded-xl text-base font-medium flex items-center gap-2",
                      (selected.kind === "category" &&
                        selected.id === cat.id) ||
                        (selected.kind === "subcategory" &&
                          (childrenByParent.get(cat.id) || []).some(
                            (c) => c.id === selected.id
                          ))
                        ? "bg-amber-500 text-white"
                        : "bg-white border-2 border-stone-200 text-stone-700 hover:bg-stone-50"
                    )}
                  >
                    {cat.name}
                    {(childrenByParent.get(cat.id) ?? []).length > 0 && (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  {(childrenByParent.get(cat.id) ?? []).length > 0 && (
                    <div className="absolute top-full right-0 mt-2 min-w-[200px] z-40 bg-white rounded-xl shadow-xl border border-stone-200 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      {(childrenByParent.get(cat.id) ?? []).map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() =>
                            handleCategorySelect({
                              kind: "subcategory",
                              id: sub.id,
                            })
                          }
                          className={classNames(
                            "w-full text-right block px-4 py-3 rounded-lg text-base font-medium",
                            selected.kind === "subcategory" &&
                              selected.id === sub.id
                              ? "bg-amber-100 text-amber-800"
                              : "hover:bg-stone-50 text-stone-700"
                          )}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Banners */}
      <Suspense fallback={null}>
        <OrderBanners />
      </Suspense>

      {/* Hero */}
      <section className="relative py-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-l from-amber-100/50 to-yellow-50/50 -z-10" />
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2 leading-tight">
            הזמנות לבית המדרש
          </h1>
          <p className="text-base text-stone-600 max-w-3xl mx-auto leading-relaxed">
            כאן תוכלו להזמין בקלות את כל המוצרים הנחוצים לתפעול השוטף של בית
            המדרש - ממוצרים לקידוש ועד לציוד ניקיון.
          </p>
        </div>
      </section>

      {/* Products grid */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-stone-800">
              מוצרים זמינים להזמנה
            </h2>
          </div>

          {loading || authLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-3 space-y-2 animate-pulse"
                >
                  <div className="bg-stone-200 aspect-[4/3] w-full rounded-lg" />
                  <div className="bg-stone-200 h-5 w-2/3 rounded" />
                  <div className="bg-stone-200 h-3 w-1/3 rounded-full" />
                  <div className="h-8 bg-stone-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">️🕵️</div>
              <h3 className="text-xl font-bold text-stone-800 mb-1">
                לא נמצאו מוצרים תואמים
              </h3>
              <p className="text-stone-600 text-sm">
                נסו לשנות את החיפוש או לבחור קטגוריה אחרת.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] || 1}
                  onQuantityChange={(newVal) => setQtyFor(product.id, newVal)}
                  onAddToCart={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Login modal */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border p-6 sm:p-8 text-center">
            <h3 className="text-xl font-bold mb-2 text-stone-800">
              כדי להוסיף לעגלה צריך להתחבר
            </h3>
            <p className="text-stone-600 mb-6">
              נראה שאינך מחובר. התחבר/י כדי להוסיף מוצרים לעגלה ולהשלים הזמנה.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 font-semibold transition"
              >
                סגור
              </button>
              <button
                onClick={() => router.push("/auth")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition"
              >
                התחברות עכשיו
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gradient-to-l from-stone-800 to-stone-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="bg-gradient-to-br from-yellow-400 to-amber-600 text-white w-12 h-12 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">ב״מ</span>
            </div>
            <h3 className="text-2xl font-bold mr-3">בית המדרש</h3>
          </div>
          <p className="text-stone-300 leading-relaxed max-w-md">
            מערכת ההזמנות המרכזית לניהול ותפעול צרכי בית המדרש.
          </p>
          <div className="border-t border-stone-700 mt-12 pt-8 text-center text-stone-400">
            <p>
              &copy; {new Date().getFullYear()} בית המדרש - מערכת הזמנות. כל
              הזכויות שמורות.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
