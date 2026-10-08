// 비밀값을 ***로 바꾼다(DECISIONS 8-2). 원래 값, URL 인코딩 값, JSON 문자열 안의 값을 찾는다.
// Base64 같은 다른 인코딩은 막지 못한다(한계).
export function createMasker(secretValues: string[]) {
  const needles = [
    ...new Set(
      secretValues.flatMap((v) => [
        v,
        encodeURIComponent(v),
        JSON.stringify(v).slice(1, -1),
      ]),
    ),
  ].sort((a, b) => b.length - a.length);

  const text = (t: string) =>
    needles.reduce((acc, n) => acc.split(n).join('***'), t);

  // JSON으로 저장할 값(문자열, 숫자, 배열, 객체)을 훑으며 가린다.
  const value = (v: unknown): unknown => {
    if (typeof v === 'string') return text(v);
    if (Array.isArray(v)) return v.map(value);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [text(k), value(x)]),
      );
    }
    return v;
  };

  return { text, value };
}
