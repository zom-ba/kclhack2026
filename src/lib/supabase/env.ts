function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} を .env.local に設定してください。`);
  }

  return value;
}

const supabaseUrl = requirePublicEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
const supabasePublishableKey = requirePublicEnv(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export { supabasePublishableKey, supabaseUrl };
