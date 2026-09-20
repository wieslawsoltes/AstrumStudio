import { ProjectClient } from './index.js';
export class LocalProjectClient extends ProjectClient {
    constructor(databaseName?: string, factory?: IDBFactory);
    readonly mode: 'local';
    databaseName: string;
    openDatabase(): Promise<IDBDatabase>;
}
export function localOperation(record: any, path: string, method: string, body?: any): {
    write?: any; remove?: string; value: any;
};
