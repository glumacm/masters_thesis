<?php

namespace App\Enum;

enum SyncDoctrineEventActionEnum
{
    case DELETE;
    case NEW;
    case UPDATE;
}
