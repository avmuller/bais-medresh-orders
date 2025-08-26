import "@/styles/globals.css";
import AutoLogout from "@/components/AutoLogout";
import SupabaseProvider from "./_supabase-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <SupabaseProvider>
          {/* יתנתק אוטומטית אחרי 30 דקות חוסר פעילות (אפשר לשנות) */}
          <AutoLogout minutes={30} />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
