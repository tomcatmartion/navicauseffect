/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["iztro", "react-iztro"],
  /** @zvec/zvec 含 .node 原生绑定，须排除出打包 */
  serverExternalPackages: ["@zvec/zvec", "@prisma/client"],
  devIndicators: false,
  compress: true,
};

export default nextConfig;
