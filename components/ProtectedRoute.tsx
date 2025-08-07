"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/auth"); // אם לא מחובר – שולח לדף התחברות
      } else {
        setLoading(false); // ממשיך לטעון את הדף
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <div className="text-center p-6">בודק הרשאות...</div>;
  }

  return <>{children}</>;
}
