import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const destination = new URL("/", requestUrl.origin);

  if (!code) {
    destination.searchParams.set("auth", "missing-code");
    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  destination.searchParams.set("auth", error ? "error" : "confirmed");
  return NextResponse.redirect(destination);
}
