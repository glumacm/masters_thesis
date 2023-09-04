import * as moment from "moment";

export function convertDatabaseDatetimeStringToDate(dateInString: string): Date {
    // const convertedDate = moment.utc(dateInString);
    // const convertedDate = moment.parseZone(dateInString);
    const convertedDate = moment(dateInString, true).utcOffset(2, true);
    
    return convertedDate.toDate();
}