/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Cliente da API Gemini (Google AI Studio).
 *
 * A chave segue no cabeçalho "x-goog-api-key", e não na URL: endereços com
 * "?key=" ficam registrados em histórico, "proxies" e ferramentas de rede.
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});
    const BASE = 'https://generativelanguage.googleapis.com/v1beta';

    class GeminiError extends Error {
        constructor(code, message, status) {
            super(message);
            this.code = code;
            this.status = status;
        }
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function request(url, apiKey, init, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, Object.assign({}, init, {
                signal: controller.signal,
                headers: Object.assign({ 'x-goog-api-key': apiKey }, init.headers || {}),
                cache: 'no-store',
                credentials: 'omit'
            }));
        } catch (e) {
            if (e.name === 'AbortError') throw new GeminiError('timeout', 'timeout');
            throw new GeminiError('network', e.message);
        } finally {
            clearTimeout(timer);
        }
    }

    const stats = { requests: 0, listeners: [] };
    function countRequest() {
        stats.requests++;
        stats.listeners.forEach(fn => { try { fn(stats.requests); } catch (_) { /* ignora */ } });
    }

    /** Converte "37s" ou "1.5s" em segundos. */
    function parseDelay(value) {
        const m = /^(\d+(?:\.\d+)?)s$/.exec(String(value || ''));
        return m ? Math.ceil(Number(m[1])) : null;
    }

    async function errorFromResponse(response) {
        let detail = '';
        let retryDelay = null;
        let daily = false;
        try {
            const data = await response.json();
            const error = (data && data.error) || {};
            detail = error.message || '';
            for (const d of error.details || []) {
                if (/RetryInfo$/.test(d['@type'] || '')) retryDelay = parseDelay(d.retryDelay);
                if (/QuotaFailure$/.test(d['@type'] || '')) {
                    daily = (d.violations || []).some(v => /PerDay/i.test(v.quotaId || '') || /per.?day/i.test(v.quotaMetric || ''));
                }
            }
        } catch (_) { /* corpo não JSON */ }
        const header = Number(response.headers.get('retry-after'));
        if (!retryDelay && header > 0) retryDelay = header;
        const s = response.status;
        const code = s === 400 && /api key/i.test(detail) ? 'invalid-key'
            : (s === 401 || s === 403) ? 'invalid-key'
            : s === 404 ? 'model-not-found'
            : s === 429 ? (daily ? 'quota-daily' : 'quota')
            : s >= 500 ? 'server' : 'http';
        const err = new GeminiError(code, detail || response.statusText || String(s), s);
        err.retryDelay = retryDelay;
        return err;
    }

    async function waitWithCountdown(seconds, onWait) {
        for (let left = seconds; left > 0; left--) {
            if (onWait) onWait(left);
            await sleep(1000);
        }
        if (onWait) onWait(0);
    }

    /**
     * Gera conteúdo. Em caso de limite de requisições do plano gratuito,
     * aguarda o tempo indicado pelo Google (com contagem regressiva) e repete
     * até 3 vezes; em indisponibilidade temporária, repete até 2 vezes.
     */
    async function generate({ apiKey, model, system, user, kind, schema, temperature, onWait }) {
        const url = `${BASE}/models/${encodeURIComponent(model)}:generateContent`;
        const body = {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: typeof temperature === 'number' ? temperature : (kind === 'text' ? 0.4 : 0.2) }
        };
        if (kind === 'json') {
            body.generationConfig.responseMimeType = 'application/json';
            if (schema) body.generationConfig.responseSchema = schema;
        }
        let quotaAttempts = 0;
        let serverAttempts = 0;
        for (;;) {
            countRequest();
            const response = await request(url, apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }, CSC.config.REQUEST_TIMEOUT_MS);

            if (!response.ok) {
                const err = await errorFromResponse(response);
                if (err.code === 'quota' && quotaAttempts < 3) {
                    const wait = Math.min(Math.max(err.retryDelay || 10 * Math.pow(2, quotaAttempts), 2), 70);
                    quotaAttempts++;
                    await waitWithCountdown(wait, onWait);
                    continue;
                }
                if (err.code === 'server' && serverAttempts < 2) {
                    serverAttempts++;
                    await sleep(2000 * serverAttempts);
                    continue;
                }
                throw err;
            }

            let data;
            try {
                data = await response.json();
            } catch (_) {
                throw new GeminiError('bad-response', 'invalid JSON');
            }
            if (data.promptFeedback && data.promptFeedback.blockReason) {
                throw new GeminiError('blocked', data.promptFeedback.blockReason);
            }
            const candidate = data.candidates && data.candidates[0];
            const parts = (candidate && candidate.content && candidate.content.parts) || [];
            const text = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
            if (!text.trim()) {
                const reason = candidate && candidate.finishReason;
                throw new GeminiError(reason === 'SAFETY' ? 'blocked' : 'empty', reason || 'empty');
            }
            return { text, truncated: candidate.finishReason === 'MAX_TOKENS' };
        }
    }

    /** Lista os modelos disponíveis para a chave que geram conteúdo. */
    async function listModels(apiKey) {
        const response = await request(`${BASE}/models?pageSize=200`, apiKey, { method: 'GET' }, 20000);
        if (!response.ok) throw await errorFromResponse(response);
        const data = await response.json();
        return (data.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''))
            .filter(n => /^gemini/.test(n) && !/(tts|image|embedding|audio|live|vision)/i.test(n));
    }

    const looksLikeContract = c => /\bpragma\s+solidity\b/.test(c) && /\b(contract|library)\s+\w+/.test(c);

    /**
     * Extrai o código Solidity da resposta. Tolera respostas imperfeitas de
     * modelos leves: vários blocos, bloco sem rótulo ou código sem cercas.
     */
    function extractSolidity(text) {
        const blocks = [];
        const re = /```[ \t]*([\w-]*)[ \t]*\n([\s\S]*?)```/g;
        let m;
        while ((m = re.exec(text)) !== null) blocks.push(m[2].trim());
        let code = blocks.filter(looksLikeContract).sort((a, b) => b.length - a.length)[0];
        if (!code) {
            // Sem cercas: do cabeçalho (SPDX ou pragma) até a última chave.
            const plain = text.replace(/```[\w-]*/g, '');
            const start = plain.search(/\/\/\s*SPDX-License-Identifier|\bpragma\s+solidity/);
            const end = plain.lastIndexOf('}');
            if (start !== -1 && end > start) {
                // Preserva comentário final de aviso, se houver.
                const tail = plain.slice(end + 1).split('\n').filter(l => /^\s*\/\//.test(l)).join('\n');
                code = (plain.slice(start, end + 1) + (tail ? '\n' + tail : '')).trim();
            }
        }
        if (!code || !looksLikeContract(code)) return null;
        return code + '\n';
    }

    /** Lê JSON tolerando cercas Markdown e texto ao redor. */
    function parseJsonLoose(text) {
        try { return JSON.parse(text); } catch (_) { /* tenta extrair */ }
        const cleaned = String(text).replace(/```(?:json)?/gi, '');
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end <= start) throw new Error('no JSON');
        return JSON.parse(cleaned.slice(start, end + 1));
    }

    CSC.gemini = { generate, listModels, extractSolidity, parseJsonLoose, GeminiError, stats };
})();
