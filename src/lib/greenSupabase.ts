import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_GREEN_SUPABASE_URL as string;
const key = import.meta.env.VITE_GREEN_SUPABASE_ANON_KEY as string;

export const greenSupabase = createClient(url, key);
