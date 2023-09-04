<?php

namespace App\Models;

class SyncBatchSingleEntityRequest
{
    public string $agent_id;
    public string $request_uuid;
    public mixed $data;
}
