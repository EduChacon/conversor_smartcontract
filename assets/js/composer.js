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
        savedMyBlockGroup: 'Bloco salvo em "Meus blocos", com {n} cláusula(s) ligada(s).',
        withLinked: '+{n} ligada(s)',
        builtinPresets: 'Exemplos prontos',
        myModels: 'Meus modelos',
        myModelsCount: 'Meus modelos ({n})',
        myModelsEmpty: 'Nenhum modelo salvo ainda. Monte um contrato e clique em "Salvar como meu modelo"; ele ficará disponível na lista "Começar de um exemplo", para reaproveitar em outros contratos.',
        saveModel: 'Salvar como meu modelo',
        modelSaved: 'Modelo "{name}" salvo. Ele aparece em "Começar de um exemplo" → "Meus modelos".',
        modelReplaced: 'Modelo "{name}" atualizado.',
        modelUse: 'Usar',
        modelDelete: 'Excluir modelo',
        modelDeleteConfirm: 'Excluir o modelo "{name}"?',
        modelsExport: 'Exportar modelos',
        modelsImport: 'Importar modelos',
        modelsImported: '{n} modelo(s) importado(s).',
        modelsHint: 'Os modelos ficam guardados neste navegador. Exporte-os em arquivo para usar em outro computador ou compartilhar. Dados das partes (qualificação e carteiras) não são guardados.',
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
        linkedTo: 'ligada a: {name}',
        replaceConfirm: 'Substituir o contrato atual? As alterações que não foram salvas (em "Salvar contrato" ou "Salvar como meu modelo") serão perdidas.',
        linkedToTitle: 'Ir para a cláusula {name}',
        linkMap: 'Mapa das ligações entre cláusulas',
        linkMapHint: 'Cada cláusula tem uma cor, repetida no código, no Laboratório e nos testes. As cláusulas recuadas dependem da cláusula acima delas.',
        alsoLinked: 'também ligada a',
        partiesData: 'Dados das partes (opcional)',
        partiesDataHelp: 'Qualificação de cada parte, para o documento a ser assinado, e endereço de carteira, para a implantação. A qualificação entra no texto assinado e na sua impressão digital, mas nunca no código publicado na "blockchain". O arquivo do contrato e o relatório ficam com quem os salvar.',
        partyWallet: 'Endereço de carteira',
        partyName: 'Nome completo ou razão social',
        partyDoc: 'CPF, CNPJ ou documento estrangeiro',
        partyAddress: 'Endereço',
        sigHashLabel: 'Impressão digital (SHA-256) do texto do contrato:',
        sigHashHint: 'É o valor que cada signatário confere ao assinar. Ele muda a cada alteração do texto ou da qualificação das partes.',
        sigDownload: 'Baixar o texto do contrato (.txt)',
        sigPdfTitle: 'Assinatura com validade jurídica (gov.br, certificado digital ou serviço estrangeiro)',
        sigPdfSteps: 'a) Gere o PDF em "Imprimir para assinatura (PDF)". b) Assine-o no serviço de sua escolha: no Brasil, gov.br (assinador do ITI) ou certificado ICP-Brasil; no exterior, serviço equivalente (por exemplo, certificado qualificado eIDAS). c) Calcule abaixo a impressão digital do PDF assinado. d) No Laboratório ou na rede, chame registrarDocumento com esse valor antes da primeira assinatura.',
        sigPdfPick: 'Calcular a impressão digital de um PDF assinado',
        sigPdfResult: 'Impressão digital do arquivo "{name}":',
        sigPdfLocal: 'O arquivo é lido apenas no seu navegador; nada é enviado.',
        copy: 'Copiar',
        copied: 'Copiado.',
        legalTitle: 'Conferência jurídica ({n})',
        legalHint: 'Conferência automática e indicativa, com base no direito brasileiro. Não substitui a análise de um profissional.',
        legalWarn: 'Aviso',
        legalNote: 'Lembrete',
        walletInvalid: 'O endereço de carteira de "{name}" não parece válido (deve começar com 0x e ter 42 caracteres).',
        seriesNone: 'Opcional: carregue uma série de dados (por exemplo, o índice mês a mês) para o Laboratório atualizar esta informação automaticamente ao avançar o tempo.',
        seriesSummary: 'Série carregada: {n} valores, do dia {d0} ao dia {d1} do contrato ({v0} a {v1}). No Laboratório, a fonte informa o valor de cada data automaticamente.',
        seriesLoad: 'Carregar série (CSV ou JSON)',
        seriesSample: 'Baixar modelo de CSV',
        seriesRemove: 'Remover série',
        seriesLoaded: 'Série carregada com {n} valores.',
        seriesInvalid: 'Não foi possível ler a série. Use linhas "data;valor" (ex.: 01/02/2026;0,41) ou "dia;valor".',
        contractOpened: 'Contrato aberto.',
        contractInvalid: 'Arquivo de contrato inválido.',
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
        savedMyBlockGroup: 'Block saved to "My blocks", with {n} linked clause(s).',
        withLinked: '+{n} linked',
        builtinPresets: 'Ready-made examples',
        myModels: 'My templates',
        myModelsCount: 'My templates ({n})',
        myModelsEmpty: 'No saved templates yet. Build a contract and click "Save as my template"; it will be listed under "Start from an example", ready to reuse in other contracts.',
        saveModel: 'Save as my template',
        modelSaved: 'Template "{name}" saved. It is listed under "Start from an example" → "My templates".',
        modelReplaced: 'Template "{name}" updated.',
        modelUse: 'Use',
        modelDelete: 'Delete template',
        modelDeleteConfirm: 'Delete the template "{name}"?',
        modelsExport: 'Export templates',
        modelsImport: 'Import templates',
        modelsImported: '{n} template(s) imported.',
        modelsHint: 'Templates are stored in this browser. Export them to a file to use on another computer or to share. Party details (identification and wallets) are not stored.',
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
        linkedTo: 'linked to: {name}',
        replaceConfirm: 'Replace the current contract? Changes not saved (with "Save contract" or "Save as my template") will be lost.',
        linkedToTitle: 'Go to clause {name}',
        linkMap: 'Map of links between clauses',
        linkMapHint: 'Each clause has a color, repeated in the code, the Lab and the tests. Indented clauses depend on the clause above them.',
        alsoLinked: 'also linked to',
        partiesData: 'Party details (optional)',
        partiesDataHelp: 'Each party\'s details, for the document to be signed, and wallet address, for deployment. The details go into the signed text and its fingerprint, but never into the code published on the blockchain. The contract file and the report stay with whoever saves them.',
        partyWallet: 'Wallet address',
        partyName: 'Full name or company name',
        partyDoc: 'Tax ID, company number or passport',
        partyAddress: 'Address',
        sigHashLabel: 'Fingerprint (SHA-256) of the contract text:',
        sigHashHint: 'This is the value each signatory checks when signing. It changes whenever the text or the party details change.',
        sigDownload: 'Download the contract text (.txt)',
        sigPdfTitle: 'Legally valid signature (gov.br, digital certificate or foreign service)',
        sigPdfSteps: 'a) Generate the PDF with "Print for signature (PDF)". b) Sign it with the service of your choice: in Brazil, gov.br (ITI signer) or an ICP-Brasil certificate; elsewhere, an equivalent service (e.g. a qualified eIDAS certificate). c) Compute below the fingerprint of the signed PDF. d) In the Lab or on the network, call recordDocument with this value before the first signature.',
        sigPdfPick: 'Compute the fingerprint of a signed PDF',
        sigPdfResult: 'Fingerprint of the file "{name}":',
        sigPdfLocal: 'The file is read only in your browser; nothing is sent.',
        copy: 'Copy',
        copied: 'Copied.',
        legalTitle: 'Legal check ({n})',
        legalHint: 'Automatic, indicative check based on Brazilian law. It does not replace professional advice.',
        legalWarn: 'Warning',
        legalNote: 'Reminder',
        walletInvalid: 'The wallet address of "{name}" does not look valid (it must start with 0x and have 42 characters).',
        seriesNone: 'Optional: load a data series (e.g. a monthly index) so the Lab updates this data automatically as time moves forward.',
        seriesSummary: 'Series loaded: {n} values, from day {d0} to day {d1} of the contract ({v0} to {v1}). In the Lab, the source reports each date\'s value automatically.',
        seriesLoad: 'Load series (CSV or JSON)',
        seriesSample: 'Download CSV template',
        seriesRemove: 'Remove series',
        seriesLoaded: 'Series loaded with {n} values.',
        seriesInvalid: 'Could not read the series. Use "date;value" lines (e.g. 02/01/2026;0.41) or "day;value".',
        contractOpened: 'Contract opened.',
        contractInvalid: 'Invalid contract file.',
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
        state.dirty = true;
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
                onchange: scheduleRender }),
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
        const linkTags = B().linksOf(block).map(l => {
            const tb = state.model.blocks.find(x => x.uid === l.uid);
            if (!tb) return null;
            return el('button', { type: 'button', class: 'link-tag k' + B().colorOf(state.model, tb.uid), title: t('linkedToTitle', { name: tb.label }),
                onclick: () => focusClause(tb.uid) }, [el('span', { class: 'k-dot' }), t('linkedTo', { name: tb.label })]);
        }).filter(Boolean);
        const li = el('li', { class: 'clause' + (def.declarative ? ' clause-free' : '') + ' k' + B().colorOf(state.model, block.uid), 'data-uid': block.uid }, [
            el('div', { class: 'clause-head' }, [el('span', { class: 'clause-num', text: ordinal(index + 2) }), ' — ', ...titleNodes, def.declarative ? el('span', { class: 'clause-note', text: t('declarative') }) : null, ...linkTags, tools]),
            sentenceNode(block)
        ]);
        if (block.type === 'oraculoValor') li.appendChild(seriesNode(block));
        if (block.type === 'assinaturas') li.appendChild(signatureNode());
        return li;
    }

    // ---------- Série de dados para o oráculo (CSV ou JSON) ----------
    function parseNumber(v) {
        const s = String(v).trim().replace(/\s/g, '').replace(/^R\$/, '').replace(/%$/, '');
        const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
        return Number(lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
    }
    function parseDate(v) {
        const s = String(v).trim();
        let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
        if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
        m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
        m = /^(\d{1,2})\/(\d{4})$/.exec(s); // mm/aaaa
        if (m) return Date.UTC(+m[2], +m[1] - 1, 1);
        return null;
    }
    /** Lê "dia;valor" ou "data;valor" (CSV) ou [{dia|data, valor}] (JSON). Devolve [{dia, valor×100}]. */
    function parseSeries(text) {
        let rows = [];
        const trimmed = String(text).trim();
        if (/^[\[{]/.test(trimmed)) {
            const data = JSON.parse(trimmed);
            rows = (Array.isArray(data) ? data : data.serie || data.series || []).map(r => [r.dia != null ? r.dia : (r.day != null ? r.day : r.data || r.date), r.valor != null ? r.valor : r.value]);
        } else {
            rows = trimmed.split(/\r?\n/).map(l => l.split(/[;\t]|,(?=\s*-?[\d.]+\s*$)/)).filter(r => r.length >= 2);
        }
        const out = [];
        let first = null;
        for (const [k, v] of rows) {
            const val = parseNumber(v);
            if (!Number.isFinite(val) || val < 0) continue;
            let dia = null;
            if (/^\s*\d+\s*$/.test(String(k))) dia = Number(k);
            else {
                const d = parseDate(k);
                if (d == null) continue;
                if (first == null) first = d;
                dia = Math.round((d - first) / 86400000);
            }
            out.push({ dia, valor: Math.round(val * 100) });
        }
        out.sort((a, b) => a.dia - b.dia);
        if (!out.length) throw new Error('empty');
        return out.slice(0, 1000);
    }

    /** Painel da cláusula de assinaturas: impressão digital do texto, download e cálculo do hash de um PDF assinado. */
    function signatureNode() {
        const hashCode = el('code', { class: 'sig-hash', text: B().hashDoTexto(state.model, CSC.lang) });
        const copyBtn = value => el('button', { type: 'button', class: 'link-btn', text: t('copy'), onclick: e => {
            try { navigator.clipboard.writeText(typeof value === 'function' ? value() : value); e.target.textContent = t('copied'); } catch (_) { /* sem área de transferência */ }
        } });
        const result = el('div', { class: 'sig-result', role: 'status', 'aria-live': 'polite' });
        const file = el('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true, onchange: async e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const buf = await f.arrayBuffer();
            const dig = await crypto.subtle.digest('SHA-256', buf);
            const hex = '0x' + Array.from(new Uint8Array(dig)).map(x => x.toString(16).padStart(2, '0')).join('');
            result.textContent = '';
            result.appendChild(el('span', { class: 'muted small', text: t('sigPdfResult', { name: f.name.slice(0, 80) }) + ' ' }));
            result.appendChild(el('code', { class: 'sig-hash', text: hex }));
            result.appendChild(copyBtn(hex));
        } });
        return el('div', { class: 'sig-panel' }, [
            el('p', { class: 'small' }, [el('strong', { text: t('sigHashLabel') + ' ' }), hashCode, ' ', copyBtn(() => hashCode.textContent)]),
            el('p', { class: 'muted small', text: t('sigHashHint') }),
            el('button', { type: 'button', class: 'link-btn', text: t('sigDownload'), onclick: () => {
                const blob = new Blob([B().textoParaAssinatura(state.model, CSC.lang)], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = el('a', { href: url, download: 'contrato.txt' });
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } }),
            el('details', { class: 'sig-pdf' }, [
                el('summary', { class: 'link-btn', text: t('sigPdfTitle') }),
                el('p', { class: 'small', text: t('sigPdfSteps') }),
                el('button', { type: 'button', class: 'btn btn-quiet', text: t('sigPdfPick'), onclick: () => file.click() }), file,
                el('p', { class: 'muted small', text: t('sigPdfLocal') }),
                result
            ])
        ]);
    }

    function seriesNode(block) {
        const fileInput = el('input', { type: 'file', accept: '.csv,.txt,.json,text/csv,application/json', hidden: true, onchange: e => {
            const f = e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
                try { block.serie = parseSeries(reader.result); if (state.dom.notice) state.dom.notice(t('seriesLoaded', { n: block.serie.length })); changed(true); }
                catch (_) { if (state.dom.notice) state.dom.notice(t('seriesInvalid')); }
            };
            reader.readAsText(f);
        } });
        const sample = () => {
            const csv = CSC.lang === 'en' ? 'date;value\n01/01/2026;0\n01/02/2026;0.41\n01/03/2026;0.95\n01/04/2026;1.32\n' : 'data;valor\n01/01/2026;0\n01/02/2026;0,41\n01/03/2026;0,95\n01/04/2026;1,32\n';
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            const a = el('a', { href: url, download: 'modelo-serie.csv' });
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        const serie = block.serie || [];
        const fmt = v => (v / 100).toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR');
        return el('div', { class: 'series' }, [
            el('p', { class: 'hint', text: serie.length ? t('seriesSummary', { n: serie.length, d0: serie[0].dia, d1: serie[serie.length - 1].dia, v0: fmt(serie[0].valor), v1: fmt(serie[serie.length - 1].valor) }) : t('seriesNone') }),
            el('div', { class: 'inline-row' }, [
                el('button', { type: 'button', class: 'link-btn', text: t('seriesLoad'), onclick: () => fileInput.click() }),
                el('button', { type: 'button', class: 'link-btn', text: t('seriesSample'), onclick: sample }),
                serie.length ? el('button', { type: 'button', class: 'link-btn', text: t('seriesRemove'), onclick: () => { delete block.serie; changed(true); } }) : null,
                fileInput
            ])
        ]);
    }

    // ---------- Arquivo do contrato (.json) ----------
    function exportContract() {
        state.dirty = false;
        const data = { formato: 'conversor-contratual/contrato', versao: 1, criadoEm: new Date().toISOString(), idioma: CSC.lang, modelo: state.model };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const name = B().names.pascal(state.model.name || 'contrato');
        const a = el('a', { href: url, download: name + '.contrato.json' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function sanitizeModel(m) {
        if (!m || !Array.isArray(m.roles) || !Array.isArray(m.blocks)) throw new Error('format');
        const str = (v, n) => String(v == null ? '' : v).slice(0, n);
        const roles = m.roles.slice(0, 8).map((r, i) => ({ id: str(r.id || 'p' + (i + 1), 40), label: str(r.label, 60), carteira: r.carteira ? str(r.carteira, 42) : undefined,
            nome: r.nome ? str(r.nome, 120) : undefined, documento: r.documento ? str(r.documento, 40) : undefined, endereco: r.endereco ? str(r.endereco, 200) : undefined }));
        const blocks = m.blocks.slice(0, 60).filter(b => b && B().BLOCKS[b.type]).map(b => {
            const out = { uid: str(b.uid, 60), type: b.type, label: str(b.label, 80), params: {} };
            for (const p of B().BLOCKS[b.type].params) out.params[p.key] = typeof b.params[p.key] === 'number' ? b.params[p.key] : str(b.params[p.key], 80);
            if (b.texto) out.texto = str(b.texto, 4000);
            if (Array.isArray(b.serie)) out.serie = b.serie.slice(0, 1000).map(x => ({ dia: Number(x.dia) || 0, valor: Math.max(0, Math.round(Number(x.valor) || 0)) }));
            return out;
        });
        const model = { name: str(m.name, 80), scale: Number(m.scale) > 0 ? Number(m.scale) : 1000, roles, blocks };
        B().normalize(model);
        if (m.cotacao && Number(m.cotacao.brl) > 0) model.cotacao = { brl: Number(m.cotacao.brl), fonte: str(m.cotacao.fonte, 30), data: str(m.cotacao.data, 40) };
        return model;
    }
    function importContract(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                state.model = sanitizeModel(data.modelo || data.model || data);
                state.openWording.clear();
                changed(true);
                if (state.dom.notice) state.dom.notice(t('contractOpened'));
            } catch (_) { if (state.dom.notice) state.dom.notice(t('contractInvalid')); }
        };
        reader.readAsText(file);
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
                onchange: scheduleRender });
            const rm = roles.length > 2 && !used(r.id)
                ? el('button', { type: 'button', class: 'icon-btn', title: t('removeParty'), 'aria-label': t('removeParty'), text: '×', onclick: () => { roles.splice(roles.indexOf(r), 1); changed(true); } })
                : null;
            chips.push(el('span', { class: 'party' }, [input, rm]));
        });
        const add = roles.length < 6 ? el('button', { type: 'button', class: 'link-btn add-party', text: t('addParty'), onclick: () => {
            roles.push({ id: newPartyId(), label: t('newParty') + ' ' + (roles.length + 1) });
            changed(true);
        } }) : null;
        const data = el('details', { class: 'parties-data' }, [
            el('summary', { class: 'link-btn', text: t('partiesData') }),
            el('p', { class: 'hint', text: t('partiesDataHelp') }),
            ...roles.map(r => el('fieldset', { class: 'party-row' }, [
                el('legend', { class: 'party-row-name', text: r.label }),
                el('input', { type: 'text', class: 'party-q', placeholder: t('partyName'), value: r.nome || '', maxlength: '120', 'aria-label': t('partyName') + ' — ' + r.label,
                    oninput: e => { r.nome = e.target.value; changed(false); } }),
                el('input', { type: 'text', class: 'party-q', placeholder: t('partyDoc'), value: r.documento || '', maxlength: '40', 'aria-label': t('partyDoc') + ' — ' + r.label,
                    oninput: e => { r.documento = e.target.value; changed(false); } }),
                el('input', { type: 'text', class: 'party-q party-q-wide', placeholder: t('partyAddress'), value: r.endereco || '', maxlength: '200', 'aria-label': t('partyAddress') + ' — ' + r.label,
                    oninput: e => { r.endereco = e.target.value; changed(false); } }),
                el('input', { type: 'text', class: 'party-wallet', placeholder: t('partyWallet') + ' (0x…)', spellcheck: 'false', value: r.carteira || '', 'aria-label': t('partyWallet') + ' — ' + r.label,
                    oninput: e => { r.carteira = e.target.value.trim(); changed(false); } })
            ]))
        ]);
        if (roles.some(r => r.carteira || r.nome || r.documento)) data.open = state.partiesOpen !== false;
        data.addEventListener('toggle', () => { state.partiesOpen = data.open; });
        return el('li', { class: 'clause clause-parties' }, [
            el('div', { class: 'clause-head' }, [el('span', { class: 'clause-num', text: ordinal(1) }), ' — ', el('span', { class: 'clause-title', text: t('partiesTitle') })]),
            el('p', { class: 'clause-text' }, [t('partiesIntro') + ' ', ...chips, t('partiesOutro').startsWith(',') ? t('partiesOutro') : ' ' + t('partiesOutro'), ' ', add]),
            data
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
            el('button', { type: 'button', class: 'palette-item', text: m.label + (Array.isArray(m.ligadas) && m.ligadas.length ? ' ' + t('withLinked', { n: m.ligadas.length }) : ''), title: (B().BLOCKS[m.type] || {}).name ? B().BLOCKS[m.type].name[lang] : '', onclick: () => addMine(m) }),
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
    /** Serializa um bloco sem referências a partes ou cláusulas específicas. */
    function packBlock(block, mainUid) {
        const def = B().BLOCKS[block.type];
        const params = {};
        for (const p of def.params) {
            const v = block.params[p.key];
            if (p.kind === 'role') params[p.key] = { roleIndex: Math.max(0, state.model.roles.findIndex(r => r.id === v)) };
            else if (p.kind === 'ref') params[p.key] = mainUid && v === mainUid ? '@principal' : null;
            else params[p.key] = v;
        }
        return { type: block.type, label: block.label, texto: block.texto || null, params };
    }

    function saveMine(block) {
        const entry = packBlock(block);
        // Cláusulas ligadas a esta (multa, cláusula penal, vencimento antecipado...) vão junto.
        const deps = state.model.blocks.filter(x => x !== block && B().BLOCKS[x.type].attached && x.params.alvo === block.uid);
        if (deps.length) entry.ligadas = deps.map(d => packBlock(d, block.uid));
        const all = store.get();
        all.push(entry);
        store.set(all);
        if (state.dom.notice) state.dom.notice(deps.length ? t('savedMyBlockGroup', { n: deps.length }) : t('savedMyBlock'));
        render();
    }

    /** Cria um bloco a partir do salvo; '@principal' liga ao bloco indicado. */
    function unpackBlock(m, mainUid) {
        if (!B().BLOCKS[m.type]) return null;
        const b = B().newBlock(m.type, state.model.roles, CSC.lang, state.model.blocks);
        const def = B().BLOCKS[m.type];
        for (const p of def.params) {
            const v = m.params ? m.params[p.key] : undefined;
            if (v == null) continue;
            if (p.kind === 'role') {
                const r = state.model.roles[Math.min(v.roleIndex || 0, state.model.roles.length - 1)];
                if (r) b.params[p.key] = r.id;
            } else if (p.kind === 'ref') { if (v === '@principal' && mainUid) b.params[p.key] = mainUid; }
            else b.params[p.key] = v;
        }
        if (m.texto) b.texto = m.texto;
        if (m.label && !def.single) {
            const taken = new Set(state.model.blocks.map(x => B().names.pascal(x.label)));
            let label = m.label;
            for (let i = 2; taken.has(B().names.pascal(label)); i++) label = m.label + ' ' + i;
            b.label = label;
        }
        return b;
    }

    function addMine(m) {
        const b = unpackBlock(m);
        if (!b) return;
        state.model.blocks.push(b);
        for (const d of (Array.isArray(m.ligadas) ? m.ligadas : [])) {
            const x = unpackBlock(d, b.uid);
            if (x) state.model.blocks.push(x);
        }
        state.paletteOpen = false;
        changed(true);
    }

    // ---------- Meus modelos (contratos inteiros reutilizáveis) ----------
    const MODELS_KEY = 'csc.myModels';
    const models = {
        get() { try { const v = JSON.parse(localStorage.getItem(MODELS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } },
        set(v) { try { localStorage.setItem(MODELS_KEY, JSON.stringify(v)); } catch (_) { /* indisponível */ } }
    };
    /** Cópia do contrato sem endereços de carteira (dados das partes). */
    function templateCopy(model) {
        const m = JSON.parse(JSON.stringify(model));
        for (const r of m.roles || []) { delete r.carteira; delete r.nome; delete r.documento; delete r.endereco; }
        delete m.cotacao;
        return m;
    }
    function saveModel() {
        state.dirty = false;
        const name = String(state.model.name || '').trim() || t('docBlank');
        const all = models.get();
        const i = all.findIndex(x => x.nome.toLowerCase() === name.toLowerCase());
        const entry = { id: i >= 0 ? all[i].id : 'm' + Date.now().toString(36), nome: name, salvoEm: new Date().toISOString(), modelo: templateCopy(state.model) };
        if (i >= 0) all[i] = entry; else all.push(entry);
        models.set(all);
        if (state.dom.notice) state.dom.notice(t(i >= 0 ? 'modelReplaced' : 'modelSaved', { name }));
        state.modelsOpen = true;
        render();
    }
    function useModel(id) {
        const m = models.get().find(x => x.id === id);
        if (!m) return;
        try { state.model = sanitizeModel(JSON.parse(JSON.stringify(m.modelo))); } catch (_) { if (state.dom.notice) state.dom.notice(t('importFailed')); return; }
        state.openWording.clear();
        changed(true);
    }
    function exportModels() {
        const blob = new Blob([JSON.stringify({ formato: 'conversor-contratual/modelos', versao: 1, modelos: models.get() }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: 'meus-modelos.json' });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function importModels(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                // Aceita um arquivo de modelos ou um contrato salvo (.json) isolado.
                const raw = Array.isArray(data.modelos) ? data.modelos
                    : data.modelo ? [{ nome: data.modelo.name, modelo: data.modelo }] : [];
                const list = [];
                for (const x of raw) {
                    try {
                        const modelo = templateCopy(sanitizeModel(x.modelo));
                        list.push({ id: 'm' + Date.now().toString(36) + list.length, nome: String(x.nome || modelo.name || t('docBlank')).slice(0, 80), salvoEm: new Date().toISOString(), modelo });
                    } catch (_) { /* ignora entrada inválida */ }
                }
                if (!list.length) throw new Error('empty');
                models.set(models.get().concat(list));
                state.modelsOpen = true;
                if (state.dom.notice) state.dom.notice(t('modelsImported', { n: list.length }));
                render();
            } catch (_) {
                if (state.dom.notice) state.dom.notice(t('importFailed'));
            }
        };
        reader.readAsText(file);
    }
    function myModelsNode() {
        const all = models.get();
        const lang = CSC.lang === 'en' ? 'en-US' : 'pt-BR';
        const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { importModels(e.target.files[0]); e.target.value = ''; } });
        const list = all.length ? el('ul', { class: 'my-models' }, all.map(m => el('li', {}, [
            el('strong', { text: m.nome }),
            el('span', { class: 'muted small', text: ' · ' + new Date(m.salvoEm).toLocaleDateString(lang) + ' · ' + ((m.modelo.blocks || []).length) + ' ' + (CSC.lang === 'en' ? 'clause(s)' : 'cláusula(s)') }),
            el('button', { type: 'button', class: 'link-btn', text: t('modelUse'), onclick: () => useModel(m.id) }),
            el('button', { type: 'button', class: 'icon-btn', title: t('modelDelete'), 'aria-label': t('modelDelete') + ': ' + m.nome, text: '×', onclick: () => {
                if (!window.confirm(t('modelDeleteConfirm', { name: m.nome }))) return;
                models.set(models.get().filter(x => x.id !== m.id));
                render();
            } })
        ]))) : el('p', { class: 'hint', text: t('myModelsEmpty') });
        return el('details', { class: 'my-models-panel', open: state.modelsOpen ? true : null, ontoggle: e => { state.modelsOpen = e.target.open; } }, [
            el('summary', { class: 'link-btn', text: all.length ? t('myModelsCount', { n: all.length }) : t('myModels') }),
            el('div', { class: 'inline-row' }, [
                el('button', { type: 'button', class: 'btn btn-quiet', text: t('saveModel'), onclick: saveModel }),
                all.length ? el('button', { type: 'button', class: 'link-btn', text: t('modelsExport'), onclick: exportModels }) : null,
                el('button', { type: 'button', class: 'link-btn', text: t('modelsImport'), onclick: () => fileInput.click() }),
                fileInput
            ]),
            list,
            el('p', { class: 'muted small', text: t('modelsHint') })
        ]);
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
                    .map(m => ({ type: m.type, label: String(m.label).slice(0, 60), texto: m.texto ? String(m.texto).slice(0, 2000) : null, params: m.params || {},
                        ligadas: Array.isArray(m.ligadas) ? m.ligadas.filter(d => d && B().BLOCKS[d.type]).slice(0, 10).map(d => ({ type: d.type, label: String(d.label || '').slice(0, 60), texto: d.texto ? String(d.texto).slice(0, 2000) : null, params: d.params || {} })) : undefined }));
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
        for (const r of state.model.roles) if (r.carteira && !/^0x[0-9a-fA-F]{40}$/.test(r.carteira)) warnings.push(t('walletInvalid', { name: r.label }));
        for (const x of B().warnings(state.model)) warnings.push(x[CSC.lang === 'en' ? 'en' : 'pt']);
        for (const b of state.model.blocks) {
            const vals = looseValues(b);
            if (vals.length) warnings.push(t('looseValues', { clause: b.label, values: vals.map(v => '"' + v.trim() + '"').join(', ') }));
        }
        if (warnings.length) {
            box.appendChild(el('p', { class: 'field-label', text: t('docWarnings') }));
            box.appendChild(el('ul', { class: 'issues warnings' }, warnings.map(w => el('li', { text: w }))));
        }
        const legal = B().legalCheck(state.model, CSC.lang);
        if (legal.length) {
            const det = el('details', { class: 'legal-check', open: state.legalOpen ? true : null }, [
                el('summary', { class: 'link-btn', text: t('legalTitle', { n: legal.length }) }),
                el('p', { class: 'muted small', text: t('legalHint') }),
                el('ul', { class: 'issues legal' }, legal.map(x => el('li', { class: 'legal-' + x.tipo }, [
                    el('span', { class: 'tag ' + (x.tipo === 'aviso' ? 'tag-security' : 'tag-functional'), text: x.tipo === 'aviso' ? t('legalWarn') : t('legalNote') }), ' ',
                    x.texto, x.ref ? el('span', { class: 'legal-ref', text: ' (' + x.ref + ')' }) : null
                ])))
            ]);
            det.addEventListener('toggle', () => { state.legalOpen = det.open; });
            box.appendChild(det);
        }
        const sh = state.dom.doc.querySelector('.sig-hash');
        if (sh) try { sh.textContent = B().hashDoTexto(state.model, CSC.lang); } catch (_) { /* montagem incompleta */ }
        if (state.dom.generate) state.dom.generate.disabled = issues.length > 0;
        return issues;
    }

    // ---------- Renderização ----------
    /** Rola até a cláusula indicada e a destaca brevemente. */
    function focusClause(uid) {
        const li = state.dom.doc.querySelector('.clause[data-uid="' + CSS.escape(uid) + '"]');
        if (!li) return;
        li.scrollIntoView({ behavior: 'smooth', block: 'center' });
        li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
    }

    /** Mapa das ligações: cláusulas principais e, recuadas, as que dependem delas. */
    function linkMapNode() {
        const m = state.model;
        if (!m.blocks.some(b => B().linksOf(b).length)) return null;
        const lang = CSC.lang === 'en' ? 'en' : 'pt';
        const num = b => ordinal(m.blocks.indexOf(b) + 2);
        const item = (b, sub, extra) => el('li', { class: (sub ? 'sub ' : '') + 'k' + B().colorOf(m, b.uid) }, [
            el('span', { class: 'k-dot' }),
            el('button', { type: 'button', class: 'link-btn map-num', text: num(b), onclick: () => focusClause(b.uid) }),
            el('span', { text: b.label }),
            el('span', { class: 'map-kind', text: '(' + B().BLOCKS[b.type].name[lang].toLowerCase() + ')' }),
            ...(extra || [])
        ]);
        const primary = l => (l.find(x => x.campo === 'alvo') || l[0]);
        const list = el('ul');
        for (const b of m.blocks) {
            const links = B().linksOf(b).filter(l => m.blocks.some(x => x.uid === l.uid));
            if (links.length) continue; // aparece sob a cláusula de que depende
            list.appendChild(item(b, false));
            for (const dep of m.blocks) {
                const dl = B().linksOf(dep).filter(l => m.blocks.some(x => x.uid === l.uid));
                if (!dl.length || primary(dl).uid !== b.uid) continue;
                const others = dl.filter(l => l.uid !== b.uid).map(l => m.blocks.find(x => x.uid === l.uid));
                const extra = others.length ? [el('span', { class: 'map-kind', text: t('alsoLinked') }), ...others.map(o => el('button', { type: 'button', class: 'link-tag k' + B().colorOf(m, o.uid), onclick: () => focusClause(o.uid) }, [el('span', { class: 'k-dot' }), o.label]))] : null;
                list.appendChild(item(dep, true, extra));
            }
        }
        return el('details', { class: 'link-map', open: state.mapOpen ? true : null, ontoggle: e => { state.mapOpen = e.target.open; } }, [
            el('summary', { text: t('linkMap') }),
            el('p', { class: 'muted small', text: t('linkMapHint') }),
            list
        ]);
    }

    /** Posição do elemento em foco dentro do documento, para restaurá-lo após redesenhar. */
    const FOCUSABLE = 'input, select, textarea, button, [contenteditable="true"]';
    function focusSnapshot() {
        const a = document.activeElement;
        if (!a || !state.dom.doc.contains(a)) return null;
        const all = Array.from(state.dom.doc.querySelectorAll(FOCUSABLE));
        const snap = { index: all.indexOf(a), tag: a.tagName };
        if (a.tagName === 'INPUT' && a.type === 'text') { snap.start = a.selectionStart; snap.end = a.selectionEnd; }
        return snap.index < 0 ? null : snap;
    }
    function focusRestore(snap) {
        if (!snap) return;
        const n = Array.from(state.dom.doc.querySelectorAll(FOCUSABLE))[snap.index];
        if (!n || n.tagName !== snap.tag) return;
        n.focus({ preventScroll: true });
        if (snap.start != null && n.setSelectionRange) try { n.setSelectionRange(snap.start, snap.end); } catch (_) { /* tipo sem seleção */ }
    }

    /**
     * Renomear uma parte ou cláusula muda rótulos em outros pontos do documento, mas redesenhá-lo
     * enquanto a pessoa digita em outro campo perderia o que ela digitou. O redesenho espera o foco
     * sair do documento (ou outra alteração estrutural).
     */
    function scheduleRender() {
        state.pendingRender = true;
        setTimeout(() => { if (state.pendingRender && !state.dom.doc.contains(document.activeElement)) render(); }, 0);
    }

    function render() {
        state.pendingRender = false;
        const snap = focusSnapshot();
        renderNow();
        focusRestore(snap);
    }

    function renderNow() {
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
        const map = linkMapNode();
        if (map) d.doc.appendChild(map);
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
        const mine = models.get();
        if (mine.length) sel.appendChild(el('optgroup', { label: t('myModels') }, mine.map(m => el('option', { value: 'mine:' + m.id, text: m.nome }))));
        sel.appendChild(el('optgroup', { label: t('builtinPresets') }, B().PRESETS.map(p => el('option', { value: p.id, text: p[lang] }))));
        sel.value = '';
        if (state.dom.myModels) { state.dom.myModels.textContent = ''; state.dom.myModels.appendChild(myModelsNode()); }
    }

    CSC.composer = {
        init(dom, onChange) {
            state.dom = dom;
            state.onChange = onChange;
            dom.title.addEventListener('input', () => { state.model.name = dom.title.value; changed(false); });
            dom.doc.addEventListener('focusout', e => {
                if (!state.pendingRender || (e.relatedTarget && dom.doc.contains(e.relatedTarget))) return;
                setTimeout(() => { if (state.pendingRender && !dom.doc.contains(document.activeElement)) render(); }, 0);
            });
            if (dom.save) dom.save.addEventListener('click', exportContract);
            if (dom.open && dom.openFile) {
                dom.open.addEventListener('click', () => dom.openFile.click());
                dom.openFile.addEventListener('change', e => { importContract(e.target.files[0]); e.target.value = ''; });
            }
            dom.presets.addEventListener('change', () => {
                const v = dom.presets.value;
                if (!v) return;
                if (state.dirty && state.model.blocks.length && !window.confirm(t('replaceConfirm'))) { dom.presets.value = ''; return; }
                if (v.startsWith('mine:')) { useModel(v.slice(5)); state.dirty = false; return; }
                state.model = v === '__blank' ? B().emptyModel(CSC.lang) : B().preset(v, CSC.lang);
                state.openWording.clear();
                changed(true);
                state.dirty = false;
            });
        },
        load(model) { state.model = B().normalize(model); render(); },
        /** Carrega um contrato vindo de fora (arquivo ou assistente), sempre saneado. Lança erro se o formato for inválido. */
        loadSanitized(raw) {
            const m = sanitizeModel(raw);
            state.model = m;
            state.openWording.clear();
            changed(true);
            state.dirty = false;
            return m;
        },
        sanitize: raw => sanitizeModel(raw),
        isDirty: () => !!state.dirty,
        model: () => state.model,
        _parseSeries: parseSeries,
        render,
        issues: () => B().validate(state.model)
    };
})();
