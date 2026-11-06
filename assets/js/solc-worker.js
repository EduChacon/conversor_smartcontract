/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * "Web Worker" que carrega o compilador oficial do Solidity (soljson, versão
 * WebAssembly) e compila o código fora da linha principal da página.
 * O compilador (~9 MB) só é baixado quando o usuário pede a compilação.
 */
'use strict';

let compileFn = null;
let versionFn = null;
let loading = null;

// Impressão digital (SHA-256) do compilador oficial publicado no npm (solc@0.8.28). O arquivo
// baixado da CDN só é executado se for idêntico; um arquivo adulterado é recusado.
const PINNED_SHA256 = { '0.8.28': '9ef37cc1d2597ed6d2f706a960f449e33eb9eee920936cea77b11e6f43861970' };

async function importVerified(url, version) {
    const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    const pinned = PINNED_SHA256[version];
    if (!pinned) throw new Error('no pinned hash for ' + version);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(dig)).map(x => x.toString(16).padStart(2, '0')).join('');
    if (hex !== pinned) throw new Error('integrity check failed');
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'application/javascript' }));
    try { importScripts(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
}

function sourcesFor(version) {
    return [
        `https://cdn.jsdelivr.net/npm/solc@${version}/soljson.js`,
        `https://unpkg.com/solc@${version}/soljson.js`
    ];
}

function waitRuntime() {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        (function check() {
            if (self.Module && self.Module.calledRun) return resolve();
            if (Date.now() - started > 60000) return reject(new Error('timeout'));
            setTimeout(check, 50);
        })();
    });
}

function load(version) {
    if (loading) return loading;
    loading = (async () => {
        let lastError = null;
        for (const url of sourcesFor(version)) {
            try {
                self.Module = self.Module || {};
                await importVerified(url, version);
                await waitRuntime();
                versionFn = self.Module.cwrap('solidity_version', 'string', []);
                compileFn = self.Module.cwrap('solidity_compile', 'string', ['string', 'number', 'number']);
                const loaded = versionFn();
                if (!loaded.startsWith(version)) throw new Error('version mismatch: ' + loaded);
                return loaded;
            } catch (e) {
                lastError = e;
                self.Module = undefined;
            }
        }
        loading = null;
        throw lastError || new Error('load failed');
    })();
    return loading;
}

function lineFromOffset(source, offset) {
    if (typeof offset !== 'number' || offset < 0) return null;
    let line = 1;
    for (let i = 0; i < offset && i < source.length; i++) if (source[i] === '\n') line++;
    return line;
}

self.onmessage = async (event) => {
    const { id, type, version, source } = event.data || {};
    try {
        if (type === 'load') {
            const loaded = await load(version);
            self.postMessage({ id, ok: true, version: loaded });
            return;
        }
        if (type === 'compile') {
            const loaded = await load(version);
            const input = {
                language: 'Solidity',
                sources: { 'Contrato.sol': { content: source } },
                settings: {
                    optimizer: { enabled: true, runs: 200 },
                    evmVersion: 'cancun',
                    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } }
                }
            };
            const output = JSON.parse(compileFn(JSON.stringify(input), 0, 0));
            const errors = (output.errors || []).map(e => ({
                severity: e.severity,
                type: e.type,
                message: e.message,
                formatted: e.formattedMessage || e.message,
                line: e.sourceLocation ? lineFromOffset(source, e.sourceLocation.start) : null
            }));
            const contracts = [];
            const file = (output.contracts || {})['Contrato.sol'] || {};
            for (const name of Object.keys(file)) {
                const c = file[name];
                const deployed = (c.evm && c.evm.deployedBytecode && c.evm.deployedBytecode.object) || '';
                contracts.push({
                    name,
                    abi: c.abi || [],
                    bytecode: (c.evm && c.evm.bytecode && c.evm.bytecode.object) || '',
                    deployedSize: deployed.length / 2
                });
            }
            self.postMessage({ id, ok: true, version: loaded, errors, contracts });
        }
    } catch (e) {
        self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
    }
};
