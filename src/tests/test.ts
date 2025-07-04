import { connect, NatsConnection } from 'nats';
import { PermissionsClient } from '../permission-library/client';
import { isNatsError, CheckResponse, ListResponse, StatusOkResponse } from '../types/permission';
import { logger } from '../logger';
import {env} from "../config/env";

const NATS_URL = env.NATS_URL;
const TEST_API_KEY = env.TEST_API_KEY;

/**
 * @param condition - Условие, которое должно быть истинным.
 * @param successMessage - Сообщение при успехе.
 * @param failureMessage - Сообщение при неудаче.
 */
function assert(condition: boolean, successMessage: string, failureMessage: string) {
    if (condition) {
        logger.info(`PASS: ${successMessage}`);
    } else {
        logger.error(`FAIL: ${failureMessage}`);
        throw new Error(failureMessage);
    }
}


export async function test() {
    logger.info('--- Starting Permissions Service Test Suite ---');
    let nc: NatsConnection | null = null;

    try {
        nc = await connect({ servers: NATS_URL });
        logger.info({ server: nc.getServer() }, 'Connected to NATS');
        const client = new PermissionsClient(nc);

        logger.info({ step: 1, action: 'grant', module: 'trades', key: TEST_API_KEY }, 'Granting initial permission...');
        const grantResponse = await client.grant({ apiKey: TEST_API_KEY, module: 'trades', action: 'create' });
        logger.info({ response: grantResponse }, 'Grant response received');
        assert(!isNatsError(grantResponse), 'Grant request was successful', 'Grant request returned an error');

        logger.info({ step: 2, action: 'check', module: 'trades', key: TEST_API_KEY }, 'Checking for existing permission...');
        const checkResponse1 = await client.check({ apiKey: TEST_API_KEY, module: 'trades', action: 'create' });
        logger.info({ response: checkResponse1 }, 'Check response received');
        assert(!isNatsError(checkResponse1), 'Check request did not return an error', 'Check request returned an error');
        assert((checkResponse1 as { allowed: boolean }).allowed === true, 'Permission is allowed as expected', 'Permission was not allowed');

        logger.info({ step: 3, action: 'list', key: TEST_API_KEY }, 'Listing all permissions...');
        const listResponse1 = await client.list({ apiKey: TEST_API_KEY });
        logger.info({ response: JSON.stringify(listResponse1) }, 'List response received');
        assert(!isNatsError(listResponse1), 'List request did not return an error', 'List request returned an error');
        assert((listResponse1 as { permissions: any[] }).permissions.length === 1, 'List contains 1 permission', `Expected 1 permission, but got ${(listResponse1 as any)?.permissions?.length}`);
        assert((listResponse1 as { permissions: any[] }).permissions[0].module === 'trades' && (listResponse1 as { permissions: any[] }).permissions[0].action === 'create', 'Listed permission matches granted permission', 'Listed permission does not match granted permission');

        logger.info({ step: 4, action: 'revoke', module: 'trades', key: TEST_API_KEY }, 'Revoking the first permission...');
        const revokeResponse = await client.revoke({ apiKey: TEST_API_KEY, module: 'trades', action: 'create' });
        logger.info({ response: revokeResponse }, 'Revoke response received');
        assert(!isNatsError(revokeResponse), 'Revoke request was successful', 'Revoke request returned an error');


        logger.info('All tests passed successfully!');

    } catch (error: any) {
        logger.error({ err: error }, 'Test suite failed with a critical error.');
        process.exit(1);
    } finally {
        if (nc) {
            await nc.close();
            logger.info('NATS connection closed.');
        }
    }
}

