"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      alert("שגיאה בטעינת משתמשים: " + error.message);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המשתמש הזה?")) return;

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      alert("שגיאה במחיקה: " + error.message);
    } else {
      alert("✅ המשתמש נמחק");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">רשימת משתמשים</h1>

      {loading ? (
        <p className="text-center">טוען משתמשים...</p>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-500">אין משתמשים במערכת</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">שם מלא</th>
              <th className="border p-2">תפקיד</th>
              <th className="border p-2">מחיקה</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="border p-2">{user.full_name}</td>
                <td className="border p-2">{user.role}</td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                  >
                    מחק
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
