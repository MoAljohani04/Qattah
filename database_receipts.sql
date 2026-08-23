-- ============================================================
--  QATTAH — Receipt Splitting & QR Sharing · Schema add-on v1.0
--  Import this AFTER database.sql (it only ADDS new tables).
--  phpMyAdmin → select qattah_db → Import → this file → Go
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- ── receipts ──────────────────────────────────────────────────
--  One scanned/shared receipt. `share_token` is the public id used
--  in the share link  (receipt.html?t=ABC123XYZ).
CREATE TABLE IF NOT EXISTS `receipts` (
  `id`              INT(11)       NOT NULL AUTO_INCREMENT,
  `share_token`     VARCHAR(16)   NOT NULL,
  `restaurant_name` VARCHAR(150)  NOT NULL DEFAULT 'Receipt',
  `receipt_date`    DATE          NOT NULL,
  `total_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency`        VARCHAR(3)    NOT NULL DEFAULT 'SAR',
  `receipt_image`   VARCHAR(255)  DEFAULT NULL,
  `created_by`      INT(11)       NOT NULL,
  `status`          ENUM('open','closed') NOT NULL DEFAULT 'open',
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_share_token` (`share_token`),
  KEY `idx_receipts_creator` (`created_by`),
  CONSTRAINT `fk_receipts_user` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── receipt_items ─────────────────────────────────────────────
--  The line items confirmed in the popup. `quantity` is the total
--  count on the receipt (how many of this item exist to be claimed).
CREATE TABLE IF NOT EXISTS `receipt_items` (
  `id`         INT(11)       NOT NULL AUTO_INCREMENT,
  `receipt_id` INT(11)       NOT NULL,
  `name`       VARCHAR(150)  NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `quantity`   INT(11)       NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ri_receipt` (`receipt_id`),
  CONSTRAINT `fk_ri_receipt` FOREIGN KEY (`receipt_id`)
    REFERENCES `receipts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── receipt_claims ────────────────────────────────────────────
--  How many units of an item a given participant says they consumed.
--  One row per (item, user); quantity 0 means the row is removed.
CREATE TABLE IF NOT EXISTS `receipt_claims` (
  `id`         INT(11)   NOT NULL AUTO_INCREMENT,
  `receipt_id` INT(11)   NOT NULL,
  `item_id`    INT(11)   NOT NULL,
  `user_id`    INT(11)   NOT NULL,
  `quantity`   INT(11)   NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_claim` (`item_id`,`user_id`),
  KEY `idx_rc_receipt` (`receipt_id`),
  KEY `idx_rc_user`    (`user_id`),
  CONSTRAINT `fk_rc_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rc_item`    FOREIGN KEY (`item_id`)    REFERENCES `receipt_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rc_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`         (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── receipt_payments ──────────────────────────────────────────
--  Mock payment record written when a participant taps "Pay Now".
CREATE TABLE IF NOT EXISTS `receipt_payments` (
  `id`         INT(11)       NOT NULL AUTO_INCREMENT,
  `receipt_id` INT(11)       NOT NULL,
  `user_id`    INT(11)       NOT NULL,
  `amount`     DECIMAL(10,2) NOT NULL,
  `method`     VARCHAR(30)   NOT NULL DEFAULT 'mock',
  `status`     ENUM('paid')  NOT NULL DEFAULT 'paid',
  `paid_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_payer` (`receipt_id`,`user_id`),
  KEY `idx_rp_user` (`user_id`),
  CONSTRAINT `fk_rp_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
