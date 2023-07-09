enum FetchNetworkOptionMethod {
    POST='POST',
    GET='GET',
    DELETE='DELETE',
    OPTIONS='OPTIONS',
    PUT='PUT'
}

enum FetchNetworkOptionMode {
    cors='cors',
    no_cors='no-cors',
    same_origin='same-origin'
}

enum FetchNetworkOptionCredentials {
    include='include',
    same_origin='same-origin',
    omit='omit'
}

enum FetchNetworkOptionRedirect {
    follow = 'follow',
    manual = 'manual',
    error = 'error'
}

enum FetchNetworkOptionReferrerPolicy {
    no_referrer = 'no-referrer',
    no_referrer_when_downgrade = 'no-referrer-when-downgrade',
    origin = 'origin',
    origin_when_cross_origin = 'origin-when-cross-origin',
    same_origin = 'same-origin',
    strict_origin = 'strict-origin',
    strict_origin_when_cross_origin = 'strict-origin-when-cross-origin',
    unsafe_url = 'unsafe-url'
}

export interface FetchNetworkOptions {
    method: FetchNetworkOptionMethod;
    mode: FetchNetworkOptionMode
    credentials: FetchNetworkOptionCredentials;
    headers: any;
    redirect: FetchNetworkOptionRedirect;
    referrerPolicy: FetchNetworkOptionReferrerPolicy;
    body: string // stringified data
}