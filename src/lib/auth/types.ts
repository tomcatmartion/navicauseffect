import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      membershipPlan: string;
      membershipStatus: string;
      /** 微信扫码新用户首次登录后,需要绑定手机号 */
      phoneBindingRequired?: boolean;
    };
  }

  interface JWT {
    userId?: string;
    /** 微信扫码新用户首次登录后,需要绑定手机号 */
    phoneBindingRequired?: boolean;
  }
}
