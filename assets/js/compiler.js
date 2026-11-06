/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/* Interface da página com o "worker" do compilador Solidity. */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});

    let worker = null;
    let seq = 0;
    const pending = new Map();
    let loadedVersion = null;

    function getWorker() {
        if (worker) return worker;
        worker = new Worker('assets/js/solc-worker.js');
        worker.onmessage = (event) => {
            const msg = event.data || {};
            const entry = pending.get(msg.id);
            if (!entry) return;
            pending.delete(msg.id);
            clearTimeout(entry.timer);
            if (msg.ok) {
                if (msg.version) loadedVersion = msg.version;
                entry.resolve(msg);
            } else {
                entry.reject(new Error(msg.error));
            }
        };
        worker.onerror = (e) => {
            for (const [, entry] of pending) {
                clearTimeout(entry.timer);
                entry.reject(new Error(e.message || 'worker error'));
            }
            pending.clear();
            worker.terminate();
            worker = null;
        };
        return worker;
    }

    function request(payload, timeoutMs) {
        return new Promise((resolve, reject) => {
            const id = ++seq;
            const timer = setTimeout(() => {
                pending.delete(id);
                // Reinicia o worker para não deixar compilação travada.
                if (worker) { worker.terminate(); worker = null; }
                reject(new Error('timeout'));
            }, timeoutMs);
            pending.set(id, { resolve, reject, timer });
            getWorker().postMessage(Object.assign({ id, version: CSC.config.SOLC_VERSION }, payload));
        });
    }

    CSC.compiler = {
        isLoaded: () => !!loadedVersion,
        version: () => loadedVersion,
        compile: (source) => request({ type: 'compile', source }, 180000)
    };
})();
