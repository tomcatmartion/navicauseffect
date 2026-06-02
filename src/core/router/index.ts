/**
 * M5: 事项路由 — 统一导出
 */

export {
  routeMatter,
  detectMatterIntent,
  getMatterQuestions,
  getMatterFirstQuestion,
  getMatterPreAnalysis,
  getMatterPreAnalysisFor,
  type RouteQuestion,
  type RouteOption,
  type RouteResult,
  type MatterPreAnalysis,
} from './decision-tree'

export {
  resolveMatterRoute,
  normalizeRoutingAnswers,
  type ResolvedMatterRoute,
  type ResolveMatterRouteOptions,
} from './matter-route-resolver'

export { getRouterTreeForClient, type ClientRouterTree, type ClientRouterBranch } from './router-tree-client'
