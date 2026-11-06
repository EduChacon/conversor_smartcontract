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

    // ---------- Estado ----------
    const state = {
        theme: store.get('localStorage', 'theme') || 'dark',
        settings: Object.assign({}, DEFAULT_SETTINGS, safeJson(store.get('localStorage', SETTINGS_KEY))),
        history: [],        // [{ code, origin }]
        index: -1,
        busy: false,
        findings: [],
        compile: null,      // { code, result | error }
        optimization: '',
        outputs: {},        // textos das análises, para o relatório
        mapping: null
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
        el.language.textContent = t('languageToggle');
        el.toggleKey.textContent = el.apiKey.type === 'password' ? t('showKey') : t('hideKey');
        el.compileTitle.textContent = t('compileTitle', { v: CSC.config.SOLC_VERSION });
        renderExamples();
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
    }

    async function askAI(request) {
        const apiKey = el.apiKey.value.trim();
        if (!apiKey) {
            const e = new Error('no key');
            e.code = 'no-key';
            throw e;
        }
        const res = await CSC.gemini.generate({
            apiKey,
            model: state.settings.model,
            system: request.system,
            user: request.user,
            kind: request.kind,
            schema: request.schema,
            temperature: request.kind === 'text' ? Math.max(0.3, state.settings.temperature) : state.settings.temperature
        });
        if (request.kind === 'json') {
            try {
                return { data: JSON.parse(res.text), truncated: res.truncated };
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
            showError(err && err.code === 'no-key' ? t('errNoKey') : errorMessage(err));
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

    function onCodeChanged() {
        saveDraft();
        updateCodeUI();
        runScan();
        renderCompile();
        if (state.compile && state.compile.code !== currentCode() && state.settings.autoCompile && CSC.compiler.isLoaded()) {
            scheduleCompile();
        }
    }

    function originLabel(origin) {
        return t({ generated: 'originGenerated', optimized: 'originOptimized', refined: 'originRefined', fixed: 'originFixed', autofixed: 'originAutoFixed', manual: 'originManual' }[origin] || 'originManual');
    }

    function updateCodeUI() {
        const hasCode = !!currentCode().trim();
        el.warning.hidden = !hasCode;
        el.securitySection.hidden = !hasCode;
        el.labSection.hidden = !hasCode;
        el.improveSection.hidden = !hasCode;
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
        store.set('sessionStorage', DRAFT_KEY, JSON.stringify({ clause: el.clause.value, history: state.history.slice(-20), index: Math.min(state.index, 19) }));
    }
    function loadDraft() {
        const d = safeJson(store.get('sessionStorage', DRAFT_KEY));
        if (d.clause) el.clause.value = d.clause;
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
            el.compileStatus.className = 'compile-status status-error';
            el.compileStatus.textContent = t('compileUnavailable');
            return;
        }
        const errors = compileErrors(c);
        const warnings = c.result.errors.filter(e => e.severity === 'warning');
        el.compileStatus.className = 'compile-status ' + (errors.length ? 'status-error' : warnings.length ? 'status-warn' : 'status-ok');
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
            el.pipelineSummary.className = 'pipeline-summary status-ok';
            el.pipelineSummary.textContent = '✓ ' + t('pipelineClean', { n: fixesDone, compiled: compiled ? t('pipelineCompiledSuffix') : '' });
        } else {
            el.pipelineSummary.className = 'pipeline-summary status-warn';
            el.pipelineSummary.textContent = t('pipelineRemaining', { n: fixesDone, e: errorsLeft, h: highLeft });
        }
    }

    function resetDerivedOutputs() {
        ['riskAnalysisOutputContainer', 'suggestClausesOutputContainer', 'explanationOutputContainer', 'optimizationOutputContainer',
            'securityReviewOutputContainer', 'codeQueryOutputContainer', 'mappingOutputContainer', 'labScenariosPanel'].forEach(id => { $(id).hidden = true; });
        $('applyOptimizationButton').hidden = true;
        state.outputs = {};
        state.mapping = null;
        state.optimization = '';
        el.pipelineSummary.hidden = true;
        CSC.lab.reset();
    }

    async function generate() {
        const clause = el.clause.value.trim();
        if (!clause) return showError(t('errNoClause'));
        await runTask('convertLoadingIndicator', async () => {
            el.convertProgress.textContent = t('stepGenerating');
            const res = await askAI(CSC.prompts.generate(clause, CSC.lang));
            resetDerivedOutputs();
            setCode(res.code, 'generated');
            await verifyAndFix(el.convertProgress);
            el.code.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    /** Aplica nova versão vinda da IA e roda o ciclo de verificação. */
    async function applyAICode(request, origin, loadingId, progressId) {
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

    async function labStart() {
        if (state.busy) return;
        setBusy(true);
        try {
            const c = await compiledForLab();
            if (!c) return;
            const chosen = CSC.lab.pickContract(c.result.contracts);
            if (!chosen) return CSC.lab.setStatus(t('labNoDeployable'), 'error');
            CSC.lab.setStatus('', '');
            CSC.lab.prepare(Object.assign({ source: currentCode() }, chosen));
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
                const res = await askAI(CSC.prompts.scenarios(el.clause.value.trim(), currentCode(), CSC.lab.abiSummary(chosenDefault.abi), CSC.lang));
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
        lines.push('- ' + t('reportModel') + ': ' + state.settings.model + ' (temperatura ' + state.settings.temperature + ')');
        lines.push('- solc: ' + CSC.config.SOLC_VERSION, '');
        lines.push('> ' + t('reportDisclaimer'), '');
        if (el.clause.value.trim()) lines.push('## ' + t('reportClause'), '', el.clause.value.trim().split('\n').map(l => '> ' + l).join('\n'), '');
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
    el.saveKey.addEventListener('click', saveKey);
    el.forgetKey.addEventListener('click', forgetKey);
    el.apiKey.addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });

    el.model.addEventListener('change', () => { state.settings.model = el.model.value; saveSettings(); });
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
        if (ex) { el.clause.value = ex.text; saveDraft(); }
    });
    el.clause.addEventListener('input', () => { clearTimeout(el.clause._t); el.clause._t = setTimeout(saveDraft, 400); });

    $('convertButton').addEventListener('click', generate);

    $('analyzeRiskButton').addEventListener('click', () => {
        const clause = el.clause.value.trim();
        if (!clause) return showError(t('errNoClause'));
        runTask('riskLoadingIndicator', async () => {
            const res = await askAI(CSC.prompts.risk(clause, CSC.lang));
            showMarkdown('riskAnalysisOutputContainer', 'riskAnalysisOutput', res.text, 'risk');
        });
    });

    $('suggestClausesButton').addEventListener('click', () => {
        const clause = el.clause.value.trim();
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
    $('reportButton').addEventListener('click', report);
    $('reportButton2').addEventListener('click', report);

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
            const res = await askAI(CSC.prompts.explain(code, el.clause.value.trim(), CSC.lang));
            showMarkdown('explanationOutputContainer', 'explanationOutput', res.text, 'explain');
        });
    });

    $('mappingButton').addEventListener('click', () => {
        const code = currentCode();
        const clause = el.clause.value.trim();
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

    // ---------- Inicialização ----------
    CSC.SecurityScanCompat = window.SecurityScan;
    CSC.lab.init({
        status: $('labStatus'), deployForm: $('labDeployForm'), workspace: $('labWorkspace'),
        accounts: $('labAccounts'), state: $('labState'), functions: $('labFunctions'), timeline: $('labTimelinePanel'),
        scenarios: $('labScenarioResults'), scenarioActions: $('labScenarioActions'), fixFromTests: $('labFixFromTestsButton')
    });
    loadKey();
    renderSettings();
    loadDraft();
    applyLanguage();
    runScan();
    if (el.apiKey.value) refreshModels();
})();
