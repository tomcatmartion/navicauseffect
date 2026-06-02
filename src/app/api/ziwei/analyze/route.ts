/**
 * 紫微斗数规则分析 API
 * 使用新的函数式架构进行格局识别、能级评估、性格分析等
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateSinglePalace } from "@/core/energy-evaluator/scoring-flow";
import { executeStage1 } from "@/core/stages/stage1-palace-scoring";
import { executeStage2 } from "@/core/stages/stage2-personality";
import type { Stage1Input } from "@/core/types";
import { PALACE_NAME_TO_INDEX } from "@/core/types";
import { guardZiweiDebugApi } from "@/lib/ziwei/debug-api-guard";
import { hasValidChartPalaces } from "@/lib/ziwei/chart-data-validation";

export async function POST(request: NextRequest) {
  const guard = await guardZiweiDebugApi();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { type, birthData, chartData } = body;

    if (!birthData && !chartData) {
      return NextResponse.json(
        { error: "缺少出生信息或命盘数据" },
        { status: 400 }
      );
    }

    // 构建 chartData（如果直接传了 birthData，需要构造一个最小化的 chartData）
    let effectiveChartData = chartData;
    if (!effectiveChartData && birthData) {
      effectiveChartData = {
        birthInfo: birthData,
        solarDate: `${birthData.year}-${String(birthData.month).padStart(2, '0')}-${String(birthData.day).padStart(2, '0')}`,
        gender: birthData.gender === 'male' ? '男' : '女',
      };
    }

    if (!hasValidChartPalaces(effectiveChartData)) {
      return NextResponse.json(
        { error: "缺少有效的 chartData.palaces（须为 serializeAstrolabeForReading 完整快照，至少 12 宫）" },
        { status: 400 },
      );
    }

    // 根据分析类型调用不同的分析方法
    switch (type) {
      case "palace": {
        // 单宫位能级评估
        const palaceName = body.palaceName;
        if (!palaceName) {
          return NextResponse.json(
            { error: "缺少宫位名称" },
            { status: 400 }
          );
        }

        const stage1Input: Stage1Input = {
          chartData: effectiveChartData,
          parentBirthYears: body.parentBirthYears,
        };
        const stage1Output = executeStage1(stage1Input);
        const palaceIndex = stage1Output.scoringCtx.palaces.findIndex(
          p => p.palaceIndex === PALACE_NAME_TO_INDEX[palaceName as keyof typeof PALACE_NAME_TO_INDEX]
        );
        const assessment = palaceIndex >= 0
          ? evaluateSinglePalace(palaceIndex, stage1Output.scoringCtx)
          : null;

        return NextResponse.json({ type: "palace", data: assessment });
      }

      case "all-palaces": {
        // 所有宫位能级评估
        const stage1Input: Stage1Input = {
          chartData: effectiveChartData,
          parentBirthYears: body.parentBirthYears,
        };
        const stage1Output = executeStage1(stage1Input);
        return NextResponse.json({
          type: "all-palaces",
          data: stage1Output.palaceScores,
        });
      }

      case "personality": {
        // 性格分析
        const stage1Input: Stage1Input = {
          chartData: effectiveChartData,
          parentBirthYears: body.parentBirthYears,
        };
        const stage1Output = executeStage1(stage1Input);
        const stage2Output = executeStage2({
          stage1: stage1Output,
          question: body.question || "",
        });

        return NextResponse.json({
          type: "personality",
          data: {
            mingGongTags: stage2Output.mingGongTags,
            shenGongTags: stage2Output.shenGongTags,
            taiSuiTags: stage2Output.taiSuiTags,
            overallTone: stage2Output.overallTone,
            mingGongHolographic: stage2Output.mingGongHolographic,
            knowledgeSnippets: stage2Output.knowledgeSnippets,
          },
        });
      }

      case "patterns": {
        // 格局识别
        const stage1Input: Stage1Input = {
          chartData: effectiveChartData,
          parentBirthYears: body.parentBirthYears,
        };
        const stage1Output = executeStage1(stage1Input);
        return NextResponse.json({
          type: "patterns",
          data: stage1Output.allPatterns,
        });
      }

      case "affair": {
        const { executeStage3 } = await import('@/core/stages/stage3-matter-analysis');
        const { resolveMatterRoute } = await import('@/core/router/matter-route-resolver');
        const matterType = (body.affairType ?? '求财') as import('@/core/types').MatterType;
        const targetYear =
          typeof body.targetYear === 'number'
            ? body.targetYear
            : new Date().getFullYear();
        const stage1Input: Stage1Input = {
          chartData: effectiveChartData,
          parentBirthYears: body.parentBirthYears,
        };
        const stage1Output = executeStage1(stage1Input);
        const stage2Output = executeStage2({
          stage1: stage1Output,
          question: body.affair ?? matterType,
        });
        const routeResult = resolveMatterRoute(
          matterType,
          body.affair ?? matterType,
          body.routingAnswers as Record<string, string> | undefined,
        );
        const stage3Output = executeStage3({
          stage1: stage1Output,
          stage2: stage2Output,
          matterType,
          routeResult,
          chartData: effectiveChartData,
          targetYear,
        });
        return NextResponse.json({
          type: "affair",
          data: {
            route: routeResult,
            ...stage3Output,
          },
        });
      }

      case "full": {
        // 完整解盘（阶段一 + 阶段二）
        const stage1Input: Stage1Input = {
          chartData: effectiveChartData,
          parentBirthYears: body.parentBirthYears,
        };
        const stage1Output = executeStage1(stage1Input);
        const stage2Output = executeStage2({
          stage1: stage1Output,
          question: body.question || "",
        });

        return NextResponse.json({
          type: "full",
          data: {
            palaceScores: stage1Output.palaceScores,
            patterns: stage1Output.allPatterns,
            personality: {
              mingGongTags: stage2Output.mingGongTags,
              shenGongTags: stage2Output.shenGongTags,
              taiSuiTags: stage2Output.taiSuiTags,
              overallTone: stage2Output.overallTone,
              mingGongHolographic: stage2Output.mingGongHolographic,
            },
            knowledgeSnippets: [
              ...stage1Output.knowledgeSnippets,
              ...stage2Output.knowledgeSnippets,
            ],
          },
        });
      }

      default:
        return NextResponse.json(
          { error: "不支持的分析类型" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[ziwei] 分析错误:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}



// GET 请求支持获取支持的宫位列表和分析类型
export async function GET() {
  return NextResponse.json({
    supportedTypes: [
      "palace",      // 单宫位评估
      "all-palaces", // 所有宫位评估
      "personality", // 性格分析
      "patterns",    // 格局识别
      "affair",      // 事项分析（Stage3）
      "full",        // 完整解盘
    ],
    palaceNames: [
      "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
      "迁移", "仆役", "官禄", "田宅", "福德", "父母"
    ],
    affairTypes: [
      "求学", "求爱", "求财", "求职", "求健康", "求名", "其他"
    ],
  });
}
