"use client";

import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode, successMessage = "" }: { mode: "login" | "signup" | "forgot" | "update"; successMessage?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const [role, setRole] = useState("student");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = new FormData(e.currentTarget); const email = String(form.get("email") || ""); const password = String(form.get("password") || "");
    try {
      if (mode === "login") {
        const { error } = await createClient().auth.signInWithPassword({ email, password });
        if (error) throw error; router.push("/dashboard"); router.refresh();
      } else if (mode === "signup") {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: form.get("fullName"), studentId: form.get("studentId"), department: form.get("department"), level: form.get("level"), email, password, role, accessCode: form.get("accessCode") }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        router.push(`/login?registered=1&message=${encodeURIComponent(result.message)}`);
      } else if (mode === "forgot") {
        const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/update-password` }); if (error) throw error; setMessage("Check your email for a password reset link.");
      } else {
        const { error } = await createClient().auth.updateUser({ password }); if (error) throw error; setMessage("Password updated."); setTimeout(() => router.push("/dashboard"), 700);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); } finally { setLoading(false); }
  }
  const title = { login: "Welcome back", signup: "Create your Easy account", forgot: "Reset your password", update: "Choose a new password" }[mode];
  const subtitle = { login: "Sign in to access your academic resources.", signup: "Everything for your courses, in one place.", forgot: "We’ll email you a secure reset link.", update: "Use at least 8 characters." }[mode];
  return <main className="auth-shell"><section className="auth-showcase"><Link href="/" className="auth-brand"><span><BookOpen size={22}/></span>Easy</Link><div><p className="auth-kicker">YOUR ACADEMIC HUB</p><h1>Study smarter.<br/><em>Find it faster.</em></h1><p>Course notes, past questions, assignments, and announcements—organized for you.</p></div><div className="showcase-card"><div className="showcase-icon"><BookOpen size={22}/></div><div><b>Resources that stay organized</b><small>Search by course, category, or title.</small></div></div></section><section className="auth-panel"><div className="auth-card">{mode !== "login" && <Link href="/login" className="back"><ArrowLeft size={16}/> Back to sign in</Link>}<h2>{title}</h2><p>{subtitle}</p><form onSubmit={submit}>{mode === "signup" && <><div className="role-picker"><button type="button" className={role === "student" ? "selected" : ""} onClick={() => setRole("student")}>Student</button><button type="button" className={role === "course_rep" ? "selected" : ""} onClick={() => setRole("course_rep")}>Course Representative</button></div><label>Full name<input name="fullName" required placeholder="As shown on your student ID"/></label><div className="form-row"><label>Student ID<input name="studentId" required placeholder="e.g. 8988923"/></label><label>Department<select name="department" required defaultValue=""><option value="" disabled>Select department</option><option>Computer Science</option><option>Information Technology</option><option>Cyber Security</option></select></label><label>Level<select name="level" required defaultValue=""><option value="" disabled>Select level</option><option value="100">Level 100</option><option value="200">Level 200</option><option value="300">Level 300</option><option value="400">Level 400</option></select></label></div></>} {mode !== "update" && <label>Email address<input name="email" type="email" required placeholder="you@example.com"/></label>}{mode !== "forgot" && <label>Password<div className="password"><input name="password" type={show ? "text" : "password"} minLength={8} required placeholder="At least 8 characters"/><button type="button" onClick={() => setShow(!show)} aria-label="Toggle password">{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>}{mode === "signup" && role === "course_rep" && <label>Course Representative Access Code<input name="accessCode" type="password" required placeholder="Enter access code"/></label>}{error && <p className="form-alert error">{error}</p>}{(message || successMessage) && <p className="form-alert success">{message || successMessage}</p>}<button className="submit" disabled={loading}>{loading && <Loader2 className="spin" size={17}/>}{{ login: "Sign in", signup: "Create account", forgot: "Send reset link", update: "Set new password" }[mode]}</button></form>{mode === "login" && <><Link className="forgot" href="/forgot-password">Forgot password?</Link><p className="switch">New to Easy? <Link href="/signup">Create an account</Link></p></>}{mode === "signup" && <p className="switch">Already have an account? <Link href="/login">Sign in</Link></p>}</div></section></main>;
}
