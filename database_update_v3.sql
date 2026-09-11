-- ============================================================
--  QATTAH — Update v3 · Sign in with Google
--  Import AFTER database.sql, database_receipts.sql,
--  database_admin.sql and database_update_v2.sql.
--  phpMyAdmin → select qattah_db → Import → this file → Go
--
--  Adds:
--    users.google_id     → links a Google account to a QATTAH user
--    users.avatar_source → remembers a Google profile picture so it is
--                          refreshed on login but never overwrites an
--                          avatar the user uploaded themselves
--  Changes:
--    users.password      → nullable, because an account created through
--                          Google has no password until one is set
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- ── users.google_id ───────────────────────────────────────────
-- MySQL has no "ADD COLUMN IF NOT EXISTS", so guard on information_schema
-- to keep this file safe to re-run.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_id');
SET @s := IF(@c = 0,
  'ALTER TABLE `users` ADD COLUMN `google_id` VARCHAR(64) DEFAULT NULL AFTER `password`,
                       ADD UNIQUE KEY `uq_google_id` (`google_id`)',
  'SELECT "users.google_id already exists"');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── users.avatar_source ───────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_source');
SET @s := IF(@c = 0,
  'ALTER TABLE `users` ADD COLUMN `avatar_source` ENUM(''upload'',''google'') DEFAULT NULL AFTER `avatar`',
  'SELECT "users.avatar_source already exists"');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── users.password → nullable ─────────────────────────────────
-- A Google-only account has no password. Existing hashes are untouched.
ALTER TABLE `users` MODIFY `password` VARCHAR(255) DEFAULT NULL;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
