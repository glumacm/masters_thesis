import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as moxios from "moxios";
import { CONSOLE_STYLE, CustomConsoleOutput } from "../utilities/console-style";
import { AxiosError } from "axios";
import { AxiosResponse } from "axios";


export enum CustomAxiosMockedResponseEnum {
    SUCCESS = 'SUCCESS',
    ERR_BAD_REQUEST = 'ERR_BAD_REQUEST',
    ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE',
    ERR_NETWORK = 'ERR_NETWORK',
    ECONNABORTED = 'ECONNABORTED',
}

export interface MockedResponse {
    mockedResponseType: CustomAxiosMockedResponseEnum;
    mockedResponseData: AxiosResponse | AxiosError;
}

export interface CustomAxiosRequestConfig<T> extends AxiosRequestConfig<T> {
    mockedData?: any;
    mockedResponse?: CustomAxiosMockedResponseEnum;
}


/**
 * Trenutno najpopolnejsa struktura:
 * {
 *      mockedResponseType: CustomAxiosMockedResponseEnum.SUCCESS, 
 *      mockedResponseData:
 *          {
 *              status: 200,
 *              response: // --> Ta objekt dobimo kot SUCCESS, ko bo axios v `then` vrnil podatek!!!
 *                  {
 *                      data:
 *                          {
 *                              'andwewill': 'bewaving'
 *                          },
 *                      status: 200,
 *                      statusText: 'chase the',
 *                      headers: {} as any,
 *                      config: { headers: {} as any }
 *                  },
 *                  data: { 'jep': 'salt' },
 *                  statusText: 'lived back in the days',
 *                  headers: {},
 *                  config: {
 *                      data: { 'its': 'intheway' }
 *                  } as any
 *          }
 * }
 */
export class CustomAxios {
    // private static axios: Axios;
    private instance: AxiosInstance;
    private mockedAxios: boolean = false;
    private customOuput: CustomConsoleOutput;
    public mockedResponse: MockedResponse | undefined;

    // private mockedInstance: any; // mocxios

    constructor(mockedAxios: boolean = false, mockedResponse: MockedResponse | undefined = undefined) {
        this.customOuput = new CustomConsoleOutput('CustomAxios', CONSOLE_STYLE.sync_lib_retry_worker_thread);
        this.mockedAxios = mockedAxios;
        this.instance = axios.create();
        if (mockedAxios) {
            this.mockedResponse = { mockedResponseType: CustomAxiosMockedResponseEnum.SUCCESS, mockedResponseData: { status: 200, response: { data: { 'andwewil': 'bewaving' }, status: 200, statusText: 'chase the', headers: {} as any, config: { headers: {} as any } }, data: { 'jep': 'salt' }, statusText: 'lived back in the days', headers: {}, config: { data: { 'its': 'intheway' } } as any } };
            moxios.install(this.instance);
        }
    }

    // static getAxios(): Axios {
    //     if (!CustomAxios.axios) {
    //         console.log('kolkrat pa ja');

    //         CustomAxios.axios = axios.create();
    //     }
    //     console.log('kolkr pa ne?');

    //     return CustomAxios.axios;
    // }


    /**
     * Glavni problem: kako zagotoviti da bomo vedno dobili stubData , ker naceloma bi moral sedaj stubData pripraviti le na eni tocki.
     * Namesto da to na vsakem POST, GET requestu znotraj logike.
     * 
     * Mogoce bo najboljsi nacin, da bodo glavni podatki "mutirani". To pomeni, da bi jih nastavil preko druge metode + lahko bi dodal podatke preko konstruktorja. Ker na tak nacin bi lahko dinamicno sproti spreminjal zeljene
     * parametre. Tak nacin privede do enega problema: Main.ts in workerji morajo imeti funkcijo za nastavljati ta podatek, ker ga drugace ne morem nastaviti.
     * 
     * DAJMO TESTIRATI TO HIPOTEZO !!!! --> To ze lahko potrdimo da ne bo delovalo, ker imamo isti problem s posiljanjem SyncLib eventov iz workerja (moramo imeti helper funkcijo)
     * @param url 
     * @param method 
     * @param stubType 
     * @param stubData 
     */
    private stubMoxios(url: string, method: string, stubType: CustomAxiosMockedResponseEnum, stubData: any) {
        if (this.mockedAxios) {
            // Pricakujem da bomo imeli prednastavljene mocked response this.mockedResponse
            if (this.mockedResponse?.mockedResponseType) {
                // if (stubType === CustomAxiosMockedResponseEnum.SUCCESS) {
                if (this.mockedResponse.mockedResponseType === CustomAxiosMockedResponseEnum.SUCCESS) {
                    console.log('having fun in the daytime');

                    // moxios.stubRequest(url, this.mockedResponse?.mockedResponseData as any); // modkedData=  {status: 200,responseText: '…'}
                    moxios.stubRequest(url, this.mockedResponse?.mockedResponseData as any); // modkedData=  {status: 200,responseText: '…'}
                } else if (this.mockedResponse.mockedResponseType == CustomAxiosMockedResponseEnum.ECONNABORTED) {
                    moxios.stubTimeout(url);
                }
                else {
                    // moxios.stubFailure(method, url, stubData);
                    moxios.stubFailure(method, url, this.mockedResponse.mockedResponseData);
                }
            }
        }
    }

    public get(url: string, config?: CustomAxiosRequestConfig<any>): Promise<any> {
        if (this.mockedAxios) {
            /**
             * Ideja, ce bi prislo do pretiranega nastavljanja istega STUBA:
             *  + naredim nek mapper, ki bo imel strukturo: {<url> : { <axios_method>: {<stub_response> : <[ERR, SUCCESS, ....]>}}}
             * Na podlagi tega bi vedel za katere moram dodati nov stub ali ne.
             */
            this.stubMoxios(url, 'get', CustomAxiosMockedResponseEnum.SUCCESS, config?.mockedData);
        }
        return this.instance.get(url, config);
    }

    public post(url: string, data: any, config?: CustomAxiosRequestConfig<any>): Promise<any> {
        if (this.mockedAxios) {
            /**
             * Ideja, ce bi prislo do pretiranega nastavljanja istega STUBA:
             *  + naredim nek mapper, ki bo imel strukturo: {<url> : { <axios_method>: {<stub_response> : <[ERR, SUCCESS, ....]>}}}
             * Na podlagi tega bi vedel za katere moram dodati nov stub ali ne.
             */
            this.stubMoxios(url, 'post', CustomAxiosMockedResponseEnum.SUCCESS, config?.mockedData);
        }
        return this.instance.post(url, data, config);
    }
}
