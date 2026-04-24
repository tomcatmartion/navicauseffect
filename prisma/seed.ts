import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = "admin";
  // 从环境变量读取管理员密码，未设置则使用默认值（仅开发环境）
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // 将管理员密码存入 AdminConfig 表，运行时从数据库读取
  await prisma.adminConfig.upsert({
    where: { configKey: "admin_password_hash" },
    update: { configValue: hashedPassword },
    create: { configKey: "admin_password_hash", configValue: hashedPassword },
  });
  console.log("管理员密码已写入 AdminConfig");

  let existing = await prisma.user.findUnique({ where: { username: adminUsername } });

  if (!existing) {
    existing = await prisma.user.findUnique({ where: { email: "admin@navicause.com" } });
  }
  if (!existing) {
    existing = await prisma.user.findUnique({ where: { inviteCode: "ADMIN001" } });
  }

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: adminUsername,
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    console.log(`管理员账号已更新: username=${adminUsername}`);
  } else {
    const admin = await prisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        nickname: "管理员",
        role: "ADMIN",
        inviteCode: "ADMIN001",
        membership: { create: { plan: "YEARLY", status: "ACTIVE" } },
      },
    });
    console.log("管理员账号创建成功:");
    console.log(`  用户名: ${adminUsername}`);
    console.log(`  ID: ${admin.id}`);
  }

  const plans = [
    { plan: "MONTHLY" as const, originalPrice: 10 },
    { plan: "QUARTERLY" as const, originalPrice: 25 },
    { plan: "YEARLY" as const, originalPrice: 99 },
  ];

  for (const p of plans) {
    await prisma.membershipPricing.upsert({
      where: { id: `seed-${p.plan.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-${p.plan.toLowerCase()}`,
        plan: p.plan,
        originalPrice: p.originalPrice,
        isActive: true,
      },
    });
  }
  console.log("会员价格初始化完成（包月10/包季25/包年99）");

  await prisma.adminConfig.upsert({
    where: { configKey: "per_query_price" },
    update: {},
    create: { configKey: "per_query_price", configValue: 0.5 },
  });
  console.log("按次付费价格初始化完成（0.5元/次）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
