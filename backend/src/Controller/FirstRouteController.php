<?php

namespace App\Controller;

use App\Service\SynchronizationSyncingEntry;


enum ResponseMessageType
{
    case SUCCESS;
    case MISSING_REQUIRED_FIELDS;
    case SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH;
    case UNKNOWN_ERROR;
    case REPOSITORY_NOT_FOUND;
    case ENTITY_DOES_NOT_EXIST;
}

class ResponseMessage
{
    public $code;
    public $message;
    public ?string $type;
    public mixed $data;

    public function __construct(
        ?int $code = 200,
        ?string $message = 'SUCCESS',
        ?ResponseMessageType $type = ResponseMessageType::SUCCESS,
        mixed $data = null
    ) {
        $this->code    = $code;
        $this->message = $message;
        $type_value    = $type;
        if ($type) {
            $type_value = $type->name;
        }
        $this->type = $type_value;
        $this->data = $data;
    }

    /**
     * @return int|null
     */
    public function getCode(): ?int
    {
        return $this->code;
    }

    /**
     * @param int|null $code
     */
    public function setCode(?int $code): void
    {
        $this->code = $code;
    }

    /**
     * @return string|null
     */
    public function getMessage(): ?string
    {
        return $this->message;
    }

    /**
     * @param string|null $message
     */
    public function setMessage(?string $message): void
    {
        $this->message = $message;
    }

    /**
     * @return string|null
     */
    public function getType(): ?string
    {
        return $this->type;
    }

    /**
     * @param string|null $type
     */
    public function setType(?ResponseMessageType $type): void
    {
        $value = null;
        if ($type) {
            $value = $type->name;
        }
        $this->type = $value;
    }

    /**
     * @return mixed|null
     */
    public function getData(): mixed
    {
        return $this->data;
    }

    /**
     * @param mixed|null $data
     */
    public function setData(mixed $data): void
    {
        $this->data = $data;
    }


}

class RetryReEvaluation
{
    public string $object_uuid;
    public string $request_uuid;
    public int $retries;
    public string $status;
    public string $created_datetime;
    public mixed $data; // We need this for merging if requests from before was stopped/cancelled
}

class RetryReEvaluationPostData
{
    /**
     * @var RetryReEvaluation[]
     */
    public $re_evaluations;
}

class RefactoredRetryReEvaluationResponseData
{
    /**
     * @var string[] $in_progress_sync_job_uuids
     */
    public mixed $in_progress_sync_job_uuids;
    public string $status;
    public mixed $error;


    public function __construct(string $status, mixed $in_progress_sync_job_uuids)
    {
        $this->status = $status;
        $this->in_progress_sync_job_uuids = $in_progress_sync_job_uuids;
        $this->error = null;
    }

    /**
     * @return string[]
     */
    public function getInProgressSyncJobUuids(): mixed
    {
        return $this->in_progress_sync_job_uuids;
    }

    /**
     * @param string[] $in_progress_sync_job_uuids
     */
    public function setInProgressSyncJobUuids(mixed $in_progress_sync_job_uuids): void
    {
        $this->in_progress_sync_job_uuids = $in_progress_sync_job_uuids;
    }

    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * @param string $status
     */
    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    /**
     * @return mixed|null
     */
    public function getError(): mixed
    {
        return $this->error;
    }

    /**
     * @param mixed|null $error
     */
    public function setError(mixed $error): void
    {
        $this->error = $error;
    } // 'ERROR', 'SUCCESS', 'CONFLICT'




}

class RefactoredRetryReEvaluationPostData
{
    /**
     * @var SynchronizationSyncingEntry[]
     */
    public $re_evaluations;
}


/**
 * JSON_DECODE(JSON_ENCODE(obj), true) Does not work if we do not have PUBLIC fields!!!!!!!!!!!
 */
class TestFu
{
    public $hua = 'hello';
    public $hua1 = 'hello1';
}

