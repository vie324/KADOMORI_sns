import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from "@/lib/threads";

export const dynamic = "force-dynamic";

// 一回限りのトークン保存ルート。
// 認可コードを受け取り → 短命トークン → long-lived（60日）に交換 →
// threads_token（id=1）に upsert する。
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json(
      { error: "code がありません。" },
      { status: 400 }
    );
  }

  // CSRF対策: /api/auth/login が発行した state Cookie と一致するか検証。
  const cookieState = req.cookies.get("threads_oauth_state")?.value;
  if (!cookieState || !state || cookieState !== state) {
    return NextResponse.json(
      {
        error:
          "state が一致しません（CSRF保護）。/api/auth/login からやり直してください。",
      },
      { status: 400 }
    );
  }

  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = process.env.THREADS_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Threads の環境変数が未設定です。" },
      { status: 500 }
    );
  }

  try {
    // 認可コード → 短命トークン（+ user_id）
    const short = await exchangeCodeForToken(
      code,
      appId,
      appSecret,
      redirectUri
    );

    // 短命 → long-lived（60日）
    const long = await exchangeForLongLivedToken(short.access_token, appSecret);
    const expiresAt = new Date(
      Date.now() + long.expires_in * 1000
    ).toISOString();

    const supabase = getSupabaseAdmin();
    const { error: upErr } = await supabase.from("threads_token").upsert(
      {
        id: 1,
        access_token: long.access_token,
        user_id: short.user_id,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (upErr) throw upErr;

    const res = NextResponse.json({
      ok: true,
      user_id: short.user_id,
      expires_at: expiresAt,
      msg: "threads_token を保存しました。これで自動投稿が可能です。",
    });
    // 使い終わった state Cookie を破棄。
    res.cookies.set("threads_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
