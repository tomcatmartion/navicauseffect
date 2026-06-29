/**
 * iztro timeIndex (0-12) 到 24 小时制"代表小时"的映射 — 单一数据源
 *
 * 供 chart-snapshot-builder（chartDataToBirthInfo 还原 birthday）和
 * SaveChartButton（前端构造 birthdayStr）共用。
 *
 * 两处必须用同一份，否则 orchestrator 查 DB 持久缓存的指纹与保存路径不一致，
 * 导致 DB 缓存永久静默失效。
 *
 * timeIndex: 0=子时早, 1=丑, 2=寅, 3=卯, 4=辰, 5=巳, 6=午,
 *            7=未, 8=申, 9=酉, 10=戌, 11=亥, 12=子时晚
 */
export const TIME_INDEX_TO_HOUR: Record<number, number> = {
  0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12,
  7: 14, 8: 16, 9: 18, 10: 20, 11: 22, 12: 0,
}
