# cosmiconfig-loader-pkl

> Loader for Apple's [Pkl](https://pkl-lang.org/) format.

[![License](https://img.shields.io/github/license/idleberg/cosmiconfig-loader-pkl?color=blue&style=for-the-badge)](https://github.com/idleberg/cosmiconfig-loader-pkl/blob/main/LICENSE)
[![Version: npm](https://img.shields.io/npm/v/cosmiconfig-loader-pkl?style=for-the-badge)](https://www.npmjs.org/package/cosmiconfig-loader-pkl)
![GitHub branch check runs](https://img.shields.io/github/check-runs/idleberg/cosmiconfig-loader-pkl/main?style=for-the-badge)

## Installation 💿

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

### Synchronous usage

`pklLoaderSync` is a valid `LoaderSync`, for use with `cosmiconfigSync()`:

```ts
import { cosmiconfigSync } from 'cosmiconfig';
import { pklLoaderSync } from 'cosmiconfig-loader-pkl';

const explorer = cosmiconfigSync('myapp', {
	searchPlaces: ['myapp.config.pkl'],
	loaders: {
		'.pkl': pklLoaderSync,
	},
});
```

Both loaders shell out to the Pkl toolchain, so the sync one blocks the event loop for the duration of the evaluation. Prefer `pklLoader` unless you're in a context that can't await – a CLI's startup path, for instance.

### Relative imports

The config file is handed to Pkl by path, so relative `amends`, `import` and `read()` URIs resolve against the config file itself, independently of the current working directory:

```pkl
amends "shared/base.pkl"

port = 8080
```

### Custom Pkl options

Use `createLoaders()` to pass options through to the Pkl CLI. It returns both loaders as `{ async, sync }`. The output format is always `json` and can't be overridden:

```ts
import { cosmiconfig } from 'cosmiconfig';
import { createLoaders } from 'cosmiconfig-loader-pkl';

const { async: pklLoader } = createLoaders({
	// default config
	allowedModules: undefined,
	allowedResources: undefined,
	timeout: 0,
	cache: {
		enabled: false,
		directory: undefined
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
