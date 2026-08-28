import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";

export default async function UpdatePasswordPage() {
  // A valid recovery session is required to reach this form (created by exchanging the reset
  // link's code in /auth/callback). Without it, updateUser() below would fail with an opaque
  // Supabase error instead of telling the visitor their link expired.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/forgot-password");
  return <AuthForm mode="update" action={updatePassword} />;
}
