import { supabase } from "./supabaseClient";

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: string = "gabai"
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;

  const user = data.user;

  if (user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      role,
    });

    if (profileError) {
      console.error("שגיאה בהכנסת פרופיל:", profileError.message);
      throw profileError; // ⛔ חשוב! לא ממשיך אם הפרופיל לא נוצר
    }
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
