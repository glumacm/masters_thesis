'use strict';

const agent0_upserts = [
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt1_1_1",
            "secondInput": "Objekt1_2_1"
        },
        "recordId": "147c5a00-a669-4c16-9db0-152d0705ee77"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt2_1_1",
            "secondInput": "Objekt2_2_1"
        },
        "recordId": "21abacaa-e1ce-475f-9573-201e44f437a3"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt3_1_1",
            "secondInput": "Objekt3_2_1"
        },
        "recordId": "5334f3ae-6db1-4b58-ac3b-603ca01ad83f"
    }
];

const agent1_upserts = [
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt1_1_2",
            "secondInput": "Objekt1_2_2"
        },
        "recordId": "147c5a00-a669-4c16-9db0-152d0705ee77"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt2_1_1",
            "secondInput": "Objekt2_2_1"
        },
        "recordId": "21abacaa-e1ce-475f-9573-201e44f437a3"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt3_1_1",
            "secondInput": "Objekt3_2_1"
        },
        "recordId": "5334f3ae-6db1-4b58-ac3b-603ca01ad83f"
    }
];

const agent2_upserts = [
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt1_1_3",
            "secondInput": "Objekt1_2_3"
        },
        "recordId": "147c5a00-a669-4c16-9db0-152d0705ee77"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt2_1_3",
            "secondInput": "Objekt2_2_3"
        },
        "recordId": "21abacaa-e1ce-475f-9573-201e44f437a3"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt3_1_3",
            "secondInput": "Objekt3_2_3"
        },
        "recordId": "5334f3ae-6db1-4b58-ac3b-603ca01ad83f"
    }
];

const agent3_upserts = [
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt1_1_4",
            "secondInput": "Objekt1_2_4"
        },
        "recordId": "147c5a00-a669-4c16-9db0-152d0705ee77"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt2_1_4",
            "secondInput": "Objekt2_2_4"
        },
        "recordId": "21abacaa-e1ce-475f-9573-201e44f437a3"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt3_1_4",
            "secondInput": "Objekt3_2_4"
        },
        "recordId": "5334f3ae-6db1-4b58-ac3b-603ca01ad83f"
    }
];

const agent4_upserts = [
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt1_1_5",
            "secondInput": "Objekt1_2_5"
        },
        "recordId": "147c5a00-a669-4c16-9db0-152d0705ee77"
    },
    {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt2_1_5",
            "secondInput": "Objekt2_2_5"
        },
        "recordId": "21abacaa-e1ce-475f-9573-201e44f437a3"
    },
    {
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt3_1_5",
            "secondInput": "Objekt3_2_5"
        },
        "recordId": "5334f3ae-6db1-4b58-ac3b-603ca01ad83f"
    }
];

const agent0 = [
    {
        "action": "CHANGE_NETWORK",
        "networkStatus": "offline"
    },
    ...agent0_upserts
    ,
    {
        "action": "BATCH_SYNC"
    }
];

const agent1 = [
    {
        "action": "CHANGE_NETWORK",
        "networkStatus": "offline"
    },
    ...agent1_upserts
    ,
    {
        "action": "BATCH_SYNC"
    }
];

const agent2 = [
    {
        "action": "CHANGE_NETWORK",
        "networkStatus": "offline"
    },
    ...agent2_upserts
    ,
    {
        "action": "BATCH_SYNC"
    }
];


const agent3 = [
    {
        "action": "CHANGE_NETWORK",
        "networkStatus": "offline"
    },
    ...agent3_upserts
    ,
    {
        "action": "BATCH_SYNC",
    }
];

const agent4 = [
    {
        "action": "CHANGE_NETWORK",
        "networkStatus": "offline"
    },
    ...agent4_upserts
    ,
    {
        "action": "BATCH_SYNC"
    }
];

const agentsData = {
    0: {
        agentId: "PrviOdjemalec",
        simulationName: "Sinh_Brez_Omrezja_Brez_Avtomatike",
        steps: agent0,
    },
    1: {
        agentId: "DrugiOdjemalec",
        simulationName: "Sinh_Brez_Omrezja_Brez_Avtomatike",
        steps: agent1,
    },
    2: {
        agentId: "TretjiOdjemalec",
        simulationName: "Sinh_Brez_Omrezja_Brez_Avtomatike",
        steps: agent2
    },
    3: {
        agentId: "CetrtiOdjemalec",
        simulationName: "Sinh_Brez_Omrezja_Brez_Avtomatike",
        steps: agent3
    },
    4: {
        agentId: "PetiOdjemalec",
        simulationName: "Sinh_Brez_Omrezja_Brez_Avtomatike",
        steps: agent4
    }

}

const agentsSimWithNetNoAuto = {
    0: {
        agentId: "PrviOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike",
        steps: [
            ...agent0_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    1: {
        agentId: "DrugiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike",
        steps: [
            ...agent1_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    2: {
        agentId: "TretjiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike",
        steps: [
            ...agent2_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    3: {
        agentId: "CetrtiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike",
        steps: [
            ...agent3_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    4: {
        agentId: "PetiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike",
        steps: [
            ...agent4_upserts,
            {
                "entityName": "testEntity",
                "action": "UPSERT",
                "data": {
                    "firstInput": "Objekt4Extra_1_5",
                    "secondInput": "Objekt4Extra_2_5"
                },
                "recordId": "00000000-a669-4c16-9db0-152d0705ee99"
            },
            {
                "action": "BATCH_SYNC"
            }
        ],
    }
}

const agentsSimWithNetAndAuto = {
    0: {
        agentId: "PrviOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_In_Avtomatiko",
        steps: [
            ...agent0_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    1: {
        agentId: "DrugiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_In_Avtomatiko",
        steps: [
            ...agent1_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    2: {
        agentId: "TretjiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_In_Avtomatiko",
        steps: [
            ...agent2_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    3: {
        agentId: "CetrtiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_In_Avtomatiko",
        steps: [
            ...agent3_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    4: {
        agentId: "PetiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_In_Avtomatiko",
        steps: [
            ...agent4_upserts,
            {
                "entityName": "testEntity",
                "action": "UPSERT",
                "data": {
                    "firstInput": "Objekt4Extra_1_5",
                    "secondInput": "Objekt4Extra_2_5"
                },
                "recordId": "00000000-a669-4c16-9db0-152d0705ee99"
            },
            {
                "action": "BATCH_SYNC"
            }
        ],
    }
}

const agentsSimWithNetAndConflicts = {
    0: {
        agentId: "PrviOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike_S_Konflikti",
        steps: [
            ...agent0_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    1: {
        agentId: "DrugiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike_S_Konflikti",
        steps: [
            ...agent1_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    2: {
        agentId: "TretjiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike_S_Konflikti",
        steps: [
            ...agent2_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    3: {
        agentId: "CetrtiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike_S_Konflikti",
        steps: [
            ...agent3_upserts,
            {
                "action": "BATCH_SYNC"
            }
        ],
    },
    4: {
        agentId: "PetiOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike_S_Konflikti",
        steps: [
            ...agent4_upserts,
            {
                "entityName": "testEntity",
                "action": "UPSERT",
                "data": {
                    "firstInput": "Objekt4Extra_1_5",
                    "secondInput": "Objekt4Extra_2_5"
                },
                "recordId": "00000000-a669-4c16-9db0-152d0705ee99"
            },
            {
                "action": "BATCH_SYNC"
            }
        ],
    }
}

module.exports = {
    agentsData: agentsData,
    agentsSimWithNetNoAuto: agentsSimWithNetNoAuto,
    agentsSimWithNetAndAuto: agentsSimWithNetAndAuto,
    agentsSimWithNewAndConflicts: agentsSimWithNetAndConflicts,
};