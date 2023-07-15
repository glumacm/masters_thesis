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
 * At some point example of the structure:
 * {
 *      mockedResponseType: CustomAxiosMockedResponseEnum.SUCCESS, 
 *      mockedResponseData:
 *          {
 *              status: 200,
 *              response: // --> This object is received as SUCCESS, when axios returns data in `then`!!!
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


    /**
     * Main problem: How to garantee that we will always get stubData, because stubData should be received only at one point
     * Instead of doing it on each POST,GET request in the logic.
     * 
     * Maybe the best way would be to have main data as "mutated" data. This means that data is set through another function + data could be passed into constructor. This way I would be able to dynamically 
     * change data when needed. This way gives us one problem: Main.ts and workers have to have this function.
     * 
     * Lets test this question !!!! --> We confirm that this will not work, because we have the same problem with sending SyncLib events from worker (we need to have a helper function)
     * @param url 
     * @param method 
     * @param stubType 
     * @param stubData 
     */
    private stubMoxios(url: string, method: string, stubType: CustomAxiosMockedResponseEnum, stubData: any) {
        if (this.mockedAxios) {
            // I expect that we will have preset response data this.mockedResponse
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
             * Idea: If we would need to set same STUB to many times:
             *  + we create a mapper which includes structure: {<url> : { <axios_method>: {<stub_response> : <[ERR, SUCCESS, ....]>}}}
             * based on this we would know which which new stub to add or not.
             */
            this.stubMoxios(url, 'get', CustomAxiosMockedResponseEnum.SUCCESS, config?.mockedData);
        }
        return this.instance.get(url, config);
    }

    public post(url: string, data: any, config?: CustomAxiosRequestConfig<any>): Promise<any> {
        if (this.mockedAxios) {
            /**
             * Idea: If we would need to set same STUB to many times:
             *  + we create a mapper which includes structure: {<url> : { <axios_method>: {<stub_response> : <[ERR, SUCCESS, ....]>}}}
             * based on this we would know which which new stub to add or not.
             */
            this.stubMoxios(url, 'post', CustomAxiosMockedResponseEnum.SUCCESS, config?.mockedData);
        }
        return this.instance.post(url, data, config);
    }
}
