<?php

namespace App\Enum;

enum SyncBatchSingleEntityStatusEnum
{
    case COMPLETE_SUCCESS;
    case PARTIAL_SUCESS;
    case FATAL_ERROR;
}
