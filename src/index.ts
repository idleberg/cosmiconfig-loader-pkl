import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { getExePath } from '@pkl-community/pkl';

const execFileAsync = promisify(execFile);

/**
 * Maximum size of the JSON rendered by Pkl, in bytes.
 */
const MAX_OUTPUT_SIZE = 32 * 1024 * 1024;

export type LoaderOptions = {
	/** URI patterns that determine which modules can be loaded and evaluated. */
	allowedModules?: string[];
	/** URI patterns that determine which external resources can be read. */
	allowedResources?: string[];
	/** Duration, in seconds, after which evaluation is timed out. */
	timeout?: number;
	/** Package cache, disabled by default. */
	cache?: { enabled: false } | { enabled: true; directory?: string };
};

/** Asynchronous loader, assignable to cosmiconfig's `Loader`. */
export type Loader = (filePath: string) => Promise<unknown>;

/** Synchronous loader, assignable to cosmiconfig's `LoaderSync`. */
export type LoaderSync = (filePath: string) => unknown;

export type Loaders = {
	async: Loader;
	sync: LoaderSync;
};

function buildArgs(filePath: string, options: LoaderOptions | undefined): string[] {
	const args = ['eval', filePath, '--no-project', '--format', 'json'];

	if (options?.allowedModules) {
		args.push('--allowed-modules', options.allowedModules.join(','));
	}

	if (options?.allowedResources) {
		args.push('--allowed-resources', options.allowedResources.join(','));
	}

	if (options?.timeout && options.timeout > 0) {
		args.push('--timeout', options.timeout.toString());
	}

	if (options?.cache?.enabled === false) {
		args.push('--no-cache');
	} else if (options?.cache?.enabled && options.cache.directory) {
		args.push('--cache-dir', options.cache.directory);
	}

	return args;
}

function buildExecOptions(options: LoaderOptions | undefined) {
	return {
		maxBuffer: MAX_OUTPUT_SIZE,
		timeout: options?.timeout ? options.timeout * 1000 + 100 : 0,
	};
}

function evaluationError(filePath: string, cause: unknown): Error {
	return new Error(`Failed to evaluate Pkl config at ${filePath}`, { cause });
}

function parseOutput(filePath: string, jsonContent: string): unknown {
	try {
		return JSON.parse(jsonContent);
	} catch (error) {
		throw new Error(`Pkl evaluation of ${filePath} did not produce valid JSON`, { cause: error });
	}
}

/**
 * Creates a pair of custom loader functions that evaluate a Pkl config file and return the resulting JSON object.
 * @param options - Options to pass to the Pkl CLI.
 * @returns An object holding an asynchronous and a synchronous loader.
 */
export function createLoaders(options?: LoaderOptions): Loaders {
	// The module is handed to Pkl by path, never by content, so that relative
	// `amends`, `import` and `read()` URIs resolve against the config file.
	return {
		async: async (filePath) => {
			let jsonContent: string;

			try {
				const { stdout } = await execFileAsync(getExePath(), buildArgs(filePath, options), buildExecOptions(options));

				jsonContent = stdout;
			} catch (error) {
				throw evaluationError(filePath, error);
			}

			return parseOutput(filePath, jsonContent);
		},

		sync: (filePath) => {
			let jsonContent: string;

			try {
				jsonContent = execFileSync(getExePath(), buildArgs(filePath, options), {
					...buildExecOptions(options),
					encoding: 'utf-8',
					// Pkl reports diagnostics on stderr, which is inherited unless piped
					// explicitly – without this, they'd print to the console and be lost
					// to the thrown error.
					stdio: ['ignore', 'pipe', 'pipe'],
				});
			} catch (error) {
				throw evaluationError(filePath, error);
			}

			return parseOutput(filePath, jsonContent);
		},
	};
}

const defaultLoaders = createLoaders();

/**
 * A preconfigured asynchronous loader that evaluates a Pkl config file and returns the resulting JSON object.
 */
export const pklLoader: Loader = defaultLoaders.async;

/**
 * A preconfigured synchronous loader that evaluates a Pkl config file and returns the resulting JSON object.
 */
export const pklLoaderSync: LoaderSync = defaultLoaders.sync;
