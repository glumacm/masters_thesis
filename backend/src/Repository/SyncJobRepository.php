<?php

namespace App\Repository;

use App\Entity\SyncJob;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SyncJob>
 *
 * @method SyncJob|null find($id, $lockMode = null, $lockVersion = null)
 * @method SyncJob|null findOneBy(array $criteria, array $orderBy = null)
 * @method SyncJob[]    findAll()
 * @method SyncJob[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class SyncJobRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SyncJob::class);
    }

    public function save(SyncJob $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(SyncJob $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }
}
