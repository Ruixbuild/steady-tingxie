// Minimal Chinese numeral parse/format for 1-99, per the list-name
// auto-suggest regex in handoff spec §5.6: /(.*?)([一二三四五六七八九十]+)$/

const DIGIT: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const DIGIT_CHAR = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function parseChineseNumeral(s: string): number | null {
  if (!s) return null;
  if (s === "十") return 10;
  const tenIndex = s.indexOf("十");
  if (tenIndex === -1) {
    // single digit, e.g. "三"
    return s.length === 1 ? (DIGIT[s] ?? null) : null;
  }
  const before = s.slice(0, tenIndex);
  const after = s.slice(tenIndex + 1);
  const tens = before ? (DIGIT[before] ?? null) : 1;
  const ones = after ? (DIGIT[after] ?? null) : 0;
  if (tens === null || ones === null) return null;
  return tens * 10 + ones;
}

export function formatChineseNumeral(n: number): string {
  if (n <= 0) return "";
  if (n < 10) return DIGIT_CHAR[n];
  if (n === 10) return "十";
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (tens > 1 ? DIGIT_CHAR[tens] : "") + "十" + (ones > 0 ? DIGIT_CHAR[ones] : "");
}

/** Suggests the next list name, incrementing a trailing Chinese numeral if present. */
export function suggestNextListName(lastName: string | null): string {
  if (!lastName) return "";
  const match = lastName.match(/^(.*?)([一二三四五六七八九十]+)$/);
  if (!match) return "";
  const [, prefix, numeralStr] = match;
  const n = parseChineseNumeral(numeralStr);
  if (n === null) return "";
  return `${prefix}${formatChineseNumeral(n + 1)}`;
}
