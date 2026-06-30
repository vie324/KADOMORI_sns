import Anthropic from "@anthropic-ai/sdk";
import { getTheme } from "./themes";

// 文章生成は Claude Sonnet 4.6 を使用（仕様で指定）。
const MODEL = "claude-sonnet-4-6";

// マスタープロンプトのコンセプト（WHO/WHAT/HOW）。後で差し替え可能なように定数化。
export const CONCEPT = {
  who: `銀座で働く40〜50代の経営者・士業・ハイブランド勤務の女性。多忙で自律神経が乱れがち。"きちんとした場所"で身体を整えたい。`,
  what: `不調を治す鍼灸ではなく、予防・パフォーマンス・美容への投資。通うほど不調になりにくい身体をつくる、自分への定期投資。`,
  how: `静謐・上質・余白。一文は短く。煽り・絵文字過多は禁止。「。」で静かに言い切る。専門用語は噛み砕く。`,
};

export interface GeneratedPost {
  theme: string;
  body: string;
}

export function buildPrompt(
  themeNumber: string,
  count: number,
  min: number,
  max: number
): string {
  const theme = getTheme(themeNumber);
  const themeName = theme ? theme.name : themeNumber;

  return `あなたは銀座の高単価鍼灸サロンのSNS編集者です。
以下のコンセプトを厳守し、Threads投稿を生成してください。

【WHO】${CONCEPT.who}
【WHAT】${CONCEPT.what}
【HOW】${CONCEPT.how}
【テーマ】${themeName}
【文字数】${min}〜${max}字（500字上限厳守）
【本数】${count}本
【禁止】価格の明示、過度な効能の断定、医療広告ガイドライン違反表現

出力は次のJSON配列のみ（前後の説明文・コードブロック記法なし）:
[{ "theme": "${themeNumber}", "body": "..." }, ...]`;
}

// モデル出力からJSON配列を抽出してパースする。
// コードブロック記法が混入しても拾えるよう防御的にパースする。
function extractJsonArray(text: string): unknown {
  let t = text.trim();
  // ```json ... ``` のようなコードフェンスを除去
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/m, "").trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      "モデル出力からJSON配列を抽出できませんでした: " + text.slice(0, 300)
    );
  }
  return JSON.parse(t.slice(start, end + 1));
}

export async function generatePosts(
  themeNumber: string,
  count: number,
  min: number,
  max: number
): Promise<GeneratedPost[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY を環境変数に設定してください。");
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(themeNumber, count, min, max);

  // 500字 × 本数 + JSON構造分の余裕を見て max_tokens を設定。
  // 非ストリーミングのHTTPタイムアウト回避のため 16000 以下に収める。
  const maxTokens = Math.min(16000, 1500 + count * 1200);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) {
    throw new Error("モデル出力がJSON配列ではありません。");
  }

  const out: GeneratedPost[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { body?: unknown }).body === "string"
    ) {
      const obj = item as { theme?: unknown; body: string };
      const body = obj.body.trim();
      if (body.length === 0) continue;
      out.push({
        theme: typeof obj.theme === "string" ? obj.theme : themeNumber,
        body,
      });
    }
  }

  if (out.length === 0) {
    throw new Error("生成結果が空でした。プロンプトまたはモデル出力を確認してください。");
  }

  return out;
}
