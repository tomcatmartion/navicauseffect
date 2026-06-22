import { PrismaClient, TemplateType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  /** 与表初始化一致：固定管理员账号（勿依赖环境变量） */
  const adminUsername = "admin";
  const adminPlainPassword = "ffffff";
  const hashedPassword = await bcrypt.hash(adminPlainPassword, 10);

  // 与 User.password 同步一份到 AdminConfig（其它脚本可读）
  await prisma.adminConfig.upsert({
    where: { configKey: "admin_password_hash" },
    update: { configValue: hashedPassword },
    create: { configKey: "admin_password_hash", configValue: hashedPassword },
  });
  console.log("管理员密码哈希已写入 AdminConfig（与 users.password 一致）");

  let existing = await prisma.user.findUnique({ where: { username: adminUsername } });

  if (!existing) {
    existing = await prisma.user.findUnique({ where: { email: "admin@navicause.com" } });
  }
  if (!existing) {
    existing = await prisma.user.findUnique({ where: { inviteCode: "ADMIN001" } });
  }

  const adminUserData = {
    username: adminUsername,
    password: hashedPassword,
    nickname: "管理员",
    role: "ADMIN" as const,
    inviteCode: "ADMIN001",
    membership: {
      upsert: {
        create: { plan: "YEARLY" as const, status: "ACTIVE" as const },
        update: { plan: "YEARLY" as const, status: "ACTIVE" as const },
      },
    },
  };

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: adminUserData.username,
        password: adminUserData.password,
        nickname: adminUserData.nickname,
        role: adminUserData.role,
        inviteCode: adminUserData.inviteCode,
        membership: adminUserData.membership,
      },
    });
    console.log("管理员已初始化/更新: admin / ffffff · ADMIN · 年度会员 ACTIVE");
  } else {
    const admin = await prisma.user.create({
      data: {
        username: adminUserData.username,
        password: adminUserData.password,
        nickname: adminUserData.nickname,
        role: adminUserData.role,
        inviteCode: adminUserData.inviteCode,
        membership: { create: { plan: "YEARLY", status: "ACTIVE" } },
      },
    });
    console.log("管理员已创建: admin / ffffff · ADMIN · 年度会员 ACTIVE");
    console.log(`  user id: ${admin.id}`);
  }

  const plans = [
    { plan: "MONTHLY" as const, originalPrice: 29 },
    { plan: "QUARTERLY" as const, originalPrice: 79 },
    { plan: "YEARLY" as const, originalPrice: 268 },
  ];

  for (const p of plans) {
    await prisma.membershipPricing.upsert({
      where: { id: `seed-${p.plan.toLowerCase()}` },
      update: { originalPrice: p.originalPrice },
      create: {
        id: `seed-${p.plan.toLowerCase()}`,
        plan: p.plan,
        originalPrice: p.originalPrice,
        isActive: true,
      },
    });
  }
  console.log("会员价格初始化完成（月29/季79/年268）");

  await prisma.adminConfig.upsert({
    where: { configKey: "per_query_price" },
    update: {},
    create: { configKey: "per_query_price", configValue: 0.5 },
  });
  console.log("按次付费单价初始化完成（0.5元/次，向后兼容）");

  // ─── 按次付费套餐（4 档，对照 testUI/desktop/pricing.html）─────────────
  const creditPacks = [
    { id: "p1", count: 1, price: 6, label: "≈ 1 次 AI 解盘" },
    { id: "p5", count: 5, price: 28, label: "省 ¥2 · ≈ 1 次报告" },
    { id: "p20", count: 20, price: 98, label: "省 ¥22 · 含 2 赠送", popular: true },
    { id: "p100", count: 100, price: 398, label: "省 ¥202 · 含 15 赠送" },
  ];
  await prisma.adminConfig.upsert({
    where: { configKey: "credit_packs" },
    update: { configValue: JSON.stringify(creditPacks) },
    create: { configKey: "credit_packs", configValue: JSON.stringify(creditPacks) },
  });
  console.log("按次付费套餐初始化完成（4 档：¥6/¥28/¥98/¥398）");

  // ─── 星币充值包（4 档，对照 testUI/desktop/pricing.html）─────────────
  const coinPacks = [
    { id: "c50", amount: 50, price: 18, bonus: 0, label: "基础包" },
    { id: "c200", amount: 200, price: 68, bonus: 20, label: "热门 · 赠 20", popular: true },
    { id: "c500", amount: 500, price: 158, bonus: 80, label: "赠 80" },
    { id: "c1000", amount: 1000, price: 288, bonus: 200, label: "最划算 · 赠 200" },
  ];
  await prisma.adminConfig.upsert({
    where: { configKey: "coin_packs" },
    update: { configValue: JSON.stringify(coinPacks) },
    create: { configKey: "coin_packs", configValue: JSON.stringify(coinPacks) },
  });
  console.log("星币充值包初始化完成（4 档：¥18/¥68/¥158/¥288）");

  // ─── 报告模板初始化 ─────────────────────────────────────
  // 来源：原 scripts/seed-report-templates.ts，合并到标准 seed 流程
  // 避免部署脚本遗漏导致 report_templates 表为空（曾导致线上"暂无可用的报告模板"）
  await seedReportTemplates();
}

/** 报告模板种子数据：3 个 BASIC + 6 个 ADVANCED（含 15 个子报告） */
async function seedReportTemplates() {
  console.log("开始同步报告模板...");

  const basicTemplates = [
    {
      name: "天赋觉醒计划",
      slug: "talent-awakening",
      description:
        "发掘你的潜在天赋和独特才华，找到最适合的发展方向。约8000字深度分析，涵盖天赋特质、潜能开发、职业方向。",
      type: TemplateType.BASIC,
      tags: ["热门", "推荐", "8千字"],
      sortOrder: 1,
      pointCost: 88,
    },
    {
      name: "爱情图鉴",
      slug: "love-atlas",
      description:
        "解读你的感情宿命，分析姻缘运势和感情走向。约7000字浪漫画像，涵盖桃花分析、正缘特征、感情建议。",
      type: TemplateType.BASIC,
      tags: ["热门", "7千字"],
      sortOrder: 2,
      pointCost: 88,
    },
    {
      name: "人生K线图",
      slug: "life-kline",
      description:
        "流年运势图表分析，预判未来趋势与关键转折点。约9000字趋势研判，涵盖十年大运、流年走势、关键节点。",
      type: TemplateType.BASIC,
      tags: ["数据可视化", "9千字"],
      sortOrder: 3,
      pointCost: 88,
    },
  ];

  const advancedTemplates = [
    {
      name: "命书·人生命理通鉴",
      slug: "life-full-analysis",
      description:
        "全方位解读你的命盘，约3万字完整人生分析。涵盖性格内观、事业、财富、感情、健康五大维度。",
      type: TemplateType.ADVANCED,
      tags: ["热门", "推荐", "3万字", "含5份子报告"],
      sortOrder: 4,
      pointCost: 380,
    },
    {
      name: "运书·年度运势",
      slug: "annual-fortune",
      description:
        "年度运势详细分析，约2万字四季运势解读。涵盖心灵成长、事业、财富、感情、健康五大维度的年度展望。",
      type: TemplateType.ADVANCED,
      tags: ["限时", "2万字", "含5份子报告"],
      sortOrder: 5,
      pointCost: 380,
    },
    {
      name: "缘书·双人合盘报告",
      slug: "compatibility-report",
      description:
        "两人命盘深度比对，约1万字关系分析。涵盖婚姻、爱情、事业合作、商业合伙、友情五大维度。",
      type: TemplateType.ADVANCED,
      tags: ["热门", "双人", "1万字", "含5份子报告"],
      sortOrder: 6,
      pointCost: 180,
    },
    {
      name: "好运锦囊",
      slug: "lucky-tips",
      description:
        "专属开运方案，助你趋吉避凶。涵盖幸运色、幸运数字、开运方位、贵人属相等实用建议。",
      type: TemplateType.ADVANCED,
      tags: ["实用"],
      sortOrder: 7,
      pointCost: 66,
    },
    {
      name: "学业主题",
      slug: "academic",
      description:
        "基于命理的学业分析，涵盖学习能力、考试运势、专业选择、进修方向等学业相关指导。",
      type: TemplateType.ADVANCED,
      tags: ["学术"],
      sortOrder: 8,
      pointCost: 100,
    },
    {
      name: "前世今生",
      slug: "past-life",
      description:
        "回溯前世渊源，解读今生际遇的深层缘由。灵魂探索与生命课题的神秘之旅。",
      type: TemplateType.ADVANCED,
      tags: ["神秘"],
      sortOrder: 9,
      pointCost: 66,
    },
  ];

  const childDefinitions: Record<
    string,
    Array<{ name: string; slug: string; pointCost: number }>
  > = {
    "life-full-analysis": [
      { name: "性格内观", slug: "personality", pointCost: 66 },
      { name: "事业分析", slug: "career", pointCost: 88 },
      { name: "财富分析", slug: "wealth", pointCost: 88 },
      { name: "感情分析", slug: "love", pointCost: 88 },
      { name: "健康分析", slug: "health", pointCost: 66 },
    ],
    "annual-fortune": [
      { name: "心灵成长", slug: "spiritual", pointCost: 66 },
      { name: "事业运势", slug: "career-fortune", pointCost: 88 },
      { name: "财富运势", slug: "wealth-fortune", pointCost: 88 },
      { name: "感情运势", slug: "love-fortune", pointCost: 88 },
      { name: "健康运势", slug: "health-fortune", pointCost: 66 },
    ],
    "compatibility-report": [
      { name: "婚姻合盘", slug: "marriage", pointCost: 160 },
      { name: "爱情合盘", slug: "romance", pointCost: 160 },
      { name: "事业合作", slug: "business", pointCost: 160 },
      { name: "商业合伙", slug: "partnership", pointCost: 160 },
      { name: "友情合盘", slug: "friendship", pointCost: 160 },
    ],
  };

  // 插入基础模板
  for (const t of basicTemplates) {
    const bgImage = `/images/templates/${t.slug}.png`;
    await prisma.reportTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        type: t.type,
        tags: t.tags,
        bgImage,
        sortOrder: t.sortOrder,
        pointCost: t.pointCost,
      },
      create: { ...t, bgImage },
    });
  }
  console.log(`  ✓ BASIC 模板 ${basicTemplates.length} 个`);

  // 插入高级模板（含子模板）
  for (const t of advancedTemplates) {
    const bgImage = `/images/templates/${t.slug}.png`;
    const parent = await prisma.reportTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        type: t.type,
        tags: t.tags,
        bgImage,
        sortOrder: t.sortOrder,
        pointCost: t.pointCost,
      },
      create: { ...t, bgImage },
    });

    const children = childDefinitions[t.slug];
    if (children) {
      for (const child of children) {
        const childSlug = `${t.slug}-${child.slug}`;
        await prisma.reportTemplate.upsert({
          where: { slug: childSlug },
          update: {
            name: child.name,
            pointCost: child.pointCost,
            parentId: parent.id,
          },
          create: {
            name: child.name,
            slug: childSlug,
            description: `${t.name} - ${child.name}`,
            type: TemplateType.ADVANCED,
            tags: ["子报告"],
            sortOrder: 0,
            pointCost: child.pointCost,
            parentId: parent.id,
          },
        });
      }
    }
  }
  console.log(
    `  ✓ ADVANCED 模板 ${advancedTemplates.length} 个（含子报告）`,
  );

  // 清理旧 slug 模板
  const slugsToRemove = [
    "talent",
    "love",
    "kline",
    "annual",
    "luck",
    "naming",
    "compatibility",
  ];
  for (const slug of slugsToRemove) {
    const existing = await prisma.reportTemplate.findUnique({
      where: { slug },
    });
    if (existing) {
      await prisma.reportTemplate.deleteMany({
        where: { parentId: existing.id },
      });
      await prisma.reportTemplate.delete({ where: { id: existing.id } });
    }
  }

  // 测试兑换码
  const existingCode = await prisma.redeemCode.findUnique({
    where: { code: "WELCOME100" },
  });
  if (!existingCode) {
    await prisma.redeemCode.create({
      data: {
        code: "WELCOME100",
        pointValue: 100,
        maxUses: 1000,
        expiresAt: new Date("2027-12-31"),
      },
    });
    console.log("  ✓ 测试兑换码 WELCOME100 (100星币)");
  }
  console.log("报告模板同步完成");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
