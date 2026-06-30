import { getSupabaseAdmin } from "@/lib/supabase";
import { THEMES, themeName } from "@/lib/themes";
import { Post, PostInsight } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ThemeAgg {
  theme: string;
  posts: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
}

async function aggregate(): Promise<{ rows: ThemeAgg[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: posts, error: pErr } = await supabase
      .from("posts")
      .select("id,theme")
      .eq("status", "published");
    if (pErr) throw pErr;

    const { data: insights, error: iErr } = await supabase
      .from("post_insights")
      .select("*")
      .order("fetched_at", { ascending: false });
    if (iErr) throw iErr;

    // 投稿ごとに最新のインサイトを採用
    const latestByPost = new Map<string, PostInsight>();
    for (const ins of (insights ?? []) as PostInsight[]) {
      if (!latestByPost.has(ins.post_id)) latestByPost.set(ins.post_id, ins);
    }

    // テーマ別に集計
    const acc = new Map<
      string,
      { posts: number; views: number; likes: number; replies: number }
    >();
    for (const p of (posts ?? []) as Pick<Post, "id" | "theme">[]) {
      const theme = p.theme ?? "—";
      const ins = latestByPost.get(p.id);
      if (!ins) continue;
      const cur = acc.get(theme) ?? {
        posts: 0,
        views: 0,
        likes: 0,
        replies: 0,
      };
      cur.posts += 1;
      cur.views += ins.views ?? 0;
      cur.likes += ins.likes ?? 0;
      cur.replies += ins.replies ?? 0;
      acc.set(theme, cur);
    }

    const order = THEMES.map((t) => t.number);
    const rows: ThemeAgg[] = Array.from(acc.entries())
      .map(([theme, v]) => ({
        theme,
        posts: v.posts,
        avgViews: v.posts ? Math.round(v.views / v.posts) : 0,
        avgLikes: v.posts ? Math.round((v.likes / v.posts) * 10) / 10 : 0,
        avgReplies: v.posts ? Math.round((v.replies / v.posts) * 10) / 10 : 0,
      }))
      .sort((a, b) => order.indexOf(a.theme) - order.indexOf(b.theme));

    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: String(e) };
  }
}

export default async function InsightsPage() {
  const { rows, error } = await aggregate();

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">反応データ（テーマ別平均）</h1>

      {error && (
        <p className="text-sm text-red-600 break-all mb-3">
          データ取得エラー: {error}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="text-sm text-gray-500">
          まだ集計できる反応データがありません。投稿が公開され、insights
          Cronが反応データを取得すると表示されます。
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse bg-white border border-gray-200 rounded">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-600">
                <th className="p-2 border-b">テーマ</th>
                <th className="p-2 border-b text-right">投稿数</th>
                <th className="p-2 border-b text-right">平均views</th>
                <th className="p-2 border-b text-right">平均いいね</th>
                <th className="p-2 border-b text-right">平均返信</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.theme} className="border-b last:border-b-0">
                  <td className="p-2">{themeName(r.theme)}</td>
                  <td className="p-2 text-right">{r.posts}</td>
                  <td className="p-2 text-right">{r.avgViews}</td>
                  <td className="p-2 text-right">{r.avgLikes}</td>
                  <td className="p-2 text-right">{r.avgReplies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
