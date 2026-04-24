/**
 * 紫微斗数规则分析 API
 * 使用本地引擎进行格局识别、能级评估、性格分析等
 */

import { NextRequest, NextResponse } from "next/server";
import { ZiweiEngine, type Chart } from "@/lib/ziwei";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, birthData, currentAge, targetYear, affair, relationType } = body;

    if (!birthData) {
      return NextResponse.json(
        { error: "缺少出生信息" },
        { status: 400 }
      );
    }

    // 创建命盘
    let chart: Chart;
    try {
      chart = ZiweiEngine.createChart({
        gender: birthData.gender,
        year: birthData.year,
        month: birthData.month,
        day: birthData.day,
        hour: birthData.hour,
        solar: birthData.solar ?? true,
      });
    } catch (err) {
      console.error("[ziwei] 命盘创建失败:", err);
      return NextResponse.json(
        { error: "命盘创建失败，请检查出生信息" },
        { status: 400 }
      );
    }

    // 根据分析类型调用不同的分析方法
    switch (type) {
      case "palace": {
        // 宫位能级评估
        const palaceName = body.palaceName;
        if (!palaceName) {
          return NextResponse.json(
            { error: "缺少宫位名称" },
            { status: 400 }
          );
        }
        const assessment = ZiweiEngine.assessPalace(chart, palaceName);
        return NextResponse.json({ type: "palace", data: assessment });
      }

      case "all-palaces": {
        // 所有宫位能级评估
        const assessments = ZiweiEngine.assessAllPalaces(chart);
        return NextResponse.json({ type: "all-palaces", data: assessments });
      }

      case "personality": {
        // 性格分析
        const profile = ZiweiEngine.analyzePersonality(chart);
        return NextResponse.json({ type: "personality", data: profile });
      }

      case "interaction": {
        // 互动关系分析
        if (!targetYear) {
          return NextResponse.json(
            { error: "缺少目标年份（太岁信息）" },
            { status: 400 }
          );
        }
        const analysis = ZiweiEngine.analyzeInteraction({
          selfChart: chart,
          targetYear: {
            stem: targetYear.stem,
            branch: targetYear.branch,
          },
          targetName: body.targetName,
          relationType: body.relationType,
          currentAge,
          currentAnnualYear: targetYear.year,
        });
        return NextResponse.json({ type: "interaction", data: analysis });
      }

      case "affair": {
        // 事项分析
        if (!affair) {
          return NextResponse.json(
            { error: "缺少事项描述" },
            { status: 400 }
          );
        }
        const analysis = ZiweiEngine.analyzeAffair({
          chart,
          affair,
          affairType: body.affairType,
          currentAge,
          targetYear: targetYear?.year ?? new Date().getFullYear(),
        });
        return NextResponse.json({ type: "affair", data: analysis });
      }

      case "full": {
        // 完整解盘
        const fullAnalysis = ZiweiEngine.fullAnalysis({
          chart,
          currentAge,
          targetYear: targetYear?.year,
        });
        return NextResponse.json({ type: "full", data: fullAnalysis });
      }

      case "patterns": {
        // 格局识别
        const patterns = ZiweiEngine.checkPatterns(chart, "natal");
        return NextResponse.json({ type: "patterns", data: patterns });
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
      "interaction", // 互动关系
      "affair",      // 事项分析
      "full",        // 完整解盘
      "patterns",    // 格局识别
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
