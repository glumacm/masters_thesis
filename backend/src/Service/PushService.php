<?php

namespace App\Service;

use App\Enum\SyncDoctrineEventActionEnum;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

class PushService {

    const BASE_TOPIC = 'https://example.com';
    const TOPIC= self::BASE_TOPIC . '/books';

    private $connection;

    /**
     * @var HubInterface
     */
    private HubInterface $hub;

    /**
     * @var LoggerInterface
     */
    private LoggerInterface $logger;

    public function __construct(
        HubInterface $hub,
        LoggerInterface $logger,
    ) {
        $this->hub = $hub;
        $this->logger = $logger;
    }

    /**
     * @param string $data - Pricakujem podatek v stilu JSON string formatu -> zato ker hocemo od drugje vzeti logiko kako pretvoriti podatek v string (npr. serializer)
     * @param string $topic_id
     * @param string $status
     * @param string $topic
     * @return string
     */
    public function publishUpdate(string $data, string $topic_id, string $topic = self::TOPIC): string
    {
        // Example
        // $update = new Update(
        //     'https://example.com/books/1',
        //     json_encode(['status' => $status])
        // );

        $update = new Update(
            sprintf('%s', $topic), // Topics je lahko ARRAY!!!
            ($data)
        );
        return $this->hub->publish($update);

    }

    public function logData(string $data)
    {
        $this->logger->info($data);
    }

    public function createPublishData(
        string $agent_id,
        string $entity_name,
        mixed $object_data,
        SyncDoctrineEventActionEnum $eventAction,
    ): mixed {
        return [
            'agentId' => $agent_id,
            'entityName' => $entity_name,
            'objectData' => $object_data,
            'action' => $eventAction->name,
        ];
    }
}
