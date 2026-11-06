/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Montador de contrato: interface em forma de documento. Cada cláusula é um
 * bloco com lacunas editáveis no próprio texto; por trás, o motor de blocos
 * (blocks.js) gera o código Solidity.
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});
    const t = (k, v) => CSC.t(k, v);
    const B = () => CSC.blocks;
    const MY_KEY = 'csc.myBlocks';

    Object.assign(CSC.texts.pt, {
        modeBlocks: 'Montar contrato',
        modeBlocksSub: 'cláusulas em blocos · sem IA',
        modeBlocksHelp: 'Monte o contrato cláusula por cláusula. Preencha as lacunas no próprio texto; por trás, cada cláusula vira código Solidity revisado e testado.',
        modeTemplate: 'Modelos prontos',
        modeTemplateSub: 'para testar rapidamente · sem IA',
        docStart: 'Começar de um exemplo...',
        docBlank: 'Contrato em branco',
        docTitlePlaceholder: 'Título do contrato',
        partiesTitle: 'Partes',
        partiesIntro: 'Figuram neste contrato:',
        partiesOutro: ', cada qual identificado por seu endereço na "blockchain", informado na implantação.',
        addParty: '+ parte',
        removeParty: 'Remover parte',
        partyName: 'Nome da parte',
        newParty: 'Parte',
        addClause: '+ Acrescentar cláusula',
        closePalette: 'Fechar',
        myBlocks: 'Meus blocos',
        myBlocksEmpty: 'Nenhum bloco salvo ainda. Use "Salvar como meu bloco" numa cláusula.',
        saveMyBlock: 'Salvar como meu bloco',
        savedMyBlock: 'Bloco salvo em "Meus blocos".',
        deleteMyBlock: 'Excluir',
        exportMyBlocks: 'Exportar meus blocos',
        importMyBlocks: 'Importar blocos',
        importDone: '{n} bloco(s) importado(s).',
        importFailed: 'Arquivo inválido.',
        editWording: 'Redação',
        wordingHelp: 'Altere a redação livremente, mantendo as lacunas: {slots}.',
        wordingFreeHelp: 'Escreva a cláusula livremente. Ela integra o contrato, mas não é executada pelo código.',
        restoreWording: 'Restaurar redação padrão',
        moveUp: 'Subir',
        moveDown: 'Descer',
        removeClause: 'Remover cláusula',
        clauseName: 'Nome da cláusula',
        anyParty: 'Qualquer das partes',
        chooseBlock: '— escolha —',
        docIssues: 'Pendências do contrato',
        docOk: 'Contrato completo: pode ser convertido.',
        blocksGenerate: 'Gerar o "smart contract"',
        blocksGenerated: 'Código gerado a partir do contrato montado, sem IA. Verificador: {scan}. Compilação: {compile}.',
        blocksLive: 'O código acompanha as alterações do contrato.',
        originBlocks: 'gerada pelo contrato montado',
        finalClauseTitle: 'Pagamentos e saques',
        declarative: 'não executada pelo código',
        docWarnings: 'Atenção',
        looseValues: 'Na cláusula "{clause}", o texto menciona {values} fora das lacunas destacadas: esses valores constam da redação, mas não serão executados pelo código.',
        editHint: 'Clique no texto para editá-lo livremente. Os trechos destacados são executados pelo código; o restante é apenas redação.'
    });
    Object.assign(CSC.texts.en, {
        modeBlocks: 'Build a contract',
        modeBlocksSub: 'clauses as blocks · no AI',
        modeBlocksHelp: 'Build the contract clause by clause. Fill in the blanks right in the text; behind the scenes, each clause becomes reviewed and tested Solidity code.',
        modeTemplate: 'Ready-made templates',
        modeTemplateSub: 'for a quick test · no AI',
        docStart: 'Start from an example...',
        docBlank: 'Blank contract',
        docTitlePlaceholder: 'Contract title',
        partiesTitle: 'Parties',
        partiesIntro: 'The parties to this contract are:',
        partiesOutro: ', each identified by their blockchain address, given at deployment.',
        addParty: '+ party',
        removeParty: 'Remove party',
        partyName: 'Party name',
        newParty: 'Party',
        addClause: '+ Add clause',
        closePalette: 'Close',
        myBlocks: 'My blocks',
        myBlocksEmpty: 'No saved blocks yet. Use "Save as my block" on a clause.',
        saveMyBlock: 'Save as my block',
        savedMyBlock: 'Block saved to "My blocks".',
        deleteMyBlock: 'Delete',
        exportMyBlocks: 'Export my blocks',
        importMyBlocks: 'Import blocks',
        importDone: '{n} block(s) imported.',
        importFailed: 'Invalid file.',
        editWording: 'Wording',
        wordingHelp: 'Change the wording freely, keeping the blanks: {slots}.',
        wordingFreeHelp: 'Write the clause freely. It is part of the contract but is not executed by the code.',
        restoreWording: 'Restore default wording',
        moveUp: 'Move up',
        moveDown: 'Move down',
        removeClause: 'Remove clause',
        clauseName: 'Clause name',
        anyParty: 'Either party',
        chooseBlock: '— choose —',
        docIssues: 'Pending issues',
        docOk: 'Contract complete: ready to convert.',
        blocksGenerate: 'Generate the smart contract',
        blocksGenerated: 'Code generated from the composed contract, without AI. Checker: {scan}. Compilation: {compile}.',
        blocksLive: 'The code follows changes to the contract.',
        originBlocks: 'generated from the composed contract',
        finalClauseTitle: 'Payments and withdrawals',
        declarative: 'not executed by the code',
        docWarnings: 'Attention',
        looseValues: 'In clause "{clause}", the text mentions {values} outside the highlighted blanks: these values are part of the wording but will not be executed by the code.',
        editHint: 'Click the text to edit it freely. Highlighted parts are executed by the code; the rest is wording only.'
    });

    const state = { model: null, dom: null, onChange: null, openWording: new Set(), paletteOpen: false };

    function el(tag, attrs, children) {
        const n = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (v == null || v === false) continue;
            if (k === 'class') n.className = v;
            else if (k === 'text') n.textContent = v;
            else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
            else if (k === 'value') n.value = v;
            else n.setAttribute(k, v === true ? '' : v);
        }
        for (const c of [].concat(children || [])) if (c != null && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        return n;
    }

    const store = {
        get() { try { return JSON.parse(localStorage.getItem(MY_KEY) || '[]'); } catch (_) { return []; } },
        set(v) { try { localStorage.setItem(MY_KEY, JSON.stringify(v)); } catch (_) { /* indisponível */ } }
    };

    function changed(structural) {
        if (structural) render();
        else renderIssues();
        if (state.onChange) state.onChange(state.model);
    }

    function newPartyId() {
        let i = state.model.roles.length + 1;
        while (state.model.roles.some(r => r.id === 'p' + i)) i++;
        return 'p' + i;
    }

    // ---------- Lacunas (widgets no texto) ----------
    function widget(block, p) {
        const v = block.params[p.key];
        const set = (val, structural) => { block.params[p.key] = val; changed(structural); };
        if (p.kind === 'role' || p.kind === 'roleOrAny') {
            const sel = el('select', { class: 'blank blank-role', 'aria-label': B().fieldLabel(p.key, CSC.lang), onchange: e => {
                const clause = e.target.closest('.clause-text');
                if (clause) clause.querySelectorAll('.chip[data-slot="' + p.key + '"] select').forEach(o => { o.value = e.target.value; });
                set(e.target.value, false);
            } });
            if (p.kind === 'roleOrAny') sel.appendChild(el('option', { value: '*', text: t('anyParty') }));
            for (const r of state.model.roles) sel.appendChild(el('option', { value: r.id, text: r.label }));
            sel.value = v;
            return sel;
        }
        if (p.kind === 'ref') {
            const sel = el('select', { class: 'blank blank-ref', 'aria-label': B().fieldLabel(p.key, CSC.lang), onchange: e => set(e.target.value, true) });
            sel.appendChild(el('option', { value: '', text: t('chooseBlock') }));
            for (const b of state.model.blocks.filter(x => p.accepts.includes(x.type))) sel.appendChild(el('option', { value: b.uid, text: b.label }));
            sel.value = v || '';
            return sel;
        }
        const input = el('input', {
            class: 'blank blank-' + p.kind, type: 'text', inputmode: 'decimal', 'aria-label': B().fieldLabel(p.key, CSC.lang), value: String(v),
            size: String(Math.max(2, String(v).length + (p.kind === 'money' ? 2 : 1))),
            oninput: e => {
                e.target.size = Math.max(2, e.target.value.length + 1);
                const raw = String(e.target.value).replace(/[%\sR$]/g, '');
                const n = Number(raw.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
                // Lacunas repetidas na mesma cláusula (ex.: o mesmo prazo citado duas vezes) andam juntas.
                const clause = e.target.closest('.clause-text');
                if (clause) clause.querySelectorAll('.chip[data-slot="' + p.key + '"] input').forEach(other => { if (other !== e.target) { other.value = e.target.value; other.size = e.target.size; } });
                set(Number.isFinite(n) && e.target.value.trim() !== '' ? n : e.target.value, false);
            }
        });
        if (p.kind === 'money') return el('span', { class: 'blank-wrap' }, ['R$ ', input]);
        if (p.kind === 'percent') return el('span', { class: 'blank-wrap' }, [input, '%']);
        return input;
    }

    /** Lê o texto editado, convertendo cada lacuna de volta em {chave}. */
    function serialize(node) {
        let out = '';
        node.childNodes.forEach(ch => {
            if (ch.nodeType === 3) out += ch.textContent;
            else if (ch.nodeType === 1) {
                if (ch.dataset && ch.dataset.slot) out += '{' + ch.dataset.slot + '}';
                else if (ch.tagName === 'BR') out += ' ';
                else out += serialize(ch);
            }
        });
        return out;
    }

    function sentenceNode(block) {
        const def = B().BLOCKS[block.type];
        const lang = CSC.lang;
        const text = block.texto && String(block.texto).trim() ? block.texto : def.sentence[lang === 'en' ? 'en' : 'pt'];
        // Texto livremente editável; as lacunas são peças não editáveis com os campos.
        const p = el('p', { class: 'clause-text', contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true' });
        if (def.declarative) {
            p.textContent = text;
        } else {
            const parts = String(text).split(/(\{\w+\})/);
            for (const part of parts) {
                const m = /^\{(\w+)\}$/.exec(part);
                const param = m && def.params.find(x => x.key === m[1]);
                if (param) p.appendChild(el('span', { class: 'chip', contenteditable: 'false', 'data-slot': param.key }, [widget(block, param)]));
                else if (part) p.appendChild(document.createTextNode(part));
            }
        }
        p.addEventListener('input', () => {
            block.texto = serialize(p).replace(/\s+/g, ' ').trim();
            changed(false);
        });
        // Colagem apenas como texto simples (evita formatação e código estranho).
        p.addEventListener('paste', e => {
            e.preventDefault();
            const plain = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' ');
            document.execCommand('insertText', false, plain);
        });
        p.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        return p;
    }

    /** Valores mencionados no texto fora das lacunas (não serão executados). */
    function looseValues(block) {
        const def = B().BLOCKS[block.type];
        if (def.declarative || !block.texto) return [];
        const plain = String(block.texto).replace(/\{\w+\}/g, ' ');
        const found = plain.match(/(R\$|US\$|\$)\s*\d[\d.,]*|\d+(?:[.,]\d+)?\s*%|\d+\s*(?:dias?|days?|meses|months?|parcelas|installments?)/gi);
        return found || [];
    }

    // ---------- Cláusulas ----------
    function clauseNode(block, index) {
        const def = B().BLOCKS[block.type];
        const lang = CSC.lang;
        const typeName = def.name[lang === 'en' ? 'en' : 'pt'];
        const move = d => () => {
            const arr = state.model.blocks;
            const i = arr.indexOf(block);
            const j = i + d;
            if (j < 0 || j >= arr.length) return;
            arr.splice(i, 1);
            arr.splice(j, 0, block);
            changed(true);
        };
        const target = def.attached ? state.model.blocks.find(x => x.uid === block.params.alvo) : null;
        const titleNodes = def.single || def.attached
            ? [el('span', { class: 'clause-title', text: typeName + (target ? ' (' + target.label + ')' : '') })]
            : [el('input', { class: 'clause-name', type: 'text', value: block.label, 'aria-label': t('clauseName'),
                size: String(Math.max(6, block.label.length + 1)),
                oninput: e => { e.target.size = Math.max(6, e.target.value.length + 1); block.label = e.target.value; changed(false); },
                onchange: () => changed(true) }),
            B().names.pascal(block.label) === B().names.pascal(typeName) ? null : el('span', { class: 'clause-kind', text: '(' + typeName.toLowerCase() + ')' })];
        const tools = el('span', { class: 'clause-tools' }, [
            block.texto && !def.declarative ? el('button', { type: 'button', class: 'link-btn', text: t('restoreWording'), onclick: () => { delete block.texto; changed(true); } }) : null,
            el('button', { type: 'button', class: 'link-btn', text: t('saveMyBlock'), onclick: () => saveMine(block) }),
            el('button', { type: 'button', class: 'icon-btn', title: t('moveUp'), 'aria-label': t('moveUp'), text: '↑', onclick: move(-1) }),
            el('button', { type: 'button', class: 'icon-btn', title: t('moveDown'), 'aria-label': t('moveDown'), text: '↓', onclick: move(1) }),
            el('button', { type: 'button', class: 'icon-btn', title: t('removeClause'), 'aria-label': t('removeClause'), text: '×', onclick: () => {
                state.model.blocks.splice(state.model.blocks.indexOf(block), 1);
                for (const b of state.model.blocks) for (const k of Object.keys(b.params)) if (b.params[k] === block.uid) b.params[k] = '';
                changed(true);
            } })
        ]);
        const li = el('li', { class: 'clause' + (def.declarative ? ' clause-free' : ''), 'data-uid': block.uid }, [
            el('div', { class: 'clause-head' }, [el('span', { class: 'clause-num', text: ordinal(index + 2) }), ' — ', ...titleNodes, def.declarative ? el('span', { class: 'clause-note', text: t('declarative') }) : null, tools]),
            sentenceNode(block)
        ]);
        return li;
    }

    function ordinal(n) { return CSC.lang === 'en' ? 'Clause ' + n : 'Cláusula ' + n + 'ª'; }

    function partiesNode() {
        const roles = state.model.roles;
        const used = id => state.model.blocks.some(b => Object.values(b.params).includes(id));
        const chips = [];
        roles.forEach((r, i) => {
            if (i > 0) chips.push(document.createTextNode(i === roles.length - 1 ? (CSC.lang === 'en' ? ' and ' : ' e ') : ', '));
            const input = el('input', { class: 'blank blank-party', type: 'text', value: r.label, 'aria-label': t('partyName'), size: String(Math.max(4, r.label.length + 1)),
                oninput: e => { e.target.size = Math.max(4, e.target.value.length + 1); r.label = e.target.value; changed(false); },
                onchange: () => changed(true) });
            const rm = roles.length > 2 && !used(r.id)
                ? el('button', { type: 'button', class: 'icon-btn', title: t('removeParty'), 'aria-label': t('removeParty'), text: '×', onclick: () => { roles.splice(roles.indexOf(r), 1); changed(true); } })
                : null;
            chips.push(el('span', { class: 'party' }, [input, rm]));
        });
        const add = roles.length < 6 ? el('button', { type: 'button', class: 'link-btn add-party', text: t('addParty'), onclick: () => {
            roles.push({ id: newPartyId(), label: t('newParty') + ' ' + (roles.length + 1) });
            changed(true);
        } }) : null;
        return el('li', { class: 'clause clause-parties' }, [
            el('div', { class: 'clause-head' }, [el('span', { class: 'clause-num', text: ordinal(1) }), ' — ', el('span', { class: 'clause-title', text: t('partiesTitle') })]),
            el('p', { class: 'clause-text' }, [t('partiesIntro') + ' ', ...chips, t('partiesOutro').startsWith(',') ? t('partiesOutro') : ' ' + t('partiesOutro'), ' ', add])
        ]);
    }

    function finalClauseNode() {
        const n = state.model.blocks.length + 2;
        const scale = el('input', { class: 'blank blank-money', type: 'text', inputmode: 'decimal', value: String(state.model.scale || 1000), size: '6', 'aria-label': 'escala',
            oninput: e => { const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')); if (v > 0) { state.model.scale = v; delete state.model.cotacao; changed(false); } } });
        const q = state.model.cotacao && Number(state.model.cotacao.brl) === Number(state.model.scale) ? state.model.cotacao : null;
        if (q) {
            const when = new Date(q.data).toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            return el('li', { class: 'clause clause-final' }, [
                el('div', { class: 'clause-head' }, [el('span', { class: 'clause-num', text: ordinal(n) }), ' — ', el('span', { class: 'clause-title', text: t('finalClauseTitle') })]),
                el('p', { class: 'clause-text' }, CSC.lang === 'en'
                    ? ['Amounts owed to each party are recorded in the contract and withdrawn by their owner. Amounts in BRL were converted into Ether at R$ ', scale, ' per 1 ETH, obtained on ' + when + ' (source: ' + q.fonte + '); as the price varies, the Ether amount is fixed when the code is generated.']
                    : ['Os valores devidos a cada parte ficam registrados no contrato e são sacados pelo próprio titular. Os valores em reais foram convertidos em Ether à cotação de R$ ', scale, ' por 1 ETH, obtida em ' + when + ' (fonte: ' + q.fonte + '); como a cotação varia, o valor em Ether fica fixado na geração do código.'])
            ]);
        }
        return el('li', { class: 'clause clause-final' }, [
            el('div', { class: 'clause-head' }, [el('span', { class: 'clause-num', text: ordinal(n) }), ' — ', el('span', { class: 'clause-title', text: t('finalClauseTitle') })]),
            el('p', { class: 'clause-text' }, CSC.lang === 'en'
                ? ['Amounts owed to each party are recorded in the contract and withdrawn by their owner. Amounts in BRL are represented in test Ether at R$ ', scale, ' per 1 ETH, a didactic convention, not a quotation.']
                : ['Os valores devidos a cada parte ficam registrados no contrato e são sacados pelo próprio titular. Os valores em reais são representados em Ether de teste à razão de R$ ', scale, ' por 1 ETH, convenção didática que não corresponde a cotação.'])
        ]);
    }

    // ---------- Paleta ----------
    function paletteNode() {
        const lang = CSC.lang === 'en' ? 'en' : 'pt';
        const groups = B().CATEGORIES.map(cat => {
            const items = Object.entries(B().BLOCKS).filter(([, d]) => d.category === cat.id).map(([type, d]) => {
                const disabled = d.single && state.model.blocks.some(b => b.type === type);
                return el('button', { type: 'button', class: 'palette-item', disabled, text: d.name[lang], onclick: () => addBlock(type) });
            });
            return el('div', { class: 'palette-group' }, [el('p', { class: 'field-label', text: cat[lang] }), ...items]);
        });
        const mine = store.get();
        const mineItems = mine.length ? mine.map((m, i) => el('span', { class: 'mine-item' }, [
            el('button', { type: 'button', class: 'palette-item', text: m.label, title: (B().BLOCKS[m.type] || {}).name ? B().BLOCKS[m.type].name[lang] : '', onclick: () => addMine(m) }),
            el('button', { type: 'button', class: 'icon-btn', title: t('deleteMyBlock'), 'aria-label': t('deleteMyBlock'), text: '×', onclick: () => { const all = store.get(); all.splice(i, 1); store.set(all); render(); } })
        ])) : [el('p', { class: 'hint', text: t('myBlocksEmpty') })];
        const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => importMine(e.target.files[0]) });
        return el('div', { class: 'palette' }, [
            ...groups,
            el('div', { class: 'palette-group palette-mine' }, [
                el('p', { class: 'field-label', text: t('myBlocks') }), ...mineItems,
                el('div', { class: 'inline-row' }, [
                    mine.length ? el('button', { type: 'button', class: 'link-btn', text: t('exportMyBlocks'), onclick: exportMine }) : null,
                    el('button', { type: 'button', class: 'link-btn', text: t('importMyBlocks'), onclick: () => fileInput.click() }),
                    fileInput
                ])
            ]),
            el('button', { type: 'button', class: 'link-btn palette-close', text: t('closePalette'), onclick: () => { state.paletteOpen = false; render(); } })
        ]);
    }

    function addBlock(type) {
        const b = B().newBlock(type, state.model.roles, CSC.lang, state.model.blocks);
        state.model.blocks.push(b);
        state.paletteOpen = false;
        changed(true);
        const node = state.dom.doc.querySelector('[data-uid="' + b.uid + '"]');
        if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ---------- Meus blocos ----------
    function saveMine(block) {
        const def = B().BLOCKS[block.type];
        const params = {};
        for (const p of def.params) {
            const v = block.params[p.key];
            if (p.kind === 'role') params[p.key] = { roleIndex: Math.max(0, state.model.roles.findIndex(r => r.id === v)) };
            else if (p.kind === 'ref') params[p.key] = null;
            else params[p.key] = v;
        }
        const all = store.get();
        all.push({ type: block.type, label: block.label, texto: block.texto || null, params });
        store.set(all);
        if (state.dom.notice) state.dom.notice(t('savedMyBlock'));
        render();
    }

    function addMine(m) {
        if (!B().BLOCKS[m.type]) return;
        const b = B().newBlock(m.type, state.model.roles, CSC.lang, state.model.blocks);
        const def = B().BLOCKS[m.type];
        for (const p of def.params) {
            const v = m.params ? m.params[p.key] : undefined;
            if (v == null) continue;
            if (p.kind === 'role') {
                const r = state.model.roles[Math.min(v.roleIndex || 0, state.model.roles.length - 1)];
                if (r) b.params[p.key] = r.id;
            } else if (p.kind !== 'ref') b.params[p.key] = v;
        }
        if (m.texto) b.texto = m.texto;
        if (m.label && !def.single) {
            const taken = new Set(state.model.blocks.map(x => B().names.pascal(x.label)));
            let label = m.label;
            for (let i = 2; taken.has(B().names.pascal(label)); i++) label = m.label + ' ' + i;
            b.label = label;
        }
        state.model.blocks.push(b);
        state.paletteOpen = false;
        changed(true);
    }

    function exportMine() {
        const blob = new Blob([JSON.stringify({ formato: 'conversor-contratual/blocos', versao: 1, blocos: store.get() }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: 'meus-blocos.json' });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function importMine(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                const list = (Array.isArray(data) ? data : data.blocos || []).filter(m => m && B().BLOCKS[m.type] && typeof m.label === 'string')
                    .map(m => ({ type: m.type, label: String(m.label).slice(0, 60), texto: m.texto ? String(m.texto).slice(0, 2000) : null, params: m.params || {} }));
                store.set(store.get().concat(list));
                if (state.dom.notice) state.dom.notice(t('importDone', { n: list.length }));
                render();
            } catch (_) {
                if (state.dom.notice) state.dom.notice(t('importFailed'));
            }
        };
        reader.readAsText(file);
    }

    // ---------- Pendências ----------
    function renderIssues() {
        const box = state.dom.issues;
        box.textContent = '';
        const issues = B().validate(state.model);
        const lang = CSC.lang === 'en' ? 'en' : 'pt';
        state.dom.doc.querySelectorAll('.clause.has-issue').forEach(n => n.classList.remove('has-issue'));
        if (!issues.length) {
            box.appendChild(el('p', { class: 'status-line status-ok', text: t('docOk') }));
        } else {
            box.appendChild(el('p', { class: 'field-label', text: t('docIssues') }));
            const ul = el('ul', { class: 'issues' });
            const seen = new Set();
            for (const i of issues) {
                if (seen.has(i[lang])) continue;
                seen.add(i[lang]);
                ul.appendChild(el('li', { text: i[lang] }));
                if (i.uid) { const n = state.dom.doc.querySelector('[data-uid="' + i.uid + '"]'); if (n) n.classList.add('has-issue'); }
            }
            box.appendChild(ul);
        }
        const warnings = [];
        for (const b of state.model.blocks) {
            const vals = looseValues(b);
            if (vals.length) warnings.push(t('looseValues', { clause: b.label, values: vals.map(v => '"' + v.trim() + '"').join(', ') }));
        }
        if (warnings.length) {
            box.appendChild(el('p', { class: 'field-label', text: t('docWarnings') }));
            box.appendChild(el('ul', { class: 'issues warnings' }, warnings.map(w => el('li', { text: w }))));
        }
        if (state.dom.generate) state.dom.generate.disabled = issues.length > 0;
        return issues;
    }

    // ---------- Renderização ----------
    function render() {
        const d = state.dom;
        const m = state.model;
        d.title.value = m.name || '';
        d.doc.textContent = '';
        d.doc.appendChild(el('p', { class: 'hint doc-hint', text: t('editHint') }));
        const ol = el('ol', { class: 'clauses' });
        ol.appendChild(partiesNode());
        m.blocks.forEach((b, i) => ol.appendChild(clauseNode(b, i)));
        ol.appendChild(finalClauseNode());
        d.doc.appendChild(ol);
        d.doc.appendChild(el('div', { class: 'add-clause' }, [
            el('button', { type: 'button', class: 'btn btn-quiet', text: t('addClause'), 'aria-expanded': state.paletteOpen ? 'true' : 'false', onclick: () => { state.paletteOpen = !state.paletteOpen; render(); } }),
            state.paletteOpen ? paletteNode() : null
        ]));
        renderPresets();
        renderIssues();
    }

    function renderPresets() {
        const sel = state.dom.presets;
        const lang = CSC.lang === 'en' ? 'en' : 'pt';
        sel.textContent = '';
        sel.appendChild(el('option', { value: '', text: t('docStart') }));
        sel.appendChild(el('option', { value: '__blank', text: t('docBlank') }));
        for (const p of B().PRESETS) sel.appendChild(el('option', { value: p.id, text: p[lang] }));
        sel.value = '';
    }

    CSC.composer = {
        init(dom, onChange) {
            state.dom = dom;
            state.onChange = onChange;
            dom.title.addEventListener('input', () => { state.model.name = dom.title.value; changed(false); });
            dom.presets.addEventListener('change', () => {
                const v = dom.presets.value;
                if (!v) return;
                state.model = v === '__blank' ? B().emptyModel(CSC.lang) : B().preset(v, CSC.lang);
                state.openWording.clear();
                changed(true);
            });
        },
        load(model) { state.model = model; render(); },
        model: () => state.model,
        render,
        issues: () => B().validate(state.model)
    };
})();
