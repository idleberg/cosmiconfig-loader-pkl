# cosmiconfig-loader-pkl

> Loader for Apple's [Pkl](https://pkl-lang.org/) format.

[![License](https://img.shields.io/github/license/idleberg/cosmiconfig-loader-pkl?color=blue&style=for-the-badge)](https://github.com/idleberg/cosmiconfig-loader-pkl/blob/main/LICENSE)
[![Version: npm](https://img.shields.io/npm/v/@idleberg/cosmiconfig-loader-pkl?style=for-the-badge)](https://www.npmjs.org/package/@idleberg/cosmiconfig-loader-pkl)
![GitHub branch check runs](https://img.shields.io/github/check-runs/idleberg/cosmiconfig-loader-pkl/main?style=for-the-badge)

A template with highly opinionated configuration. Works for me, maybe not for you!

## Installation 💿

In GitHub, click on *"Use this template"* to create a new repo from this template. Alternatively, you can use `degitly`.

```shell
npm i cosmiconfig-loader-pkl
```

## Usage 🚀

Pass the loader to cosmiconfig's `loaders` option, keyed by the `.pkl` extension. Since `cosmiconfig` merges your loaders into its defaults but leaves `searchPlaces` alone, you also have to tell it where to look for Pkl files:

```ts
import { cosmiconfig } from 'cosmiconfig';
import { pklLoader } from 'cosmiconfig-loader-pkl';

const moduleName = 'demo';

const explorer = cosmiconfig('myapp', {
	searchPlaces: [ 'myapp.config.pkl' ],
	loaders: {
		'.pkl': pklLoader,
	},
});
```

### Asynchronous only ⏳

Evaluating Pkl shells out to the Pkl toolchain, which can't be done synchronously. This has two consequences:

**1. The sync API is not supported.** `pklLoader` returns a `Promise`, making it a valid `AsyncLoader` but not a valid `SyncLoader`. Use `cosmiconfig()` with `await explorer.search()` or `await explorer.load(filePath)` – never `cosmiconfigSync()`, whose `searchSync()`/`loadSync()` can't await the result.

**2. The module uses top-level `await`.** `pklLoader` is created with top-level await, so it can only be imported from an ES module, or through a dynamic import in CommonJS:

```js
const { pklLoader } = await import('cosmiconfig-loader-pkl');
```

### Custom Pkl options ⚙️

Use `createLoader()` to pass options through to [`@pkl-community/pkl-eval`](https://www.npmjs.com/package/@pkl-community/pkl-eval). It's async as well, so await it before handing the result to cosmiconfig. The `format` option is always forced to `json` and can't be overridden:

```ts
import { cosmiconfig } from 'cosmiconfig';
import { createLoader } from 'cosmiconfig-loader-pkl';

const pklLoader = await createLoader({
	allowedModules: undefined,
	allowedResources: undefined,
	timeout: 0,
	cache: {
		enabled: false,
		directory: './node_modules/.pkl-cache'
	}
});

const explorer = cosmiconfig('myapp', {
	searchPlaces: ['myapp.config.pkl'],
	loaders: {
		'.pkl': pklLoader,
	},
});
```

## License ©️

This work is licensed under [The MIT License](LICENSE).
