"use client";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

export default function AutoLogout({
  minutes = 30,
  checkEverySec = 30,
}: {
  minutes?: number;
  checkEverySec?: number;
}) {
  useInactivityLogout({
    maxIdleMs: minutes * 60 * 1000,
    checkEveryMs: checkEverySec * 1000,
    // storageKey: "lastActive" // אופציונלי לשינוי
  });
  return null;
}
