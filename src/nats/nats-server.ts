import { NatsConnection, JSONCodec, Subscription } from 'nats';
import { logger } from '../logger';
import {
    GrantRequest, GrantResponse,
    RevokeRequest, RevokeResponse,
    CheckRequest, CheckResponse,
    ListRequest, ListResponse,
    NatsErrorResponse, ErrorCode, Permission,
    PERMISSIONS_METADATA, Modules
} from '../types/permission';
import {
    grantPermissionInDb,
    revokePermissionInDb,
    listPermissionsFromDb,
    checkPermissionInDb
} from '../services/db.service';
import {
    updateKvCache,
    getPermissionsFromKv,
    getPermissionsMapFromKv
} from '../services/kv.service';

const jc = JSONCodec();

function isValidPermission(module: string, action: string): boolean {
    const upperModule = module.toUpperCase() as Modules;
    const lowerAction = action.toLowerCase();

    const allowedActions = PERMISSIONS_METADATA[upperModule];
    if (!allowedActions) {
        return false;
    }

    return (allowedActions as readonly string[]).includes(lowerAction);
}

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
                if (msg.data.length === 0) throw new Error("Payload is empty");
                data = jc.decode(msg.data) as TRequest;
            } catch (err: any) {
                logger.error({ subject, err: err.message }, 'Invalid payload received');
                const errorResponse: NatsErrorResponse = { error: { code: ErrorCode.InvalidPayload, message: 'Failed to parse JSON payload.' } };
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
                const errorResponse: NatsErrorResponse = { error: { code, message } };
                msg.respond(jc.encode(errorResponse));
            }
        }
    })().catch(err => logger.error(`Subscription for ${subject} failed: ${err.message}`));

    return sub;
}

export async function startNatsListeners(nc: NatsConnection): Promise<void> {

    await createServiceSubscription<GrantRequest, GrantResponse>(nc, 'permissions.grant', async (data) => {
        if (!isValidPermission(data.module, data.action)) {
            return {
                error: {
                    code: ErrorCode.InvalidPermission,
                    message: `Action '${data.action}' is not valid for module '${data.module}'.`
                }
            };
        }
        await grantPermissionInDb(data.apiKey, data.module, data.action);
        const allPermissions = await listPermissionsFromDb(data.apiKey);
        await updateKvCache(data.apiKey, allPermissions);
        return { status: 'ok' };
    });

    await createServiceSubscription<RevokeRequest, RevokeResponse>(nc, 'permissions.revoke', async (data) => {
        if (!isValidPermission(data.module, data.action)) {
            return {
                error: {
                    code: ErrorCode.InvalidPermission,
                    message: `Action '${data.action}' is not valid for module '${data.module}'.`
                }
            };
        }
        await revokePermissionInDb(data.apiKey, data.module, data.action);
        const allPermissions = await listPermissionsFromDb(data.apiKey);
        await updateKvCache(data.apiKey, allPermissions);
        return { status: 'ok' };
    });

    await createServiceSubscription<ListRequest, ListResponse>(nc, 'permissions.list', async (data) => {
        let permissions = await getPermissionsFromKv(data.apiKey);

        if (!permissions) {
            logger.info({ apiKey: data.apiKey }, 'Cache miss for list, fetching from DB');
            permissions = await listPermissionsFromDb(data.apiKey);
            await updateKvCache(data.apiKey, permissions);
        }

        return { permissions };
    });

    await createServiceSubscription<CheckRequest, CheckResponse>(nc, 'permissions.check', async (data) => {
        const module = data.module.toLowerCase();
        const action = data.action.toLowerCase();

        const permissionsMap = await getPermissionsMapFromKv(data.apiKey);

        if (permissionsMap) {
            logger.info({ apiKey: data.apiKey }, 'Cache hit for check');
            const hasPermission = permissionsMap[module]?.includes(action) ?? false;
            return { allowed: hasPermission };
        }

        logger.info({ apiKey: data.apiKey }, 'Cache miss for check, fetching from DB');
        const hasPermission = await checkPermissionInDb(data.apiKey, module, action);
        if (hasPermission) {
            listPermissionsFromDb(data.apiKey)
                .then(perms => updateKvCache(data.apiKey, perms))
                .catch(err => logger.error({err}, "Background cache update failed"));
        }

        return { allowed: hasPermission };
    });

    logger.info('All NATS listeners started.');
}