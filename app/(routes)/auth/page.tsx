"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUpCustomer } from "@/lib/auth";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Spinner קטן
const Spinner = () => (
  <div className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-amber-500 rounded-full" />
);

// קומפוננטת שגיאה קצרה
const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 border border-red-200">
    {message}
  </div>
);

// קומפוננטת הודעת מידע
const InfoMessage = ({ message }: { message: string }) => (
  <div className="bg-amber-50 text-amber-600 p-3 rounded-xl mb-4 border border-amber-200">
    {message}
  </div>
);

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
        // ניווט שקט עם דגל להודעת ברוך הבא
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

      // הודעת מידע בתוך העמוד
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
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-stone-200 p-8 space-y-6">
        {/* כותרת מותאמת לסגנון */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gradient-to-br from-yellow-400 to-amber-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold">ב״מ</span>
          </div>
          <h1 className="text-3xl font-bold text-stone-800 text-center leading-tight">
            {isLogin ? "התחברות" : "הרשמת מוסד"}
          </h1>
          <p className="text-sm text-stone-600 text-center max-w-[20ch]">
            כדי להשלים את ההזמנה
          </p>
        </div>

        {/* הודעות - עיצוב תואם */}
        {error && <ErrorMessage message={error} />}
        {info && <InfoMessage message={info} />}

        {/* טופס */}
        <div className="space-y-4">
          {!isLogin && (
            <>
              {/* שדות קלט בעיצוב חדש */}
              <input
                className="w-full h-12 px-4 border border-stone-300 rounded-xl transition-all focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder:text-stone-400 text-stone-800"
                placeholder="שם האחראי *"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                required
                autoComplete="name"
              />
              <input
                className="w-full h-12 px-4 border border-stone-300 rounded-xl transition-all focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder:text-stone-400 text-stone-800"
                placeholder="טלפון האחראי *"
                value={responsiblePhone}
                onChange={(e) => setResponsiblePhone(e.target.value)}
                required
                autoComplete="tel"
                inputMode="tel"
              />
              <input
                className="w-full h-12 px-4 border border-stone-300 rounded-xl transition-all focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder:text-stone-400 text-stone-800"
                placeholder="שם המוסד *"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
                autoComplete="organization"
              />
              <input
                className="w-full h-12 px-4 border border-stone-300 rounded-xl transition-all focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder:text-stone-400 text-stone-800"
                placeholder="כתובת המוסד *"
                value={institutionAddress}
                onChange={(e) => setInstitutionAddress(e.target.value)}
                required
                autoComplete="street-address"
              />
            </>
          )}

          <input
            className="w-full h-12 px-4 border border-stone-300 rounded-xl transition-all focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder:text-stone-400 text-stone-800"
            type="email"
            placeholder="אימייל *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="w-full h-12 px-4 border border-stone-300 rounded-xl transition-all focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder:text-stone-400 text-stone-800"
            type="password"
            placeholder="סיסמה *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          {/* כפתור בעיצוב חדש */}
          <button
            onClick={handleSubmit}
            className="w-full h-12 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner />
                <span>טוען...</span>
              </>
            ) : isLogin ? (
              "התחבר"
            ) : (
              "הרשם"
            )}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* קישור בין הרשמה להתחברות - עיצוב תואם */}
        <p className="text-center text-sm text-stone-500">
          {isLogin ? "עדיין אין לך חשבון?" : "כבר יש לך חשבון?"}{" "}
          <button
            className="font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-2 transition-colors"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setInfo(null);
            }}
          >
            {isLogin ? "הירשם עכשיו" : "התחבר"}
          </button>
        </p>

        {/* קישור לדף הראשי */}
        <div className="text-center mt-6">
          <Link
            href="/order"
            className="text-stone-500 hover:text-stone-700 transition-colors text-sm"
          >
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}
