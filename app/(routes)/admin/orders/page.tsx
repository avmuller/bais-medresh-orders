"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  user_id: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string;
};

type Product = {
  id: string;
  name: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  product: Product;
};

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);

      const { data: ordersData } = await supabase.from("orders").select("*");
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name");
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, product:products(name)");

      if (ordersData && profilesData && itemsData) {
        setOrders(ordersData);
        setProfiles(profilesData);
        setOrderItems(itemsData);
      }

      setLoading(false);
    };

    fetchOrders();
  }, []);

  const getUserName = (user_id: string) => {
    return profiles.find((p) => p.id === user_id)?.full_name || "לא ידוע";
  };

  const getItemsForOrder = (order_id: string) => {
    return orderItems.filter((item) => item.order_id === order_id);
  };

  if (loading) return <div className="p-4 text-center">טוען הזמנות...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">רשימת הזמנות</h1>

      {orders.length === 0 ? (
        <p className="text-center text-gray-500">אין הזמנות עדיין</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-md border p-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold">
                  {getUserName(order.user_id)}
                </h2>
                <p className="text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>

              <table className="w-full text-sm border-t mt-3">
                <thead>
                  <tr className="text-right text-gray-700">
                    <th className="py-2">מוצר</th>
                    <th className="py-2">כמות</th>
                  </tr>
                </thead>
                <tbody>
                  {getItemsForOrder(order.id).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="py-2">{item.product?.name}</td>
                      <td className="py-2">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
