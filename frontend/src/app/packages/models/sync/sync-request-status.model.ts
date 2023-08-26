import { Type } from "class-transformer";

/**
 * Initialization will be done via plainToInstance()
 */
export class SyncRequestStatus {
  @Type(() => Date)
  //@ts-ignore
  createdAt: Date;
  //@ts-ignore
  status: SyncRequestStatusEnum;
  //@ts-ignore
  uuid: string;
  //@ts-ignore
  listOfUuids: string[];
}