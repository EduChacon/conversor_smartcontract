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

/*
 * Outros provedores de IA (opcionais): Anthropic (Claude), OpenAI e DeepSeek.
 * Mesma interface do Gemini: generate({ provider, apiKey, model, system, user, kind, schema, temperature, onWait })
 * devolve { text, truncated }; listModels(provider, apiKey) devolve os identificadores de modelo.
 * As chamadas saem direto do navegador para o provedor, com a chave da própria pessoa.
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});
    const G = CSC.gemini;
    const Err = G.GeminiError;

    const PROVIDERS = {
        gemini: {
            label: 'Google Gemini', keyName: 'geminiApiKey', defaultModel: 'gemini-flash-lite-latest',
            models: ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
            keyUrl: 'https://aistudio.google.com/app/apikey', free: true
        },
        anthropic: {
            label: 'Anthropic Claude', keyName: 'anthropicApiKey', defaultModel: 'claude-opus-5-5',
            models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
            keyUrl: 'https://console.anthropic.com/settings/keys'
        },
        openai: {
            label: 'OpenAI (ChatGPT)', keyName: 'openaiApiKey', defaultModel: 'gpt-4o-mini',
            models: ['gpt-4o-mini', 'gpt-4o'],
            keyUrl: 'https://platform.openai.com/api-keys'
        },
        deepseek: {
            label: 'DeepSeek', keyName: 'deepseekApiKey', defaultModel: 'deepseek-chat',
            models: ['deepseek-chat', 'deepseek-reasoner'],
            keyUrl: 'https://platform.deepseek.com/api_keys'
        }
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function http(url, init, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || CSC.config.REQUEST_TIMEOUT_MS);
        try {
            return await fetch(url, Object.assign({}, init, { signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }));
        } catch (e) {
            if (e.name === 'AbortError') throw new Err('timeout', 'timeout');
            // Falha de rede ou bloqueio de acesso direto pelo navegador (CORS).
            throw new Err('network', e.message);
        } finally {
            clearTimeout(timer);
        }
    }

    async function errorFrom(response) {
        let detail = '';
        try {
            const data = await response.json();
            const e = data && (data.error || data);
            detail = (e && (e.message || (typeof e === 'string' ? e : ''))) || '';
        } catch (_) { /* corpo não JSON */ }
        const s = response.status;
        const code = (s === 401 || s === 403) ? 'invalid-key'
            : s === 404 ? 'model-not-found'
            : s === 429 ? (/quota|billing|credit|balance|insufficient/i.test(detail) ? 'quota-daily' : 'quota')
            : (s >= 500 || s === 529) ? 'server'
            : s === 402 ? 'quota-daily' : 'http';
        const err = new Err(code, detail || response.statusText || String(s), s);
        const ra = Number(response.headers.get('retry-after'));
        if (ra > 0) err.retryDelay = ra;
        return err;
    }

    /** Converte o esquema no formato do Gemini (OBJECT, STRING…) em JSON Schema padrão. */
    function toJsonSchema(s) {
        if (!s || typeof s !== 'object') return s;
        const out = {};
        for (const [k, v] of Object.entries(s)) {
            if (k === 'type') out.type = String(v).toLowerCase();
            else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, d]) => [p, toJsonSchema(d)]));
            else if (k === 'items') out.items = toJsonSchema(v);
            else out[k] = v;
        }
        if (out.type === 'object') out.additionalProperties = false;
        return out;
    }

    async function withRetries(send, onWait) {
        let quota = 0, server = 0;
        for (;;) {
            G.stats.requests++;
            G.stats.listeners.forEach(fn => { try { fn(G.stats.requests); } catch (_) { /* ignora */ } });
            const response = await send();
            if (response.ok) return response;
            const err = await errorFrom(response);
            if (err.code === 'quota' && quota < 3) {
                const wait = Math.min(Math.max(err.retryDelay || 10 * Math.pow(2, quota), 2), 70);
                quota++;
                for (let left = wait; left > 0; left--) { if (onWait) onWait(left); await sleep(1000); }
                if (onWait) onWait(0);
                continue;
            }
            if (err.code === 'server' && server < 2) { server++; await sleep(2000 * server); continue; }
            throw err;
        }
    }

    // ---- Anthropic (API Messages, chamada direta do navegador) ----
    const ANTHROPIC = 'https://api.anthropic.com/v1';
    function anthropicHeaders(apiKey, extra) {
        return Object.assign({
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2026-10-21',
            'anthropic-dangerous-direct-browser-access': 'true'
        }, extra || {});
    }
    async function generateAnthropic({ apiKey, model, system, user, kind, schema, onWait }) {
        const body = { model, max_tokens: 16000, system, messages: [{ role: 'user', content: user }] };
        let extra = null;
        // Modelos atuais podem recusar por política de segurança; o recurso "fallbacks" reexecuta o pedido em outro modelo.
        if (/^claude-(opus-5|sonnet-5-5|fable)/.test(model)) { body.fallbacks = 'default'; extra = { 'anthropic-beta': 'server-side-fallback-2026-07-01' }; }
        if (kind === 'json' && schema) body.output_config = { format: { type: 'json_schema', schema: toJsonSchema(schema) } };
        const send = b => () => http(`${ANTHROPIC}/messages`, { method: 'POST', headers: anthropicHeaders(apiKey, extra), body: JSON.stringify(b) });
        let response;
        try {
            response = await withRetries(send(body), onWait);
        } catch (err) {
            // Sem suporte ao formato estruturado ou aos "fallbacks" no modelo escolhido: repete sem eles (o JSON é pedido no texto).
            if (err.code !== 'http' || err.status !== 400) throw err;
            const plain = Object.assign({}, body);
            delete plain.output_config; delete plain.fallbacks;
            extra = null;
            response = await withRetries(send(plain), onWait);
        }
        const data = await response.json();
        if (data.stop_reason === 'refusal') throw new Err('blocked', (data.stop_details && data.stop_details.category) || 'refusal');
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        if (!text.trim()) throw new Err('empty', data.stop_reason || 'empty');
        return { text, truncated: data.stop_reason === 'max_tokens' };
    }

    // ---- OpenAI e DeepSeek (formato "chat completions") ----
    const OPENAI_LIKE = { openai: 'https://api.openai.com/v1', deepseek: 'https://api.deepseek.com' };
    async function generateOpenAILike(provider, { apiKey, model, system, user, kind, temperature, onWait }) {
        const sys = kind === 'json' ? system + '\n\nResponda somente com um objeto JSON válido. / Reply only with a valid JSON object.' : system;
        const body = { model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] };
        if (kind === 'json') body.response_format = { type: 'json_object' };
        // Modelos de raciocínio da OpenAI recusam "temperature"; a DeepSeek a aceita.
        if (provider === 'deepseek' && typeof temperature === 'number' && model !== 'deepseek-reasoner') body.temperature = temperature;
        const response = await withRetries(() => http(`${OPENAI_LIKE[provider]}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
            body: JSON.stringify(body)
        }), onWait);
        const data = await response.json();
        const choice = data.choices && data.choices[0];
        const text = (choice && choice.message && choice.message.content) || '';
        if (choice && choice.finish_reason === 'content_filter') throw new Err('blocked', 'content_filter');
        if (!text.trim()) throw new Err('empty', (choice && choice.finish_reason) || 'empty');
        return { text, truncated: !!choice && choice.finish_reason === 'length' };
    }

    async function generate(opts) {
        const provider = opts.provider || 'gemini';
        if (provider === 'gemini') return G.generate(opts);
        if (provider === 'anthropic') return generateAnthropic(opts);
        if (OPENAI_LIKE[provider]) return generateOpenAILike(provider, opts);
        throw new Err('http', 'unknown provider');
    }

    async function listModels(provider, apiKey) {
        if (provider === 'gemini') return G.listModels(apiKey);
        let response;
        if (provider === 'anthropic') response = await http(`${ANTHROPIC}/models?limit=100`, { method: 'GET', headers: anthropicHeaders(apiKey) }, 20000);
        else if (OPENAI_LIKE[provider]) response = await http(`${OPENAI_LIKE[provider]}/models`, { method: 'GET', headers: { authorization: 'Bearer ' + apiKey } }, 20000);
        else return [];
        if (!response.ok) throw await errorFrom(response);
        const data = await response.json();
        const ids = (data.data || []).map(m => m.id).filter(Boolean);
        if (provider === 'anthropic') return ids.filter(id => /^claude/.test(id));
        if (provider === 'openai') return ids.filter(id => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|image|tts|transcribe|search|embedding|instruct|moderation|dall)/i.test(id));
        return ids;
    }

    CSC.llm = { PROVIDERS, generate, listModels, toJsonSchema };
})();
