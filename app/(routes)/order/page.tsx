"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";
import type { Session } from "@supabase/supabase-js";
import AccountButton from "@/components/AccountButton";

// --- אייקונים לעיצוב החדש ---
import { ShoppingCart, Search, ChevronDown } from "lucide-react";

// --- הגדרות טיפוסים (ללא שינוי) ---
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

/* ---------- עטיפה חדשה: דף חיצוני שרק עוטף ב-Suspense ---------- */
export default function OrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderPageInner />
    </Suspense>
  );
}

/* ---------- באנרים + ניקוי ה-URL (עם התאמה קלה של צבעים) ---------- */
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
      const clean = url.pathname + (url.search || "");
      router.replace(clean);
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

// --- עוזר קטן לניהול classNames (ללא שינוי) ---
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ----------------------------------- רכיב כרטיס מוצר מעוצב ----------------------------------- */
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
    <article className="group bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-200/80 hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col">
      {/* תמונה ומחיר */}
      <div className="relative aspect-[4/3] bg-white rounded-xl mb-4">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, (max-width:1280px) 25vw, 20vw"
            className="object-contain p-2"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-stone-400 text-sm">
            ללא תמונה
          </div>
        )}
      </div>

      {/* שם המוצר */}
      <h3 className="font-bold text-stone-800 text-base leading-6 line-clamp-2 min-h-[3rem] grow">
        {product.name}
      </h3>

      {/* תגית מחיר */}
      <div className="mt-2">
        <span className="inline-block bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1 rounded-full">
          {Number(product.price).toFixed(2)} ₪
        </span>
      </div>

      {/* בקרת כמות */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          aria-label="הפחת כמות"
          onClick={() => onQuantityChange(quantity - 1)}
          className="w-9 h-9 rounded-full border border-stone-300 hover:bg-stone-100 grid place-items-center transition-colors"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value))}
          className="w-16 h-9 text-center border-stone-300 border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
        />
        <button
          aria-label="הוסף כמות"
          onClick={() => onQuantityChange(quantity + 1)}
          className="w-9 h-9 rounded-full border border-stone-300 hover:bg-stone-100 grid place-items-center transition-colors"
        >
          +
        </button>
      </div>

      {/* כפתור הוספה לעגלה */}
      <button
        onClick={onAddToCart}
        className="mt-4 w-full h-11 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all whitespace-nowrap"
      >
        הוסף לעגלה
      </button>
    </article>
  );
}

/* ----------------------------------- העמוד המעוצב (הפנימי) ----------------------------------- */
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
  const { addItem, count } = useHybridCart();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // --- NEW: State for search query ---
  const [searchQuery, setSearchQuery] = useState("");

  // טעינת נתונים (ללא שינוי)
  useEffect(() => {
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

        const cat = sp.get("cat");
        const sub = sp.get("sub");
        if (sub) {
          const match = (categoriesData || []).find(
            (c: any) => c.id === sub || (c.slug ? c.slug === sub : false)
          );
          if (match) setSelected({ kind: "subcategory", id: match.id });
        } else if (cat) {
          const match = (categoriesData || []).find(
            (c: any) => c.id === cat || (c.slug ? c.slug === cat : false)
          );
          if (match) setSelected({ kind: "category", id: match.id });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ניהול Auth Session (ללא שינוי)
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

  // בניית היררכיית קטגוריות (ללא שינוי)
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

  // --- MODIFIED: Filtering logic now includes search ---
  const filteredProducts = useMemo(() => {
    let categoryFilteredProducts: Product[];

    // Step 1: Filter by category (existing logic)
    if (selected.kind === "all") {
      categoryFilteredProducts = products;
    } else if (selected.kind === "uncategorized") {
      categoryFilteredProducts = products.filter((p) => !p.category_id);
    } else if (selected.kind === "subcategory") {
      categoryFilteredProducts = products.filter(
        (p) => p.category_id === selected.id
      );
    } else {
      // kind === "category"
      const childIds = (childrenByParent.get(selected.id) ?? []).map(
        (c) => c.id
      );
      const ids = new Set<string>([selected.id, ...childIds]);
      categoryFilteredProducts = products.filter(
        (p) => p.category_id && ids.has(p.category_id)
      );
    }

    // Step 2: Filter by search query on top of the category filter
    if (!searchQuery.trim()) {
      return categoryFilteredProducts;
    }

    const lowercasedQuery = searchQuery.trim().toLowerCase();
    return categoryFilteredProducts.filter((product) =>
      product.name.toLowerCase().includes(lowercasedQuery)
    );
  }, [products, selected, childrenByParent, searchQuery]); // <-- searchQuery added to dependency array

  // לוגיקת כמות והוספה לעגלה (ללא שינוי)
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

    router.replace(url.pathname + "?" + url.searchParams.toString());
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100"
    >
      {/* ------------------ Header ------------------ */}
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

            {/* חיפוש */}
            <div className="hidden md:flex flex-1 items-center gap-4 max-w-2xl mx-8">
              <div className="relative w-full">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                {/* --- קישור ל-state --- */}
                <input
                  type="text"
                  placeholder="חפש מוצרים..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pr-12 pl-4 rounded-2xl border-2 border-stone-200 focus:border-amber-400 focus:outline-none transition-all bg-white/80"
                />
              </div>
            </div>

            {/* כפתורים */}
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
                <div className="relative">
                  <AccountButton />
                </div>
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
        {/* סרגל קטגוריות */}
        <div className="border-t border-stone-200 py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center flex-wrap gap-2">
            <button
              onClick={() => handleCategorySelect({ kind: "all" })}
              className={classNames(
                "px-3 py-1.5 rounded-full text-sm transition-colors",
                selected.kind === "all"
                  ? "bg-amber-500 text-white"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-700"
              )}
            >
              הכל
            </button>
            {hasUncategorized && (
              <button
                onClick={() => handleCategorySelect({ kind: "uncategorized" })}
                className={classNames(
                  "px-3 py-1.5 rounded-full text-sm transition-colors",
                  selected.kind === "uncategorized"
                    ? "bg-amber-500 text-white"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-700"
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
                    "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1",
                    (selected.kind === "category" && selected.id === cat.id) ||
                      (selected.kind === "subcategory" &&
                        (childrenByParent.get(cat.id) || []).some(
                          (c) => c.id === selected.id
                        ))
                      ? "bg-amber-500 text-white"
                      : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                  )}
                >
                  {cat.name}
                  {(childrenByParent.get(cat.id) ?? []).length > 0 && (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {(childrenByParent.get(cat.id) ?? []).length > 0 && (
                  <div className="absolute top-full right-0 mt-2 min-w-[180px] z-40 bg-white rounded-xl shadow-lg border border-stone-200 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
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
                          "w-full text-right block px-3 py-2 rounded-lg text-sm",
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
      </header>

      {/* באנרים */}
      <Suspense fallback={null}>
        <OrderBanners />
      </Suspense>

      {/* Hero Section */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-l from-amber-100/50 to-yellow-50/50 -z-10" />
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-stone-800 mb-4 leading-tight">
            הזמנות לבית המדרש
            <span className="block text-2xl md:text-3xl font-medium text-amber-600 mt-2">
              כל מה שהמקום צריך, במקום אחד
            </span>
          </h1>
          <p className="text-lg text-stone-600 max-w-3xl mx-auto leading-relaxed">
            כאן תוכלו להזמין בקלות את כל המוצרים הנחוצים לתפעול השוטף של בית
            המדרש - ממוצרים לקידוש ועד לציוד ניקיון.
          </p>
        </div>
      </section>

      {/* רשת המוצרים */}
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-stone-800">
              מוצרים זמינים להזמנה
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-5 space-y-4 animate-pulse"
                >
                  <div className="bg-stone-200 aspect-[4/3] w-full rounded-xl" />
                  <div className="bg-stone-200 h-6 w-2/3 rounded" />
                  <div className="bg-stone-200 h-4 w-1/3 rounded-full" />
                  <div className="h-10 bg-stone-200 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">️🕵️</div>
              <h3 className="text-2xl font-bold text-stone-800 mb-2">
                לא נמצאו מוצרים תואמים
              </h3>
              <p className="text-stone-600">
                נסו לשנות את החיפוש או לבחור קטגוריה אחרת.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
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

      {/* מודאל התחברות */}
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
      <footer className="bg-gradient-to-l from-stone-800 to-stone-900 text-white py-16 mt-20">
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
