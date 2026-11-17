import { createClient } from "@supabase/supabase-js";

// Vite exposes any variable in .env.local that starts with VITE_ on
// import.meta.env. We never import the file itself, and we never use the
// service_role key here -- the anon key is the only one safe in browser code.
const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !supabaseAnonKey && "VITE_SUPABASE_ANON_KEY",
  ]
    .filter(Boolean)
    .join(", ");

  throw new Error(
    `Missing Supabase environment variable(s): ${missing}. ` +
      `Add them to .env.local in the project root and restart "npm run dev" ` +
      `(Vite only reads env files at startup).`,
  );
}

// One client for the whole app. Importing this module more than once still
// gives you this same instance, which is what Supabase expects.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
