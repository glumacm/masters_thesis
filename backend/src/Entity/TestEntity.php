<?php

namespace App\Entity;

use App\Repository\TestEntityRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TestEntityRepository::class)]
#[ORM\HasLifecycleCallbacks]
class TestEntity
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

    #[ORM\Column(type:'string', length: 255, nullable: true)]
    private ?string $first_input;

    #[ORM\Column(type:'string', length: 255, nullable: true)]
    private ?string $second_input;

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
     * @return string|null
     */
    public function getFirstInput(): ?string
    {
        return $this->first_input;
    }

    /**
     * @param string|null $first_input
     */
    public function setFirstInput(?string $first_input): void
    {
        $this->first_input = $first_input;
    }

    /**
     * @return string|null
     */
    public function getSecondInput(): ?string
    {
        return $this->second_input;
    }

    /**
     * @param string|null $second_input
     */
    public function setSecondInput(?string $second_input): void
    {
        $this->second_input = $second_input;
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
