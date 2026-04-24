import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

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
        if (!user?.password) return null;
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;
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
        const phone = credentials.phone as string;
        // TODO: verify SMS code from Redis
        let user = await prisma.user.findUnique({ where: { phone } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              phone,
              inviteCode: generateInviteCode(),
              nickname: `用户${phone.slice(-4)}`,
              membership: { create: { plan: "FREE", status: "ACTIVE" } },
            },
          });
        }
        return { id: user.id, name: user.nickname, email: user.email };
      },
    }),

    CredentialsProvider({
      id: "wechat",
      name: "微信登录",
      credentials: {
        code: { label: "微信授权码", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.code) return null;
        const code = credentials.code as string;

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
          } else if (wxUser.nickname && !user.nickname) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                nickname: wxUser.nickname,
                avatar: wxUser.headimgurl || user.avatar,
              },
            });
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
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      // Middleware 运行在 Edge，不能使用 Prisma；在此处查库会导致解码 session 失败并清空 cookie（表现为「登录后进不去」）。
      // 在 Node（登录回调、RSC 等）再同步 DB，保证支付后会员等信息可更新。
      const onEdge = process.env.NEXT_RUNTIME === "edge";
      if (token.userId && !onEdge) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: { membership: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.nickname;
          token.membershipPlan = dbUser.membership?.plan ?? "FREE";
          token.membershipStatus = dbUser.membership?.status ?? "ACTIVE";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.name = (token.name as string) ?? session.user?.name ?? "";
        session.user.role = (token.role as string) ?? "USER";
        session.user.membershipPlan = (token.membershipPlan as string) ?? "FREE";
        session.user.membershipStatus = (token.membershipStatus as string) ?? "ACTIVE";
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

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
