<?php

namespace App\Models;


class SyncRequestStatusRequest {
    public string $entity_name;

    /**
     * @var string[]|null
     */
    public $list_of_uuids;

    /**
     * @var \DateTime
     */
    public \DateTime $created_at;

    /**
     * @return \DateTime
     */
    public function getCreatedAt(): string
    {
        return $this->created_at;
    }

    /**
     * @param \DateTime $created_at
     */
    public function setCreatedAt(mixed $created_at): void
    {
        $this->created_at = $created_at;
    }
}
