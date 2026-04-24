-- AlterTable
ALTER TABLE `consultation_records` ADD COLUMN `chart_fingerprint` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `consultation_records_user_id_chart_fingerprint_idx` ON `consultation_records`(`user_id`, `chart_fingerprint`);
