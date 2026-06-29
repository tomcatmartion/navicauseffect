/**
 * S-17：根据命盘数据动态生成预设问题
 *
 * 输入：dual-chat-panel 收到的 chartData（serialize-chart-for-reading.ts 序列化输出）
 * 输出：6 个针对当前命盘的个性化问题；fallback 5 个静态通用问题
 *
 * chartData 结构（关键字段）：
 *  - soul: 命宫主星字符串（如"紫微 天机"）
 *  - body: 身宫位置
 *  - palaces: 十二宫数据（按 iztro 顺序）
 *    - palaces[0] 命宫
 *    - palaces[2] 财帛
 *    - palaces[3] 子女
 *    - palaces[4] 夫妻（夫妻宫，但索引因流派不同有差异，保守起见按关键字匹配）
 *    - palaces[5] 福德
 *    - palaces[6] 田宅
 *    - palaces[7] 官禄
 *    - palaces[8] 仆役
 *    - palaces[9] 迁移
 *    - palaces[10] 疾厄
 *    - palaces[11] 父母
 *
 * 由于具体索引依赖 iztro 实现，这里采用宽松提取方式：扫描 palaces 找匹配"夫"/"财"/"事业"等宫位名
 */

const STATIC_FALLBACK = [
  "我的事业运如何？",
  "我明年的财运怎么样？",
  "我后年能结婚吗？",
  "我最适合的职业方向有哪些？",
  "我的家庭关系怎么样？",
];

interface DynamicContext {
  /** 命宫主星，如"紫微 天机" */
  soulStars?: string;
  /** 五行局 */
  fiveElementsClass?: string;
  /** 命主姓名 */
  nativeName?: string;
  /** 大限十年范围，如"30-39" */
  currentDecade?: string;
  /** 流年 */
  currentYear?: number;
}

/** 主星 → 个性建议问题模板（不要求完整匹配，含主星字即触发） */
const STAR_TEMPLATES: Array<{ stars: string[]; questions: string[] }> = [
  {
    stars: ["紫微"],
    questions: [
      "我是「紫微」坐命，领导力如何？适合创业还是职场？",
      "紫微入命，我该如何提升决策力与格局？",
    ],
  },
  {
    stars: ["天机"],
    questions: [
      "天机星坐命，我的智谋适合哪些职业方向？",
      "我擅长规划，但容易想太多，该如何平衡？",
    ],
  },
  {
    stars: ["太阳"],
    questions: [
      "太阳星坐命，我的贵人运如何？适合公开演讲或管理吗？",
      "我热情主动，但容易操劳，该如何调整？",
    ],
  },
  {
    stars: ["武曲"],
    questions: [
      "武曲星坐命，我的财运与事业执行力如何？",
      "我性格刚毅，适合金融、军警还是技术领域？",
    ],
  },
  {
    stars: ["天同"],
    questions: [
      "天同星坐命，我的福气与情绪管理如何？",
      "我享受生活，但要如何避免拖延？",
    ],
  },
  {
    stars: ["廉贞"],
    questions: [
      "廉贞星坐命，我的情感与事业如何平衡？",
      "我挑战多，该如何化桃花为贵人？",
    ],
  },
  {
    stars: ["天府"],
    questions: [
      "天府星坐命，我的财库与稳健运如何？",
      "我适合金融、不动产还是稳定公职？",
    ],
  },
  {
    stars: ["太阴"],
    questions: [
      "太阴星坐命，我的财富积累与感情运如何？",
      "我细腻感性，该如何提升财富感？",
    ],
  },
  {
    stars: ["贪狼"],
    questions: [
      "贪狼星坐命，我的桃花与欲望该如何驾驭？",
      "我多才多艺，适合艺术、销售还是公关？",
    ],
  },
  {
    stars: ["巨门"],
    questions: [
      "巨门星坐命，我的口舌是非该如何化解？",
      "我口才好，适合律师、教师还是咨询？",
    ],
  },
  {
    stars: ["天相"],
    questions: [
      "天相星坐命，我的辅佐与印星运如何？",
      "我适合做副手、秘书还是公务体系？",
    ],
  },
  {
    stars: ["天梁"],
    questions: [
      "天梁星坐命，我的逢凶化吉与长辈缘如何？",
      "我适合医疗、教育或宗教相关行业吗？",
    ],
  },
  {
    stars: ["七杀"],
    questions: [
      "七杀星坐命，我的事业冲劲与挫折如何？",
      "我喜欢挑战，适合业务、军警还是创业？",
    ],
  },
  {
    stars: ["破军"],
    questions: [
      "破军星坐命，我的破立 cycles 如何把握？",
      "我喜欢变革，该如何避免感情波动？",
    ],
  },
];

/** 通用时运问题（按当前流年/大限动态） */
function buildTimingQuestions(ctx: DynamicContext): string[] {
  const out: string[] = [];
  if (ctx.currentYear) {
    out.push(`${ctx.currentYear} 年我的整体运势如何？需要注意什么？`);
  }
  if (ctx.currentDecade) {
    out.push(`我目前处于 ${ctx.currentDecade} 大限，这十年的核心课题是什么？`);
  }
  return out;
}

/** 入口：根据 chartData 生成 6 个动态问题 */
export function generatePresetQuestions(chartData: Record<string, unknown> | null): string[] {
  if (!chartData) return STATIC_FALLBACK;

  try {
    const ctx: DynamicContext = {
      soulStars: typeof chartData.soul === "string" ? chartData.soul : undefined,
      fiveElementsClass:
        typeof chartData.fiveElementsClass === "string" ? chartData.fiveElementsClass : undefined,
      currentYear: new Date().getFullYear(),
    };

    // 大限提取（保守：从 chartData/sparklineInfo 等字段提取）
    const horoscope = chartData.horoscope as { decadal?: { startAge?: number; endAge?: number } } | undefined;
    if (horoscope?.decadal?.startAge != null && horoscope?.decadal?.endAge != null) {
      ctx.currentDecade = `${horoscope.decadal.startAge}-${horoscope.decadal.endAge}`;
    }

    const out: string[] = [];

    // 1. 主星个性化问题（取最匹配的 1-2 个模板）
    if (ctx.soulStars) {
      for (const tpl of STAR_TEMPLATES) {
        if (tpl.stars.some((s) => ctx.soulStars?.includes(s))) {
          out.push(...tpl.questions.slice(0, 2));
          break;
        }
      }
    }

    // 2. 时运问题（流年/大限）
    out.push(...buildTimingQuestions(ctx));

    // 3. 通用话题（事业 / 财运 / 感情）保底
    if (out.length < 5) {
      out.push("我的事业运和财运如何？");
    }
    if (out.length < 6) {
      out.push("我的感情和家庭关系怎么样？");
    }

    return out.slice(0, 6);
  } catch {
    return STATIC_FALLBACK;
  }
}
