import { createCn } from 'cn/config';

// globals.css에서 더한 글자 단계(text-body-sm, text-caption, text-glyph-sm)를 글자 크기로 알려 준다.
// 알려 주지 않으면 글자색과 같은 묶음으로 보고 `text-body-sm text-label`에서 크기를 지운다.
export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['body-sm', 'caption', 'glyph-sm'] }] } },
});
