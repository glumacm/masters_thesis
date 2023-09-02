<?php

namespace App\Service;

use Psr\Log\LoggerInterface;

class FileService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerInterface $logger
    )
    {
        $this->logger = $logger;
    }

    public function createFileName(string $project_dir, string $folder_dir, string $file_name_without_extension, string $extension = 'json'): string
    {
        $now = new \DateTime();
        $now_formated = $now->format('Y-m-d_H:i');
        $file_name = $project_dir . '/';
        if ($folder_dir && $folder_dir != '') {
            $file_name .= $folder_dir . '/';
        }

        $file_name .= $now_formated . '_' . $file_name_without_extension;
        $full_file_name = $file_name . '.' .$extension;
        $loop_index = 0;
        while(file_exists($full_file_name)) {
            $full_file_name = $file_name . '_' . $loop_index . '_.' . $extension;
            $loop_index+=1;
        }
        return $full_file_name;
    }

}
