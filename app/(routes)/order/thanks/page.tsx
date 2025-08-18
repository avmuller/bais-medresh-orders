// app/(routes)/order/thanks/page.tsx
export const dynamic = "force-dynamic"; // שלא ינסו לעשות SSG

import ThankYouClient from "./ThankYouClient";

export default function Page({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order ?? null;
  return <ThankYouClient orderId={orderId} />;
}
