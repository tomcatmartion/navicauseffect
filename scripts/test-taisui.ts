import { astro } from 'iztro';
import { serializeAstrolabeForReading } from '@/lib/ziwei/serialize-chart-for-reading';
import { readChartFromData } from '@/core/data-reader/iztro-reader';

const result = astro.bySolar('2000-1-1', 5, '男', true, 'zh-CN');

// 前端序列化
const chartData = serializeAstrolabeForReading(
  result as unknown as Record<string, unknown>,
  { year: 2000, month: 1, day: 1, hour: 5, gender: '男' }
);

// 后端读取
const chart = readChartFromData(chartData);

console.log('=== iztro 原始 ===');
console.log('rawDates.yearly:', (result as any).rawDates.chineseDate.yearly);
console.log('chineseDate:', result.chineseDate);
console.log('soulPalace:', result.earthlyBranchOfSoulPalace);

console.log('');
console.log('=== 序列化后 chartData ===');
console.log('rawDates:', JSON.stringify((chartData as any).rawDates));
console.log('chineseDate:', (chartData as any).chineseDate);
console.log('birthZhi 存在?', 'birthZhi' in (chartData as any));

console.log('');
console.log('=== iztro-reader 解析结果 ===');
console.log('birthGan:', chart.birthGan);
console.log('birthZhi:', chart.birthZhi);
console.log('taiSuiZhi:', chart.taiSuiZhi);
console.log('mingGongZhi:', chart.mingGongZhi);
console.log('shenGongZhi:', chart.shenGongZhi);
