export interface Permission {
    module: string;
    action: string;
}

export enum ErrorCode {
    InvalidPayload = 'invalid_payload',
    ApiKeyNotFound = 'apiKey_not_found',
    PermissionAlreadyExists = 'permission_already_exists',
    PermissionNotFound = 'permission_not_found',
    DatabaseError = 'db_error',
    CacheError = 'cache_error',
    UnknownError = 'unknown_error',
}


export interface NatsErrorResponse {
    error: {
        code: ErrorCode;
        message: string;
    };
}

export interface StatusOkResponse {
    status: 'ok';
}

export interface GrantRequest {
    apiKey: string;
    module: string;
    action: string;
}
export type GrantResponse = StatusOkResponse | NatsErrorResponse;

export interface RevokeRequest {
    apiKey: string;
    module: string;
    action: string;
}
export type RevokeResponse = StatusOkResponse | NatsErrorResponse;

export interface CheckRequest {
    apiKey: string;
    module: string;
    action: string;
}
export interface CheckResponseSuccess {
    allowed: boolean;
}
export type CheckResponse = CheckResponseSuccess | NatsErrorResponse;

export interface ListRequest {
    apiKey: string;
}
export interface ListResponseSuccess {
    permissions: Permission[];
}
export type ListResponse = ListResponseSuccess | NatsErrorResponse;

/**
 * @param response - Ответ от NATS RPC
 */
export function isNatsError(response: any): response is NatsErrorResponse {
    return response && typeof response.error === 'object' && response.error.code;
}