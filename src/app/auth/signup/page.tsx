import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "../actions";

export default async function SignupPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(user)redirect("/dashboard");return <AuthForm mode="signup" action={signUp}/>;}
