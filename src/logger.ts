import {LogLevel} from "./types";

const log = (level: LogLevel, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    const label = level.toUpperCase().padEnd(5);
    const colorMap = {
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        debug: '\x1b[90m',
    };
    const reset = '\x1b[0m';
    console.log(`${colorMap[level]}[${label}] ${timestamp}:${reset}`, ...args);
};

export const logger = {
    info: (...args: any[]) => log('info', ...args),
    warn: (...args: any[]) => log('warn', ...args),
    error: (...args: any[]) => log('error', ...args),
    debug: (...args: any[]) => log('debug', ...args),
};