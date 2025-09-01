// app/api/orders/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getResend, FROM } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return `<!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family:Arial,Helvetica,sans-serif">
        <h2 style="margin:0 0 8px">הזמנה ${params.orderId.slice(0, 8)}</h2>
        <p style="margin:0 0 16px">שלום ${escapeHtml(
          params.supplierName
        )}, התקבלה הזמנה חדשה הכוללת את המוצרים הבאים:</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px">
          <thead>
            <tr>
              <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd">מוצר</th>
              <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #ddd">כמות</th>
              <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd">מחיר יחידה</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#666;margin-top:16px">נשלח אוטומטית ממערכת ההזמנות.</p>
      </body>
    </html>`;
}

export async function POST(_req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 1. אימות משתמש
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json(
        { error: "unauthorized", step: "auth.getUser" },
        { status: 401 }
      );
    }

    // 2. קריאת RPC
    type CheckoutRow = { order_id: string; total: number };
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "checkout_cart"
    );
    if (rpcErr) {
      return NextResponse.json(
        { error: "checkout failed", details: rpcErr.message },
        { status: 400 }
      );
    }

    const rows = (rpcData ?? []) as CheckoutRow[];
    if (!rows.length) {
      return NextResponse.json(
        { error: "checkout returned no rows", step: "rpc.empty" },
        { status: 500 }
      );
    }

    const out = rows[0];
    const orderId = String(out.order_id);
    const total = Number(out.total) || 0;

    // 3. פריטי הזמנה
    const { data: lines } = await supabase
      .from("order_items")
      .select("product_id, quantity, unit_price, price")
      .eq("order_id", orderId);

    // 4. מוצרים
    const productIds = Array.from(
      new Set((lines ?? []).map((l) => l.product_id))
    ).filter(Boolean);
    let products: Array<{
      id: string;
      name: string;
      supplier_id: string | null;
      price: number;
    }> = [];
    if (productIds.length) {
      const res = await supabase
        .from("products")
        .select("id, name, supplier_id, price")
        .in("id", productIds);
      products = res.data ?? [];
    }

    // 5. מיילים לספקים
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
        const p = products.find((x) => x.id === row.product_id);
        const supplierId = p?.supplier_id ?? null;
        if (!supplierId) continue;
        if (!bySupplier.has(supplierId))
          bySupplier.set(supplierId, { name: "", email: null, lines: [] });
        bySupplier.get(supplierId)!.lines.push({
          name: p?.name ?? "Product",
          qty: Number(row.quantity) || 1,
          price: Number(
            (row as any).unit_price ?? (row as any).price ?? p?.price ?? 0
          ),
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

        const delayMs = 700; // מעט מתחת למגבלת 2 בקשות לשנייה
        for (const s of bySupplier.values()) {
          if (!s.email || s.lines.length === 0) continue;

          const html = renderSupplierEmail({
            supplierName: s.name || "Supplier",
            orderId,
            lines: s.lines,
          });

          const text = [
            `הזמנה ${orderId.slice(0, 8)}`,
            ...s.lines.map(
              (l) => `• ${l.qty} x ${l.name} – ₪${Number(l.price).toFixed(2)}`
            ),
            "",
            "נשלח אוטומטית ממערכת ההזמנות.",
          ].join("\n");

          await resend.emails.send({
            from: FROM,
            to: s.email,
            subject: `New order ${orderId.slice(0, 8)} – ${s.lines.reduce(
              (n, l) => n + l.qty,
              0
            )} items`,
            html,
            text,
          });

          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    return NextResponse.json({ ok: true, orderId, total }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
