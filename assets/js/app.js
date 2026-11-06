/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/* Controlador da página: interface, chave, parâmetros da IA e fluxos. */
(function () {
    'use strict';
    const CSC = window.CSC;
    const t = (k, v) => CSC.t(k, v);
    const $ = id => document.getElementById(id);

    // ---------- Armazenamento seguro (falhas silenciosas) ----------
    const store = {
        get(area, key) { try { return window[area].getItem(key); } catch (_) { return null; } },
        set(area, key, value) { try { window[area].setItem(key, value); } catch (_) { /* indisponível */ } },
        remove(area, key) { try { window[area].removeItem(key); } catch (_) { /* indisponível */ } }
    };
    const KEY_NAME = 'geminiApiKey';
    const SETTINGS_KEY = 'csc.settings';
    const DRAFT_KEY = 'csc.draft';

    const DEFAULT_SETTINGS = { model: CSC.config.DEFAULT_MODEL, temperature: 0.2, rounds: 2, autoCompile: true };
    const MODE_KEY = 'csc.mode';

    // ---------- Estado ----------
    const state = {
        theme: store.get('localStorage', 'theme') || 'light',
        settings: Object.assign({}, DEFAULT_SETTINGS, safeJson(store.get('localStorage', SETTINGS_KEY))),
        history: [],        // [{ code, origin }]
        index: -1,
        busy: false,
        findings: [],
        compile: null,      // { code, result | error }
        optimization: '',
        outputs: {},        // textos das análises, para o relatório
        mapping: null,
        mode: ['ai', 'template', 'blocks'].includes(store.get('localStorage', MODE_KEY)) ? store.get('localStorage', MODE_KEY) : 'blocks',
        template: { id: null, values: {}, status: {}, manual: false, scale: 1000 },
        templatePlan: null   // { id, values, lang } do último código gerado por modelo
    };
    CSC.lang = store.get('localStorage', 'language') === 'en' ? 'en' : 'pt';

    function safeJson(s) { try { return s ? JSON.parse(s) : {}; } catch (_) { return {}; } }

    // ---------- Elementos ----------
    const el = {
        apiKey: $('geminiApiKeyInput'), toggleKey: $('toggleKeyVisibility'), saveKey: $('saveApiKeyButton'),
        forgetKey: $('forgetApiKeyButton'), remember: $('rememberKeyCheckbox'), keyFeedback: $('apiKeySaveFeedback'),
        model: $('modelSelect'), temperature: $('temperatureInput'), temperatureValue: $('temperatureValue'),
        rounds: $('roundsSelect'), autoCompile: $('autoCompileCheckbox'), resetParams: $('resetParamsButton'),
        theme: $('themeToggleButton'), language: $('languageToggleButton'),
        clause: $('naturalLanguageClause'), examples: $('exampleSelect'),
        code: $('solidityCode'), versionInfo: $('versionInfo'), toolbarFeedback: $('toolbarFeedback'),
        undo: $('undoButton'), redo: $('redoButton'),
        warning: $('solidityWarning'), securitySection: $('securitySection'), labSection: $('labSection'), improveSection: $('improveSection'),
        scanSummary: $('scanSummary'), scanFindings: $('scanFindings'),
        compileTitle: $('compileTitle'), compileStatus: $('compileStatus'), compileMessages: $('compileMessages'),
        convertProgress: $('convertProgressText'), pipelineSummary: $('pipelineSummary'),
        error: $('errorMessage')
    };

    // ---------- Tema e idioma ----------
    function applyTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);
        el.theme.textContent = state.theme === 'light' ? t('themeToggleDark') : t('themeToggleLight');
    }

    function applyLanguage() {
        document.documentElement.lang = CSC.lang === 'en' ? 'en' : 'pt-BR';
        document.title = t('pageTitle');
        document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.getAttribute('data-i18n')); });
        // Conteúdo estático e confiável (definido em i18n.js), com marcação simples.
        document.querySelectorAll('[data-i18n-html]').forEach(n => {
            n.innerHTML = t(n.getAttribute('data-i18n-html'), { v: CSC.config.SOLC_VERSION });
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(n => { n.placeholder = t(n.getAttribute('data-i18n-placeholder')); });
        document.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
        document.querySelectorAll('[data-ai]').forEach(n => n.setAttribute('data-ai-badge', t('aiBadge')));
        el.language.textContent = t('languageToggle');
        el.toggleKey.textContent = el.apiKey.type === 'password' ? t('showKey') : t('hideKey');
        el.compileTitle.textContent = t('compileTitle', { v: CSC.config.SOLC_VERSION });
        if (CSC.gemini) renderRequestCount(CSC.gemini.stats.requests);
        if (typeof renderRates === 'function' && document.getElementById('ratesStatus')) try { renderRates(); } catch (_) { /* antes da inicialização */ }
        renderExamples();
        renderTemplateSelect();
        renderTemplateFields();
        if (CSC.composer.model()) CSC.composer.render();
        renderDetected();
        updateSettingsStatus();
        applyTheme();
        updateCodeUI();
        renderCompile();
        if (state.mapping) renderMapping(state.mapping);
        CSC.lab.rerender();
    }

    function renderExamples() {
        const current = el.examples.value;
        el.examples.textContent = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = t('examplesPlaceholder');
        el.examples.appendChild(ph);
        t('examples').forEach((ex, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = ex.name;
            el.examples.appendChild(o);
        });
        el.examples.value = current && el.examples.querySelector('option[value="' + current + '"]') ? current : '';
    }

    // ---------- Chave da API ----------
    function loadKey() {
        const session = store.get('sessionStorage', KEY_NAME);
        const persistent = store.get('localStorage', KEY_NAME);
        el.apiKey.value = session || persistent || '';
        el.remember.checked = !!persistent;
    }

    function flash(target, text) {
        target.textContent = text;
        target.classList.add('visible');
        clearTimeout(target._timer);
        target._timer = setTimeout(() => target.classList.remove('visible'), 2500);
    }

    function saveKey() {
        const key = el.apiKey.value.trim();
        if (!key) return flash(el.keyFeedback, t('apiKeyEmpty'));
        store.remove('localStorage', KEY_NAME);
        store.remove('sessionStorage', KEY_NAME);
        if (el.remember.checked) store.set('localStorage', KEY_NAME, key);
        else store.set('sessionStorage', KEY_NAME, key);
        flash(el.keyFeedback, el.remember.checked ? t('apiKeySavedPersistent') : t('apiKeySavedSession'));
        refreshModels();
    }

    function forgetKey() {
        store.remove('localStorage', KEY_NAME);
        store.remove('sessionStorage', KEY_NAME);
        el.apiKey.value = '';
        el.remember.checked = false;
        flash(el.keyFeedback, t('apiKeyForgotten'));
    }

    // ---------- Parâmetros da IA ----------
    function saveSettings() { store.set('localStorage', SETTINGS_KEY, JSON.stringify(state.settings)); }

    function renderModelOptions(models) {
        const list = Array.from(new Set([state.settings.model].concat(models)));
        el.model.textContent = '';
        for (const m of list) {
            const o = document.createElement('option');
            o.value = m;
            o.textContent = m;
            el.model.appendChild(o);
        }
        el.model.value = state.settings.model;
    }

    async function refreshModels() {
        const key = el.apiKey.value.trim();
        if (!key) return;
        try {
            const models = await CSC.gemini.listModels(key);
            if (models.length) {
                const preferred = CSC.config.FALLBACK_MODELS.filter(m => models.includes(m));
                renderModelOptions(preferred.concat(models.sort()));
                flash(el.keyFeedback, t('modelsLoaded'));
            }
        } catch (_) { /* mantém a lista padrão */ }
    }

    function renderSettings() {
        renderModelOptions(CSC.config.FALLBACK_MODELS);
        el.temperature.value = String(state.settings.temperature);
        el.temperatureValue.textContent = Number(state.settings.temperature).toFixed(1);
        el.rounds.value = String(state.settings.rounds);
        el.autoCompile.checked = !!state.settings.autoCompile;
    }

    // ---------- Mensagens ----------
    function showError(message) {
        el.error.textContent = message;
        el.error.hidden = false;
        el.error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    function clearError() { el.error.hidden = true; el.error.textContent = ''; }

    function errorMessage(err) {
        const code = err && err.code;
        switch (code) {
            case 'invalid-key': return t('errInvalidKey');
            case 'model-not-found': return t('errModelNotFound', { model: state.settings.model });
            case 'quota': return t('errQuota');
            case 'quota-daily': return t('errQuotaDaily');
            case 'bad-json': return t('errBadJson');
            case 'server': return t('errServer');
            case 'timeout': return t('errTimeout');
            case 'network': return t('errNetwork');
            case 'blocked': return t('errBlocked', { reason: err.message });
            case 'empty': return t('errEmpty');
            case 'not-solidity': return t('errNotSolidity');
            default: return t('errGeneric', { msg: (err && err.message) || String(err) });
        }
    }

    // ---------- Execução de chamadas à IA ----------
    function setBusy(busy) {
        state.busy = busy;
        updateButtons();
    }

    function updateButtons() {
        const hasCode = !!currentCode().trim();
        document.querySelectorAll('[data-ai]').forEach(b => { b.disabled = state.busy || (b.hasAttribute('data-needs-code') && !hasCode); });
        document.querySelectorAll('[data-needs-code]:not([data-ai])').forEach(b => { b.disabled = !hasCode || (state.busy && b.id !== 'copyCodeButton' && b.id !== 'downloadCodeButton'); });
        el.undo.disabled = state.busy || state.index <= 0;
        el.redo.disabled = state.busy || state.index >= state.history.length - 1;
        el.code.readOnly = state.busy;
        const tt = $('labTemplateTestsButton');
        if (tt) tt.disabled = state.busy || !hasCode || !state.templatePlan;
        const gen = $('templateGenerateButton');
        if (gen) gen.disabled = state.busy || !state.template.id;
    }

    /** Mostra a contagem regressiva quando o plano gratuito pede espera. */
    function onQuotaWait(seconds) {
        const n = $('quotaNotice');
        if (!n) return;
        n.hidden = seconds <= 0;
        n.textContent = seconds > 0 ? t('waitingQuota', { s: seconds }) : '';
    }

    /** Escolhe outro modelo disponível para a chave quando o atual não existe. */
    async function switchToAvailableModel(apiKey) {
        const available = await CSC.gemini.listModels(apiKey);
        const preferred = CSC.config.FALLBACK_MODELS.find(m => available.includes(m) && m !== state.settings.model)
            || available.find(m => /flash/.test(m) && m !== state.settings.model);
        if (!preferred) return null;
        const from = state.settings.model;
        state.settings.model = preferred;
        saveSettings();
        renderModelOptions(CSC.config.FALLBACK_MODELS.filter(m => available.includes(m)).concat(available));
        flash(el.keyFeedback, t('modelSwitched', { from, to: preferred }));
        showNotice(t('modelSwitched', { from, to: preferred }));
        return preferred;
    }

    async function askAI(request) {
        const apiKey = el.apiKey.value.trim();
        if (!apiKey) {
            const e = new Error('no key');
            e.code = 'no-key';
            throw e;
        }
        const call = () => CSC.gemini.generate({
            apiKey,
            model: state.settings.model,
            system: request.system,
            user: request.user,
            kind: request.kind,
            schema: request.schema,
            temperature: request.kind === 'text' ? Math.max(0.3, state.settings.temperature) : state.settings.temperature,
            onWait: onQuotaWait
        });
        let res;
        try {
            res = await call();
            state.aiUsed = true;
        } catch (err) {
            if (err && err.code === 'model-not-found' && await switchToAvailableModel(apiKey).catch(() => null)) {
                res = await call();
            } else {
                throw err;
            }
        } finally {
            onQuotaWait(0);
        }
        if (request.kind === 'json') {
            try {
                return { data: CSC.gemini.parseJsonLoose(res.text), truncated: res.truncated };
            } catch (_) {
                const e = new Error('invalid JSON');
                e.code = 'bad-json';
                throw e;
            }
        }
        if (request.kind === 'code') {
            const code = CSC.gemini.extractSolidity(res.text);
            if (!code) {
                const e = new Error('not solidity');
                e.code = 'not-solidity';
                throw e;
            }
            return { code, truncated: res.truncated };
        }
        return res;
    }

    function showNotice(text) {
        const n = $('quotaNotice');
        if (!n) return;
        n.hidden = false;
        n.textContent = text;
        clearTimeout(n._t);
        n._t = setTimeout(() => { n.hidden = true; }, 6000);
    }

    /** Executa uma tarefa com indicador de carregamento e tratamento de erros. */
    async function runTask(loadingId, task) {
        if (state.busy) return null;
        clearError();
        const loading = loadingId ? $(loadingId) : null;
        if (loading) loading.hidden = false;
        setBusy(true);
        try {
            return await task();
        } catch (err) {
            if (err && err.code === 'no-key') {
                showError(t('errNoKeyOpened'));
                $('settingsPanel').open = true;
                $('settingsPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => el.apiKey.focus({ preventScroll: true }), 400);
            } else showError(errorMessage(err));
            return null;
        } finally {
            if (loading) loading.hidden = true;
            setBusy(false);
        }
    }

    function showMarkdown(containerId, outputId, text, key) {
        $(outputId).innerHTML = CSC.markdown.render(text);
        $(containerId).hidden = false;
        if (key) state.outputs[key] = text;
    }

    // ---------- Código e histórico ----------
    function currentCode() { return el.code.value; }

    function setCode(code, origin) {
        // Descarta o "futuro" se o usuário desfez e gerou nova versão.
        state.history = state.history.slice(0, state.index + 1);
        state.history.push({ code, origin });
        state.index = state.history.length - 1;
        el.code.value = code;
        onCodeChanged();
    }

    /** Legenda colorida acima do código: um botão por cláusula, que rola até a seção correspondente. */
    function renderCodeLegend() {
        const box = $('codeLegend');
        if (!box) return;
        box.textContent = '';
        const cur = state.history[state.index];
        const tp = state.templatePlan;
        if (!cur || cur.origin !== 'blocks' || !tp || tp.kind !== 'blocks') { box.hidden = true; return; }
        let leg;
        try { leg = CSC.blocks.legend(tp.model, tp.lang); } catch (_) { box.hidden = true; return; }
        const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
        box.appendChild(mk('span', 'muted', t('codeLegendLabel')));
        for (const c of leg.clausulas) {
            const b = mk('button', 'k' + c.cor);
            b.type = 'button';
            b.title = t('codeLegendTitle', { name: c.numero });
            b.appendChild(mk('span', 'k-dot'));
            b.appendChild(document.createTextNode(c.numero + ' · ' + c.rotulo));
            b.addEventListener('click', () => scrollCodeTo('// ' + c.numero + ' — '));
            box.appendChild(b);
        }
        box.hidden = false;
    }

    function scrollCodeTo(marker) {
        const ta = el.code;
        const i = ta.value.indexOf(marker);
        if (i < 0) return;
        const line = ta.value.slice(0, i).split('\n').length - 1;
        const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
        ta.scrollTop = Math.max(0, (line - 2) * lh);
        ta.focus({ preventScroll: true });
        const end = ta.value.indexOf('\n', i);
        ta.setSelectionRange(i, end < 0 ? i : end);
    }

    function onCodeChanged() {
        saveDraft();
        updateCodeUI();
        renderCodeLegend();
        runScan();
        renderCompile();
        if (state.compile && state.compile.code !== currentCode() && state.settings.autoCompile && CSC.compiler.isLoaded()) {
            scheduleCompile();
        }
    }

    function originLabel(origin) {
        return t({ generated: 'originGenerated', optimized: 'originOptimized', refined: 'originRefined', fixed: 'originFixed', autofixed: 'originAutoFixed', manual: 'originManual', template: 'originTemplate', adapted: 'originAdapted', blocks: 'originBlocks' }[origin] || 'originManual');
    }

    function updateCodeUI() {
        const hasCode = !!currentCode().trim();
        el.warning.hidden = !hasCode;
        el.securitySection.hidden = !hasCode;
        el.labSection.hidden = !hasCode;
        el.improveSection.hidden = !hasCode;
        $('adaptRow').hidden = !hasCode || !state.templatePlan;
        if (state.index >= 0 && state.history[state.index]) {
            el.versionInfo.hidden = false;
            el.versionInfo.textContent = t('versionLabel', { n: state.index + 1, total: state.history.length }) + ' · ' + originLabel(state.history[state.index].origin);
        } else {
            el.versionInfo.hidden = true;
        }
        updateButtons();
    }

    let manualTimer = null;
    el.code.addEventListener('input', () => {
        clearTimeout(manualTimer);
        manualTimer = setTimeout(() => {
            const code = currentCode();
            const cur = state.history[state.index];
            if (cur && cur.code === code) return;
            if (cur && cur.origin === 'manual') {
                cur.code = code; // agrupa edições manuais consecutivas
                onCodeChanged();
            } else {
                setCode(code, 'manual');
            }
        }, 500);
    });

    el.undo.addEventListener('click', () => {
        if (state.index <= 0) return;
        state.index--;
        el.code.value = state.history[state.index].code;
        onCodeChanged();
    });
    el.redo.addEventListener('click', () => {
        if (state.index >= state.history.length - 1) return;
        state.index++;
        el.code.value = state.history[state.index].code;
        onCodeChanged();
    });

    function saveDraft() {
        store.set('sessionStorage', DRAFT_KEY, JSON.stringify({
            clause: el.clause.value, history: state.history.slice(-20), index: Math.min(state.index, 19),
            template: state.template, templatePlan: state.templatePlan, composer: CSC.composer.model()
        }));
    }
    function loadDraft() {
        const d = safeJson(store.get('sessionStorage', DRAFT_KEY));
        if (d.clause) el.clause.value = d.clause;
        if (d.template && d.template.id) state.template = Object.assign(state.template, d.template);
        if (d.templatePlan && (d.templatePlan.id || d.templatePlan.kind === 'blocks')) state.templatePlan = d.templatePlan;
        state.draftComposer = d.composer && Array.isArray(d.composer.blocks) ? d.composer : null;
        if (Array.isArray(d.history) && d.history.length) {
            state.history = d.history;
            state.index = Math.max(0, Math.min(d.index ?? d.history.length - 1, d.history.length - 1));
            el.code.value = state.history[state.index].code;
        }
    }

    // ---------- Verificador local ----------
    const SEV_KEY = { high: 'sevHigh', medium: 'sevMedium', low: 'sevLow', info: 'sevInfo' };

    function runScan() {
        const code = currentCode();
        state.findings = code.trim() ? CSC.SecurityScanCompat.scan(code, { lang: CSC.lang }) : [];
        renderScan();
    }

    function renderScan() {
        el.scanSummary.textContent = '';
        el.scanFindings.textContent = '';
        if (!currentCode().trim()) {
            el.scanFindings.appendChild(li('finding finding-empty', t('scanNoCode')));
            return;
        }
        const counts = window.SecurityScan.summarize(state.findings.filter(f => !f.acknowledged));
        for (const sev of ['high', 'medium', 'low', 'info']) {
            const chip = document.createElement('span');
            chip.className = 'chip chip-' + sev + (counts[sev] ? '' : ' chip-zero');
            chip.textContent = t(SEV_KEY[sev]) + ': ' + counts[sev];
            el.scanSummary.appendChild(chip);
        }
        if (!state.findings.length) {
            el.scanFindings.appendChild(li('finding finding-ok', '✓ ' + t('scanEmpty')));
            return;
        }
        for (const f of state.findings) {
            const item = document.createElement('li');
            item.className = 'finding finding-' + f.severity + (f.acknowledged ? ' finding-ack' : '');
            const head = document.createElement('div');
            head.className = 'finding-head';
            const badge = document.createElement('span');
            badge.className = 'chip chip-' + f.severity;
            badge.textContent = t(SEV_KEY[f.severity]);
            const title = document.createElement('strong');
            title.textContent = f.title;
            head.append(badge, title);
            if (f.line) {
                const line = document.createElement('button');
                line.type = 'button';
                line.className = 'line-link';
                line.textContent = t('lineLabel') + ' ' + f.line;
                line.addEventListener('click', () => goToLine(f.line));
                head.append(line);
            }
            if (f.swc) {
                const swc = document.createElement('span');
                swc.className = 'muted small';
                swc.textContent = f.swc;
                head.append(swc);
            }
            const desc = document.createElement('p');
            desc.textContent = f.description;
            const rec = document.createElement('p');
            rec.className = 'recommendation';
            rec.textContent = t('recommendationLabel') + ' ' + f.recommendation;
            item.append(head, desc, rec);
            el.scanFindings.appendChild(item);
        }
    }

    function li(cls, text) {
        const n = document.createElement('li');
        n.className = cls;
        n.textContent = text;
        return n;
    }

    function goToLine(line) {
        const lines = currentCode().split('\n');
        let start = 0;
        for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
        const end = start + (lines[line - 1] || '').length;
        el.code.focus();
        el.code.setSelectionRange(start, end);
        const lineHeight = parseFloat(getComputedStyle(el.code).lineHeight) || 20;
        el.code.scrollTop = Math.max(0, (line - 4) * lineHeight);
    }

    // ---------- Compilação ----------
    let compileTimer = null;
    function scheduleCompile() {
        clearTimeout(compileTimer);
        compileTimer = setTimeout(() => { if (!state.busy) compileNow(); }, 1200);
    }

    async function compileNow() {
        const code = currentCode();
        if (!code.trim()) return null;
        $('compileLoadingIndicator').hidden = false;
        try {
            const result = await CSC.compiler.compile(code);
            state.compile = { code, result };
        } catch (e) {
            state.compile = { code, error: e.message };
        } finally {
            $('compileLoadingIndicator').hidden = true;
        }
        renderCompile();
        return state.compile;
    }

    function compileErrors(compile) {
        if (!compile || !compile.result) return [];
        return compile.result.errors.filter(e => e.severity === 'error');
    }

    function renderCompile() {
        el.compileMessages.textContent = '';
        const c = state.compile;
        if (!c) { el.compileStatus.hidden = true; return; }
        el.compileStatus.hidden = false;
        if (c.error) {
            el.compileStatus.className = 'status-line status-error';
            el.compileStatus.textContent = t('compileUnavailable');
            return;
        }
        const errors = compileErrors(c);
        const warnings = c.result.errors.filter(e => e.severity === 'warning');
        el.compileStatus.className = 'status-line ' + (errors.length ? 'status-error' : warnings.length ? 'status-warn' : 'status-ok');
        el.compileStatus.textContent = (errors.length ? t('compileFailed', { n: errors.length }) : warnings.length ? t('compileOkWarnings', { n: warnings.length }) : '✓ ' + t('compileOk'))
            + ' (solc ' + (c.result.version || '').split('+')[0] + ')'
            + (c.code !== currentCode() ? ' — ' + t('compileStale') : '');
        for (const e of c.result.errors.filter(x => x.severity !== 'info')) {
            const item = document.createElement('li');
            item.className = 'finding finding-' + (e.severity === 'error' ? 'high' : 'low');
            const head = document.createElement('div');
            head.className = 'finding-head';
            const badge = document.createElement('span');
            badge.className = 'chip chip-' + (e.severity === 'error' ? 'high' : 'low');
            badge.textContent = e.type || e.severity;
            const msg = document.createElement('strong');
            msg.textContent = e.message;
            head.append(badge, msg);
            if (e.line) {
                const line = document.createElement('button');
                line.type = 'button';
                line.className = 'line-link';
                line.textContent = t('lineLabel') + ' ' + e.line;
                line.addEventListener('click', () => goToLine(e.line));
                head.append(line);
            }
            item.append(head);
            el.compileMessages.appendChild(item);
        }
        for (const ct of c.result.contracts.filter(x => x.deployedSize > 0)) {
            const tooBig = ct.deployedSize > 24576;
            el.compileMessages.appendChild(li('finding ' + (tooBig ? 'finding-high' : 'finding-ok'),
                tooBig ? t('contractTooLarge', { name: ct.name }) : t('contractSize', { name: ct.name, size: ct.deployedSize.toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR') })));
        }
    }

    // ---------- Problemas pendentes (para correção) ----------
    function blockingFindings() {
        return state.findings.filter(f => !f.acknowledged && (f.severity === 'high' || f.severity === 'medium'));
    }

    function problemsText(extra) {
        const lines = [];
        const errs = compileErrors(state.compile && state.compile.code === currentCode() ? state.compile : null);
        if (errs.length) {
            lines.push('ERROS DE COMPILAÇÃO (solc ' + CSC.config.SOLC_VERSION + '):');
            errs.forEach(e => lines.push('- ' + (e.line ? 'linha ' + e.line + ': ' : '') + (e.type || 'Error') + ': ' + e.message));
        }
        const findings = blockingFindings();
        if (findings.length) {
            lines.push('ACHADOS DO VERIFICADOR AUTOMÁTICO:');
            findings.forEach(f => lines.push('- [' + f.severity + '] ' + (f.line ? 'linha ' + f.line + ': ' : '') + f.title + ' — ' + f.recommendation));
        }
        if (extra) {
            lines.push('TESTES QUE FALHARAM NO LABORATÓRIO:');
            lines.push(extra);
        }
        return lines.join('\n');
    }

    // ---------- Ciclo de geração com autocorreção ----------
    async function verifyAndFix(progressEl) {
        const rounds = Number(state.settings.rounds) || 0;
        let fixesDone = 0;
        let compiled = false;
        for (let i = 1; i <= rounds + 1; i++) {
            const n = Math.max(rounds, 1);
            progressEl.textContent = t('stepChecking', { i: Math.min(i, n), n });
            runScan();
            if (state.settings.autoCompile) {
                progressEl.textContent = t('stepCompiling', { i: Math.min(i, n), n });
                const c = await compileNow();
                compiled = !!(c && c.result);
            }
            const hasErrors = compileErrors(state.compile && state.compile.code === currentCode() ? state.compile : null).length > 0;
            const blocking = blockingFindings().length > 0;
            if ((!hasErrors && !blocking) || i > rounds) break;
            progressEl.textContent = t('stepFixing', { i, n: rounds });
            const res = await askAI(CSC.prompts.fix(currentCode(), problemsText(), CSC.lang));
            setCode(res.code, 'autofixed');
            fixesDone++;
        }
        const errorsLeft = compileErrors(state.compile && state.compile.code === currentCode() ? state.compile : null).length;
        const highLeft = blockingFindings().length;
        el.pipelineSummary.hidden = false;
        if (!errorsLeft && !highLeft) {
            el.pipelineSummary.className = 'status-line status-ok';
            el.pipelineSummary.textContent = '✓ ' + t(fixesDone ? 'pipelineClean' : 'pipelineCleanNoFix', { n: fixesDone, compiled: compiled ? t('pipelineCompiledSuffix') : '' });
        } else {
            el.pipelineSummary.className = 'status-line status-warn';
            el.pipelineSummary.textContent = t('pipelineRemaining', { n: fixesDone, e: errorsLeft, h: highLeft });
        }
    }

    function resetDerivedOutputs(keepTemplatePlan) {
        if (!keepTemplatePlan) state.templatePlan = null;
        ['riskAnalysisOutputContainer', 'suggestClausesOutputContainer', 'explanationOutputContainer', 'optimizationOutputContainer',
            'securityReviewOutputContainer', 'codeQueryOutputContainer', 'mappingOutputContainer', 'labScenariosPanel'].forEach(id => { $(id).hidden = true; });
        $('applyOptimizationButton').hidden = true;
        state.outputs = {};
        state.mapping = null;
        state.optimization = '';
        el.pipelineSummary.hidden = true;
        CSC.lab.reset();
    }

    // ---------- Modo sem IA: modelos revisados ----------
    const TPL = CSC.templates;

    function applyMode() {
        $('modeBlocks').checked = state.mode === 'blocks';
        $('modeTemplate').checked = state.mode === 'template';
        $('modeAI').checked = state.mode === 'ai';
        $('blocksPanel').hidden = state.mode !== 'blocks';
        $('clauseInput').hidden = state.mode === 'blocks';
        $('templatePanel').hidden = state.mode !== 'template';
        $('aiPanel').hidden = state.mode !== 'ai';
        document.querySelector('.spread').classList.toggle('doc-mode', state.mode === 'blocks');
    }

    /** Texto do contrato para as funções de IA: minuta montada ou texto livre. */
    function clauseText() {
        if (state.mode === 'blocks' && CSC.composer.model()) {
            return CSC.blocks.minuta(CSC.composer.model(), CSC.lang).map(c => c.numero + ' — ' + c.titulo + '. ' + c.texto).join('\n\n');
        }
        return el.clause.value.trim();
    }

    // ---------- Montagem por blocos ----------
    let blocksTimer = null;
    function onComposerChange(model) {
        saveDraft();
        clearTimeout(blocksTimer);
        blocksTimer = setTimeout(() => {
            // O código acompanha o contrato enquanto a versão atual vier da montagem.
            const cur = state.history[state.index];
            if (!cur || cur.origin !== 'blocks' || state.busy) return;
            if (CSC.blocks.validate(model).length) return;
            const code = CSC.blocks.build(model, CSC.lang);
            if (code === cur.code) return;
            cur.code = code;
            el.code.value = code;
            state.templatePlan = { kind: 'blocks', model: JSON.parse(JSON.stringify(model)), lang: CSC.lang };
            onCodeChanged();
        }, 700);
    }

    async function generateFromBlocks() {
        const model = CSC.composer.model();
        if (!model || state.busy) return;
        const issues = CSC.blocks.validate(model);
        if (issues.length) return showError(issues[0][CSC.lang === 'en' ? 'en' : 'pt']);
        clearError();
        setBusy(true);
        $('convertLoadingIndicator').hidden = false;
        try {
            resetDerivedOutputs();
            state.templatePlan = { kind: 'blocks', model: JSON.parse(JSON.stringify(model)), lang: CSC.lang };
            setCode(CSC.blocks.build(model, CSC.lang), 'blocks');
            await verifyOnly('blocksGenerated');
            el.code.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally {
            $('convertLoadingIndicator').hidden = true;
            setBusy(false);
        }
    }

    function updateSettingsStatus() {
        const st = $('settingsStatus');
        if (!st) return;
        st.textContent = el.apiKey.value.trim() ? t('settingsWithKey', { model: state.settings.model }) : t('settingsNoKey');
    }

    function renderTemplateSelect() {
        const sel = $('templateSelect');
        sel.textContent = '';
        for (const tpl of TPL.list(CSC.lang)) {
            const o = document.createElement('option');
            o.value = tpl.id;
            o.textContent = tpl.name;
            sel.appendChild(o);
        }
        if (!state.template.id) state.template.id = TPL.list(CSC.lang)[0].id;
        sel.value = state.template.id;
        $('scaleInput').value = String(state.template.scale || 1000);
    }

    function renderDetected() {
        const out = $('templateDetected');
        const text = el.clause.value.trim();
        if (state.template.manual) out.textContent = t('templateManual');
        else if (!text) out.textContent = '';
        else if (state.template.detected) out.textContent = t('templateDetected', { name: TPL.list(CSC.lang).find(x => x.id === state.template.detected).name });
        else out.textContent = t('templateNotDetected');
    }

    function renderTemplateFields() {
        const box = $('templateFields');
        box.textContent = '';
        const id = state.template.id;
        if (!id) return;
        const statusLabel = { found: 'fieldFound', default: 'fieldDefault', ai: 'fieldAI', edited: 'fieldEdited' };
        for (const f of TPL.fields(id, CSC.lang)) {
            const value = state.template.values[f.key] != null ? state.template.values[f.key] : f.def;
            const status = state.template.status[f.key] || 'default';
            const wrap = document.createElement('label');
            wrap.className = 'param-field status-' + status;
            const name = document.createElement('span');
            name.className = 'param-name';
            name.textContent = f.label;
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'decimal';
            input.value = String(value);
            input.dataset.key = f.key;
            const tag = document.createElement('span');
            tag.className = 'param-status';
            tag.textContent = (f.type === 'money' ? '(R$/US$) · ' : '') + t(statusLabel[status]);
            input.addEventListener('input', () => {
                state.template.values[f.key] = input.value;
                state.template.status[f.key] = 'edited';
                wrap.className = 'param-field status-edited';
                tag.textContent = (f.type === 'money' ? '(R$/US$) · ' : '') + t('fieldEdited');
                saveDraft();
            });
            wrap.append(name, input, tag);
            box.appendChild(wrap);
        }
    }

    /** Extração por regras a cada alteração do texto (sem IA). */
    function runExtraction() {
        const text = el.clause.value;
        const detected = TPL.detect(text).type;
        state.template.detected = detected;
        if (!state.template.manual && detected) state.template.id = detected;
        const id = state.template.id;
        const ex = TPL.extract(text, id);
        const keep = {};
        for (const [k, st] of Object.entries(state.template.status)) if (st === 'edited') keep[k] = state.template.values[k];
        state.template.values = Object.assign({}, ex.values, keep);
        state.template.status = {};
        for (const k of ex.found) state.template.status[k] = 'found';
        for (const k of Object.keys(keep)) state.template.status[k] = 'edited';
        $('templateSelect').value = id;
        renderTemplateFields();
        renderDetected();
        updateButtons();
    }

    function templateValues() {
        return Object.assign({}, state.template.values, { escala: Number(String($('scaleInput').value).replace(',', '.')) || 1000 });
    }

    /** Verificação sem IA (verificador local e, se ativado, compilação). */
    async function verifyOnly(messageKey) {
        runScan();
        let compileText = t('compileNotRun');
        if (state.settings.autoCompile) {
            el.convertProgress.textContent = t('compileLoading');
            const c = await compileNow();
            if (c && c.result) {
                const n = compileErrors(c).length;
                compileText = n ? t('compileErrShort', { n }) : t('compileOkShort');
            }
        }
        const n = blockingFindings().length;
        el.pipelineSummary.hidden = false;
        el.pipelineSummary.className = 'status-line ' + (n ? 'status-warn' : 'status-ok');
        el.pipelineSummary.textContent = t(messageKey || 'templateGenerated', { scan: n ? t('scanIssues', { n }) : t('scanClean'), compile: compileText });
    }

    async function generateFromTemplate() {
        const id = state.template.id;
        if (!id || state.busy) return;
        clearError();
        setBusy(true);
        $('convertLoadingIndicator').hidden = false;
        try {
            const values = templateValues();
            const { params } = TPL.normalize(id, values);
            resetDerivedOutputs();
            state.templatePlan = { id, values: params, lang: CSC.lang };
            setCode(TPL.build(id, params, CSC.lang), 'template');
            await verifyOnly();
            el.code.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally {
            $('convertLoadingIndicator').hidden = true;
            setBusy(false);
        }
    }

    async function aiExtract() {
        const clause = el.clause.value.trim();
        if (!clause) return showError(t('errNoClause'));
        const id = state.template.id;
        const fields = TPL.fields(id, CSC.lang);
        await runTask('aiExtractLoadingIndicator', async () => {
            const current = TPL.normalize(id, state.template.values).params;
            const res = await askAI(CSC.prompts.extractParams(clause, fields, current, CSC.lang));
            let changed = 0;
            for (const f of fields) {
                const v = res.data && res.data[f.key];
                if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
                    if (Number(current[f.key]) !== v) changed++;
                    state.template.values[f.key] = v;
                    state.template.status[f.key] = 'ai';
                }
            }
            renderTemplateFields();
            saveDraft();
            const d = $('templateDetected');
            d.textContent = t('aiExtractDone', { n: changed });
        });
    }

    /** Executa os cenários predefinidos do modelo no Laboratório (sem IA). */
    async function runTemplateTests() {
        if (!state.templatePlan) return CSC.lab.setStatus(t('labNoTemplatePlan'), 'error');
        await runTask('labLoadingIndicator', async () => {
            const c = await compiledForLab();
            if (!c) return;
            const tp = state.templatePlan;
            const plan = tp.kind === 'blocks' ? CSC.blocks.plan(tp.model, tp.lang) : TPL.plan(tp.id, tp.values, tp.lang);
            CSC.lab.setScale(planScale());
            const chosen = CSC.lab.pickContract(c.result.contracts, plan.contrato);
            if (!chosen) return CSC.lab.setStatus(t('labNoDeployable'), 'error');
            $('labScenariosPanel').hidden = false;
            await CSC.lab.runPlan(plan, Object.assign({ source: currentCode() }, chosen), (i, n) => { $('labLoadingText').textContent = t('labRunningScenario', { i, n }); });
            $('labScenariosPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    async function generate() {
        const clause = el.clause.value.trim();
        if (!clause) return showError(t('errNoClause'));
        await runTask('convertLoadingIndicator', async () => {
            el.convertProgress.textContent = t('stepGenerating');
            const res = await askAI(CSC.prompts.generate(clause, CSC.lang));
            resetDerivedOutputs(false);
            setCode(res.code, 'generated');
            await verifyAndFix(el.convertProgress);
            el.code.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    /** Aplica nova versão vinda da IA e roda o ciclo de verificação. */
    async function applyAICode(request, origin, loadingId, progressId) {
        // O plano de testes do modelo é mantido: serve de teste de regressão após ajustes da IA.
        return runTask(loadingId, async () => {
            const res = await askAI(request);
            setCode(res.code, origin);
            CSC.lab.reset();
            const progress = progressId ? $(progressId) : el.convertProgress;
            await verifyAndFix(progress);
            return true;
        });
    }

    // ---------- Laboratório ----------
    async function compiledForLab() {
        let c = state.compile && state.compile.code === currentCode() ? state.compile : null;
        if (!c) {
            CSC.lab.setStatus(t('labNeedsCompile'), '');
            c = await compileNow();
        }
        if (!c || c.error) { CSC.lab.setStatus(t('compileUnavailable'), 'error'); return null; }
        if (compileErrors(c).length) { CSC.lab.setStatus(t('labCompileErrors'), 'error'); return null; }
        if (!window.EvmLab) { CSC.lab.setStatus(t('labLoadFailed', { msg: 'EVM' }), 'error'); return null; }
        return c;
    }

    /** Escala R$/ETH usada na geração do código atual (se houver). */
    function planScale() {
        const tp = state.templatePlan;
        if (!tp) return null;
        return tp.kind === 'blocks' ? Number(tp.model.scale) || 1000 : Number((tp.values && tp.values.escala) || 1000);
    }

    async function labStart() {
        if (state.busy) return;
        setBusy(true);
        try {
            const c = await compiledForLab();
            if (!c) return;
            const chosen = CSC.lab.pickContract(c.result.contracts);
            if (!chosen) return CSC.lab.setStatus(t('labNoDeployable'), 'error');
            CSC.lab.setStatus('', '');
            const tp = state.templatePlan;
            const plan = tp ? (tp.kind === 'blocks' ? CSC.blocks.plan(tp.model, tp.lang) : TPL.plan(tp.id, tp.values, tp.lang)) : null;
            CSC.lab.setScale(planScale());
            CSC.lab.setSeries(tp && tp.kind === 'blocks' ? tp.model.blocks.filter(b => b.type === 'oraculoValor' && Array.isArray(b.serie) && b.serie.length).map(b => ({
                fn: (tp.lang === 'en' ? 'report' : 'informar') + CSC.blocks.names.pascal(b.label),
                from: (tp.model.roles.find(r => r.id === b.params.fonte) || {}).label,
                points: b.serie
            })) : []);
            CSC.lab.prepare(Object.assign({ source: currentCode() }, chosen), plan);
        } finally {
            setBusy(false);
        }
    }

    async function labScenarios(regenerate) {
        await runTask('labLoadingIndicator', async () => {
            const c = await compiledForLab();
            if (!c) return;
            let plan = null;
            const chosenDefault = CSC.lab.pickContract(c.result.contracts);
            if (!chosenDefault) return CSC.lab.setStatus(t('labNoDeployable'), 'error');
            if (regenerate || !CSC.lab.hasPlan()) {
                $('labLoadingText').textContent = t('labGeneratingScenarios');
                const res = await askAI(CSC.prompts.scenarios(clauseText(), currentCode(), CSC.lab.abiSummary(chosenDefault.abi), CSC.lang));
                plan = res.data;
                if (!plan || !Array.isArray(plan.cenarios)) throw Object.assign(new Error('scenarios'), { code: 'bad-json' });
            }
            const chosen = plan ? (CSC.lab.pickContract(c.result.contracts, plan.contrato) || chosenDefault) : chosenDefault;
            const compiled = Object.assign({ source: currentCode() }, chosen);
            $('labScenariosPanel').hidden = false;
            const progress = (i, n) => { $('labLoadingText').textContent = t('labRunningScenario', { i, n }); };
            if (plan) await CSC.lab.runPlan(plan, compiled, progress);
            else await CSC.lab.rerun(compiled, progress);
            $('labScenariosPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // ---------- Mapa de correspondência ----------
    function renderMapping(data) {
        const table = $('mappingTable');
        table.textContent = '';
        const items = (data && data.itens) || [];
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        ['mapCategory', 'mapExcerpt', 'mapElement', 'mapAutomation', 'mapNote'].forEach(k => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = t(k);
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        const tbody = document.createElement('tbody');
        const counts = { integral: 0, parcial: 0, nenhuma: 0 };
        for (const it of items) {
            const auto = ['integral', 'parcial', 'nenhuma'].includes(it.automacao) ? it.automacao : 'nenhuma';
            counts[auto]++;
            const tr = document.createElement('tr');
            const cells = [
                t('cat_' + it.categoria) !== 'cat_' + it.categoria ? t('cat_' + it.categoria) : it.categoria,
                it.trecho, it.elementoSolidity, null, it.observacao
            ];
            cells.forEach((v, i) => {
                const td = document.createElement('td');
                if (i === 3) {
                    const chip = document.createElement('span');
                    chip.className = 'chip auto-' + auto;
                    chip.textContent = t('auto_' + auto);
                    td.appendChild(chip);
                } else if (i === 2) {
                    const code = document.createElement('code');
                    code.textContent = v || '—';
                    td.appendChild(code);
                } else {
                    td.textContent = v || '';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }
        table.append(thead, tbody);
        const summary = $('mappingSummary');
        summary.textContent = '';
        const total = items.length || 1;
        const bar = document.createElement('div');
        bar.className = 'score-bar';
        for (const k of ['integral', 'parcial', 'nenhuma']) {
            const seg = document.createElement('span');
            seg.className = 'auto-seg auto-' + k;
            seg.style.width = (counts[k] / total * 100) + '%';
            bar.appendChild(seg);
        }
        const label = document.createElement('p');
        label.className = 'small';
        label.textContent = t('mapSummary', counts);
        summary.append(bar, label);
        $('mappingOutputContainer').hidden = false;
    }

    // ---------- Ferramentas do código ----------
    function contractName(code) {
        const m = /\bcontract\s+([A-Za-z_]\w*)/.exec(code);
        return m ? m[1] : 'Contrato';
    }

    async function copyCode(silent) {
        const code = currentCode();
        try {
            await navigator.clipboard.writeText(code);
        } catch (_) {
            el.code.select();
            try { document.execCommand('copy'); } catch (__) { /* sem suporte */ }
        }
        if (!silent) flash(el.toolbarFeedback, t('copied'));
    }

    function downloadFile(name, content, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function toBase64Utf8(text) {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }

    function openRemix() {
        const code = currentCode();
        copyCode(true);
        let url = 'https://remix.ethereum.org/#code=' + encodeURIComponent(toBase64Utf8(code)) + '&autoCompile=true';
        const v = CSC.compiler.version();
        const m = v && /^(\d+\.\d+\.\d+\+commit\.[0-9a-f]+)/.exec(v);
        if (m) url += '&version=soljson-v' + m[1] + '.js';
        window.open(url, '_blank', 'noopener');
    }

    function buildReport() {
        const lines = [];
        const now = new Date();
        const code = currentCode();
        lines.push('# ' + t('reportTitle'), '');
        lines.push('- ' + t('reportGenerated') + ': ' + now.toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR'));
        const origin = state.history[state.index] ? state.history[state.index].origin : '';
        lines.push('- ' + t('reportOrigin') + ': ' + originLabel(origin));
        if (state.aiUsed) lines.push('- ' + t('reportModel') + ': ' + state.settings.model + ' (' + t('temperatureLabel').toLowerCase() + ' ' + state.settings.temperature + ')');
        else lines.push('- ' + t('reportNoAI'));
        lines.push('- solc: ' + CSC.config.SOLC_VERSION, '');
        lines.push('> ' + (state.aiUsed ? t('reportDisclaimer') : t('reportDisclaimerNoAI')), '');
        if (clauseText()) lines.push('## ' + t('reportClause'), '', clauseText().split('\n').map(l => '> ' + l).join('\n'), '');
        const cm = state.mode === 'blocks' && CSC.composer.model();
        if (cm && cm.roles.some(r => r.carteira)) {
            lines.push('## ' + t('reportParties'), '');
            cm.roles.forEach(r => lines.push('- ' + r.label + (r.carteira ? ': `' + r.carteira + '`' : '')));
            lines.push('');
        }
        const sections = [['risk', 'riskAnalysisTitle'], ['suggest', 'suggestClausesTitle']];
        for (const [k, title] of sections) if (state.outputs[k]) lines.push('## ' + t(title), '', state.outputs[k], '');
        lines.push('## ' + t('reportCode'), '', '```solidity', code.trimEnd(), '```', '');
        lines.push('## ' + t('reportScan'), '');
        if (!state.findings.length) lines.push(t('scanEmpty'));
        for (const f of state.findings) lines.push('- **' + t(SEV_KEY[f.severity]) + '**' + (f.line ? ' (' + t('lineLabel') + ' ' + f.line + ')' : '') + ': ' + f.title + (f.swc ? ' — ' + f.swc : '') + '. ' + f.recommendation);
        lines.push('', '## ' + t('reportCompile'), '');
        const c = state.compile && state.compile.code === code ? state.compile : null;
        if (!c || !c.result) lines.push(t('reportNotCompiled'));
        else {
            const errs = compileErrors(c);
            lines.push(errs.length ? t('compileFailed', { n: errs.length }) : t('compileOk'));
            c.result.errors.filter(e => e.severity !== 'info').forEach(e => lines.push('- ' + e.severity + ': ' + e.message + (e.line ? ' (' + t('lineLabel') + ' ' + e.line + ')' : '')));
        }
        if (state.mapping && state.mapping.itens) {
            lines.push('', '## ' + t('mappingTitle'), '');
            lines.push('| ' + [t('mapCategory'), t('mapExcerpt'), t('mapElement'), t('mapAutomation'), t('mapNote')].join(' | ') + ' |');
            lines.push('|---|---|---|---|---|');
            const cell = s => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
            state.mapping.itens.forEach(it => lines.push('| ' + [t('cat_' + it.categoria), it.trecho, '`' + cell(it.elementoSolidity) + '`', t('auto_' + it.automacao), it.observacao].map(cell).join(' | ') + ' |'));
        }
        const lab = CSC.lab.summaryForReport();
        if (lab) {
            lines.push('', '## ' + t('labScenariosTitle'), '');
            for (const s of lab) {
                const mark = s.status === 'pass' ? '✓' : s.status === 'fail' ? '✗' : '?';
                lines.push('### ' + mark + ' ' + s.titulo + ' (' + (s.tipo === 'seguranca' ? t('labTypeSecurity') : t('labTypeFunctional')) + ')');
                s.passos.forEach(p => lines.push('- ' + (p.status === 'pass' ? '✓' : p.status === 'fail' ? '✗' : '!') + ' `' + (p.texto || '') + '`' + (p.resultado ? ' → ' + p.resultado : '') + (p.nota ? ' — ' + p.nota : '')));
                lines.push('');
            }
        }
        const txs = CSC.lab.timelineForReport ? CSC.lab.timelineForReport() : [];
        if (txs.length) {
            lines.push('', '## ' + t('labTimeline'), '');
            txs.forEach((tx, i) => lines.push((i + 1) + '. ' + tx));
        }
        for (const [k, title] of [['review', 'securityReviewTitle'], ['explain', 'explanationTitle'], ['optimize', 'optimizationTitle']]) {
            if (state.outputs[k]) lines.push('', '## ' + t(title), '', state.outputs[k]);
        }
        return lines.join('\n') + '\n';
    }

    // ---------- Eventos ----------
    el.toggleKey.addEventListener('click', () => {
        el.apiKey.type = el.apiKey.type === 'password' ? 'text' : 'password';
        el.toggleKey.textContent = el.apiKey.type === 'password' ? t('showKey') : t('hideKey');
    });
    el.saveKey.addEventListener('click', () => { saveKey(); updateSettingsStatus(); });
    el.forgetKey.addEventListener('click', () => { forgetKey(); updateSettingsStatus(); });
    el.apiKey.addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });

    el.model.addEventListener('change', () => { state.settings.model = el.model.value; saveSettings(); updateSettingsStatus(); });
    el.temperature.addEventListener('input', () => {
        state.settings.temperature = Number(el.temperature.value);
        el.temperatureValue.textContent = state.settings.temperature.toFixed(1);
        saveSettings();
    });
    el.rounds.addEventListener('change', () => { state.settings.rounds = Number(el.rounds.value); saveSettings(); });
    el.autoCompile.addEventListener('change', () => { state.settings.autoCompile = el.autoCompile.checked; saveSettings(); });
    el.resetParams.addEventListener('click', () => { state.settings = Object.assign({}, DEFAULT_SETTINGS); saveSettings(); renderSettings(); });

    el.theme.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        store.set('localStorage', 'theme', state.theme);
        applyTheme();
    });
    el.language.addEventListener('click', () => {
        CSC.lang = CSC.lang === 'pt' ? 'en' : 'pt';
        store.set('localStorage', 'language', CSC.lang);
        applyLanguage();
        runScan();
    });

    el.examples.addEventListener('change', () => {
        const ex = t('examples')[Number(el.examples.value)];
        if (ex) {
            el.clause.value = ex.text;
            state.template.manual = false;
            state.template.status = {};
            runExtraction();
            saveDraft();
        }
    });
    el.clause.addEventListener('input', () => {
        clearTimeout(el.clause._t);
        el.clause._t = setTimeout(() => { runExtraction(); saveDraft(); }, 400);
    });
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', () => {
        state.mode = ['ai', 'template', 'blocks'].includes(r.value) ? r.value : 'blocks';
        store.set('localStorage', MODE_KEY, state.mode);
        applyMode();
    }));
    $('templateSelect').addEventListener('change', () => {
        state.template.id = $('templateSelect').value;
        state.template.manual = true;
        runExtraction();
        saveDraft();
    });
    $('scaleInput').addEventListener('input', () => { state.template.scale = Number(String($('scaleInput').value).replace(',', '.')) || 1000; saveDraft(); });
    $('templateGenerateButton').addEventListener('click', generateFromTemplate);
    $('blocksGenerateButton').addEventListener('click', generateFromBlocks);
    $('aiExtractButton').addEventListener('click', aiExtract);
    $('labTemplateTestsButton').addEventListener('click', runTemplateTests);
    $('adaptButton').addEventListener('click', async () => {
        const clause = clauseText();
        if (!clause) return showError(t('errNoClause'));
        const ok = await applyAICode(CSC.prompts.adapt(currentCode(), clause, CSC.lang), 'adapted', 'adaptLoadingIndicator', 'convertProgressText', true);
        if (ok && state.templatePlan) await runTemplateTests();
    });

    $('convertButton').addEventListener('click', generate);

    $('analyzeRiskButton').addEventListener('click', () => {
        const clause = clauseText();
        if (!clause) return showError(t('errNoClause'));
        runTask('riskLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.risk(clause, CSC.lang));
            showMarkdown('riskAnalysisOutputContainer', 'riskAnalysisOutput', res.text, 'risk');
        });
    });

    $('suggestClausesButton').addEventListener('click', () => {
        const clause = clauseText();
        if (!clause) return showError(t('errNoClause'));
        runTask('suggestClausesLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.suggest(clause, CSC.lang));
            showMarkdown('suggestClausesOutputContainer', 'suggestClausesOutput', res.text, 'suggest');
        });
    });

    $('copyCodeButton').addEventListener('click', () => copyCode(false));
    $('downloadCodeButton').addEventListener('click', () => downloadFile(contractName(currentCode()) + '.sol', currentCode(), 'text/plain;charset=utf-8'));
    $('remixShortButton').addEventListener('click', openRemix);
    $('remixButton').addEventListener('click', openRemix);
    const report = () => downloadFile('relatorio-' + contractName(currentCode()) + '.md', buildReport(), 'text/markdown;charset=utf-8');
    /** Versão para imprimir ou salvar em PDF (pela janela de impressão do navegador). */
    function printReport() {
        let area = $('printArea');
        if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
        area.innerHTML = CSC.markdown.render(buildReport());
        document.body.classList.add('printing');
        const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        window.print();
        setTimeout(done, 1000);
    }
    $('reportButton').addEventListener('click', report);
    $('reportButton2').addEventListener('click', report);
    $('printButton').addEventListener('click', printReport);
    $('printButton2').addEventListener('click', printReport);

    $('compileButton').addEventListener('click', async () => {
        if (state.busy) return;
        setBusy(true);
        try { await compileNow(); } finally { setBusy(false); }
    });

    $('securityReviewButton').addEventListener('click', () => {
        const code = currentCode();
        if (!code.trim()) return showError(t('errNoCode'));
        runTask('reviewLoadingIndicator', async () => {
            const local = state.findings.map(f => '- [' + f.severity + '] ' + (f.line ? 'linha ' + f.line + ': ' : '') + f.title).join('\n');
            const res = await askAI(CSC.prompts.securityReview(code, local, CSC.lang));
            showMarkdown('securityReviewOutputContainer', 'securityReviewOutput', res.text, 'review');
        });
    });

    $('fixButton').addEventListener('click', async () => {
        const code = currentCode();
        if (!code.trim()) return showError(t('errNoCode'));
        if (!state.compile || state.compile.code !== code) {
            if (state.settings.autoCompile || CSC.compiler.isLoaded()) await compileNow();
        }
        const problems = problemsText();
        if (!problems) return showError(t('nothingToFix'));
        await applyAICode(CSC.prompts.fix(code, problems, CSC.lang), 'fixed', 'fixLoadingIndicator', 'convertProgressText');
    });

    $('explainSolidityButton').addEventListener('click', () => {
        const code = currentCode();
        runTask('explanationLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.explain(code, clauseText(), CSC.lang));
            showMarkdown('explanationOutputContainer', 'explanationOutput', res.text, 'explain');
        });
    });

    $('mappingButton').addEventListener('click', () => {
        const code = currentCode();
        const clause = clauseText();
        if (!clause) return showError(t('errNoClause'));
        runTask('mappingLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.mapping(clause, code, CSC.lang));
            state.mapping = res.data;
            renderMapping(res.data);
        });
    });

    $('optimizeSolidityButton').addEventListener('click', () => {
        const code = currentCode();
        runTask('optimizationLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.optimizeSuggestions(code, CSC.lang));
            state.optimization = res.text;
            showMarkdown('optimizationOutputContainer', 'optimizationOutput', res.text, 'optimize');
            $('applyOptimizationButton').hidden = false;
        });
    });

    $('applyOptimizationButton').addEventListener('click', async () => {
        if (!state.optimization) return showError(t('errNoSuggestions'));
        const ok = await applyAICode(CSC.prompts.applyOptimizations(currentCode(), state.optimization, CSC.lang), 'optimized', 'applyOptimizationLoadingIndicator', 'convertProgressText');
        if (ok) $('applyOptimizationButton').hidden = true;
    });

    $('submitRefinementButton').addEventListener('click', async () => {
        const feedback = $('refinementFeedback').value.trim();
        if (!feedback) return showError(t('errNoFeedback'));
        const ok = await applyAICode(CSC.prompts.refine(currentCode(), feedback, CSC.lang), 'refined', 'refinementLoadingIndicator', 'convertProgressText');
        if (ok) $('refinementFeedback').value = '';
    });

    $('askCodeQueryButton').addEventListener('click', () => {
        const question = $('codeQueryInput').value.trim();
        if (!question) return showError(t('errNoQuery'));
        runTask('codeQueryLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.query(currentCode(), question, CSC.lang));
            showMarkdown('codeQueryOutputContainer', 'codeQueryOutput', res.text);
        });
    });

    $('labStartButton').addEventListener('click', labStart);
    $('labScenariosButton').addEventListener('click', () => labScenarios(true));
    $('labRerunButton').addEventListener('click', () => labScenarios(false));
    $('labFixFromTestsButton').addEventListener('click', async () => {
        const failures = CSC.lab.failuresText();
        if (!failures) return showError(t('labNoFailures'));
        const ok = await applyAICode(CSC.prompts.fix(currentCode(), problemsText(failures), CSC.lang), 'fixed', 'fixLoadingIndicator', 'convertProgressText');
        if (ok) el.code.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ---------- Cotação do Ether ----------
    const ratesEl = { panel: $('ratesPanel'), status: $('ratesStatus'), info: $('ratesInfo'), eth: $('rateEth'), brl: $('rateBrl'), usd: $('rateUsd'), btc: $('rateBtc') };
    let ratesDriver = 'eth';
    const locale = () => (CSC.lang === 'en' ? 'en-US' : 'pt-BR');
    const fmtMoney = (v, cur) => Number(v).toLocaleString(locale(), { style: 'currency', currency: cur, maximumFractionDigits: 2 });
    const parseNum = v => {
        const s = String(v || '').trim().replace(/\s/g, '');
        if (!s) return NaN;
        // Aceita "1.234,56" (pt) e "1,234.56" (en).
        const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
        const norm = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        return Number(norm);
    };
    const fmtNum = (v, digits) => Number(v).toLocaleString(locale(), { maximumFractionDigits: digits, useGrouping: false });

    function syncRates() {
        const q = CSC.rates.current();
        if (!q) return;
        const eth = ratesDriver === 'eth' ? parseNum(ratesEl.eth.value)
            : ratesDriver === 'brl' ? parseNum(ratesEl.brl.value) / q.brl
            : ratesDriver === 'usd' ? parseNum(ratesEl.usd.value) / q.usd
            : parseNum(ratesEl.btc.value) / q.btc;
        if (!Number.isFinite(eth)) return;
        if (ratesDriver !== 'eth') ratesEl.eth.value = fmtNum(eth, 8);
        if (ratesDriver !== 'brl') ratesEl.brl.value = fmtNum(eth * q.brl, 2);
        if (ratesDriver !== 'usd') ratesEl.usd.value = fmtNum(eth * q.usd, 2);
        if (ratesDriver !== 'btc') ratesEl.btc.value = q.btc ? fmtNum(eth * q.btc, 8) : '—';
    }

    function renderRates() {
        const q = CSC.rates.current();
        const err = CSC.rates.error();
        if (!q) {
            ratesEl.status.textContent = ratesEl.panel.open ? (err ? '—' : t('ratesLoading')) : t('ratesClosed');
            ratesEl.info.textContent = err ? t('ratesError', { msg: err }) : (ratesEl.panel.open ? t('ratesLoading') : '');
            return;
        }
        ratesEl.status.textContent = t('ratesStatus', { brl: fmtMoney(q.brl, 'BRL'), usd: fmtMoney(q.usd, 'USD'), btc: q.btc ? fmtNum(q.btc, 6) + ' BTC' : '—' });
        const time = new Date(q.fetched).toLocaleTimeString(locale());
        const g = CSC.rates.gasInfo();
        ratesEl.info.textContent = t('ratesInfo', { source: q.source, kind: q.source === 'CoinGecko' ? t('ratesKindAgg') : t('ratesKindEx'), time })
            + (g ? ' ' + t('gasPriceInfo', { gwei: (Number(g.wei) / 1e9).toLocaleString(locale(), { maximumFractionDigits: 3 }), source: g.source }) : '')
            + (CSC.rates.isStale() ? ' ' + t('ratesStale') : '') + (err ? ' ' + t('ratesError', { msg: err }) : '');
        syncRates();
        CSC.lab.rerender && state.ratesRerenderLab && CSC.lab.rerender();
    }

    CSC.rates.subscribe(renderRates);
    ratesEl.panel.addEventListener('toggle', () => {
        if (ratesEl.panel.open) CSC.rates.hold(); else CSC.rates.release();
        renderRates();
    });
    ['eth', 'brl', 'usd', 'btc'].forEach(k => ratesEl[k].addEventListener('input', () => { ratesDriver = k; syncRates(); }));
    $('ratesRefresh').addEventListener('click', () => { CSC.rates.refresh(); renderRates(); });
    $('ratesUseScale').addEventListener('click', () => {
        const q = CSC.rates.current();
        if (!q) return flash(el.keyFeedback, t('ratesNeedQuote')) || showNotice(t('ratesNeedQuote'));
        const brl = Math.round(q.brl * 100) / 100;
        const model = CSC.composer.model();
        if (model) {
            model.scale = brl;
            model.cotacao = { brl, fonte: q.source, data: new Date(q.fetched).toISOString() };
            CSC.composer.render();
            onComposerChange(model);
        }
        state.template.scale = brl;
        $('scaleInput').value = String(brl);
        showNotice(t('ratesApplied', { brl: brl.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
        saveDraft();
    });

    // ---------- Tutoriais guiados ----------
    const L = (pt, en) => (CSC.lang === 'en' ? en : pt);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function waitFor(fn, timeout) {
        const start = Date.now();
        while (Date.now() - start < (timeout || 30000)) { if (fn()) return true; await sleep(150); }
        return false;
    }
    function setMode(mode) {
        state.mode = mode;
        store.set('localStorage', MODE_KEY, mode);
        applyMode();
    }
    async function ensureBlocksCode() {
        setMode('blocks');
        const model = CSC.composer.model();
        if (!model || !model.blocks.length || CSC.blocks.validate(model).length) CSC.composer.load(CSC.blocks.preset('locacao', CSC.lang));
        const cur = state.history[state.index];
        if (!cur || cur.origin !== 'blocks' || !state.templatePlan) await generateFromBlocks();
        await waitFor(() => !state.busy, 120000);
    }
    const $q = sel => document.querySelector(sel);

    function tour1() {
        CSC.tour.start([
            { target: () => $('modeBlocks').closest('.mode-option'), before: () => setMode('blocks'),
                title: L('Escolha o modo "Montar contrato"', 'Choose "Build a contract"'),
                text: L('Neste modo, você monta o contrato cláusula por cláusula, sem IA. Cada cláusula é um bloco revisado e testado.', 'In this mode you build the contract clause by clause, without AI. Each clause is a reviewed, tested block.') },
            { target: '#docPresets', before: () => { const m = CSC.composer.model(); if (!m || !m.blocks.length) CSC.composer.load(CSC.blocks.preset('locacao', CSC.lang)); },
                title: L('Comece de um exemplo', 'Start from an example'),
                text: L('Escolha aqui um contrato pronto para servir de base (locação, compra parcelada, serviços...). Já deixamos um exemplo carregado abaixo.', 'Pick a ready-made contract as a starting point (lease, installment sale, services...). An example is already loaded below.') },
            { target: () => $q('#docBody .clause:not(.clause-parties):not(.clause-final)'),
                title: L('Edite o texto livremente', 'Edit the text freely'),
                text: L('Clique em qualquer parte do texto para reescrevê-lo. Os trechos destacados (partes, valores e prazos) são os que o código executa; altere-os nos próprios campos.', 'Click anywhere in the text to rewrite it. The highlighted parts (parties, amounts, deadlines) are what the code executes; change them in the fields themselves.') },
            { target: '.add-clause',
                title: L('Acrescente cláusulas', 'Add clauses'),
                text: L('Inclua pagamentos, multa e juros, garantias, rescisão, vigência, cláusulas livres ou blocos que você salvou em "Meus blocos". As setas reordenam e o × remove.', 'Add payments, late fees, guarantees, termination, term, free clauses or blocks you saved in "My blocks". Arrows reorder and × removes.') },
            { target: '#docIssues',
                title: L('Pendências e avisos', 'Issues and warnings'),
                text: L('Aqui aparecem os problemas do contrato (por exemplo, a mesma parte como devedora e credora) e os valores escritos fora das lacunas, que não serão executados.', 'Contract problems (e.g. the same party as debtor and creditor) and amounts written outside the blanks, which will not be executed, appear here.') },
            { target: '#blocksGenerateButton',
                title: L('Gere o "smart contract"', 'Generate the smart contract'),
                text: L('Ao clicar em "Próximo", o código será gerado a partir do contrato. Depois disso, ele acompanha automaticamente as alterações que você fizer no texto.', 'When you click "Next", the code is generated from the contract. After that, it automatically follows your changes.') },
            { target: '#solidityCode', before: ensureBlocksCode,
                title: L('O código por trás do contrato', 'The code behind the contract'),
                text: L('Este é o código Solidity. Cada seção traz, em comentário, a cláusula que implementa. Você pode copiá-lo, baixá-lo ou abri-lo no Remix.', 'This is the Solidity code. Each section quotes, as a comment, the clause it implements. You can copy it, download it or open it in Remix.') },
            { target: '#securitySection',
                title: L('Verificação de segurança', 'Security check'),
                text: L('O verificador aponta padrões perigosos, e o compilador oficial confirma que o código compila. Nos modelos e blocos revisados, não deve haver achados relevantes.', 'The checker flags dangerous patterns and the official compiler confirms the code compiles. Reviewed templates and blocks should show no relevant findings.') },
            { target: '#labTemplateTestsButton',
                title: L('Teste o contrato', 'Test the contract'),
                text: L('Ao clicar em "Próximo", os testes predefinidos serão executados numa "blockchain" simulada: fluxos normais, tentativas de ataque e conferência de solvência.', 'When you click "Next", the predefined tests run on a simulated blockchain: normal flows, attack attempts and a solvency check.') },
            { target: '#labScenariosPanel', before: async () => { if ($('labScenariosPanel').hidden) { await runTemplateTests(); await waitFor(() => !state.busy, 120000); } },
                title: L('Resultado dos testes', 'Test results'),
                text: L('Cada cenário mostra os passos, o resultado e a explicação. Se algo falhar depois de você editar o contrato, o placar indica o problema. Próximo tutorial: testar na prática, como cada parte.', 'Each scenario shows its steps, result and explanation. If something fails after you edit the contract, the score shows the problem. Next tutorial: hands-on testing as each party.') }
        ]);
    }

    function tour2() {
        CSC.tour.start([
            { target: '#labStartButton', before: ensureBlocksCode,
                title: L('Implante o contrato no Laboratório', 'Deploy the contract to the Lab'),
                text: L('O Laboratório é uma "blockchain" que roda só no seu navegador: sem carteira, sem custo e sem risco. Cada parte recebe uma conta fictícia, e há sempre um "Atacante".', 'The Lab is a blockchain running only in your browser: no wallet, no cost, no risk. Each party gets a fictitious account, and there is always an "Attacker".') },
            { target: '#labDeployForm', before: async () => { await labStart(); await waitFor(() => !$('labDeployForm').hidden, 60000); },
                title: L('Implantação', 'Deployment'),
                text: L('Aqui ficam as contas e quem implanta o contrato. Ao clicar em "Próximo", o contrato será implantado.', 'Here are the accounts and who deploys the contract. When you click "Next", the contract is deployed.') },
            { target: '#labAccounts', before: async () => { const b = $q('#labDeployForm .btn-ink'); if (b && $('labWorkspace').hidden) b.click(); await waitFor(() => !$('labWorkspace').hidden, 30000); },
                title: L('Contas e saldos', 'Accounts and balances'),
                text: L('Cada parte começa com Ether de teste. Os saldos mudam a cada pagamento e saque. Se você consultou a cotação no topo da página, aparece o equivalente em reais.', 'Each party starts with test Ether. Balances change with every payment and withdrawal. If you checked the price at the top, the BRL equivalent is shown.') },
            { target: () => $q('.fn-card'),
                title: L('Funções do contrato', 'Contract functions'),
                text: L('Escolha em "Como" quem chama a função e clique em "Executar". Funções "payable" recebem Ether: informe o valor no campo ao lado.', 'Choose in "As" who calls the function and click "Run". "payable" functions receive Ether: enter the amount next to it.') },
            { target: () => $q('.fn-card .info-btn'),
                title: L('O botão "i"', 'The "i" button'),
                text: L('Explica cada função: a cláusula que ela implementa, quem pode chamá-la, quando e por quais motivos pode ser recusada.', 'Explains each function: the clause it implements, who can call it, when, and why it may be rejected.') },
            { target: '.clock-buttons',
                title: L('Avance o tempo', 'Move time forward'),
                text: L('Use estes botões para simular a passagem do tempo e testar atrasos, multas, juros, prazos de garantia e vencimento antecipado.', 'Use these buttons to simulate time passing and test delays, fees, interest, guarantee deadlines and acceleration.') },
            { target: '#labTimelinePanel',
                title: L('Registro de transações', 'Transaction log'),
                text: L('Cada operação fica registrada: quem fez, o que fez, o valor, os eventos e, se recusada, o motivo. Experimente agir como "Atacante" e veja a recusa.', 'Every operation is recorded: who, what, amount, events and, if rejected, why. Try acting as the "Attacker" and watch it get rejected.') }
        ]);
    }

    function tour3() {
        CSC.tour.start([
            { target: '#settingsPanel', before: () => { $('settingsPanel').open = true; },
                title: L('Chave da API (opcional)', 'API key (optional)'),
                text: L('Para usar a IA, obtenha uma chave gratuita no Google AI Studio (link no painel), cole-a aqui e clique em "Salvar chave". Sem chave, todo o resto funciona.', 'To use AI, get a free key at Google AI Studio (link in the panel), paste it here and click "Save key". Without a key, everything else works.') },
            { target: '#aiParams',
                title: L('Parâmetros da IA', 'AI parameters'),
                text: L('O modelo leve sugerido tem a maior cota gratuita. Temperatura baixa deixa o código mais previsível; 2 ou 3 rodadas de autocorreção ajudam modelos leves.', 'The suggested lightweight model has the largest free quota. Low temperature makes code more predictable; 2 or 3 self-correction rounds help lightweight models.') },
            { target: () => ($('adaptRow').hidden ? $('blocksGenerateButton') : $('adaptRow')),
                title: L('Adaptar o contrato com IA', 'Adapt the contract with AI'),
                text: L('Depois de gerar o código pelo contrato montado, a IA pode acrescentar o que a sua cláusula prevê e os blocos não cobrem. Os testes predefinidos são repetidos automaticamente.', 'After generating the code from the composed contract, the AI can add what your clause requires and the blocks do not cover. Predefined tests run again automatically.') },
            { target: '.complementary',
                title: L('Análises complementares', 'Complementary analyses'),
                text: L('Peça à IA uma análise de riscos ou sugestões de cláusulas. No modo "Montar contrato", ela analisa o próprio contrato montado.', 'Ask the AI for a risk analysis or clause suggestions. In "Build a contract" mode, it analyzes the composed contract.') },
            { target: () => $('modeAI').closest('.mode-option'),
                title: L('Texto livre', 'Free text'),
                text: L('Para cláusulas fora dos blocos, use este modo: a IA redige o contrato, e o aplicativo verifica, compila e corrige automaticamente.', 'For clauses outside the blocks, use this mode: the AI drafts the contract and the app checks, compiles and fixes it automatically.') }
        ]);
    }

    $('tour1Button').addEventListener('click', () => { $('guidePanel').open = false; tour1(); });
    $('tour2Button').addEventListener('click', () => { $('guidePanel').open = false; tour2(); });
    $('tour3Button').addEventListener('click', () => { $('guidePanel').open = false; tour3(); });
    if (!store.get('localStorage', 'csc.guideSeen')) { $('guidePanel').open = true; store.set('localStorage', 'csc.guideSeen', '1'); }

    // ---------- Contador de requisições ----------
    function renderRequestCount(n) {
        const c = $('requestCount');
        if (c) c.textContent = t('requestsCount', { n });
    }
    CSC.gemini.stats.listeners.push(renderRequestCount);

    // ---------- Inicialização ----------
    CSC.SecurityScanCompat = window.SecurityScan;
    CSC.lab.init({
        status: $('labStatus'), deployForm: $('labDeployForm'), workspace: $('labWorkspace'),
        accounts: $('labAccounts'), state: $('labState'), functions: $('labFunctions'), timeline: $('labTimelinePanel'),
        scenarios: $('labScenarioResults'), scenarioActions: $('labScenarioActions'), fixFromTests: $('labFixFromTestsButton')
    });
    CSC.composer.init({
        doc: $('docBody'), title: $('docTitle'), presets: $('docPresets'), issues: $('docIssues'),
        save: $('docSave'), open: $('docOpen'), openFile: $('docOpenFile'),
        generate: $('blocksGenerateButton'), notice: text => flash(el.toolbarFeedback, text) || showNotice(text)
    }, onComposerChange);
    loadKey();
    renderSettings();
    loadDraft();
    CSC.composer.load(state.draftComposer || CSC.blocks.preset('locacao', CSC.lang));
    applyMode();
    if (!state.template.status || !Object.keys(state.template.status).length) runExtraction();
    applyLanguage();
    renderRequestCount(CSC.gemini.stats.requests);
    runScan();
    if (el.apiKey.value) refreshModels();
})();
