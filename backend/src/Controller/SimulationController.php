<?php

namespace App\Controller;


use App\Models\SyncSimulationSummaryRequest;
use App\Service\FileService;
use App\Service\MergeService;

use App\Service\SimulationSummaryService;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Finder\Finder;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class SimulationController extends AbstractController
{
    #[Route('api/simulation/create_summary_report', name: 'create_summary_report', methods: ['GET'])]
    public function create_summary_report(
        Request $request,
        LoggerInterface $logger,
        string $projectDir,
        SimulationSummaryService $simulation_summary_service,
    )
    {
        $finder = new Finder();
        $finder->files()->in(sprintf('%s/%s', $projectDir, SimulationSummaryService::SIMULATION_DIRECTORY));

        /**
         * @var Finder|null $filesMatchingSummaryFile
         */
        $filesMatchingSummaryFile = $simulation_summary_service->findMatchingFiles(sprintf('%s/%s', $projectDir, SimulationSummaryService::SIMULATION_DIRECTORY), SimulationSummaryService::SIMULATION_SUMMARY_NAME);
        return new JsonResponse(['success' => true]);
    }


    #[Route('api/simulation/create_simulation_summary', name: 'simulation_summary', methods: ['POST'])]
    public function simulation_summary(
        Request $request,
        string $projectDir,
        LoggerInterface $logger,
        FileService $file_service,
        MergeService $merge_service,
    ): Response
    {
        $serializer = $merge_service->get_serializer();
        /**
         * @var SyncSimulationSummaryRequest $sync_simulation_summary_request
         */
        $sync_simulation_summary_request = $serializer->deserialize($request->getContent(), SyncSimulationSummaryRequest::class, 'json');
        $agent_id = $sync_simulation_summary_request->agent_id;
        $file_name = $file_service->createFileName($projectDir, SimulationSummaryService::SIMULATION_DIRECTORY, sprintf('%s_%s', SimulationSummaryService::SIMULATION_SUMMARY_NAME, $agent_id));
        file_put_contents($file_name, $sync_simulation_summary_request->file_content);
        return new JsonResponse(['success' => true]);
    }
}


