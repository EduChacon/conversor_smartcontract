/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Cotação do Ether em reais e dólares, para o conversor de moedas.
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
            url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=brl,usd&include_last_updated_at=true',
            parse: d => ({ brl: d.ethereum.brl, usd: d.ethereum.usd, updated: d.ethereum.last_updated_at ? d.ethereum.last_updated_at * 1000 : Date.now() })
        },
        {
            name: 'Coinbase',
            url: 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
            parse: d => ({ brl: Number(d.data.rates.BRL), usd: Number(d.data.rates.USD), updated: Date.now() })
        }
    ];

    const state = { current: null, error: null, loading: null, timer: null, subscribers: new Set(), holds: 0 };

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
            state.timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
        }
    }
    function release() {
        state.holds = Math.max(0, state.holds - 1);
        if (!state.holds && state.timer) { clearInterval(state.timer); state.timer = null; }
    }

    CSC.rates = {
        refresh, hold, release,
        current: () => state.current,
        error: () => state.error,
        isStale: () => !state.current || Date.now() - state.current.fetched > STALE_MS,
        subscribe(fn) { state.subscribers.add(fn); return () => state.subscribers.delete(fn); }
    };
})();
