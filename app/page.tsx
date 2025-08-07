"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // אם המשתמש מחובר – נעביר אותו לדף ההזמנות
        router.push("/order");
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-xl p-8 text-center space-y-4 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800">ברוך הבא</h1>
        <p className="text-gray-600">כדי להזמין מוצרים יש להתחבר או להירשם</p>

        <a
          href="/auth"
          className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          התחברות / הרשמה
        </a>
      </div>
    </div>
  );
}
