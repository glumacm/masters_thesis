export function pathToSimpleNameMapper(simpleNameToPathMap: any) {
    const newMapper = {} as any;
    for (let property of Object.keys(simpleNameToPathMap)) {
        newMapper[simpleNameToPathMap[property]] = property;
    }
    return newMapper;
    
    

}