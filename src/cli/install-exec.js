'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { Reporter } = require('./reporter.js');

function detectPackageManager(projectDir) {
    const lockfilesByManager = {
        bun: ['bun.lockb', 'bun.lock'],
        pnpm: ['pnpm-lock.yaml'],
        yarn: ['yarn.lock'],
        npm: ['package-lock.json', 'npm-shrinkwrap.json'],
    };

    const detectedManagers = [];
    for (const [manager, lockfiles] of Object.entries(lockfilesByManager)) {
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

function buildInstallArgs(packageManager, packageSpecs, options = {}) {
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

function buildInstallCommand(packageManager, packageSpecs, options = {}) {
    const args = buildInstallArgs(packageManager, packageSpecs, options);
    if (!args) return null;
    return [packageManager, ...args].join(' ');
}

function runInstall(projectDir, packageManager, packageSpecs) {
    const args = buildInstallArgs(packageManager, packageSpecs);
    if (!args) {
        const reporter = new Reporter();
        reporter.error(`Unsupported package manager: ${packageManager}`);
        reporter.print();
        return false;
    }

    const reporter = new Reporter();
    reporter.info(`Installing recommended packages with: ${packageManager} ${args.join(' ')}`);
    reporter.print();

    const result = spawnSync(packageManager, args, {
        cwd: projectDir,
        stdio: 'inherit',
    });

    return result.status === 0;
}

module.exports = {
    buildInstallArgs,
    buildInstallCommand,
    detectPackageManager,
    runInstall,
};
