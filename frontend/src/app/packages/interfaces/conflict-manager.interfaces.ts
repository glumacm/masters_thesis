import { Operation } from 'fast-json-patch';


import { MergeModeEnum } from "../enums/MergeModeEnum";

/**
 * Kaj moramo vse vedeti iz konfiguracije za konflikte?
 * 
 * 1. Za katere objekte velja konfiguracija
 * 2. tabelo v kateri hranimo skupine fieldov -> en vnos v tabeli (torej ena notranja pod tabela) predstavlja "EN" kontekst konflikta znotraj definiranega objekta
 * 2. Kaksen mode ima vsak field
 */



/**
 * ConflictManagerInterface
 * 
 * To ni najhitrejsi pristop, saj bi potencialno preiskovanje po vseh 'groups' povzrocilo:  `n*m*k` zahtevnost. Kjer n==st.fieldov v posamezni 'groups' tabeli, m == st. fieldov v `diff` in k == st. vrstic v groups tabeli !!!!
 */
export interface ConflictManagerInterface {
    conflict_field_groups: { [key: string]: { groups: Array<Array<ConflictField>> }};
    default_merge_resolution: MergeModeEnum; // Ta vrednost je ROLLBACK vrednost, ce nek objekt nima definiranega polja `defaul_merge_resolution`
}

/**
 * Ta nacin bo deloval tako:
 * 
 * - Imamo seznam fieldov, ki morajo nujno javiti konflikt. Vsako polje ima lashko svoj "auto" merge nastavitev. Ne bomo pa gledali kombinacij fieldov, ker to privede do NEPREDSTAVLJIVE zahtevnosti !!!
 */
export interface RestrictedConflictManagerInterface {
    conflict_field_groups: { [key: string]: { groups: Array<ConflictField> }};
    default_merge_resolution: MergeModeEnum; // Ta vrednost je ROLLBACK vrednost, ce nek objekt nima definiranega polja `defaul_merge_resolution`
}


export interface ConflictField {
    fieldName: string;
    mergeResolution: MergeModeEnum;
}


// @DEPRECATED
interface ConflictFieldGroup {
    default_merge_resolution: MergeModeEnum; // Ce tega podatka ni, revertaj na podatek iz parenta (ConflictManagerInterface). Ta podatek je povozen, ce posamezno polje ima defiran `merge_resolution`
}


//example #1
const conflictGroup = {
    'objectType1': {
        groups: [ // Ce se vsaj ena verzija kombinacije spremmemb pojavi v `diff` je potrebno javiti konflikt
            [ // Skupina 1
                {
                    fieldName: 'field1',
                    mergeResolution: MergeModeEnum.DEFAULT
                },
                {
                    fieldName: 'field3',
                    mergeResolution: MergeModeEnum.NEWER_CHANGES
                }
            ],
            [ // Skupina 2
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