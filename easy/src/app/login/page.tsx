import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string; message?: string }> }) {
  const params = await searchParams;
  const successMessage = params.registered === "1"
    ? params.message || "Account created successfully. Sign in to continue."
    : "";
  return <AuthForm mode="login" successMessage={successMessage}/>;
}
