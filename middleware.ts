import { NextRequest, NextResponse } from "next/server";

// 管理画面（ページ）と管理用API（/api/posts, /api/generate, /api/auth/*）を
// Basic認証で保護する。Cron（/api/cron/*）は CRON_SECRET で別途保護されるため除外。
//
// ADMIN_USER / ADMIN_PASSWORD が設定されている場合のみ有効。
// 本番では必ず両方を設定すること（未設定だと管理画面が無防備になる）。
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  // 未設定なら素通し（ローカル開発向け。本番では必ず設定する）。
  if (!user || !pass) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      let decoded = "";
      try {
        decoded = atob(encoded);
      } catch {
        decoded = "";
      }
      const idx = decoded.indexOf(":");
      if (idx !== -1) {
        const u = decoded.slice(0, idx);
        const p = decoded.slice(idx + 1);
        if (u === user && p === pass) {
          return NextResponse.next();
        }
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"',
    },
  });
}

export const config = {
  // _next/static, _next/image, favicon.ico, /api/cron は除外。
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
