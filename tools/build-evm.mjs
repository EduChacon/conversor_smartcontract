/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
// Gera assets/vendor/evm-lab.js a partir de src/evm-lab.mjs.
// Uso: npm install && npm run build
import { build } from 'esbuild';

await build({
    entryPoints: ['src/evm-lab.mjs'],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'EvmLab',
    platform: 'browser',
    target: ['es2020'],
    legalComments: 'linked',
    outfile: 'assets/vendor/evm-lab.js',
    define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
    logLevel: 'info'
});
