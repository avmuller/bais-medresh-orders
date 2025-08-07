"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string;
  supplier_id: string;
};

type Category = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
  email: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // product form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [loading, setLoading] = useState(false);

  // supplier form
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

  // category form
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from("categories").select("*");
      const { data: sups } = await supabase.from("suppliers").select("*");
      const { data: prods } = await supabase.from("products").select("*");

      setCategories(cats || []);
      setSuppliers(sups || []);
      setProducts(prods || []);
    };

    fetchData();
  }, []);

  const handleAddProduct = async () => {
    if (!name || !price || !categoryId || !supplierId) {
      alert("נא למלא את כל השדות של המוצר");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("products").insert({
      name,
      price: parseFloat(price),
      category_id: categoryId,
      supplier_id: supplierId,
    });

    if (error) {
      alert("שגיאה בהוספת מוצר: " + error.message);
    } else {
      alert("✅ מוצר נוסף");
      setName("");
      setPrice("");
      setCategoryId("");
      setSupplierId("");
      const { data: updated } = await supabase.from("products").select("*");
      setProducts(updated || []);
    }

    setLoading(false);
  };

  const handleAddSupplier = async () => {
    if (!supplierName || !supplierEmail) {
      alert("נא למלא את כל השדות של הספק");
      return;
    }

    const { error } = await supabase.from("suppliers").insert({
      name: supplierName,
      email: supplierEmail,
    });

    if (error) {
      alert("שגיאה בהוספת ספק: " + error.message);
    } else {
      alert("✅ ספק נוסף");
      setSupplierName("");
      setSupplierEmail("");
      const { data: updated } = await supabase.from("suppliers").select("*");
      setSuppliers(updated || []);
    }
  };

  const handleAddCategory = async () => {
    if (!categoryName) {
      alert("נא להזין שם קטגוריה");
      return;
    }

    const { error } = await supabase
      .from("categories")
      .insert({ name: categoryName });

    if (error) {
      alert("שגיאה בהוספת קטגוריה: " + error.message);
    } else {
      alert("✅ קטגוריה נוספה");
      setCategoryName("");
      const { data: updated } = await supabase.from("categories").select("*");
      setCategories(updated || []);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-center">ניהול מוצרים וספקים</h1>

      {/* טופס מוצר */}
      <div>
        <h2 className="text-xl font-semibold mb-2">הוספת מוצר חדש</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="שם המוצר"
            className="border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            placeholder="מחיר"
            className="border p-2 rounded"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <select
            className="border p-2 rounded"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">בחר קטגוריה</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            className="border p-2 rounded"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">בחר ספק</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAddProduct}
          className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={loading}
        >
          {loading ? "מוסיף..." : "הוסף מוצר"}
        </button>
      </div>

      {/* טבלת מוצרים */}
      <div>
        <h2 className="text-xl font-semibold">מוצרים קיימים</h2>
        <ul className="space-y-2 mt-2">
          {products.map((prod) => (
            <li key={prod.id} className="border p-3 rounded">
              <strong>{prod.name}</strong> – {prod.price} ₪
            </li>
          ))}
        </ul>
      </div>

      <hr className="my-6" />

      {/* טופס ספק */}
      <div>
        <h2 className="text-xl font-semibold mb-2">הוספת ספק חדש</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="שם הספק"
            className="border p-2 rounded"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
          <input
            type="email"
            placeholder="אימייל הספק"
            className="border p-2 rounded"
            value={supplierEmail}
            onChange={(e) => setSupplierEmail(e.target.value)}
          />
        </div>

        <button
          onClick={handleAddSupplier}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          הוסף ספק
        </button>
      </div>

      {/* טבלת ספקים */}
      <div>
        <h2 className="text-xl font-semibold mt-6">ספקים קיימים</h2>
        <ul className="space-y-2 mt-2">
          {suppliers.map((sup) => (
            <li key={sup.id} className="border p-3 rounded">
              <strong>{sup.name}</strong> – {sup.email}
            </li>
          ))}
        </ul>
      </div>

      <hr className="my-6" />

      {/* טופס קטגוריה */}
      <div>
        <h2 className="text-xl font-semibold mb-2">הוספת קטגוריה חדשה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="שם הקטגוריה"
            className="border p-2 rounded"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
        </div>

        <button
          onClick={handleAddCategory}
          className="mt-4 px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          הוסף קטגוריה
        </button>
      </div>

      {/* טבלת קטגוריות */}
      <div>
        <h2 className="text-xl font-semibold mt-6">קטגוריות קיימות</h2>
        <ul className="space-y-2 mt-2">
          {categories.map((cat) => (
            <li key={cat.id} className="border p-3 rounded">
              <strong>{cat.name}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
