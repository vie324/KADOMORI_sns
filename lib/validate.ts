// 薬機法・医療広告ガイドラインの簡易バリデーション。
// これは補助。最終判断は人間が管理画面で行う前提。
// Node専用APIは使わない（クライアントコンポーネントからも import されるため）。

export const MAX_LENGTH = 500;

// NGワード辞書。断定的効能・最大級表現・疾患の治癒断定など。
export const NG_WORDS: string[] = [
  // 効能の断定
  "必ず治る",
  "完治",
  "治る",
  "治ります",
  "治せる",
  "効く",
  "効きます",
  "効果絶大",
  "即効",
  "万能",
  "副作用なし",
  "リバウンドなし",
  // 疾患の治癒・改善の断定（医療広告で問題になりやすい表現）
  "うつ病が治る",
  "自律神経失調症が治る",
  "不妊治療",
  "がんが治る",
  "ガンが治る",
  "病気が治る",
  "病気を治す",
  // 最大級・優位性の断定
  "No.1",
  "ナンバーワン",
  "日本一",
  "世界一",
  "業界一",
  "業界No",
  "最高",
  "最強",
  "最先端",
  "唯一",
  "絶対",
];

export interface ValidationResult {
  ngFlagged: boolean; // 要確認フラグ（NGワード or 文字数超過）
  ngHits: string[]; // ヒットしたNGワード
  length: number; // Threads換算の文字数
  tooLong: boolean; // 500字超過
}

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

// Threadsの文字数カウント。本文は文字数、絵文字・記号はUTF-8バイト長でカウントする
// 仕様の近似実装。プレーンなCJKテキストは1文字=1としてカウントされる。
export function threadsLength(text: string): number {
  let len = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const isEmojiOrSymbol =
      cp >= 0x1f000 || // 補助多言語面以降（絵文字の大半）
      (cp >= 0x2600 && cp <= 0x27bf) || // Misc symbols / Dingbats
      (cp >= 0x2190 && cp <= 0x21ff) || // Arrows
      (cp >= 0xfe00 && cp <= 0xfe0f) || // Variation selectors
      (cp >= 0x1f1e6 && cp <= 0x1f1ff); // Regional indicators
    if (isEmojiOrSymbol && encoder) {
      len += encoder.encode(ch).length;
    } else {
      len += 1;
    }
  }
  return len;
}

export function checkNgWords(body: string): { flagged: boolean; hits: string[] } {
  const hits = NG_WORDS.filter((w) => body.includes(w));
  return { flagged: hits.length > 0, hits };
}

export function validatePost(body: string): ValidationResult {
  const { flagged, hits } = checkNgWords(body);
  const length = threadsLength(body);
  const tooLong = length > MAX_LENGTH;
  return {
    ngFlagged: flagged || tooLong,
    ngHits: hits,
    length,
    tooLong,
  };
}
