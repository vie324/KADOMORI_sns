import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isCronAuthorized } from "@/lib/cron-auth";
import { refreshAccessToken } from "@/lib/threads";
import { ThreadsToken } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ★Cron: long-lived トークンを延命する（週1）。
// これが無いと60日後に投稿が静かに止まる。
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: tokenRow, error: tokErr } = await supabase
    .from("threads_token")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (tokErr || !tokenRow) {
    console.error("[cron/refresh-token] token missing", tokErr);
    return NextResponse.json(
      { error: "threads_token が未登録です。" },
      { status: 500 }
    );
  }

  const token = tokenRow as ThreadsToken;

  try {
    const refreshed = await refreshAccessToken(token.access_token);
    const expiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    const { error: updErr } = await supabase
      .from("threads_token")
      .update({
        access_token: refreshed.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, expires_at: expiresAt });
  } catch (e) {
    console.error("[cron/refresh-token] refresh failed", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
