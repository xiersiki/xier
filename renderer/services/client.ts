import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://hxpjokwqabfuzjyzwrgg.supabase.co";
const supabaseKey = (import.meta.env as any).VITE_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;
