"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type OrderSnapshot = {
  orderId?: string;
  createdAt: string;
  items: {
    name: string;
    qty: number;
    price: number;
    image_url: string | null;
  }[];
  total: number;
  count: number;
};

type Line = {
  name: string;
  qty: number;
  price: number;
  image_url?: string | null;
};

// Loading spinner component
const Spinner = () => (
  <div className="inline-block animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
);

export default function ThankYouClient({
  orderId,
}: {
  orderId: string | null;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load order data
  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      setLoading(true);
      setError(null);

      try {
        if (orderId) {
          const { data, error } = await supabase
            .from("order_items")
            .select(
              `
              quantity,
              product:products(name, price, image_url)
            `
            )
            .eq("order_id", orderId);

          if (error) throw error;

          if (!cancelled && data) {
            const mapped: Line[] = data
              .filter((r: any) => r.product)
              .map((r: any) => ({
                name: r.product.name,
                qty: Number(r.quantity),
                price: Number(r.product.price ?? 0),
                image_url: r.product.image_url ?? null,
              }));
            setLines(mapped);
            return;
          }
        }

        // Fallback to sessionStorage
        const raw = sessionStorage.getItem("last_order");
        if (!cancelled && raw) {
          const snapshot = JSON.parse(raw) as OrderSnapshot;
          setLines(snapshot.items);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load order");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Load user email
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    }
    loadUser();
  }, []);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.price, 0),
    [lines]
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white border p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="inline-flex w-9 h-9 rounded-full bg-green-100 text-green-700 items-center justify-center text-xl">
              ✓
            </span>
            <h1 className="text-2xl font-bold">תודה! ההזמנה התקבלה</h1>
          </div>

          {/* Order details */}
          <div className="mt-2 text-gray-600">
            {orderId ? (
              <div>
                מספר הזמנה:{" "}
                <span className="font-semibold">{orderId.slice(0, 8)}</span>
              </div>
            ) : (
              <div>מספר הזמנה לא זמין (מציגים תקציר אחרון)</div>
            )}
            {userEmail && (
              <div>
                אישור נשלח ל: <span className="font-semibold">{userEmail}</span>
              </div>
            )}
          </div>

          {/* Order content */}
          <div className="mt-6">
            {error ? (
              <div className="text-red-600 p-4 rounded bg-red-50">{error}</div>
            ) : loading ? (
              <div className="text-center p-4">
                <Spinner />
                <div className="mt-2 text-gray-500">טוען סיכום הזמנה...</div>
              </div>
            ) : lines.length === 0 ? (
              <div className="text-gray-500 text-center p-4">
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

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-md border hover:bg-gray-50 disabled:opacity-50"
              disabled={loading || lines.length === 0}
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
        </div>
      </div>
    </div>
  );
}
