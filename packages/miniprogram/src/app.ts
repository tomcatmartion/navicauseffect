import { PropsWithChildren } from "react";
import { useLaunch } from "@tarojs/taro";
import "./app.scss";

function App({ children }: PropsWithChildren<Record<string, unknown>>) {
  useLaunch(() => {
    console.log("紫微问道小程序启动");
  });

  // children 是即将会渲染的页面
  return children;
}

export default App;
