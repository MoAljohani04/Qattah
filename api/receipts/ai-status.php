<?php
/**
 * GET /api/receipts/ai-status.php   (any logged-in user)
 * Tells the scan screen whether AI auto-read is available.
 * Never returns the API key itself — only whether one is set.
 */
require_once '../config/database.php';
require_once '../config/response.php';
require_once '../config/ai.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
requireAuth();

$db = Database::getInstance()->getConnection();
success([
    'ai_enabled' => aiEnabled(),
    'provider'   => aiProvider(),
    'model'      => aiActiveModel($db),
]);
