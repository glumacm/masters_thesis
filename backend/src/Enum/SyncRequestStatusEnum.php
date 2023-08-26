<?php

namespace App\Enum;

enum SyncRequestStatusEnum
{
    case STOPPED;
    case IN_PROGRESS;
    case FINISHED;
    case CANCELED;
    case SUCCESS;

    /**
     * @param string $name
     * @param $logger
     * @return static
     */
    public static function fromName(string $name): self
    {
        foreach (self::cases() as $status) {
            if( $name === $status->name or strtoupper($name) ){
                return $status;
            }
        }
        throw new \ValueError("$name is not a valid backing value for enum " . self::class );
    }
}
