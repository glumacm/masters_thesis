<?php

namespace App\Models;

class SyncSimulationSummaryReportResult
{

    public float $total_count;
    public float $total_sync_success_count; # stevilo [kB] za vse SUCCESS primere
    public float $total_sync_error_count;  # stevilo [kB] za vse ERROR primere
    public float $total_time;  # stevilo [ms] milisekunde za vse simulacije skupaj
    public float $total_average_for_batch;
    public float $batch_min_time;
    public float $batch_max_time;
    public array $summary_results;
}
