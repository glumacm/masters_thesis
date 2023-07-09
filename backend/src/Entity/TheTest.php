<?php

namespace App\Entity;

use App\Repository\TheTestRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TheTestRepository::class)]
#[ORM\HasLifecycleCallbacks]
class TheTest
{
    /**
     * ZELO DOBRO VEDETI:
     *
     * - id polje se pri 'deserialize' procesu ne bo nastavilo, ker nimamo setterja
     * - ce ima neko polje nastavljen privzeto 'null' vrednost, potem se to polje ne bo moglo nikoli ignorirati pri deserializaciji (ce npr. ni podano znotraj podatkov)
     *      + posledicno ce bo null natavljen npr. ?string $name = null, potem ce podatka ne spremenimo in ga ne posljemo kot del sprememb na BE, se bo privzeto nastavilo na NULL, kar pa ni pravilno delovanje!!!
     * - json_decode ne bo pravilno pretvoril camel case v snake case npr: "{"lastModified": "nekaj"}", bo pretvorjen v {"lastModified": "nekaj"} namesto v {"last_modified":"nekaj"}
     * - ko pretvorimo (casting) object/entity v asociativno tabelo, se imena propertyjev pretvorijo v <potDoEntitete><ime_fielda> . Primer: App\\Entity\\TheTest\\name.
     * Zato je potrebno odstraniti odvecen prefix!
     */

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id;

    #[ORM\Column(type: 'string', length: 255, nullable: false, unique: true)]
    private string $uuid;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $name;

    #[ORM\Column(type:'integer', length: 255, nullable: true)]
    private ?int $random_integer;

    #[ORM\Column(length: 255, nullable: false)]
    private ?string $description;

    /**
     * @var \DateTime|null
     */
    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?\DateTime $last_modified;

    public function getId(): ?int
    {
        return $this->id;
    }

    /**
     * @return string
     */
    public function getUuid(): string
    {
        return $this->uuid;
    }

    /**
     * @param string $uuid
     */
    public function setUuid(string $uuid): void
    {
        $this->uuid = $uuid;
    }

    /**
     * @return int|null
     */
    public function getRandomInteger(): ?int
    {
        return $this->random_integer;
    }

    /**
     * @param int|null $random_integer
     */
    public function setRandomInteger(?int $random_integer): void
    {
        $this->random_integer = $random_integer;
    }



    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): self
    {
        $this->name = $name;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    public function getLastModified(): ?\DateTime
    {
        return $this->last_modified;
    }

    public function setLastModified(?\DateTime $new_datetime): self
    {
        $this->last_modified = $new_datetime;

        return $this;
    }

    #[ORM\PrePersist]
    #[ORM\PreUpdate]
    public function preCallback() {
        // Everytime we update or persist data, we can do some manipulation on data. In this case setting 'last_modified' to current timestamp.
        $this->setLastModified(new \DateTime());
    }

    public function __toString(): string
    {
        // TODO: Implement __toString() method.
        return 'TEST ME: ' . $this->getId();
    }
}
