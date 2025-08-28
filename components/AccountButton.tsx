"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Role = "gabay" | "supplier" | "admin" | "customer";

type Profile = {
  id: string;
  role: Role;
  responsible_name: string | null;
  responsible_phone: string | null;
  institution_name: string | null;
  institution_address: string | null;
};

function getInitials(name?: string | null, fallback?: string | null) {
  const src =
    (name && name.trim()) || (fallback && fallback.split("@")[0]) || "";
  if (!src) return "חש";
  const words = src.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`;
  return src.slice(0, 2);
}

export default function AccountButton() {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const [editEmail, setEditEmail] = useState<string>("");

  // טען משתמש + פרופיל
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userEmail = user?.email ?? "";
      setEmail(user?.email ?? null);
      setEditEmail(userEmail);

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select(
          "id, role, responsible_name, responsible_phone, institution_name, institution_address"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
      } else {
        setProfile({
          id: user.id,
          role: "customer",
          responsible_name: null,
          responsible_phone: null,
          institution_name: null,
          institution_address: null,
        });
      }
    })();
  }, []);

  // רענון אימייל ב-UI לאחר אימות/עדכון
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        setEmail(session?.user?.email ?? null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // סגור תפריט בלחיצה בחוץ
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!btnRef.current) return;
      if (!btnRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  const initials = getInitials(profile?.institution_name, email);

  const redirectParam = encodeURIComponent("/order?verified=1");
  const buildRedirect = () =>
    `${location.origin}/auth/callback?next=${redirectParam}`;

  const sendVerification = async (
    targetEmail: string,
    forEmailChange: boolean
  ) => {
    setSending(true);
    setError(null);
    try {
      const redirectTo = buildRedirect();

      if (forEmailChange) {
        // שליחת קישור אימות לשינוי אימייל
        const { error } = await supabase.auth.updateUser(
          { email: targetEmail },
          { emailRedirectTo: redirectTo }
        );
        if (error) throw error;
        setInfo(
          "שלחנו קישור אימות לכתובת החדשה (ולעתים גם לישנה). האימייל יעודכן לאחר האישור."
        );
      } else {
        // ללא שינוי אימייל – אימות זהות ע״י Magic Link
        const { error } = await supabase.auth.signInWithOtp({
          email: targetEmail,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setInfo("שלחנו קישור אימות למייל. אנא אשר/י את השינוי דרך המייל.");
      }

      setVerificationSent(true);
    } catch (e: any) {
      setError(e?.message || "שליחת האימות נכשלה");
    } finally {
      setSending(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setInfo(null);
    setVerificationSent(false);

    try {
      // 1) שמירת פרטי פרופיל (role חובה כדי לא ליפול על NOT NULL)
      const payload = {
        id: profile.id,
        role: (profile.role ?? "customer") as Role,
        responsible_name: profile.responsible_name,
        responsible_phone: profile.responsible_phone,
        institution_name: profile.institution_name,
        institution_address: profile.institution_address,
      };
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (upsertErr) throw upsertErr;

      // 2) אימייל: אם שונה — שלח אימות שינוי אימייל; אם לא — Magic Link לאישור שינויים
      const currentEmail = email ?? "";
      const nextEmail = (editEmail ?? "").trim();

      if (nextEmail && nextEmail !== currentEmail) {
        const redirectTo = buildRedirect();
        const { error: emailErr } = await supabase.auth.updateUser(
          { email: nextEmail },
          { emailRedirectTo: redirectTo }
        );
        if (emailErr) throw emailErr;

        setInfo(
          "שינוי האימייל דורש אימות. שלחנו קישור לכתובת החדשה (ולעתים גם לישנה)."
        );
        setVerificationSent(true);
      } else if (currentEmail) {
        await sendVerification(currentEmail, false);
      }

      // ❗ לא סוגרים את המודאל כאן — כדי שההודעה תישאר גלויה
      // המשתמש יחליט לסגור עם כפתור X/ביטול
    } catch (e: any) {
      setError(e?.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      {/* אווטאר עם ראשי תיבות */}
      <button
        ref={btnRef}
        onClick={() => setMenuOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-blue-600 text-white grid place-items-center font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        title={profile?.institution_name || email || "חשבון"}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {initials}
      </button>

      {/* תפריט */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-56 rounded-xl border bg-white shadow-lg z-50 p-1"
        >
          <div className="px-3 py-2 text-sm text-gray-700">
            <div className="font-semibold">
              {profile?.institution_name || "ללא שם מוסד"}
            </div>
            <div className="text-xs text-gray-500 truncate">{email}</div>
          </div>
          <div className="h-px bg-gray-100 my-1" />
          <button
            className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
            }}
          >
            עריכת פרטי החשבון
          </button>
          <button
            className="w-full text-right px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            onClick={async () => {
              setMenuOpen(false);
              await supabase.auth.signOut();
              router.refresh();
            }}
          >
            התנתקות
          </button>
        </div>
      )}

      {/* דיאלוג עריכה */}
      {editOpen && profile && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">עריכת פרטי החשבון</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="px-2 py-1 rounded-md hover:bg-gray-100"
                aria-label="סגור"
              >
                ✕
              </button>
            </div>

            {(error || info) && (
              <div
                className={`p-2 rounded-md mb-3 text-sm ${
                  error ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
                }`}
              >
                {error || info}
                {verificationSent && !error && (
                  <div className="mt-1">
                    לא קיבלת?{" "}
                    <button
                      disabled={sending}
                      onClick={() => {
                        const current = email ?? "";
                        const next = (editEmail ?? "").trim();
                        const isEmailChange = !!next && next !== current;
                        const target = isEmailChange ? next : current;
                        if (!target) {
                          setError("לא נמצא אימייל לשליחה.");
                          return;
                        }
                        sendVerification(target, isEmailChange);
                      }}
                      className="underline disabled:opacity-60"
                    >
                      שלח שוב
                    </button>
                  </div>
                )}
              </div>
            )}

            <form className="space-y-4" onSubmit={onSave}>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  שם המוסד
                </label>
                <input
                  value={profile.institution_name ?? ""}
                  onChange={(e) =>
                    setProfile({ ...profile, institution_name: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="לדוגמה: בית מדרש ..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  כתובת המוסד
                </label>
                <input
                  value={profile.institution_address ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      institution_address: e.target.value,
                    })
                  }
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="רחוב, עיר"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    איש קשר
                  </label>
                  <input
                    value={profile.responsible_name ?? ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        responsible_name: e.target.value,
                      })
                    }
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="שם מלא"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    טלפון איש קשר
                  </label>
                  <input
                    value={profile.responsible_phone ?? ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        responsible_phone: e.target.value,
                      })
                    }
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="050-0000000"
                  />
                </div>
              </div>

              {/* אימייל */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  אימייל
                </label>
                <input
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="name@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  כל שינוי ישלח מייל לאימות. שינוי אימייל עלול לדרוש אימות בשתי
                  הכתובות.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded-md border hover:bg-gray-50"
                >
                  סגור
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "שומר..." : "שמירה"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
