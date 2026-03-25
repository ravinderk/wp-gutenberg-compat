export type ReporterEntryType = 'error' | 'success' | 'warn' | 'info' | 'log';

export interface ReporterEntry {
    type: ReporterEntryType;
    msg: string;
}

export class Reporter {
    private _entries: ReporterEntry[] = [];

    error(msg: string): this {
        this._entries.push({ type: 'error', msg });
        return this;
    }

    success(msg: string): this {
        this._entries.push({ type: 'success', msg });
        return this;
    }

    warn(msg: string): this {
        this._entries.push({ type: 'warn', msg });
        return this;
    }

    info(msg: string): this {
        this._entries.push({ type: 'info', msg });
        return this;
    }

    block(...args: string[]): this {
        this._entries.push({ type: 'info', msg: args.join('\n') });
        return this;
    }

    log(msg: string): this {
        this._entries.push({ type: 'log', msg });
        return this;
    }

    print(): this {
        console.log('');
        for (const { type, msg } of this._entries) {
            switch (type) {
                case 'error':
                    console.error(`✘ ${msg}`);
                    break;
                case 'success':
                    console.log(`✔ ${msg}`);
                    break;
                case 'warn':
                    console.error(`⚠ ${msg}`);
                    break;
                case 'info':
                    console.error(msg);
                    break;
                case 'log':
                    console.log(msg);
                    break;
            }
        }
        console.log('');
        return this;
    }
}
