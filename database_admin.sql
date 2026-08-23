-- ============================================================
--  QATTAH — Owner Admin Dashboard · Schema add-on v1.0
--  Import AFTER database.sql + database_receipts.sql.
--  Adds an is_active flag to users (for Disable/Enable).
-- ============================================================
START TRANSACTION;

-- Add is_active only if it doesn't already exist (safe to re-run).
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active'
);
SET @ddl := IF(@col = 0,
  'ALTER TABLE `users` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `theme`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
