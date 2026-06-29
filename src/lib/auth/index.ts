import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { generateInviteCode } from "@/lib/utils/invite-code";
import { processInviteReward } from "@/lib/auth/invite-reward";
// 注意:不直接 import { verifyCode } from "@/lib/sms"
// 因为 middleware.ts 引用了本文件,middleware 在 edge runtime 运行,
// ioredis 不兼容 edge,直接 import 会破坏 middleware bundle
// phone provider 中改用动态 import

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "账号密码登录",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const rawUsername = credentials?.username;
        const rawPassword = credentials?.password;
        if (rawUsername == null || rawPassword == null) return null;
        const username = String(rawUsername).trim();
        const password = String(rawPassword).trim();

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user?.password) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] credentials: 用户不存在或无密码:", username);
          }
          return null;
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] credentials: 密码不匹配:", username);
          }
          return null;
        }
        return { id: user.id, name: user.nickname, email: user.email };
      },
    }),

    CredentialsProvider({
      id: "phone",
      name: "手机号登录",
      credentials: {
        phone: { label: "手机号", type: "text" },
        code: { label: "验证码", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;
        const phone = String(credentials.phone).trim();
        const code = String(credentials.code).trim();

        // 动态 import 避免把 ioredis 拉进 middleware edge bundle
        const { verifyCode } = await import("@/lib/sms");
        const ok = await verifyCode(phone, code);
        if (!ok) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth/phone] 验证码校验失败:", phone);
          }
          return null;
        }

        // 手机号登录要求用户必须已存在(注册流程由 /api/auth/register 处理)
        // 自动创建会导致任意手机号+任意验证码绕过注册
        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user) return null;

        return { id: user.id, name: user.nickname, email: user.email };
      },
    }),

    CredentialsProvider({
      id: "wechat",
      name: "微信登录",
      credentials: {
        code: { label: "微信授权码", type: "text" },
        inviteCode: { label: "邀请码（可选）", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.code) return null;
        const code = credentials.code as string;
        // 邀请码可选：前端登录页从 localStorage/cookie pendingInviteCode 透传
        const inviteCodeParam =
          typeof credentials.inviteCode === "string" && credentials.inviteCode.trim()
            ? credentials.inviteCode.trim().toUpperCase()
            : "";

        try {
          const appId = process.env.WECHAT_APP_ID;
          const appSecret = process.env.WECHAT_APP_SECRET;

          if (!appId || !appSecret) {
            console.error("WeChat OAuth not configured");
            return null;
          }

          const tokenRes = await fetch(
            `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
          );
          const tokenData = await tokenRes.json();

          if (tokenData.errcode) {
            console.error("WeChat token error:", tokenData);
            return null;
          }

          const { openid, access_token } = tokenData;

          const userInfoRes = await fetch(
            `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`
          );
          const wxUser = await userInfoRes.json();

          let user = await prisma.user.findUnique({
            where: { wechatOpenId: openid },
          });

          let isNewUser = false;
          if (!user) {
            user = await prisma.user.create({
              data: {
                wechatOpenId: openid,
                nickname: wxUser.nickname || `微信用户`,
                avatar: wxUser.headimgurl || null,
                inviteCode: generateInviteCode(),
                membership: { create: { plan: "FREE", status: "ACTIVE" } },
              },
            });
            isNewUser = true;
          } else if (wxUser.nickname && !user.nickname) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                nickname: wxUser.nickname,
                avatar: wxUser.headimgurl || user.avatar,
              },
            });
          }

          // 新用户 + 有邀请码 → 触发邀请奖励（3 个注册入口共用同一函数）
          if (isNewUser && inviteCodeParam) {
            try {
              const inviter = await prisma.user.findUnique({
                where: { inviteCode: inviteCodeParam },
                select: { id: true },
              });
              if (inviter && inviter.id !== user.id) {
                await processInviteReward({
                  inviterId: inviter.id,
                  newUserId: user.id,
                  newUsername: user.nickname ?? undefined,
                });
              }
            } catch (err) {
              // 邀请奖励失败不应阻断登录流程
              console.error("[auth/wechat] processInviteReward 失败:", err);
            }
          }

          return { id: user.id, name: user.nickname, email: user.email };
        } catch (err) {
          console.error("WeChat auth error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 登录时:从数据库获取最新用户信息写入 token
      if (user?.id) {
        token.userId = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { membership: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.nickname;
          token.membershipPlan = dbUser.membership?.plan ?? "FREE";
          token.membershipStatus = dbUser.membership?.status ?? "ACTIVE";
          // 微信扫码新用户(有 wechatOpenId 但无 phone)需要绑定手机号
          token.phoneBindingRequired = !!(dbUser.wechatOpenId && !dbUser.phone);
        }
      }
      // 手动刷新 session 时(支付后、绑定手机号后等场景):重新查库更新 token
      if (trigger === "update" && token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: { membership: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.nickname;
          token.membershipPlan = dbUser.membership?.plan ?? "FREE";
          token.membershipStatus = dbUser.membership?.status ?? "ACTIVE";
          // 绑定手机号后,phoneBindingRequired 自动清除
          token.phoneBindingRequired = !!(dbUser.wechatOpenId && !dbUser.phone);
        }
      }
      // 其余请求:直接返回 token,不查库
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.name = (token.name as string) ?? session.user?.name ?? "";
        session.user.role = (token.role as string) ?? "USER";
        session.user.membershipPlan = (token.membershipPlan as string) ?? "FREE";
        session.user.membershipStatus = (token.membershipStatus as string) ?? "ACTIVE";
        session.user.phoneBindingRequired = (token.phoneBindingRequired as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});

export { generateInviteCode } from "@/lib/utils/invite-code";

