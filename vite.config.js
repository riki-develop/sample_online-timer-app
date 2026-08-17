import { defineConfig } from 'vite';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import { fileURLToPath } from 'node:url';
import { extname, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import sassGlobImports from 'vite-plugin-sass-glob-import';

const pagesDir = resolve(__dirname, 'src');
const distDir = resolve(__dirname, 'dist');
const isDev = process.env.NODE_ENV !== 'production';

const createHotReloadPlugin = (name, matchFn) => {
  return {
    name: name,
    handleHotUpdate({ file, server }) {
      if (matchFn(file)) {
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
      }
    },
  };
};

const allFilesHotReloadPlugin = createHotReloadPlugin(
  'all-files-hot-reload',
  (file) =>
    file.startsWith(resolve(__dirname, 'src')) ||
    file.startsWith(resolve(__dirname, 'public'))
);

const htmlFiles = Object.fromEntries(
  globSync(`${pagesDir}/**/*.html`, {
    ignore: ['node_modules/**', '**/dist/**'],
  }).map((file) => [
    relative(pagesDir, file.slice(0, file.length - extname(file).length)),
    fileURLToPath(new URL(file, import.meta.url)),
  ])
);

// ********************************
//  構成・ルール設定 */
// ********************************
export default defineConfig({
  root: 'src',
  base: '/',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  build: {
    outDir: distDir,
    emptyOutDir: true,
    sourcemap: false,
    copyPublicDir: false, // 自動コピー停止
    rollupOptions: {
      input: { ...htmlFiles },
      output: {
        entryFileNames: 'assets/js/app.js',
        chunkFileNames: 'assets/js/[name].js',
        assetFileNames: (assetInfo) => {
          if (/\.css$/.test(assetInfo.name)) {
            return 'assets/css/style[extname]';
          }
          if (/\.(jpe?g|png|gif|svg|webp)$/.test(assetInfo.name)) {
            return 'assets/image/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
  css: {
    devSourcemap: true,
  },
  plugins: [
    ViteEjsPlugin((viteConfig) => {
      return {
        RESOLVE: (filePath) => {
          const aliases = viteConfig.resolve.alias;
          for (const alias of aliases) {
            if (filePath.startsWith(`${alias.find}/`)) {
              return filePath.replace(alias.find, alias.replacement);
            }
          }
          return filePath;
        },
        IS_DEV: isDev,
      };
    }),
    allFilesHotReloadPlugin,
    sassGlobImports(),
  ],
  define: {
    __IS_DEV__: JSON.stringify(isDev),
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      include: ['src/**/*', 'public/**/*'],
    },
  },
});
