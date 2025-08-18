import "@/styles/globals.css";
import AutoLogout from "@/components/AutoLogout"; // ← חשוב: קיים כ־client component

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {/* יתנתק אוטומטית אחרי 30 דקות חוסר פעילות (אפשר לשנות) */}
        <AutoLogout minutes={30} />
        {children}
      </body>
    </html>
  );
}
