<?php

namespace App\Models;

class SyncSimulationSummaryReportResult
{

    public float $total_count;
    public float $total_sync_success_count; # count in [kB] unit for all SUCCESS use-cases
    public float $total_sync_error_count;  # count in [kB] unit for all ERROR use-cases
    public float $total_time;  # time counted in [ms] unit for all simulations
    public float $total_average_for_batch;
    public float $batch_min_time;
    public float $batch_max_time;
    public array $summary_results;
}
