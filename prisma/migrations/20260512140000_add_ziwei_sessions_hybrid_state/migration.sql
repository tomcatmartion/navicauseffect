-- AlterTable: Hybrid 编排持久化字段（与 prisma/schema.prisma ZiweiSession.hybridState 对齐）
ALTER TABLE `ziwei_sessions` ADD COLUMN `hybrid_state` JSON NULL AFTER `current_domain`;
