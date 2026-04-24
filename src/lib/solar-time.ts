/**
 * True Solar Time (真太阳时) calculation.
 * Converts standard time to local apparent solar time based on longitude.
 *
 * The offset from standard time depends on:
 * 1. Longitude difference from the standard meridian (China uses 120°E)
 * 2. Equation of Time (the difference between mean and apparent solar time)
 */

const CHINA_STANDARD_LONGITUDE = 120;

interface CityInfo {
  name: string;
  longitude: number;
  latitude: number;
}

export const MAJOR_CITIES: CityInfo[] = [
  { name: "北京", longitude: 116.4, latitude: 39.9 },
  { name: "上海", longitude: 121.5, latitude: 31.2 },
  { name: "广州", longitude: 113.3, latitude: 23.1 },
  { name: "深圳", longitude: 114.1, latitude: 22.5 },
  { name: "成都", longitude: 104.1, latitude: 30.6 },
  { name: "重庆", longitude: 106.5, latitude: 29.6 },
  { name: "武汉", longitude: 114.3, latitude: 30.6 },
  { name: "杭州", longitude: 120.2, latitude: 30.3 },
  { name: "南京", longitude: 118.8, latitude: 32.1 },
  { name: "西安", longitude: 108.9, latitude: 34.3 },
  { name: "天津", longitude: 117.2, latitude: 39.1 },
  { name: "苏州", longitude: 120.6, latitude: 31.3 },
  { name: "长沙", longitude: 113.0, latitude: 28.2 },
  { name: "郑州", longitude: 113.7, latitude: 34.8 },
  { name: "济南", longitude: 117.0, latitude: 36.7 },
  { name: "沈阳", longitude: 123.4, latitude: 41.8 },
  { name: "大连", longitude: 121.6, latitude: 38.9 },
  { name: "哈尔滨", longitude: 126.6, latitude: 45.8 },
  { name: "长春", longitude: 125.3, latitude: 43.9 },
  { name: "昆明", longitude: 102.8, latitude: 25.0 },
  { name: "贵阳", longitude: 106.7, latitude: 26.6 },
  { name: "福州", longitude: 119.3, latitude: 26.1 },
  { name: "厦门", longitude: 118.1, latitude: 24.5 },
  { name: "南宁", longitude: 108.3, latitude: 22.8 },
  { name: "兰州", longitude: 103.8, latitude: 36.1 },
  { name: "太原", longitude: 112.6, latitude: 37.9 },
  { name: "石家庄", longitude: 114.5, latitude: 38.0 },
  { name: "合肥", longitude: 117.3, latitude: 31.8 },
  { name: "南昌", longitude: 115.9, latitude: 28.7 },
  { name: "海口", longitude: 110.3, latitude: 20.0 },
  { name: "拉萨", longitude: 91.1, latitude: 29.7 },
  { name: "乌鲁木齐", longitude: 87.6, latitude: 43.8 },
  { name: "呼和浩特", longitude: 111.7, latitude: 40.8 },
  { name: "银川", longitude: 106.3, latitude: 38.5 },
  { name: "西宁", longitude: 101.8, latitude: 36.6 },
  { name: "台北", longitude: 121.5, latitude: 25.0 },
  { name: "香港", longitude: 114.2, latitude: 22.3 },
  { name: "澳门", longitude: 113.5, latitude: 22.2 },
];

function equationOfTime(dayOfYear: number): number {
  const b = ((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180);
  return (
    9.87 * Math.sin(2 * b) -
    7.53 * Math.cos(b) -
    1.5 * Math.sin(b)
  );
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function calculateTrueSolarTime(
  date: Date,
  hour: number,
  minute: number,
  longitude: number
): { hour: number; minute: number; timeIndex: number } {
  const dayOfYear = getDayOfYear(date);
  const eot = equationOfTime(dayOfYear);
  const longitudeCorrection =
    (longitude - CHINA_STANDARD_LONGITUDE) * 4;
  const totalCorrectionMinutes = longitudeCorrection + eot;

  let totalMinutes = hour * 60 + minute + totalCorrectionMinutes;

  if (totalMinutes < 0) totalMinutes += 24 * 60;
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;

  const trueHour = Math.floor(totalMinutes / 60);
  const trueMinute = Math.round(totalMinutes % 60);

  const timeIndex = hourToTimeIndex(trueHour, trueMinute);

  return { hour: trueHour, minute: trueMinute, timeIndex };
}

/**
 * Converts hour/minute to the traditional Chinese time period index (时辰序号).
 * 0 = 早子时 (23:00-01:00 of next day)
 * 1 = 丑时 (01:00-03:00)
 * ...
 * 12 = 晚子时 (23:00-01:00)
 */
function hourToTimeIndex(hour: number, minute: number): number {
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes >= 23 * 60 || totalMinutes < 1 * 60) return 0;
  if (totalMinutes < 3 * 60) return 1;
  if (totalMinutes < 5 * 60) return 2;
  if (totalMinutes < 7 * 60) return 3;
  if (totalMinutes < 9 * 60) return 4;
  if (totalMinutes < 11 * 60) return 5;
  if (totalMinutes < 13 * 60) return 6;
  if (totalMinutes < 15 * 60) return 7;
  if (totalMinutes < 17 * 60) return 8;
  if (totalMinutes < 19 * 60) return 9;
  if (totalMinutes < 21 * 60) return 10;
  if (totalMinutes < 23 * 60) return 11;
  return 12;
}

export const TIME_PERIODS = [
  { index: 0, name: "早子时", range: "23:00~01:00" },
  { index: 1, name: "丑时", range: "01:00~03:00" },
  { index: 2, name: "寅时", range: "03:00~05:00" },
  { index: 3, name: "卯时", range: "05:00~07:00" },
  { index: 4, name: "辰时", range: "07:00~09:00" },
  { index: 5, name: "巳时", range: "09:00~11:00" },
  { index: 6, name: "午时", range: "11:00~13:00" },
  { index: 7, name: "未时", range: "13:00~15:00" },
  { index: 8, name: "申时", range: "15:00~17:00" },
  { index: 9, name: "酉时", range: "17:00~19:00" },
  { index: 10, name: "戌时", range: "19:00~21:00" },
  { index: 11, name: "亥时", range: "21:00~23:00" },
  { index: 12, name: "晚子时", range: "23:00~01:00" },
];
