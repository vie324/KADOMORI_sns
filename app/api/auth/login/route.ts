import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 初回トークン取得用: Threads の認可画面へリダイレクトする。
// ブラウザで /api/auth/login を開く → 認可 → /api/auth/callback に戻る。
// CSRF対策として state を発行し HttpOnly Cookie に保存する。
export async function GET() {
  const appId = process.env.THREADS_APP_ID;
  const redirectUri = process.env.THREADS_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "THREADS_APP_ID と THREADS_REDIRECT_URI を設定してください。" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "threads_basic,threads_content_publish",
    response_type: "code",
    state,
  });

  const res = NextResponse.redirect(
    `https://threads.net/oauth/authorize?${params.toString()}`
  );
  res.cookies.set("threads_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10分
  });
  return res;
}
