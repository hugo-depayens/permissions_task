import { NatsConnection, StringCodec, JSONCodec } from 'nats';
import {
    GrantRequest, GrantResponse,
    RevokeRequest, RevokeResponse,
    CheckRequest, CheckResponse,
    ListRequest, ListResponse,
    isNatsError,
    NatsErrorResponse,
    ErrorCode
} from '../types/permission';

const jc = JSONCodec();

export class PermissionsClient {
    private nc: NatsConnection;

    constructor(natsConnection: NatsConnection) {
        if (!natsConnection || natsConnection.isClosed()) {
            throw new Error('A valid NATS connection is required.');
        }
        this.nc = natsConnection;
    }


    private async request<TRequest, TResponse>(subject: string, payload: TRequest): Promise<TResponse> {
        try {
            const responseMsg = await this.nc.request(subject, jc.encode(payload), { timeout: 5000 });
            return jc.decode(responseMsg.data) as TResponse;
        } catch (err: any) {
            return {
                error: {
                    code: ErrorCode.UnknownError,
                    message: `NATS request failed: ${err.message}`,
                }
            } as TResponse;
        }
    }

    async grant(payload: GrantRequest): Promise<GrantResponse> {
        return this.request<GrantRequest, GrantResponse>('permissions.grant', payload);
    }

    async revoke(payload: RevokeRequest): Promise<RevokeResponse> {
        return this.request<RevokeRequest, RevokeResponse>('permissions.revoke', payload);
    }

    async check(payload: CheckRequest): Promise<CheckResponse> {
        return this.request<CheckRequest, CheckResponse>('permissions.check', payload);
    }

    async list(payload: ListRequest): Promise<ListResponse> {
        return this.request<ListRequest, ListResponse>('permissions.list', payload);
    }
}