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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
        alert("✅ התחברת בהצלחה!");
        router.push("/order");
      } else {
        // ולידציה – כל השדות חובה
        if (
          !responsibleName.trim() ||
          !responsiblePhone.trim() ||
          !institutionName.trim() ||
          !institutionAddress.trim()
        ) {
          throw new Error(
            "נא למלא שם אחראי, טלפון אחראי, שם המוסד וכתובת המוסד (כולם חובה)"
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

        alert("✅ נרשמת בהצלחה! בדוק מייל לאימות החשבון.");
        setIsLogin(true);
      }
    } catch (err: any) {
      alert("שגיאה: " + (err?.message || "אירעה שגיאה"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold text-center">
        {isLogin ? "התחברות" : "הרשמת מוסד"}
      </h1>

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
        autoComplete="new-password"
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
        <button className="underline" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "הרשם" : "התחבר"}
        </button>
      </p>
    </div>
  );
}
