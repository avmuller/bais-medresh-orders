"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUpCustomer } from "@/lib/auth";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // שדות חובה בהרשמת מוסד
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [institutionAddress, setInstitutionAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isLogin) {
        await signIn(email.trim(), password);
        // בלי alert — ניווט שקט עם דגל להודעת ברוך הבא
        router.push("/order?login=1");
        return;
      }

      // הרשמה — ולידציה
      if (
        !responsibleName.trim() ||
        !responsiblePhone.trim() ||
        !institutionName.trim() ||
        !institutionAddress.trim()
      ) {
        throw new Error(
          "נא למלא שם אחראי, טלפון אחראי, שם המוסד וכתובת המוסד (כולם חובה)."
        );
      }

      await signUpCustomer({
        email: email.trim(),
        password,
        responsible_name: responsibleName.trim(),
        responsible_phone: responsiblePhone.trim(),
        institution_name: institutionName.trim(),
        institution_address: institutionAddress.trim(),
      });

      // בלי alert — הודעת מידע בתוך העמוד
      setInfo(
        "נרשמת בהצלחה! שלחנו מייל לאימות החשבון. לאחר אימות תוכלי/תוכל להתחבר."
      );
      setIsLogin(true);
    } catch (err: any) {
      setError(err?.message || "אירעה שגיאה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold text-center">
        {isLogin ? "התחברות" : "הרשמת מוסד"}
      </h1>

      {/* הודעות */}
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded text-sm">
          {error}
        </div>
      )}
      {info && (
        <div className="bg-blue-50 text-blue-700 border border-blue-200 p-3 rounded text-sm">
          {info}
        </div>
      )}

      {!isLogin && (
        <>
          <input
            className="w-full border p-2 rounded"
            placeholder="שם האחראי *"
            value={responsibleName}
            onChange={(e) => setResponsibleName(e.target.value)}
            required
            autoComplete="name"
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="טלפון האחראי *"
            value={responsiblePhone}
            onChange={(e) => setResponsiblePhone(e.target.value)}
            required
            autoComplete="tel"
            inputMode="tel"
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="שם המוסד *"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            required
            autoComplete="organization"
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="כתובת המוסד *"
            value={institutionAddress}
            onChange={(e) => setInstitutionAddress(e.target.value)}
            required
            autoComplete="street-address"
          />
        </>
      )}

      <input
        className="w-full border p-2 rounded"
        type="email"
        placeholder="אימייל *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <input
        className="w-full border p-2 rounded"
        type="password"
        placeholder="סיסמה *"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete={isLogin ? "current-password" : "new-password"}
      />

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "טוען..." : isLogin ? "התחבר" : "הרשם"}
      </button>

      <p className="text-center text-sm text-gray-500">
        {isLogin ? "אין לך חשבון?" : "כבר יש לך חשבון?"}{" "}
        <button
          className="underline"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setInfo(null);
          }}
        >
          {isLogin ? "הרשם" : "התחבר"}
        </button>
      </p>
    </div>
  );
}
