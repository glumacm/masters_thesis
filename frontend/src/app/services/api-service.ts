import { CONFIGURATION_CONSTANTS } from "../packages/configuration";
import { CustomAxios } from "../packages/services/custom-axios";

export class ApiService {
    customAxios: CustomAxios;
    constructor(
        mockedAxios: boolean,
        mockedAxiosResponse: any
    ) {
        this.customAxios = new CustomAxios(mockedAxios, mockedAxiosResponse);
    }

    exportDatabaseToFile(fileAsJson: any, databaseName: string, browserName: string) {
        return this.customAxios.post(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/refactored/store_fe_database_export/${databaseName}/${browserName}`, fileAsJson);
    }

    exportDatabaseToFileNew(fileAsJson: any, databaseName: string, browserName: string, simulationName: string) {
        return this.customAxios.post(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/refactored/store_fe_database_export/${databaseName}/${browserName}/${simulationName}`, fileAsJson);
    }

    initiateTestingExamplesForSyncJob() {
        return this.customAxios.get(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/refactored/initiate_sync_job_state_for_retry_testing`);
    }

    simulationSummary(agentId: string, fileContent: string) {
        return this.customAxios.post(
            `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/refactored/create_simulation_summary`,
            {
                fileContent,
                agentId
            }
        );
    }
}