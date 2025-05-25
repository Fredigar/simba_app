<?php

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');

while (1) {

    $data = [
        [
            'name' => 'Bitcoin',
            'logo' => 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/btc.svg',
            'price' => rand(50000, 75000)
        ],
        [
            'name' => 'Ethereum',
            'logo' => 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/eth.svg',
            'price' => rand(2500, 5000)
        ],
        [
            'name' => 'Solana',
            'logo' => 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/sol.svg',
            'price' => rand(50, 100)
        ]
    ];

    echo "data:" . json_encode($data) . PHP_EOL . PHP_EOL;

    ob_flush();
    flush();

    sleep(5);

}