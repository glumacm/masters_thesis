<?php

namespace App\Repository;

use App\Entity\TheTest;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TheTest>
 *
 * @method TheTest|null find($id, $lockMode = null, $lockVersion = null)
 * @method TheTest|null findOneBy(array $criteria, array $orderBy = null)
 * @method TheTest[]    findAll()
 * @method TheTest[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class TheTestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TheTest::class);
    }

    public function save(TheTest $entity, bool $flush = false, bool $merge = false, bool $persist = false): void
    {
        if ($merge) {
            $this->getEntityManager()->merge($entity);
        } elseif ($persist) {
            $this->getEntityManager()->persist($entity);
        }

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(TheTest $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }
}
