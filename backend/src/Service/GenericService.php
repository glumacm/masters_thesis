<?php
namespace App\Service;

use App\Controller\ResponseMessage;
use App\Entity\TheTest;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Exception;
use JetBrains\PhpStorm\Pure;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use ReflectionException;
use Symfony\Component\Serializer\NameConverter\CamelCaseToSnakeCaseNameConverter;
use Symfony\Component\Serializer\NameConverter\NameConverterInterface;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Yaml\Yaml;
use Throwable;

use function Symfony\Component\String\u;

class GenericService
{
    private $em;
    private $serializer;
    private $logger;

    public function __construct(
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        LoggerInterface $logger,
    ) {
        $this->em = $em;
        $this->serializer = $serializer;
        $this->logger = $logger;

    }
    public function getHappyMessage(): string
    {
        $messages = [
            'You did it! You updated the system! Amazing!',
            'That was one of the coolest updates I\'ve seen all day!',
            'Great work! Keep going!',
        ];

        $index = array_rand($messages);

        return $messages[$index];
    }

    public function get_class_from_string(string $class_name): ?ReflectionClass
    {
        try {
            $reflection_class = new \ReflectionClass($class_name);
            return $reflection_class;
        } catch (ReflectionException $e) {
            return null;
        }
    }

    /**
     * @param string $repository_name String value of the entity class for which we want to retrieve repository!
     * @return EntityRepository
     */
    public function findRepositoryFromString(string $repository_name): EntityRepository
    {
        $dynamic_repository = $this->em->getRepository($repository_name);
        return $dynamic_repository;
    }


    public function get_entity_identifier_property(string $entity_class_name): string {
        $meta = $this->em->getClassMetadata($entity_class_name);
        return $meta->getSingleIdentifierFieldName();
    }

    /**
     * If identifier is created via multiple fields checks answer here: https://stackoverflow.com/questions/6128914/how-to-get-doctrine2-entity-identifier-without-knowing-its-name
     * Long story short: If your entity has a composite primary key, you'll need to use $meta->getIdentifierFieldNames() instead.
     */
    private function find_identifier_value_in_modified_data(array $data, string $identifier): mixed {
        // vrniti mora value za ID oz. podatek, ki skrbi za unikatno identifikacijo
        if (!$data) {
            return null;
        }

        if (!array_key_exists($identifier, $data)){
            return null;
        }

        return $data[$identifier];
    }

    private function remove_class_prefix_from_casted_object(array $fe_item, string $class_name): array
    {
        /**
         * $fe_item je array, ker to je podatek, ki ga dobimo iz FE-ja v JSON-u in trenutno ne vidim razloga,
         * da bi to pretvarjal v nek specificen objekt.
         *
         * To funkcijo rabimo v primeru:
         *
         * $keys_and_values_for_entity = (array) $some_object_entity;
         *
         * ker v takem primeru nam `kljuce` vraca s celotno potjo razreda iz katerega izkaja entiteta/instanca!!!
         */
        $reformatted_fe_item_array = [];
        foreach ((array)$fe_item as $key => $value) {
            $reformatted_key = str_replace(
                $class_name,
                '',
                preg_replace(
                    '/[^\PCc^\PCn^\PCs]/u',
                    '',
                    $key,
                ),
            );
            $reformatted_fe_item_array[$reformatted_key] = $value;
        }

        return $reformatted_fe_item_array;

    }

    public function entry_point_for_updating_by_fields(
        SynchronizationPostData $data_from_request,
        string $last_modified_field_name,
    ): void
    {
        $class_name_to_modify = $data_from_request->class_name;
        $modified_data = $data_from_request->object_data; // podatki so asociativna tabela
        $is_update = true;

//        $actualEntity = $this->serializer->deserialize(json_encode($modified_data),$class_name_to_modify,'json');
        $actualEntity = $this->serializer->deserialize($this->serializer->serialize($modified_data, 'json',),$class_name_to_modify,'json');
        $real_modified_data = $this->remove_class_prefix_from_casted_object((array)$actualEntity, $class_name_to_modify);

        $test_normalizer = new ObjectNormalizer(null, new CamelCaseToSnakeCaseNameConverter());
        $test = new Serializer([$test_normalizer]);

        $gonna_makeit = $test->normalize($actualEntity);

        // TODO: This needs work. If I do not specify ID in the root object and specify ID in the change data, this will go into UPDATE mode...
        // ... need to think if this is desired workflow.
        $id_value = $this->find_identifier_value_in_modified_data($modified_data, $this->get_entity_identifier_property($class_name_to_modify));

        $this->logger->warning('-------------------------------------------- WHAT IS IDENTIFIER');
        $this->logger->warning(strval($id_value));
        if (!$id_value) {
            $is_update = false;
//            throw new NotFoundHttpException('Nimamo ID-ja'); // TODO: Deluje kot da bi lahko to vrgli stran, ker ta if samo pretvori update v insert
        }

        // TODO: Seveda predpostavljamo, da obstaja repository za naveden object!
        try {
            $repository = $this->findRepositoryFromString($class_name_to_modify); // 'App\Entity\TheTest'
        } catch (Exception $e) {
            throw new SynchronizationException(SynchronizationExceptionCode::REPOSITORY_NOT_FOUND);
        }

        /**
         * @var TheTest $test_db_item
         */
        $test_db_item = null;
        if ($is_update) {
            $test_db_item = $repository->find($id_value);

            $changed_keys = $this->remove_class_prefix_from_casted_object((array) $test_db_item, $class_name_to_modify);

            {
                $db_last_modified = $changed_keys[$last_modified_field_name];
                if ((!$db_last_modified) or ($db_last_modified != $data_from_request->last_db_modified)) {
                    // TODO: FE must catch this error and restart process of checking FE data with BE data. (re-fetch and re-calculate)
                    throw new SynchronizationException(SynchronizationExceptionCode::LAST_MODIFIED_DOES_NOT_MATCH);
                }
            }



        } else {
            try {
                $reflection_class = new ReflectionClass($class_name_to_modify);
            } catch (Exception $e) {
                throw new SynchronizationException(SynchronizationExceptionCode::ENTITY_CLASS_NOT_FOUND);
            }
            /**
             * TODO: Kaj pa ce objekt zahteva obvezna polja?
             * Po spremembi polja 'description' v TheTest entity-ju v NON-NULLABLE, vidimo, da se lahko
             * instanca za entity ustvari tudi brez 'description', pomembno je le, da je podatek prisoten,
             * ko ga shranimo. Torej, to pomeni, da prazno instanco lahko naredimo, FrontEnd pa mora poskrbeti, da v
             * primeru INSERT-a vnese vse OBVEZNE podatke!
             */
            $test_db_item = $reflection_class->newInstance();
            $this->logger->warning('WTFF JE NOVI INSTANCE');
            $this->logger->warning($this->serializer->serialize($test_db_item, 'json'));

        }
        /**
         * Potrebno bo narediti sistem, ki bo preveril kaj je identificator za objekt. Privzeto lahko recemo ID,
         * ampak nekatere aplikacije lahko uporabljajo nek drug UNIQUE column.
         */


        $decoded_db_item = json_decode(json_encode($test_db_item));
//        $test_example = new JsonDiff($decoded_json_content, $decoded_db_item, JsonDiff::COLLECT_MODIFIED_DIFF);

        // Predpostavimo da bomo dobili vedno JSON rezultat in posledicno pomeni, da bomo
//         ... lahko brez pretvorbe dobili 'key'.
        // primer imena entitete 'App\Entity\TheTest', 'App\Controller\TestFu' , za spremenljivko $class_name
        $changes = $this->update_object_by_fields($real_modified_data, $class_name_to_modify , $test_db_item  ); // Ce bo NULL bomo ignorirali zadevo, verjetno.
        $this->logger->warning('---------------------------- WHAT ARE MODIFIED DATA');
        $this->logger->warning($this->serializer->serialize($real_modified_data, 'json'));
        if ($changes) {
            $this->logger->warning('-----------------------------------    CHANGES ARE ABOUT TO BE SAVED');
            $this->logger->warning($this->serializer->serialize($changes, 'json'));
//            dump("BLABLABLALBA");
            /**
             * FLUSH je najbolje, da je klican po končanih batch spremembah. Če delamo spremembe en objekt za drugim
             * npr. v for zanki, je dobro narediti flush po for zanki!
             *
             */
            $repository->save($changes, flush: true, merge: $is_update);
        }
    }

    /**
     * @param array $fields_with_values
     * @param string $class_name
     * @param mixed $object_to_change
     * @return mixed
     */
    public function update_object_by_fields(array $fields_with_values, string $class_name, mixed $object_to_change): mixed
    {
        /**
         * Za razmisliti, ker lahko bi popravili logiko, da v primeru, da nekega fielda ne najde, da ga ignorira,
         * vendar se vedno bi za ostale delovalo/posodobilo. Ker trenutno bo delovalo tako, da ne bo nic posodobilo,
         * ce bo vsaj pri enem fieldu napaka.
         */

        /**
         * VELIK PROBLEM!!!!
         * Id se ne klonira!
         */
        $object_to_change_copy = $object_to_change; // Ker ce pred errorjem popravimo en field, se zna ta sprememba poznati po napaki.

        $this->logger->warning('JA PA KAJ SE DOGAJA343434');
        $this->logger->warning($this->serializer->serialize($object_to_change_copy, 'json'));

        try {
            $reflection_class = new ReflectionClass($class_name);
            // TODO: Problem, ker nekateri fieldi se ne pretvorijo pravilno. Primer: 'last_modified' dobimo kot 'lastModified' v $fields_with_values...
            // ... ta problem sem zacasno obsel tako, da sem v fields_with_values poslal array podatkov, ki so pridobljeni iz deserializiranega objekta specificne entitete (nad katero se dela upsert).
            foreach ($fields_with_values as $key =>$value ) {
                // CE property/key ne obstaja, bo prislo do errorja
                try {
                    $sa_brodom = $reflection_class->getProperty($key);
                    //                dump('Test is initialized: ' . $sa_brodom->isInitialized($object_to_change_copy));
                    //                dump($sa_brodom->getType());
                    if ($sa_brodom->getType()->getName() == 'DateTime') {
                        $sa_brodom->setValue($object_to_change, date_create_from_format('Y-m-d H:i:s', $value));
                    } else {
                        $sa_brodom->setValue($object_to_change_copy, $value);
                    }
                } catch (\ReflectionException $e) {} // so that we can continue with modifying data
            }
        } catch (\ReflectionException $exception) {
            if ($exception->getCode() == -1) {
                # just testing when we do not understand the error
            }
            $this->logger->warning('------------------------   Some errors');
            $this->logger->warning($this->serializer->serialize($exception, 'json'));
//            dump('What is the error data:');
//            dump($exception->getCode());
//            dump(get_class($exception));
            return null;
        }

        $this->logger->warning('JA PA KAJ SE DOGAJA');
        $this->logger->warning($this->serializer->serialize($object_to_change_copy, 'json'));

        return $object_to_change_copy;
    }
}

class CustomReflectionException extends \ReflectionException {
    public const INVALID_CLASS_NAME = -1;
    public const INVALID_PROPERTY = 0;
    public function __construct($message = "", $code = 0, Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}


class SynchronizationException extends Exception {
//    public function __construct($message = "", $code = 0, Throwable $previous = null)
    #[Pure] public function __construct(SynchronizationExceptionCode $exceptionCode)
    {
        match ($exceptionCode){
            SynchronizationExceptionCode::ENTITY_CLASS_NOT_FOUND => parent::__construct(
                'Synchronization could not find class for specified change data.',
                SynchronizationExceptionCode::ENTITY_CLASS_NOT_FOUND->get_index(),
            ),
            SynchronizationExceptionCode::REPOSITORY_NOT_FOUND => parent::__construct(
                'Synchronization could not find repository for specified entity.',
                SynchronizationExceptionCode::REPOSITORY_NOT_FOUND->get_index(),
            ),
            SynchronizationExceptionCode::PROPERTY_NOT_FOUND => parent::__construct(
                'Synchronization could not find property in specified entity.',
                SynchronizationExceptionCode::PROPERTY_NOT_FOUND->get_index(),
            ),
            SynchronizationExceptionCode::LAST_MODIFIED_DOES_NOT_MATCH => parent::__construct(
                'Synchronization cannot continue because FE modified field does not match database field.',
                SynchronizationExceptionCode::LAST_MODIFIED_DOES_NOT_MATCH->get_index(),
            ),
            default => parent::__construct('Synchronization error with default code.', 0)
        };
//        parent::__construct($message, $code, $previous);
    }
}

enum SynchronizationExceptionCode {
    // default exception code is 0
    case ENTITY_CLASS_NOT_FOUND; // code = 1
    case REPOSITORY_NOT_FOUND; // code = 2
    case PROPERTY_NOT_FOUND; // code = 3
    case LAST_MODIFIED_DOES_NOT_MATCH; // code = 4

    public function get_index(): int {
        return match($this->name) {
            SynchronizationExceptionCode::ENTITY_CLASS_NOT_FOUND->name => 1,
            SynchronizationExceptionCode::REPOSITORY_NOT_FOUND->name => 2,
            SynchronizationExceptionCode::PROPERTY_NOT_FOUND->name => 3,
            SynchronizationExceptionCode::LAST_MODIFIED_DOES_NOT_MATCH->name => 4,
            default => -1
        };
    }
}


class SynchronizationPostData {
    public readonly string $class_name;
    public readonly mixed $object_data;
    public readonly mixed $id; // potrebujemo, ker po deserializaciji, id ni vec dostopen. Lahko pa ga prekopiramo iz object_data preden naredimo deserializacijo
    public readonly mixed $action; // Mogoce bi preko tega povedali kaj tocno smo naredili?
    public readonly ?\DateTime $last_db_modified; // isti podatek kot ga imamo v tabeli v DB za to entiteto. Ker preko tega bomo vedli, ali lahko potrdimo spremembo na DB ali ne
    public function __construct($class_name, $object_data, $action = null, ?string $last_db_modified = null, mixed $id = null)
    {
        $this->class_name = $class_name;
        $this->object_data = $object_data;
        $this->action = $action;
        $this->id = $id;

        $this->last_db_modified = $last_db_modified ? date_create_from_format('Y-m-d H:i:s', $last_db_modified) : null;
//        $this->last_db_modified = $last_db_modified ? strtotime($last_db_modified) : null;
    }
}

class SynchronizationGetEntityData {
    public readonly string $class_name;
    public readonly mixed $object_data;
    public readonly ?\Datetime $last_db_modified;
    public readonly ?ResponseMessage $response_status;

    public function __construct($class_name, $object_data, ?\DateTime $last_db_modified = null, ?ResponseMessage $response_message = null)
    {
        $this->class_name  = $class_name;
        $this->object_data = $object_data;

        $this->last_db_modified = $last_db_modified ?? null;

        $this->response_status = $response_message;
    }
}

class ApiNameConverter implements NameConverterInterface
{
    public function denormalize(string $propertyName): string
    {
        // TODO: Implement denormalize() method.
        // kaj narediti ko se deserialize pozene
        return $propertyName ? u($propertyName)->snake() : $propertyName;
    }

    public function normalize(string $propertyName): string
    {
        // TODO: Implement normalize() method.
        // kaj narediti ko se serialize pozene
        return $propertyName ? u($propertyName)->camel() : $propertyName;
    }
}

class ApiNameConverterOnlySnake implements NameConverterInterface
{
    public function denormalize(string $propertyName): string
    {
        // TODO: Implement denormalize() method.
        // kaj narediti ko se deserialize pozene
        return $propertyName ? u($propertyName)->snake() : $propertyName;
    }

    public function normalize(string $propertyName): string
    {
        // TODO: Implement normalize() method.
        // kaj narediti ko se serialize pozene
        return $propertyName ? u($propertyName)->snake() : $propertyName;
    }
}


class SynchronizationSyncEntityPostData
{
    /*
         entityName: string;
    data: SynchronizationSyncEntityRecord[];
}

export interface SynchronizationSyncEntityRecord {
    localUUID: string;
    lastModified: Date | null;
    record: any;
}
     */
    public string $entity_name;

    public string $job_uuid;

    /**
     * @var SynchronizationSyncEntityRecord[]
     */
    public $data;

//    /**
//     * @return string
//     */
//    public function getEntityName(): string
//    {
//        return $this->entity_name;
//    }
//
//    /**
//     * @param string $entity_name
//     */
//    public function setEntityName(string $entity_name): void
//    {
//        $this->entity_name = $entity_name;
//    }
//
//    /**
//     * @return SynchronizationSyncEntityRecord[]
//     */
//    public function getData(): array
//    {
//        return $this->data;
//    }
//
//    /**
//     * @param SynchronizationSyncEntityRecord[] $data
//     */
//    public function setData(array $data): void
//    {
//        $this->data = $data;
//    }
//
//    public function __construct($entity_name, $data)
//    {
//        $this->entity_name = $entity_name;
//        $this->data = $data;
//    }


}

class SynchronizationSyncResponse {
    private ?string $sync_status; // should be passed as string from SynchronizationSyncStatus enum
    /**
     * @var SynchronizationSyncedObject[]
     */
    private mixed $finished_successfully;

    private mixed $error;

    /**
     * @return mixed
     */
    public function getError(): mixed
    {
        return $this->error;
    }

    /**
     * @param mixed $error
     */
    public function setError(mixed $error): void
    {
        $this->error = $error;
    }



    /**
     * @return string
     */
    public function getSyncStatus(): string
    {
        return $this->sync_status;
    }

    /**
     * @param string $sync_status
     */
    public function setSyncStatus(string $sync_status): void
    {
        $this->sync_status = $sync_status;
    }

    /**
     * @return SynchronizationSyncedObject[]
     */
    public function getFinishedSuccessfully(): mixed
    {
        return $this->finished_successfully;
    }

    /**
     * @param SynchronizationSyncedObject[] $finished_successfully
     */
    public function setFinishedSuccessfully(mixed $finished_successfully): void
    {
        $this->finished_successfully = $finished_successfully;
    } // should be list of all localUUIDs that were successfully updated in the database + lastModified data (since we need to update it in the FE)


    /**
     * @param SynchronizationSyncStatus|null $sync_status
     * @param SynchronizationSyncedObject[]|null $list_of_finished
     */
    public function __construct(
        ?SynchronizationSyncStatus $sync_status = SynchronizationSyncStatus::COMPLETE,
        ?array $list_of_finished = array()
    )
    {
        $this->sync_status = $sync_status != null ? $sync_status->name : null;
        $this->finished_successfully = $list_of_finished;
    }

}

class SynchronizationSyncedObject {
//    public string $local_uuid;
//    public string $last_modified;
    public mixed $local_uuid;
    public mixed $last_modified;

    /**
     * @return string
     */
    public function getLocalUuid(): string
    {
        return $this->local_uuid;
    }

    /**
     * @param string $local_uuid
     */
    public function setLocalUuid(string $local_uuid): void
    {
        $this->local_uuid = $local_uuid;
    }

    /**
     * @return string
     */
    public function getLastModified(): string
    {
        return $this->last_modified;
    }

    /**
     * @param string $last_modified
     */
    public function setLastModified(mixed $last_modified): void
    {
        $this->last_modified = $last_modified;
    }



    public function __construct(
        ?string $local_uuid,
        ?string $last_modified,
    )
    {
        $this->local_uuid = $local_uuid;
        $this->last_modified = $last_modified ?? null;
    }
}


class SynchronizationSyncEntityRecord
{
    public string $local_uuid;
    public mixed $record;
    public mixed $last_modified;

    /**
     * @return string
     */
    public function getLocalUuid(): string
    {
        return $this->local_uuid;
    }

    /**
     * @param string $local_uuid
     */
    public function setLocalUuid(string $local_uuid): void
    {
        $this->local_uuid = $local_uuid;
    }

    /**
     * @return \DateTime
     */
    public function getLastModified(): string
    {
        return $this->last_modified;
    }

    /**
     * @param \DateTime $last_modified
     */
    public function setLastModified(mixed $last_modified): void
    {
        $this->last_modified = $last_modified;
    }

    /**
     * @return mixed
     */
    public function getRecord(): mixed
    {
        return $this->record;
    }

    /**
     * @param mixed $record
     */
    public function setRecord(mixed $record): void
    {
        $this->record = $record;
    }



//    public function __construct(
//        $localUUID,
//        $record,
//        $last_modified,
//    )
//    {
//        $this->localUUID = $localUUID;
//        $this->record = $record;
//        $this->last_modified = $last_modified;
//    }

    public function __toString(): string
    {
        // TODO: Implement __toString() method.
        return 'This is localUUID: ' . $this->local_uuid . ' this is last_modified: ' . strval($this->last_modified);
    }
}

class SynchronizationSyncingState {
    public string $local_uuid;
    public string $status;
    /**
     * @var \DateTime|null $last_modified
     */
    public mixed $last_modified;
    public mixed $changes;
}

class SynchronizationSyncingEntry {
//objectUuid: string;
//requestUuid: string;
//status: string;
//retries: number;
//data: SyncChamberRecordStructure | undefined;
//createdDatetime: Date | undefined;
    public string $object_uuid;
    public string $request_uuid;
    public string $status;
    public int $retries;
    /**
     * @var SynchronizationSyncingState|null $data
     */
    public mixed $data;
    /**
     * @var \DateTime|null $createdDatetime
     */
    public mixed $createdDatetime;
}

enum SynchronizationSyncStatus {
    case COMPLETE;
    case PARTIAL;
    case FAILED_ALL;
}


//enum MergeResolutionEnum {
//    case NO_RESTRICTIONS;
//    case NEWER_CHANGES;
//    case DEFAULT;
//    case USER_INTERACTION_NEEDED;
//    case NONE;
//
//    public static function toInt(MergeResolutionEnum $value): int {
//        switch ($value) {
//            case self::NO_RESTRICTIONS: return 1;
//            case self::NEWER_CHANGES: return 2;
//            case self::DEFAULT: return 3;
//            case self::USER_INTERACTION_NEEDED: return 4;
//            case self::NONE: return 5;
//            default: return 5;
//        }
//    }
//
//    public static function fromInt(int $value): MergeResolutionEnum {
//        switch ($value) {
//            case 1: return self::NO_RESTRICTIONS;
//            case 2: return self::NEWER_CHANGES;
//            case 3: return self::DEFAULT;
//            case 4: return self::USER_INTERACTION_NEEDED;
//            case 5: return self::NONE;
//            default: return self::NONE;
//        }
//    }
//}

/**
export enum MergeModeEnum {
NO_RESTRICTIONS=0, // POMENI, DA CE IMAMO V SPREMEMBAH TA FIELD, NAS NE ZANIMA KDAJ JE BIL POSODOBLJEN. CE PISE DA JE SPREMENJEN GA SPREMENI
NEWER_CHANGES=1, // POMENI, DA CE JE FIELD V SPREMEMBAH, MORAS PREVERITI ALI IMA `RECORD` IZ `BE` VECJI `UPDATED_AT` KOT SPREMEMBA
DEFAULT=3, // @TODO
USER_INTERACTION_NEEDED=4,
NONE=5 // POTREBNO DODATI NEK ZAPIS V KONFIGURACIJO KJER BO POVEDALO, KAJ NAREDITI V PRIMERU `NONE` (MOGOCE JE TA OPCIJA IDENTICNA KOT OPCIJA `DEFAULT`).
}**/
