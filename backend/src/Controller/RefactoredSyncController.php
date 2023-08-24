<?php

namespace App\Controller;

use App\Entity\SyncJob;
use App\Entity\TestEntity;
use App\Entity\TheTest;
use App\Enum\SyncBatchSingleEntityStatusEnum;
use App\Enum\SyncEntityStatusEnum;
use App\EventListener\SyncDoctrineEventsListener;
use App\Models\SyncBatchSingleEntityRequest;
use App\Models\SyncBatchSingleEntityResponse;
use App\Models\SyncEntityResponse;
use App\Repository\SyncJobRepository;
use App\Repository\TestEntityRepository;
use App\Service\ApiNameConverter;
use App\Service\ConflictConfigurationService;
use App\Service\GenericService;
use App\Service\MergeProcessResult;
use App\Service\MergeService;
use App\Service\PushService;
use App\Service\SynchronizationSyncedObject;
use App\Service\SynchronizationSyncEntityPostData;
use App\Service\SynchronizationSyncEntityRecord;
use App\Service\SynchronizationSyncResponse;
use App\Service\SynchronizationSyncStatus;
use App\Service\SyncService;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Ramsey\Uuid\Uuid;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\File;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class RefactoredSyncController extends AbstractController
{

    #[Route('api/refactored/store_fe_database_export/{database_name}/{browser_name}/{simulation_name}', name: 'store_fe_database_export', methods: ['POST'])]
    public function store_fe_database_export(
        Request $request,
        string $database_name,
        string $browser_name,
        string $simulation_name,
        MergeService $mergeService,
        LoggerInterface $logger,
        string $projectDir
    ): JsonResponse {

        $now = new \DateTime();
        $simulation_dir = '/simulation';
        $now_formated = $now->format('Y-m-d_H:i');
        $filename = $simulation_name . '_' . $browser_name . '_' . $database_name . '.json';
        $full_filename = $projectDir . $simulation_dir . '/'.$now_formated.'_' . $filename;
        $loop_index = 1;

        while (file_exists($full_filename)) {
            $full_filename = $projectDir . $simulation_dir . '/'.$now_formated. '_' . $loop_index.'_' . $filename;
            $loop_index+=1;
        }

        file_put_contents($full_filename, $request->getContent());

        return new JsonResponse([
            'status' => 200,
            'message' => 'SUCCESS'
        ]);
    }

    #[Route('api/refactored/initiate_initial_be_db_state', name:'initial_be_db_state', methods: ['GET'])]
    public function initial_be_db_state(
        Request $request,
        Connection $connection,
        string $projectDir,
    )
    {
        $sqlFile = sprintf('%s/public/%s', $projectDir, 'test_entity_initial_state.sql');

        $queries = file_get_contents($sqlFile);

        $connection->executeStatement($queries);
        return new JsonResponse(['success' => 'HasTheSameAnswer']);
    }

    #[Route('api/refactored/fake_update/{newId}/{agentId<\d+>?1}', name: 'fake_update', methods: ['GET'])]
    public function tt(
        Request $request,
        string $newId,
        string $agentId,
        EntityManagerInterface $em,
        PushService $pushService,
        SyncDoctrineEventsListener $syncDoctrineEventsListener,
    )
    {
        $theTestRepository = $em->getRepository(TheTest::class);
        /**
         * @var TheTest $found
         */
        $found = $theTestRepository->find(1);
        $syncDoctrineEventsListener->setAgentId('OneForALLandALLForOne');
//        $found->setUuid(sprintf('UpdatedUuid%s', $newId));
        $found->setName(sprintf('NewName%s', $newId));
        $em->flush();
        return new JsonResponse(['success' => true]);
    }


    #[Route('api/refactored/delete_item/{newId}/{agentId<\d+>?1}', name: 'fake_delete', methods: ['GET'])]
    public function removeValue(
        Request $request,
        string $newId,
        string $agentId,
        EntityManagerInterface $em,
        PushService $pushService,
        SyncDoctrineEventsListener $syncDoctrineEventsListener,
    )
    {
        $pushService->logData('TESTING DELETE');
        $testEntity = $em->getRepository(TestEntity::class);
        $found = $testEntity->find($newId);
        $syncDoctrineEventsListener->setAgentId('OneForALLandALLForOne');
        $em->remove($found);
        $em->flush();
        return new JsonResponse(['success' => true]);
    }

    #[Route('api/refactored/send_new_message', name: 'mercure_new_static_message', methods: ['GET'])]
    public function test_mercure(
        HubInterface $hub,
        PushService $pushService,
        GenericService $generic_service,
    )
    {
        /**
         * @var TestEntityRepository $repository
         */
        $repository = $generic_service->findRepositoryFromString(TestEntity::class);
        $alive1 = new TestEntity();
        $alive1->setUuid(Uuid::uuid4());
        $alive1->setFirstInput('something1');
        $alive1->setSecondInput('something2');
        $repository->save($alive1,true,false, true);
        $alive2 = new TestEntity();
        $alive2->setUuid(Uuid::uuid4());
        $alive2->setFirstInput('something1');
        $alive2->setSecondInput('something2');
        $repository->save($alive2,true,false, true);
        return new Response('Publish success?');
    }

    #[Route('api/refactored/import_test_dexie_database_file', name: 'dexie_test_database_file', methods: ['GET'])]
    public function test_dexie_database_file(
        string $projectDir
//    ): Response {
    ): JsonResponse {
        // You only need to provide the path to your static file
        // i.e Sending a file from the resources folder in /web
        // in this example, the TextFile.txt needs to exist in the server
//        $publicResourcesFolderPath = $this->get('kernel')->getRootDir() . '/../web/public-resources/';
        $filename = "sync_initial_test_dexie_database.json";

        // This should return the file located in /mySymfonyProject/web/public-resources/TextFile.txt
        // to being viewed in the Browser
        $content = file_get_contents($projectDir.'/public/'. $filename);
        $response = new Response($content);
        $response->headers->set('Content-Disposition', HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT,$filename));
        return new JsonResponse($content);
    }

    #[Route('api/refactored/sync', name: 'app_refactored_sync')]
    public function index(): JsonResponse
    {
        return $this->json([
            'message' => 'Welcome to your new controller!',
            'path' => 'src/Controller/RefactoredSyncController.php',
        ]);
    }

    #[Route('api/refactored/sync/test-code', name: 'test_code', methods: ['GET'])]
    public function test_code(
        GenericService $genericService,
        ConflictConfigurationService $conflictConfigurationService,
    ): Response
    {
        $response = new Response();
        $response->headers->set('Content-Type', 'application/json');

        $testing_example_conflict_groups = $conflictConfigurationService->get_conflict_field_groups_by_entity_name('testing_example');
//        var_dump($testing_example_conflict_groups);
//        var_dump($conflictConfigurationService->get_field_name_from_conflict_group($testing_example_conflict_groups[0]));
//        var_dump($conflictConfigurationService->get_merge_resolution_from_conflict_group($testing_example_conflict_groups[0]));
//        var_dump($conflictConfigurationService->get_default_merge_resolution());
//
//        var_dump('Non-existend data');
//        var_dump($conflictConfigurationService->get_conflict_field_groups_by_entity_name('kad_se_smije_ivana')); # Returns NULL

        $response->setContent(json_encode(''));
        return $response;
    }

    #[Route('api/refactored/batch-single-entity-sync-merging/{entity_name}', name: 'refactored-batch-single-entity-sync-merging', methods: ['POST'])]
    public function batch_sync_merging(
        Request $request,
        string $entity_name, #TODO: premisliti, ali bi poslal vse entitete naenkrat, ali vsako posebej
        MergeService $merge_service,
        GenericService $generic_service,
        SyncService $sync_service,
        LoggerInterface $logger,
        ConflictConfigurationService $conflictConfigurationService,
        SyncDoctrineEventsListener $syncDoctrineEventsListener,
    ) {
        $response = new Response();
        $response->headers->set('Content-Type', 'application/json');
        $data_to_return = new SyncBatchSingleEntityResponse();
        $data_to_return->status = SyncBatchSingleEntityStatusEnum::COMPLETE_SUCCESS->name;
        $data_to_return->sync_records = array();
        $serializer = $merge_service->get_serializer();

        /**
         * @var SyncBatchSingleEntityRequest $request_model
         */
        $request_model = $serializer->deserialize($request->getContent(), SyncBatchSingleEntityRequest::class, 'json');
        $syncDoctrineEventsListener->setAgentId($request_model->agent_id);

        $sync_job = new SyncJob();
        $sync_job->setJobUuid($request_model->request_uuid);
        $sync_job->setEntityName($entity_name);
        $sync_job_repository = $generic_service->findRepositoryFromString(SyncJob::class);
        $sync_job_repository->save($sync_job, flush: true);


        $entity_name_reflection_class = $generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            \Sentry\captureMessage('batch_sync_merging: Entity  ' . $entity_name . ' does not exist');
            $data_to_return->status = SyncBatchSingleEntityStatusEnum::FATAL_ERROR->name;
            $response->setContent($serializer->serialize($data_to_return, 'json'));
            return $response;

        }

        /**
         * @var array
         */
        $batch_data = $serializer->deserialize(
            ($serializer->serialize($request_model->data, 'json')),
            $entity_name_reflection_class->getName() . '[]',
            'json'
        );


        $syncRecords = array(); // $sync_service->sync_single_record($entity_name, )
        try {
            foreach ($batch_data as $batch_item) {
                /**
                 * $batch_item -> PREDPOSTAVLJAMO, DA BOMO VEDNO DOBILI NOTER `lastModified` podatek!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                 */
                $syncData = $sync_service->sync_single_record($entity_name, $batch_item);
                if ($syncData->status != SyncEntityStatusEnum::SUCCESS) {
                    $data_to_return->status = SyncBatchSingleEntityStatusEnum::PARTIAL_SUCESS->name;
                }
                $syncRecords[] = $syncData;
            }
        }catch (\Exception $exception) {
            // To je bilo potrebno narediti za CONCURRENCYJA... namrec istocasno se je poskusalo dodati objekte z istimi UUID-ji
            // ker pa ne razumem kaj hoce Symfony, je potrebno zajeti globalen exception, ker drugace
            // sploh ne zazna napake....
            $syncRecords = [];
            foreach ($batch_data as $batch_item) {
                $data_to_return = new SyncEntityResponse();
                $data_to_return->status = SyncEntityStatusEnum::CONCURRENCY_PROBLEM->name;
                $data_to_return->error = $exception->getMessage();
                $data_to_return->record_uuid = $batch_item->getUuid();
                $syncRecords[] = $data_to_return;
            }
        }

        $sync_job->setStatus('finished');
        $sync_job_repository->save($sync_job, flush: true);

        $data_to_return->sync_records = $syncRecords;
        $response->setContent($serializer->serialize($data_to_return, 'json'));
        return $response;
    }

    #[Route('api/refactored/sync-merging/{entity_name}/{object_uuid}', name: 'refactored-sync-merging', methods: ['POST'])]
    public function sync_merging(
        Request $request,
        string $entity_name,
        MergeService $merge_service,
        GenericService $generic_service,
        LoggerInterface $logger,
        ConflictConfigurationService $conflictConfigurationService,
    )
    {

        $response = new Response();
        $response->headers->set('Content-Type', 'application/json');
        $data_to_return = new SyncEntityResponse();
        $data_to_return->status = SyncEntityStatusEnum::SUCCESS->name;

//        $logger->warning('This is entity name: ' . $entity_name);
//        $logger->warning('This is entity name:78 ' . $generic_service->get_class_from_string($entity_name));

        # Dobimo razred entitete, ki jo moramo sinhronizirati
        $entity_name_reflection_class = $generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            \Sentry\captureMessage('Entity  ' . $entity_name . ' does not exist');
            # TODO: Vrniti je potrbno napako v sklopu responsea in SyncEntityResponse objekta!
            return new JsonResponse(data: json_encode('Entity does not exist!'));
        }

        $serializer = $merge_service->get_serializer();

        /**
         * @var TheTest $object_data
         */
        $object_data = $serializer->deserialize(
            ($request->getContent()),
            $entity_name_reflection_class->getName(),
            'json'
        );

        if (is_null($object_data->getUuid())) {
            throw new Exception('UUID field on entity: ' . $entity_name . ' is not set!');
        }


        # Dobimo obstojec ojekt, ki ga bomo singronizirali s podatki iz FE
        $object_data_from_db = $merge_service->get_entity_object($entity_name_reflection_class->getName(), $object_data->getUuid());




        $repository = $generic_service->findRepositoryFromString($entity_name);
//        if (!$object_data_from_db && property_exists(json_decode($request->getContent()), 'id')) {
        if (is_null($object_data_from_db)) {
            //@dilema Predpostavljam, da vedno dobim UUID
            /*
             * var EntityRepository
             */
            $repository->save(
                $object_data,
                flush: true,
                persist: true
            );


            $new_data = new MergeProcessResult();
            $new_data->conflicts = array();
            $new_data->merged_db_object = $object_data;
            $data_to_return->last_modified =  $new_data->merged_db_object->getLastModified(); # $object_data->getLastModified();
            $data_to_return->merged_data = $new_data;
            $data_to_return->status = SyncEntityStatusEnum::SUCCESS->name;

            $response->setContent($serializer->serialize($data_to_return, 'json'));

            return $response;

        }

        /**
         * @var MergeProcessResult $new_data
         */
        $new_data = $merge_service->start_merger_process_latest($object_data, $entity_name, $object_data_from_db);

        if ($new_data and $new_data->merged_db_object) {
            if (($new_data->conflicts == null or sizeof($new_data->conflicts) == 0)) {
                try {
                    $repository->save(
                        $new_data->merged_db_object,
                        flush: true,
                        merge: true,
                        persist: false
                    );
                } catch (Exception $e) {
//                    var_dump('Error occured while saving merged data to db!!!');
                    $logger->emergency('Error occured while saving merged data to db!!!');
                    $logger->emergency($e->getMessage());
                    throw new \Exception(message: 'Error occured while saving merged data to db!!!', previous: $e);
                }
            } else {
                $data_to_return->status = SyncEntityStatusEnum::CONFLICT->name;
            }
        }

        /*
         * 1. Gremo skozi vse lastnosti, ki smo jih poslali preko POST-a -> ubistvi nam to ze resi DESERIALIZER
         * 2. nastavimo nove vrednosti v razred in IGNORIRAMO neobstojece
         * 3. [IF]
         * 3.1 Ce obstaja objekt v DB moramo primerjati tega z novim objektom
         * 3.2 Ce ne obstaja, direktno dodaj v bazo
         */

//        $logger->warning('This is json data');
//        $logger->warning($serializer->serialize($object_data,'json'));


        $data_to_return->merged_data = $new_data;
        $data_to_return->last_modified = $new_data->merged_db_object->getLastModified(); # $new_data->last_modified;

        $response->setContent($serializer->serialize($data_to_return, 'json'));
        return $response;

    }

    #[Route('api/sync-entity56', name: 'sync_entity', methods: ['POST'])]
    public function syncEntity(
        Request $request,
        GenericService $genericService,
        LoggerInterface $logger,
        MergeService $mergeService,
    ): Response {
        $response_message = new ResponseMessage(
            code: 200,
            message: 'SUCCESS',
            type: ResponseMessageType::SUCCESS,
            data: null
        );
        $response         = new Response();
        $response->headers->set('Content-Type', 'application/json');

//        usleep(5 * (pow(10, 6))); // 5 s # Za testiranje scenarija, ko pride do timeouta (na strani clienta)

        # Pripravimo serializer za pretvarjanje podatkov
        $serializer = $mergeService->get_serializer(include_get_set_method_normalizer: true);

        # Pretvorimo podatek iz Requesta
        /** @var SynchronizationSyncEntityPostData $decoded_json_content */
        $decoded_json_content = $serializer->deserialize(
            ($request->getContent()),
            SynchronizationSyncEntityPostData::class,
            'json'
        );

        $sync_response_data = new SynchronizationSyncResponse();



        # Primer strukture za odgovor
//        $copy_sync_response_data = new SynchronizationSyncResponse(
//            sync_status: SynchronizationSyncStatus::COMPLETE,
//            list_of_finished: array(
//                new SynchronizationSyncedObject(
//                    local_uuid: $decoded_json_content->data[0]->local_uuid,
//                    last_modified: (new \DateTime())->format(\DateTime::ATOM)
//                )
//            )
//        );
//        $response_message->setData(($copy_sync_response_data));
//        $response->setContent($serializer->serialize($response_message, 'json'));

        if (!$decoded_json_content->job_uuid) {
            $response_message = new ResponseMessage(
                code: 400,
                message: 'You must provide uuid for sync process:',
                type: ResponseMessageType::MISSING_REQUIRED_FIELDS,
            );
            $sync_response_data->setError($response_message);
            $sync_response_data->setSyncStatus(SynchronizationSyncStatus::FAILED_ALL);
            $response->setContent($serializer->serialize($sync_response_data, 'json'));
            return $response;
        }

        $newJobEntry = new SyncJob();
        $newJobEntry->setJobUuid($decoded_json_content->job_uuid);
        /**
         * @var SyncJobRepository $sync_job_repository
         */
        $sync_job_repository = $genericService->findRepositoryFromString(SyncJob::class);

        $sync_job_repository->save($newJobEntry, flush: true);


//        $logger->warning('This is entittyName: ' . $decoded_json_content->entity_name);
        /** @var SynchronizationSyncEntityRecord[] $encoded_data_array */
        $encoded_data_array = $decoded_json_content->data;

        try {
            $repository = $genericService->findRepositoryFromString(
                $decoded_json_content->entity_name
            ); // 'App\Entity\TheTest'
        } catch (\Exception $e) {
            $response_message = new ResponseMessage(
                code: 400,
                message: 'Repository cannot be found for entity:' . $decoded_json_content->entity_name,
                type: ResponseMessageType::REPOSITORY_NOT_FOUND,
            );
            $newJobEntry->setStatus('error');
            $sync_job_repository->save($newJobEntry, true);
            $sync_response_data->setSyncStatus(SynchronizationSyncStatus::FAILED_ALL);
            $sync_response_data->setError($response_message);
            return $response->setContent($serializer->serialize($sync_response_data, 'json'));
        }


        $entity_identifier_field = $genericService->get_entity_identifier_property($decoded_json_content->entity_name);
        $logger->warning("THIS IS IDENTIFIER: {$entity_identifier_field}");


        $list_of_successfully_processed = [];

        // Od tega dela naprej smo pripravljeni za zdruzevanje podatkov
        /**
         * 1. potrebno je dobiti konfiguracijo fieldov
         * 2. iterirati skozi vsak specificen field
         * 3. ce field nima nekega konkretno nastavljenega policy-ja, se vzame enega default
         *
         *
         */


        foreach ($encoded_data_array as $single_record) {

            $test_me = $serializer->denormalize($single_record->record, $decoded_json_content->entity_name, 'json');
            // ZAKAJ BI SPLOH RABIL pretvarjati podatek v entiteto?


            if (!in_array($entity_identifier_field, array_keys($single_record->record))) {
                // INSERT MODE
                // 2.1 serialize data to entity data
                /**
                 * @var TheTest $data_set_into_object
                 */
                $reflection_entity    = new ReflectionClass($decoded_json_content->entity_name);
                $data_set_into_object = $genericService->update_object_by_fields(
                    $single_record->record,
                    $decoded_json_content->entity_name,
                    $reflection_entity->newInstance()
                );
                // If we would not use lastModified data in the logger after `save` then we could omit `persist:true` parameter!!!!
                $repository->save(
                    $data_set_into_object,
                    flush: true,
                    persist: true
                ); // added persist:true because we need to get this data after entity inserted (ottherwise we get ERROR about retrieving data before initializiation!!!!!!!

                // TODO: Fix code so that lastModified data is retrieved dynamically
                $entity_processed                 = new SynchronizationSyncedObject(
                    local_uuid: $single_record->local_uuid,
                    last_modified: $data_set_into_object->getLastModified()->format(\DateTime::ATOM)
                );
                $list_of_successfully_processed[] = $entity_processed;
            } else {
                // UPDATE MODE
                // 2. find object based on identificator
                $entity_class       = new ReflectionClass($decoded_json_content->entity_name);
                $identifiator_field = $entity_class->getProperty($entity_identifier_field);
                $my_id              = $single_record->record[$entity_identifier_field];
                settype($my_id, $identifiator_field->getType()->getName());
                $entity_db_data = $repository->find($my_id);
                if (!$entity_db_data) {
                    // PROCESS this with error or another handler!
                    continue;
                }
//                $logger->warning(
//                    'This is data before save:  ' . $entity_db_data->getLastModified()->format('Y-m-d H:i:m:ss')
//                );
//                $logger->warning('singlerecord->record uuid field  ' . $single_record->record[$entity_identifier_field]);
                $logger->warning($serializer->serialize($entity_db_data, 'json'));
                $data_to_save = $genericService->update_object_by_fields(
                    $single_record->record,
                    $decoded_json_content->entity_name,
                    $entity_db_data
                );
//                $logger->warning($serializer->serialize($data_to_save, 'json'));
//                $logger->warning("What is object type:  " . get_class($data_to_save));
//                $logger->warning(json_encode($data_to_save));
                $repository->save($data_to_save, flush: true);
                $logger->warning(
                    'This is data after save:  ' . $data_to_save->getLastModified()->format('Y-m-d H:i:m:ss')
                );
                // 3. check last_modified data
                // 4. add FE changed data to BE data

                $entity_processed                 = new SynchronizationSyncedObject(
                    local_uuid: $single_record->local_uuid,
                    last_modified: $data_to_save->getLastModified()->format(\DateTime::ATOM)
                );
                $list_of_successfully_processed[] = $entity_processed;
            }

            // 5. store data
            // 6. mark data as synched in some structure (that will be sent to FE)
            // 7. return list of successfully stored data (localUUID + lastModified) so that FE can have the last data stored
//            $logger->warning('This is data in loop: ');
//            $logger->warning("{$single_record}");
        }

        $sync_response_data->setSyncStatus(
            sizeof($decoded_json_content->data) == sizeof(
                $list_of_successfully_processed
            ) ? SynchronizationSyncStatus::COMPLETE->name : (sizeof(
                $list_of_successfully_processed
            ) == 0 ? SynchronizationSyncStatus::FAILED_ALL->name : SynchronizationSyncStatus::PARTIAL->name)
        );
        $sync_response_data->setFinishedSuccessfully($list_of_successfully_processed);
        $response_message->setData($sync_response_data);
        $newJobEntry->setStatus('finished');
        $sync_job_repository->save($newJobEntry, true);
        return $response->setContent($serializer->serialize($response_message, 'json'));
    }

}
