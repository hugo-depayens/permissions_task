import { db } from '../db';
import { Permission } from '../types/permission';
import { logger } from '../logger';

export async function grantPermissionInDb(apiKey: string, module: string, action: string): Promise<void> {
    const query = `
        INSERT INTO permissions (api_key, module, action)
        VALUES ($1, LOWER($2), LOWER($3))
        ON CONFLICT (api_key, module, action) DO NOTHING;
    `;
    try {
        await db.query(query, [apiKey, module, action]);
    } catch (err) {
        logger.error({ err, apiKey, module, action }, 'Database error during grant');
        throw err;
    }
}

export async function revokePermissionInDb(apiKey: string, module: string, action: string): Promise<void> {
    const query = `
        DELETE FROM permissions
        WHERE api_key = $1 AND module = LOWER($2) AND action = LOWER($3);
    `;
    try {
        await db.query(query, [apiKey, module, action]);
    } catch (err) {
        logger.error({ err, apiKey, module, action }, 'Database error during revoke');
        throw err;
    }
}

export async function listPermissionsFromDb(apiKey: string): Promise<Permission[]> {
    const query = `SELECT module, action FROM permissions WHERE api_key = $1;`;
    try {
        const result = await db.query<{ module: string, action: string }>(query, [apiKey]);
        return result.rows.map(p => ({
            ...p,
            module: p.module.toUpperCase()
        })) as Permission[];
    } catch (err) {
        logger.error({ err, apiKey }, 'Database error during list');
        throw err;
    }
}

export async function checkPermissionInDb(apiKey: string, module: string, action: string): Promise<boolean> {
    const query = `
        SELECT 1 FROM permissions
        WHERE api_key = $1 AND module = LOWER($2) AND action = LOWER($3);
    `;
    try {
        const result: any = await db.query(query, [apiKey, module, action]);
        return result.rowCount > 0;
    } catch (err) {
        logger.error({ err, apiKey, module, action }, 'Database error during check');
        throw err;
    }
}