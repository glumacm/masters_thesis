<?php

namespace App\Enum;

enum SyncBatchSingleEntityStatusEnum
{
    case COMPLETE_SUCCESS;
    case PARTIAL_SUCESS;
    case COMPLETE_FAIL;
    case FATAL_ERROR;
    case CONCURRENCY_PROBLEM;
}
