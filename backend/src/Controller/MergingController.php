<?php

namespace App\Controller;


use App\Entity\TheTest;
use App\Service\GenericService;
use App\Service\MergeService;

use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class MergingController extends AbstractController
{
    #[Route('/api/merging/{entity_name}', name: 'app_merging', methods:['POST'])]
    public function index(
        Request $request,
        string $entity_name,
        MergeService $merge_service,
        GenericService $generic_service,
        LoggerInterface $logger,
    ): JsonResponse
    {
//        $logger->warning('This is entity name: ' . $entity_name);
//        $logger->warning('This is entity name:78 ' . $generic_service->get_class_from_string($entity_name));




        # Dobimo razred entitete, ki jo moramo sinhronizirati
        $entity_name_reflection_class = $generic_service->get_class_from_string($entity_name);

        if ($entity_name_reflection_class == null) {
            return new JsonResponse(data: json_encode('Entity does not exist!'));
        }

        # Dobimo obstojec ojekt, ki ga bomo singronizirali s podatki iz FE
        $object_data_from_db = $merge_service->get_entity_object($entity_name_reflection_class->getName(), 7);

        $serializer = $merge_service->get_serializer();

        /**
         * @var TheTest $object_data
         */
        $object_data = $serializer->deserialize(
            ($request->getContent()),
            $entity_name_reflection_class->getName(),
            'json'
        );

        $repository = $generic_service->findRepositoryFromString($entity_name);
        if (!$object_data_from_db && property_exists(json_decode($request->getContent()), 'id')) {
            $object_data->setUuid(json_decode($request->getContent())->id);
            // $object_data->setId()
            /*
             * var EntityRepository
             */

            $repository->save(
                $object_data,
                flush: true,
                persist: true
            );

            return $this->json([
                'message' => 'Welcome to your new controller!',
                'path' => 'src/Controller/MergingController.php',
            ]);

        }

        $new_data = $merge_service->start_merge_process($object_data, $entity_name);
        $repository->save(
            $new_data,
            flush: true,merge: true,persist: false
        );


        $object_to_be_converte_to_class_instance = $entity_name_reflection_class->newInstance();




        /*
         * 1. Gremo skozi vse lastnosti, ki smo jih poslali preko POST-a -> ubistvi nam to ze resi DESERIALIZER
         * 2. nastavimo nove vrednosti v razred in IGNORIRAMO neobstojece
         * 3. [IF]
         * 3.1 Ce obstaja objekt v DB moramo primerjati tega z novim objektom
         * 3.2 Ce ne obstaja, direktno dodaj v bazo
         */
//        $logger->warning($serializer->serialize($object_data, 'json'));
//        $logger->warning(property_exists(json_decode($request->getContent()), 'id'));
//        $logger->warning(json_decode($request->getContent())->id);
//        $logger->warning(json_encode($object_data->getLastModified()));


//        $logger->warning('This is json data');
//        $logger->warning($serializer->serialize($object_data,'json'));


        return $this->json([
            'message' => 'Welcome to your new controller!',
            'path' => 'src/Controller/MergingController.php',
        ]);

        $merge_service->start_merge_process($object_data, $entity_name);

        return $this->json([
            'message' => 'Welcome to your new controller!',
            'path' => 'src/Controller/MergingController.php',
        ]);
    }
}


