// lib/resend.ts

export const FROM = process.env.RESEND_FROM ?? "orders@yeshivashop.co.uk"; // או "Orders <orders@yeshivashop.co.uk>"

/**
 * יוצר לקוח Resend רק כשצריך.
 * אם אין RESEND_API_KEY — מחזיר null כדי שלא נקרוס בזמן build.
 */
export async function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[resend] RESEND_API_KEY missing; emails will be skipped.");
    }
    return null;
  }
  const { Resend } = await import("resend"); // dynamic import
  return new Resend(key);
}
