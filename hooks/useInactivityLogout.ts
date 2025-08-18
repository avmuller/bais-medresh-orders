// hooks/useInactivityLogout.ts
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export type InactivityOptions = {
  /** זמן חוסר פעילות מקסימלי לפני התנתקות (ברירת מחדל: 30 דקות) */
  maxIdleMs?: number;
  /** כל כמה זמן לבצע בדיקה (ברירת מחדל: כל 30 שניות) */
  checkEveryMs?: number;
  /** מפתח ב-localStorage לשיתוף חותמת הזמן בין טאבים */
  storageKey?: string;
};

export function useInactivityLogout(options: InactivityOptions = {}) {
  const {
    maxIdleMs = 30 * 60 * 1000,
    checkEveryMs = 30 * 1000,
    storageKey = "lastActive",
  } = options;

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stamp = () => {
      try {
        localStorage.setItem(storageKey, String(Date.now()));
      } catch {
        /* ignore */
      }
    };

    // מאזינים לפעילות ב-window
    const onActivity: EventListener = () => stamp();
    const onFocus: EventListener = () => stamp();

    const winEvents: Array<[keyof WindowEventMap, EventListener]> = [
      ["mousemove", onActivity],
      ["mousedown", onActivity],
      ["keydown", onActivity],
      ["touchstart", onActivity],
      ["scroll", onActivity],
      ["focus", onFocus],
      ["pageshow", onFocus],
      ["beforeunload", onActivity],
    ];

    winEvents.forEach(([ev, fn]) =>
      window.addEventListener(ev, fn, { passive: true })
    );

    // visibilitychange הוא אירוע של document, לא של window
    const onVisibility: EventListener = () => {
      if (!document.hidden) stamp();
    };
    document.addEventListener("visibilitychange", onVisibility, {
      passive: true as unknown as boolean, // מאפשר להעביר אובייקט אופציות בלי תלונות טיפוס
    });

    // חותמת ראשונה
    stamp();

    // בדיקה מחזורית
    const tick = async () => {
      if (cancelled) return;
      let last = 0;
      try {
        last = Number(localStorage.getItem(storageKey) || 0);
      } catch {
        /* ignore */
      }

      const idle = Date.now() - last;
      if (idle > maxIdleMs) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          try {
            await supabase.auth.signOut();
          } finally {
            try {
              localStorage.removeItem(storageKey);
            } catch {}
            // רענון קשיח לדף ההתחברות כדי לנקות מצב
            window.location.href = "/auth";
          }
        } else {
          try {
            localStorage.removeItem(storageKey);
          } catch {}
        }
      }
    };

    timerRef.current = window.setInterval(tick, checkEveryMs);

    // סנכרון בין טאבים
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === storageKey) {
        // אין צורך לבצע פעולה — הקריאה הבאה של tick תקלוט את הזמן המעודכן
      }
    };
    window.addEventListener("storage", onStorage);

    // ניקוי
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      winEvents.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [maxIdleMs, checkEveryMs, storageKey]);
}
