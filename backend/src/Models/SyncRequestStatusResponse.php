<?php

namespace App\Models;


class SyncRequestStatusResponse {
    public string $entity_name;

    /**
     * @var SyncRequestStatus[]|null
     */
    public $list_of_requests_statuses;

    public \DateTime $created_at;
}
