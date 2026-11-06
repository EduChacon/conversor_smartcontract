/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Cotação do Ether em reais, dólares e bitcoin, para o conversor de moedas.
 *
 * Fonte principal: CoinGecko (preço agregado de várias corretoras).
 * Reserva automática: Coinbase (taxas de câmbio públicas).
 * Enquanto houver interessados (conversor aberto ou Laboratório visível), a
 * cotação é atualizada a cada 60 segundos. Nada é consultado antes disso.
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});

    const REFRESH_MS = 60000;
    const STALE_MS = 5 * 60000;
    const SOURCES = [
        {
            name: 'CoinGecko',
            url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=brl,usd,btc&include_last_updated_at=true',
            parse: d => ({ brl: d.ethereum.brl, usd: d.ethereum.usd, btc: d.ethereum.btc, updated: d.ethereum.last_updated_at ? d.ethereum.last_updated_at * 1000 : Date.now() })
        },
        {
            name: 'Coinbase',
            url: 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
            parse: d => ({ brl: Number(d.data.rates.BRL), usd: Number(d.data.rates.USD), btc: Number(d.data.rates.BTC), updated: Date.now() })
        }
    ];

    // Preço do "gás" na rede principal (JSON-RPC público, sem chave).
    const GAS_RPCS = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'];

    const state = { current: null, error: null, loading: null, timer: null, subscribers: new Set(), holds: 0, gas: null };

    async function refreshGas() {
        for (const url of GAS_RPCS) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 10000);
                const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
                clearTimeout(timer);
                const d = await r.json();
                const wei = BigInt(d.result);
                if (wei > 0n) { state.gas = { wei, source: new URL(url).hostname, fetched: Date.now() }; notify(); return state.gas; }
            } catch (_) { /* tenta o próximo */ }
        }
        return null;
    }

    async function fetchJson(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const r = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function refresh() {
        if (state.loading) return state.loading;
        state.loading = (async () => {
            let lastError = null;
            for (const src of SOURCES) {
                try {
                    const v = src.parse(await fetchJson(src.url));
                    if (!(v.brl > 0) || !(v.usd > 0)) throw new Error('invalid');
                    state.current = Object.assign(v, { source: src.name, fetched: Date.now() });
                    state.error = null;
                    notify();
                    return state.current;
                } catch (e) {
                    lastError = e;
                }
            }
            state.error = lastError ? String(lastError.message || lastError) : 'error';
            notify();
            return null;
        })();
        try { return await state.loading; } finally { state.loading = null; }
    }

    function notify() { state.subscribers.forEach(fn => { try { fn(state.current, state.error); } catch (_) { /* ignora */ } }); }

    /** Mantém a cotação atualizada enquanto houver ao menos um interessado. */
    function hold() {
        state.holds++;
        if (!state.timer) {
            refresh();
            refreshGas();
            state.timer = setInterval(() => { if (!document.hidden) { refresh(); refreshGas(); } }, REFRESH_MS);
        }
    }
    function release() {
        state.holds = Math.max(0, state.holds - 1);
        if (!state.holds && state.timer) { clearInterval(state.timer); state.timer = null; }
    }

    CSC.rates = {
        refresh, hold, release, refreshGas,
        gasPrice: () => (state.gas ? state.gas.wei : null),
        gasInfo: () => state.gas,
        current: () => state.current,
        error: () => state.error,
        isStale: () => !state.current || Date.now() - state.current.fetched > STALE_MS,
        subscribe(fn) { state.subscribers.add(fn); return () => state.subscribers.delete(fn); }
    };
})();
