import { defineConfig } from "@tarojs/cli";
import devConfig from "./dev";
import prodConfig from "./prod";

export default defineConfig(async (merge, { command, mode }) => {
  const base = {
    projectName: "navicauseffect-miniprogram",
    date: "2026-6-22",
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: "src",
    outputRoot: "dist",
    plugins: [],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: "react",
    compiler: "webpack5",
    cache: {
      enable: false,
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]",
          },
        },
      },
    },
    h5: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]",
          },
        },
      },
    },
    rn: {
      appName: "taroDemo",
      postcss: {
        cssModules: {
          enable: false,
        },
      },
    },
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, base, devConfig);
  }
  return merge({}, base, prodConfig);
});
