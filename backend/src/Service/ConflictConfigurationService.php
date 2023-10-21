<?php

namespace App\Service;

use App\Enum\MergeResolutionEnum;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Yaml\Yaml;

class ConflictConfigurationService
{

    private $em;
    private $serializer;
    private $logger;

    private string $projectDir;

    private mixed $yaml_configuration;

    const CONFIGURATION_FILE_PATH = '/config/conflict-configuration.yaml';

    public function __construct(
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        LoggerInterface $logger,
        string $projectDir,
    ) {
        $this->em = $em;
        $this->serializer = $serializer;
        $this->logger = $logger;
        $this->projectDir = $projectDir;


        $this->yaml_configuration = Yaml::parseFile($this->projectDir . self::CONFIGURATION_FILE_PATH);
    }

    public function get_conflict_field_groups(): mixed {
        return $this->yaml_configuration['conflict_field_groups'];
    }

    public function get_conflict_field_groups_by_entity_name(string $entity_name, string $groups_field = 'groups'): mixed {
        $full_configuration = self::get_conflict_field_groups();
        if (!key_exists($entity_name, $full_configuration) ) {
            return null;
        }

        if (!key_exists($groups_field, $full_configuration[$entity_name])) {
            return null;
        }

        return $full_configuration[$entity_name][$groups_field];
    }

    public function get_field_name_from_conflict_group(mixed $conflict_group): ?string {
        if (!$conflict_group) {
            return null;
        }

        if (!key_exists('field_name', $conflict_group)) {
            return null;
        }

        return $conflict_group['field_name'];
    }

    public function get_merge_resolution_from_conflict_group(mixed $conflict_group): ?MergeResolutionEnum {
        if (!$conflict_group) {
            return null;
        }

        if (!key_exists('merge_resolution', $conflict_group)) {
            return null;
        }

        return MergeResolutionEnum::fromInt($conflict_group['merge_resolution']);
    }

    public function get_default_merge_resolution(): MergeResolutionEnum {
        if (!key_exists('default_merge_resolution', $this->yaml_configuration)) {
            # Currently if no configuration is provided we fallback to NO_RESTRICTIONS
            return MergeResolutionEnum::NO_RESTRICTIONS;
        }

        return MergeResolutionEnum::fromInt($this->yaml_configuration['default_merge_resolution']);
    }
}
