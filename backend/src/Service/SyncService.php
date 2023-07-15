<?php

namespace App\Service;

use App\Entity\TheTest;
use App\Enum\SyncEntityStatusEnum;
use App\Models\SyncEntityResponse;
use App\Repository\InitialRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

use Symfony\Component\DependencyInjection\ParameterBag\ContainerBagInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Serializer\SerializerInterface;


class SyncService
{
    private $em;
    private $serializer;
    private $logger;
    private $generic_service;
    private $merge_service;
    private $params;
    private $conflictConfigurationService;

    public function __construct(
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        LoggerInterface $logger,
        \App\Service\GenericService $generic_service,
        \App\Service\MergeService $merge_service,
        ContainerBagInterface $params,
        ConflictConfigurationService $conflictConfigurationService,
    ) {
        $this->em                           = $em;
        $this->serializer                   = $serializer;
        $this->logger                       = $logger;
        $this->generic_service              = $generic_service;
        $this->merge_service                = $merge_service;
        $this->params                       = $params;
        $this->conflictConfigurationService = $conflictConfigurationService;
    }

    /**
     * @param string $entity_name
     * @param mixed $deserialized_item
     * @return SyncEntityResponse
     */
    public function sync_single_record(string $entity_name, mixed $deserialized_item): SyncEntityResponse {
        $data_to_return = new SyncEntityResponse();
        $data_to_return->status = SyncEntityStatusEnum::SUCCESS->name;

        $entity_name_reflection_class = $this->generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            \Sentry\captureMessage('Entity  ' . $entity_name . ' does not exist');
            # TODO: Vrniti je potrbno napako v sklopu responsea in SyncEntityResponse objekta!
            return new JsonResponse(data: json_encode('Entity does not exist!'));
        }

        $serializer = $this->merge_service->get_serializer();

        $object_data = $deserialized_item;

//        $this->logger->warning('This is entity name: ' . $entity_name);
//        $this->logger->warning('This is entity name:78 ' . $this->generic_service->get_class_from_string($entity_name));

        # Dobimo razred entitete, ki jo moramo sinhronizirati
        $entity_name_reflection_class = $this->generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            \Sentry\captureMessage('Entity  ' . $entity_name . ' does not exist');
            # TODO: Vrniti je potrbno napako v sklopu responsea in SyncEntityResponse objekta!
            $data_to_return->status = SyncEntityStatusEnum::ENTITY_DOES_NOT_EXIST->name;
            return $data_to_return;
//            return new JsonResponse(data: json_encode('Entity does not exist!'));
        }


        if (is_null($object_data->getUuid())) {
            throw new Exception('UUID field on entity: ' . $entity_name . ' is not set!');
            $data_to_return->status = SyncEntityStatusEnum::MISSING_UUID_DATA->name;
            return $data_to_return;
        }

        $data_to_return->record_uuid = $object_data->getUuid();


        # Dobimo obstojec ojekt, ki ga bomo singronizirali s podatki iz FE
        $object_data_from_db = $this->merge_service->get_entity_object($entity_name_reflection_class->getName(), $object_data->getUuid());




        $repository = $this->generic_service->findRepositoryFromString($entity_name);
//        if (!$object_data_from_db && property_exists(json_decode($request->getContent()), 'id')) {
        if (is_null($object_data_from_db)) {
            //@dilema Predpostavljam, da vedno dobim UUID

//##//            $repository->beginTransaction();
//##//            $this->em->beginTransaction();
//##//            $em->beginTransaction();
//##//            $this->em->clear();
//##//            $error = null;
//##//            try {
//##//                // Pricakujem da lahko pride do CONCURRENCY PROBLEMA!
//##//                $repository->save(
//##//                    $object_data,
//##//                    flush: true,
//##//                    persist: true
//##//                );
//##////                $repository->commit();
//##//                $em->commit();
//##////                $this->em->commit();
//##//            } catch (UniqueConstraintViolationException $exception) {
//##//                $this->logger->warning('#######.....#######.....#######JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
//##//                $error = $exception;
//##////                $this->em->rollback();
//##////                $this->em->close();
//##////                $repository->rollback();
//##//                $em->rollback();
//##////                $this->em->rollback();
//##//            }
            $this->em->wrapInTransaction(function () use ($repository, $object_data) {
                $repository->save(
                    $object_data,
                    flush: true,
                    persist: true
                );
            });
//            try {
//
//            } catch (UniqueConstraintViolationException $exception) {
//                $this->logger->warning('DODOBFOGSDFOSAKJ STE SLI IURA RKAUC?A?@#?$@#?#$??');
//                throw $exception;
//            }

//            PREJSNJA DELUJOCA LOGIKA - ki ni podpirala concurrencyja
            $new_data = new MergeProcessResult();
            $new_data->conflicts = array();
            $new_data->merged_db_object = $object_data;
            $data_to_return->merged_data = $new_data;
            $data_to_return->last_modified = $object_data->getLastModified();
            $data_to_return->status = SyncEntityStatusEnum::SUCCESS->name;

//            $new_data = null;
//            if (!$error) {
//                $new_data = new MergeProcessResult();
//                $new_data->conflicts = array();
//                $new_data->merged_db_object = $object_data;
//                $data_to_return->merged_data = $new_data;
//                $data_to_return->last_modified = $object_data->getLastModified();
//                $data_to_return->status = SyncEntityStatusEnum::SUCCESS->name;
//            } else {
//                $data_to_return->status = SyncEntityStatusEnum::CONCURRENCY_PROBLEM;
//            }
            $data_to_return->merged_data = $new_data;

//            $response->setContent($serializer->serialize($data_to_return, 'json'));
//
//            return $response;
            return $data_to_return;

        }

        /**
         * @var MergeProcessResult $new_data
         */
        $new_data = $this->merge_service->start_merger_process_latest($object_data, $entity_name, $object_data_from_db);

        if ($new_data and $new_data->merged_db_object) {
            if (($new_data->conflicts == null or sizeof($new_data->conflicts) == 0)) {
                try {
                    $repository->save(
                        $new_data->merged_db_object,
                        flush: true,
                        merge: true,
                        persist: false
                    );
                    $new_data->last_modified = $new_data->merged_db_object->getLastModified();
                } catch (Exception $e) {
                    var_dump('Error occured while saving merged data to db!!!');
                    $this->logger->emergency('Error occured while saving merged data to db!!!');
                    $this->logger->emergency($e->getMessage());
                    $data_to_return->status = SyncEntityStatusEnum::UNSUCCESSFUL_SAVE_TO_DB;
                    $data_to_return->error = $e;
//                    throw new \Exception(message: 'Error occured while saving merged data to db!!!', previous: $e);
                }
            } else {
                $data_to_return->status = SyncEntityStatusEnum::CONFLICT->name;
                $new_data->last_modified = $object_data_from_db->getLastModified();
            }
        }

        /*
         * 1. Gremo skozi vse lastnosti, ki smo jih poslali preko POST-a -> ubistvi nam to ze resi DESERIALIZER
         * 2. nastavimo nove vrednosti v razred in IGNORIRAMO neobstojece
         * 3. [IF]
         * 3.1 Ce obstaja objekt v DB moramo primerjati tega z novim objektom
         * 3.2 Ce ne obstaja, direktno dodaj v bazo
         */

        $this->logger->warning('This is json data');
        $this->logger->warning($serializer->serialize($object_data,'json'));


        $data_to_return->merged_data = $new_data;
        $data_to_return->last_modified = $new_data->last_modified;
        return $data_to_return;

    }
}
