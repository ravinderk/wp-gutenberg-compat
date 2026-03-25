import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { app } from '../app.js';
import type { PackageManager } from '../types/index.js';

export function detectPackageManager(projectDir: string): PackageManager | null {
    const lockfilesByManager: Record<PackageManager, string[]> = {
        bun: ['bun.lockb', 'bun.lock'],
        pnpm: ['pnpm-lock.yaml'],
        yarn: ['yarn.lock'],
        npm: ['package-lock.json', 'npm-shrinkwrap.json'],
    };

    const detectedManagers: PackageManager[] = [];
    for (const [manager, lockfiles] of Object.entries(lockfilesByManager) as [PackageManager, string[]][]) {
        const found = lockfiles.some((file) => fs.existsSync(path.join(projectDir, file)));
        if (found) {
            detectedManagers.push(manager);
        }
    }

    if (detectedManagers.length === 1) {
        return detectedManagers[0];
    }

    return null;
}

interface BuildInstallArgsOptions {
    dev?: boolean;
}

export function buildInstallArgs(
    packageManager: PackageManager,
    packageSpecs: string[],
    options: BuildInstallArgsOptions = {},
): string[] | null {
    const { dev = false } = options;

    if (packageManager === 'npm') {
        return ['install', ...(dev ? ['--save-dev'] : []), ...packageSpecs];
    }

    if (packageManager === 'yarn') {
        return ['add', ...(dev ? ['--dev'] : []), ...packageSpecs];
    }

    if (packageManager === 'pnpm') {
        return ['add', ...(dev ? ['--save-dev'] : []), ...packageSpecs];
    }

    if (packageManager === 'bun') {
        return ['add', ...(dev ? ['--dev'] : []), ...packageSpecs];
    }

    return null;
}

export function buildInstallCommand(
    packageManager: PackageManager,
    packageSpecs: string[],
    options: BuildInstallArgsOptions = {},
): string | null {
    const args = buildInstallArgs(packageManager, packageSpecs, options);
    if (!args) return null;
    return [packageManager, ...args].join(' ');
}

export function runInstall(projectDir: string, packageManager: PackageManager, packageSpecs: string[]): boolean {
    const args = buildInstallArgs(packageManager, packageSpecs);
    if (!args) {
        const reporter = app.make('Reporter');
        reporter.error(`Unsupported package manager: ${packageManager}`);
        reporter.print();
        return false;
    }

    const reporter = app.make('Reporter');
    reporter.info(`Installing recommended packages with: ${packageManager} ${args.join(' ')}`);
    reporter.print();

    const result = spawnSync(packageManager, args, {
        cwd: projectDir,
        stdio: 'inherit',
    });

    return result.status === 0;
}
