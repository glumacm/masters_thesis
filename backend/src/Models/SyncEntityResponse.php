<?php

namespace App\Models;

use App\Enum\SyncEntityStatusEnum;
use App\Service\MergeProcessResult;

class SyncEntityResponse {

    /**
     * @var SyncEntityStatusEnum
     */
    public mixed $status;
    /**
     * @var MergeProcessResult
     */
    public mixed $merged_data;

    public string $record_uuid;

    public \DateTime $last_modified;

    public mixed $error;
}
