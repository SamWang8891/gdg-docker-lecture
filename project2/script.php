<?php
echo "=== Docker Class - Package Manager Demo ===" . PHP_EOL;
echo "PHP version: " . PHP_VERSION . PHP_EOL;
echo "OS: " . php_uname() . PHP_EOL;
echo PHP_EOL;

// 檢查 extension 有沒有裝起來
echo "Loaded extensions:" . PHP_EOL;
$required = ['curl', 'mbstring', 'json', 'openssl'];
foreach ($required as $ext) {
    $status = extension_loaded($ext) ? '✓' : '✗';
    echo "  [$status] $ext" . PHP_EOL;
}
echo PHP_EOL;

// 真的用 curl 打一個 API，驗證 extension 跟 OpenSSL 都能用
echo "Fetching GitHub Zen (uses curl + openssl)..." . PHP_EOL;
$ch = curl_init('https://api.github.com/zen');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'docker-class-demo');
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    echo "  ERROR: $error" . PHP_EOL;
    exit(1);
}

echo "  → $response" . PHP_EOL;

// 順便試一下 mbstring（處理多位元組字元）
echo PHP_EOL;
echo "mbstring test (Chinese): " . mb_strtoupper('hello 世界') . PHP_EOL;
echo "  length (mb_strlen): " . mb_strlen('hello 世界') . PHP_EOL;
echo "  length (strlen):    " . strlen('hello 世界') . " ← byte 數，不是字數" . PHP_EOL;
