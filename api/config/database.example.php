<?php
/**
 * TEMPLATE — copy to api/config/database.php and fill in your own
 * credentials. database.php is gitignored so a real password never
 * reaches the repo. On XAMPP the defaults below work as-is.
 */
class Database {
    private static ?Database $instance = null;
    private PDO $pdo;

    private string $host     = 'localhost';
    private string $dbname   = 'qattah_db';
    private string $username = 'root';          // ← your DB user on the host
    private string $password = '';              // ← your DB password on the host
    private string $charset  = 'utf8mb4';

    private function __construct() {
        $dsn     = "mysql:host={$this->host};dbname={$this->dbname};charset={$this->charset}";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $this->pdo = new PDO($dsn, $this->username, $this->password, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Database connection failed']));
        }
    }

    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getConnection(): PDO {
        return $this->pdo;
    }
}
