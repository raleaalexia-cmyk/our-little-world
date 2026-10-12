// Public frontend configuration. Emails identify the two pre-created Supabase Auth users.
// Never put either password or a service_role key in this file.
window.APP_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_PROJECT_URL",
  supabaseAnonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
  alexiaEmail: "ALEXIA_AUTH_EMAIL",
  dyanEmail: "DYAN_AUTH_EMAIL"
};
