import { readFile } from 'node:fs/promises';
import { evaluate } from '@pkl-community/pkl-eval';
import type { Options as PklOptions } from '@pkl-community/pkl-eval/lib/index.d.ts';

type LoaderOptions = Omit<PklOptions, 'expression' | 'format'>;

/**
 * Creates a custom loader function that reads a Pkl config file, evaluates it, and returns the resulting JSON object.
 * @param options - Options to pass to the Pkl evaluation function.
 * @returns A function that loads and parses a Pkl config file as JSON.
 */
export async function createLoader(options?: LoaderOptions) {
	return async (filePath: string) => {
		const content = await readFile(filePath, 'utf-8');

		let jsonContent: string;
		try {
			jsonContent = await evaluate(content, {
				...options,
				format: 'json',
			} satisfies PklOptions);
		} catch (error) {
			throw new Error(`Failed to evaluate Pkl config at ${filePath}`, {
				cause: error,
			});
		}

		try {
			return JSON.parse(jsonContent);
		} catch (error) {
			throw new Error(`Pkl evaluation of ${filePath} did not produce valid JSON`, { cause: error });
		}
	};
}

/**
 * A preconfigured loader function that reads a Pkl config file, evaluates it, and returns the resulting JSON object.
 */
export const pklLoader = await createLoader();
