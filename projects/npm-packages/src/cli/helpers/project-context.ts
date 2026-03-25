import { findProjectRoot } from '../../utils/discover-wp-packages.js';
import { detectPackageManager } from '../install-exec.js';
import type { ProjectContext } from '../../types/index.js';

export function resolveProjectContext(dir: string): ProjectContext {
    const projectDir = findProjectRoot(dir) ?? dir;
    const packageManager = detectPackageManager(projectDir);
    return { projectDir, packageManager };
}
