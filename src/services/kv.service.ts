import { JSONCodec, KV } from 'nats';
import { getNatsConnection } from '../nats/connection';
import { Permission } from '../types/permission';
import { logger } from '../logger';

const BUCKET_NAME = 'permissions_cache';
const jc = JSONCodec<Record<string, string[]>>();
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
        const map: Record<string, string[]> = {};
        for (const { module, action } of permissions) {
            const m = module.toLowerCase();
            const a = action.toLowerCase();
            if (!map[m]) map[m] = [];
            if (!map[m].includes(a)) map[m].push(a);
        }
        await kvStore.put(apiKey, jc.encode(map));
    } catch (err) {
        logger.error({ err, apiKey }, 'Failed to update KV cache');
    }
}

export async function getPermissionsFromKv(apiKey: string): Promise<Permission[] | null> {
    try {
        const kvStore = await getKvStore();
        const entry = await kvStore.get(apiKey);
        if (!entry) return null;

        const permissionsMap = jc.decode(entry.value);

        const permissionsArray: Permission[] = [];
        for (const module in permissionsMap) {
            for (const action of permissionsMap[module]) {
                permissionsArray.push({ module: module.toUpperCase(), action } as Permission);
            }
        }

        return permissionsArray;
    } catch (err) {
        logger.error({ err, apiKey }, 'Failed to get from KV cache');
        return null;
    }
}

export async function getPermissionsMapFromKv(apiKey: string): Promise<Record<string, string[]> | null> {
    try {
        const kvStore = await getKvStore();
        const entry = await kvStore.get(apiKey);
        if (!entry) return null;
        return jc.decode(entry.value);
    } catch (err) {
        logger.error({ err, apiKey }, 'Failed to get map from KV cache');
        return null;
    }
}