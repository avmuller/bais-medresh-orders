// app/api/orders/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getResend, FROM } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ] as string)
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

export async function POST(_req: NextRequest) {
  try {
    // Supabase מחובר לסשן דרך קוקיות (RLS יעבוד אוטומטית)
    // ...
    const supabase = createRouteHandlerClient({ cookies });

    // 1) אימות משתמש
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2) Checkout אטומי
    type CheckoutOut = { order_id: string; total: number };

    const rpc = await supabase.rpc("checkout_cart"); // <-- בלי <> ובלי {}
    if (rpc.error || !rpc.data) {
      return NextResponse.json(
        { error: rpc.error?.message || "checkout failed" },
        { status: 400 }
      );
    }

    const out = rpc.data as unknown as CheckoutOut; // טיפוס תוצאה אחיד
    const orderId: string = out.order_id;
    const total: number = Number(out.total) || 0;

    // 3) שליפת פריטי ההזמנה לצורך מיילים
    const { data: lines, error: linesErr } = await supabase
      .from("order_items")
      .select(
        `
        order_id,
        quantity,
        unit_price,
        price,
        product:products(id,name,supplier_id,price)
      `
      )
      .eq("order_id", orderId);

    if (linesErr) {
      // לא מפילים את הבקשה בגלל מיילים — רק מתעדים
      console.warn("[checkout] fetch order lines failed:", linesErr.message);
    }

    // 4) מיילים לפי ספק (אם מוגדר RESEND_API_KEY)
    const resend = await getResend();

    if (resend && lines?.length) {
      const bySupplier = new Map<
        string,
        {
          name: string;
          email: string | null;
          lines: { name: string; qty: number; price: number }[];
        }
      >();

      for (const row of lines) {
        const supplierId = (row as any)?.product?.supplier_id as string | null;
        if (!supplierId) continue;
        const unit = Number(
          (row as any)?.unit_price ??
            (row as any)?.price ??
            (row as any)?.product?.price ??
            0
        );
        if (!bySupplier.has(supplierId)) {
          bySupplier.set(supplierId, { name: "", email: null, lines: [] });
        }
        bySupplier.get(supplierId)!.lines.push({
          name: (row as any)?.product?.name ?? "Product",
          qty: Number((row as any)?.quantity) || 1,
          price: unit,
        });
      }

      if (bySupplier.size) {
        const supplierIds = Array.from(bySupplier.keys());
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id,name,email")
          .in("id", supplierIds);

        suppliers?.forEach((s) => {
          const b = bySupplier.get(s.id);
          if (b) {
            b.name = s.name;
            b.email = s.email;
          }
        });

        const sends = Array.from(bySupplier.values()).map(async (s) => {
          if (!s.email || s.lines.length === 0) return;
          const html = renderSupplierEmail({
            supplierName: s.name || "Supplier",
            orderId,
            lines: s.lines,
          });
          await resend.emails.send({
            from: FROM,
            to: s.email,
            subject: `New order ${orderId.slice(0, 8)} – ${s.lines.reduce(
              (n, l) => n + l.qty,
              0
            )} items`,
            html,
          });
        });

        await Promise.allSettled(sends);
      }
    } else if (!resend) {
      console.warn(
        "[resend] Missing API key; skipping supplier emails for order",
        orderId
      );
    }

    return NextResponse.json({ ok: true, orderId, total }, { status: 201 });
  } catch (e: any) {
    console.error("checkout error:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
