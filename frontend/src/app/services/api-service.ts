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
}