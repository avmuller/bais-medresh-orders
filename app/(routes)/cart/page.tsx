"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";
import { Trash2 } from "lucide-react";

// 🛒 עגלה דרך DB בלבד (אורח רואה עגלה ריקה)

// Spinner קטן
const Spinner = () => (
  <div className="inline-block animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
);

// קומפוננטת שגיאה קצרה
const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 border border-red-200">
    {message}
  </div>
);

export default function CartPage() {
  const router = useRouter();

  const { cart, updateQty, removeItem, clearCart, total, hydrated } =
    useHybridCart();

  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 🪄 שינוי 1: שימוש ב-onAuthStateChange כדי להאזין לשינויים
  useEffect(() => {
    // מנוי (Subscription) למאזין שינויי אוטנטיקציה
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // בודק אם קיים משתמש
        setUserEmail(session?.user?.email ?? null);
      }
    );

    // ניקוי המאזין כשהקומפוננטה נעלמת כדי למנוע דליפת זיכרון
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleClearCart = () => {
    if (window.confirm("האם אתה בטוח שברצונך לנקות את העגלה?")) {
      clearCart();
    }
  };

  const handleCreateOrder = async () => {
    setError(null);

    if (cart.length === 0) {
      setError("העגלה ריקה!");
      return;
    }

    setSubmitting(true);

    // ודא סשן (לשליחת Bearer token ל-API)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // בלי alert — הודעת שגיאה + ניווט למסך תחברות
      setError("כדי לבצע הזמנה צריך להתחבר.");
      router.push("/auth");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`, // ✅
        },
        body: JSON.stringify({
          cart: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);

      // 📝 שמירת תקציר הזמנה ל-sessionStorage כדי להציג בדף תודה
      try {
        const snapshot = {
          orderId: j.orderId as string | undefined,
          createdAt: new Date().toISOString(),
          items: cart.map((i) => ({
            name: i.name,
            price: Number(i.price),
            qty: i.quantity,
            image_url: i.image_url ?? null,
          })),
          total: cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0),
          count: cart.reduce((s, i) => s + i.quantity, 0),
        };
        sessionStorage.setItem("last_order", JSON.stringify(snapshot));
      } catch {}

      clearCart();

      // נווט עם מזהה הזמנה אם קיים
      const orderId = j.orderId as string | undefined;
      router.push(orderId ? `/order/thanks?order=${orderId}` : "/order/thanks");
    } catch (err: any) {
      setError(err?.message || "שגיאה לא ידועה");
    } finally {
      setSubmitting(false);
    }
  };

  // הצג טעינה עד שהעגלה נטענת (מה-DB בהוק)
  if (!hydrated) {
    return (
      <div
        dir="rtl"
        className="min-h-screen grid place-items-center bg-gradient-to-b from-amber-50 to-stone-100"
      >
        <div className="text-stone-700 text-lg">טוען עגלה...</div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="flex flex-col min-h-screen bg-gradient-to-b from-amber-50 to-stone-100"
    >
      {/* Header תואם להזמנות */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/order" className="flex items-center group">
              <div className="bg-gradient-to-br from-yellow-400 to-amber-600 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold">ב״מ</span>
              </div>
              <div className="mr-4">
                <p className="text-2xl font-bold text-stone-800 leading-5">
                  בית המדרש
                </p>
                <p className="text-sm text-stone-600">העגלה שלי</p>
              </div>
            </Link>

            {/* פעולות חשבון/ניווט */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/order"
                className="px-4 h-10 grid place-items-center rounded-full border-2 border-stone-200 bg-white hover:border-amber-500 hover:bg-amber-50 font-semibold text-stone-700 transition-colors"
              >
                ← חזרה למוצרים
              </Link>

              {userEmail ? (
                // ✅ שינוי 2: הסרת המייל מכפתור ההתנתקות
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.refresh();
                  }}
                  className="px-4 h-10 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors text-sm"
                >
                  התנתקות
                </button>
              ) : (
                <Link
                  href="/auth"
                  className="px-4 h-10 grid place-items-center rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm"
                >
                  התחבר להזמנה
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* תוכן העגלה */}
      <main className="flex-grow py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {error && <ErrorMessage message={error} />}

          {cart.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center shadow-sm">
              <div className="text-6xl mb-4">🛍️</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-2">
                העגלה ריקה
              </h2>
              <p className="text-stone-600 mb-6">
                התחילו להוסיף מוצרים להזמנה.
              </p>
              <Link
                href="/order"
                className="inline-flex items-center justify-center px-5 h-11 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
              >
                חזרה למוצרים
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* רשימת מוצרים */}
              <section className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                  {/* כותרת הטבלה */}
                  <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/60">
                    <h2 className="text-xl font-bold text-stone-800">
                      פרטי עגלה
                    </h2>
                  </div>

                  {/* טבלה רספונסיבית */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <caption className="sr-only">פרטי המוצרים בעגלה</caption>
                      <thead className="bg-stone-50 text-stone-600">
                        <tr className="text-sm">
                          <th className="p-4 font-medium">מוצר</th>
                          <th className="p-4 font-medium whitespace-nowrap">
                            מחיר יחידה
                          </th>
                          <th className="p-4 font-medium">כמות</th>
                          <th className="p-4 font-medium whitespace-nowrap">
                            סה"כ
                          </th>
                          <th className="p-4 font-medium">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-stone-200">
                        {cart.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-stone-50/60 transition-colors"
                          >
                            <td className="p-4 align-middle">
                              <div className="flex items-center gap-3">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-16 h-16 rounded-xl object-cover border border-stone-200"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-xl border border-stone-200 grid place-items-center text-xs text-stone-400">
                                    ללא תמונה
                                  </div>
                                )}
                                <div className="font-semibold text-stone-800 leading-5 line-clamp-2 max-w-xs md:max-w-none">
                                  {item.name}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 align-middle whitespace-nowrap text-stone-700">
                              {Number(item.price).toFixed(2)} ₪
                            </td>
                            <td className="p-4 align-middle">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => updateQty(item.id, -1)}
                                  className="w-8 h-8 rounded-full border border-stone-300 hover:bg-stone-100 grid place-items-center transition-colors"
                                  aria-label="הפחת כמות"
                                >
                                  −
                                </button>
                                <div className="w-10 text-center font-semibold text-stone-800">
                                  {item.quantity}
                                </div>
                                <button
                                  onClick={() => updateQty(item.id, 1)}
                                  className="w-8 h-8 rounded-full border border-stone-300 hover:bg-stone-100 grid place-items-center transition-colors"
                                  aria-label="הוסף כמות"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-4 align-middle whitespace-nowrap font-semibold text-stone-800">
                              {(Number(item.price) * item.quantity).toFixed(2)}{" "}
                              ₪
                            </td>
                            <td className="p-4 align-middle">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="inline-flex items-center gap-2 px-3 h-9 rounded-full border border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                הסר
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-stone-50/80 font-semibold text-stone-800">
                          <td className="p-4" colSpan={3}>
                            סה"כ לתשלום
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            {total.toFixed(2)} ₪
                          </td>
                          <td className="p-4"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* פעולות כלליות */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    onClick={handleClearCart}
                    className="px-5 h-11 rounded-full border-2 border-stone-200 bg-white hover:border-amber-500 hover:bg-amber-50 font-semibold text-stone-700 transition-colors"
                  >
                    נקה עגלה
                  </button>

                  <Link
                    href="/order"
                    className="px-5 h-11 grid place-items-center rounded-full bg-stone-900 text-white font-semibold hover:bg-stone-700 transition-colors"
                  >
                    המשך קניה
                  </Link>
                </div>
              </section>

              {/* סיכום הזמנה */}
              <aside className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden sticky top-24">
                  <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/60">
                    <h3 className="text-lg font-bold text-stone-800">
                      סיכום הזמנה
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-stone-700">
                      <span>מספר פריטים</span>
                      <span className="font-semibold">
                        {cart.reduce((s, i) => s + i.quantity, 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-stone-700">
                      <span>סכום ביניים</span>
                      <span className="font-semibold">
                        {total.toFixed(2)} ₪
                      </span>
                    </div>
                    <div className="pt-4 border-t border-stone-200 flex items-center justify-between text-stone-800 font-bold">
                      <span>לתשלום</span>
                      <span className="text-xl">{total.toFixed(2)} ₪</span>
                    </div>

                    <button
                      onClick={handleCreateOrder}
                      disabled={submitting}
                      className="w-full mt-2 h-12 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <Spinner /> שולח...
                        </span>
                      ) : (
                        "בצע הזמנה"
                      )}
                    </button>

                    {!userEmail && (
                      <p className="text-xs text-stone-500 text-center">
                        כדי להשלים הזמנה תצטרכו להתחבר.
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* Footer קטן תואם סגנון */}
      <footer className="mt-auto bg-gradient-to-l from-stone-800 to-stone-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-3">
            <div className="bg-gradient-to-br from-yellow-400 to-amber-600 text-white w-10 h-10 rounded-xl flex items-center justify-center">
              <span className="text-lg font-bold">ב״מ</span>
            </div>
            <h3 className="text-xl font-bold mr-3">בית המדרש</h3>
          </div>
          <p className="text-stone-300">סיכום והשלמת הזמנה.</p>
        </div>
      </footer>
    </div>
  );
}
