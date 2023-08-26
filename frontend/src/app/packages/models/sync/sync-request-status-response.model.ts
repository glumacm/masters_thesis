import { Type } from "class-transformer";
import { SyncRequestStatus } from "./sync-request-status.model";

/**
 * Initialization will be done via plainToInstance()
 */
export class SyncRequestStatusResponse
 {
  @Type(() => Date)
  //@ts-ignore
  createdAt: Date
  @Type(()=>SyncRequestStatus)
  //@ts-ignore
  listOfRequestsStatuses: SyncRequestStatus[]
  //@ts-ignore
  entityName: string
}