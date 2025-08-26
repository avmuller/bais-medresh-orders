"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // לעדכן את קוקיות השרת דרך ה־route handler (סעיף 2)
      await fetch("/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ event, session }),
      });

      // רענון מסך כדי ש־Server Components/Middleware יראו את הסשן החדש
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return <>{children}</>;
}
