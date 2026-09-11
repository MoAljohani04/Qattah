-- ============================================================
--  QATTAH — Update v2 · Group receipts + shareable items
--  Import AFTER database.sql and database_receipts.sql.
--  phpMyAdmin → select qattah_db → Import → this file → Go
--
--  Adds:
--    receipts.group_id        → a scan can belong to a group
--    receipt_items.is_shared  → item is split between everyone
--                               who picks it, instead of per-unit
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- ── receipts.group_id ─────────────────────────────────────────
-- MySQL has no "ADD COLUMN IF NOT EXISTS", so guard on information_schema
-- to keep this file safe to re-run.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'receipts' AND COLUMN_NAME = 'group_id');
SET @s := IF(@c = 0,
  'ALTER TABLE `receipts` ADD COLUMN `group_id` INT(11) DEFAULT NULL AFTER `created_by`,
                          ADD KEY `idx_receipts_group` (`group_id`),
                          ADD CONSTRAINT `fk_receipts_group` FOREIGN KEY (`group_id`)
                              REFERENCES `groups` (`id`) ON DELETE SET NULL',
  'SELECT "receipts.group_id already exists"');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── receipt_items.is_shared ───────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'receipt_items' AND COLUMN_NAME = 'is_shared');
SET @s := IF(@c = 0,
  'ALTER TABLE `receipt_items` ADD COLUMN `is_shared` TINYINT(1) NOT NULL DEFAULT 0 AFTER `quantity`',
  'SELECT "receipt_items.is_shared already exists"');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── notifications: allow the new group-receipt notice ─────────
ALTER TABLE `notifications`
  MODIFY `type` ENUM('bill_added','payment_received','added_to_group',
                    'expense_updated','reminder','group_receipt') NOT NULL,
  MODIFY `reference_type` ENUM('bill','payment','group','receipt') DEFAULT NULL;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
