import { OBJECT_NAME_TO_PATH_MAPPER } from "../configuration";

export function getObjectNameToPathMapper(pathToConfigFile?: string): {[key:string]: string} {
    return OBJECT_NAME_TO_PATH_MAPPER;
}