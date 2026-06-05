/**
 * 报告生成服务 — 同步调用 AI 生成报告内容
 *
 * 流程：
 * 1. 根据模板 slug 构建专属 system prompt
 * 2. 注入命主信息（姓名、性别、出生时间、八字等）
 * 3. 调用 callAI() 生成内容
 * 4. 返回 JSON 格式（章节模式）或纯文本
 */
import { callAI } from '@/lib/ai/skill-callers'

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface IdentityData {
  name: string
  gender: string
  birthday: string
  birthCity: string | null
  region: string | null
  bazi: string | null
}

interface GenerateReportInput {
  templateSlug: string
  templateName: string
  identity: IdentityData
  extraInfo?: string
}

// ---------------------------------------------------------------------------
// Prompt 模板映射
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是一位精通紫微斗数与八字命理的资深命理分析师，同时也是一位心理学专家。你的分析风格融合了传统命理智慧与现代心理学视角。

要求：
1. 语言温暖、专业、有洞察力，避免宿命论
2. 分析须基于提供的命主八字/出生信息
3. 多用具体描述，少用空泛套话
4. 适当给出可操作的建议
5. 输出为 JSON 格式，包含 chapters 数组和可选的 content（段落+推荐问题）数组
6. 每个 chapter 包含 title 和 content 字段
7. 总字数控制在指定范围内`

/** 根据模板 slug 构建 user prompt */
function buildUserPrompt(input: GenerateReportInput): string {
  const { templateSlug, templateName, identity, extraInfo } = input
  const genderStr = identity.gender === 'MALE' ? '男' : '女'
  const baziStr = identity.bazi || '（待排盘）'
  const regionStr = identity.region || ''
  const extraStr = extraInfo?.trim() || ''

  const baseInfo = `命主姓名：${identity.name}
性别：${genderStr}
出生时间：${identity.birthday}${regionStr ? `\n出生地区：${regionStr}` : ''}
八字：${baziStr}`
  const extraSection = extraStr ? `\n\n用户特别关注：${extraStr}` : ''

  const promptMap: Record<string, string> = {
    // ========== 体验区 ==========
    'talent-awakening': `请基于以上命主信息，生成一份「天赋觉醒计划」分析报告。

报告结构（4-5章，约8000字）：
1. "天赋密码" — 基于八字和紫微命盘分析命主的天赋特质
2. "潜能地图" — 识别隐藏才能和未被充分开发的潜力领域
3. "职业基因" — 最适合命主天赋的职业方向和发展路径
4. "觉醒指南" — 如何将天赋转化为现实优势的具体建议
5. "天赋守护" — 可能阻碍天赋发挥的因素和应对策略

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（2000-3000字）"}]}`,

    'love-atlas': `请基于以上命主信息，生成一份「爱情图鉴」分析报告。

报告结构（4-5章，约7000字）：
1. "感情底色" — 命主的情感模式和恋爱观分析
2. "桃花解码" — 桃花运势和异性缘特征
3. "正缘画像" — 命主正缘的形象特征和出现时机
4. "相处之道" — 感情中的优劣势和相处建议
5. "爱情锦囊" — 提升感情运势的实用建议

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（1500-2500字）"}]}`,

    'life-kline': `请基于以上命主信息，生成一份「人生K线图」运势分析报告。

报告结构（4-5章，约9000字）：
1. "人生大盘" — 基于八字分析命主一生的整体运势格局
2. "十年大运" — 逐段分析十年大运的走势和关键特征
3. "流年关键节点" — 未来几年的关键转折点和机遇分析
4. "人生周期" — 事业、财富、感情各维度的周期性规律
5. "趋势研判" — 综合趋势判断和关键年份提醒

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（2000-3000字）"}]}`,

    // ========== 会员区 ==========
    'life-full-analysis': `请基于以上命主信息，生成一份「命书·人生命理通鉴」综合报告。

这是一份全方位命理解读，需要深度分析命主的人生各维度。报告结构（8-10章，约30000字）：
1. "命盘总论" — 命主命盘全局解读和性格总览
2. "性格内观" — 深层性格特质和内在驱动力分析
3. "事业版图" — 事业运势、职业方向和发展策略
4. "财富密码" — 财运分析和理财建议
5. "情感世界" — 感情运势和婚恋分析
6. "健康指南" — 体质特征和健康养生建议
7. "人际磁场" — 社交能力和人脉分析
8. "学业智慧" — 学习能力和知识发展方向
9. "大运流年" — 十年运势和关键年份分析
10. "人生建议" — 综合建议和未来展望

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（3000-4000字）"}]}`,

    'annual-fortune': `请基于以上命主信息，生成一份「运书·2026年度运势」分析报告。

报告结构（6-8章，约20000字）：
1. "年度总运" — 2026年整体运势概览
2. "事业运势" — 年度事业走向和关键节点
3. "财富运势" — 年度财运分析和理财建议
4. "感情运势" — 年度桃花和感情走向
5. "健康运势" — 年度健康注意事项
6. "人际运势" — 年度人际交往和贵人分析
7. "月度指南" — 12个月逐月运势速览
8. "年度锦囊" — 全年趋吉避凶建议

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（2500-3500字）"}]}`,

    'compatibility-report': `请基于以上命主信息，生成一份「缘书·双人合盘报告」分析报告。

注意：此报告为单人视角的关系分析。报告结构（5-6章，约10000字）：
1. "缘起" — 从命主视角分析与他人的缘分类型
2. "性格互补" — 最佳匹配的性格类型和相处模式
3. "事业合作" — 命主在事业合作中的人际特征
4. "感情匹配" — 感情维度上的匹配建议
5. "友情密码" — 社交和友情维度的分析
6. "相处之道" — 综合关系维护建议

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（1500-2500字）"}]}`,

    'lucky-tips': `请基于以上命主信息，生成一份「好运锦囊」开运指南。

报告结构（4-5章，约5000字）：
1. "幸运密码" — 命主的幸运色、幸运数字、幸运方位
2. "贵人图谱" — 贵人属相和特征
3. "开运方位" — 有利方位和风水布局建议
4. "时空密码" — 有利时辰和日子选择建议
5. "锦囊妙计" — 综合开运建议

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（1000-1500字）"}]}`,

    'academic': `请基于以上命主信息，生成一份「学业主题」分析报告。

报告结构（4-5章，约6000字）：
1. "学习天赋" — 命主的学习能力和思维方式
2. "文昌运势" — 学业运和考试运分析
3. "专业方向" — 基于命理的专业选择建议
4. "进修指南" — 深造和技能提升建议
5. "学业锦囊" — 提升学习效率的实用建议

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（1200-1800字）"}]}`,

    'past-life': `请基于以上命主信息，生成一份「前世今生」灵性探索报告。

报告结构（4-5章，约6000字）：
1. "灵魂印记" — 基于命盘推测灵魂特质和前世记忆
2. "前世回溯" — 可能的前世经历和未了心愿
3. "今生课题" — 今生需要完成的生命功课
4. "灵魂伴侣" — 前世缘分和今生重遇的可能
5. "觉醒之路" — 灵性成长和生命进化的建议

返回 JSON 格式：
{"chapters": [{"title": "章节名", "content": "章节内容（1200-1800字）"}]}`,
  }

  const templatePrompt = promptMap[templateSlug]

  if (!templatePrompt) {
    // 通用模板 prompt
    return `${baseInfo}${extraSection}\n\n请基于以上命主信息，生成一份「${templateName}」命理分析报告。\n\n报告要求4-5个章节，每章1500-2500字，分析深入、语言温暖专业。\n\n返回 JSON 格式：\n{"chapters": [{"title": "章节名", "content": "章节内容"}]}`
  }

  return `${baseInfo}${extraSection}\n\n${templatePrompt}`
}

// ---------------------------------------------------------------------------
// 生成报告主函数
// ---------------------------------------------------------------------------

export async function generateReportContent(
  input: GenerateReportInput
): Promise<{ content: string; status: 'COMPLETED' | 'FAILED'; errorMessage?: string }> {
  try {
    const userPrompt = buildUserPrompt(input)

    const result = await callAI({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16384,
    })

    if (!result.content) {
      return {
        content: '',
        status: 'FAILED',
        errorMessage: 'AI 未返回任何内容',
      }
    }

    // 清理 AI 返回的 markdown 代码块包裹
    let cleaned = result.content.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    // 验证 JSON 格式
    try {
      const parsed = JSON.parse(cleaned)
      if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
        // 如果 AI 没按 JSON 格式返回，包装成单章节
        return {
          content: JSON.stringify({
            chapters: [{ title: input.templateName, content: cleaned }],
          }),
          status: 'COMPLETED',
        }
      }
      return { content: cleaned, status: 'COMPLETED' }
    } catch {
      // AI 返回了纯文本，包装成章节格式
      return {
        content: JSON.stringify({
          chapters: [{ title: input.templateName, content: cleaned }],
        }),
        status: 'COMPLETED',
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误'
    console.error('[generateReportContent] 生成失败:', msg)
    return {
      content: '',
      status: 'FAILED',
      errorMessage: msg,
    }
  }
}
