import 'reflect-metadata';
import { Type } from "class-transformer";
import { SyncEntityStatusEnum } from "../../enums/sync/sync-entity-status.enum";
import { SyncEntityResponseI } from "../../interfaces/sync/sync-entity-response.interface";
import { MergeProcessResult } from "./merge-process-result.model";

export class SyncEntityResponse implements SyncEntityResponseI {
    //@ts-ignore
    status: string;
    @Type(()=>MergeProcessResult)
    mergedData: MergeProcessResult | undefined;
    recordUuid: string | undefined;
    @Type(()=>Date)
    //@ts-ignore
    lastModified: Date;
    error: any;

    // createInstance<A>(c: new (pa:any) => A, param: any): A {
    //     return new c(param);
    //   }

}


// export class SyncEntityResponse1<T> implements SyncEntityResponse1I<T> {
//     status?: SyncEntityStatusEnum | undefined;
//     mergedData?: MergeProcessResult1I<T> | undefined;
//     error: any;

//     // constructor(object: any) {
//     //     this.status = (object && object?.status) ? SyncEntityStatusEnum[object.status as keyof typeof SyncEntityStatusEnum] : SyncEntityStatusEnum.SUCCESS;
//     //     this.mergedData = object && object?.mergedData ? new MergeProcessResult(object.mergedData) : undefined;
//     //     this.error = object && object?.error ? object.error : undefined;
//     // }

// }
