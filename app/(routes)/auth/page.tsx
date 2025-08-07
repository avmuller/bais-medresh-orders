"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";

export default function AuthPage() {
  const router = useRouter(); // ✅ הוספנו router
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        alert("✅ התחברת בהצלחה!");
        router.push("/order"); // ✅ הפניה לאחר התחברות
      } else {
        await signUp(email, password, fullName);
        alert("✅ נרשמת בהצלחה! כנס למייל לאימות");
      }
    } catch (err: any) {
      alert("שגיאה: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center">
        {isLogin ? "התחברות" : "הרשמה"}
      </h1>

      {!isLogin && (
        <input
          className="w-full border p-2 rounded"
          placeholder="שם מלא"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      )}
      <input
        className="w-full border p-2 rounded"
        type="email"
        placeholder="אימייל"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border p-2 rounded"
        type="password"
        placeholder="סיסמה"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        disabled={loading}
      >
        {loading ? "טוען..." : isLogin ? "התחבר" : "הרשם"}
      </button>

      <p className="text-center text-sm text-gray-500">
        {isLogin ? "אין לך חשבון?" : "כבר יש לך חשבון?"}{" "}
        <button className="underline" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "הרשם" : "התחבר"}
        </button>
      </p>
    </div>
  );
}
