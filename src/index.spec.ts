import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createLoader, pklLoader } from './index.ts';

const fixture = (name: string) => fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

describe('createLoader()', () => {
	it('returns a loader function', async () => {
		const loader = await createLoader();

		expect(loader).toBeTypeOf('function');
	});

	it('parses a Pkl module into a plain object', async () => {
		const loader = await createLoader();

		await expect(loader(fixture('valid.pkl'))).resolves.toStrictEqual({
			name: 'Swallow',
			job: {
				title: 'Sr. Nest Maker',
				company: 'Nests R Us',
				yearsOfExperience: 2,
			},
			migratory: true,
		});
	});

	it('parses an empty Pkl module into an empty object', async () => {
		const loader = await createLoader();

		await expect(loader(fixture('empty.pkl'))).resolves.toStrictEqual({});
	});

	it('is reusable across multiple files', async () => {
		const loader = await createLoader();

		const [first, second] = await Promise.all([loader(fixture('valid.pkl')), loader(fixture('empty.pkl'))]);

		expect(first).toHaveProperty('name', 'Swallow');
		expect(second).toStrictEqual({});
	});

	it('returns a fresh object on every call', async () => {
		const loader = await createLoader();

		const first = await loader(fixture('valid.pkl'));
		const second = await loader(fixture('valid.pkl'));

		expect(first).toStrictEqual(second);
		expect(first).not.toBe(second);
	});

	it('always evaluates as JSON, even if a caller forces another format', async () => {
		// `format` is excluded from LoaderOptions, so this can only happen from untyped callers
		const loader = await createLoader({ format: 'yaml' } as never);

		await expect(loader(fixture('valid.pkl'))).resolves.toHaveProperty('name', 'Swallow');
	});
});

describe('pklLoader', () => {
	it('is a preconfigured loader', async () => {
		expect(pklLoader).toBeTypeOf('function');

		await expect(pklLoader(fixture('valid.pkl'))).resolves.toHaveProperty('name', 'Swallow');
	});
});

describe('error handling', () => {
	it('rejects when the file does not exist', async () => {
		const loader = await createLoader();

		await expect(loader(fixture('does-not-exist.pkl'))).rejects.toThrow(/ENOENT/);
	});

	it('rejects when the Pkl module is invalid', async () => {
		const loader = await createLoader();

		await expect(loader(fixture('invalid.pkl'))).rejects.toThrow(/Failed to evaluate Pkl config at .*invalid\.pkl/);
	});

	it('preserves the underlying Pkl error as a cause', async () => {
		const loader = await createLoader();

		const error = await loader(fixture('invalid.pkl')).catch((error: unknown) => error);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).cause).toBeInstanceOf(Error);
		expect(((error as Error).cause as Error).message).toMatch(/Mismatched input/);
	});
});
