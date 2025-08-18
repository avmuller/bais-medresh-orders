"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";

// Add loading spinner component
const Spinner = () => (
  <div className="inline-block animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
);

// Add error message component
const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{message}</div>
);

export default function CartPage() {
  const router = useRouter();

  // 🛒 עגלה מתמדת דרך ההוק
  const { cart, updateQty, removeItem, clearCart, total, hydrated } =
    useHybridCart();

  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // טעינת משתמש
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    })();
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
      alert("יש להתחבר כדי לבצע הזמנה");
      router.push("/auth");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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

  // הצג טעינה קלה עד שהעגלה נטענת מה־storage
  if (!hydrated) {
    return <div className="p-6 text-center">טוען עגלה...</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">העגלה שלי</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/order"
              className="px-3 py-1.5 rounded-md border hover:bg-gray-50"
            >
              ← המשך קניה
            </Link>

            {userEmail ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.refresh();
                }}
                className="text-sm text-red-600 underline"
              >
                התנתקות ({userEmail})
              </button>
            ) : (
              <Link href="/auth" className="text-sm text-blue-600 underline">
                התחבר להזמנה
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && <ErrorMessage message={error} />}

        {cart.length === 0 ? (
          <div className="text-center text-gray-600">
            העגלה ריקה.{" "}
            <Link href="/order" className="text-blue-600 underline">
              חזרה למוצרים
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Responsive table wrapper */}
            <div className="overflow-x-auto">
              <div className="overflow-hidden rounded-xl border min-w-[640px]">
                <table className="w-full text-right">
                  <thead className="bg-gray-50">
                    <tr className="text-sm text-gray-600">
                      <th className="p-3">מוצר</th>
                      <th className="p-3">מחיר יחידה</th>
                      <th className="p-3">כמות</th>
                      <th className="p-3">סה"כ</th>
                      <th className="p-3">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-14 h-14 rounded object-cover border"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded border grid place-items-center text-xs text-gray-400">
                                ללא תמונה
                              </div>
                            )}
                            <div className="font-medium">{item.name}</div>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {Number(item.price).toFixed(2)} ₪
                        </td>
                        <td className="p-3">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-8 h-8 rounded-md border hover:bg-gray-50"
                            >
                              −
                            </button>
                            <div className="w-10 text-center">
                              {item.quantity}
                            </div>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-8 h-8 rounded-md border hover:bg-gray-50"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {(Number(item.price) * item.quantity).toFixed(2)} ₪
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
                          >
                            הסר
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="p-3" colSpan={3}>
                        סה"כ לתשלום
                      </td>
                      <td className="p-3">{total.toFixed(2)} ₪</td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleClearCart}
                className="px-4 py-2 border rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-gray-200"
              >
                נקה עגלה
              </button>

              <button
                onClick={handleCreateOrder}
                disabled={submitting}
                className="px-6 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 focus:ring-2 focus:ring-green-500"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> שולח...
                  </span>
                ) : (
                  "בצע הזמנה"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useRef } from "react";
