-- ============================================================
--  QATTAH — App settings (key/value) · add-on
--  Stores owner-editable settings like the AI model choice.
--  Import after the other SQL files. Safe to re-run.
-- ============================================================
START TRANSACTION;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key`   VARCHAR(50)  NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL DEFAULT '',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the AI model row (ignored if it already exists).
INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`)
VALUES ('ai_model', 'claude-opus-4-8');

COMMIT;
