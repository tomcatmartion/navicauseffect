/**
 * 紫微斗数解盘引擎
 * TypeScript 实现方案
 *
 * @module ziwei
 * @description 紫微斗数命盘分析引擎，提供能级评估、性格分析、互动关系、事项解读等功能
 */

// 类型定义
export * from './types';

// 数据文件
export * from './data';

// 工具函数
export * from './utils';

// 核心引擎
export * from './core';

// 默认导出
export { ZiweiEngine, createChart, assessPalace, assessAllPalaces, analyzePersonality, analyzeInteraction, analyzeAffair } from './core/ZiweiEngine';
