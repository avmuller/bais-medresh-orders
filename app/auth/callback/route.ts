import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * GET /auth/callback?code=...&next=/order?verified=1
 * משלים את זרימת האימות/שינוי האימייל (exchangeCodeForSession) ואז מפנה ל-next.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // אפשר להעביר יעד דרך הפרמטר next; אם אין – נציג באנר הצלחה בעמוד ההזמנה
  const next = url.searchParams.get("next") ?? "/order?verified=1";

  const supabase = createRouteHandlerClient({ cookies });

  if (code) {
    // חשוב: זה מבצע התחברות/עדכון סשן ומסיים את זרימת האימות (כולל שינוי אימייל)
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, req.url));
}

/**
 * POST /auth/callback
 * נקרא מה-Client (onAuthStateChange) כדי לסנכרן קוקיז סשן בצד השרת.
 * מצופה body: { event: "SIGNED_IN" | "TOKEN_REFRESHED" | "SIGNED_OUT" | ..., session }
 */
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { event, session } = await request.json();

  try {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      // מעדכן קוקיז של הסשן בצד השרת
      await supabase.auth.setSession(session);
    } else if (event === "SIGNED_OUT") {
      // מנקה את הסשן מהקוקיז
      await supabase.auth.signOut();
    }
    // אירועים אחרים (USER_UPDATED וכו') לא דורשים פעולה בצד השרת
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "auth callback failed" },
      { status: 400 }
    );
  }
}
