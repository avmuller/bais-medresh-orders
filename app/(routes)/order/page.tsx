"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";

type Category = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category_id: number;
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export default function OrderPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("*");
      const { data: productsData } = await supabase
        .from("products")
        .select("*");

      setCategories(categoriesData || []);
      setProducts(productsData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const addToCart = (product: Product) => {
    const qty = quantities[product.id] || 1;

    if (qty < 1) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      } else {
        return [...prev, { ...product, quantity: qty }];
      }
    });

    // אפס כמות אחרי הוספה
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
  };

  const updateCartQuantity = (productId: number, change: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      alert("העגלה ריקה!");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      alert("יש להתחבר כדי לבצע הזמנה");
      setSubmitting(false);
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (orderError) {
      alert("שגיאה ביצירת הזמנה: " + orderError.message);
      setSubmitting(false);
      return;
    }

    const orderId = orderData.id;

    const itemsToInsert = cart.map((item) => ({
      order_id: orderId,
      product_id: item.id,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      alert("שגיאה בהוספת פריטים להזמנה: " + itemsError.message);
    } else {
      alert("✅ ההזמנה בוצעה בהצלחה!");
      setCart([]);
    }

    setSubmitting(false);
  };

  if (loading) return <div className="p-6 text-center">טוען מוצרים...</div>;

  return (
    <ProtectedRoute>
      <div className="p-4 space-y-6">
        {/* התנתקות */}
        <div className="flex justify-end">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="text-sm text-red-600 underline"
          >
            התנתקות
          </button>
        </div>

        <h1 className="text-3xl font-bold text-center">הזמנת מוצרים</h1>

        {/* מוצרים לפי קטגוריות */}
        {categories.map((category) => (
          <div key={category.id}>
            <h2 className="text-xl font-semibold border-b pb-1 mb-3">
              {category.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products
                .filter((p) => p.category_id === category.id)
                .map((product) => (
                  <div
                    key={product.id}
                    className="border rounded-xl p-4 shadow-md flex flex-col justify-between"
                  >
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      מחיר: {product.price} ₪
                    </p>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={quantities[product.id] || 1}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-16 border rounded px-2 py-1 text-center"
                      />
                      <button
                        onClick={() => addToCart(product)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        הוסף
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {/* עגלה */}
        <div className="mt-10 border-t pt-6">
          <h2 className="text-2xl font-bold mb-4">העגלה שלי</h2>

          {cart.length === 0 ? (
            <p className="text-gray-500">העגלה ריקה</p>
          ) : (
            <table className="w-full text-right border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">מוצר</th>
                  <th className="p-2">כמות</th>
                  <th className="p-2">סה"כ</th>
                  <th className="p-2">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.price * item.quantity} ₪</td>
                    <td className="p-2 space-x-2">
                      <button
                        onClick={() => updateCartQuantity(item.id, 1)}
                        className="px-2 py-1 bg-green-500 text-white rounded"
                      >
                        +
                      </button>
                      <button
                        onClick={() => updateCartQuantity(item.id, -1)}
                        className="px-2 py-1 bg-red-500 text-white rounded"
                      >
                        -
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {cart.length > 0 && (
            <div className="text-center mt-6">
              <button
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={handleCreateOrder}
                disabled={submitting}
              >
                {submitting ? "שולח..." : "סיום הזמנה"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
