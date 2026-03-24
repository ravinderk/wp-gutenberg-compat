'use strict';

const { Reporter } = require('./services/reporter.js');

/**
 * Creates a lightweight app container.
 *
 * - app.bind(name, factory)      — registers a transient: factory is called fresh on every make()
 * - app.singleton(name, factory) — registers a singleton: factory is called once, result is reused
 * - app.make(name)               — resolves and returns the binding
 */
function createApp() {
    const _registry = new Map();
    const _singletonCache = new Map();

    const app = {
        bind(name, factory) {
            _registry.set(name, factory);
            return app;
        },

        singleton(name, factory) {
            _registry.set(name, () => {
                if (!_singletonCache.has(name)) {
                    _singletonCache.set(name, factory());
                }
                return _singletonCache.get(name);
            });
            return app;
        },

        make(name) {
            const factory = _registry.get(name);
            if (!factory) {
                throw new Error(`[app] No binding registered for "${name}"`);
            }
            return factory();
        },
    };

    return app;
}

// Pre-configured app instance shared across the codebase.
const app = createApp();
app.bind('Reporter', () => new Reporter());

module.exports = { app };
