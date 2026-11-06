/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Montagem por blocos ("legos" contratuais), sem IA.
 *
 * Cada bloco é uma frase em linguagem natural com lacunas (partes, valores,
 * prazos) e corresponde a um trecho de código Solidity revisado. Os blocos
 * se conectam: encargos e vencimento antecipado ligam-se a um pagamento; o
 * árbitro decide disputas de garantias; rescisão e vigência encerram o
 * contrato e devolvem valores retidos.
 *
 * A montagem produz, de forma determinística:
 *  - a minuta em linguagem natural (cláusulas numeradas);
 *  - o código Solidity, com cada cláusula transcrita em comentário;
 *  - cenários de teste (funcionalidade, ataques e solvência).
 *
 * Script clássico (window.CSC.blocks) e módulo CommonJS (testes).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else {
        root.CSC = root.CSC || {};
        root.CSC.blocks = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SOLC_VERSION = '0.8.28';

    // ------------------------------------------------------------------
    // Utilidades de nomes e formatação
    // ------------------------------------------------------------------
    const RESERVED = new Set(['address', 'bool', 'string', 'uint', 'int', 'bytes', 'contract', 'function', 'event', 'error', 'modifier',
        'mapping', 'return', 'returns', 'public', 'private', 'external', 'internal', 'view', 'pure', 'payable', 'memory', 'storage',
        'calldata', 'if', 'else', 'for', 'while', 'do', 'new', 'delete', 'true', 'false', 'this', 'super', 'emit', 'revert', 'require',
        'assert', 'constant', 'immutable', 'enum', 'struct', 'library', 'interface', 'import', 'pragma', 'is', 'override', 'virtual',
        'abstract', 'constructor', 'fallback', 'receive', 'type', 'try', 'catch', 'using', 'assembly', 'unchecked', 'days', 'ether', 'wei']);

    function words(label) {
        return String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    }
    function pascal(label) {
        const w = words(label).map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join('');
        const s = /^[0-9]/.test(w) ? 'X' + w : w;
        return s || 'Item';
    }
    function camel(label) {
        const p = pascal(label);
        const c = p.charAt(0).toLowerCase() + p.slice(1);
        return RESERVED.has(c) ? c + 'Parte' : c;
    }
    function upper(label) { return words(label).map(x => x.toUpperCase()).join('_').replace(/^([0-9])/, 'X$1') || 'ITEM'; }

    function toWei(amount, scale) {
        // Valor monetário → wei, pela escala didática (1 ETH = "scale" unidades).
        const eth = Number(amount) / Number(scale || 1000);
        const fixed = eth.toFixed(9); // até 9 casas decimais de ETH
        const [i, f] = fixed.split('.');
        const wei = BigInt(i) * 10n ** 18n + BigInt((f || '').padEnd(18, '0').slice(0, 18));
        return wei;
    }
    function weiLiteral(wei) {
        // Literal decimal em ether (ex.: "2.5 ether"), aceito pelo Solidity quando o resultado é inteiro em wei.
        const whole = wei / 10n ** 18n;
        const frac = (wei % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
        return whole.toString() + (frac ? '.' + frac : '') + ' ether';
    }
    function etherString(wei) {
        const s = (Number(wei) / 1e18).toFixed(9).replace(/\.?0+$/, '');
        return (s || '0') + ' ether';
    }
    function money(n, lang) {
        const v = Number(n || 0);
        return 'R$ ' + v.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function num(n, lang) { return Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR'); }
    function bps(percent) { return Math.round(Number(percent || 0) * 100); }
    function ordinal(n, lang) { return lang === 'en' ? 'Clause ' + n : 'Cláusula ' + n + 'ª'; }

    // ------------------------------------------------------------------
    // Definição dos blocos
    // ------------------------------------------------------------------
    // Tipos de lacuna: role (parte), money (valor), int, days, percent, ref (outro bloco), choice.
    const BLOCKS = {
        pagamentoUnico: {
            category: 'pagamentos',
            name: { pt: 'Pagamento único', en: 'One-time payment' },
            defaultLabel: { pt: 'Sinal', en: 'Deposit' },
            params: [
                { key: 'devedor', kind: 'role', role: 0 },
                { key: 'credor', kind: 'role', role: 1 },
                { key: 'valor', kind: 'money', def: 5000 },
                { key: 'prazo', kind: 'days', def: 10, min: 1 }
            ],
            sentence: {
                pt: '{devedor} pagará a {credor} a quantia de {valor}, em parcela única, até {prazo} dias após a implantação do contrato.',
                en: '{devedor} shall pay {credor} the amount of {valor}, in a single payment, within {prazo} days of the contract deployment.'
            }
        },
        pagamentoPeriodico: {
            category: 'pagamentos',
            name: { pt: 'Pagamento periódico', en: 'Periodic payment' },
            defaultLabel: { pt: 'Aluguel', en: 'Rent' },
            params: [
                { key: 'devedor', kind: 'role', role: 1 },
                { key: 'credor', kind: 'role', role: 0 },
                { key: 'valor', kind: 'money', def: 2000 },
                { key: 'parcelas', kind: 'int', def: 12, min: 1, max: 360 },
                { key: 'periodo', kind: 'days', def: 30, min: 1 }
            ],
            sentence: {
                pt: '{devedor} pagará a {credor} {parcelas} parcelas de {valor}, a cada {periodo} dias, vencendo a primeira {periodo} dias após a implantação.',
                en: '{devedor} shall pay {credor} {parcelas} installments of {valor}, every {periodo} days, the first due {periodo} days after deployment.'
            }
        },
        encargos: {
            category: 'pagamentos',
            attached: true,
            name: { pt: 'Multa e juros de mora', en: 'Late fee and interest' },
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['pagamentoUnico', 'pagamentoPeriodico'] },
                { key: 'multa', kind: 'percent', def: 10 },
                { key: 'juros', kind: 'percent', def: 1 },
                { key: 'tolerancia', kind: 'days', def: 0, min: 0 }
            ],
            sentence: {
                pt: 'Em caso de atraso no pagamento de {alvo} superior a {tolerancia} dias de tolerância, incidirão multa de {multa} sobre o valor devido e juros de mora de {juros} ao mês, calculados por dia de atraso.',
                en: 'If payment of {alvo} is late by more than a {tolerancia}-day grace period, a late fee of {multa} on the amount due and late interest of {juros} per month, calculated per day of delay, shall apply.'
            }
        },
        vencimentoAntecipado: {
            category: 'pagamentos',
            attached: true,
            name: { pt: 'Vencimento antecipado', en: 'Acceleration' },
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['pagamentoPeriodico'] },
                { key: 'atraso', kind: 'days', def: 60, min: 1 }
            ],
            sentence: {
                pt: 'O atraso superior a {atraso} dias no pagamento de qualquer parcela de {alvo} autoriza o credor a declarar o vencimento antecipado do saldo devedor, que poderá então ser quitado de uma só vez.',
                en: 'A delay of more than {atraso} days in any installment of {alvo} entitles the creditor to accelerate the outstanding balance, which may then be repaid at once.'
            }
        },
        custodia: {
            category: 'garantias',
            name: { pt: 'Depósito em garantia', en: 'Escrow deposit' },
            defaultLabel: { pt: 'Preco', en: 'Price' },
            params: [
                { key: 'depositante', kind: 'role', role: 0 },
                { key: 'beneficiario', kind: 'role', role: 1 },
                { key: 'valor', kind: 'money', def: 50000 },
                { key: 'prazo', kind: 'days', def: 30, min: 1 }
            ],
            sentence: {
                pt: '{depositante} depositará {valor}, que ficará retido no contrato até que confirme o cumprimento da obrigação, quando o valor será liberado a {beneficiario}. Não havendo confirmação em {prazo} dias contados do depósito, {depositante} poderá reaver o valor.',
                en: '{depositante} shall deposit {valor}, held in the contract until they confirm performance, when it is released to {beneficiario}. Absent confirmation within {prazo} days of the deposit, {depositante} may recover the amount.'
            }
        },
        etapas: {
            category: 'execucao',
            name: { pt: 'Entregas por etapas', en: 'Milestone deliveries' },
            defaultLabel: { pt: 'Projeto', en: 'Project' },
            params: [
                { key: 'contratante', kind: 'role', role: 0 },
                { key: 'contratado', kind: 'role', role: 1 },
                { key: 'valor', kind: 'money', def: 30000 },
                { key: 'etapas', kind: 'int', def: 3, min: 1, max: 50 },
                { key: 'prazo', kind: 'days', def: 5, min: 1 }
            ],
            sentence: {
                pt: '{contratante} depositará {valor}, que será pago a {contratado} em {etapas} etapas de igual valor, cada uma após a aprovação da respectiva entrega. {contratante} terá {prazo} dias para aprovar ou recusar fundamentadamente cada entrega; o silêncio importará aprovação.',
                en: '{contratante} shall deposit {valor}, paid to {contratado} in {etapas} equal milestones, each after approval of the corresponding delivery. {contratante} has {prazo} days to approve or reasonably reject each delivery; silence means approval.'
            }
        },
        caucao: {
            category: 'garantias',
            name: { pt: 'Caução', en: 'Security deposit' },
            defaultLabel: { pt: 'Caucao', en: 'Security' },
            params: [
                { key: 'garantidor', kind: 'role', role: 1 },
                { key: 'beneficiario', kind: 'role', role: 0 },
                { key: 'valor', kind: 'money', def: 6000 },
                { key: 'prazo', kind: 'days', def: 30, min: 1 }
            ],
            sentence: {
                pt: '{garantidor} prestará caução de {valor} em favor de {beneficiario}, devolvida após o término do contrato. Havendo prejuízo, {beneficiario} poderá pedir a retenção total ou parcial, que dependerá de decisão do árbitro, se houver. Sem manifestação de {beneficiario} em {prazo} dias contados do término, {garantidor} poderá resgatá-la.',
                en: '{garantidor} shall provide a security deposit of {valor} in favor of {beneficiario}, returned after the contract ends. In case of damage, {beneficiario} may claim full or partial retention, subject to the arbitrator\'s decision, if any. If {beneficiario} does not act within {prazo} days of the end, {garantidor} may reclaim it.'
            }
        },
        arbitro: {
            category: 'disputas',
            name: { pt: 'Árbitro', en: 'Arbitrator' },
            single: true,
            params: [{ key: 'arbitro', kind: 'role', role: 2 }],
            sentence: {
                pt: 'As divergências sobre a liberação de valores retidos serão decididas por {arbitro}, cuja decisão o contrato executará.',
                en: 'Disputes about the release of held amounts shall be decided by {arbitro}, whose decision the contract will execute.'
            }
        },
        rescisao: {
            category: 'encerramento',
            name: { pt: 'Rescisão', en: 'Termination' },
            single: true,
            params: [{ key: 'quem', kind: 'roleOrAny' }],
            sentence: {
                pt: '{quem} poderá rescindir o contrato a qualquer tempo; com a rescisão, cessam as obrigações futuras e os valores ainda retidos são devolvidos a quem os depositou.',
                en: '{quem} may terminate the contract at any time; upon termination, future obligations cease and amounts still held are returned to whoever deposited them.'
            }
        },
        clausulaLivre: {
            category: 'livre',
            name: { pt: 'Cláusula livre', en: 'Free clause' },
            defaultLabel: { pt: 'Disposições gerais', en: 'General provisions' },
            declarative: true,
            params: [],
            sentence: {
                pt: 'As partes elegem o foro da comarca de São Paulo para dirimir quaisquer controvérsias oriundas deste contrato.',
                en: 'The parties elect the courts of São Paulo to settle any disputes arising from this contract.'
            }
        },
        vigencia: {
            category: 'encerramento',
            name: { pt: 'Prazo de vigência', en: 'Term' },
            single: true,
            params: [{ key: 'duracao', kind: 'days', def: 365, min: 1 }],
            sentence: {
                pt: 'O contrato vigorará por {duracao} dias contados da implantação; esgotado o prazo, qualquer das partes poderá declarar seu encerramento, com a devolução dos valores ainda retidos a quem os depositou.',
                en: 'The contract shall remain in force for {duracao} days from deployment; after that, either party may declare it closed, returning amounts still held to whoever deposited them.'
            }
        }
    };

    const CATEGORIES = [
        { id: 'pagamentos', pt: 'Pagamentos', en: 'Payments' },
        { id: 'garantias', pt: 'Garantias', en: 'Guarantees' },
        { id: 'execucao', pt: 'Execução', en: 'Performance' },
        { id: 'disputas', pt: 'Solução de disputas', en: 'Dispute resolution' },
        { id: 'encerramento', pt: 'Encerramento', en: 'Termination' },
        { id: 'livre', pt: 'Redação livre', en: 'Free wording' }
    ];

    /** Lacunas obrigatórias de um bloco (para conferir redações personalizadas). */
    function slots(type) { return (BLOCKS[type].params || []).map(p => p.key); }
    function missingSlots(type, text) { return slots(type).filter(k => String(text || '').indexOf('{' + k + '}') === -1); }

    // ------------------------------------------------------------------
    // Montagem: normalização e validação
    // ------------------------------------------------------------------
    let uidSeq = 0;
    function newBlock(type, roles, lang, existing) {
        const def = BLOCKS[type];
        const params = {};
        for (const p of def.params) {
            if (p.kind === 'role') params[p.key] = roles[Math.min(p.role, roles.length - 1)] ? roles[Math.min(p.role, roles.length - 1)].id : '';
            else if (p.kind === 'roleOrAny') params[p.key] = '*';
            else if (p.kind === 'ref') {
                const target = (existing || []).find(b => p.accepts.includes(b.type));
                params[p.key] = target ? target.uid : '';
            } else params[p.key] = p.def;
        }
        let label = def.defaultLabel ? def.defaultLabel[lang === 'en' ? 'en' : 'pt'] : def.name[lang === 'en' ? 'en' : 'pt'];
        const taken = new Set((existing || []).map(b => pascal(b.label)));
        let candidate = label;
        for (let i = 2; taken.has(pascal(candidate)); i++) candidate = label + ' ' + i;
        const blk = { uid: 'b' + (++uidSeq) + Date.now().toString(36).slice(-3), type, label: candidate, params };
        if (def.declarative) blk.texto = def.sentence[lang === 'en' ? 'en' : 'pt'];
        return blk;
    }

    /** Valida a montagem; devolve lista de mensagens { pt, en, uid? }. */
    function validate(model) {
        const errs = [];
        const add = (pt, en, uid) => errs.push({ pt, en, uid });
        const roles = model.roles || [];
        const blocks = model.blocks || [];
        const roleIds = new Set(roles.map(r => r.id));
        if (roles.length < 2) add('Defina ao menos duas partes.', 'Define at least two parties.');
        const seenRole = new Set();
        for (const r of roles) {
            const k = camel(r.label);
            if (!words(r.label).length) add('Há parte sem nome.', 'A party has no name.');
            if (seenRole.has(k)) add('Há partes com o mesmo nome: ' + r.label + '.', 'Duplicate party name: ' + r.label + '.');
            seenRole.add(k);
        }
        if (!blocks.length) add('Acrescente ao menos um bloco.', 'Add at least one block.');
        const names = new Set();
        const counts = {};
        for (const b of blocks) {
            const def = BLOCKS[b.type];
            if (!def) { add('Bloco desconhecido.', 'Unknown block.', b.uid); continue; }
            counts[b.type] = (counts[b.type] || 0) + 1;
            if (def.single && counts[b.type] > 1) add('O bloco "' + def.name.pt + '" só pode aparecer uma vez.', 'The "' + def.name.en + '" block can appear only once.', b.uid);
            if (!def.single) {
                const n = pascal(b.label);
                if (names.has(n)) add('Dois blocos com o mesmo nome: ' + b.label + '.', 'Two blocks with the same name: ' + b.label + '.', b.uid);
                names.add(n);
            }
            if (b.texto && missingSlots(b.type, b.texto).length) add('A redação de "' + b.label + '" precisa conter as lacunas: ' + missingSlots(b.type, b.texto).map(k => '{' + k + '}').join(', ') + '.', 'The wording of "' + b.label + '" must contain the blanks: ' + missingSlots(b.type, b.texto).map(k => '{' + k + '}').join(', ') + '.', b.uid);
            if (def.declarative && !String(b.texto || '').trim() && !def.sentence) add('Escreva o texto da cláusula livre.', 'Write the free clause text.', b.uid);
            for (const p of def.params) {
                const v = b.params[p.key];
                if (p.kind === 'role' && !roleIds.has(v)) add('Escolha a parte em "' + b.label + '".', 'Choose the party in "' + b.label + '".', b.uid);
                if (p.kind === 'roleOrAny' && v !== '*' && !roleIds.has(v)) add('Escolha quem pode rescindir.', 'Choose who may terminate.', b.uid);
                if (p.kind === 'ref') {
                    const target = blocks.find(x => x.uid === v);
                    if (!target || !p.accepts.includes(target.type)) add('Indique a qual pagamento se aplica "' + def.name.pt + '".', 'Choose which payment "' + def.name.en + '" applies to.', b.uid);
                }
                if (['money', 'int', 'days', 'percent'].includes(p.kind)) {
                    const n = Number(v);
                    if (!Number.isFinite(n) || n < 0) add('Valor inválido em "' + b.label + '".', 'Invalid value in "' + b.label + '".', b.uid);
                    else {
                        if (p.kind === 'money' && n <= 0) add('Valor deve ser positivo em "' + b.label + '".', 'Amount must be positive in "' + b.label + '".', b.uid);
                        if (p.min != null && n < p.min) add('Valor abaixo do mínimo em "' + b.label + '".', 'Value below minimum in "' + b.label + '".', b.uid);
                        if (p.max != null && n > p.max) add('Valor acima do máximo em "' + b.label + '".', 'Value above maximum in "' + b.label + '".', b.uid);
                        if (p.kind === 'percent' && n > 100) add('Percentual acima de 100% em "' + b.label + '".', 'Percentage above 100% in "' + b.label + '".', b.uid);
                        if ((p.kind === 'int' || p.kind === 'days') && !Number.isInteger(n)) add('Use número inteiro em "' + b.label + '".', 'Use a whole number in "' + b.label + '".', b.uid);
                    }
                }
            }
            const pairs = { pagamentoUnico: ['devedor', 'credor'], pagamentoPeriodico: ['devedor', 'credor'], custodia: ['depositante', 'beneficiario'], etapas: ['contratante', 'contratado'], caucao: ['garantidor', 'beneficiario'] }[b.type];
            if (pairs && b.params[pairs[0]] && b.params[pairs[0]] === b.params[pairs[1]]) add('As partes de "' + b.label + '" devem ser diferentes.', 'The parties in "' + b.label + '" must differ.', b.uid);
            if (b.type === 'etapas' && Number(b.params.etapas) > 0 && toWei(b.params.valor, model.scale) < BigInt(Math.round(b.params.etapas))) add('Valor insuficiente para o número de etapas.', 'Amount too small for the number of milestones.', b.uid);
        }
        const targets = {};
        for (const b of blocks.filter(x => x.type === 'encargos' || x.type === 'vencimentoAntecipado')) {
            const k = b.type + ':' + b.params.alvo;
            if (targets[k]) add('Há dois blocos do mesmo tipo aplicados ao mesmo pagamento.', 'Two blocks of the same type apply to the same payment.', b.uid);
            targets[k] = true;
        }
        const arb = blocks.find(b => b.type === 'arbitro');
        if (arb) {
            for (const b of blocks.filter(x => x.type === 'custodia' || x.type === 'caucao')) {
                if ([b.params.depositante, b.params.beneficiario, b.params.garantidor].includes(arb.params.arbitro)) add('O árbitro não pode ser parte de "' + b.label + '".', 'The arbitrator cannot be a party to "' + b.label + '".', b.uid);
            }
        }
        if (blocks.some(b => b.type === 'caucao') && !blocks.some(b => b.type === 'rescisao' || b.type === 'vigencia' || b.type === 'pagamentoPeriodico' || b.type === 'pagamentoUnico' || b.type === 'etapas' || b.type === 'custodia')) {
            add('A caução só é devolvida após o término: acrescente um bloco que encerre o contrato (obrigação, rescisão ou vigência).', 'The security deposit is returned after the end: add a block that ends the contract (obligation, termination or term).');
        }
        return errs;
    }

    // ------------------------------------------------------------------
    // Contexto de geração (nomes no idioma escolhido)
    // ------------------------------------------------------------------
    function makeCtx(model, lang) {
        const en = lang === 'en';
        const w = (pt, e) => (en ? e : pt);
        const roles = (model.roles || []).map(r => ({ id: r.id, label: r.label, v: camel(r.label), P: pascal(r.label) }));
        const roleById = id => roles.find(r => r.id === id);
        const blocks = (model.blocks || []).map(b => Object.assign({}, b, { I: pascal(b.label), i: camel(b.label), U: upper(b.label) }));
        const byUid = uid => blocks.find(b => b.uid === uid);
        const arb = blocks.find(b => b.type === 'arbitro');
        const arbRole = arb ? roleById(arb.params.arbitro) : null;
        const partyRoles = roles.filter(r => !arbRole || r.id !== arbRole.id);
        const N = {
            Situacao: w('Situacao', 'Status'), situacao: w('situacao', 'status'), Ativo: w('Ativo', 'Active'), Encerrado: w('Encerrado', 'Closed'),
            EstadoGarantia: w('EstadoGarantia', 'HoldState'), Aguardando: w('AguardandoDeposito', 'AwaitingDeposit'), Depositado: w('Depositado', 'Deposited'),
            EmDisputa: w('EmDisputa', 'InDispute'), Concluido: w('Concluido', 'Completed'),
            inicio: w('inicio', 'start'), encerradoEm: w('encerradoEm', 'closedAt'), saldos: w('saldos', 'balances'), sacar: w('sacar', 'withdraw'),
            saldoRetido: w('saldoRetido', 'heldBalance'), travado: w('travado', 'locked'), encerrar: w('_encerrar', '_close'), verificar: w('_verificarConclusao', '_checkCompletion'),
            naSituacao: w('naSituacao', 'inStatus'), apenas: w('apenas', 'only'), Ou: w('Ou', 'Or'), Partes: w('Partes', 'Parties'),
            NaoAutorizado: w('NaoAutorizado', 'Unauthorized'), ParametroInvalido: w('ParametroInvalido', 'InvalidParameter'), SituacaoInvalida: w('SituacaoInvalida', 'InvalidStatus'),
            ValorIncorreto: w('ValorIncorreto', 'WrongAmount'), JaConcluido: w('JaConcluido', 'AlreadyCompleted'), NaoDisponivel: w('NaoDisponivel', 'NotAvailable'),
            PrazoNaoEncerrado: w('PrazoNaoEncerrado', 'DeadlineNotReached'), PrazoEncerrado: w('PrazoEncerrado', 'DeadlinePassed'), SemAtraso: w('SemAtrasoSuficiente', 'NotLateEnough'),
            SemSaldo: w('SemSaldo', 'NothingToWithdraw'), FalhaNoEnvio: w('FalhaNoEnvio', 'TransferFailed'), Reentrada: w('Reentrada', 'Reentrancy'),
            ContratoEncerrado: w('ContratoEncerrado', 'AgreementClosed'), Saque: w('Saque', 'Withdrawal'),
            devido: w('devido', 'due'), enviado: w('enviado', 'sent'), limite: w('limite', 'limit'), valor: w('valor', 'amount'), credor: w('credor', 'payee'), quando: w('quando', 'when')
        };
        const mod = role => N.apenas + role.P;
        const modPair = (a, b) => N.apenas + a.P + N.Ou + b.P;
        const allMoney = blocks.filter(b => ['pagamentoUnico', 'pagamentoPeriodico', 'custodia', 'etapas', 'caucao'].includes(b.type));
        return { lang, en, w, roles, roleById, blocks, byUid, arb, arbRole, partyRoles, N, mod, modPair, scale: model.scale || 1000, name: pascal(model.name || w('Contrato Montado', 'Composed Agreement')), allMoney };
    }

    // ------------------------------------------------------------------
    // Texto natural
    // ------------------------------------------------------------------
    function fillSentence(block, ctx, html) {
        const def = BLOCKS[block.type];
        const lang = ctx.lang;
        let s = block.texto && String(block.texto).trim() ? String(block.texto) : def.sentence[lang === 'en' ? 'en' : 'pt'];
        for (const p of def.params) {
            const v = block.params[p.key];
            let text;
            if (p.kind === 'role') text = (ctx.roleById(v) || {}).label || '—';
            else if (p.kind === 'roleOrAny') text = v === '*' ? ctx.w('Qualquer das partes', 'Either party') : ((ctx.roleById(v) || {}).label || '—');
            else if (p.kind === 'ref') text = (ctx.byUid(v) || {}).label || '—';
            else if (p.kind === 'money') text = money(v, lang);
            else if (p.kind === 'percent') text = num(v, lang) + '%';
            else text = num(v, lang);
            s = s.split('{' + p.key + '}').join(text);
        }
        // Primeira letra maiúscula (o primeiro termo pode ser o nome de uma parte).
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function clauseTitle(block, ctx) {
        const def = BLOCKS[block.type];
        if (def.attached) {
            const target = ctx.byUid(block.params.alvo);
            return def.name[ctx.lang === 'en' ? 'en' : 'pt'] + (target ? ' (' + target.label + ')' : '');
        }
        return def.single ? def.name[ctx.lang === 'en' ? 'en' : 'pt'] : block.label + ' (' + def.name[ctx.lang === 'en' ? 'en' : 'pt'].toLowerCase() + ')';
    }

    /** Minuta em linguagem natural: lista de { numero, titulo, texto }. */
    function minuta(model, lang) {
        const ctx = makeCtx(model, lang);
        const out = [];
        const partes = ctx.roles.map(r => r.label);
        const lista = partes.length > 1 ? partes.slice(0, -1).join(', ') + ctx.w(' e ', ' and ') + partes[partes.length - 1] : partes.join('');
        out.push({
            numero: ordinal(1, lang), titulo: ctx.w('Partes', 'Parties'),
            texto: ctx.w('Figuram neste contrato ' + lista + ', cada qual identificado por seu endereço na "blockchain", informado na implantação.',
                'The parties to this contract are ' + lista + ', each identified by their blockchain address, given at deployment.')
        });
        ctx.blocks.forEach((b, i) => out.push({ numero: ordinal(i + 2, lang), titulo: clauseTitle(b, ctx), texto: fillSentence(b, ctx), uid: b.uid }));
        const n = ctx.blocks.length + 2;
        const q = model.cotacao && Number(model.cotacao.brl) === Number(ctx.scale) ? model.cotacao : null;
        const when = q ? new Date(q.data).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
        out.push({
            numero: ordinal(n, lang), titulo: ctx.w('Pagamentos e saques', 'Payments and withdrawals'),
            texto: q
                ? ctx.w('Os valores devidos a cada parte ficam registrados no contrato e são sacados pelo próprio titular. Os valores em reais foram convertidos em Ether à cotação de R$ ' + num(ctx.scale, lang) + ' por 1 ETH, obtida em ' + when + ' (fonte: ' + q.fonte + '); como a cotação varia, o valor em Ether fica fixado na geração do código.',
                    'Amounts owed to each party are recorded in the contract and withdrawn by their owner. Amounts in BRL were converted into Ether at R$ ' + num(ctx.scale, lang) + ' per 1 ETH, obtained on ' + when + ' (source: ' + q.fonte + '); as the price varies, the Ether amount is fixed when the code is generated.')
                : ctx.w('Os valores devidos a cada parte ficam registrados no contrato e são sacados pelo próprio titular. Os valores em reais foram representados em Ether de teste pela escala de R$ ' + num(ctx.scale, lang) + ' por 1 ETH, convenção didática que não corresponde a cotação.',
                    'Amounts owed to each party are recorded in the contract and withdrawn by their owner. Amounts in BRL are represented in test Ether at R$ ' + num(ctx.scale, lang) + ' per 1 ETH, a didactic convention, not a quotation.')
        });
        return out;
    }

    function commentBlock(text, indent) {
        // Quebra o texto em linhas de até ~96 colunas, como comentário NatSpec.
        const max = 96;
        const lines = [];
        let cur = '';
        for (const word of String(text).split(/\s+/)) {
            if ((cur + ' ' + word).trim().length > max) { lines.push(cur.trim()); cur = word; } else cur += ' ' + word;
        }
        if (cur.trim()) lines.push(cur.trim());
        return lines.map(l => indent + '/// ' + l).join('\n');
    }

    // ------------------------------------------------------------------
    // Geração de código
    // ------------------------------------------------------------------
    function build(model, lang) {
        const ctx = makeCtx(model, lang);
        const { N, w, blocks, roleById } = ctx;
        const I8 = '        ';
        const sections = [];   // blocos de código por cláusula
        const constants = [];
        const state = [];
        const events = [];
        const modifiers = new Map();
        const retained = [];
        const concluded = [];
        const onClose = [];
        let needsBps = false;
        let needsHold = false;

        const useMod = role => {
            const name = ctx.mod(role);
            if (!modifiers.has(name)) modifiers.set(name, `    modifier ${name}() {\n        if (msg.sender != ${role.v}) revert ${N.NaoAutorizado}();\n        _;\n    }`);
            return name;
        };
        const usePair = (a, b) => {
            const name = ctx.modPair(a, b);
            if (!modifiers.has(name)) modifiers.set(name, `    modifier ${name}() {\n        if (msg.sender != ${a.v} && msg.sender != ${b.v}) revert ${N.NaoAutorizado}();\n        _;\n    }`);
            return name;
        };
        const useParties = () => {
            const name = N.apenas + N.Partes;
            if (!modifiers.has(name)) {
                const cond = ctx.partyRoles.map(r => `msg.sender != ${r.v}`).join(' && ');
                modifiers.set(name, `    modifier ${name}() {\n        if (${cond}) revert ${N.NaoAutorizado}();\n        _;\n    }`);
            }
            return name;
        };
        const credit = (role, expr) => `${N.saldos}[${role.v}] += ${expr};`;
        const header = (b, idx) => `    // ${'='.repeat(70)}\n    // ${ordinal(idx + 2, lang)} — ${clauseTitle(b, ctx)}\n${commentBlock(fillSentence(b, ctx), '    ')}\n    // ${'='.repeat(70)}`;

        // Encargos e vencimento antecipado conectados a cada pagamento.
        const encOf = b => blocks.find(x => x.type === 'encargos' && x.params.alvo === b.uid);
        const accOf = b => blocks.find(x => x.type === 'vencimentoAntecipado' && x.params.alvo === b.uid);

        function lateCharges(b, dueExpr, baseExpr) {
            const e = encOf(b);
            if (!e) return '';
            needsBps = true;
            const P = b.U;
            constants.push(`    uint256 public constant ${P}_${w('MULTA_BPS', 'LATE_FEE_BPS')} = ${bps(e.params.multa)}; // ${num(e.params.multa, lang)}%`);
            constants.push(`    uint256 public constant ${P}_${w('JUROS_MENSAIS_BPS', 'MONTHLY_INTEREST_BPS')} = ${bps(e.params.juros)}; // ${num(e.params.juros, lang)}% ${w('ao mês', 'per month')}`);
            constants.push(`    uint256 public constant ${P}_${w('TOLERANCIA', 'GRACE_PERIOD')} = ${Math.round(e.params.tolerancia)} days;`);
            return `
        uint256 ${w('vencimento', 'dueDate')} = ${dueExpr};
        if (block.timestamp > ${w('vencimento', 'dueDate')} + ${P}_${w('TOLERANCIA', 'GRACE_PERIOD')}) {
            // ${w('dias de atraso desde o vencimento, arredondados para cima', 'days late since the due date, rounded up')}
            uint256 ${w('diasAtraso', 'daysLate')} = (block.timestamp - ${w('vencimento', 'dueDate')} + 1 days - 1) / 1 days;
            uint256 ${w('multa', 'fee')} = ${baseExpr} * ${P}_${w('MULTA_BPS', 'LATE_FEE_BPS')} / BPS;
            // ${w('juros simples "pro rata die": multiplica antes de dividir', 'simple pro rata interest: multiply before dividing')}
            uint256 ${w('juros', 'interest')} = ${baseExpr} * ${P}_${w('JUROS_MENSAIS_BPS', 'MONTHLY_INTEREST_BPS')} * ${w('diasAtraso', 'daysLate')} / (BPS * 30);
            ${w('encargos', 'charges')} = ${w('multa', 'fee')} + ${w('juros', 'interest')};
            total += ${w('encargos', 'charges')};
        }`;
        }

        blocks.forEach((b, idx) => {
            const code = [];
            const P = b.U;
            const scale = ctx.scale;
            if (b.type === 'pagamentoUnico') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor);
                const paid = b.i + w('Pago', 'Paid');
                constants.push(`    uint256 public constant ${P}_${w('VALOR', 'AMOUNT')} = ${weiLiteral(toWei(b.params.valor, scale))}; // ${money(b.params.valor, lang)}`);
                constants.push(`    uint256 public constant ${P}_${w('PRAZO', 'DEADLINE')} = ${Math.round(b.params.prazo)} days;`);
                state.push(`    bool public ${paid};`);
                events.push(`    event ${w('Pagamento', 'Payment')}${b.I}(address indexed ${w('pagador', 'payer')}, uint256 ${N.valor}, uint256 ${w('encargos', 'charges')});`);
                const dm = useMod(dev);
                code.push(`    /// @notice ${w('Vencimento do pagamento.', 'Payment due date.')}
    function ${w('vencimento', 'dueDate')}${b.I}() public view returns (uint256) {
        return ${N.inicio} + ${P}_${w('PRAZO', 'DEADLINE')};
    }

    /// @notice ${w('Valor devido agora, com encargos se houver atraso.', 'Amount due now, with charges if late.')}
    function ${w('valorDevido', 'amountDue')}${b.I}() public ${encOf(b) ? 'view' : 'pure'} returns (uint256 total, uint256 ${w('encargos', 'charges')}) {
        total = ${P}_${w('VALOR', 'AMOUNT')};${lateCharges(b, `${w('vencimento', 'dueDate')}${b.I}()`, `${P}_${w('VALOR', 'AMOUNT')}`)}
    }

    /// @notice ${w('Pagamento pelo valor exato devido.', 'Payment of the exact amount due.')}
    function ${w('pagar', 'pay')}${b.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${paid}) revert ${N.JaConcluido}();
        (uint256 total, uint256 ${w('encargos', 'charges')}) = ${w('valorDevido', 'amountDue')}${b.I}();
        if (msg.value != total) revert ${N.ValorIncorreto}(total, msg.value);
        ${paid} = true;
        ${credit(cre, 'msg.value')}
        emit ${w('Pagamento', 'Payment')}${b.I}(msg.sender, msg.value, ${w('encargos', 'charges')});
        ${N.verificar}();
    }`);
                if (!encOf(b)) code[0] = code[0].replace(`returns (uint256 total, uint256 ${w('encargos', 'charges')}) {\n        total = `, `returns (uint256 total, uint256 ${w('encargos', 'charges')}) {\n        ${w('encargos', 'charges')} = 0;\n        total = `);
                concluded.push(paid);
            }

            if (b.type === 'pagamentoPeriodico') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor);
                const pagas = b.i + w('ParcelasPagas', 'PaidInstallments');
                const acc = accOf(b);
                const accFlag = b.i + w('VencidoAntecipadamente', 'Accelerated');
                constants.push(`    uint256 public constant ${P}_${w('VALOR', 'AMOUNT')} = ${weiLiteral(toWei(b.params.valor, scale))}; // ${money(b.params.valor, lang)}`);
                constants.push(`    uint256 public constant ${P}_${w('PARCELAS', 'INSTALLMENTS')} = ${Math.round(b.params.parcelas)};`);
                constants.push(`    uint256 public constant ${P}_${w('PERIODO', 'PERIOD')} = ${Math.round(b.params.periodo)} days;`);
                state.push(`    uint256 public ${pagas};`);
                if (acc) state.push(`    bool public ${accFlag};`);
                events.push(`    event ${w('Pagamento', 'Payment')}${b.I}(address indexed ${w('pagador', 'payer')}, uint256 indexed ${w('parcela', 'installment')}, uint256 ${N.valor}, uint256 ${w('encargos', 'charges')});`);
                const dm = useMod(dev);
                code.push(`    /// @notice ${w('Vencimento da próxima parcela.', 'Due date of the next installment.')}
    /// @dev ${w('LIMITAÇÃO: datas de calendário (ex.: "todo dia 05") foram aproximadas por períodos fixos.', 'LIMITATION: calendar dates (e.g. "every 5th") were approximated by fixed periods.')}
    function ${w('proximoVencimento', 'nextDueDate')}${b.I}() public view returns (uint256) {
        return ${N.inicio} + (${pagas} + 1) * ${P}_${w('PERIODO', 'PERIOD')};
    }

    /// @notice ${w('Valor devido agora pela próxima parcela, com encargos se houver atraso.', 'Amount due now for the next installment, with charges if late.')}
    function ${w('valorDevido', 'amountDue')}${b.I}() public ${encOf(b) ? 'view' : 'pure'} returns (uint256 total, uint256 ${w('encargos', 'charges')}) {
        ${encOf(b) ? '' : w('encargos', 'charges') + ' = 0;\n        '}total = ${P}_${w('VALOR', 'AMOUNT')};${lateCharges(b, `${w('proximoVencimento', 'nextDueDate')}${b.I}()`, `${P}_${w('VALOR', 'AMOUNT')}`)}
    }

    /// @notice ${w('Pagamento da próxima parcela, pelo valor exato devido.', 'Payment of the next installment, for the exact amount due.')}
    function ${w('pagar', 'pay')}${b.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${pagas} == ${P}_${w('PARCELAS', 'INSTALLMENTS')}) revert ${N.JaConcluido}();${acc ? `\n        if (${accFlag}) revert ${N.NaoDisponivel}(); // ${w('após o vencimento antecipado, quita-se o saldo', 'after acceleration, the balance is repaid')}` : ''}
        (uint256 total, uint256 ${w('encargos', 'charges')}) = ${w('valorDevido', 'amountDue')}${b.I}();
        if (msg.value != total) revert ${N.ValorIncorreto}(total, msg.value);
        ${pagas} += 1;
        ${credit(cre, 'msg.value')}
        emit ${w('Pagamento', 'Payment')}${b.I}(msg.sender, ${pagas}, msg.value, ${w('encargos', 'charges')});
        ${N.verificar}();
    }`);
                if (acc) {
                    const cm = useMod(cre);
                    constants.push(`    uint256 public constant ${P}_${w('ATRASO_VENCIMENTO', 'ACCELERATION_DELAY')} = ${Math.round(acc.params.atraso)} days;`);
                    events.push(`    event ${w('VencimentoAntecipado', 'Acceleration')}${b.I}(uint256 ${w('saldoDevedor', 'outstanding')});`);
                    code.push(`
    // ${'-'.repeat(70)}
    // ${ordinal(blocks.indexOf(acc) + 2, lang)} — ${clauseTitle(acc, ctx)}
${commentBlock(fillSentence(acc, ctx), '    ')}
    // ${'-'.repeat(70)}

    /// @notice ${w('Saldo devedor: parcelas ainda não pagas.', 'Outstanding balance: unpaid installments.')}
    function ${w('saldoDevedor', 'outstanding')}${b.I}() public view returns (uint256) {
        return (${P}_${w('PARCELAS', 'INSTALLMENTS')} - ${pagas}) * ${P}_${w('VALOR', 'AMOUNT')};
    }

    /// @notice ${w('Vencimento antecipado, se a parcela em aberto estiver atrasada além do limite.', 'Acceleration, if the open installment is late beyond the limit.')}
    function ${w('declararVencimentoAntecipado', 'declareAcceleration')}${b.I}() external ${cm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${accFlag} || ${pagas} == ${P}_${w('PARCELAS', 'INSTALLMENTS')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${w('proximoVencimento', 'nextDueDate')}${b.I}() + ${P}_${w('ATRASO_VENCIMENTO', 'ACCELERATION_DELAY')};
        if (block.timestamp <= ${N.limite}) revert ${N.SemAtraso}(${N.limite});
        ${accFlag} = true;
        emit ${w('VencimentoAntecipado', 'Acceleration')}${b.I}(${w('saldoDevedor', 'outstanding')}${b.I}());
    }

    /// @notice ${w('Quitação integral do saldo devedor após o vencimento antecipado.', 'Full repayment of the balance after acceleration.')}
    function ${w('quitar', 'repay')}${b.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (!${accFlag}) revert ${N.NaoDisponivel}();
        uint256 ${w('saldo', 'balance')} = ${w('saldoDevedor', 'outstanding')}${b.I}();
        if (msg.value != ${w('saldo', 'balance')}) revert ${N.ValorIncorreto}(${w('saldo', 'balance')}, msg.value);
        ${pagas} = ${P}_${w('PARCELAS', 'INSTALLMENTS')};
        ${credit(cre, 'msg.value')}
        emit ${w('Pagamento', 'Payment')}${b.I}(msg.sender, ${pagas}, msg.value, 0);
        ${N.verificar}();
    }`);
                }
                concluded.push(`${pagas} == ${P}_${w('PARCELAS', 'INSTALLMENTS')}`);
            }

            if (b.type === 'custodia') {
                needsHold = true;
                const dep = roleById(b.params.depositante), ben = roleById(b.params.beneficiario);
                const st = b.i + w('Estado', 'State'), held = b.i + w('Retido', 'Held'), dl = b.i + w('PrazoFinal', 'Deadline');
                constants.push(`    uint256 public constant ${P}_${w('VALOR', 'AMOUNT')} = ${weiLiteral(toWei(b.params.valor, scale))}; // ${money(b.params.valor, lang)}`);
                constants.push(`    uint256 public constant ${P}_${w('PRAZO', 'DEADLINE')} = ${Math.round(b.params.prazo)} days;`);
                state.push(`    ${N.EstadoGarantia} public ${st};`, `    uint256 public ${held};`, `    uint256 public ${dl};`);
                events.push(`    event ${w('Deposito', 'Deposit')}${b.I}(address indexed ${w('depositante', 'depositor')}, uint256 ${N.valor}, uint256 ${w('prazoFinal', 'deadline')});`);
                events.push(`    event ${w('Destinacao', 'Allocation')}${b.I}(address indexed ${w('beneficiario', 'beneficiary')}, uint256 ${N.valor});`);
                const dm = useMod(dep);
                code.push(`    /// @notice ${w('Depósito do valor; inicia a contagem do prazo.', 'Deposit of the amount; starts the deadline.')}
    function ${w('depositar', 'deposit')}${b.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Aguardando}) revert ${N.JaConcluido}();
        if (msg.value != ${P}_${w('VALOR', 'AMOUNT')}) revert ${N.ValorIncorreto}(${P}_${w('VALOR', 'AMOUNT')}, msg.value);
        ${st} = ${N.EstadoGarantia}.${N.Depositado};
        ${held} = msg.value;
        ${dl} = block.timestamp + ${P}_${w('PRAZO', 'DEADLINE')};
        emit ${w('Deposito', 'Deposit')}${b.I}(msg.sender, msg.value, ${dl});
    }

    /// @notice ${w('Confirmação do cumprimento: o valor é liberado ao beneficiário.', 'Confirmation of performance: the amount is released to the beneficiary.')}
    /// @dev ${w('LIMITAÇÃO: o cumprimento no mundo real não é verificável pelo contrato; depende da confirmação da parte.', 'LIMITATION: real-world performance cannot be verified on-chain; it depends on the party\'s confirmation.')}
    function ${w('liberar', 'release')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        _${w('destinar', 'allocate')}${b.I}(${ben.v});
    }

    /// @notice ${w('Devolução ao depositante, esgotado o prazo sem confirmação nem disputa.', 'Refund to the depositor after the deadline without confirmation or dispute.')}
    function ${w('reaver', 'refund')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        if (block.timestamp <= ${dl}) revert ${N.PrazoNaoEncerrado}(${dl});
        _${w('destinar', 'allocate')}${b.I}(${dep.v});
    }`);
                if (ctx.arbRole) {
                    const pm = usePair(dep, ben);
                    const am = useMod(ctx.arbRole);
                    code.push(`
    /// @notice ${w('Qualquer das partes submete a divergência ao árbitro.', 'Either party refers the dispute to the arbitrator.')}
    function ${w('abrirDisputa', 'openDispute')}${b.I}() external ${pm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        ${st} = ${N.EstadoGarantia}.${N.EmDisputa};
    }

    /// @notice ${w('Decisão do árbitro sobre a destinação do valor.', 'Arbitrator\'s decision on where the amount goes.')}
    function ${w('decidirDisputa', 'resolveDispute')}${b.I}(bool ${w('favorBeneficiario', 'favorBeneficiary')}) external ${am} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.EmDisputa}) revert ${N.NaoDisponivel}();
        _${w('destinar', 'allocate')}${b.I}(${w('favorBeneficiario', 'favorBeneficiary')} ? ${ben.v} : ${dep.v});
    }`);
                }
                code.push(`
    function _${w('destinar', 'allocate')}${b.I}(address ${w('destino', 'to')}) private {
        uint256 ${N.valor} = ${held};
        ${held} = 0;
        ${st} = ${N.EstadoGarantia}.${N.Concluido};
        ${N.saldos}[${w('destino', 'to')}] += ${N.valor};
        emit ${w('Destinacao', 'Allocation')}${b.I}(${w('destino', 'to')}, ${N.valor});
        ${N.verificar}();
    }`);
                retained.push(held);
                concluded.push(`${st} == ${N.EstadoGarantia}.${N.Concluido}`);
                onClose.push(`        if (${held} > 0) {
            ${N.saldos}[${dep.v}] += ${held}; // ${w('devolução ao depositante', 'refund to depositor')}
            ${held} = 0;
            ${st} = ${N.EstadoGarantia}.${N.Concluido};
        }`);
            }

            if (b.type === 'etapas') {
                const ct = roleById(b.params.contratante), cd = roleById(b.params.contratado);
                const funded = b.i + w('Depositado', 'Funded'), held = b.i + w('Retido', 'Held'), apr = b.i + w('Aprovadas', 'Approved'), at = b.i + w('EntregueEm', 'DeliveredAt');
                constants.push(`    uint256 public constant ${P}_${w('VALOR_TOTAL', 'TOTAL')} = ${weiLiteral(toWei(b.params.valor, scale))}; // ${money(b.params.valor, lang)}`);
                constants.push(`    uint256 public constant ${P}_${w('ETAPAS', 'MILESTONES')} = ${Math.round(b.params.etapas)};`);
                constants.push(`    uint256 public constant ${P}_${w('PRAZO_APROVACAO', 'APPROVAL_PERIOD')} = ${Math.round(b.params.prazo)} days;`);
                state.push(`    bool public ${funded};`, `    uint256 public ${held};`, `    uint256 public ${apr};`, `    uint256 public ${at}; // ${w('0 enquanto a etapa atual não foi entregue', '0 while the current milestone is not delivered')}`);
                events.push(`    event ${w('Etapa', 'Milestone')}${b.I}(uint256 indexed ${w('etapa', 'milestone')}, string ${w('ato', 'act')}, uint256 ${N.valor});`);
                const cm = useMod(ct), dm = useMod(cd);
                const T = `${P}_${w('VALOR_TOTAL', 'TOTAL')}`, E = `${P}_${w('ETAPAS', 'MILESTONES')}`, A = `${P}_${w('PRAZO_APROVACAO', 'APPROVAL_PERIOD')}`;
                code.push(`    /// @notice ${w('Valor da etapa de índice informado (a última absorve o resto da divisão).', 'Amount of the given milestone (the last absorbs the remainder).')}
    function ${w('valorDaEtapa', 'milestoneAmount')}${b.I}(uint256 ${w('indice', 'index')}) public pure returns (uint256) {
        uint256 base = ${T} / ${E};
        return ${w('indice', 'index')} + 1 == ${E} ? ${T} - base * (${E} - 1) : base;
    }

    /// @notice ${w('Depósito do valor total, retido até a aprovação de cada etapa.', 'Deposit of the total, held until each milestone is approved.')}
    function ${w('depositar', 'fund')}${b.I}() external payable ${cm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${funded}) revert ${N.JaConcluido}();
        if (msg.value != ${T}) revert ${N.ValorIncorreto}(${T}, msg.value);
        ${funded} = true;
        ${held} = msg.value;
        emit ${w('Etapa', 'Milestone')}${b.I}(0, "${w('deposito', 'funded')}", msg.value);
    }

    /// @notice ${w('Registro da entrega da etapa atual.', 'Records delivery of the current milestone.')}
    function ${w('entregar', 'deliver')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (!${funded} || ${at} != 0) revert ${N.NaoDisponivel}();
        ${at} = block.timestamp;
        emit ${w('Etapa', 'Milestone')}${b.I}(${apr} + 1, "${w('entrega', 'delivery')}", 0);
    }

    /// @notice ${w('Aprovação expressa da etapa entregue.', 'Express approval of the delivered milestone.')}
    function ${w('aprovar', 'approve')}${b.I}() external ${cm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${at} == 0) revert ${N.NaoDisponivel}();
        _${w('aprovar', 'approve')}${b.I}();
    }

    /// @notice ${w('Recusa fundamentada, dentro do prazo; a etapa volta a ficar pendente.', 'Reasoned rejection within the period; the milestone returns to pending.')}
    function ${w('recusar', 'reject')}${b.I}(string calldata ${w('motivo', 'reason')}) external ${cm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${at} == 0) revert ${N.NaoDisponivel}();
        if (block.timestamp > ${at} + ${A}) revert ${N.PrazoEncerrado}(${at} + ${A});
        if (bytes(${w('motivo', 'reason')}).length == 0) revert ${N.ParametroInvalido}();
        ${at} = 0;
        emit ${w('Etapa', 'Milestone')}${b.I}(${apr} + 1, ${w('motivo', 'reason')}, 0);
    }

    /// @notice ${w('Aprovação tácita: o silêncio após o prazo importa aprovação.', 'Tacit approval: silence after the period means approval.')}
    /// @dev ${w('LIMITAÇÃO: "dias úteis" foram aproximados por dias corridos.', 'LIMITATION: "business days" were approximated by calendar days.')}
    function ${w('aprovarTacitamente', 'approveByTimeout')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${at} == 0) revert ${N.NaoDisponivel}();
        if (block.timestamp <= ${at} + ${A}) revert ${N.PrazoNaoEncerrado}(${at} + ${A});
        _${w('aprovar', 'approve')}${b.I}();
    }

    function _${w('aprovar', 'approve')}${b.I}() private {
        uint256 ${N.valor} = ${w('valorDaEtapa', 'milestoneAmount')}${b.I}(${apr});
        ${apr} += 1;
        ${at} = 0;
        ${held} -= ${N.valor};
        ${credit(cd, N.valor)}
        emit ${w('Etapa', 'Milestone')}${b.I}(${apr}, "${w('aprovacao', 'approval')}", ${N.valor});
        ${N.verificar}();
    }`);
                retained.push(held);
                concluded.push(`${apr} == ${E}`);
                onClose.push(`        if (${held} > 0) {
            ${N.saldos}[${ct.v}] += ${held}; // ${w('etapas não aprovadas voltam ao contratante', 'unapproved milestones return to the client')}
            ${held} = 0;
        }`);
            }

            if (b.type === 'caucao') {
                needsHold = true;
                const gar = roleById(b.params.garantidor), ben = roleById(b.params.beneficiario);
                const st = b.i + w('Estado', 'State'), held = b.i + w('Retido', 'Held'), claim = b.i + w('Reclamado', 'Claimed');
                constants.push(`    uint256 public constant ${P}_${w('VALOR', 'AMOUNT')} = ${weiLiteral(toWei(b.params.valor, scale))}; // ${money(b.params.valor, lang)}`);
                constants.push(`    uint256 public constant ${P}_${w('PRAZO_DEVOLUCAO', 'RETURN_PERIOD')} = ${Math.round(b.params.prazo)} days;`);
                state.push(`    ${N.EstadoGarantia} public ${st};`, `    uint256 public ${held};`);
                if (ctx.arbRole) state.push(`    uint256 public ${claim};`);
                events.push(`    event ${w('Movimento', 'Movement')}${b.I}(string ${w('ato', 'act')}, address indexed ${w('destino', 'to')}, uint256 ${N.valor});`);
                const gm = useMod(gar), bm = useMod(ben);
                const PR = `${P}_${w('PRAZO_DEVOLUCAO', 'RETURN_PERIOD')}`;
                code.push(`    /// @notice ${w('Prestação da caução durante a vigência do contrato.', 'Provision of the security deposit while the contract is active.')}
    function ${w('depositar', 'deposit')}${b.I}() external payable ${gm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Aguardando}) revert ${N.JaConcluido}();
        if (msg.value != ${P}_${w('VALOR', 'AMOUNT')}) revert ${N.ValorIncorreto}(${P}_${w('VALOR', 'AMOUNT')}, msg.value);
        ${st} = ${N.EstadoGarantia}.${N.Depositado};
        ${held} = msg.value;
        emit ${w('Movimento', 'Movement')}${b.I}("${w('deposito', 'deposit')}", address(this), msg.value);
    }

    /// @notice ${w('Devolução integral pelo beneficiário, após o término do contrato.', 'Full return by the beneficiary after the contract ends.')}
    function ${w('devolver', 'return')}${b.I}() external ${bm} ${N.naSituacao}(${N.Situacao}.${N.Encerrado}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        _${w('repartir', 'split')}${b.I}(0);
    }

    /// @notice ${w('Resgate pelo garantidor, se o beneficiário não se manifestar no prazo após o término.', 'Reclaim by the guarantor if the beneficiary does not act within the period after the end.')}
    function ${w('resgatar', 'reclaim')}${b.I}() external ${gm} ${N.naSituacao}(${N.Situacao}.${N.Encerrado}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        if (block.timestamp <= ${N.encerradoEm} + ${PR}) revert ${N.PrazoNaoEncerrado}(${N.encerradoEm} + ${PR});
        _${w('repartir', 'split')}${b.I}(0);
    }`);
                if (ctx.arbRole) {
                    const am = useMod(ctx.arbRole);
                    code.push(`
    /// @notice ${w('Pedido de retenção (total ou parcial) pelo beneficiário, submetido ao árbitro.', 'Retention claim (full or partial) by the beneficiary, referred to the arbitrator.')}
    function ${w('reter', 'claim')}${b.I}(uint256 ${N.valor}, string calldata ${w('motivo', 'reason')}) external ${bm} ${N.naSituacao}(${N.Situacao}.${N.Encerrado}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        if (${N.valor} == 0 || ${N.valor} > ${held} || bytes(${w('motivo', 'reason')}).length == 0) revert ${N.ParametroInvalido}();
        ${claim} = ${N.valor};
        ${st} = ${N.EstadoGarantia}.${N.EmDisputa};
        emit ${w('Movimento', 'Movement')}${b.I}(${w('motivo', 'reason')}, ${ben.v}, ${N.valor});
    }

    /// @notice ${w('Decisão do árbitro: quanto da caução cabe ao beneficiário (até o valor reclamado).', 'Arbitrator\'s decision: how much of the deposit goes to the beneficiary (up to the claim).')}
    function ${w('decidir', 'resolve')}${b.I}(uint256 ${w('valorAoBeneficiario', 'amountToBeneficiary')}) external ${am} ${N.naSituacao}(${N.Situacao}.${N.Encerrado}) {
        if (${st} != ${N.EstadoGarantia}.${N.EmDisputa}) revert ${N.NaoDisponivel}();
        if (${w('valorAoBeneficiario', 'amountToBeneficiary')} > ${claim}) revert ${N.ParametroInvalido}();
        _${w('repartir', 'split')}${b.I}(${w('valorAoBeneficiario', 'amountToBeneficiary')});
    }`);
                } else {
                    code.push(`
    // ${w('LIMITAÇÃO: sem bloco de árbitro, a retenção da caução não é executável pelo contrato; eventual prejuízo deve ser discutido fora dele.', 'LIMITATION: without an arbitrator block, retention cannot be executed by the contract; any damage must be pursued off-chain.')}`);
                }
                code.push(`
    function _${w('repartir', 'split')}${b.I}(uint256 ${w('aoBeneficiario', 'toBeneficiary')}) private {
        uint256 ${w('restante', 'rest')} = ${held} - ${w('aoBeneficiario', 'toBeneficiary')};
        ${held} = 0;
        ${st} = ${N.EstadoGarantia}.${N.Concluido};
        ${N.saldos}[${ben.v}] += ${w('aoBeneficiario', 'toBeneficiary')};
        ${N.saldos}[${gar.v}] += ${w('restante', 'rest')};
        emit ${w('Movimento', 'Movement')}${b.I}("${w('destinacao', 'allocation')}", ${gar.v}, ${w('restante', 'rest')});
    }`);
                retained.push(held);
            }

            if (b.type === 'clausulaLivre') {
                code.push(`    // ${w('Cláusula declaratória: não é executada pelo contrato. Seu cumprimento depende das partes e, se for o caso, do Poder Judiciário.', 'Declaratory clause: not executed by the contract. Compliance depends on the parties and, where applicable, the courts.')}`);
            }

            if (b.type === 'arbitro') {
                code.push(`    // ${w('O árbitro atua nas funções de disputa das garantias acima e abaixo.', 'The arbitrator acts in the dispute functions of the guarantees.')}`);
            }

            if (b.type === 'rescisao') {
                const m = b.params.quem === '*' ? useParties() : useMod(roleById(b.params.quem));
                events.push(`    event ${w('Rescisao', 'Termination')}(address indexed ${w('parte', 'party')});`);
                code.push(`    /// @notice ${w('Rescisão: encerra o contrato e devolve os valores retidos a quem os depositou.', 'Termination: closes the contract and returns held amounts to whoever deposited them.')}
    function ${w('rescindir', 'terminate')}() external ${m} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        emit ${w('Rescisao', 'Termination')}(msg.sender);
        ${N.encerrar}();
    }`);
            }

            if (b.type === 'vigencia') {
                const m = useParties();
                constants.push(`    uint256 public constant ${w('VIGENCIA', 'TERM')} = ${Math.round(b.params.duracao)} days;`);
                code.push(`    /// @notice ${w('Encerramento pelo decurso do prazo de vigência.', 'Closing at the end of the term.')}
    function ${w('encerrarPorDecursoDoPrazo', 'closeAtTerm')}() external ${m} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        uint256 ${N.limite} = ${N.inicio} + ${w('VIGENCIA', 'TERM')};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        ${N.encerrar}();
    }`);
            }

            sections.push(header(b, idx) + '\n\n' + code.join('\n'));
        });

        // ---------------- Montagem do arquivo ----------------
        const L = (pt, en) => w(pt, en);
        const minutaTxt = minuta(model, lang);
        const roleParams = ctx.roles.map(r => `address _${r.v}`).join(', ');
        const roleChecks = ctx.roles.map(r => `_${r.v} == address(0)`).join(' || ');
        const distinct = [];
        for (let a = 0; a < ctx.roles.length; a++) for (let c = a + 1; c < ctx.roles.length; c++) distinct.push(`_${ctx.roles[a].v} == _${ctx.roles[c].v}`);
        const lines = [];
        lines.push('// SPDX-License-Identifier: UNLICENSED');
        lines.push(`pragma solidity ${SOLC_VERSION};`);
        lines.push('');
        lines.push('// ' + L('ATENÇÃO: esqueleto montado a partir de blocos revisados (sem IA). Requer revisão profissional antes de qualquer uso.', 'WARNING: skeleton assembled from reviewed blocks (no AI). Requires professional review before any use.'));
        lines.push('// ' + L('Gerado com o Conversor Contratual', 'Generated with the Contract Converter') + ' (github.com/EduChacon/conversor_smartcontract)');
        lines.push('');
        lines.push(`/// @title ${ctx.name}`);
        lines.push('/// @notice ' + L('Contrato montado por blocos. Cada seção abaixo transcreve, em comentário, a cláusula que implementa.', 'Contract assembled from blocks. Each section below quotes, as a comment, the clause it implements.'));
        lines.push(`contract ${ctx.name} {`);
        lines.push(`    enum ${N.Situacao} { ${N.Ativo}, ${N.Encerrado} }`);
        if (needsHold) lines.push(`    enum ${N.EstadoGarantia} { ${N.Aguardando}, ${N.Depositado}, ${N.EmDisputa}, ${N.Concluido} }`);
        lines.push('');
        lines.push(`    error ${N.NaoAutorizado}();`);
        lines.push(`    error ${N.ParametroInvalido}();`);
        lines.push(`    error ${N.SituacaoInvalida}();`);
        lines.push(`    error ${N.ValorIncorreto}(uint256 ${N.devido}, uint256 ${N.enviado});`);
        lines.push(`    error ${N.JaConcluido}();`);
        lines.push(`    error ${N.NaoDisponivel}();`);
        lines.push(`    error ${N.PrazoNaoEncerrado}(uint256 ${N.limite});`);
        lines.push(`    error ${N.PrazoEncerrado}(uint256 ${N.limite});`);
        lines.push(`    error ${N.SemAtraso}(uint256 ${N.limite});`);
        lines.push(`    error ${N.SemSaldo}();`);
        lines.push(`    error ${N.FalhaNoEnvio}();`);
        lines.push(`    error ${N.Reentrada}();`);
        lines.push('');
        lines.push(`    event ${N.ContratoEncerrado}(uint256 ${N.quando});`);
        lines.push(`    event ${N.Saque}(address indexed ${N.credor}, uint256 ${N.valor});`);
        events.forEach(e => lines.push(e));
        lines.push('');
        lines.push('    // ' + minutaTxt[0].numero + ' — ' + minutaTxt[0].titulo);
        lines.push(commentBlock(minutaTxt[0].texto, '    '));
        ctx.roles.forEach(r => lines.push(`    address public immutable ${r.v};`));
        lines.push(`    uint256 public immutable ${N.inicio};`);
        lines.push('');
        if (needsBps) lines.push(`    uint256 private constant BPS = 10_000; // ${L('100% em pontos-base', '100% in basis points')}`);
        constants.forEach(c => lines.push(c));
        lines.push('');
        lines.push(`    ${N.Situacao} public ${N.situacao};`);
        lines.push(`    uint256 public ${N.encerradoEm};`);
        lines.push(`    mapping(address => uint256) public ${N.saldos};`);
        lines.push(`    bool private ${N.travado};`);
        state.forEach(s => lines.push(s));
        lines.push('');
        for (const m of modifiers.values()) { lines.push(m); lines.push(''); }
        lines.push(`    modifier ${N.naSituacao}(${N.Situacao} s) {\n        if (${N.situacao} != s) revert ${N.SituacaoInvalida}();\n        _;\n    }`);
        lines.push('');
        lines.push(`    modifier nonReentrant() {\n        if (${N.travado}) revert ${N.Reentrada}();\n        ${N.travado} = true;\n        _;\n        ${N.travado} = false;\n    }`);
        lines.push('');
        lines.push(`    constructor(${roleParams}) {`);
        lines.push(`        if (${roleChecks}) revert ${N.ParametroInvalido}();`);
        if (distinct.length) lines.push(`        if (${distinct.join(' || ')}) revert ${N.ParametroInvalido}();`);
        ctx.roles.forEach(r => lines.push(`        ${r.v} = _${r.v};`));
        lines.push(`        ${N.inicio} = block.timestamp;`);
        lines.push('    }');
        lines.push('');
        sections.forEach(s => { lines.push(s); lines.push(''); });
        lines.push(`    // ${'='.repeat(70)}`);
        lines.push(`    // ${minutaTxt[minutaTxt.length - 1].numero} — ${minutaTxt[minutaTxt.length - 1].titulo}`);
        lines.push(commentBlock(minutaTxt[minutaTxt.length - 1].texto, '    '));
        lines.push(`    // ${'='.repeat(70)}`);
        lines.push('');
        lines.push(`    /// @notice ${L('Soma dos valores retidos em garantias e etapas (ainda não destinados a ninguém).', 'Sum of amounts held in guarantees and milestones (not yet allocated).')}`);
        lines.push(`    function ${N.saldoRetido}() public ${retained.length ? 'view' : 'pure'} returns (uint256) {`);
        lines.push(`        return ${retained.length ? retained.join(' + ') : '0'};`);
        lines.push('    }');
        lines.push('');
        lines.push(`    /// @notice ${L('Encerra o contrato e devolve os valores retidos a quem os depositou.', 'Closes the contract and returns held amounts to whoever deposited them.')}`);
        lines.push(`    function ${N.encerrar}() private {`);
        lines.push(`        ${N.situacao} = ${N.Situacao}.${N.Encerrado};`);
        lines.push(`        ${N.encerradoEm} = block.timestamp;`);
        onClose.forEach(c => lines.push(c));
        lines.push(`        emit ${N.ContratoEncerrado}(block.timestamp);`);
        lines.push('    }');
        lines.push('');
        lines.push(`    /// @notice ${L('Encerra o contrato quando todas as obrigações estiverem cumpridas.', 'Closes the contract once all obligations are fulfilled.')}`);
        lines.push(`    function ${N.verificar}() private {`);
        if (concluded.length) {
            lines.push(`        if (${N.situacao} == ${N.Situacao}.${N.Ativo} && ${concluded.join(' && ')}) ${N.encerrar}();`);
        }
        lines.push('    }');
        lines.push('');
        lines.push(`    /// @notice ${L('Saque do crédito disponível pelo próprio titular (padrão "pull payment").', 'Withdrawal of available credit by its owner ("pull payment" pattern).')}`);
        lines.push(`    function ${N.sacar}() external nonReentrant {`);
        lines.push(`        uint256 ${N.valor} = ${N.saldos}[msg.sender];`);
        lines.push(`        if (${N.valor} == 0) revert ${N.SemSaldo}();`);
        lines.push(`        ${N.saldos}[msg.sender] = 0; // ${L('efeito antes da interação', 'effect before interaction')}`);
        lines.push(`        (bool ok, ) = payable(msg.sender).call{value: ${N.valor}}("");`);
        lines.push(`        if (!ok) revert ${N.FalhaNoEnvio}();`);
        lines.push(`        emit ${N.Saque}(msg.sender, ${N.valor});`);
        lines.push('    }');
        lines.push('}');
        lines.push('');
        lines.push('// ' + L('Lembre-se: ESTE CÓDIGO É UM PONTO DE PARTIDA E NECESSITA DE REVISÃO E ADAPTAÇÃO POR UM ESPECIALISTA ANTES DE QUALQUER USO.', 'Remember: THIS CODE IS A STARTING POINT AND MUST BE REVIEWED AND ADAPTED BY AN EXPERT BEFORE ANY USE.'));
        return lines.join('\n') + '\n';
    }

    // ------------------------------------------------------------------
    // Cenários de teste
    // ------------------------------------------------------------------
    function plan(model, lang) {
        const ctx = makeCtx(model, lang);
        const { N, w, blocks, roleById } = ctx;
        const R = role => '@' + role.label.replace(/^@/, '');
        const amount = v => etherString(toWei(v, ctx.scale));
        const half = v => etherString(toWei(v, ctx.scale) / 2n);
        const call = (who, fn, args, valor, esperado, erro, exp) => {
            const s = { acao: 'chamar', conta: who, funcao: fn, argumentos: args || [], esperado, explicacao: exp };
            if (valor) s.valor = valor;
            if (erro) s.erroEsperado = erro;
            return s;
        };
        const query = (who, fn, args, res, exp) => ({ acao: 'consultar', conta: who, funcao: fn, argumentos: args || [], esperado: 'sucesso', resultadoEsperado: res, explicacao: exp });
        const wait = (days, exp) => ({ acao: 'avancarTempo', segundos: days + ' days', explicacao: exp });
        const solv = () => ({ acao: 'verificarSolvencia', saldos: N.saldos, retido: N.saldoRetido, explicacao: w('O saldo do contrato deve ser igual à soma dos créditos das partes mais os valores retidos.', 'The contract balance must equal the parties\' credits plus held amounts.') });
        const sc = (titulo, tipo, objetivo, passos) => ({ titulo, tipo, objetivo, passos: passos.concat([solv()]) });
        const attacker = '@' + w('Atacante', 'Attacker');
        const anyParty = ctx.partyRoles[0];
        const scenarios = [];
        const rescisao = blocks.find(b => b.type === 'rescisao');
        const vigencia = blocks.find(b => b.type === 'vigencia');
        const closeSteps = () => {
            if (rescisao) {
                const who = rescisao.params.quem === '*' ? anyParty : roleById(rescisao.params.quem);
                return [call(R(who), w('rescindir', 'terminate'), [], null, 'sucesso', null, w('O contrato é rescindido.', 'The contract is terminated.'))];
            }
            if (vigencia) {
                return [wait(Math.round(vigencia.params.duracao) + 1, w('O prazo de vigência se esgota.', 'The term ends.')),
                    call(R(anyParty), w('encerrarPorDecursoDoPrazo', 'closeAtTerm'), [], null, 'sucesso', null, w('Encerramento pelo decurso do prazo.', 'Closing at the end of the term.'))];
            }
            return null;
        };

        for (const b of blocks) {
            const I = b.I;
            if (b.type === 'pagamentoUnico' || b.type === 'pagamentoPeriodico') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor);
                const periodic = b.type === 'pagamentoPeriodico';
                const pay = w('pagar', 'pay') + I;
                const due = w('valorDevido', 'amountDue') + I;
                scenarios.push(sc(w(`${b.label}: pagamento em dia e saque`, `${b.label}: on-time payment and withdrawal`), 'funcionalidade',
                    w(`${dev.label} paga o valor exato e ${cre.label} saca o crédito.`, `${dev.label} pays the exact amount and ${cre.label} withdraws the credit.`), [
                        call(R(dev), pay, [], amount(b.params.valor), 'sucesso', null, w('Pagamento no prazo.', 'On-time payment.')),
                        periodic ? query(R(cre), b.i + w('ParcelasPagas', 'PaidInstallments'), [], '1', w('Uma parcela registrada.', 'One installment recorded.'))
                            : query(R(cre), b.i + w('Pago', 'Paid'), [], 'true', w('Pagamento registrado.', 'Payment recorded.')),
                        call(R(cre), N.sacar, [], null, 'sucesso', null, w('O credor saca.', 'The payee withdraws.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: valor incorreto`, `${b.label}: wrong amount`), 'seguranca',
                    w('O contrato exige o valor exato; pagamento parcial é recusado.', 'The contract requires the exact amount; partial payment is rejected.'), [
                        call(R(dev), pay, [], half(b.params.valor), 'reverter', N.ValorIncorreto, w('Metade do valor deve ser recusada.', 'Half the amount must be rejected.'))
                    ]));
                if (!periodic) {
                    scenarios.push(sc(w(`${b.label}: pagamento em duplicidade`, `${b.label}: duplicate payment`), 'seguranca',
                        w('O mesmo pagamento não pode ser feito duas vezes.', 'The same payment cannot be made twice.'), [
                            call(R(dev), pay, [], amount(b.params.valor), 'sucesso', null, w('Primeiro pagamento.', 'First payment.')),
                            call(R(dev), pay, [], amount(b.params.valor), 'reverter', N.JaConcluido + '|' + N.SituacaoInvalida, w('O segundo deve ser recusado.', 'The second must be rejected.'))
                        ]));
                }
                const enc = blocks.find(x => x.type === 'encargos' && x.params.alvo === b.uid);
                if (enc && (Number(enc.params.multa) > 0 || Number(enc.params.juros) > 0)) {
                    const late = Math.round(periodic ? b.params.periodo : b.params.prazo) + Math.round(enc.params.tolerancia) + 10;
                    scenarios.push(sc(w(`${b.label}: atraso com multa e juros`, `${b.label}: late payment with fee and interest`), 'funcionalidade',
                        w('Após o vencimento e a tolerância, o valor sem encargos é recusado e o valor com encargos é aceito.', 'After the due date and grace period, the amount without charges is rejected and the amount with charges is accepted.'), [
                            wait(late, w('O pagamento atrasa.', 'The payment is late.')),
                            call(R(dev), pay, [], amount(b.params.valor), 'reverter', N.ValorIncorreto, w('Sem os encargos, o pagamento é recusado.', 'Without charges, payment is rejected.')),
                            query(R(dev), due, [], null, w('Consulta do valor atualizado.', 'Query of the updated amount.')),
                            call(R(dev), pay, [], '=' + due, 'sucesso', null, w('Pagamento com encargos.', 'Payment with charges.'))
                        ]));
                }
                const acc = blocks.find(x => x.type === 'vencimentoAntecipado' && x.params.alvo === b.uid);
                if (acc && periodic) {
                    const P = Math.round(b.params.periodo), A = Math.round(acc.params.atraso);
                    scenarios.push(sc(w(`${b.label}: vencimento antecipado`, `${b.label}: acceleration`), 'funcionalidade',
                        w('Antes do atraso previsto a antecipação é recusada; depois, o credor antecipa e o devedor quita o saldo.', 'Before the contractual delay acceleration is rejected; afterwards the creditor accelerates and the debtor repays the balance.'), [
                            wait(P + Math.max(1, Math.floor(A / 2)), w('Atraso menor que o limite.', 'Delay below the limit.')),
                            call(R(cre), w('declararVencimentoAntecipado', 'declareAcceleration') + I, [], null, 'reverter', N.SemAtraso, w('Ainda não cabe antecipar.', 'Too early to accelerate.')),
                            wait(A, w('O atraso supera o limite.', 'The delay exceeds the limit.')),
                            call(R(cre), w('declararVencimentoAntecipado', 'declareAcceleration') + I, [], null, 'sucesso', null, w('Vencimento antecipado declarado.', 'Acceleration declared.')),
                            call(R(dev), pay, [], amount(b.params.valor), 'reverter', N.NaoDisponivel + '|' + N.ValorIncorreto, w('Parcelas avulsas deixam de ser aceitas.', 'Single installments are no longer accepted.')),
                            call(R(dev), w('quitar', 'repay') + I, [], '=' + w('saldoDevedor', 'outstanding') + I, 'sucesso', null, w('Quitação do saldo devedor.', 'Repayment of the balance.'))
                        ]));
                }
                if (periodic && Number(b.params.parcelas) <= 12) {
                    const steps = [];
                    for (let k = 0; k < Number(b.params.parcelas); k++) steps.push(call(R(dev), pay, [], amount(b.params.valor), 'sucesso', null, w('Parcela ', 'Installment ') + (k + 1) + '.'));
                    steps.push(call(R(dev), pay, [], amount(b.params.valor), 'reverter', N.JaConcluido + '|' + N.SituacaoInvalida, w('Não há parcela além da última.', 'There is no installment after the last.')));
                    scenarios.push(sc(w(`${b.label}: quitação de todas as parcelas`, `${b.label}: all installments paid`), 'funcionalidade',
                        w('Pagas todas as parcelas, novos pagamentos são recusados.', 'Once all installments are paid, further payments are rejected.'), steps));
                }
            }

            if (b.type === 'custodia') {
                const dep = roleById(b.params.depositante), ben = roleById(b.params.beneficiario);
                const D = w('depositar', 'deposit') + I;
                scenarios.push(sc(w(`${b.label}: depósito e liberação`, `${b.label}: deposit and release`), 'funcionalidade',
                    w(`O valor fica retido e é liberado a ${ben.label} com a confirmação de ${dep.label}.`, `The amount is held and released to ${ben.label} upon ${dep.label}'s confirmation.`), [
                        call(R(dep), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                        query(R(dep), N.saldoRetido, [], amount(b.params.valor), w('O valor está retido no contrato.', 'The amount is held in the contract.')),
                        call(R(ben), w('liberar', 'release') + I, [], null, 'reverter', N.NaoAutorizado, w('O beneficiário não pode liberar para si.', 'The beneficiary cannot release to itself.')),
                        call(R(dep), w('liberar', 'release') + I, [], null, 'sucesso', null, w('O depositante confirma e libera.', 'The depositor confirms and releases.')),
                        call(R(ben), N.sacar, [], null, 'sucesso', null, w('O beneficiário saca.', 'The beneficiary withdraws.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: devolução por falta de confirmação`, `${b.label}: refund without confirmation`), 'funcionalidade',
                    w('Antes do prazo a devolução é recusada; depois, o depositante reaver o valor.', 'Before the deadline the refund is rejected; afterwards the depositor recovers the amount.'), [
                        call(R(dep), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                        call(R(dep), w('reaver', 'refund') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo.', 'Still within the deadline.')),
                        wait(Math.round(b.params.prazo) + 1, w('O prazo se esgota.', 'The deadline passes.')),
                        call(R(dep), w('reaver', 'refund') + I, [], null, 'sucesso', null, w('Devolução.', 'Refund.')),
                        call(R(dep), N.sacar, [], null, 'sucesso', null, w('O depositante saca.', 'The depositor withdraws.'))
                    ]));
                if (ctx.arbRole) {
                    scenarios.push(sc(w(`${b.label}: disputa decidida pelo árbitro`, `${b.label}: dispute decided by the arbitrator`), 'funcionalidade',
                        w('Havendo divergência, só o árbitro decide a destinação.', 'In a dispute, only the arbitrator decides where the funds go.'), [
                            call(R(dep), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                            call(R(ben), w('abrirDisputa', 'openDispute') + I, [], null, 'sucesso', null, w('Disputa aberta.', 'Dispute opened.')),
                            call(R(ctx.arbRole), w('decidirDisputa', 'resolveDispute') + I, ['true'], null, 'sucesso', null, w('O árbitro decide a favor do beneficiário.', 'The arbitrator decides for the beneficiary.')),
                            call(R(ben), N.sacar, [], null, 'sucesso', null, w('O beneficiário saca.', 'The beneficiary withdraws.'))
                        ]));
                }
            }

            if (b.type === 'etapas') {
                const ct = roleById(b.params.contratante), cd = roleById(b.params.contratado);
                const D = w('depositar', 'fund') + I, E = w('entregar', 'deliver') + I;
                scenarios.push(sc(w(`${b.label}: etapa entregue, aprovada e paga`, `${b.label}: milestone delivered, approved and paid`), 'funcionalidade',
                    w('Fluxo normal de uma etapa.', 'Normal flow of a milestone.'), [
                        call(R(ct), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito do total.', 'Total deposited.')),
                        call(R(cd), E, [], null, 'sucesso', null, w('Entrega.', 'Delivery.')),
                        call(R(cd), w('aprovar', 'approve') + I, [], null, 'reverter', N.NaoAutorizado, w('O contratado não aprova a própria entrega.', 'The contractor cannot approve its own delivery.')),
                        call(R(ct), w('aprovar', 'approve') + I, [], null, 'sucesso', null, w('Aprovação.', 'Approval.')),
                        call(R(cd), N.sacar, [], null, 'sucesso', null, w('O contratado saca a etapa.', 'The contractor withdraws the milestone.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: aprovação tácita`, `${b.label}: tacit approval`), 'funcionalidade',
                    w('Antes do prazo a aprovação tácita é recusada; depois, é aceita.', 'Before the period tacit approval is rejected; afterwards it is accepted.'), [
                        call(R(ct), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                        call(R(cd), E, [], null, 'sucesso', null, w('Entrega.', 'Delivery.')),
                        call(R(cd), w('aprovarTacitamente', 'approveByTimeout') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo.', 'Still within the period.')),
                        wait(Math.round(b.params.prazo) + 1, w('O prazo de aprovação se esgota.', 'The approval period ends.')),
                        call(R(cd), w('aprovarTacitamente', 'approveByTimeout') + I, [], null, 'sucesso', null, w('Aprovação tácita.', 'Tacit approval.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: recusa fundamentada`, `${b.label}: reasoned rejection`), 'funcionalidade',
                    w('A recusa devolve a etapa à situação de pendente.', 'Rejection returns the milestone to pending.'), [
                        call(R(ct), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                        call(R(cd), E, [], null, 'sucesso', null, w('Entrega.', 'Delivery.')),
                        call(R(ct), w('recusar', 'reject') + I, [w('Entrega incompleta', 'Incomplete delivery')], null, 'sucesso', null, w('Recusa com motivo.', 'Rejection with reason.')),
                        call(R(ct), w('aprovar', 'approve') + I, [], null, 'reverter', N.NaoDisponivel, w('Sem nova entrega não há o que aprovar.', 'Without a new delivery there is nothing to approve.'))
                    ]));
            }

            if (b.type === 'caucao') {
                const gar = roleById(b.params.garantidor), ben = roleById(b.params.beneficiario);
                const close = closeSteps();
                const D = w('depositar', 'deposit') + I;
                scenarios.push(sc(w(`${b.label}: devolução antes do término`, `${b.label}: return before the end`), 'seguranca',
                    w('A caução só pode ser devolvida ou resgatada após o término do contrato.', 'The deposit can only be returned or reclaimed after the contract ends.'), [
                        call(R(gar), D, [], amount(b.params.valor), 'sucesso', null, w('Prestação da caução.', 'Deposit provided.')),
                        call(R(gar), w('resgatar', 'reclaim') + I, [], null, 'reverter', N.SituacaoInvalida, w('Com o contrato ativo, o resgate é recusado.', 'While active, reclaiming is rejected.'))
                    ]));
                if (close) {
                    scenarios.push(sc(w(`${b.label}: devolução após o término`, `${b.label}: return after the end`), 'funcionalidade',
                        w('Encerrado o contrato, o beneficiário devolve a caução ao garantidor.', 'Once closed, the beneficiary returns the deposit to the guarantor.'), [
                            call(R(gar), D, [], amount(b.params.valor), 'sucesso', null, w('Prestação da caução.', 'Deposit provided.')),
                            ...close,
                            call(R(ben), w('devolver', 'return') + I, [], null, 'sucesso', null, w('Devolução pelo beneficiário.', 'Return by the beneficiary.')),
                            call(R(gar), N.sacar, [], null, 'sucesso', null, w('O garantidor saca.', 'The guarantor withdraws.'))
                        ]));
                    scenarios.push(sc(w(`${b.label}: resgate pelo silêncio do beneficiário`, `${b.label}: reclaim after the beneficiary's silence`), 'funcionalidade',
                        w('Antes do prazo o resgate é recusado; depois, o garantidor resgata.', 'Before the period reclaiming is rejected; afterwards the guarantor reclaims.'), [
                            call(R(gar), D, [], amount(b.params.valor), 'sucesso', null, w('Prestação da caução.', 'Deposit provided.')),
                            ...close,
                            call(R(gar), w('resgatar', 'reclaim') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo do beneficiário.', 'Still within the beneficiary\'s period.')),
                            wait(Math.round(b.params.prazo) + 1, w('O prazo se esgota.', 'The period ends.')),
                            call(R(gar), w('resgatar', 'reclaim') + I, [], null, 'sucesso', null, w('Resgate.', 'Reclaim.'))
                        ]));
                    if (ctx.arbRole) {
                        scenarios.push(sc(w(`${b.label}: retenção decidida pelo árbitro`, `${b.label}: retention decided by the arbitrator`), 'funcionalidade',
                            w('O beneficiário pede retenção parcial; o árbitro decide e o restante volta ao garantidor.', 'The beneficiary claims partial retention; the arbitrator decides and the rest returns to the guarantor.'), [
                                call(R(gar), D, [], amount(b.params.valor), 'sucesso', null, w('Prestação da caução.', 'Deposit provided.')),
                                ...close,
                                call(R(ben), w('reter', 'claim') + I, [half(b.params.valor), w('Danos no imóvel', 'Property damage')], null, 'sucesso', null, w('Pedido de retenção de metade.', 'Claim for half.')),
                                call(R(ctx.arbRole), w('decidir', 'resolve') + I, [amount(b.params.valor)], null, 'reverter', N.ParametroInvalido, w('O árbitro não pode conceder mais que o pedido.', 'The arbitrator cannot grant more than claimed.')),
                                call(R(ctx.arbRole), w('decidir', 'resolve') + I, [half(b.params.valor)], null, 'sucesso', null, w('Decisão do árbitro.', 'Arbitrator\'s decision.')),
                                call(R(ben), N.sacar, [], null, 'sucesso', null, w('O beneficiário saca a parte retida.', 'The beneficiary withdraws the retained part.')),
                                call(R(gar), N.sacar, [], null, 'sucesso', null, w('O garantidor saca o restante.', 'The guarantor withdraws the rest.'))
                            ]));
                    }
                }
            }

            if (b.type === 'rescisao') {
                const who = b.params.quem === '*' ? anyParty : roleById(b.params.quem);
                const holder = blocks.find(x => x.type === 'custodia' || x.type === 'etapas');
                const steps = [];
                if (holder) {
                    const payer = roleById(holder.type === 'custodia' ? holder.params.depositante : holder.params.contratante);
                    steps.push(call(R(payer), (holder.type === 'custodia' ? w('depositar', 'deposit') : w('depositar', 'fund')) + holder.I, [], amount(holder.params.valor), 'sucesso', null, w('Valor retido no contrato.', 'Amount held in the contract.')));
                }
                steps.push(call(R(who), w('rescindir', 'terminate'), [], null, 'sucesso', null, w('Rescisão.', 'Termination.')));
                steps.push(query(R(who), N.situacao, [], '1', w('O contrato fica encerrado.', 'The contract is closed.')));
                steps.push(query(R(who), N.saldoRetido, [], '0', w('Nenhum valor permanece retido.', 'No amount remains held.')));
                if (holder) {
                    const payer = roleById(holder.type === 'custodia' ? holder.params.depositante : holder.params.contratante);
                    steps.push(call(R(payer), N.sacar, [], null, 'sucesso', null, w('Quem depositou recupera o valor.', 'The depositor recovers the amount.')));
                }
                steps.push(call(R(who), w('rescindir', 'terminate'), [], null, 'reverter', N.SituacaoInvalida, w('Não se rescinde duas vezes.', 'Cannot terminate twice.')));
                scenarios.push(sc(w('Rescisão e devolução dos valores retidos', 'Termination and refund of held amounts'), 'funcionalidade',
                    w('A rescisão encerra o contrato e devolve o que estava retido.', 'Termination closes the contract and refunds what was held.'), steps));
            }

            if (b.type === 'vigencia') {
                scenarios.push(sc(w('Encerramento pelo prazo de vigência', 'Closing at the end of the term'), 'funcionalidade',
                    w('Antes do prazo o encerramento é recusado; depois, é aceito.', 'Before the term closing is rejected; afterwards it is accepted.'), [
                        call(R(anyParty), w('encerrarPorDecursoDoPrazo', 'closeAtTerm'), [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda vigente.', 'Still in force.')),
                        wait(Math.round(b.params.duracao) + 1, w('O prazo se esgota.', 'The term ends.')),
                        call(R(anyParty), w('encerrarPorDecursoDoPrazo', 'closeAtTerm'), [], null, 'sucesso', null, w('Encerramento.', 'Closing.')),
                        query(R(anyParty), N.situacao, [], '1', w('Contrato encerrado.', 'Contract closed.'))
                    ]));
            }
        }

        // Teste genérico: o Atacante tenta todas as funções que alteram o estado.
        scenarios.push({ titulo: w('Conta não autorizada tenta executar cada função', 'Unauthorized account tries every function'), tipo: 'seguranca',
            objetivo: w('Toda função que altera o estado deve recusar quem não é a parte legitimada.', 'Every state-changing function must reject anyone who is not the entitled party.'),
            passos: [{ acao: 'atacarTodas', conta: attacker, ignorar: [N.sacar], erroEsperado: N.NaoAutorizado, explicacao: w('Chamada de cada função pela conta do Atacante.', 'Each function called by the Attacker account.') }, solv()] });

        const moneyTotal = ctx.allMoney.reduce((s, b) => s + Number(b.params.valor) * (b.type === 'pagamentoPeriodico' ? Number(b.params.parcelas) : 1), 0);
        const balance = String(Math.max(100, Math.ceil(moneyTotal / ctx.scale * 2 + 10)));
        return {
            contrato: ctx.name,
            contas: ctx.roles.map(r => ({ nome: r.label, saldoEther: balance })).concat([{ nome: w('Atacante', 'Attacker'), saldoEther: balance }]),
            implantacao: { conta: R(ctx.roles[0]), argumentos: ctx.roles.map(r => R(r)) },
            cenarios: scenarios,
            origem: 'modelo'
        };
    }

    // ------------------------------------------------------------------
    // Exemplos de montagem
    // ------------------------------------------------------------------
    function preset(id, lang) {
        const en = lang === 'en';
        const r = (key, pt, e) => ({ id: key, label: en ? e : pt });
        const blk = (type, label, params) => ({ uid: 'p_' + type + '_' + pascal(label), type, label, params });
        const P = {
            locacao: () => ({
                name: en ? 'Lease Agreement' : 'Contrato de Locacao', scale: 1000,
                roles: [r('locador', 'Locador', 'Landlord'), r('locatario', 'Locatário', 'Tenant'), r('arbitro', 'Árbitro', 'Arbitrator')],
                blocks: [
                    blk('pagamentoPeriodico', en ? 'Rent' : 'Aluguel', { devedor: 'locatario', credor: 'locador', valor: 2000, parcelas: 12, periodo: 30 }),
                    blk('encargos', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'Rent' : 'Aluguel'), multa: 10, juros: 1, tolerancia: 0 }),
                    blk('caucao', en ? 'Security' : 'Caução', { garantidor: 'locatario', beneficiario: 'locador', valor: 6000, prazo: 30 }),
                    blk('arbitro', '', { arbitro: 'arbitro' }),
                    blk('rescisao', '', { quem: '*' }),
                    Object.assign(blk('clausulaLivre', en ? 'Jurisdiction' : 'Foro', {}), { texto: BLOCKS.clausulaLivre.sentence[en ? 'en' : 'pt'] })
                ]
            }),
            compraParcelada: () => ({
                name: en ? 'Installment Sale' : 'Compra e Venda Parcelada', scale: 1000,
                roles: [r('vendedor', 'Vendedor', 'Seller'), r('comprador', 'Comprador', 'Buyer')],
                blocks: [
                    blk('pagamentoUnico', en ? 'Down Payment' : 'Entrada', { devedor: 'comprador', credor: 'vendedor', valor: 10000, prazo: 5 }),
                    blk('pagamentoPeriodico', en ? 'Installment' : 'Prestação', { devedor: 'comprador', credor: 'vendedor', valor: 2000, parcelas: 10, periodo: 30 }),
                    blk('encargos', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'Installment' : 'Prestacao'), multa: 2, juros: 1, tolerancia: 3 }),
                    blk('vencimentoAntecipado', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'Installment' : 'Prestacao'), atraso: 60 })
                ]
            }),
            servicos: () => ({
                name: en ? 'Services Agreement' : 'Prestacao de Servicos', scale: 1000,
                roles: [r('contratante', 'Contratante', 'Client'), r('contratado', 'Contratado', 'Contractor')],
                blocks: [
                    blk('pagamentoUnico', en ? 'Signing Fee' : 'Sinal', { devedor: 'contratante', credor: 'contratado', valor: 3000, prazo: 5 }),
                    blk('etapas', en ? 'Project' : 'Projeto', { contratante: 'contratante', contratado: 'contratado', valor: 30000, etapas: 3, prazo: 5 }),
                    blk('rescisao', '', { quem: '*' })
                ]
            }),
            garantia: () => ({
                name: en ? 'Escrow Purchase' : 'Compra com Garantia', scale: 1000,
                roles: [r('comprador', 'Comprador', 'Buyer'), r('vendedor', 'Vendedor', 'Seller'), r('arbitro', 'Árbitro', 'Arbitrator')],
                blocks: [
                    blk('custodia', en ? 'Price' : 'Preço', { depositante: 'comprador', beneficiario: 'vendedor', valor: 50000, prazo: 30 }),
                    blk('arbitro', '', { arbitro: 'arbitro' }),
                    blk('vigencia', '', { duracao: 90 })
                ]
            }),
            assinatura: () => ({
                name: en ? 'Subscription' : 'Assinatura de Servico', scale: 1000,
                roles: [r('fornecedor', 'Fornecedor', 'Provider'), r('cliente', 'Cliente', 'Customer')],
                blocks: [
                    blk('pagamentoPeriodico', en ? 'Monthly Fee' : 'Mensalidade', { devedor: 'cliente', credor: 'fornecedor', valor: 500, parcelas: 12, periodo: 30 }),
                    blk('encargos', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'MonthlyFee' : 'Mensalidade'), multa: 2, juros: 1, tolerancia: 5 }),
                    blk('vigencia', '', { duracao: 365 }),
                    blk('rescisao', '', { quem: 'cliente' })
                ]
            })
        };
        if (!P[id]) return null;
        const model = P[id]();
        // Ajusta referências (uid gerado a partir do rótulo normalizado).
        const uids = new Set(model.blocks.map(b => b.uid));
        for (const b of model.blocks) {
            if (b.params.alvo && !uids.has(b.params.alvo)) {
                const target = model.blocks.find(x => ['pagamentoUnico', 'pagamentoPeriodico'].includes(x.type) && b.params.alvo.endsWith(pascal(x.label)));
                if (target) b.params.alvo = target.uid;
            }
            if (!b.label) b.label = BLOCKS[b.type].name[en ? 'en' : 'pt'];
        }
        return model;
    }

    const PRESETS = [
        { id: 'locacao', pt: 'Locação com multa, juros, caução, árbitro e rescisão', en: 'Lease with late fee, interest, security deposit, arbitrator and termination' },
        { id: 'compraParcelada', pt: 'Compra e venda parcelada com entrada e vencimento antecipado', en: 'Installment sale with down payment and acceleration' },
        { id: 'servicos', pt: 'Prestação de serviços com sinal, etapas e rescisão', en: 'Services with signing fee, milestones and termination' },
        { id: 'garantia', pt: 'Compra com depósito em garantia, árbitro e vigência', en: 'Escrow purchase with arbitrator and term' },
        { id: 'assinatura', pt: 'Assinatura mensal com encargos, vigência e rescisão pelo cliente', en: 'Monthly subscription with charges, term and customer termination' }
    ];

    function emptyModel(lang) {
        const en = lang === 'en';
        return { name: en ? 'Composed Agreement' : 'Contrato Montado', scale: 1000, roles: [{ id: 'parteA', label: en ? 'Creditor' : 'Credor' }, { id: 'parteB', label: en ? 'Debtor' : 'Devedor' }], blocks: [] };
    }

    return {
        BLOCKS, CATEGORIES, PRESETS, SOLC_VERSION, slots, missingSlots,
        newBlock, validate, minuta, build, plan, preset, emptyModel, fillSentence: (b, model, lang) => fillSentence(Object.assign({}, b), makeCtx(model, lang)),
        names: { pascal, camel, upper }, toWei
    };
}));
