export type Role = "student" | "course_rep";
export type Category = "Lecture Notes" | "Past Questions" | "Assignments";
export type TimetableKind = "class" | "exam";
export interface TimetableEntry { id: string; kind: TimetableKind; course_code: string; course_name: string; department: string; level: AcademicLevel; day_of_week: number | null; exam_date: string | null; start_time: string; end_time: string; venue: string; lecturer: string; created_by: string; created_at: string }
export type AcademicLevel = 100 | 200 | 300 | 400;
export interface Profile { id: string; full_name: string; student_id: string; email: string; role: Role; department: string; level: AcademicLevel; created_at: string }
export interface Course { id: string; code: string; name: string; department: string; level: AcademicLevel; created_by: string | null; created_at: string }
export interface Resource { id: string; title: string; description: string; course_id: string | null; course_code: string; course_name: string; department: string; level: AcademicLevel; category: Category; file_url: string; storage_path: string; file_size: number; downloads: number; uploaded_by: string; created_at: string }
export interface Announcement { id: string; title: string; message: string; department: string; level: AcademicLevel; created_by: string; created_at: string }
