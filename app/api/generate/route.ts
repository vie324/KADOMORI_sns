import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePosts } from "@/lib/anthropic";
import { validatePost, MAX_LENGTH } from "@/lib/validate";
import { getTheme } from "@/lib/themes";

export const dynamic = "force-dynamic";
// 生成に時間がかかるため上限を引き上げる（Vercel Pro 以上で有効）。
export const maxDuration = 300;

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

// POST /api/generate  body: { themes: string[], count, min, max }
// 各テーマについて Claude で count 本生成し、status='draft' で一括INSERT。
// NGワード or 文字数超過は ng_flagged=true で保存。
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const themesRaw = (payload as { themes?: unknown }).themes;

    if (!Array.isArray(themesRaw) || themesRaw.length === 0) {
      return NextResponse.json(
        { error: "themes（配列）を1つ以上指定してください。" },
        { status: 400 }
      );
    }

    // 既知のテーマ番号のみ許可
    const themes = Array.from(
      new Set(themesRaw.map((t) => String(t)))
    ).filter((t) => getTheme(t));

    if (themes.length === 0) {
      return NextResponse.json(
        { error: "有効なテーマ番号がありません。" },
        { status: 400 }
      );
    }

    const count = clampInt((payload as { count?: unknown }).count, 3, 1, 10);
    const min = clampInt((payload as { min?: unknown }).min, 120, 1, MAX_LENGTH);
    const max = clampInt(
      (payload as { max?: unknown }).max,
      300,
      min,
      MAX_LENGTH
    );

    const supabase = getSupabaseAdmin();

    type Row = {
      theme: string;
      body: string;
      status: "draft";
      ng_flagged: boolean;
    };
    const rows: Row[] = [];
    const errors: { theme: string; error: string }[] = [];

    for (const theme of themes) {
      try {
        const generated = await generatePosts(theme, count, min, max);
        for (const g of generated) {
          const { ngFlagged } = validatePost(g.body);
          rows.push({
            theme,
            body: g.body,
            status: "draft",
            ng_flagged: ngFlagged,
          });
        }
      } catch (e) {
        errors.push({ theme, error: String(e) });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("posts").insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ inserted: rows.length, errors });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
