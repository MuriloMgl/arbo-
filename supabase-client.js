const SUPABASE_URL      = window.ENV?.SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || "";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);