import { IztroInput } from "iztro-hook/lib/index.type";
import { NestedProps } from "../config/types";

export type IztrolabeProps = {
  width?: number | string;
  horoscopeDate?: string | Date;
  horoscopeHour?: number;
  centerPalaceAlign?: boolean;
  /** 运限日期变更回调 */
  onHoroscopeDateChange?: (date: string | Date) => void;
  /** 运限时辰变更回调 */
  onHoroscopeHourChange?: (hour: number) => void;
} & IztroInput &
  NestedProps;
