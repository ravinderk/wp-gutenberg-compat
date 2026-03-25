export interface WpPackageInfo {
    gutenberg: string;
    wordpress: string;
}

export interface CompatData {
    generated: string | null;
    lastGutenbergTag: string | null;
    scrapedVersions: string[];
    wpGutenbergMap: Record<string, string>;
    packages: Record<string, Record<string, WpPackageInfo>>;
}

export type ProjectType = 'plugin' | 'theme';

export interface WpHeaderResult {
    version: string | null;
    projectType: ProjectType | null;
    pluginFile: string | null;
}

export interface CliOptions {
    dir: string;
    unexpectedArgs: string[];
    infoPackages: string[];
    openPackage: string | null;
    remote: string | null;
    wp: string | null;
    dataPath?: string | null;
    showSuggestedCommands?: boolean;
}

export interface MissingMinWpIssue {
    type: 'missing-min-wp';
    projectType: ProjectType | null;
    pluginFile: string | null;
}

export interface IncompatibleIssue {
    type: 'incompatible';
    pkgName: string;
    installedVersion: string;
    requiredWp: string;
    minWp: string;
    recommendedVersion: string | null;
}

export type CompatIssue = MissingMinWpIssue | IncompatibleIssue;

export interface AnalyzeResult {
    exitCode: number;
    issues: CompatIssue[];
    packageSpecs: string[];
}

export interface ProjectContext {
    projectDir: string;
    packageManager: PackageManager | null;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
