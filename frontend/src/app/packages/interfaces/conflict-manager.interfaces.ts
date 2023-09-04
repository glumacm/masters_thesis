import { Operation } from 'fast-json-patch';


import { MergeModeEnum } from "../enums/MergeModeEnum";

/**
 * What do we need to know about conflicts from configuration?
 * 
 * 1. To which objects/entities does configuration apply
 * 2. Table in which we store groups of fields -> one entry in table  represents ONE condition where conflict should be checked/thrown inside the object
 * 2. Which mode does field use for conflicts
 */



/**
 * ConflictManagerInterface
 * 
 * This is the fastest approach, since potential iterations through all `groups` could cause `n*m*k` time complexity. Where n == number of fields in one group, m == number of fields in `diff and k == number of lines in each group
 */
export interface ConflictManagerInterface {
    conflict_field_groups: { [key: string]: { groups: Array<Array<ConflictField>> }};
    default_merge_resolution: MergeModeEnum; // This value is a ROLLBACK/DEFAULT value, if some object does not have a definition for merging process
}

/**
 * This will work in a following way:
 * 
 * - We have a list of fields which is required to raise a conflict. Each field has it's own "auto-merge" setting. But we will not check for combination of field conditions, since this complicates a lot of things - especially time complexity!!!!
 */
export interface RestrictedConflictManagerInterface {
    conflict_field_groups: { [key: string]: { groups: Array<ConflictField> }};
    default_merge_resolution: MergeModeEnum; // This value is a ROLLBACK/DEFAULT value, if some object does not have a definition for merging process
}


export interface ConflictField {
    fieldName: string;
    mergeResolution: MergeModeEnum;
}


// @DEPRECATED
interface ConflictFieldGroup {
    default_merge_resolution: MergeModeEnum; // If this data is missing, then revert to data from parent (ConflictManagerInterface). This data is overwritten if each field has `merge_resolution` value defined.
}


//example #1
const conflictGroup = {
    'objectType1': {
        groups: [ // If at least one change in `diff` is found we need to immediatelly raise a conflict.
            [ // Group 1
                {
                    fieldName: 'field1',
                    mergeResolution: MergeModeEnum.DEFAULT
                },
                {
                    fieldName: 'field3',
                    mergeResolution: MergeModeEnum.NEWER_CHANGES
                }
            ],
            [ // Group 2
                {
                    fieldName: 'field1',
                    mergeResolution: MergeModeEnum.DEFAULT
                },
                {
                    fieldName: 'field4',
                    mergeResolution: MergeModeEnum.NEWER_CHANGES
                }
            ]
        ]
    }
}


export interface ConflictDifference {
    conflicts: Operation[];
    conflictCreated: Date;
  }
  
  export interface DiffValuesByRulesResult {
    record: any;
    // conflicts: ConflictDifference[]
    conflicts: ConflictDifference | undefined
  }