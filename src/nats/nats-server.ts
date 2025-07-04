import { NatsConnection, JSONCodec, Subscription } from 'nats';
import { logger } from '../logger';
import {
    GrantRequest, GrantResponse,
    RevokeRequest, RevokeResponse,
    CheckRequest, CheckResponse,
    ListRequest, ListResponse,
    NatsErrorResponse, ErrorCode
} from '../types/permission';
import {
    grantPermissionInDb,
    revokePermissionInDb,
    listPermissionsFromDb
} from '../services/db.service';
import { updateKvCache, getPermissionsFromKv } from '../services/kv.service';

const jc = JSONCodec();

async function createServiceSubscription<TRequest, TResponse>(
    nc: NatsConnection,
    subject: string,
    handler: (data: TRequest) => Promise<TResponse>
): Promise<Subscription> {
    const sub = nc.subscribe(subject);
    logger.info(`Listening for requests on '${subject}'`);

    (async () => {
        for await (const msg of sub) {
            let data: TRequest;
            try {
                data = jc.decode(msg.data) as TRequest;
                if (!data) throw new Error("Payload is empty or invalid");
            } catch (err) {
                logger.error({ subject, err }, 'Invalid payload received');
                const errorResponse: NatsErrorResponse = {
                    error: { code: ErrorCode.InvalidPayload, message: 'Failed to parse JSON payload.' }
                };
                msg.respond(jc.encode(errorResponse));
                continue;
            }

            try {
                const response = await handler(data);
                msg.respond(jc.encode(response));
            } catch (err: any) {
                logger.error({ subject, data, err }, 'Error during request processing');
                const code = err.code ? ErrorCode.DatabaseError : ErrorCode.UnknownError;
                const message = code === ErrorCode.DatabaseError ? 'A database error occurred.' : (err.message || 'An internal server error occurred.');

                const errorResponse: NatsErrorResponse = {
                    error: { code, message }
                };
                msg.respond(jc.encode(errorResponse));
            }
        }
    })().catch(err => logger.error(`Subscription for ${subject} failed: ${err.message}`));

    return sub;
}

export async function startNatsListeners(nc: NatsConnection): Promise<void> {
    await createServiceSubscription<GrantRequest, GrantResponse>(nc, 'permissions.grant', async (data) => {
        await grantPermissionInDb(data.apiKey, data.module, data.action);
        const allPermissions = await listPermissionsFromDb(data.apiKey);
        await updateKvCache(data.apiKey, allPermissions);
        return { status: 'ok' };
    });

    await createServiceSubscription<RevokeRequest, RevokeResponse>(nc, 'permissions.revoke', async (data) => {
        await revokePermissionInDb(data.apiKey, data.module, data.action);
        const allPermissions = await listPermissionsFromDb(data.apiKey);
        await updateKvCache(data.apiKey, allPermissions);
        return { status: 'ok' };
    });

    await createServiceSubscription<ListRequest, ListResponse>(nc, 'permissions.list', async (data) => {
        let permissions = await getPermissionsFromKv(data.apiKey);
        if (permissions) {
            logger.info({ apiKey: data.apiKey }, 'Cache hit for list');
            return { permissions };
        }

        logger.info({ apiKey: data.apiKey }, 'Cache miss for list, fetching from DB');
        permissions = await listPermissionsFromDb(data.apiKey);
        await updateKvCache(data.apiKey, permissions);

        return { permissions };
    });

    await createServiceSubscription<CheckRequest, CheckResponse>(nc, 'permissions.check', async (data) => {
        let permissions = await getPermissionsFromKv(data.apiKey);

        if (permissions) {
            logger.info({ apiKey: data.apiKey }, 'Cache hit for check');
        } else {
            logger.info({ apiKey: data.apiKey }, 'Cache miss for check, fetching from DB');
            permissions = await listPermissionsFromDb(data.apiKey);
            await updateKvCache(data.apiKey, permissions);
        }

        const hasPermission = permissions.some(
            p => p.module === data.module && p.action === data.action
        );

        return { allowed: hasPermission };
    });

    logger.info('All NATS listeners started.');
}