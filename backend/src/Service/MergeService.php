<?php

namespace App\Service;

use App\Enum\MergeResolutionEnum;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

use ReflectionClass;
use Swaggest\JsonDiff\JsonDiff;
use Symfony\Component\DependencyInjection\ParameterBag\ContainerBagInterface;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\PropertyInfo;
use Ramsey\Uuid\Uuid;

use function Symfony\Component\String\u;


class MergeService
{
    private $em;
    private $serializer;
    private $logger;
    private $generic_service;
    private $params;
    private $conflictConfigurationService;

    public function __construct(
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        LoggerInterface $logger,
        \App\Service\GenericService $generic_service,
        ContainerBagInterface $params,
        ConflictConfigurationService $conflictConfigurationService,
    ) {
        $this->em                           = $em;
        $this->serializer                   = $serializer;
        $this->logger                       = $logger;
        $this->generic_service              = $generic_service;
        $this->params                       = $params;
        $this->conflictConfigurationService = $conflictConfigurationService;
    }

    public function get()
    {
    }

    public function get_entity_object(
        string $entityName,
        string $object_id,
        string $id_field = 'uuid'
    ): mixed  # object_id should be changed to object_uuid
    {
        $repository = $this->generic_service->findRepositoryFromString($entityName);
        if (!$repository) {
            throw new Exception('Cannot find repository for specified entity');
        }

        # TODO: Rekel bi, da bi field, ki bo uporabljen za iskanje dodan v konfiguracijo, ampak to na koncu, ce bo zadeva se aktivna!
        return $repository->findOneBy([$id_field => $object_id]);
    }

    public function start_merger_process_latest(mixed $data_from_fe, string $entity_name, mixed $object_data_from_db,): ?MergeProcessResult
    {

        // Examples of printing date with format
        // $last_modified_from_fe = $data_from_fe->getLastModified();
        // $last_modified_from_be = $object_data_from_db->getLastModified();
        // $this->logger->warning('Examples how to print lastModified');
        // $this->logger->warning(($last_modified_from_be->format('Y-m-d H:i:s')));
        // $this->logger->warning(($last_modified_from_fe->format('Y-m-d H:i:s')));

        //This function is called only if data in DB exists!!!

        // class name that represents entity sent from FE
        $entity_name_reflection_class = $this->generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            return null;
        }

        $result = new MergeProcessResult();

        $serializer = $this->get_serializer();

        $entity_as_array  = $this->get_serializer_without_camel()->normalize($object_data_from_db, null);
        $fe_data_as_array = $this->get_serializer_without_camel()->normalize($data_from_fe, null);

        /**
         * I propose that function `calculate_differences` should return table of changes that we need to execute
         * on an object and then use `update_object_by_fields` so that the value is set.
         *
         * UPDATE 19.03.2023: First idea was O.K, but we added new function instead of `update_object_by_field` + in current function we need to return conflicted data
         */
        $changes_to_apply = $this->calculate_differences(
            $entity_name_reflection_class->getShortName(),
            $entity_as_array,
            $fe_data_as_array
        );

        # at some point stored incorrect code: we need to bypass setting data if conflicts are found
        if (!$changes_to_apply->conflicted || sizeof($changes_to_apply->conflicted) == 0) {
            $applied_object = $this->apply_changes_to_entity(
                object_data_from_db: $object_data_from_db,
                object_reflection_class: $entity_name_reflection_class,
                changes_to_apply: $changes_to_apply->merged,
                ignore_fields: array('id', 'uuid'),
            );
        } else {
            $applied_object = $object_data_from_db;
        }

        $result->conflicts = $changes_to_apply->conflicted;
        $result->merged_db_object = $applied_object;

        # TODO: Transformation back to object from $changes_to_apply->merged (which is an array of fields and values) (not sure if still valid TODO)
        # TODO: Need to return different structure because currently this return conflicted data (not sure if still valid TODO)
        return $result;
    }

    public function start_merge_process(mixed $data_from_fe, string $entity_name): mixed
    {
        $entity_name_reflection_class = $this->generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            return null;
        }

        $object_data_from_db = $this->get_entity_object($entity_name_reflection_class->getName(), 7);


        $serializer = $this->get_serializer();


//        # Original logic
//        $entity_as_array = $serializer->normalize($object_data_from_db, null);  // Converted to array without path problems!!!!
//        $fe_data_as_array = $serializer->normalize($data_from_fe, null);

        # new logic
        $entity_as_array  = $this->get_serializer_without_camel()->normalize($object_data_from_db, null);
        $fe_data_as_array = $this->get_serializer_without_camel()->normalize($data_from_fe, null);

        $what = new JsonDiff($entity_as_array, $fe_data_as_array, 0, skipPaths: array('id', 'uuid')
        ); # Last parameter == fields to ignore


        $modified_new        = $what->getModifiedNew();
        $object_data_from_db = $this->generic_service->update_object_by_fields(
            fields_with_values: $this->get_serializer_without_camel()->normalize($modified_new, null),
            class_name: $entity_name,
            object_to_change: $object_data_from_db,
        );


        $this->calculate_differences(
            $entity_name_reflection_class->getShortName(),
            $entity_as_array,
            $fe_data_as_array
        );

        return $object_data_from_db;
    }

    public function get_serializer(bool $include_get_set_method_normalizer = false, $format = \DateTime::ATOM): Serializer
    {
        $phpDocExtractor = new PropertyInfo\Extractor\PhpDocExtractor();
        $typeExtractor   = new PropertyInfo\PropertyInfoExtractor(
            typeExtractors: [new PropertyInfo\Extractor\ConstructorExtractor([$phpDocExtractor]), $phpDocExtractor,]
        );

//        $format          = 'Y-m-d H:i:s';
//        $format          = \DateTime::ATOM;
        $defaultContext  = [
            DateTimeNormalizer::FORMAT_KEY => $format
        ];
        $normalizers     = [
            new DateTimeNormalizer($defaultContext),
            new ArrayDenormalizer(),
            //            new GetSetMethodNormalizer(),   // GET SET METHOD NORMALIZER does not work on ENTITIES!!!!!!!!!!!!!!!!!!!!
            new ObjectNormalizer(
                null,
                new ApiNameConverter(),
                null,
                $typeExtractor
            ),
            new ArrayDenormalizer(),
        ];
        if ($include_get_set_method_normalizer) {
            $normalizers[] = new GetSetMethodNormalizer();
        }
        return new Serializer(normalizers: $normalizers, encoders: [new JsonEncoder()]);
    }


    public function get_serializer_without_camel(bool $include_get_set_method_normalizer = false): Serializer
    {
        $phpDocExtractor = new PropertyInfo\Extractor\PhpDocExtractor();
        $typeExtractor   = new PropertyInfo\PropertyInfoExtractor(
            typeExtractors: [new PropertyInfo\Extractor\ConstructorExtractor([$phpDocExtractor]), $phpDocExtractor,]
        );
        $format          = 'Y-m-d H:i:s';
        $defaultContext  = [
            DateTimeNormalizer::FORMAT_KEY => $format
        ];
        $normalizers     = [
            new DateTimeNormalizer($defaultContext),
            new ArrayDenormalizer(),
            //            new GetSetMethodNormalizer(),   // GET SET METHOD NORMALIZER does not work on ENTITIES!!!!!!!!!!!!!!!!!!!!
            new ObjectNormalizer(
                null,
                new ApiNameConverterOnlySnake(), # We need this in order to properly convert data with JSONDIFF
                null,
                $typeExtractor
            ),
            new ArrayDenormalizer(),
        ];
        if ($include_get_set_method_normalizer) {
            $normalizers[] = new GetSetMethodNormalizer();
        }
        return new Serializer(normalizers: $normalizers, encoders: [new JsonEncoder()]);
    }

    public function get_merge_configuration(): ?MergeConfig
    {
        $serializer = $this->get_serializer();
        if ($this->params->has('MERGE_CONFIG')) {
            return $serializer->deserialize(
                json_encode($this->params->get('MERGE_CONFIG')),
                MergeConfig::class,
                'json'
            );
        }
        return null;
    }

    private function apply_changes_to_entity(
        mixed $object_data_from_db, # entity via reflection class
        ReflectionClass $object_reflection_class, # to get all functions for manipulation
        array $changes_to_apply, # changes from calculate_differences->merged --> array
        array $ignore_fields = array('id', 'uuid'),
    ): mixed {
        if ($changes_to_apply and sizeof($changes_to_apply) > 0) {
            foreach ($changes_to_apply as $change_field_name => $change_value) {
                if ( in_array($change_field_name, $ignore_fields)) {
                    // We need to ignore fields mentioned in `ignore_fields`
                    continue;
                }
                # item == {'<field>' => '<value>'}
                try {
                    $entity_property = $object_reflection_class->getProperty($change_field_name);

                    # TODO: Maybe try to find out if we need converted for some other types? (INT is already correctly casted to INT from STRING automatically by PHP
                    if ($entity_property->getType()->getName() == 'DateTime') {
                        $entity_property->setValue(
                            $object_data_from_db,
                            date_create_from_format('Y-m-d H:i:s', $change_value)
                        );
                    } else {
                        $entity_property->setValue($object_data_from_db, $change_value);
                    }

                } catch (Exception $e) {
                    // if some field does not exist, we will just IGNORE it , we will still write to WARNING , but that is it!
                    $this->logger('Could not add new value in #apply_changes_to_entity for field: ' . '');
                }
            }
        }
        return $object_data_from_db;
    }

    private function calculate_differences(
        string $entity_short_name,
        mixed $db_object,
        mixed $fe_object,
        array $excluded_fields = array('id')
    ): MergeResolutionCalculation {
        $changes    = array();
        $return_object = new MergeResolutionCalculation();
        $return_object->merged = $db_object;
        $return_object->conflicted = array();
        $serializer = $this->get_serializer();
//        $differences = new JsonDiff($db_object, $fe_object, 0, $fields_to_ignore);
        # Example from before: `$modified_new        = $differences_between_objects->getModifiedNew();`
        $this->logger->warning(($db_object['last_modified']));
        $this->logger->warning(($fe_object['last_modified']));

        $differences = new JsonDiff($db_object, $fe_object, 0, skipPaths: $excluded_fields);

        /**
         * @var MergeConfig $conflict_configuration
         */
        $conflict_configuration = $this->get_merge_configuration();
        $entity_conflict_configuration = $this->conflictConfigurationService->get_conflict_field_groups_by_entity_name(
            $entity_short_name
        );
        $default_merge_resolution      = $this->conflictConfigurationService->get_default_merge_resolution();


        # find merge resolution configuration
        # for each diff check if there is specific merge resolution or if it is a conflict
//        $conflicted_items = array();
        foreach ($differences->getModifiedPaths() as $modified_path) {
            $modified_path_converted = $this->convert_path_json_string_to_plain_string($modified_path);

            $default_merge_resolution = $this->conflictConfigurationService->get_default_merge_resolution();

            # We get array that represents values from `groups` inside configuration
            $entity_merge_resolutions = $this->conflictConfigurationService->get_conflict_field_groups_by_entity_name(
                $entity_short_name
            );

            $conflict_resolution = $conflict_configuration->default_conflict_resolution;
            $merge_resolution    = $conflict_configuration->default_merge_resolution;

            $merge_resolution_to_use = $default_merge_resolution ?: MergeResolutionEnum::NO_RESTRICTIONS;
            if ($entity_merge_resolutions) {
                $filtered_merge_resolution_for_entity = array_values(array_filter(
                    $entity_merge_resolutions,
                    function ($array_item) use ($modified_path_converted) {
                        /**
                         * Item example:
                         * -
                         * field_name: 'field1'
                         * merge_resolution: 3
                         */
                        return array_key_exists(
                                'field_name',
                                $array_item
                            ) and $array_item['field_name'] === $modified_path_converted;
                    }
                ));
                # If filter gives us correct data we override variable with first value from the array - since we should get only one filtered value if filter applies
                $filtered_merge_resolution_for_entity = sizeof(
                    $filtered_merge_resolution_for_entity
                ) > 0 ? $filtered_merge_resolution_for_entity[0] : null;
                if ($filtered_merge_resolution_for_entity) {
                    $merge_resolution_to_use_loc = $this->conflictConfigurationService->get_merge_resolution_from_conflict_group(
                        $filtered_merge_resolution_for_entity
                    );
                    if ($merge_resolution_to_use_loc) {
                        $merge_resolution_to_use = $merge_resolution_to_use_loc;
                    }
                }

                /**
                 * @Probably deprecated
                 * UNRESOLVED ITEMS:
                 * 1. what to do in case merge policy == user interaction? We will need to mark it as conflict.
                 * How are we gonna prepare data structure that will return merged and conflicted data?
                 *
                 * Answer: When conflict occurs, we will store conflicted data to array of conflicts. All other fields,
                 * that will not have conflict will be merge by MERGE policy. That way we will get the following structure
                 * for the response:
                 * {
                 *      "merged": {"field1": "1", "field3": "3", "field2": "4"},
                 *      "conflicted": [{"field_name": "field2", "value": "2"}],
                 *      "status": "conflicte" | "success" | "error",
                 *      "error?: "<error>" #
                 * }
                 */
            }
            // DO MERGE

            /**
             * @param MergeResolutionEnum $merge_policy
             * @param string $changed_field
             * @param string $changed_value
             * @param array $be_object_array
             * @return MergeResolutionCalculation
             */
            $calculate_merge = function (
                MergeResolutionEnum $merge_policy,
                string $changed_field,
                string $changed_value,
                array $be_object_array,
                string $fe_last_modified,
                string $be_last_modified,
            ): MergeResolutionCalculation {
                $merge_resolution             = new MergeResolutionCalculation();
                $merge_resolution->conflicted = array();
                switch ($merge_policy) {
                    case MergeResolutionEnum::OLDER_CHANGES: //
                        # @deprecated ?  If changed_field does not yet exist on be_object_array, then it will be added (but be careful - if this property is not defined on CLASS , then this will break!)
                        if ($fe_last_modified < $be_last_modified) {
                            return $this->create_conflict_data(be_object_array: $be_object_array, changed_field: $changed_field, changed_value: $changed_value);
                        }
                        $be_object_array[$changed_field] = $changed_value; # what about special type values e.g. DATETIME???
                        $merge_resolution->merged        = $be_object_array;
                        return $merge_resolution;
                    case MergeResolutionEnum::USER_INTERACTION_NEEDED:
                        # this is considered A CONFLICT!
                        if ($fe_last_modified != $be_last_modified) { // If some other data was changed in between
                            return $this->create_conflict_data(
                                be_object_array: $be_object_array,
                                changed_field: $changed_field,
                                changed_value: $changed_value
                            );
                        }
                    case MergeResolutionEnum::NO_RESTRICTIONS:
                    case MergeResolutionEnum::DEFAULT:
                    case MergeResolutionEnum::NONE:
                    default:
                        # Added logic that will by default or by design allow any change !!!
                        $be_object_array[$changed_field] = $changed_value; # what about special type values e.g. DATETIME???
                        $merge_resolution->merged        = $be_object_array;
                        return $merge_resolution;
                }
            };

            $calculated_merge = $calculate_merge(
                $merge_resolution_to_use,
                $modified_path_converted,
                $fe_object[$modified_path_converted],
                $db_object,
                $fe_object['last_modified'],
                $db_object['last_modified'],
            );
            if (sizeof($calculated_merge->conflicted) > 0) {
                array_push($return_object->conflicted, ...$calculated_merge->conflicted);
            }

            $db_object = $calculated_merge->merged;

            continue;

            // FOR now we ommit this code;
            {
                if (array_key_exists($entity_short_name, $conflict_configuration->conflict_field_groups)) {
                    $conflict_field_groups = $conflict_configuration->conflict_field_groups[$entity_short_name]->groups;
                    foreach ($conflict_field_groups as $conflict_field_group) {
                        if ($conflict_field_group->field_name == $modified_path_converted) {

                            $changes[$modified_path_converted] = $fe_object[$modified_path_converted];

                            # Check if we can merge, based on merge_resolution in conflict_field_group
                            # TODO: Logic for matched fields - depending of the merge_resolution
                            # Confirmation: $conflict_field_group->field_name is really equal to $modified_path_converted (when we define correct field in configuration)
                            break;
                        }
                    }
                }
            }
        }
//        return $changes;
        $return_object->merged = $db_object;
        return $return_object;
//        }

    }

    private function create_conflict_data (
        $be_object_array,
        $changed_field,
        $changed_value
    ): MergeResolutionCalculation {
        $merge_resolution             = new MergeResolutionCalculation();
        $merge_resolution->conflicted = array();
        $merge_resolution->merged      = $be_object_array;
        $conflicted_change             = new ConflictResolutionCalculation();
        $conflicted_change->field_name = u($changed_field)->camel();
        $conflicted_change->value      = $changed_value;
        $conflicted_change->conflict_id = Uuid::uuid4();
        $conflicted_change->datetime   = new \DateTime();
        $merge_resolution->conflicted  = array(
            $conflicted_change
        );

        return $merge_resolution;
    }

    private function convert_path_json_string_to_plain_string(string $json_string, int $count = 1): string
    {
        return str_replace('/', '', str_replace('"', '', $json_string, $count), $count);
    }
}

class MergeProcessResult
{
    /**
     * @var ConflictResolutionCalculation[]
     */
    public mixed $conflicts;

    public mixed $merged_db_object; # In case of conflict, all non-conflicted data is merged!

    public \DateTime $last_modified;
}

class MergeResolutionCalculation
{
    public array $merged;
    /**
     * @var ConflictResolutionCalculation[]
     */
    public mixed $conflicted;
}

class ConflictResolutionCalculation
{
    public string $field_name;
    public string $value;
    public string $conflict_id;
    public ?\DateTime $datetime;
}

class MergeConflictFieldGroup
{
    public string $field_name;
    public int $merge_resolution;
}

class MergeConflictIntermediate
{
    /**
     * @var MergeConflictFieldGroup[]
     */
    public mixed $groups = array();
}

class MergeConfig
{
    public int $default_merge_resolution;
    public int $default_conflict_resolution;
    /**
     * @var array<string, MergeConflictIntermediate> $conflict_field_groups ;
     */
    public mixed $conflict_field_groups;
}

