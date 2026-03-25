import { Reporter } from './services/reporter.js';

interface App {
    bind<T>(name: string, factory: () => T): this;
    singleton<T>(name: string, factory: () => T): this;
    make(name: 'Reporter'): Reporter;
    make<T>(name: string): T;
}

/**
 * Creates a lightweight app container.
 *
 * - app.bind(name, factory)      — registers a transient: factory is called fresh on every make()
 * - app.singleton(name, factory) — registers a singleton: factory is called once, result is reused
 * - app.make(name)               — resolves and returns the binding
 */
function createApp(): App {
    const _registry = new Map<string, () => unknown>();
    const _singletonCache = new Map<string, unknown>();

    const app: App = {
        bind<T>(name: string, factory: () => T): typeof app {
            _registry.set(name, factory);
            return app;
        },

        singleton<T>(name: string, factory: () => T): typeof app {
            _registry.set(name, () => {
                if (!_singletonCache.has(name)) {
                    _singletonCache.set(name, factory());
                }
                return _singletonCache.get(name);
            });
            return app;
        },

        make<T>(name: string): T {
            const factory = _registry.get(name);
            if (!factory) {
                throw new Error(`[app] No binding registered for "${name}"`);
            }
            return factory() as T;
        },
    };

    return app;
}

// Pre-configured app instance shared across the codebase.
export const app = createApp();
app.bind('Reporter', () => new Reporter());
