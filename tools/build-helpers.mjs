/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
// Compila os contratos auxiliares do Laboratório (contracts/*.sol) e gera
// assets/js/lab-helpers.js com fonte, ABI e bytecode. Uso: npm run build
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const solc = require('solc');
const files = { ContratoAtacante: 'contracts/ContratoAtacante.sol', RealDigitalDeTeste: 'contracts/RealDigitalDeTeste.sol' };
const sources = {};
for (const [k, f] of Object.entries(files)) sources[k + '.sol'] = { content: readFileSync(f, 'utf8') };
const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
const errors = (out.errors || []).filter(e => e.severity === 'error');
if (errors.length) { console.error(errors.map(e => e.formattedMessage).join('\n')); process.exit(1); }
const helpers = {};
for (const k of Object.keys(files)) {
    const c = out.contracts[k + '.sol'][k];
    helpers[k] = { source: sources[k + '.sol'].content, abi: c.abi, bytecode: c.evm.bytecode.object };
}
const banner = '/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */\n/* Gerado por tools/build-helpers.mjs a partir de contracts/*.sol. Não editar à mão. */\n';
writeFileSync('assets/js/lab-helpers.js', banner + '(function () { var CSC = (window.CSC = window.CSC || {}); CSC.labHelpers = ' + JSON.stringify(helpers) + '; })();\n');
console.log('lab-helpers.js:', Object.keys(helpers).join(', '));
