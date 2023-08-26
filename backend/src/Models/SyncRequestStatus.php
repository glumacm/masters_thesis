<?php

namespace App\Models;

use App\Enum\SyncRequestStatusEnum;

class SyncRequestStatus {
    public string $entity_name;
    public string $uuid;
    /**
     * @var SyncRequestStatusEnum
     */
    public mixed $status;
    public \DateTime $created_at;
}
