-- ============================================================
--  QATTAH — Bill Splitting App · Database Schema v1.0
-- ============================================================
SET SQL_MODE   = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
SET time_zone  = "+00:00";

-- Database must already exist on your host (create it via control panel)
-- Then select it in phpMyAdmin before importing this file

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT(11)          NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)     NOT NULL,
  `email`      VARCHAR(150)     NOT NULL,
  `password`   VARCHAR(255)     NOT NULL,
  `avatar`     VARCHAR(255)     DEFAULT NULL,
  `phone`      VARCHAR(20)      DEFAULT NULL,
  `bio`        TEXT             DEFAULT NULL,
  `language`   ENUM('en','ar')  DEFAULT 'en',
  `theme`      ENUM('light','dark') DEFAULT 'light',
  `created_at` TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`      INT(11)     NOT NULL AUTO_INCREMENT,
  `name_en` VARCHAR(50) NOT NULL,
  `name_ar` VARCHAR(50) NOT NULL,
  `icon`    VARCHAR(10) NOT NULL,
  `color`   VARCHAR(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── groups ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `groups` (
  `id`          INT(11)      NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT         DEFAULT NULL,
  `cover_image` VARCHAR(255) DEFAULT NULL,
  `created_by`  INT(11)      NOT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_groups_creator` (`created_by`),
  CONSTRAINT `fk_groups_user` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── group_members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `group_members` (
  `id`        INT(11)                NOT NULL AUTO_INCREMENT,
  `group_id`  INT(11)                NOT NULL,
  `user_id`   INT(11)                NOT NULL,
  `role`      ENUM('admin','member') DEFAULT 'member',
  `joined_at` TIMESTAMP              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_membership` (`group_id`,`user_id`),
  KEY `idx_gm_group` (`group_id`),
  KEY `idx_gm_user`  (`user_id`),
  CONSTRAINT `fk_gm_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gm_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── bills ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `bills` (
  `id`            INT(11)          NOT NULL AUTO_INCREMENT,
  `title`         VARCHAR(200)     NOT NULL,
  `description`   TEXT             DEFAULT NULL,
  `amount`        DECIMAL(10,2)    NOT NULL,
  `currency`      VARCHAR(3)       DEFAULT 'SAR',
  `category_id`   INT(11)          DEFAULT NULL,
  `group_id`      INT(11)          DEFAULT NULL,
  `paid_by`       INT(11)          NOT NULL,
  `split_type`    ENUM('equal','custom','percentage') DEFAULT 'equal',
  `receipt_image` VARCHAR(255)     DEFAULT NULL,
  `bill_date`     DATE             NOT NULL,
  `notes`         TEXT             DEFAULT NULL,
  `created_at`    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bills_paid_by`  (`paid_by`),
  KEY `idx_bills_group`    (`group_id`),
  KEY `idx_bills_category` (`category_id`),
  KEY `idx_bills_date`     (`bill_date`),
  CONSTRAINT `fk_bills_user`     FOREIGN KEY (`paid_by`)     REFERENCES `users`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bills_group`    FOREIGN KEY (`group_id`)    REFERENCES `groups`     (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bills_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── bill_participants ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `bill_participants` (
  `id`          INT(11)       NOT NULL AUTO_INCREMENT,
  `bill_id`     INT(11)       NOT NULL,
  `user_id`     INT(11)       NOT NULL,
  `amount_owed` DECIMAL(10,2) NOT NULL,
  `is_settled`  TINYINT(1)    DEFAULT 0,
  `settled_at`  TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_participant` (`bill_id`,`user_id`),
  KEY `idx_bp_bill`    (`bill_id`),
  KEY `idx_bp_user`    (`user_id`),
  KEY `idx_bp_settled` (`is_settled`),
  CONSTRAINT `fk_bp_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payments` (
  `id`           INT(11)       NOT NULL AUTO_INCREMENT,
  `from_user`    INT(11)       NOT NULL,
  `to_user`      INT(11)       NOT NULL,
  `bill_id`      INT(11)       DEFAULT NULL,
  `amount`       DECIMAL(10,2) NOT NULL,
  `note`         TEXT          DEFAULT NULL,
  `payment_date` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pay_from` (`from_user`),
  KEY `idx_pay_to`   (`to_user`),
  KEY `idx_pay_bill` (`bill_id`),
  CONSTRAINT `fk_pay_from` FOREIGN KEY (`from_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pay_to`   FOREIGN KEY (`to_user`)   REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pay_bill` FOREIGN KEY (`bill_id`)   REFERENCES `bills` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`             INT(11)      NOT NULL AUTO_INCREMENT,
  `user_id`        INT(11)      NOT NULL,
  `type`           ENUM('bill_added','payment_received','added_to_group','expense_updated','reminder') NOT NULL,
  `title`          VARCHAR(200) NOT NULL,
  `message`        TEXT         NOT NULL,
  `reference_id`   INT(11)      DEFAULT NULL,
  `reference_type` ENUM('bill','payment','group') DEFAULT NULL,
  `is_read`        TINYINT(1)   DEFAULT 0,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`),
  KEY `idx_notif_read` (`is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed: categories ─────────────────────────────────────────
INSERT INTO `categories` (`name_en`, `name_ar`, `icon`, `color`) VALUES
('Food & Dining',  'طعام ومطاعم', '🍽️', '#10B981'),
('Transportation', 'مواصلات',     '🚗',  '#3B82F6'),
('Entertainment',  'ترفيه',       '🎮',  '#8B5CF6'),
('Shopping',       'تسوق',        '🛍️', '#F59E0B'),
('Utilities',      'فواتير',      '⚡',  '#EF4444'),
('Travel',         'سفر',         '✈️', '#06B6D4'),
('Accommodation',  'إقامة',       '🏠',  '#84CC16'),
('Healthcare',     'صحة',         '🏥',  '#EC4899'),
('Education',      'تعليم',       '📚',  '#F97316'),
('Other',          'أخرى',        '📦',  '#6B7280');

-- ── Seed: users (password = "password123") ───────────────────
INSERT INTO `users` (`name`, `email`, `password`, `phone`) VALUES
('Ahmed Al-Rashid', 'ahmed@qattah.com',  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+966501234567'),
('Sara Mohammed',   'sara@qattah.com',   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+966509876543'),
('Khalid Ibrahim',  'khalid@qattah.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+966505551234'),
('Nora Abdullah',   'nora@qattah.com',   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+966507778888');

-- ── Seed: groups ─────────────────────────────────────────────
INSERT INTO `groups` (`name`, `description`, `created_by`) VALUES
('Apartment Mates', 'Monthly shared apartment expenses', 1),
('Weekend Trip',    'Camping trip to Al-Ula',            1);

INSERT INTO `group_members` (`group_id`, `user_id`, `role`) VALUES
(1, 1, 'admin'), (1, 2, 'member'), (1, 3, 'member'),
(2, 1, 'admin'), (2, 2, 'member'), (2, 3, 'member'), (2, 4, 'member');

-- ── Seed: bills ──────────────────────────────────────────────
INSERT INTO `bills` (`title`, `amount`, `category_id`, `group_id`, `paid_by`, `split_type`, `bill_date`) VALUES
('Monthly Rent',     3000.00, 7, 1, 1, 'equal', CURDATE()),
('Groceries',         250.00, 1, 1, 2, 'equal', CURDATE()),
('Electricity Bill',  180.00, 5, 1, 1, 'equal', DATE_SUB(CURDATE(), INTERVAL 5  DAY)),
('Campsite Fee',      400.00, 6, 2, 3, 'equal', DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
('BBQ Supplies',      320.00, 1, 2, 1, 'equal', DATE_SUB(CURDATE(), INTERVAL 10 DAY));

INSERT INTO `bill_participants` (`bill_id`, `user_id`, `amount_owed`, `is_settled`) VALUES
(1, 1, 1000.00, 1), (1, 2, 1000.00, 0), (1, 3, 1000.00, 0),
(2, 1,   83.33, 0), (2, 2,   83.33, 1), (2, 3,   83.34, 0),
(3, 1,   60.00, 1), (3, 2,   60.00, 0), (3, 3,   60.00, 1),
(4, 1,  100.00, 0), (4, 2,  100.00, 1), (4, 3,  100.00, 1), (4, 4, 100.00, 0),
(5, 1,   80.00, 1), (5, 2,   80.00, 0), (5, 3,   80.00, 0), (5, 4,  80.00, 0);

-- ── Seed: notifications ──────────────────────────────────────
INSERT INTO `notifications` (`user_id`, `type`, `title`, `message`, `reference_id`, `reference_type`) VALUES
(2, 'bill_added',       'New Bill Added',   'Ahmed added "Monthly Rent" — SAR 3,000',    1, 'bill'),
(3, 'bill_added',       'New Bill Added',   'Ahmed added "Monthly Rent" — SAR 3,000',    1, 'bill'),
(1, 'payment_received', 'Payment Received', 'Sara paid SAR 83.33 for "Groceries"',       NULL, 'payment'),
(4, 'added_to_group',   'Added to Group',   'You were added to "Weekend Trip"',           2, 'group');

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
