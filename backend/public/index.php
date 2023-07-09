<?php

use App\Kernel;

require_once dirname(__DIR__).'/vendor/autoload_runtime.php';

return function (array $context) {
    # Currently, only possible way to bypass CORS problems with symfony-docker setup
    if($_SERVER['REQUEST_METHOD'] == "OPTIONS"){
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Headers: *");
        die;
    }
    return new Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);
};
