import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase environment variables.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const removedCategories = ["Tutorials", "Projects", "Lab Manuals"];
const { data: allResources, error: readError } = await supabase.from("resources").select("id, storage_path, category");
if (readError) {
  console.error(`Unable to read resources: ${readError.message}`);
  process.exitCode = 1;
} else {
  const resources = (allResources || []).filter((resource) => removedCategories.includes(resource.category));
  const paths = resources.map((resource) => resource.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("resources").remove(paths);
    if (storageError) {
      console.error(`Unable to delete stored files: ${storageError.message}`);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode && resources.length) {
    const { error: deleteError } = await supabase.from("resources").delete().in("id", resources.map((resource) => resource.id));
    if (deleteError) {
      console.error(`Unable to delete resource records: ${deleteError.message}`);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log(`Deleted ${resources.length} removed-category resources and ${paths.length} stored files.`);
}
