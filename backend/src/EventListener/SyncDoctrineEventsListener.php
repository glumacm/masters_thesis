<?php
// src/EventListener/SearchIndexer.php
namespace App\EventListener;

//use App\Entity\Product;
use App\Enum\SyncDoctrineEventActionEnum;
use App\Service\MergeService;
use App\Service\PushService;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\Bundle\DoctrineBundle\EventSubscriber\EventSubscriberInterface;
use Doctrine\ORM\Event\LifecycleEventArgs;

//use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Events;

//#[AsEventListener(event: Events::preUpdate,method: 'preUpdate')]
class SyncDoctrineEventsListener implements EventSubscriberInterface
{
    /**
     * SyncDoctrineEventsListener se obnasa kot SERVICE. Torej ga lahko injectam v controller in tam upravljam z njim!!!
     */

    /**
     * @var PushService
     */
    private PushService $push_service;

    private MergeService $merge_service;

    private string $agent_id = 'ALLAGENTS';  # podatek o Agentu, ki je sprozil akcijo. Naceloma bomo to prejeli iz zahteve v controllerju!

    public function __construct(
        PushService $push_service,
        MergeService $merge_service,
    ) {

        $this->push_service  = $push_service;
        $this->merge_service = $merge_service;

        $push_service->logData(sprintf('ZACELO SE JE  %s', $this->agent_id));
    }

    public function getSubscribedEvents(): array
    {
        return [
            Events::postUpdate,
            Events::postPersist,
            Events::postRemove,
        ];
    }


    // the listener methods receive an argument which gives you access to
    // both the entity object of the event and the entity manager itself
//    public function preUpdate(LifecycleEventArgs $args): void
    public function postUpdate(LifecycleEventArgs $args): void
    {
        // $entity = $args->getObject();

        $entity_name = (new \ReflectionClass($args->getObject()))->getShortName();
        $this->push_service->logData('A TOOOOOOOOO DELLLLLLLLAAAAAAAAA ??????????????????????/????');
        $this->push_service->logData(sprintf('My Way is my decision:  %s', $this->agent_id));

        $serializer     = $this->merge_service->get_serializer();
        $published_uuid = $this->push_service->publishUpdate(
            $serializer->serialize(
                $this->push_service->createPublishData($this->agent_id, $entity_name, $args->getObject(), SyncDoctrineEventActionEnum::UPDATE)
                ,
                'json'
            ),
            2,
            sprintf('%s/%s', PushService::BASE_TOPIC, 'entities')
        );

        // if this listener only applies to certain entity types,
        // add some code to check the entity type as early as possible
        //        if (!$entity instanceof Product) {
        //            return;
        //        }

        $entityManager = $args->getObjectManager();
    }

    public function postPersist(LifecycleEventArgs $args): void
    {
        // Ocitno PERSIST pomeni CREATE v Doctrine contextu
        $entity_name = (new \ReflectionClass($args->getObject()))->getShortName();
        $serializer     = $this->merge_service->get_serializer();
        $published_uuid = $this->push_service->publishUpdate(
            $serializer->serialize(
                $this->push_service->createPublishData($this->agent_id, $entity_name, $args->getObject(), SyncDoctrineEventActionEnum::NEW)
                ,
                'json'
            ),
            2,
            sprintf('%s/%s', PushService::BASE_TOPIC, 'entities')
        );
    }

    public function postRemove(LifecycleEventArgs $args): void
    {
        $entity_name = (new \ReflectionClass($args->getObject()))->getShortName();
        $serializer     = $this->merge_service->get_serializer();
        $published_uuid = $this->push_service->publishUpdate(
            $serializer->serialize(
                $this->push_service->createPublishData($this->agent_id, $entity_name, $args->getObject(), SyncDoctrineEventActionEnum::DELETE)
                ,
                'json'
            ),
            2,
            sprintf('%s/%s', PushService::BASE_TOPIC, 'entities')
        );
    }

    public function setAgentId(string $newAgentId): void
    {
        $this->agent_id = $newAgentId;
    }


}
