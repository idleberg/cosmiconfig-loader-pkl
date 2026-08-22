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

/**
 * Asynchronous loader, assignable to cosmiconfig's `Loader`.
 *
 * `content` is accepted for signature compatibility and deliberately unused –
 * see {@link createLoaders}. cosmiconfig's own `loadJs` ignores it for the same
 * reason.
 */
export type Loader = (filePath: string, content?: string) => Promise<unknown>;

/** Synchronous loader, assignable to cosmiconfig's `LoaderSync`. */
export type LoaderSync = (filePath: string, content?: string) => unknown;

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

/**
 * Guards against the one mistake the cosmiconfig signature invites: passing the
 * second argument as the first. A path never spans lines, whereas Pkl source
 * almost always does, so this catches `loader(content)` before Pkl reports it as
 * a missing module and echoes the whole config back as a filename.
 */
function assertFilePath(filePath: string): void {
	if (/[\r\n\0]/.test(filePath)) {
		throw new TypeError('Expected a path to a Pkl module, but received what looks like Pkl source.');
	}
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
 *
 * Both loaders take cosmiconfig's `(filePath, content)` signature but ignore
 * `content`: a Pkl module is evaluated by path so that relative `amends`,
 * `import` and `read()` URIs resolve against the config file, which is
 * impossible from source text alone. cosmiconfig reads `content` from that very
 * path, so the two can never disagree.
 * @param options - Options to pass to the Pkl CLI.
 * @returns An object holding an asynchronous and a synchronous loader.
 */
export function createLoaders(options?: LoaderOptions): Loaders {
	return {
		async: async (filePath) => {
			let jsonContent: string;

			assertFilePath(filePath);

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

			assertFilePath(filePath);

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
 * A asynchronous loader that evaluates a Pkl config file and returns the resulting JSON object.
 */
export const pklLoader: Loader = defaultLoaders.async;

/**
 * A synchronous loader that evaluates a Pkl config file and returns the resulting JSON object.
 */
export const pklLoaderSync: LoaderSync = defaultLoaders.sync;
