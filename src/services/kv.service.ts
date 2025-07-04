import { JSONCodec, KV } from 'nats';
import { getNatsConnection } from '../nats/connection';
import { Permission } from '../types/permission';
import { logger } from '../logger';

const BUCKET_NAME = 'permissions_cache';
const jc = JSONCodec();
let kv: KV;

async function getKvStore(): Promise<KV> {
    if (kv) return kv;
    const nc = getNatsConnection();
    const js = nc.jetstream();
    kv = await js.views.kv(BUCKET_NAME);
    return kv;
}

export async function updateKvCache(apiKey: string, permissions: Permission[]): Promise<void> {
    try {
        const kvStore = await getKvStore();
        const value = jc.encode(permissions);
        await kvStore.put(apiKey, value);
    } catch (err) {
        logger.error({ err, apiKey }, 'Failed to update KV cache');
    }
}

export async function getPermissionsFromKv(apiKey: string): Promise<Permission[] | null> {
    try {
        const kvStore = await getKvStore();
        const entry = await kvStore.get(apiKey);
        if (!entry) {
            return null;
        }
        return jc.decode(entry.value) as Permission[];
    } catch (err) {
        logger.error({ err, apiKey }, 'Failed to get from KV cache');
        return null;
    }
}