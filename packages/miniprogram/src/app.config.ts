export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/chat/chat",
    "pages/charts/charts",
    "pages/reports/reports",
    "pages/profile/profile",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#F2ECD9",
    navigationBarTitleText: "紫微问道",
    navigationBarTextStyle: "black",
    backgroundColor: "#F2ECD9",
  },
  tabBar: {
    color: "#6B5D4A",
    selectedColor: "#8B1A1A",
    backgroundColor: "#FAF6E9",
    borderStyle: "white",
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
      },
      {
        pagePath: "pages/chat/chat",
        text: "对话",
      },
      {
        pagePath: "pages/charts/charts",
        text: "命盘",
      },
      {
        pagePath: "pages/reports/reports",
        text: "报告",
      },
      {
        pagePath: "pages/profile/profile",
        text: "我的",
      },
    ],
  },
  // 微信小程序权限（登录、用户信息、支付）
  requiredPrivateInfos: ["getLocation"],
  permission: {
    "scope.userLocation": {
      desc: "用于真太阳时校正",
    },
  },
});
