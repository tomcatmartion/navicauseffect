// Babel config for Taro（与 taro 4.x 默认模板一致）
module.exports = {
  presets: [
    ["taro", {
      framework: "react",
      ts: true,
      compiler: "webpack5",
    }],
  ],
};
