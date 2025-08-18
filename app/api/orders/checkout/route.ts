// app/api/orders/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getResend, FROM } from "@/lib/resend";

// מומלץ: הבטחת ריצה על Node ושהנתיב לא יעבור סטטיזציה
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- Types ----
type CartItem = { id: string; quantity: number };

// ---- Helpers ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );
}

function renderSupplierEmail(params: {
  supplierName: string;
  orderId: string;
  lines: { name: string; qty: number; price: number }[];
}) {
  const rows = params.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(
          l.name
        )}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${
          l.qty
        }</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">₪${Number(
          l.price
        ).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif">
    <h2 style="margin:0 0 8px">Order ${params.orderId.slice(0, 8)}</h2>
    <p style="margin:0 0 16px">Hello ${escapeHtml(
      params.supplierName
    )}, a new order contains your items:</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px">
      <thead>
        <tr>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd">Product</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #ddd">Qty</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd">Unit Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#666;margin-top:16px">Sent automatically from yeshivashop.co.uk.</p>
  </body></html>`;
}

// ---- Route ----
export async function POST(req: NextRequest) {
  try {
    // 0) Auth header מהלקוח
    const authHeader = req.headers.get("authorization") || ""; // "Bearer <token>"

    // Supabase client שמקבל את ה־Authorization קדימה ל-RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 1) משתמש
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2) גוף הבקשה
    const body = await req.json().catch(() => null);
    const cart: CartItem[] = Array.isArray(body?.cart) ? body.cart : [];
    if (!cart.length) {
      return NextResponse.json({ error: "empty cart" }, { status: 400 });
    }

    // 3) אימות מוצרים ומיפוי ספקים
    const ids = cart.map((c) => c.id);
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id,name,price,supplier_id")
      .in("id", ids);

    if (prodErr || !products?.length) {
      return NextResponse.json(
        { error: prodErr?.message || "products not found" },
        { status: 400 }
      );
    }

    // 4) יצירת הזמנה
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: orderErr?.message || "order create failed" },
        { status: 500 }
      );
    }

    // 5) פריטי הזמנה
    const items = cart.map((c) => ({
      order_id: order.id,
      product_id: c.id,
      quantity: Math.max(1, Number(c.quantity) || 1),
    }));
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(items);
    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // 6) קיבוץ לפי ספק ושליחת מיילים
    const bySupplier = new Map<
      string,
      {
        name: string;
        email: string | null;
        lines: { name: string; qty: number; price: number }[];
      }
    >();

    for (const c of cart) {
      const p = products.find((x) => x.id === c.id);
      if (!p?.supplier_id) continue;
      if (!bySupplier.has(p.supplier_id))
        bySupplier.set(p.supplier_id, { name: "", email: null, lines: [] });
      bySupplier.get(p.supplier_id)!.lines.push({
        name: p.name,
        qty: Number(c.quantity),
        price: Number(p.price),
      });
    }

    if (bySupplier.size) {
      const supplierIds = Array.from(bySupplier.keys());
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id,name,email")
        .in("id", supplierIds);

      suppliers?.forEach((s) => {
        const bucket = bySupplier.get(s.id);
        if (bucket) {
          bucket.name = s.name;
          bucket.email = s.email;
        }
      });

      // הכנת לקוח Resend באופן בטוח
      const resend = await getResend();

      if (resend) {
        const sends = Array.from(bySupplier.values()).map(async (s) => {
          if (!s.email) return;
          const html = renderSupplierEmail({
            supplierName: s.name || "Supplier",
            orderId: order.id,
            lines: s.lines,
          });
          await resend.emails.send({
            from: FROM,
            to: s.email,
            subject: `New order ${order.id.slice(0, 8)} – ${s.lines.reduce(
              (n, l) => n + l.qty,
              0
            )} items`,
            html,
          });
        });

        await Promise.allSettled(sends);
      } else {
        console.warn(
          "[resend] Missing API key; skipping supplier emails for order",
          order.id
        );
      }
    }

    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (e: any) {
    console.error("checkout error:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
