import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createLoaders, pklLoader, pklLoaderSync } from './index.ts';

const fixture = (name: string) => fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

const expected = {
	name: 'Swallow',
	job: {
		title: 'Sr. Nest Maker',
		company: 'Nests R Us',
		yearsOfExperience: 2,
	},
	migratory: true,
};

describe('createLoaders()', () => {
	it('returns an asynchronous and a synchronous loader', () => {
		const loaders = createLoaders();

		expect(loaders.async).toBeTypeOf('function');
		expect(loaders.sync).toBeTypeOf('function');
	});
});

describe('async loader', () => {
	it('parses a Pkl module into a plain object', async () => {
		const { async: loader } = createLoaders();

		await expect(loader(fixture('valid.pkl'))).resolves.toStrictEqual(expected);
	});

	it('parses an empty Pkl module into an empty object', async () => {
		const { async: loader } = createLoaders();

		await expect(loader(fixture('empty.pkl'))).resolves.toStrictEqual({});
	});

	it('resolves relative imports against the config file', async () => {
		const { async: loader } = createLoaders();

		await expect(loader(fixture('amends.pkl'))).resolves.toStrictEqual({
			greeting: 'hi',
			extra: 1,
		});
	});

	it('resolves relative imports regardless of the working directory', async () => {
		const { async: loader } = createLoaders();
		const cwd = process.cwd();

		process.chdir(fileURLToPath(new URL('../', import.meta.url)));

		try {
			await expect(loader(fixture('amends.pkl'))).resolves.toHaveProperty('greeting', 'hi');
		} finally {
			process.chdir(cwd);
		}
	});

	it('is reusable across multiple files', async () => {
		const { async: loader } = createLoaders();

		const [first, second] = await Promise.all([loader(fixture('valid.pkl')), loader(fixture('empty.pkl'))]);

		expect(first).toHaveProperty('name', 'Swallow');
		expect(second).toStrictEqual({});
	});

	it('returns a fresh object on every call', async () => {
		const { async: loader } = createLoaders();

		const first = await loader(fixture('valid.pkl'));
		const second = await loader(fixture('valid.pkl'));

		expect(first).toStrictEqual(second);
		expect(first).not.toBe(second);
	});

	it('always evaluates as JSON, even if a caller forces another format', async () => {
		// `format` is not part of LoaderOptions, so this can only happen from untyped callers
		const { async: loader } = createLoaders({ format: 'yaml' } as never);

		await expect(loader(fixture('valid.pkl'))).resolves.toHaveProperty('name', 'Swallow');
	});
});

describe('sync loader', () => {
	it('parses a Pkl module into a plain object without a Promise', () => {
		const { sync: loader } = createLoaders();

		const result = loader(fixture('valid.pkl'));

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toStrictEqual(expected);
	});

	it('parses an empty Pkl module into an empty object', () => {
		const { sync: loader } = createLoaders();

		expect(loader(fixture('empty.pkl'))).toStrictEqual({});
	});

	it('resolves relative imports against the config file', () => {
		const { sync: loader } = createLoaders();

		expect(loader(fixture('amends.pkl'))).toStrictEqual({
			greeting: 'hi',
			extra: 1,
		});
	});

	it('resolves relative imports regardless of the working directory', () => {
		const { sync: loader } = createLoaders();
		const cwd = process.cwd();

		process.chdir(fileURLToPath(new URL('../', import.meta.url)));

		try {
			expect(loader(fixture('amends.pkl'))).toHaveProperty('greeting', 'hi');
		} finally {
			process.chdir(cwd);
		}
	});

	it('returns a fresh object on every call', () => {
		const { sync: loader } = createLoaders();

		const first = loader(fixture('valid.pkl'));
		const second = loader(fixture('valid.pkl'));

		expect(first).toStrictEqual(second);
		expect(first).not.toBe(second);
	});

	it('agrees with the async loader', async () => {
		const { async: asyncLoader, sync: syncLoader } = createLoaders();

		expect(syncLoader(fixture('valid.pkl'))).toStrictEqual(await asyncLoader(fixture('valid.pkl')));
	});
});

describe('preconfigured loaders', () => {
	it('exposes an async loader', async () => {
		expect(pklLoader).toBeTypeOf('function');

		await expect(pklLoader(fixture('valid.pkl'))).resolves.toHaveProperty('name', 'Swallow');
	});

	it('exposes a sync loader', () => {
		expect(pklLoaderSync).toBeTypeOf('function');

		expect(pklLoaderSync(fixture('valid.pkl'))).toHaveProperty('name', 'Swallow');
	});
});

describe('error handling', () => {
	it('rejects when the file does not exist', async () => {
		const { async: loader } = createLoaders();

		await expect(loader(fixture('does-not-exist.pkl'))).rejects.toThrow(
			/Failed to evaluate Pkl config at .*does-not-exist\.pkl/,
		);
	});

	it('throws when the file does not exist, synchronously', () => {
		const { sync: loader } = createLoaders();

		expect(() => loader(fixture('does-not-exist.pkl'))).toThrow(
			/Failed to evaluate Pkl config at .*does-not-exist\.pkl/,
		);
	});

	it('reports a missing file as a missing module', async () => {
		const { async: loader } = createLoaders();

		const error = await loader(fixture('does-not-exist.pkl')).catch((error: unknown) => error);

		expect(((error as Error).cause as Error).message).toMatch(/Cannot find module/);
	});

	it('rejects when the Pkl module is invalid', async () => {
		const { async: loader } = createLoaders();

		await expect(loader(fixture('invalid.pkl'))).rejects.toThrow(/Failed to evaluate Pkl config at .*invalid\.pkl/);
	});

	it('throws when the Pkl module is invalid, synchronously', () => {
		const { sync: loader } = createLoaders();

		expect(() => loader(fixture('invalid.pkl'))).toThrow(/Failed to evaluate Pkl config at .*invalid\.pkl/);
	});

	it('preserves the underlying Pkl error as a cause', async () => {
		const { async: loader } = createLoaders();

		const error = await loader(fixture('invalid.pkl')).catch((error: unknown) => error);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).cause).toBeInstanceOf(Error);
		// The exact diagnostic is Pkl's, so only assert that it made it through verbatim
		expect(((error as Error).cause as Error).message).toMatch(/Pkl Error/);
		expect(((error as Error).cause as Error).message).toMatch(/invalid\.pkl/);
	});

	it('preserves the underlying Pkl error as a cause, synchronously', () => {
		const { sync: loader } = createLoaders();

		let error: unknown;

		try {
			loader(fixture('invalid.pkl'));
		} catch (thrown) {
			error = thrown;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).cause).toBeInstanceOf(Error);
		expect(((error as Error).cause as Error).message).toMatch(/Pkl Error/);
		expect(((error as Error).cause as Error).message).toMatch(/invalid\.pkl/);
	});
});
