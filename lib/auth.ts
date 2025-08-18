import { supabase } from "@/lib/supabaseClient";

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

type SignUpCustomerInput = {
  email: string;
  password: string;
  responsible_name: string;
  responsible_phone: string; // חובה
  institution_name: string;
  institution_address: string; // חובה
};

export async function signUpCustomer(input: SignUpCustomerInput) {
  const {
    email,
    password,
    responsible_name,
    responsible_phone,
    institution_name,
    institution_address,
  } = input;

  // ולידציה בסיסית בצד הלקוח
  for (const [label, val] of [
    ["שם אחראי", responsible_name],
    ["טלפון אחראי", responsible_phone],
    ["שם המוסד", institution_name],
    ["כתובת המוסד", institution_address],
  ] as const) {
    if (!val?.trim()) throw new Error(`שדה "${label}" הוא חובה`);
  }

  // ⬅️ שולחים הכל כ-metadata; הטריגר ב-DB ייצור/יעדכן את profiles
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "customer", // ודא שהערך קיים ב-enum user_role (או שנה לערך שקיים אצלך)
        full_name: responsible_name, // אופציונלי — לשדה הכללי
        responsible_name,
        responsible_phone,
        institution_name,
        institution_address,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
