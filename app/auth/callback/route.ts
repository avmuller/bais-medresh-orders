import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { event, session } = await request.json();

  // מעדכן קוקיז של הסשן בצד השרת
  if (
    event === "SIGNED_IN" ||
    event === "TOKEN_REFRESHED" ||
    event === "SIGNED_OUT"
  ) {
    await supabase.auth.setSession(session);
  }

  return NextResponse.json({ ok: true });
}
