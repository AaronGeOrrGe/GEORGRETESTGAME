import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const valid = (code: string) => {
  const expected = process.env.COURSE_REP_ACCESS_CODE_HASH;
  if (!expected) return false;
  const actual = createHash("sha256").update(code).digest("hex");
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
};

export async function POST(request: Request) {
  const body = await request.json();
  const { fullName, studentId, department, level, email, password, role, accessCode } = body;
  const departments = ["Computer Science", "Information Technology", "Cyber Security"];
  const academicLevel = Number(level);

  // Server-side validation
  if (!fullName || !studentId || !email || !password || !["student", "course_rep"].includes(role) || !departments.includes(department) || ![100, 200, 300, 400].includes(academicLevel)) {
    return NextResponse.json({ error: "Complete all required fields." }, { status: 400 });
  }

  // Full name validation
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(fullName.trim())) {
    return NextResponse.json({ error: "Full name can only contain letters, spaces, hyphens, and apostrophes." }, { status: 400 });
  }
  if (fullName.trim().length < 2) {
    return NextResponse.json({ error: "Full name must be at least 2 characters." }, { status: 400 });
  }

  // Student ID validation
  const idRegex = /^\d{7,8}$/;
  if (!idRegex.test(studentId.trim())) {
    return NextResponse.json({ error: "Student ID must be exactly 7 or 8 digits." }, { status: 400 });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Password validation
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  if (role === "course_rep" && !valid(accessCode || "")) return NextResponse.json({ error: "Invalid Course Representative Access Code" }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const authClient = createClient(url, anon);
  const { data, error } = await authClient.auth.signUp({ email, password, options: { emailRedirectTo: `${new URL(request.url).origin}/auth/callback` } });
  if (error || !data.user) return NextResponse.json({ error: error?.message || "Account creation failed." }, { status: 400 });
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, full_name: fullName, student_id: studentId, email, role, department, level: academicLevel });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    const message = profileError.code === "23505"
      ? "That Student ID is already registered. Sign in or use your correct Student ID."
      : profileError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ message: data.session ? "Account created." : "Check your email to confirm your account." });
}
