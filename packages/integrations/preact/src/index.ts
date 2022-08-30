import { AstroIntegration, AstroRenderer, ViteUserConfig } from 'astro';

function getRenderer(appEntrypoint?: string): AstroRenderer {
	return {
		name: '@astrojs/preact',
		clientEntrypoint: '@astrojs/preact/client.js',
		serverEntrypoint: '@astrojs/preact/server.js',
		appEntrypoint,
		jsxImportSource: 'preact',
		jsxTransformOptions: async () => {
			const {
				default: { default: jsx },
				// @ts-expect-error types not found
			} = await import('@babel/plugin-transform-react-jsx');
			return {
				plugins: [jsx({}, { runtime: 'automatic', importSource: 'preact' })],
			};
		},
	};
}

function getCompatRenderer(): AstroRenderer {
	return {
		name: '@astrojs/preact',
		clientEntrypoint: '@astrojs/preact/client.js',
		serverEntrypoint: '@astrojs/preact/server.js',
		jsxImportSource: 'react',
		jsxTransformOptions: async () => {
			const {
				default: { default: jsx },
				// @ts-expect-error types not found
			} = await import('@babel/plugin-transform-react-jsx');
			return {
				plugins: [
					jsx({}, { runtime: 'automatic', importSource: 'preact/compat' }),
					[
						'babel-plugin-module-resolver',
						{
							alias: {
								react: 'preact/compat',
								'react-dom/test-utils': 'preact/test-utils',
								'react-dom': 'preact/compat',
								'react/jsx-runtime': 'preact/jsx-runtime',
							},
						},
					],
				],
			};
		},
	};
}

function getViteConfiguration(compat?: boolean): ViteUserConfig {
	const viteConfig: ViteUserConfig = {
		optimizeDeps: {
			include: [
				'@astrojs/preact/client.js',
				'preact',
				'preact/jsx-runtime',
				'preact-render-to-string',
			],
			exclude: ['@astrojs/preact/server.js'],
		},
		ssr: {
			external: ['preact-render-to-string'],
		},
	};

	if (compat) {
		viteConfig.optimizeDeps!.include!.push(
			'preact/compat',
			'preact/test-utils',
			'preact/compat/jsx-runtime'
		);
		viteConfig.resolve = {
			alias: [
				{ find: 'react', replacement: 'preact/compat' },
				{ find: 'react-dom/test-utils', replacement: 'preact/test-utils' },
				{ find: 'react-dom', replacement: 'preact/compat' },
				{ find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
			],
			dedupe: ['preact/compat', 'preact'],
		};
		// noExternal React entrypoints to be bundled, resolved, and aliased by Vite
		viteConfig.ssr!.noExternal = [
			'react',
			'react-dom',
			'react-dom/test-utils',
			'react/jsx-runtime',
		];
	}

	return viteConfig;
}

export default function ({ compat, appEntrypoint }: { compat?: boolean, appEntrypoint?: string } = {}): AstroIntegration {
	return {
		name: '@astrojs/preact',
		hooks: {
			'astro:config:setup': ({ addRenderer, updateConfig, injectScript }) => {
				if (compat) addRenderer(getCompatRenderer());
				injectScript('before-hydration', `import { h, Fragment, render } from "preact";
import { useState } from "preact/hooks";
import Provider from "virtual:@astrojs/preact/app";

let addChild = () => {};
const App = ({ children: c }) => {
	const [children, setChildren] = useState([c]);
	addChild = (child) => setChildren(v => ([...v, child]));
	return h(Fragment, {}, children)
}

const el = document.createElement('astro-app');
el.setAttribute('renderer', '@astrojs/preact');
document.body.appendChild(el);

render(h(Provider, {}, h(App, {})), el)
globalThis['@astrojs/preact'] = {
	addChild
}`)
				addRenderer(getRenderer(appEntrypoint));
				updateConfig({
					vite: getViteConfiguration(compat),
				});
			},
		},
	};
}
