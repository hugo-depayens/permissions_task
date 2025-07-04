export const PERMISSIONS_METADATA = {
    TRADES: ['create', 'create_manual'],
    INVENTORY: ['create', 'read', 'update', 'delete'],
} as const;

export type Modules = keyof typeof PERMISSIONS_METADATA;

export type ModuleActions = {
    [M in Modules]: (typeof PERMISSIONS_METADATA)[M][number];
};

export type Permission = {
    [M in Modules]: { module: M; action: ModuleActions[M] }
}[Modules];

export enum ErrorCode {
    InvalidPayload = 'invalid_payload',
    DatabaseError = 'db_error',
    UnknownError = 'unknown_error',
    InvalidPermission = 'invalid_permission',
}

export interface NatsErrorResponse {
    error: {
        code: ErrorCode;
        message: string;
    };
}

export function isNatsError(response: any): response is NatsErrorResponse {
    return response && typeof response.error === 'object' && response.error.code;
}

export interface StatusOkResponse {
    status: 'ok';
}

export interface GrantRequest<M extends Modules = Modules> {
    apiKey: string;
    module: M;
    action: ModuleActions[M];
}
export type GrantResponse = StatusOkResponse | NatsErrorResponse;

export interface RevokeRequest<M extends Modules = Modules> {
    apiKey: string;
    module: M;
    action: ModuleActions[M];
}
export type RevokeResponse = StatusOkResponse | NatsErrorResponse;

export interface CheckRequest<M extends Modules = Modules> {
    apiKey: string;
    module: M;
    action: ModuleActions[M];
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