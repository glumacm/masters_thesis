import { isDate } from "lodash";
import * as moment from "moment";
import 'reflect-metadata';
import { MergeProcessResultI } from "../../interfaces/sync/merge-process-result.interface";
import { Type } from "class-transformer";
import { ObjectDataWithLastModified } from "./event-source-stream-event.model";

export class MergeProcessResult implements MergeProcessResultI {
    conflicts: any[];
    @Type(()=>ObjectDataWithLastModified)
    mergedDbObject: ObjectDataWithLastModified;

    @Type(()=>Date)
    //@ts-ignore
    lastModified: Date;

    constructor(plainObject: any) {
        if (plainObject && plainObject.conflicts) {
            this.conflicts = plainObject.conflicts;
        } else {
            this.conflicts = [];
        }

        this.conflicts = (plainObject && plainObject.conflicts) ? plainObject.conflicts : [];
        if (plainObject && plainObject.mergedDbObject) {
            try {
                const test = plainObject.mergedDbObject;
                // Object.assign(docItem, objectWithChanges);

                // Odstranimo lastnosti, ki ne obstajajo v novem stanju
                const objKeys = Object.keys(test);
                for (let key of objKeys) {
                    if (!isFinite(test[key]) && moment.utc(test[key]).isValid()) {
                        test[key] = new Date(test[key]);
                    }
                }
            } catch (exception) {
                console.log('#MergePRocessResult error, while creating new instance');
                console.log(exception);                
            }
        }
        this.mergedDbObject = (plainObject && plainObject.mergedDbObject) ? plainObject.mergedDbObject : undefined;

    }

}

// export class MergeProcessResult1<T> implements MergeProcessResultI {
//     conflicts: any[] = [];
//     mergedDbObject: TheTestI = {} as TheTestI;



// }


// export interface TheTestI {
//     uuid: string;
//     lastModified: Date;
//     description: string;
//     name: string;
//     randomInteger: number;
//     id:string;
// }
export class TheTest {
    uuid?: string;
    lastModified?: Date;
    description?: string;
    name?: string;
    randomInteger?: number;

    constructor(object: any) {
        this.uuid = object.uuid;
        this.description = object.description;
        if (object.name) {
            this.name = object.name;
        }

        if (object.lastModified) {
            this.lastModified = new Date(object.lastModified);
        }

        if (object.randomInteger) {
            this.randomInteger = object.randomInteger;
        }
    }


}
