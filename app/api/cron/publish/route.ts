import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isCronAuthorized } from "@/lib/cron-auth";
import { publishToThreads } from "@/lib/threads";
import { Post, ThreadsToken } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ★Cron: approved かつ ng_flagged=false の最古を1件投稿する。
// JST 8:00 / 19:00（UTC 23:00 / 10:00）に実行される想定。
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // 投稿対象を1件取得（最古優先）
  const { data: posts, error: selErr } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "approved")
    .eq("ng_flagged", false)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selErr) {
    console.error("[cron/publish] select error", selErr);
    return NextResponse.json({ error: String(selErr) }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ msg: "no post" });
  }

  const post = posts[0] as Post;

  // トークン取得
  const { data: tokenRow, error: tokErr } = await supabase
    .from("threads_token")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (tokErr || !tokenRow) {
    console.error("[cron/publish] token missing", tokErr);
    return NextResponse.json(
      { error: "threads_token が未登録です。OAuthで初期登録してください。" },
      { status: 500 }
    );
  }

  const token = tokenRow as ThreadsToken;

  try {
    const threadId = await publishToThreads(
      token.user_id,
      token.access_token,
      post.body,
      post.image_url ?? undefined
    );

    const { error: updErr } = await supabase
      .from("posts")
      .update({
        status: "published",
        thread_id: threadId,
        published_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, id: post.id, thread_id: threadId });
  } catch (e) {
    console.error("[cron/publish] publish failed", e);
    await supabase
      .from("posts")
      .update({ status: "failed" })
      .eq("id", post.id);
    return NextResponse.json(
      { error: String(e), id: post.id },
      { status: 500 }
    );
  }
}
