"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHybridCart } from "@/hooks/useHybridCart";

export default function CartPage() {
  const router = useRouter();

  // 🛒 עגלה מתמדת דרך ההוק
  const { cart, updateQty, removeItem, clearCart, total, hydrated } =
    useHybridCart();

  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // טעינת משתמש
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    })();
  }, []);

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      alert("העגלה ריקה!");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user || userError) {
      alert("יש להתחבר כדי לבצע הזמנה");
      router.push("/auth");
      setSubmitting(false);
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (orderError || !orderData) {
      alert("שגיאה ביצירת הזמנה: " + (orderError?.message ?? ""));
      setSubmitting(false);
      return;
    }

    const itemsToInsert = cart.map((it) => ({
      order_id: orderData.id,
      product_id: it.id, // UUID כמחרוזת
      quantity: it.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      alert("שגיאה בהוספת פריטים להזמנה: " + itemsError.message);
      setSubmitting(false);
      return;
    }

    clearCart();
    alert("✅ ההזמנה בוצעה בהצלחה!");
    setSubmitting(false);
    router.push("/orders/thanks"); // אם יש דף תודה
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
        {cart.length === 0 ? (
          <div className="text-center text-gray-600">
            העגלה ריקה.{" "}
            <Link href="/order" className="text-blue-600 underline">
              חזרה למוצרים
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-xl border">
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
                        {(item.price * item.quantity).toFixed(2)} ₪
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

            <div className="flex items-center justify-between">
              <button
                onClick={clearCart}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                נקה עגלה
              </button>

              <button
                onClick={handleCreateOrder}
                disabled={submitting}
                className="px-6 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "שולח..." : "בצע הזמנה"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
