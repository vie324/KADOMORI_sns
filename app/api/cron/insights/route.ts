import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fetchInsights } from "@/lib/threads";
import { Post, ThreadsToken } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ★Cron（任意）: published の投稿の反応データを取得して post_insights に蓄積する。
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
    return NextResponse.json(
      { error: "threads_token が未登録です。" },
      { status: 500 }
    );
  }
  const token = tokenRow as ThreadsToken;

  // thread_id を持つ published 投稿を対象に取得。
  const { data: posts, error: selErr } = await supabase
    .from("posts")
    .select("id,thread_id")
    .eq("status", "published")
    .not("thread_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);

  if (selErr) {
    return NextResponse.json({ error: String(selErr) }, { status: 500 });
  }

  const rows: {
    post_id: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
  }[] = [];
  const errors: { post_id: string; error: string }[] = [];

  for (const p of (posts ?? []) as Pick<Post, "id" | "thread_id">[]) {
    if (!p.thread_id) continue;
    try {
      const ins = await fetchInsights(p.thread_id, token.access_token);
      rows.push({ post_id: p.id, ...ins });
    } catch (e) {
      errors.push({ post_id: p.id, error: String(e) });
    }
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("post_insights").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: String(insErr) }, { status: 500 });
    }
  }

  return NextResponse.json({ fetched: rows.length, errors });
}
