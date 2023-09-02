<?php

namespace App\Service;

use App\Models\SyncSimulationEntityTime;
use App\Models\SyncSimulationSummary;
use App\Models\SyncSimulationTime;
use Psr\Log\LoggerInterface;
use Symfony\Component\Finder\Finder;

class SimulationSummaryService
{
    private LoggerInterface $logger;
    private MergeService $merge_service;

    public function __construct(
        LoggerInterface $logger,
        MergeService $merge_service,
    )
    {
        $this->logger = $logger;
        $this->merge_service = $merge_service;
    }

    /**
     * @param string $directory_to_search
     * @param string $needle_in_file_name
     * @return array|null
     */
    public function findMatchingFiles(string $directory_to_search, string $needle_in_file_name): ?array
    {
        $finder = $this->findFilesInPath($directory_to_search);
        if (!$finder->hasResults()) {
            return null;
        }

        foreach ($finder as $file) {
            $filename = $file->getFilename();
            $file_matches_summary_file = str_contains($filename, $needle_in_file_name);
            if ($file_matches_summary_file) {
                $file_test = $file->getContents();
                $serializer = $this->merge_service->get_serializer();
                /**
                 * @var SyncSimulationSummary $simulation_summary
                 */
                $simulation_summary = $serializer->deserialize($file_test, SyncSimulationSummary::class, 'json');
                $this->iterate_through_summary($simulation_summary);
            }
        }
        return array();
    }

    private function iterate_through_summary(SyncSimulationSummary $simulation_summary): void {
        if (!$simulation_summary->simulation_times) {
            return;
        }


        $sum_up = [];
        for ($i = 1 ; $i <= 20; $i++) {
            $sum_up[$i] = array();  # Potrebujem nov razred, ki mi bo omogocal sledece: { current_count: <number>, number_of_occurrences: <number} -> da na koncu lahko naredimo current_count/number_of_occurrences => average
        }

        /**
        * 3 for loope rabim:
        * 1 za it cez object.simulationTimes
        * 1 za it cez object.simulationTimes[i].entityTimes
        * 1 za iteracijo cez vsak key v object.simulationTimes[i].entityNames[key]
        *
        *
        * Na koncu zelim imeti podatek o:
        * - iteracija:
        *      - ime entitete
        *      - stevilo objektov
        *      - stevilo vseh instanc/pojavitev take kombinacije (ime entitete + stevilo objektov)
        *      - povprecje casa za najden kombo
        * - povpreceje za vsako entiteto s stevilom objektov od 1 do n (20).
        *
        */


        /**
         * @var SyncSimulationTime $simulation_time
         */
        foreach ($simulation_summary->simulation_times as $key =>$simulation_time ) {
//            $this->logger->info($simulation_time->entity_times); // ni mogoce tega izpisati
//            $this->logger->info($simulation_time->total_time);
            /**
             * @var SyncSimulationEntityTime $simulation_entity_time
             */
            foreach ($simulation_time->entity_times as $key_j => $simulation_entity_time) {
//                $this->logger->info($simulation_entity_time->entity_name);
//                $this->logger->info($simulation_entity_time->type);
//                $this->logger->info($simulation_entity_time->request_uuid);
//                $this->logger->info($simulation_entity_time->number_of_objects);
//                $this->logger->info($simulation_entity_time->objects_size);
//                $this->logger->info($simulation_entity_time->sync_time);
            }
        }
    }

    public function findFilesInPath(string $directory_to_search): Finder {
        $finder = new Finder();
        $finder->files()->in(sprintf('%s', $directory_to_search));
        return $finder;
    }
}
