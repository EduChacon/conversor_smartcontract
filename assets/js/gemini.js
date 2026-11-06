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

    async function errorFromResponse(response) {
        let detail = '';
        try {
            const data = await response.json();
            detail = (data && data.error && data.error.message) || '';
        } catch (_) { /* corpo não JSON */ }
        const s = response.status;
        const code = s === 400 && /api key/i.test(detail) ? 'invalid-key'
            : (s === 401 || s === 403) ? 'invalid-key'
            : s === 404 ? 'model-not-found'
            : s === 429 ? 'quota'
            : s >= 500 ? 'server' : 'http';
        return new GeminiError(code, detail || response.statusText || String(s), s);
    }

    /**
     * Gera conteúdo. Repete automaticamente (até 2 vezes) em caso de limite
     * de requisições ou indisponibilidade temporária.
     */
    async function generate({ apiKey, model, system, user, kind, schema, temperature }) {
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
        let attempt = 0;
        for (;;) {
            const response = await request(url, apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }, CSC.config.REQUEST_TIMEOUT_MS);

            if (!response.ok) {
                const err = await errorFromResponse(response);
                if ((err.code === 'quota' || err.code === 'server') && attempt < 2) {
                    const retryAfter = Number(response.headers.get('retry-after'));
                    await sleep(retryAfter > 0 ? retryAfter * 1000 : 2000 * Math.pow(2, attempt));
                    attempt++;
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

    /** Extrai o código Solidity da resposta (bloco ```solidity``` ou texto puro). */
    function extractSolidity(text) {
        const fenced = /```(?:solidity|sol)?[ \t]*\n([\s\S]*?)```/i.exec(text);
        let code = fenced ? fenced[1] : text.replace(/^```\w*\s*|```\s*$/g, '');
        code = code.trim();
        if (!/\bpragma\s+solidity\b/.test(code) || !/\b(contract|library)\s+\w+/.test(code)) return null;
        return code + '\n';
    }

    CSC.gemini = { generate, listModels, extractSolidity, GeminiError };
})();
