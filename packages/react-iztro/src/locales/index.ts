import i18next from "iztro/lib/i18n";
import transZhCN from '../locales/zh-CN';
import transZhTW from '../locales/zh-TW';
import transKoKR from '../locales/ko-KR';
import transJaJP from '../locales/ja-JP';
import transEnUS from '../locales/en-US';
import transViVN from '../locales/vi-VN';
import FunctionalAstrolabe from "iztro/lib/astro/FunctionalAstrolabe"
import { Language } from "iztro/lib/data/types"

i18next.addResources('zh-CN', 'react', transZhCN);
i18next.addResources('zh-TW', 'react', transZhTW);
i18next.addResources('ko-KR', 'react', transKoKR);
i18next.addResources('ja-JP', 'react', transJaJP);
i18next.addResources('en-US', 'react', transEnUS);
i18next.addResources('vi-VN', 'react', transViVN);

function ordinal(n: number) {
  switch (n) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

export const toLocaleLunarStr = (lunarStr: string, lunarDate: FunctionalAstrolabe["rawDates"]["lunarDate"], lang: Language) => {
  if (lang === 'zh-TW') {
    return lunarStr.replace('闰', '閏').replace('腊', '臘');
  } else if (lang === 'en-US') {
    const { lunarMonth, isLeap, lunarDay, lunarYear } = lunarDate;
    return lunarYear + "-" + lunarMonth + "-" + lunarDay
      + (isLeap ? `(Leap ${ordinal(lunarMonth)} Month)` : '');
  } else if (lang === 'ja-JP') {
    const { lunarMonth, isLeap, lunarDay, lunarYear } = lunarDate;
    return `${lunarYear}年${lunarMonth}月${lunarDay}日` + (isLeap ? `（閏${lunarMonth}月）` : '');
  } else if (lang === 'ko-KR') {
    const { lunarMonth, isLeap, lunarDay, lunarYear } = lunarDate;
    return `${lunarYear}년 ${lunarMonth}월 ${lunarDay}일` + (isLeap ? ` (윤${lunarMonth}월)` : '');
  } else if (lang === 'vi-VN') {
    const { lunarMonth, isLeap, lunarDay, lunarYear } = lunarDate;
    return `${lunarDay} Tháng ${lunarMonth}${isLeap ? ' Nhuận' : ''} Năm ${lunarYear}`;
  }
  return lunarStr;
}