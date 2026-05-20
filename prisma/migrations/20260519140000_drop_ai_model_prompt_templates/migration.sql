-- 移除旧版按 AnalysisCategory 存库的 prompt 模板字段（Hybrid 使用 prompt-builder.ts）
ALTER TABLE `ai_model_configs` DROP COLUMN `prompt_templates`;
