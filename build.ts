/* eslint-disable no-console */

import type { BunPlugin } from 'bun';

const replace_websocket = await Bun.file('./src/websocket.browser.ts').text();

const PLUGIN_REPLACE: BunPlugin = {
	name: 'extws',
	setup(build) {
		build.onLoad(
			{
				filter: /\/websocket\.ts$/,
			},
			() => {
				return {
					contents: replace_websocket,
					loader: 'ts',
				};
			},
		);
	},
};

for (const MINIFY of [ true, false ]) {
	// eslint-disable-next-line no-await-in-loop
	const result = await Bun.build({
		entrypoints: [
			'./src/main.js',
		],
		minify: MINIFY,
		plugins: [ PLUGIN_REPLACE ],
	});

	if (result.success === true) {
		console.log('Build succeeded.');

		Bun.write(
			`./dist/browser/main${MINIFY ? '.min' : ''}.js`,
			result.outputs[0],
		);
	}
	else {
		console.error(result);
	}
}

// eslint-disable-next-line no-restricted-exports
export default null;
