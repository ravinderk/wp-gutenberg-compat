'use strict';

class Reporter {
    constructor() {
        this._entries = [];
    }

    error(msg) {
        this._entries.push({ type: 'error', msg });
        return this;
    }

    success(msg) {
        this._entries.push({ type: 'success', msg });
        return this;
    }

    warn(msg) {
        this._entries.push({ type: 'warn', msg });
        return this;
    }

    info(msg) {
        this._entries.push({ type: 'info', msg });
        return this;
    }

    block(msg) {
        this._entries.push({ type: 'block', msg });
        return this;
    }

    line(msg) {
        this._entries.push({ type: 'line', msg });
        return this;
    }

    log(msg) {
        this._entries.push({ type: 'log', msg });
        return this;
    }

    print() {
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
                case 'block':
                    console.error(`\n${msg}\n`);
                    break;
                case 'line':
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

module.exports = { Reporter };
