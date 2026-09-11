<?php
/**
 * /api/admin/settings.php   (owner only)
 *   GET → current AI settings (key status + model). Never returns the key.
 *   PUT → { ai_model } update the vision model.
 *
 * The API key lives only in api/config/ai.php and is never readable or
 * writable through the web — only its on/off status is exposed.
 */
require_once '../config/database.php';
require_once '../config/response.php';
require_once '../config/ai.php';
setHeaders();
$db = Database::getInstance()->getConnection();
requireOwner($db);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    success([
        'ai_enabled'    => aiEnabled(),
        'provider'      => aiProvider(),
        'ai_model'      => aiActiveModel($db),
        'model_choices' => aiModelChoices(),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $body  = getBody();
    $model = trim($body['ai_model'] ?? '');
    if (!in_array($model, aiModelChoices(), true)) { error('Invalid model'); }

    $stmt = $db->prepare(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES ('ai_model', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
    );
    $stmt->execute([$model]);
    success(['ai_model' => $model], 'Settings saved');
}

error('Method not allowed', 405);
