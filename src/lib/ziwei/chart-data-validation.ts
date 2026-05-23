/** 校验 Hybrid / Stage 管线所需的 chartData 快照 */
export function hasValidChartPalaces(chartData: unknown): chartData is Record<string, unknown> & {
  palaces: unknown[]
} {
  if (!chartData || typeof chartData !== 'object') return false
  const palaces = (chartData as Record<string, unknown>).palaces
  return Array.isArray(palaces) && palaces.length >= 12
}
