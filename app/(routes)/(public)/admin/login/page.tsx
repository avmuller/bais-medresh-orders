"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin/orders";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // כניסה רגילה
      await signIn(email, password);

      // בדיקת תפקיד לאחר התחברות
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("לא נוצר סשן לאחר התחברות.");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profErr) throw profErr;
      if (profile?.role !== "admin") {
        await signOut();
        throw new Error("אין לך הרשאות מנהל.");
      }

      router.replace(redirectTo);
    } catch (err: any) {
      setError(err?.message || "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4 text-center">התחברות מנהל</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm">אימייל</span>
          <input
            type="email"
            className="mt-1 w-full border rounded p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm">סיסמה</span>
          <input
            type="password"
            className="mt-1 w-full border rounded p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "מתחבר..." : "התחבר"}
        </button>
      </form>
    </div>
  );
}
