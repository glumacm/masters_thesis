<?php

namespace App\Service;

use App\Enum\SyncSimulationEntityTimeTypeEnum;
use App\Models\SyncSimulationEntityTime;
use App\Models\SyncSimulationSummary;
use App\Models\SyncSimulationSummaryReportResult;
use App\Models\SyncSimulationSummaryResult;
use App\Models\SyncSimulationTime;
use Psr\Log\LoggerInterface;
use Symfony\Component\Finder\Finder;

class SimulationSummaryService
{

    const SIMULATION_DIRECTORY = 'simulation';
    const SIMULATION_SUMMARY_NAME = 'simulation_summary';

    private LoggerInterface $logger;
    private MergeService $merge_service;

    public function __construct(
        LoggerInterface $logger,
        MergeService $merge_service,
    ) {
        $this->logger        = $logger;
        $this->merge_service = $merge_service;
    }

    /**
     * @param string $directory_to_search
     * @param string $needle_in_file_name
     * @return array|null
     * @TODO Moram preimenovati funkcijo, v kaj bolj smiselnega
     */
    public function findMatchingFiles(string $directory_to_search, string $needle_in_file_name): ?array
    {
        $finder = $this->findFilesInPath($directory_to_search);
        if (!$finder->hasResults()) {
            return null;
        }

        $summary_report_success = $this->createEmptySummaryReport();
        $summary_report_error   = $this->createEmptySummaryReport();
        foreach ($finder as $file) {
            $filename                  = $file->getFilename();
            $file_matches_summary_file = str_contains($filename, $needle_in_file_name);
            if ($file_matches_summary_file) {
                $file_test  = $file->getContents();
                $serializer = $this->merge_service->get_serializer();
                /**
                 * @var SyncSimulationSummary $simulation_summary
                 */
                $simulation_summary = $serializer->deserialize($file_test, SyncSimulationSummary::class, 'json');
                /**
                 * @var SyncSimulationSummaryResult[]
                 */

                $summary_report_success = $this->create_simulation_summary_results(
                    $simulation_summary,
                    $summary_report_success
                );
                $summary_report_error   = $this->create_simulation_summary_results(
                    $simulation_summary,
                    $summary_report_error,
                    SyncSimulationEntityTimeTypeEnum::ERROR
                );
            }
        }
        $now                    = new \DateTime();
        $now_formated           = $now->format('Y-m-d_H:i');
        $final_results_success  = $this->calculateAverageTimesOnFinalResults($summary_report_success->summary_results);
        $final_results_error    = $this->calculateAverageTimesOnFinalResults($summary_report_error->summary_results);
        $summary_report_error   = $this->calculateAverageTimesForAllBatches(
            $summary_report_error,
            $final_results_error
        );
        $summary_report_success = $this->calculateAverageTimesForAllBatches(
            $summary_report_success,
            $final_results_success
        );

        $summary_report_success->summary_results = $final_results_success;
        $summary_report_error->summary_results   = $final_results_error;
        $summary_report_success = $this->checkBatchMinMaxForDefaultAndSetToZero($summary_report_success);
        $summary_report_error = $this->checkBatchMinMaxForDefaultAndSetToZero($summary_report_error);

        //TODO: To bi bilo dobro premestitit v FileService?
        file_put_contents(
            sprintf(
                '%s/%s_%s.%s',
                $directory_to_search,
                sprintf('%s', $now_formated),
                'simulation_report_result_success',
                'json'
            ),
            $serializer->serialize($summary_report_success, 'json'),
        );

        file_put_contents(
            sprintf(
                '%s/%s_%s.%s',
                $directory_to_search,
                sprintf('%s', $now_formated),
                'simulation_report_result_error',
                'json'
            ),
            $serializer->serialize($summary_report_error, 'json'),
        );
        return array();
    }

    private function checkBatchMinMaxForDefaultAndSetToZero(SyncSimulationSummaryReportResult $summary_report): SyncSimulationSummaryReportResult
    {
        if($summary_report->batch_max_time == PHP_FLOAT_MIN) {
            $summary_report->batch_max_time = 0;
        }
        if($summary_report->batch_min_time == PHP_FLOAT_MAX) {
            $summary_report->batch_min_time = 0;
        }

        return $summary_report;
    }

    private function createEmptySummaryReport(): SyncSimulationSummaryReportResult
    {
        $final_report                           = new SyncSimulationSummaryReportResult();
        $final_report->summary_results          = array();
        $final_report->total_count              = 0;
        $final_report->total_sync_success_count = 0;
        $final_report->total_sync_error_count   = 0;
        $final_report->total_time               = 0;
        $final_report->total_average_for_batch  = 0;
        $final_report->batch_max_time           = PHP_FLOAT_MIN;
        $final_report->batch_min_time           = PHP_FLOAT_MAX;


        return $final_report;
    }

    /**
     * @param SyncSimulationSummary $simulation_summary
     * @param array $summary_results == [<identifier> => SyncSimulationSummaryResult]
     * @return array
     */
    private function create_simulation_summary_results(
        SyncSimulationSummary $simulation_summary,
        SyncSimulationSummaryReportResult $summary_report,
        SyncSimulationEntityTimeTypeEnum $entity_time_type = SyncSimulationEntityTimeTypeEnum::SUCCESS
    ): SyncSimulationSummaryReportResult {
        $serializer = $this->merge_service->get_serializer();
        if (!$simulation_summary->simulation_times) {
            return array();
        }

        $summary_results = $summary_report->summary_results;

        /**
         * @var SyncSimulationTime $simulation_time
         */
        foreach ($simulation_summary->simulation_times as $key => $simulation_time) {
            /**
             * @var SyncSimulationEntityTime $simulation_entity_time
             */
            foreach ($simulation_time->entity_times as $key_j => $simulation_entity_time) {
                $entity_name_empty           = !$simulation_entity_time->entity_name;
                $objects_empty               = !$simulation_entity_time->number_of_objects;
                $summary_report->total_count += $simulation_entity_time->objects_size;
                $summary_report->total_time  += $simulation_entity_time->sync_time;
                $is_invalid_entity_time_type = $simulation_entity_time->type !== $entity_time_type->name;
                if ($is_invalid_entity_time_type) {
                    continue; # da znamo delati razliko med SUCCESS in ERROR
                }

                if ($entity_name_empty or $objects_empty) {
                    continue;  # preskocimo nepoznane entrije
                }

                if ($entity_time_type === SyncSimulationEntityTimeTypeEnum::SUCCESS) {
                    $summary_report->total_sync_success_count += $simulation_entity_time->objects_size;
                } elseif ($entity_time_type === SyncSimulationEntityTimeTypeEnum::ERROR) {
                    $summary_report->total_sync_error_count += $simulation_entity_time->objects_size;
                }

                // IDENTIFIKATOR === <entityName>_<number_of_objects>
                $entry_identifier = sprintf(
                    '%s_%s',
                    $simulation_entity_time->entity_name,
                    $simulation_entity_time->number_of_objects
                );
                /**
                 * @var SyncSimulationSummaryResult
                 */
                $summary_results[$entry_identifier] = $this->incrementSummaryResultEntry(
                    $summary_results,
                    $entry_identifier,
                    $simulation_entity_time
                );
                if($simulation_entity_time->sync_time > $summary_report->batch_max_time) {
                    $summary_report->batch_max_time = $simulation_entity_time->sync_time;
                }

                if ($simulation_entity_time->sync_time < $summary_report->batch_min_time) {
                    $summary_report->batch_min_time = $simulation_entity_time->sync_time;
                }
            }
        }
        $summary_report->summary_results = $summary_results;
        return $summary_report;
    }

    /**
     * @param SyncSimulationSummaryReportResult $summary_report
     * @param array $summary_results
     * @return SyncSimulationSummaryReportResult
     */
    private function calculateAverageTimesForAllBatches(
        SyncSimulationSummaryReportResult $summary_report,
        array $summary_results
    ): SyncSimulationSummaryReportResult {
        /**
         * @var SyncSimulationSummaryResult $summary_result
         */
        $number_of_batches = 0;
        foreach ($summary_results as $key => $summary_result) {
            $summary_report->total_average_for_batch += $summary_result->average_time;
            $number_of_batches                       += 1;
        }

        $summary_report->total_average_for_batch = $number_of_batches > 0 ? $summary_report->total_average_for_batch / $number_of_batches : 0;

        return $summary_report;
    }

    /**
     * @param array $summary_results
     * @return SyncSimulationSummaryResult[]
     */
    private function calculateAverageTimesOnFinalResults(array $summary_results): array
    {
        /**
         * @var SyncSimulationSummaryResult $summary_result
         */
        foreach ($summary_results as $key => $summary_result) {
            $summary_result->average_time         = $summary_result->total_time / $summary_result->number_of_instances;
            $summary_result->objects_average_size = $summary_result->objects_total_size / $summary_result->number_of_instances;
            $summary_results[$key]                = $summary_result;
        }

        return $summary_results;
    }

    private function incrementSummaryResultEntry(
        array $summary_results,
        string $entry_identifier,
        SyncSimulationEntityTime $simulation_entity_time
    ): SyncSimulationSummaryResult {
        $summary_result = $this->createEmptySimulationSummaryResult(
            $simulation_entity_time->entity_name,
            $simulation_entity_time->number_of_objects
        );
        if (key_exists($entry_identifier, $summary_results)) {
            $summary_result = $summary_results[$entry_identifier];
        }

        // dodaj nove vrednosti
        $summary_result->number_of_instances += 1;
        $summary_result->total_time          += $simulation_entity_time->sync_time;
        $summary_result->objects_total_size  += $simulation_entity_time->objects_size;

        return $summary_result;
    }

    private function createEmptySimulationSummaryResult(
        string $entity_name,
        int $number_of_objects
    ): SyncSimulationSummaryResult {
        $new_object                       = new SyncSimulationSummaryResult();
        $new_object->entity_name          = $entity_name;
        $new_object->number_of_objects    = $number_of_objects;
        $new_object->average_time         = 0;
        $new_object->total_time           = 0;
        $new_object->number_of_instances  = 0;
        $new_object->objects_total_size   = 0;
        $new_object->objects_average_size = 0;
        return $new_object;
    }

    public function findFilesInPath(string $directory_to_search): Finder
    {
        $finder = new Finder();
        $finder->files()->in(sprintf('%s', $directory_to_search));
        return $finder;
    }
}
