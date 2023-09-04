<?php

namespace App\Entity;

use App\Repository\SyncJobRepository;
use Cassandra\Date;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SyncJobRepository::class)]
#[ORM\HasLifecycleCallbacks]
class SyncJob
{
    const DEFAULT_RETRIES = 0;
    const DEFAULT_STATUS = 'in-progress'; # 'stopped'|'finished'|'canceled'

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $job_uuid = null;

    #[ORM\Column(length: 255)]
    private ?string $status = self::DEFAULT_STATUS;

    #[ORM\Column]
    private ?int $retries = self::DEFAULT_RETRIES;

    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?\DateTime $created_datetime;

    #[ORM\Column]
    private ?string $entity_name = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getJobUuid(): ?string
    {
        return $this->job_uuid;
    }

    public function setJobUuid(string $job_uuid): self
    {
        $this->job_uuid = $job_uuid;

        return $this;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;

        return $this;
    }

    public function getRetries(): ?int
    {
        return $this->retries;
    }

    public function setRetries(int $retries): self
    {
        $this->retries = $retries;

        return $this;
    }

    /**
     * @return string|null
     */
    public function getEntityName(): ?string
    {
        return $this->entity_name;
    }

    /**
     * @param string|null $entity_name
     */
    public function setEntityName(?string $entity_name): self
    {
        $this->entity_name = $entity_name;
        return $this;
    }



    #[ORM\PrePersist]
    public function onPrePersistSetCreatedDatetime()
    {
        $this->created_datetime = new \DateTime();
    }
}
