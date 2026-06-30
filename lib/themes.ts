// テーマ定義（1〜6）。マスタープロンプトに差し込む型。
// 拡張時はここに追記する。

export interface Theme {
  number: string; // '1' 〜 '6'
  name: string;
  aim: string;
}

export const THEMES: Theme[] = [
  { number: "1", name: "共感・お悩み型", aim: "ターゲットのあるあるを言語化" },
  { number: "2", name: "知識・権威型", aim: "東洋医学・自律神経の知見で信頼を示す" },
  { number: "3", name: "価値観・哲学型", aim: "なぜ高単価か＝技術と時間への投資" },
  { number: "4", name: "来院体験の描写", aim: "個室・香り・施術後の身体感覚" },
  { number: "5", name: "お客様の変化", aim: "ビフォーアフターを上品に" },
  { number: "6", name: "季節・養生型", aim: "二十四節気に合わせた身体ケア" },
];

export function getTheme(num: string): Theme | undefined {
  return THEMES.find((t) => t.number === num);
}

export function themeName(num: string | null): string {
  if (!num) return "—";
  const t = getTheme(num);
  return t ? `${t.number}. ${t.name}` : num;
}
