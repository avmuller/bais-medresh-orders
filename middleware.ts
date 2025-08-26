// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { pathname, search } = req.nextUrl;

  // לא לגעת בדף הלוגין
  if (pathname.startsWith("/admin/login")) return res;

  if (pathname.startsWith("/admin")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("redirectTo", pathname + search);
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = { matcher: ["/admin/:path*"] };
