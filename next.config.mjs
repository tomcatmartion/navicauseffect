/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["iztro", "react-iztro"],
  /** @zvec/zvec 含 .node 原生绑定，须排除出打包 */
  serverExternalPackages: ["@zvec/zvec", "@prisma/client"],
  devIndicators: false,
  compress: true,
  webpack: (config) => {
    // 排除 storybook stories 文件（不需要 @storybook 依赖）
    config.module.rules.push({
      test: /\.stories\.tsx?$/,
      use: "null-loader",
    });
    return config;
  },
};

export default nextConfig;
