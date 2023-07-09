import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private httpClient: HttpClient // dokler nimamo BE, se clienta ne rabi - bomo mockali request
  ) {
    
  }

  getFirstRequest(id: any, entityPath: string): Observable<any> {
    const encodedUriEntityPath = encodeURIComponent(entityPath);
    
    // return this.httpClient.get(`https://localhost/.well-known/mercure?topic=https://localhost/get-object/${encodedUriEntityPath}/${id}`);
    return this.httpClient.get(`https://localhost/api/get-object/${encodedUriEntityPath}/${id}`);
  }

  getObjectFromBE(objectName: string, objectId: any): Observable<any> {
    return new Observable((observer) => {
      observer.next(
        {
          firstInput: 'jjajaja',
          secondInput: 'nonono',
          updatedAt: new Date()
        }
      );
      observer.complete();
    })
  }

  storeObjectInBE(objectName: string, object: any): Observable<any> {
    return new Observable((observer) => {
      observer.next(object);
      observer.complete();
    })
  }

  postChangesInBE(objectName: string, objectData: any, last_db_modified: string, objectId?: any): Observable<any> {
    const envelopeDataObject = {
      // 'class_name': 'App\\Entity\\TheTest',
      'class_name': objectName,
      'last_db_modified' : last_db_modified,
      'object_data': objectData
    }
    return this.httpClient.post(
      'https://localhost/api/get-object',
      envelopeDataObject
    );
  }
}
