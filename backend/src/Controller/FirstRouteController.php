<?php

namespace App\Controller;

use App\Entity\SyncJob;
use App\Entity\TheTest;
use App\Repository\SyncJobRepository;
use App\Service\ApiNameConverter;
use App\Service\GenericService;
use App\Service\SynchronizationException;
use App\Service\SynchronizationExceptionCode;
use App\Service\SynchronizationGetEntityData;
use App\Service\SynchronizationPostData;
use App\Service\SynchronizationSyncedObject;
use App\Service\SynchronizationSyncEntityPostData;
use App\Service\SynchronizationSyncEntityRecord;
use App\Service\SynchronizationSyncingEntry;
use App\Service\SynchronizationSyncResponse;
use App\Service\SynchronizationSyncStatus;
use Doctrine\DBAL\Exception\NotNullConstraintViolationException;
use Exception;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Log\Logger;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\SerializerInterface;

use function Symfony\Component\String\u;
use Symfony\Component\PropertyInfo;

class FirstRouteController extends AbstractController
{

    #[Route('api/retry-close/{entity_name', name: 'retry_close', methods: ['POST'])]
    public function retryClose(
        Request $request,
        string $entity_name,
        LoggerInterface $logger,
        GenericService $genericService
    ): Response {
        $response = new Response();

        return $response;
    }

    #[Route('api/refactored-retry-re-evaluation/{entity_name}', name: 'refactored_retry_re_evaluation', methods: ['POST'])]
    public function refactoredRetryReEvaluation(
        Request $request,
        string $entity_name,
        LoggerInterface $logger,
        GenericService $genericService
    ): Response
    {
        $response = new Response();
        $response_data = new RefactoredRetryReEvaluationResponseData(status: 'SUCCESS', in_progress_sync_job_uuids: array());
        try {
            $phpDocExtractor = new PropertyInfo\Extractor\PhpDocExtractor();
            $typeExtractor   = new PropertyInfo\PropertyInfoExtractor(
                typeExtractors: [new PropertyInfo\Extractor\ConstructorExtractor([$phpDocExtractor]), $phpDocExtractor,]
            );
            $logger->warning('weeeelll    ' . json_encode(($request->getContent())));
            $serializer = new Serializer(normalizers: [
                new ArrayDenormalizer(),
                new GetSetMethodNormalizer(),
                new ObjectNormalizer(
                    null,
                    new ApiNameConverter(),
                    null,
                    $typeExtractor
                ),
                new ArrayDenormalizer()
            ], encoders: [new JsonEncoder()]);

            /**
             * @var RetryReEvaluationPostData $re_evaluation_post_data
             */
            $re_evaluation_post_data = $serializer->deserialize(
                ($request->getContent()),
                (RefactoredRetryReEvaluationPostData::class),
                'json'
            );
            $jobs_to_retry           = [];
            if ($re_evaluation_post_data->re_evaluations and sizeof($re_evaluation_post_data->re_evaluations) > 0) {
                /**
                 * @var SyncJobRepository $sync_job_repository
                 */
                $sync_job_repository = $genericService->findRepositoryFromString(SyncJob::class);


                $map_request_uuid_to_job = array();
                foreach ($re_evaluation_post_data->re_evaluations as $re_evaluation) {
                    $map_request_uuid_to_job[$re_evaluation->request_uuid] = $re_evaluation;
                }

                $request_uuids = array_keys(
                    $map_request_uuid_to_job
                );  // This could be already done in previous forloop

                $sync_jobs_still_running = array();

                foreach ($request_uuids as $request_uuid) {
                    /**
                     * @var RetryReEvaluation $value
                     */
                    $value = $map_request_uuid_to_job[$request_uuid];
                    $found_item = $sync_job_repository->findOneBy(
                        ['entity_name' => $entity_name, 'job_uuid' => $value->request_uuid]
                    );

                    if ($found_item) {
                        if (array_key_exists($found_item->getStatus(), ['in_progress'])) {
                            //                        $sync_jobs_still_running[] = $value->request_uuid;
                            $sync_jobs_still_running[] = $value->request_uuid;
                        } elseif (array_key_exists($found_item->getStatus(), ['cancelled', 'stopped'])) {
                            try {
                                $logger->warning('It is obvious that we are left ....');
                                // @todo: Do logic for merging data -> this can produce CONFLICTS!!! so be aware of that in RETRY use-case
                            } catch (Exception $exception) {
                                $sync_jobs_still_running[] = $value->request_uuid;
                            }
                        }
                        // else finished and then we do not send anything back
                    }
                }
                $response_data->setInProgressSyncJobUuids($sync_jobs_still_running);
                $response->setContent($serializer->serialize($sync_jobs_still_running, 'json'));
                $logger->warning('TAKE ME TO YOUR HOUSE CYNTHIA:  ' . $response->getContent());
            }

            $logger->warning('Before finishing  ......');
        }
        catch (Exception $exception) {
            $response_data->setStatus('ERROR');
            $response_data->setError($exception);
        }
        $response->setContent($serializer->serialize($response_data, 'json'));
        return $response;
    }



    #[Route('api/retry-re-evaluation/{entity_name}', name: 'retry_re_evaluation', methods: ['POST'])]
    public function retryReEvaluation(
        Request $request,
        string $entity_name,
        LoggerInterface $logger,
        GenericService $genericService
    ): Response {
        $response = new Response();

        $phpDocExtractor = new PropertyInfo\Extractor\PhpDocExtractor();
        $typeExtractor   = new PropertyInfo\PropertyInfoExtractor(
            typeExtractors: [new PropertyInfo\Extractor\ConstructorExtractor([$phpDocExtractor]), $phpDocExtractor,]
        );
        $logger->warning('weeeelll    ' . json_encode(($request->getContent())));
        $serializer = new Serializer(normalizers: [
            new ArrayDenormalizer(),
            new GetSetMethodNormalizer(),
            new ObjectNormalizer(
                null,
                new ApiNameConverter(),
                null,
                $typeExtractor
            ),
            new ArrayDenormalizer()
        ], encoders: [new JsonEncoder()]);

        /**
         * @var RetryReEvaluationPostData $re_evaluation_post_data
         */
        $re_evaluation_post_data = $serializer->deserialize(
            ($request->getContent()),
            (RetryReEvaluationPostData::class),
            'json'
        );

        /**
         * @var SyncJobRepository $sync_job_repository
         */
        $sync_job_repository = $genericService->findRepositoryFromString(SyncJob::class);


        $map_request_uuid_to_job = array();
        foreach ($re_evaluation_post_data->re_evaluations as $re_evaluation) {
            $map_request_uuid_to_job[$re_evaluation->request_uuid] = $re_evaluation;
        }

        $request_uuids = array_keys($map_request_uuid_to_job);  // This could be already done in previous forloop

        $sync_jobs_still_running = array();

        foreach ($request_uuids as $request_uuid) {
            /**
             * @var RetryReEvaluation $value
             */
            $value = $map_request_uuid_to_job[$request_uuid];
            $found_item = $sync_job_repository->findOneBy(['entity_name' => $entity_name, 'job_uuid' => $value->request_uuid]);

            if ($found_item) {
                if (array_key_exists($found_item->getStatus(), ['in-progress'])) {
                    $sync_jobs_still_running[] = $value;
                } elseif (array_key_exists($found_item->getStatus(), ['cancelled', 'stopped'])) {
                    // @todo: Do logic for merging data -> this can produce CONFLICTS!!! so be aware of that in RETRY use-case

                }
            }

            // if stopped,finished, cancelled, done -> we do not send it back which indicates that we do not need to retry it anymore
            if ($found_item and !array_key_exists($found_item->getStatus(), ['cancelled', 'stopped', 'finished', 'done'])) {
                $sync_jobs_still_running[] = $value;
            }
        }


        $logger->warning('What is entitty name ' . $entity_name);
        $logger->warning('jiggle a little while ago');
        $response->setContent(json_encode(['jiggle' => 'a little while ago']));

        $logger->warning('DATA from MAPPER: ' . json_encode($map_request_uuid_to_job));
        $response_data = $serializer->serialize($sync_jobs_still_running, 'json');
        $logger->warning('DATA to return:   ' . $response_data);


        return $response->setContent($response_data);
    }


    #[Route('api/sync-entity', name: 'sync_entity', methods: ['POST'])]
    public function syncEntity(
        Request $request,
        GenericService $genericService,
        LoggerInterface $logger,
    ): Response {
        $response_message = new ResponseMessage(
            code: 200,
            message: 'SUCCESS',
            type: ResponseMessageType::SUCCESS,
            data: null
        );
        $response         = new Response();
        $response->headers->set('Content-Type', 'application/json');
        $logger->warning($request->getContent());
        $response->setContent(json_encode([]));
//        throw new \Exception('TO JE MOJA OSEBNA NAPAKA stevilka 343424');

        usleep(5 * (pow(10, 6))); // 5 s # Za testiranje scenarija, ko pride do timeouta (na strani clienta)


        $phpDocExtractor = new PropertyInfo\Extractor\PhpDocExtractor();
        $typeExtractor   = new PropertyInfo\PropertyInfoExtractor(
            typeExtractors: [new PropertyInfo\Extractor\ConstructorExtractor([$phpDocExtractor]), $phpDocExtractor,]
        );

        $serializer = new Serializer(normalizers: [
            new GetSetMethodNormalizer(),
            new ObjectNormalizer(
                null,
                new ApiNameConverter(),
                null,
                $typeExtractor
            ),
            new ArrayDenormalizer()
        ], encoders: [new JsonEncoder()]);
        $logger->warning('MA NE ME ZAJEBAVAT');
        /** @var SynchronizationSyncEntityPostData $decoded_json_content */
        $decoded_json_content = $serializer->deserialize(
            ($request->getContent()),
            SynchronizationSyncEntityPostData::class,
            'json'
        );
        $logger->warning('a je pred napako!!!!???');
        $copy_sync_response_data = new SynchronizationSyncResponse(
            sync_status: SynchronizationSyncStatus::COMPLETE,
            list_of_finished: array(
            new SynchronizationSyncedObject(
                local_uuid: $decoded_json_content->data[0]->local_uuid,
                last_modified: (new \DateTime())->format(\DateTime::ATOM)
            )
        )
        );
        $logger->warning('A je ze mimo napaka?');
        $response_message->setData(($copy_sync_response_data));
        $response->setContent($serializer->serialize($response_message, 'json'));

        return $response;


        if (!$decoded_json_content->job_uuid) {
            $response_message = new ResponseMessage(
                code: 400,
                message: 'You must provide uuid for sync process:',
                type: ResponseMessageType::MISSING_REQUIRED_FIELDS,
            );
            $response->setContent(json_encode($response_message));
        }

        $newJobEntry = new SyncJob();
        $newJobEntry->setJobUuid($decoded_json_content->job_uuid);
        /**
         * @var SyncJobRepository $sync_job_repository
         */
        $sync_job_repository = $genericService->findRepositoryFromString(SyncJob::class);

        $sync_job_repository->save($newJobEntry, flush: true);


        $logger->warning('This is entittyName: ' . $decoded_json_content->entity_name);
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

            return $response->setContent(json_encode($response_message));
        }


        $entity_identifier_field = $genericService->get_entity_identifier_property($decoded_json_content->entity_name);
        $logger->warning("THIS IS IDENTIFIER: {$entity_identifier_field}");
//        $logger->warning("Wooo:  " . $decoded_json_content->data[0]->record["id"]);
        $sync_response_data             = new SynchronizationSyncResponse();
        $list_of_successfully_processed = [];


        foreach ($encoded_data_array as $single_record) {
            /**
             * HELP:
             * 1. If we denormalize `$single_record->record` to entity and get []/{} or null this means that data
             * was not denormalized(casted) to entity. So this should produce some callback/process for handling error.
             * How to denormalize:
             * // `$single_record->record` is of type `array` -> we have to manually denormalizd to correct object
             * $test_me = $serializer->denormalize($single_record->record, $decoded_json_content->entity_name, 'json');
             *
             * 2. Ko hocemo serializirat objekt, bo lahko prislo do problem pri 'sub' objektih, ce imajo ti tudi definiran
             * konstruktor. V tem primeru serializer vrne napoke....
             */

            /**
             * PROBLEMI in potencialne ovire:
             *
             * - Kaj narediti, ko bo nekdo poslal objekt, ki bo vseboval polje, ki ne obstaja na definirani entiteti
             * (katere ime/pot) posljemo v POST zahtevi.
             */


            // 1. find object identificator from configuration (or helper function) --> can be used outside the FOR LOOP
            // 2.0 check if identificator field exists in record if not, this should be INSERT and not UPDATE

            $test_me = $serializer->denormalize($single_record->record, $decoded_json_content->entity_name, 'json');
            // ZAKAJ BI SPLOH RABIL pretvarjati podatek v entiteto?


            $logger->warning("WHY DONT WE FGOOO: " . $serializer->serialize($test_me, 'json'));
            if (!in_array($entity_identifier_field, array_keys($single_record->record))) {
                // INSERT MODE
                // 2.1 serialize data to entity data
                $logger->warning('INSERT MODE!!!!!!!!');
                /**
                 * @var TheTest $data_set_into_object
                 */
                $reflection_entity    = new ReflectionClass($decoded_json_content->entity_name);
                $data_set_into_object = $genericService->update_object_by_fields(
                    $single_record->record,
                    $decoded_json_content->entity_name,
                    $reflection_entity->newInstance()
                );
                $logger->warning('RIGHT  IN THE POSSITION    ' . json_encode($data_set_into_object));
                // If we would not use lastModified data in the logger after `save` then we could omit `persist:true` parameter!!!!
                $repository->save(
                    $data_set_into_object,
                    flush: true,
                    persist: true
                ); // added persist:true because we need to get this data after entity inserted (ottherwise we get ERROR about retrieving data before initializiation!!!!!!!
                $logger->warning(
                    'WHAT WE GOT HERE:  ' . ($data_set_into_object->getLastModified()->format('Y-m-d H:i:m,'))
                );

                // TODO: Fix code so that lastModified data is retrieved dynamically
                $entity_processed                 = new SynchronizationSyncedObject(
                    local_uuid: $single_record->local_uuid,
                    last_modified: $data_set_into_object->getLastModified()->format(\DateTime::ATOM)
                );
                $list_of_successfully_processed[] = $entity_processed;
            } else {
                // UPDATE MODE
                // 2. find object based on identificator
                $logger->warning('THIS TIME YOU GO TO UPDATE!!!!!!!!');
                $entity_class       = new ReflectionClass($decoded_json_content->entity_name);
                $identifiator_field = $entity_class->getProperty($entity_identifier_field);
                $my_id              = $single_record->record[$entity_identifier_field];
                settype($my_id, $identifiator_field->getType()->getName());
                $logger->warning('OGOGING BACK');
                $entity_db_data = $repository->find($my_id);
                if (!$entity_db_data) {
                    // PROCESS this with error or another handler!
                    continue;
                }
                $logger->warning(
                    'This is data before save:  ' . $entity_db_data->getLastModified()->format('Y-m-d H:i:m:ss')
                );
                $logger->warning('I MISS WHO WE WERE  ' . $single_record->record[$entity_identifier_field]);
                $logger->warning($serializer->serialize($entity_db_data, 'json'));
                $data_to_save = $genericService->update_object_by_fields(
                    $single_record->record,
                    $decoded_json_content->entity_name,
                    $entity_db_data
                );
                $logger->warning($serializer->serialize($data_to_save, 'json'));
                $logger->warning("What is object type:  " . get_class($data_to_save));
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
            $logger->warning('This is data in loop: ');
            $logger->warning("{$single_record}");
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

    #[Route('/api/get-object', name: 'get_object', methods: ['POST'])]
    public function accessEntityNameDynamically(
        Request $request,
        GenericService $genericService,
        LoggerInterface $logger,
    ): Response {
        /**
         * Mislim da se ne rabim sekirati glede ROUTE-a. Namrec mi lahko mojo 'custom' kodo dodamo kot modul, kar
         * pomeni, da mora developer poskrbeti za POST request in posredovanje ustreznega podatka do moje kode.
         * Tako da zaenkrat predpostavimo, da ne potrebujemo skrbeti o podatkih v POSTu!!!!.
         */

//        $logger->debug('a ora che');
//        $output->writeln('KWA');

        $response_message = new ResponseMessage();
        $logger->warning('FU!!');

        $response = new Response();
        $response->headers->set('Content-Type', 'application/json');
//        $response->setContent(json_encode(['skalianda' => 'skalinada']));
//        $response->setContent(
//            json_encode(
//                [
//                    'test' => $decoded_json_content
//                ]
//            )
//        );
        // We should receive 'TheTest' data from URL paramerters (either path either query)


//        return $response;


        try {
            // Pridobimo json podatek iz zahteve
            $json_content_string = $request->getContent(); // To je 'plain' string
            $serializer          = new Serializer(normalizers: [new ObjectNormalizer()], encoders: [new JsonEncoder()]);

            // Pretvorimo JSON iz FE v objekt, ki vsebuje podatke za posodobitev/insert podatkov
            /**
             * Primer ki ga trenutno dobimo:
             * {
             *   "test":
             *     {
             *       "class_name":"App\\Entity\\TheTest",
             *       "object_data":
             *         {
             *          "id":7,
             *          "name":"Ga zingajo777UPDATE!!!",
             *          "description":"Ga vsi do dna",
             *          "action45":"steka"
             *        },
             *       "action":null,
             *       "last_db_modified":null
             *    }
             * }
             */
            /**
             * @var SynchronizationPostData $decoded_json_content
             */
            $decoded_json_content = $serializer->deserialize(
                ($json_content_string),
                SynchronizationPostData::class,
                'json'
            );


            {
                // TODO: ODlociti se ali bo ta del res potreben!!!
                /**
                 * Update iz 26.12.2022 -> dajmo to pusttit za na konec
                 * TODO: Napisati moram logiko, ki bo poiskalo spremembe med FE in BE objektom.
                 * Ker moramo preveriti, ali je prislo do konfliktov.
                 *
                 * Posodobitev dne: 26.12.2022 -> mislim da teh konfliktov trenutno ne rabimo preverjati, ker
                 * bi morali to narediti ze preko FE. Mi moramo samo preveriti, ali je zadnji podatek, ki smo ga primerjali
                 * iz BE-DB (last_modified, ali karkoli od datetime) enak temu, kar je trenutno v BE-DB
                 */
//        $genericService->entry_point_for_updating_by_fields($decoded_json_content);


            }

            $can_proceed_with_action = true;

            {
                // TODO: Block kode, ki preveri dolocene predpostavke,ki morajo biti izpolnjene, da lahko shranimo zadeve

                // FIRST WE NEED TO HAVE last_db_modified so that we know if compared data is the same as in DB
//                if (!($decoded_json_content and isset($decoded_json_content->last_db_modified))) {
//                    $can_proceed_with_action = false;
//                }
            }

            {
                // Start updating process

                //1. Get field name of last modified
                $last_modified_field_name = $this->getParameter(
                    'ENTITY_LAST_MODIFIED_FIELD'
                ); # TODO: Later add option to somehow override value for specific objects

                if ($can_proceed_with_action) {
                    $genericService->entry_point_for_updating_by_fields(
                        $decoded_json_content,
                        $last_modified_field_name,
                    );
//                    var_dump('try');
//                    echo('more');
                }
            }
        } catch (NotNullConstraintViolationException $could) {
            $logger->warning('------------------------ WTF is going on');
            $logger->warning($could);
            $response_message = new ResponseMessage(
                code: 400,
                message: 'Some required fields are missing',
                type: ResponseMessageType::MISSING_REQUIRED_FIELDS
            );
        } catch (SynchronizationException $sync_exception) {
            $response_message = new ResponseMessage(
                code: 400,
                message: 'Cannot update field because last_modified field is out-of-date.',
                type: ResponseMessageType::SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH
            );
            if ($sync_exception->getCode() != SynchronizationExceptionCode::LAST_MODIFIED_DOES_NOT_MATCH->get_index()) {
                $response_message->setMessage(
                    'Cannot update object since some data in synchronization is off. Check logs.'
                );
                $response_message->setType(ResponseMessageType::UNKNOWN_ERROR);
            }

            $logger->warning('THIS SHOULD BE IT   ' . ($sync_exception->getCode()));
        } catch (\Exception $exception) {
//            dump('make yourself');
            $logger->warning('----------------------------------- some exception occured');
//            $logger->warning($exception->getPrevious()->getMessage());
            $logger->warning($exception);
            $response_message = new ResponseMessage(
                code: 500,
                message: 'Some major exception occured. Check logs.',
                type: ResponseMessageType::UNKNOWN_ERROR
            );
//            $response_message->setCode(500);
//            $response_message->setMessage('Some major exception occured. Check logs.');
        }
//        $response = new Response();
        $response->headers->set('Content-Type', 'application/json');

        $logger->warning('---------------------- THIS WILL NOT DOO');
        $logger->warning($serializer->serialize($response_message, 'json'));
        $response->setContent(
            json_encode(
                $response_message
            )
        );
//        $response->setContent(
//            json_encode(
//                [
//                    'test' => $decoded_json_content
//                ]
//            )
//        );
        // We should receive 'TheTest' data from URL paramerters (either path either query)


        return $response;
    }

    #[Route('/api/get-object/{object_name}/{id}', name: 'get_object_from_id', methods: ['GET'])]
    public function accessObjectWithId(
        string $object_name,
        string $id,
        GenericService $genericService,
        SerializerInterface $serializer
    ): Response {
        $response = new Response();
        $response->headers->set('Content-Type', 'application/json');

        // 'App\Entity\TheTest'
        $repository     = $genericService->findRepositoryFromString($object_name);
        $foundItem      = $repository->find($id);
        $serializedItem = $serializer->serialize($foundItem, 'json');


        // 'App\Entity\TheTest'
        $actualEntity = $serializer->deserialize($serializedItem, $object_name, 'json');
        $json_data    = json_decode($serializedItem);

        $data_to_send = new SynchronizationGetEntityData(
            $object_name,
            $json_data,
            $foundItem ? $foundItem->getLastModified() : null,
            response_message: new ResponseMessage()
        );

        $response->setContent(json_encode($data_to_send));


        /*


        $first_item = array(
            "first" => "first",
            "second" => "second",
            "third" => array(
                "my" => "old",
                "time" => "blues"
            )
        );

        $second_item = array(
            "first" => "new",
            "second" => "york",
            "third" => array(
                "my" => "old8",
                "time" => "blues7"
            )
        );



        // Testing JsonPatch specification for PHP
        $first_json = json_decode(json_encode($first_item));
        $second_json = json_decode(json_encode($second_item));
        $test = new JsonDiff($first_json, $second_json);
        dump("OLE OLE");
        dump($first_json);
        dump($second_json);
        dump($test);
        dump('------------------------');
        dump($test->getPatch()->jsonSerialize());

        ***
         * Prvo bomo morali prefiltrirati operacije iz getPatch()->jsonSerialize(),
         * ker ta tabela vkljucuje tudi 'test' operacije.
         ***
        $new_array = array_filter($test->getPatch()->jsonSerialize(), function($value, $key){
            dump('super hero');
            dump('Key: ' . $key);
            dump($value);
            return $value->op != "test";
        }, ARRAY_FILTER_USE_BOTH);

        dump(' BOBOOBOBOBOBGIE DOOOOWWG');
        dump($new_array);


        **
         * trenutni problem: JSON objekt, kateremu je bil odstranjen  podatek, ostane NULL vrednost za nek KEY.
         **

        $newObject = new \stdClass();
        $newObject->setMe = 'bla';

        $newObject1 = new \stdClass();
        $newObject1->think = 'expensive';

        dump('ole');
//        dump($newObject1);
        dump((array) $newObject1);
        dump('ole2');
//        dump($foundItem);
        dump($foundItem);

        $u = new MapDiffer();
        $differ = new Diff();
        $diffs = $u->doDiff((array) $newObject1, (array) $foundItem);
        dump('he aint');
        dump($diffs);

        $newObject1Array = json_decode(json_encode($newObject1), true);
        dump('what in the gheelkfdkslajfsa is gonin on');
        dump($foundItem);
        $foundItemArray = (json_encode($foundItem));



        dump('newobjectarray');
        dump($newObject1Array);
        dump('founditemarray');
        var_dump($foundItemArray);

        $diff = new Diff($u->doDiff($newObject1Array, (array) $foundItem));

        $patcher = new MapPatcher();
        $newVersion = $patcher->patch((array) $foundItem, $diff);
        dump('new version');
        dump($newVersion);


        $ride = new TestFu();
        $ride1 = new TestFu1();

        dump('fu');

        dump((array)$ride);
        dump((array)$ride1);
        dump((array)$foundItem);

        $reflection_class = new ReflectionClass(TestFu1::class);
        $reflection_class->getProperty('hua1')->setValue($ride1, 'hahahaha898');


        dump('right this way');
        dump($ride1);

        */
        return $response;
    }
}

enum ResponseMessageType
{
    case SUCCESS;
    case MISSING_REQUIRED_FIELDS;
    case SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH;
    case UNKNOWN_ERROR;
    case REPOSITORY_NOT_FOUND;
    case ENTITY_DOES_NOT_EXIST;
}

class ResponseMessage
{
    public $code;
    public $message;
    public ?string $type;
    public mixed $data;

    public function __construct(
        ?int $code = 200,
        ?string $message = 'SUCCESS',
        ?ResponseMessageType $type = ResponseMessageType::SUCCESS,
        mixed $data = null
    ) {
        $this->code    = $code;
        $this->message = $message;
        $type_value    = $type;
        if ($type) {
            $type_value = $type->name;
        }
        $this->type = $type_value;
        $this->data = $data;
    }

    /**
     * @return int|null
     */
    public function getCode(): ?int
    {
        return $this->code;
    }

    /**
     * @param int|null $code
     */
    public function setCode(?int $code): void
    {
        $this->code = $code;
    }

    /**
     * @return string|null
     */
    public function getMessage(): ?string
    {
        return $this->message;
    }

    /**
     * @param string|null $message
     */
    public function setMessage(?string $message): void
    {
        $this->message = $message;
    }

    /**
     * @return string|null
     */
    public function getType(): ?string
    {
        return $this->type;
    }

    /**
     * @param string|null $type
     */
    public function setType(?ResponseMessageType $type): void
    {
        $value = null;
        if ($type) {
            $value = $type->name;
        }
        $this->type = $value;
    }

    /**
     * @return mixed|null
     */
    public function getData(): mixed
    {
        return $this->data;
    }

    /**
     * @param mixed|null $data
     */
    public function setData(mixed $data): void
    {
        $this->data = $data;
    }


}

class RetryReEvaluation
{
    public string $object_uuid;
    public string $request_uuid;
    public int $retries;
    public string $status;
    public string $created_datetime;
    public mixed $data; // We need this for merging if requests from before was stopped/cancelled
}

class RetryReEvaluationPostData
{
    /**
     * @var RetryReEvaluation[]
     */
    public $re_evaluations;
}

class RefactoredRetryReEvaluationResponseData
{
    /**
     * @var string[] $in_progress_sync_job_uuids
     */
    public mixed $in_progress_sync_job_uuids;
    public string $status;
    public mixed $error;


    public function __construct(string $status, mixed $in_progress_sync_job_uuids)
    {
        $this->status = $status;
        $this->in_progress_sync_job_uuids = $in_progress_sync_job_uuids;
        $this->error = null;
    }

    /**
     * @return string[]
     */
    public function getInProgressSyncJobUuids(): mixed
    {
        return $this->in_progress_sync_job_uuids;
    }

    /**
     * @param string[] $in_progress_sync_job_uuids
     */
    public function setInProgressSyncJobUuids(mixed $in_progress_sync_job_uuids): void
    {
        $this->in_progress_sync_job_uuids = $in_progress_sync_job_uuids;
    }

    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * @param string $status
     */
    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    /**
     * @return mixed|null
     */
    public function getError(): mixed
    {
        return $this->error;
    }

    /**
     * @param mixed|null $error
     */
    public function setError(mixed $error): void
    {
        $this->error = $error;
    } // 'ERROR', 'SUCCESS', 'CONFLICT'




}

class RefactoredRetryReEvaluationPostData
{
    /**
     * @var SynchronizationSyncingEntry[]
     */
    public $re_evaluations;
}


/**
 * JSON_DECODE(JSON_ENCODE(obj), true) ne bo deloval ce nimaom PUBLIC fieldov!!!!!!!!!!!
 */
class TestFu
{
    public $hua = 'hello';
    public $hua1 = 'hello1';
}

class TestFu1
{
    readonly string $tee; // = 'boogie';
    private $hua = 'hello';
    private $hua1 = 'hello1';

    public function __construct()
    {
        $this->tee = 'boogie';
    }

    public function d()
    {
        dump('ha');
    }

    public function whatAbout()
    {
        $this->tee = 'hhuuuuu';
    }
}
