"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Line = {
  name: string;
  qty: number;
  price: number;
  image_url?: string | null;
};

export default function OrderThanksPage() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search.get("order");

  const [lines, setLines] = useState<Line[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // מייל משתמש (לא חובה, נחמד להציג)
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    })();
  }, []);

  // שליפת פרטי הזמנה מה-DB (אם יש orderId) או שימוש בתקציר ששמרנו
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      try {
        if (orderId) {
          // ננסה להביא מה-DB
          const { data, error } = await supabase
            .from("order_items")
            .select(
              `
              quantity,
              product:products(
                name, price, image_url
              )
            `
            )
            .eq("order_id", orderId);

          if (!cancelled && data && !error && data.length > 0) {
            const mapped: Line[] = data
              .filter((r: any) => r.product)
              .map((r: any) => ({
                name: r.product.name,
                qty: Number(r.quantity),
                price: Number(r.product.price ?? 0),
                image_url: r.product.image_url ?? null,
              }));
            setLines(mapped);
            setLoading(false);
            return;
          }
        }

        // fallback לתקציר שנשמר לפני הניקוי
        const raw = sessionStorage.getItem("last_order");
        if (!cancelled && raw) {
          const snapshot = JSON.parse(raw) as Line[];
          setLines(snapshot);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.price, 0),
    [lines]
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* כותרת */}
        <div className="rounded-2xl bg-white border p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex w-9 h-9 rounded-full bg-green-100 text-green-700 items-center justify-center text-xl">
              ✓
            </span>
            <h1 className="text-2xl font-bold">תודה! ההזמנה התקבלה</h1>
          </div>

          <div className="mt-2 text-gray-600">
            {orderId ? (
              <div>
                מספר הזמנה:{" "}
                <span className="font-semibold">{orderId.slice(0, 8)}</span>
              </div>
            ) : (
              <div>מספר הזמנה לא זמין (מציגים תקציר אחרון).</div>
            )}
            {userEmail && (
              <div>
                אישור נשלח ל: <span className="font-semibold">{userEmail}</span>
              </div>
            )}
          </div>

          {/* טבלת פריטים */}
          <div className="mt-6">
            {loading ? (
              <div className="text-gray-500">טוען סיכום הזמנה…</div>
            ) : lines.length === 0 ? (
              <div className="text-gray-500">
                אין פריטים לתצוגה.{" "}
                <Link href="/order" className="text-blue-600 underline">
                  חזרה למוצרים
                </Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-right">
                  <thead className="bg-gray-50">
                    <tr className="text-sm text-gray-600">
                      <th className="p-3">מוצר</th>
                      <th className="p-3">מחיר יחידה</th>
                      <th className="p-3">כמות</th>
                      <th className="p-3">סה״כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {l.image_url ? (
                              <img
                                src={l.image_url}
                                alt={l.name}
                                className="w-12 h-12 rounded object-cover border"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded border grid place-items-center text-xs text-gray-400">
                                ללא תמונה
                              </div>
                            )}
                            <div className="font-medium">{l.name}</div>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {l.price.toFixed(2)} ₪
                        </td>
                        <td className="p-3">{l.qty}</td>
                        <td className="p-3 whitespace-nowrap">
                          {(l.qty * l.price).toFixed(2)} ₪
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="p-3" colSpan={3}>
                        סה״כ לתשלום
                      </td>
                      <td className="p-3">{total.toFixed(2)} ₪</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* כפתורים */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-md border hover:bg-gray-50"
            >
              הדפס קבלה
            </button>
            <Link
              href="/order"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              חזרה למוצרים
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            שים לב: ההזמנה נשלחה לספקים הרלוונטיים. הם יצרו קשר לסגירת
            אספקה/תשלום.
          </p>
        </div>
      </div>
    </div>
  );
}
