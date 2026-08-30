import { Dashboard } from "@/components/dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  const [{ data: resources }, { data: announcements }, { data: favorites }, { data: timetable }, { data: courses }] = await Promise.all([
    supabase.from("resources").select("*").eq("department", profile.department).eq("level", profile.level).order("created_at", { ascending: false }),
    supabase.from("announcements").select("*").eq("department", profile.department).eq("level", profile.level).order("created_at", { ascending: false }),
    supabase.from("favorites").select("resource_id").eq("user_id", user.id),
    supabase.from("timetable_entries").select("*").eq("department", profile.department).eq("level", profile.level).order("start_time"),
    supabase.from("courses").select("*").eq("department", profile.department).eq("level", profile.level).order("name"),
  ]);
  return <Dashboard profile={profile} initialResources={resources || []} initialAnnouncements={announcements || []} initialFavorites={(favorites || []).map((f: { resource_id: string }) => f.resource_id)} initialTimetable={timetable || []} initialCourses={courses || []}/>;
}
