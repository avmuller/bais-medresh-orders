"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* =========================
   Types
========================= */
type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  supplier_id: string;
  image_url?: string | null;
};

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  slug?: string | null;
};

type Supplier = {
  id: string;
  name: string;
  email: string | null;
};

/* =========================
   Small UI helpers
========================= */
function Modal({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full md:max-w-xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full w-8 h-8 grid place-items-center hover:bg-gray-100"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/* ===== Helpers for category tree / display ===== */
function buildChildrenMap(categories: Category[]) {
  const byParent = new Map<string, Category[]>();
  for (const c of categories) {
    const key = c.parent_id || "__ROOT__";
    const arr = byParent.get(key) ?? [];
    arr.push(c);
    byParent.set(key, arr);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.name.localeCompare(b.name, "he"));
  }
  return byParent;
}

function categoryPath(catId: string | null, cats: Category[]): string {
  if (!catId) return "—";
  const byId = new Map(cats.map((c) => [c.id, c]));
  const names: string[] = [];
  let cur = byId.get(catId) || null;
  let guard = 0;
  while (cur && guard++ < 10) {
    names.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) || null : null;
  }
  return names.join(" > ") || "—";
}

/* =========================
   Page
========================= */
export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // product create form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [supplierId, setSupplierId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // supplier create form
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

  // category create form
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<string>(""); // "" = ללא הורה
  const [categorySlug, setCategorySlug] = useState("");

  // edit modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // edit product form
  const [editProdName, setEditProdName] = useState("");
  const [editProdPrice, setEditProdPrice] = useState("");
  const [editProdCategoryId, setEditProdCategoryId] = useState("");
  const [editProdSupplierId, setEditProdSupplierId] = useState("");
  const [editProdImageFile, setEditProdImageFile] = useState<File | null>(null);
  const [editProdImagePreview, setEditProdImagePreview] = useState<
    string | null
  >(null);
  const [editLoading, setEditLoading] = useState(false);

  // edit supplier form
  const [editSupName, setEditSupName] = useState("");
  const [editSupEmail, setEditSupEmail] = useState("");

  // edit category form
  const [editCatName, setEditCatName] = useState("");
  const [editCatParentId, setEditCatParentId] = useState<string>("");
  const [editCatSlug, setEditCatSlug] = useState<string>("");

  // Derived maps
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );
  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name] as const)),
    [suppliers]
  );
  const childrenMap = useMemo(() => buildChildrenMap(categories), [categories]);
  const rootCats = useMemo(
    () => (childrenMap.get("__ROOT__") ?? []).slice(),
    [childrenMap]
  );

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("id,name,parent_id,slug")
        .order("name");
      const { data: sups } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,price,category_id,supplier_id,image_url,created_at")
        .order("created_at", { ascending: false });

      setCategories((cats as Category[]) || []);
      setSuppliers((sups as Supplier[]) || []);
      setProducts((prods as Product[]) || []);
    };

    fetchData();
  }, []);

  const refreshProducts = async () => {
    const { data: prods } = await supabase
      .from("products")
      .select("id,name,price,category_id,supplier_id,image_url,created_at")
      .order("created_at", { ascending: false });
    setProducts((prods as Product[]) || []);
  };

  const refreshCategories = async () => {
    const { data: cats } = await supabase
      .from("categories")
      .select("id,name,parent_id,slug")
      .order("name");
    setCategories((cats as Category[]) || []);
  };

  const refreshSuppliers = async () => {
    const { data: sups } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");
    setSuppliers((sups as Supplier[]) || []);
  };

  const resetProductForm = () => {
    setName("");
    setPrice("");
    setCategoryId("");
    setSupplierId("");
    setImageFile(null);
    setImagePreview(null);
  };

  /* =========================
     Create Product
  ========================= */
  const handleAddProduct = async () => {
    if (!name || !price || !supplierId) {
      alert("נא למלא את כל השדות של המוצר (שם, מחיר, ספק)");
      return;
    }
    // category יכולה להיות ריקה (ללא קטגוריה)
    setLoading(true);

    let imageUrl: string | undefined;

    if (imageFile) {
      if (imageFile.size > 5 * 1024 * 1024) {
        alert("התמונה גדולה מדי (מעל 5MB)");
        setLoading(false);
        return;
      }
      const ext = imageFile.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile, { upsert: false });

      if (uploadError) {
        alert("שגיאה בהעלאת התמונה: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from("products").insert({
      name,
      price: parseFloat(price),
      category_id: categoryId || null,
      supplier_id: supplierId,
      image_url: imageUrl ?? null,
    });

    if (error) {
      alert("שגיאה בהוספת מוצר: " + error.message);
    } else {
      alert("✅ מוצר נוסף");
      resetProductForm();
      await refreshProducts();
    }

    setLoading(false);
  };

  /* =========================
     Create Supplier & Category
  ========================= */
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
      await refreshSuppliers();
    }
  };

  const handleAddCategory = async () => {
    if (!categoryName) {
      alert("נא להזין שם קטגוריה");
      return;
    }
    const payload: Partial<Category> = {
      name: categoryName,
      parent_id: categoryParentId || null,
      slug: categorySlug || null,
    };
    const { error } = await supabase.from("categories").insert(payload);
    if (error) {
      alert("שגיאה בהוספת קטגוריה: " + error.message);
    } else {
      alert("✅ קטגוריה נוספה");
      setCategoryName("");
      setCategoryParentId("");
      setCategorySlug("");
      await refreshCategories();
    }
  };

  /* =========================
     Delete
  ========================= */
  const handleDeleteProduct = async (id: string) => {
    if (!confirm("אתה בטוח שברצונך למחוק את המוצר?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      alert(
        "שגיאה במחיקת מוצר: " +
          (error.code === "23503"
            ? "לא ניתן למחוק מוצר שקשור להזמנות."
            : error.message)
      );
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("אתה בטוח שברצונך למחוק את הספק?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) {
      alert(
        "שגיאה במחיקת ספק: " +
          (error.code === "23503"
            ? "לא ניתן למחוק ספק שמקושר למוצרים."
            : error.message)
      );
    } else {
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("אתה בטוח שברצונך למחוק את הקטגוריה?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      alert(
        "שגיאה במחיקת קטגוריה: " +
          (error.code === "23503"
            ? "לא ניתן למחוק קטגוריה שמקושרת למוצרים או שיש לה תתי־קטגוריות."
            : error.message)
      );
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  /* =========================
     Open Edit Modals (prefill)
  ========================= */
  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditProdName(prod.name);
    setEditProdPrice(prod.price.toString());
    setEditProdCategoryId(prod.category_id || "");
    setEditProdSupplierId(prod.supplier_id);
    setEditProdImageFile(null);
    setEditProdImagePreview(prod.image_url || null);
  };

  const openEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setEditSupName(sup.name);
    setEditSupEmail(sup.email || "");
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatParentId(cat.parent_id || "");
    setEditCatSlug(cat.slug || "");
  };

  /* =========================
     Update actions
  ========================= */
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    if (!editProdName || !editProdPrice || !editProdSupplierId) {
      alert("נא למלא שם, מחיר וספק");
      return;
    }

    setEditLoading(true);

    let imageUrl: string | null | undefined = editingProduct.image_url ?? null;

    // Optional image replace
    if (editProdImageFile) {
      if (editProdImageFile.size > 5 * 1024 * 1024) {
        alert("התמונה גדולה מדי (מעל 5MB)");
        setEditLoading(false);
        return;
      }
      const ext = editProdImageFile.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, editProdImageFile, { upsert: false });
      if (uploadError) {
        alert("שגיאה בהעלאת התמונה: " + uploadError.message);
        setEditLoading(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: editProdName,
        price: parseFloat(editProdPrice),
        category_id: editProdCategoryId || null,
        supplier_id: editProdSupplierId,
        image_url: imageUrl ?? null,
      })
      .eq("id", editingProduct.id);

    if (error) {
      alert("שגיאה בעדכון מוצר: " + error.message);
    } else {
      alert("✅ המוצר עודכן");
      await refreshProducts();
      setEditingProduct(null);
    }

    setEditLoading(false);
  };

  const handleUpdateSupplier = async () => {
    if (!editingSupplier) return;
    if (!editSupName || !editSupEmail) {
      alert("נא למלא שם ואימייל");
      return;
    }
    const { error } = await supabase
      .from("suppliers")
      .update({ name: editSupName, email: editSupEmail })
      .eq("id", editingSupplier.id);

    if (error) {
      alert("שגיאה בעדכון ספק: " + error.message);
    } else {
      alert("✅ הספק עודכן");
      await refreshSuppliers();
      setEditingSupplier(null);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    if (!editCatName) {
      alert("נא להזין שם קטגוריה");
      return;
    }
    // לא לאפשר לשים הורה שהוא עצמו
    if (editCatParentId && editCatParentId === editingCategory.id) {
      alert("קטגוריה לא יכולה להיות הורה של עצמה");
      return;
    }
    const { error } = await supabase
      .from("categories")
      .update({
        name: editCatName,
        parent_id: editCatParentId || null,
        slug: editCatSlug || null,
      })
      .eq("id", editingCategory.id);

    if (error) {
      alert("שגיאה בעדכון קטגוריה: " + error.message);
    } else {
      alert("✅ הקטגוריה עודכנה");
      await refreshCategories();
      setEditingCategory(null);
    }
  };

  /* ======= UI ======= */
  // רשימת קטגוריות היררכית לתצוגה
  const CategoryTree = () => {
    const renderNode = (cat: Category, depth = 0) => {
      const padding = depth * 16; // px
      const children = childrenMap.get(cat.id) ?? [];
      return (
        <div
          key={cat.id}
          className="border p-3 rounded flex justify-between items-center"
        >
          <div style={{ paddingInlineStart: padding }}>
            <strong>{cat.name}</strong>{" "}
            <span className="text-xs text-gray-500">
              {cat.slug ? `• slug: ${cat.slug}` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openEditCategory(cat)}
              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              עדכן
            </button>
            <button
              onClick={() => handleDeleteCategory(cat.id)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              מחק
            </button>
          </div>
        </div>
      );
    };

    const out: React.ReactNode[] = [];
    for (const root of rootCats) {
      out.push(renderNode(root, 0));
      const queue = [...(childrenMap.get(root.id) ?? [])].map((c) => ({
        node: c,
        depth: 1,
      }));
      while (queue.length) {
        const { node, depth } = queue.shift()!;
        out.push(renderNode(node, depth));
        for (const ch of childrenMap.get(node.id) ?? []) {
          queue.push({ node: ch, depth: depth + 1 });
        }
      }
    }
    return <div className="space-y-2 mt-2">{out}</div>;
  };

  // אפשרויות קטגוריה לבחירה בטופסי מוצר — עם הזחה
  const CategorySelectOptions = () => {
    const options: React.ReactNode[] = [];
    const pushWithDepth = (cat: Category, depth: number) => {
      const prefix = " ".repeat(depth * 2) + (depth ? "▸ " : "");
      options.push(
        <option key={cat.id} value={cat.id}>
          {prefix}
          {cat.name}
        </option>
      );
      for (const ch of childrenMap.get(cat.id) ?? []) {
        pushWithDepth(ch, depth + 1);
      }
    };
    for (const root of rootCats) pushWithDepth(root, 0);
    return <>{options}</>;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10" dir="rtl">
      <h1 className="text-2xl font-bold text-center">
        ניהול מוצרים, ספקים וקטגוריות
      </h1>

      {/* Create Product */}
      <section>
        <h2 className="text-xl font-semibold mb-3">הוספת מוצר חדש</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Field label="שם המוצר" required>
            <input
              type="text"
              className="border p-2 rounded w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="מחיר" required>
            <input
              type="number"
              className="border p-2 rounded w-full"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>

          <Field label="קטגוריה (אפשרי ללא)">
            <select
              className="border p-2 rounded w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">ללא קטגוריה</option>
              <CategorySelectOptions />
            </select>
          </Field>

          <Field label="ספק" required>
            <select
              className="border p-2 rounded w-full"
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
          </Field>

          <Field label="תמונה (אופציונלי)">
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                className="border p-2 rounded w-full"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setImageFile(f);
                  setImagePreview(f ? URL.createObjectURL(f) : null);
                }}
              />
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="תצוגה מקדימה"
                  className="w-40 h-40 object-cover rounded border"
                />
              )}
            </div>
          </Field>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleAddProduct}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "מוסיף..." : "הוסף מוצר"}
          </button>
          <button
            onClick={resetProductForm}
            className="px-4 py-2 border rounded hover:bg-gray-50"
            disabled={loading}
          >
            איפוס
          </button>
        </div>
      </section>

      {/* Products Table */}
      <section>
        <h2 className="text-xl font-semibold mb-2">מוצרים קיימים</h2>
        {products.length === 0 ? (
          <p className="text-gray-500">אין מוצרים עדיין.</p>
        ) : (
          <ul className="space-y-2 mt-2">
            {products.map((prod) => (
              <li
                key={prod.id}
                className="border p-3 rounded flex items-center gap-4"
              >
                {prod.image_url ? (
                  <img
                    src={prod.image_url}
                    alt={prod.name}
                    className="w-16 h-16 object-cover rounded border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded border grid place-items-center text-xs text-gray-400">
                    ללא תמונה
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{prod.name}</div>
                  <div className="text-sm text-gray-600">
                    {prod.price} ₪ • קטגוריה:{" "}
                    {categoryPath(prod.category_id, categories)} • ספק:{" "}
                    {supplierMap[prod.supplier_id] || "—"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditProduct(prod)}
                    className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    עדכן
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(prod.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    מחק
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="my-8" />

      {/* Supplier create + list */}
      <section>
        <h2 className="text-xl font-semibold mb-2">הוספת ספק חדש</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="שם הספק" required>
            <input
              type="text"
              className="border p-2 rounded"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </Field>
          <Field label="אימייל הספק" required>
            <input
              type="email"
              className="border p-2 rounded"
              value={supplierEmail}
              onChange={(e) => setSupplierEmail(e.target.value)}
            />
          </Field>
        </div>
        <button
          onClick={handleAddSupplier}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          הוסף ספק
        </button>

        <h3 className="text-lg font-semibold mt-6">ספקים קיימים</h3>
        {suppliers.length === 0 ? (
          <p className="text-gray-500">אין ספקים עדיין.</p>
        ) : (
          <ul className="space-y-2 mt-2">
            {suppliers.map((sup) => (
              <li
                key={sup.id}
                className="border p-3 rounded flex justify-between items-center"
              >
                <div className="min-w-0">
                  <strong className="truncate">{sup.name}</strong> – {sup.email}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditSupplier(sup)}
                    className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    עדכן
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(sup.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    מחק
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="my-8" />

      {/* Category create + list */}
      <section>
        <h2 className="text-xl font-semibold mb-2">הוספת קטגוריה חדשה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="שם הקטגוריה" required>
            <input
              type="text"
              className="border p-2 rounded"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </Field>
          <Field label="קטגורית־אם (אופציונלי)">
            <select
              className="border p-2 rounded w-full"
              value={categoryParentId}
              onChange={(e) => setCategoryParentId(e.target.value)}
            >
              <option value="">— ללא —</option>
              {rootCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {/* אם תרצה לאפשר לבחור גם תתי־קטגוריות כהורה (להעמקה), אפשר למפות את כולן כאן */}
            </select>
          </Field>
          <Field label="Slug (אופציונלי)">
            <input
              type="text"
              className="border p-2 rounded"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              placeholder="latin-letters-and-dashes"
            />
          </Field>
        </div>
        <button
          onClick={handleAddCategory}
          className="mt-4 px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          הוסף קטגוריה
        </button>

        <h3 className="text-lg font-semibold mt-6">קטגוריות קיימות</h3>
        {categories.length === 0 ? (
          <p className="text-gray-500">אין קטגוריות עדיין.</p>
        ) : (
          <CategoryTree />
        )}
      </section>

      {/* =========================
          Edit Product Modal
      ========================= */}
      <Modal
        title="עדכון מוצר"
        open={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        footer={
          <>
            <button
              onClick={() => setEditingProduct(null)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
              disabled={editLoading}
            >
              ביטול
            </button>
            <button
              onClick={handleUpdateProduct}
              className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              disabled={editLoading}
            >
              {editLoading ? "שומר..." : "שמור"}
            </button>
          </>
        }
      >
        <Field label="שם מוצר" required>
          <input
            type="text"
            className="border p-2 rounded w-full"
            value={editProdName}
            onChange={(e) => setEditProdName(e.target.value)}
          />
        </Field>

        <Field label="מחיר" required>
          <input
            type="number"
            className="border p-2 rounded w-full"
            value={editProdPrice}
            onChange={(e) => setEditProdPrice(e.target.value)}
          />
        </Field>

        <Field label="קטגוריה (אפשרי ללא)">
          <select
            className="border p-2 rounded w-full"
            value={editProdCategoryId}
            onChange={(e) => setEditProdCategoryId(e.target.value)}
          >
            <option value="">ללא קטגוריה</option>
            <CategorySelectOptions />
          </select>
        </Field>

        <Field label="ספק" required>
          <select
            className="border p-2 rounded w-full"
            value={editProdSupplierId}
            onChange={(e) => setEditProdSupplierId(e.target.value)}
          >
            <option value="">בחר ספק</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="החלפת תמונה (אופציונלי)">
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              className="border p-2 rounded w-full"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setEditProdImageFile(f);
                setEditProdImagePreview(
                  f ? URL.createObjectURL(f) : editingProduct?.image_url || null
                );
              }}
            />
            {editProdImagePreview && (
              <img
                src={editProdImagePreview}
                alt="תצוגה מקדימה"
                className="w-40 h-40 object-cover rounded border"
              />
            )}
          </div>
        </Field>
      </Modal>

      {/* =========================
          Edit Supplier Modal
      ========================= */}
      <Modal
        title="עדכון ספק"
        open={!!editingSupplier}
        onClose={() => setEditingSupplier(null)}
        footer={
          <>
            <button
              onClick={() => setEditingSupplier(null)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              onClick={handleUpdateSupplier}
              className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              שמור
            </button>
          </>
        }
      >
        <Field label="שם ספק" required>
          <input
            type="text"
            className="border p-2 rounded w-full"
            value={editSupName}
            onChange={(e) => setEditSupName(e.target.value)}
          />
        </Field>

        <Field label="אימייל ספק" required>
          <input
            type="email"
            className="border p-2 rounded w-full"
            value={editSupEmail}
            onChange={(e) => setEditSupEmail(e.target.value)}
          />
        </Field>
      </Modal>

      {/* =========================
          Edit Category Modal
      ========================= */}
      <Modal
        title="עדכון קטגוריה"
        open={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        footer={
          <>
            <button
              onClick={() => setEditingCategory(null)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              onClick={handleUpdateCategory}
              className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              שמור
            </button>
          </>
        }
      >
        <Field label="שם קטגוריה" required>
          <input
            type="text"
            className="border p-2 rounded w-full"
            value={editCatName}
            onChange={(e) => setEditCatName(e.target.value)}
          />
        </Field>
        <Field label="קטגורית־אם (אופציונלי)">
          <select
            className="border p-2 rounded w-full"
            value={editCatParentId}
            onChange={(e) => setEditCatParentId(e.target.value)}
          >
            <option value="">— ללא —</option>
            {rootCats
              .filter((c) => c.id !== editingCategory?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Slug (אופציונלי)">
          <input
            type="text"
            className="border p-2 rounded w-full"
            value={editCatSlug}
            onChange={(e) => setEditCatSlug(e.target.value)}
            placeholder="latin-letters-and-dashes"
          />
        </Field>
      </Modal>
    </div>
  );
}
