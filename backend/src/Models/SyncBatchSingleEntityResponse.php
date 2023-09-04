<?php

namespace App\Models;

use App\Enum\SyncBatchSingleEntityStatusEnum;
use App\Service\MergeProcessResult;

class SyncBatchSingleEntityResponse {
    /**
     * @var SyncBatchSingleEntityStatusEnum
     */
    public mixed $status;

    public mixed $error;

    /**
     * @var SyncEntityResponse[]|null
     */
    public $sync_records;

    public \DateTime $created_at;
}
