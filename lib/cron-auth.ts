import { NextRequest } from "next/server";

// Cronルートの保護。Vercel Cron は CRON_SECRET を設定すると
// Authorization: Bearer <CRON_SECRET> を自動付与する。
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
