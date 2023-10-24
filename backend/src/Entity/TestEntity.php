<?php

namespace App\Entity;

use App\Repository\TestEntityRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TestEntityRepository::class)]
#[ORM\HasLifecycleCallbacks]
class TestEntity
{
    /**
     * GOOD TO KNOW:
     * - `id` field does not get set during `deserialize` process because we do not have a setter
     * - if some field has a default value of `null` then this field will never be ignored during deserialization
     *      + therefore if we set default as null e.g. `?string $name =null` then if data in this field is not changed when we send changed from FE, then this field will be always set to NULL and therefore can override some data in the DB! (which is incorrect behaviour)
     * - json_decode does not correctly convert camel case to snake case e.g.  "{"lastModified": "something"}", will be converted to {"lastModified": "something"} instead of {"last_modified":"something"}
     * - when we cast an object into associative array then field names are converted into a structure like `<namespaceofentity><name_of_field>` e.g. `App\\Entity\\TheTest\\name`.
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
