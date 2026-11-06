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
        'abstract', 'constructor', 'fallback', 'receive', 'type', 'try', 'catch', 'using', 'assembly', 'unchecked', 'days', 'ether', 'wei',
        // palavras reservadas e globais do Solidity
        'msg', 'block', 'tx', 'abi', 'now', 'default', 'final', 'gwei', 'seconds', 'minutes', 'hours', 'weeks', 'years', 'after', 'alias',
        'apply', 'auto', 'byte', 'case', 'copyof', 'define', 'implements', 'in', 'inline', 'let', 'macro', 'match', 'mutable', 'null', 'of',
        'partial', 'promise', 'reference', 'relocatable', 'sealed', 'sizeof', 'static', 'supports', 'switch', 'typedef', 'typeof', 'var',
        'selfdestruct', 'keccak256', 'sha256', 'gasleft', 'blockhash', 'addmod', 'mulmod', 'ecrecover', 'ripemd160', 'transient', 'layout', 'at',
        // nomes gerados pelo próprio contrato (português e inglês)
        'inicio', 'start', 'saldos', 'balances', 'situacao', 'status', 'sacar', 'withdraw', 'travado', 'locked', 'token', 'encerradoem', 'closedat',
        'saldoretido', 'heldbalance', 'saldostoken', 'tokenbalances', 'sacartoken', 'withdrawtoken', 'bps', 'nonreentrant', 'ok', 'valor', 'amount',
        // variáveis locais e parâmetros de função gerados (evitam sombreamento)
        'total', 'base', 'v', 'livre', 'free', 'destino', 'to', 'motivo', 'reason', 'limite', 'limit', 'saldo', 'balance', 'multa', 'fee',
        'juros', 'interest', 'encargos', 'charges', 'vencimento', 'duedate', 'diasatraso', 'dayslate', 'restante', 'rest', 'aobeneficiario',
        'tobeneficiary', 'descricao', 'description', 'cumprida', 'fulfilled', 'indice', 'index', 'favorbeneficiario', 'favorbeneficiary',
        'valoraobeneficiario', 'amounttobeneficiary', 'ato', 'act', 'novo', 'next', 'original', 'novoprazo', 'newdeadline',
        'hex', 'unicode', 'indexed', 'anonymous', 'blobhash', 'blobbasefee', 'prevrandao', 'basefee', 'coinbase', 'gaslimit', 'origin', 'sender',
        'rescindir', 'terminate', 'encerrarpordecursodoprazo', 'closeatterm', 'notificar', 'notify', 'assinar', 'sign', 'registrardocumento',
        'recorddocument', 'cancelarporfaltadeassinatura', 'cancelformissingsignatures', 'criadoem', 'createdat', 'assinadoem', 'signedat',
        'assinaturas', 'signaturecount', 'documentoassinado', 'signeddocument', 'notificacoesregistradas', 'recordednotices',
        'texto', 'text', 'destinatario', 'recipient', 'numero', 'number', 'remetente', 'sender', 'hashdotexto', 'texthash', 'hashdodocumento', 'documenthash']);

    // Caracteres de controle, separadores de linha e de direção de texto: nunca entram no código
    // (impedem que um rótulo ou texto escape do comentário e injete código Solidity).
    const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
    function safe(text) { return String(text == null ? '' : text).replace(UNSAFE_CHARS, ' '); }

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
        return RESERVED.has(c.toLowerCase()) ? c + 'Parte' : c;
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
    /** SHA-256 (hexadecimal) de um texto em UTF-8, síncrono e sem dependências. */
    function sha256Hex(text) {
        const bytes = [];
        const str = unescape(encodeURIComponent(String(text)));
        for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
        const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
        const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        const bitLen = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        const hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
        bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
        const rotr = (x, n) => (x >>> n) | (x << (32 - n));
        const W = new Array(64);
        for (let off = 0; off < bytes.length; off += 64) {
            for (let i = 0; i < 16; i++) W[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
                const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
            }
            let [a, b, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) {
                const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
                const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
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
        pagamentoToken: {
            category: 'pagamentos',
            name: { pt: 'Pagamento em "stablecoin"', en: 'Stablecoin payment' },
            defaultLabel: { pt: 'Pagamento tBRL', en: 'tBRL Payment' },
            params: [
                { key: 'devedor', kind: 'role', role: 1 },
                { key: 'credor', kind: 'role', role: 0 },
                { key: 'valor', kind: 'money', def: 3000 },
                { key: 'prazo', kind: 'days', def: 10, min: 1 }
            ],
            sentence: {
                pt: '{devedor} pagará a {credor} {valor} em "stablecoin" lastreada em reais (1 unidade = R$ 1,00), até {prazo} dias após a implantação, autorizando previamente o contrato a debitar o valor de sua carteira.',
                en: '{devedor} shall pay {credor} {valor} in a BRL-pegged stablecoin (1 unit = R$ 1.00), within {prazo} days of deployment, by first authorizing the contract to debit the amount from their wallet.'
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
                pt: 'Em caso de atraso no pagamento de {alvo} superior a {tolerancia} dias de tolerância, incidirão multa de {multa} sobre o valor devido e juros de mora de {juros} ao mês, calculados por dia completo de atraso.',
                en: 'If payment of {alvo} is late by more than a {tolerancia}-day grace period, a late fee of {multa} on the amount due and late interest of {juros} per month, calculated per full day of delay, shall apply.'
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
        obrigacaoDar: {
            category: 'obrigacoes',
            name: { pt: 'Obrigação de dar (entregar coisa)', en: 'Obligation to give (deliver an item)' },
            defaultLabel: { pt: 'Bem vendido', en: 'Sold item' },
            obligation: 'dar',
            params: [
                { key: 'devedor', kind: 'role', role: 1 },
                { key: 'credor', kind: 'role', role: 0 },
                { key: 'prazo', kind: 'days', def: 30, min: 1 },
                { key: 'verificador', kind: 'role', role: 0 },
                { key: 'atestacao', kind: 'days', def: 10, min: 1 }
            ],
            sentence: {
                pt: '{devedor} entregará a {credor} o seguinte bem: [descreva o bem], até {prazo} dias após a implantação. Informada a entrega, {verificador} terá {atestacao} dias para atestar o recebimento ou recusá-lo fundamentadamente; o silêncio importará atestação, e a recusa reabrirá ao devedor igual prazo para cumprir. Vencido o prazo sem cumprimento informado, qualquer das partes poderá declarar o inadimplemento.',
                en: '{devedor} shall deliver to {credor} the following item: [describe the item], within {prazo} days of deployment. Once delivery is reported, {verificador} has {atestacao} days to attest receipt or reject it with reasons; silence counts as attestation, and a rejection gives the debtor the same period again to perform. If the deadline passes with no performance reported, either party may declare default.'
            }
        },
        obrigacaoFazer: {
            category: 'obrigacoes',
            name: { pt: 'Obrigação de fazer', en: 'Obligation to do' },
            defaultLabel: { pt: 'Serviço', en: 'Service' },
            obligation: 'fazer',
            params: [
                { key: 'devedor', kind: 'role', role: 1 },
                { key: 'credor', kind: 'role', role: 0 },
                { key: 'prazo', kind: 'days', def: 30, min: 1 },
                { key: 'verificador', kind: 'role', role: 0 },
                { key: 'atestacao', kind: 'days', def: 10, min: 1 }
            ],
            sentence: {
                pt: '{devedor} realizará em favor de {credor} a seguinte prestação: [descreva o serviço], até {prazo} dias após a implantação. Informado o cumprimento, {verificador} terá {atestacao} dias para atestá-lo ou recusá-lo fundamentadamente; o silêncio importará atestação, e a recusa reabrirá ao devedor igual prazo para cumprir. Vencido o prazo sem cumprimento informado, qualquer das partes poderá declarar o inadimplemento.',
                en: '{devedor} shall perform for {credor} the following service: [describe the service], within {prazo} days of deployment. Once performance is reported, {verificador} has {atestacao} days to attest or reject it with reasons; silence counts as attestation, and a rejection gives the debtor the same period again to perform. If the deadline passes with no performance reported, either party may declare default.'
            }
        },
        obrigacaoNaoFazer: {
            category: 'obrigacoes',
            name: { pt: 'Obrigação de não fazer', en: 'Obligation not to do' },
            defaultLabel: { pt: 'Não concorrência', en: 'Non-compete' },
            obligation: 'naoFazer',
            params: [
                { key: 'devedor', kind: 'role', role: 1 },
                { key: 'credor', kind: 'role', role: 0 },
                { key: 'duracao', kind: 'days', def: 180, min: 1 },
                { key: 'verificador', kind: 'role', role: 0 }
            ],
            sentence: {
                pt: '{devedor} abster-se-á, em favor de {credor}, da seguinte conduta: [descreva a conduta vedada], durante {duracao} dias contados da implantação. Eventual violação será registrada por {verificador}, com a descrição do fato, e, havendo árbitro, dependerá de sua confirmação; findo o prazo sem violação, a obrigação considera-se cumprida.',
                en: '{devedor} shall refrain, for the benefit of {credor}, from the following conduct: [describe the prohibited conduct], for {duracao} days from deployment. Any breach shall be recorded by {verificador}, describing the fact, and, if there is an arbitrator, is subject to their confirmation; if the period ends without breach, the obligation is deemed fulfilled.'
            }
        },
        clausulaPenal: {
            category: 'obrigacoes',
            name: { pt: 'Cláusula penal com garantia', en: 'Penalty clause with bond' },
            attached: true,
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['obrigacaoDar', 'obrigacaoFazer', 'obrigacaoNaoFazer'] },
                { key: 'valor', kind: 'money', def: 5000 }
            ],
            sentence: {
                pt: 'Em garantia da obrigação {alvo}, o respectivo devedor depositará {valor} no contrato. Havendo inadimplemento ou violação, esse valor será entregue ao credor a título de cláusula penal; cumprida a obrigação, ou encerrado o contrato antes de seu vencimento, será devolvido ao devedor.',
                en: 'To secure the obligation {alvo}, its debtor shall deposit {valor} in the contract. In case of default or breach, this amount goes to the creditor as a penalty; if the obligation is fulfilled, or the contract ends before it falls due, it is returned to the debtor.'
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
                pt: '{depositante} depositará {valor}, que ficará retido no contrato até que o próprio depositante confirme o cumprimento da obrigação, quando o valor será liberado a {beneficiario}. Não havendo confirmação em {prazo} dias contados do depósito, {depositante} poderá reaver o valor.',
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
            params: [{ key: 'arbitro', kind: 'role', role: 2 }, { key: 'prazo', kind: 'days', def: 30, min: 1 }],
            sentence: {
                pt: 'As divergências sobre a liberação de valores retidos e sobre o cumprimento de obrigações serão decididas por {arbitro} em até {prazo} dias contados da abertura da disputa, e o contrato executará a decisão. Sem decisão nesse prazo, os valores em disputa voltam a quem os depositou.',
                en: 'Disputes about the release of held amounts and about the performance of obligations shall be decided by {arbitro} within {prazo} days of the dispute being opened, and the contract will execute the decision. Absent a decision within that period, the disputed amounts return to whoever deposited them.'
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
        oraculoValor: {
            category: 'externos',
            name: { pt: 'Informação externa: valor', en: 'External data: value' },
            defaultLabel: { pt: 'Indice', en: 'Index' },
            params: [
                { key: 'fonte', kind: 'role', role: 2 },
                { key: 'validade', kind: 'days', def: 30, min: 1 }
            ],
            sentence: {
                pt: 'Esta informação externa será fornecida por {fonte}, que a registrará no contrato com duas casas decimais. Cada registro vale por {validade} dias; vencido esse prazo, a informação não poderá ser usada até nova atualização. O contrato só aceita registros feitos pela fonte designada.',
                en: 'This external data shall be provided by {fonte}, who records it in the contract with two decimal places. Each record is valid for {validade} days; after that, the data cannot be used until it is updated. The contract only accepts records from the designated source.'
            }
        },
        oraculoEvento: {
            category: 'externos',
            name: { pt: 'Informação externa: evento', en: 'External data: event' },
            defaultLabel: { pt: 'Entrega confirmada', en: 'Delivery confirmed' },
            params: [{ key: 'fonte', kind: 'role', role: 2 }],
            sentence: {
                pt: 'A ocorrência deste evento será atestada por {fonte}, que a registrará no contrato. O registro é definitivo, e o contrato só o aceita da fonte designada.',
                en: 'The occurrence of this event shall be attested by {fonte}, who records it in the contract. The record is final, and the contract only accepts it from the designated source.'
            }
        },
        reajuste: {
            category: 'externos',
            name: { pt: 'Reajuste por índice', en: 'Index adjustment' },
            attached: true,
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['pagamentoUnico', 'pagamentoPeriodico'] },
                { key: 'indice', kind: 'ref', accepts: ['oraculoValor'] }
            ],
            sentence: {
                pt: 'O valor de {alvo} será reajustado pela variação percentual acumulada informada em {indice}. Prevalece sempre o último índice informado e, enquanto não houver informação, o valor original.',
                en: 'The amount of {alvo} shall be adjusted by the accumulated percentage change reported in {indice}. The latest reported index always prevails and, while none is reported, the original amount applies.'
            }
        },
        conversaoCambial: {
            category: 'externos',
            name: { pt: 'Valor em reais pela cotação', en: 'BRL amount at market price' },
            attached: true,
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['pagamentoUnico', 'pagamentoPeriodico'] },
                { key: 'cotacao', kind: 'ref', accepts: ['oraculoValor'] }
            ],
            sentence: {
                pt: 'O valor de {alvo}, fixado em reais, será pago em Ether convertido pela cotação (reais por 1 ETH) informada em {cotacao} no momento do pagamento. Sem cotação válida, o pagamento não poderá ser feito.',
                en: 'The amount of {alvo}, fixed in BRL, shall be paid in Ether converted at the price (BRL per 1 ETH) reported in {cotacao} at the time of payment. Without a valid price, payment cannot be made.'
            }
        },
        liberacaoPorEvento: {
            category: 'externos',
            name: { pt: 'Liberação por evento', en: 'Release on event' },
            attached: true,
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['custodia'] },
                { key: 'evento', kind: 'ref', accepts: ['oraculoEvento', 'obrigacaoDar', 'obrigacaoFazer'] }
            ],
            sentence: {
                pt: 'Atestado o evento {evento}, o beneficiário de {alvo} poderá obter a liberação do valor retido, independentemente da confirmação de quem o depositou.',
                en: 'Once the event {evento} is attested, the beneficiary of {alvo} may obtain the release of the held amount, regardless of the depositor\'s confirmation.'
            }
        },
        objeto: {
            category: 'formalizacao',
            name: { pt: 'Objeto do contrato', en: 'Subject matter' },
            defaultLabel: { pt: 'Objeto', en: 'Subject matter' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'O presente contrato tem por objeto [descreva o objeto do contrato], nas condições estabelecidas nas cláusulas seguintes.',
                en: 'The subject matter of this contract is [describe the subject matter], under the terms set out in the following clauses.'
            }
        },
        foro: {
            category: 'formalizacao',
            name: { pt: 'Foro de eleição', en: 'Jurisdiction' },
            defaultLabel: { pt: 'Foro', en: 'Jurisdiction' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'Fica eleito o foro da comarca de [cidade/UF], domicílio de [parte], para dirimir as controvérsias oriundas deste contrato.',
                en: 'The courts of [city/country], where [party] is domiciled, shall have jurisdiction over disputes arising from this contract.'
            }
        },
        localData: {
            category: 'formalizacao',
            name: { pt: 'Local e data', en: 'Place and date' },
            defaultLabel: { pt: 'Local e data', en: 'Place and date' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'Firmado em [cidade], na data da última assinatura registrada neste contrato.',
                en: 'Signed in [city], on the date of the last signature recorded in this contract.'
            }
        },
        comunicacoes: {
            category: 'formalizacao',
            name: { pt: 'Comunicações entre as partes', en: 'Notices between the parties' },
            defaultLabel: { pt: 'Comunicações', en: 'Notices' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'As comunicações entre as partes serão feitas por escrito, nos endereços indicados na qualificação, e as notificações registradas neste contrato valerão como prova de seu envio e de sua data.',
                en: 'Notices between the parties shall be made in writing, to the addresses given in their details, and notices recorded in this contract shall serve as proof of their sending and date.'
            }
        },
        confidencialidade: {
            category: 'formalizacao',
            name: { pt: 'Confidencialidade', en: 'Confidentiality' },
            defaultLabel: { pt: 'Confidencialidade', en: 'Confidentiality' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'As partes manterão sigilo sobre as informações não públicas a que tiverem acesso em razão deste contrato, durante sua vigência e por [prazo] após o seu término.',
                en: 'The parties shall keep confidential any non-public information obtained under this contract, while it is in force and for [period] after it ends.'
            }
        },
        protecaoDados: {
            category: 'formalizacao',
            name: { pt: 'Proteção de dados pessoais', en: 'Personal data protection' },
            defaultLabel: { pt: 'Proteção de dados', en: 'Data protection' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'As partes tratarão os dados pessoais relacionados a este contrato em conformidade com a legislação de proteção de dados aplicável. Nenhum dado pessoal será registrado na "blockchain", na qual constam apenas endereços de carteira e a impressão digital dos documentos.',
                en: 'The parties shall process personal data related to this contract in accordance with the applicable data protection law (such as the LGPD in Brazil or the GDPR in the EU). No personal data shall be recorded on the blockchain, which holds only wallet addresses and document fingerprints.'
            }
        },
        disposicoesGerais: {
            category: 'formalizacao',
            name: { pt: 'Disposições gerais', en: 'General provisions' },
            defaultLabel: { pt: 'Disposições gerais', en: 'General provisions' },
            declarative: true,
            single: true,
            params: [],
            sentence: {
                pt: 'A tolerância de qualquer das partes quanto ao descumprimento de cláusula não implica renúncia nem novação. A nulidade de uma cláusula não prejudica as demais. Este contrato obriga as partes e seus sucessores.',
                en: 'Forbearance by either party regarding a breach does not imply waiver or novation. The invalidity of one clause does not affect the others. This contract binds the parties and their successors.'
            }
        },
        arrependimento: {
            category: 'garantias',
            name: { pt: 'Direito de arrependimento', en: 'Right of withdrawal' },
            attached: true,
            params: [
                { key: 'alvo', kind: 'ref', accepts: ['pagamentoUnico', 'custodia'] },
                { key: 'prazo', kind: 'days', def: 7, min: 1 }
            ],
            sentence: {
                pt: 'Quem pagou {alvo} poderá desistir em até {prazo} dias contados do pagamento, com a devolução integral do valor; até o fim desse prazo, o valor fica retido no contrato.',
                en: 'Whoever paid {alvo} may withdraw within {prazo} days of payment, with a full refund; until that period ends, the amount is held in the contract.'
            }
        },
        notificacoes: {
            category: 'formalizacao',
            name: { pt: 'Notificações registradas', en: 'Recorded notices' },
            single: true,
            params: [],
            sentence: {
                pt: 'Qualquer das partes poderá registrar neste contrato notificação dirigida à outra, que valerá como prova de seu conteúdo e de sua data. O texto registrado fica público na "blockchain" e não deve conter dados pessoais.',
                en: 'Either party may record in this contract a notice addressed to the other, which serves as proof of its content and date. The recorded text is public on the blockchain and must not contain personal data.'
            }
        },
        assinaturas: {
            category: 'formalizacao',
            name: { pt: 'Assinaturas digitais', en: 'Digital signatures' },
            single: true,
            params: [{ key: 'prazo', kind: 'days', def: 15, min: 1 }],
            sentence: {
                pt: 'Este contrato entra em vigor quando todos os signatários indicados na Cláusula 1ª, inclusive as testemunhas, se houver, o assinarem digitalmente, cada qual com sua carteira, conferindo a impressão digital (SHA-256) deste texto; os prazos contam da última assinatura. Antes da primeira assinatura, as partes podem registrar no contrato a impressão digital do documento em PDF assinado por serviço de assinatura eletrônica (como o gov.br ou certificado ICP-Brasil, no Brasil, ou serviço estrangeiro equivalente). Não havendo todas as assinaturas em {prazo} dias da implantação, qualquer signatário poderá cancelar o contrato.',
                en: 'This contract comes into force when all signatories listed in Clause 1, including any witnesses, sign it digitally, each with their own wallet, checking the fingerprint (SHA-256) of this text; deadlines run from the last signature. Before the first signature, the parties may record in the contract the fingerprint of the PDF document signed with an electronic signature service (such as gov.br or an ICP-Brasil certificate in Brazil, a qualified eIDAS certificate in the EU, or an equivalent service). If not all signatures are collected within {prazo} days of deployment, any signatory may cancel the contract.'
            }
        },
        testemunha: {
            category: 'formalizacao',
            name: { pt: 'Testemunha', en: 'Witness' },
            defaultLabel: { pt: 'Primeira testemunha', en: 'First witness' },
            params: [{ key: 'testemunha', kind: 'role', role: 2 }],
            sentence: {
                pt: 'Assina este contrato, na qualidade de testemunha, {testemunha}, que não é parte nem tem interesse no negócio.',
                en: '{testemunha} signs this contract as a witness, being neither a party nor interested in the transaction.'
            }
        },
        clausulaLivre: {
            category: 'livre',
            name: { pt: 'Cláusula livre', en: 'Free clause' },
            defaultLabel: { pt: 'Disposições gerais', en: 'General provisions' },
            declarative: true,
            params: [],
            sentence: {
                pt: '[Escreva aqui a cláusula.]',
                en: '[Write the clause here.]'
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

    // Nomes legíveis das lacunas (mensagens de validação e acessibilidade).
    const FIELD_LABELS = {
        devedor: { pt: 'quem paga', en: 'payer' }, credor: { pt: 'quem recebe', en: 'payee' }, valor: { pt: 'valor (R$)', en: 'amount (R$)' },
        prazo: { pt: 'prazo (dias)', en: 'deadline (days)' }, parcelas: { pt: 'número de parcelas', en: 'number of installments' },
        periodo: { pt: 'periodicidade (dias)', en: 'period (days)' }, alvo: { pt: 'pagamento a que se aplica', en: 'payment it applies to' },
        multa: { pt: 'multa (%)', en: 'late fee (%)' }, juros: { pt: 'juros ao mês (%)', en: 'monthly interest (%)' },
        tolerancia: { pt: 'tolerância (dias)', en: 'grace period (days)' }, atraso: { pt: 'atraso (dias)', en: 'delay (days)' },
        depositante: { pt: 'quem deposita', en: 'depositor' }, beneficiario: { pt: 'beneficiário', en: 'beneficiary' },
        contratante: { pt: 'contratante', en: 'client' }, contratado: { pt: 'contratado', en: 'contractor' }, etapas: { pt: 'número de etapas', en: 'number of milestones' },
        garantidor: { pt: 'quem presta a garantia', en: 'guarantor' }, arbitro: { pt: 'árbitro', en: 'arbitrator' }, quem: { pt: 'quem pode rescindir', en: 'who may terminate' },
        duracao: { pt: 'duração (dias)', en: 'duration (days)' },
        fonte: { pt: 'fonte da informação', en: 'data source' }, validade: { pt: 'validade (dias)', en: 'validity (days)' },
        verificador: { pt: 'quem atesta', en: 'who attests' }, testemunha: { pt: 'testemunha', en: 'witness' }, atestacao: { pt: 'prazo para atestar (dias)', en: 'attestation period (days)' },
        indice: { pt: 'índice', en: 'index' }, cotacao: { pt: 'cotação', en: 'price' }, evento: { pt: 'evento', en: 'event' }
    };
    function fieldLabel(key, lang) { const f = FIELD_LABELS[key]; return f ? f[lang === 'en' ? 'en' : 'pt'] : key; }

    const CATEGORIES = [
        { id: 'pagamentos', pt: 'Obrigações de pagar', en: 'Obligations to pay' },
        { id: 'obrigacoes', pt: 'Obrigações de dar, fazer e não fazer', en: 'Obligations to give, do and not do' },
        { id: 'garantias', pt: 'Garantias', en: 'Guarantees' },
        { id: 'execucao', pt: 'Execução', en: 'Performance' },
        { id: 'disputas', pt: 'Solução de disputas', en: 'Dispute resolution' },
        { id: 'externos', pt: 'Informações externas (oráculos)', en: 'External data (oracles)' },
        { id: 'encerramento', pt: 'Encerramento', en: 'Termination' },
        { id: 'formalizacao', pt: 'Formalização e assinaturas', en: 'Formalities and signatures' },
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
                // Prefere um alvo ainda sem bloco do mesmo tipo (evita duplicidade).
                const cands = (existing || []).filter(b => p.accepts.includes(b.type));
                const free = def.attached && p.key === 'alvo' ? cands.find(c => !(existing || []).some(x => x.type === type && x.params && x.params.alvo === c.uid)) : null;
                const target = free || cands[0];
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

    /** Completa campos ausentes com o valor padrão (contratos salvos em versões anteriores). */
    function normalize(model) {
        for (const b of (model && model.blocks) || []) {
            const def = BLOCKS[b.type];
            if (!def) continue;
            b.params = b.params || {};
            for (const p of def.params) if (b.params[p.key] === undefined && p.def !== undefined) b.params[p.key] = p.def;
        }
        return model;
    }

    /** Valida a montagem; devolve lista de mensagens { pt, en, uid? }. */
    function validate(model) {
        const errs = [];
        const add = (pt, en, uid) => errs.push({ pt, en, uid });
        const roles = model.roles || [];
        const own = t => Object.prototype.hasOwnProperty.call(BLOCKS, t);
        for (const b of (model.blocks || []).filter(x => !x || !own(x.type))) add('Bloco desconhecido.', 'Unknown block.', b && b.uid);
        const blocks = (model.blocks || []).filter(x => x && own(x.type));
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
        const sc = model.scale == null ? 1000 : Number(model.scale);
        if (!Number.isFinite(sc) || sc < 0.01 || sc > 1e9) add('A escala (reais por 1 ETH) deve estar entre 0,01 e 1.000.000.000.', 'The scale (BRL per 1 ETH) must be between 0.01 and 1,000,000,000.');
        const names = new Set();
        const counts = {};
        for (const b of blocks) {
            const def = Object.prototype.hasOwnProperty.call(BLOCKS, b.type) ? BLOCKS[b.type] : null;
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
                    if (!target || !p.accepts.includes(target.type)) {
                        const obl = p.accepts.every(t => BLOCKS[t].category === 'obrigacoes');
                        if (p.key === 'alvo' && obl) add('Indique a qual obrigação se aplica "' + def.name.pt + '".', 'Choose which obligation "' + def.name.en + '" applies to.', b.uid);
                        else if (p.key === 'alvo' && p.accepts.includes('custodia')) add('Indique a qual depósito em garantia se aplica "' + def.name.pt + '".', 'Choose which escrow deposit "' + def.name.en + '" applies to.', b.uid);
                        else if (p.key === 'alvo') add('Indique a qual pagamento se aplica "' + def.name.pt + '".', 'Choose which payment "' + def.name.en + '" applies to.', b.uid);
                        else add('Em "' + def.name.pt + '", escolha o campo "' + fieldLabel(p.key, 'pt') + '".', 'In "' + def.name.en + '", choose the field "' + fieldLabel(p.key, 'en') + '".', b.uid);
                    }
                }
                if (['money', 'int', 'days', 'percent'].includes(p.kind)) {
                    const n = Number(v);
                    const fp = fieldLabel(p.key, 'pt'), fe = fieldLabel(p.key, 'en');
                    const at = (pt, en) => add('Em "' + b.label + '", o campo "' + fp + '" ' + pt, 'In "' + b.label + '", the field "' + fe + '" ' + en, b.uid);
                    if (v === '' || v == null || !Number.isFinite(n)) at('deve conter um número (ex.: ' + (p.kind === 'money' ? '3.000,00' : p.kind === 'percent' ? '2' : '30') + ').', 'must contain a number (e.g. ' + (p.kind === 'money' ? '3000' : p.kind === 'percent' ? '2' : '30') + ').');
                    else if (n < 0) at('não pode ser negativo.', 'cannot be negative.');
                    else {
                        if (p.kind === 'money' && n <= 0) at('deve ser maior que zero.', 'must be greater than zero.');
                        if (p.min != null && n < p.min) at('deve ser no mínimo ' + p.min + '.', 'must be at least ' + p.min + '.');
                        if (p.max != null && n > p.max) at('deve ser no máximo ' + p.max + '.', 'must be at most ' + p.max + '.');
                        if (p.kind === 'percent' && n > 100) at('não pode passar de 100%.', 'cannot exceed 100%.');
                        if ((p.kind === 'int' || p.kind === 'days') && !Number.isInteger(n)) at('deve ser um número inteiro.', 'must be a whole number.');
                    }
                }
            }
            const pairs = { obrigacaoDar: ['devedor', 'credor'], obrigacaoFazer: ['devedor', 'credor'], obrigacaoNaoFazer: ['devedor', 'credor'], pagamentoToken: ['devedor', 'credor'], pagamentoUnico: ['devedor', 'credor'], pagamentoPeriodico: ['devedor', 'credor'], custodia: ['depositante', 'beneficiario'], etapas: ['contratante', 'contratado'], caucao: ['garantidor', 'beneficiario'] }[b.type];
            if (pairs && b.params[pairs[0]] && b.params[pairs[0]] === b.params[pairs[1]]) add('As partes de "' + b.label + '" devem ser diferentes.', 'The parties in "' + b.label + '" must differ.', b.uid);
            if (def.obligation && b.params.verificador && b.params.verificador === b.params.devedor) add('Em "' + b.label + '", quem atesta não pode ser o próprio devedor.', 'In "' + b.label + '", the attesting party cannot be the debtor.', b.uid);
            if (b.type === 'liberacaoPorEvento') {
                const cus = blocks.find(x => x.uid === b.params.alvo), ev = blocks.find(x => x.uid === b.params.evento);
                const who = ev ? (ev.type === 'oraculoEvento' ? ev.params.fonte : ev.params.verificador) : null;
                if (cus && who && who === cus.params.beneficiario) add('Em "' + def.name.pt + '", quem atesta o evento não pode ser o beneficiário do depósito.', 'In "' + def.name.en + '", whoever attests the event cannot be the beneficiary of the deposit.', b.uid);
                if (ev && ev.type === 'obrigacaoNaoFazer') add('A liberação por evento depende de obrigação de dar ou de fazer.', 'Release on event requires an obligation to give or to do.', b.uid);
            }
            if (b.type === 'etapas' && Number(b.params.etapas) > 0 && toWei(b.params.valor, model.scale) < BigInt(Math.round(b.params.etapas))) add('Valor insuficiente para o número de etapas.', 'Amount too small for the number of milestones.', b.uid);
        }
        const targets = {};
        for (const b of blocks.filter(x => BLOCKS[x.type] && BLOCKS[x.type].attached)) {
            const k = b.type + ':' + b.params.alvo;
            if (targets[k]) add('Há dois blocos "' + BLOCKS[b.type].name.pt + '" aplicados à mesma cláusula.', 'Two "' + BLOCKS[b.type].name.en + '" blocks apply to the same clause.', b.uid);
            targets[k] = true;
        }
        const arb = blocks.find(b => b.type === 'arbitro');
        if (arb) {
            for (const b of blocks.filter(x => x.type === 'custodia' || x.type === 'caucao')) {
                if ([b.params.depositante, b.params.beneficiario, b.params.garantidor].includes(arb.params.arbitro)) add('O árbitro não pode ser parte de "' + b.label + '".', 'The arbitrator cannot be a party to "' + b.label + '".', b.uid);
            }
            for (const b of blocks.filter(x => BLOCKS[x.type] && BLOCKS[x.type].obligation)) {
                if (b.params.verificador === arb.params.arbitro) add('Em "' + b.label + '", o árbitro não pode ser quem atesta: ele decidiria a contestação da própria recusa.', 'In "' + b.label + '", the arbitrator cannot be the attesting party: they would rule on the challenge to their own rejection.', b.uid);
                if ([b.params.devedor, b.params.credor].includes(arb.params.arbitro)) add('O árbitro não pode ser parte de "' + b.label + '".', 'The arbitrator cannot be a party to "' + b.label + '".', b.uid);
            }
        }
        const wit = blocks.filter(b => b.type === 'testemunha');
        if (wit.length && !blocks.some(b => b.type === 'assinaturas')) add('A testemunha assina digitalmente: acrescente o bloco "Assinaturas digitais".', 'Witnesses sign digitally: add the "Digital signatures" block.', wit[0].uid);
        const seenW = new Set();
        for (const wb of wit) {
            const r = wb.params.testemunha;
            if (seenW.has(r)) add('A mesma pessoa aparece duas vezes como testemunha.', 'The same person appears twice as a witness.', wb.uid);
            seenW.add(r);
            const usedElsewhere = blocks.some(x => x !== wb && x.type !== 'testemunha' && BLOCKS[x.type] && BLOCKS[x.type].params.some(p => (p.kind === 'role' || p.kind === 'roleOrAny') && x.params[p.key] === r));
            if (usedElsewhere) add('A testemunha não pode ser parte, árbitro, fonte de informação nem ter outro papel no contrato.', 'A witness cannot be a party, arbitrator, data source or have any other role in the contract.', wb.uid);
        }
        const vig = blocks.some(b => b.type === 'vigencia');
        const resc0 = blocks.find(b => b.type === 'rescisao');
        for (const b of blocks.filter(x => x.type === 'caucao' || x.type === 'etapas')) {
            const owner = b.type === 'caucao' ? b.params.garantidor : b.params.contratante;
            const ok = vig || (resc0 && (resc0.params.quem === '*' || resc0.params.quem === owner));
            if (!ok) add('Os valores retidos em "' + b.label + '" precisam de uma forma de encerramento ao alcance de quem os depositou: acrescente "Prazo de vigência" ou uma "Rescisão" que essa parte (ou qualquer das partes) possa exercer.',
                'Amounts held in "' + b.label + '" need a way to close the contract available to whoever deposited them: add "Term", or a "Termination" that this party (or either party) may exercise.', b.uid);
        }
        if (arb) {
            const a = arb.params.arbitro;
            const resc = blocks.find(b => b.type === 'rescisao');
            if (resc && resc.params.quem === a) add('O árbitro não pode ser quem rescinde o contrato.', 'The arbitrator cannot be the one who terminates the contract.', resc.uid);
            for (const b of blocks.filter(x => ['pagamentoUnico', 'pagamentoPeriodico', 'pagamentoToken', 'etapas'].includes(x.type))) {
                if ([b.params.devedor, b.params.credor, b.params.contratante, b.params.contratado].includes(a)) add('O árbitro não pode ser parte de "' + b.label + '".', 'The arbitrator cannot be a party to "' + b.label + '".', b.uid);
            }
        }
        return errs;
    }

    /**
     * Conferência jurídica indicativa (direito brasileiro): lembretes e avisos com a referência legal.
     * Não impede a geração e não substitui análise profissional.
     */
    function legalCheck(model, lang) {
        const en = lang === 'en';
        const out = [];
        const add = (tipo, pt, enT, ref) => out.push({ tipo, texto: en ? enT : pt, ref });
        const blocks = model.blocks || [];
        const has = t => blocks.some(b => b.type === t);
        const allText = blocks.map(b => String(b.texto || (BLOCKS[b.type] ? BLOCKS[b.type].sentence[en ? 'en' : 'pt'] : ''))).join(' ') + ' ' + (model.name || '');
        const roles = model.roles || [];
        if (!roles.every(r => r.nome && r.documento)) add('lembrete', 'Qualifique as partes (nome ou razão social e documento) em "Dados das partes": a carteira não identifica a pessoa, e a capacidade do agente é requisito de validade.', 'Identify the parties (name and ID or company number) under "Party details": a wallet does not identify a person, and legal capacity is a validity requirement.', en ? 'Brazilian Civil Code, art. 104, I' : 'CC, art. 104, I');
        if (!has('objeto')) add('lembrete', 'Descreva o objeto do contrato (bloco "Objeto do contrato"): o objeto deve ser lícito, possível, determinado ou determinável.', 'Describe the subject matter (block "Subject matter"): it must be lawful, possible and determined or determinable.', en ? 'Brazilian Civil Code, art. 104, II' : 'CC, art. 104, II');
        if (/\[[^\]]{3,}\]/.test(allText)) add('aviso', 'Há trechos entre colchetes a completar (ex.: "[descreva…]", "[cidade/UF]").', 'There are bracketed passages to complete (e.g. "[describe…]", "[city]").', '');
        const lease = /(loca[çc][ãa]o|aluguel|locat[áa]rio|lease|rent\b|tenant)/i.test(allText + ' ' + blocks.map(b => b.label).join(' '));
        if (/(im[óo]vel|terreno|apartamento|real estate|land\b|property)/i.test(allText) && /(compra|venda|aliena|doa[çc][ãa]o|hipoteca|usufruto|escritura|sale|purchase|mortgage|deed)/i.test(allText + ' ' + (model.name || ''))) add('aviso', 'Negócios sobre direitos reais imobiliários acima de 30 salários mínimos exigem escritura pública, e a transferência da propriedade depende de registro: o "smart contract" não os substitui.', 'Brazilian law requires a public deed for real-estate rights above 30 minimum wages, and transfer of title depends on registration: the smart contract does not replace them.', en ? 'Brazilian Civil Code, arts. 108 and 1,245' : 'CC, arts. 108 e 1.245');
        if (!has('assinaturas')) add('lembrete', 'Para a força executiva do documento particular, prevê-se a assinatura do devedor e de duas testemunhas; considere o bloco "Assinaturas digitais" e, se for o caso, testemunhas.', 'For a private document to be directly enforceable, the debtor\'s signature and two witnesses are required; consider the "Digital signatures" block and, if applicable, witnesses.', en ? 'Brazilian Code of Civil Procedure, art. 784, III' : 'CPC, art. 784, III');
        else if (blocks.filter(b => b.type === 'testemunha').length < 2) add('lembrete', 'O documento particular assinado pelo devedor e por duas testemunhas é título executivo extrajudicial.', 'A private document signed by the debtor and two witnesses is an extrajudicial enforceable title.', en ? 'Brazilian Code of Civil Procedure, art. 784, III' : 'CPC, art. 784, III');
        if (has('testemunha')) add('lembrete', 'Não podem ser testemunhas, entre outros, os menores de dezesseis anos, o interessado no litígio e o cônjuge ou parentes próximos das partes.', 'Under Brazilian law, minors under sixteen, interested persons and spouses or close relatives of the parties cannot be witnesses.', en ? 'Brazilian Civil Code, art. 228' : 'CC, art. 228');
        const payTotal = blocks.filter(b => ['pagamentoUnico', 'pagamentoPeriodico', 'pagamentoToken', 'custodia', 'etapas'].includes(b.type))
            .reduce((t, b) => t + Number(b.params.valor || 0) * (b.type === 'pagamentoPeriodico' ? Number(b.params.parcelas || 1) : 1), 0);
        for (const b of blocks.filter(x => x.type === 'clausulaPenal')) {
            if (payTotal > 0 && Number(b.params.valor) > payTotal) add('aviso', 'A cláusula penal (' + money(b.params.valor, lang) + ') supera o valor das prestações do contrato (' + money(payTotal, lang) + '): o valor da cominação não pode exceder o da obrigação principal.', 'The penalty (' + money(b.params.valor, lang) + ') exceeds the contract payments (' + money(payTotal, lang) + '): under Brazilian law, a penalty cannot exceed the principal obligation.', en ? 'Brazilian Civil Code, arts. 412 and 413' : 'CC, arts. 412 e 413');
        }
        for (const b of blocks.filter(x => x.type === 'encargos')) {
            if (Number(b.params.multa) > 2 && !lease) add('aviso', 'Multa moratória de ' + num(b.params.multa, lang) + '%: nas relações de consumo, limita-se a 2% do valor da prestação.', 'Late fee of ' + num(b.params.multa, lang) + '%: in Brazilian consumer relations it is capped at 2% of the installment.', en ? 'Brazilian Consumer Code, art. 52, § 1' : 'CDC, art. 52, § 1º');
            if (Number(b.params.juros) > 1) add('aviso', 'Juros de ' + num(b.params.juros, lang) + '% ao mês: fora do sistema financeiro, os juros convencionais têm limite legal.', 'Interest of ' + num(b.params.juros, lang) + '% per month: outside the financial system, Brazilian law caps contractual interest.', en ? 'Brazilian Decree 22,626/1933; Civil Code, art. 591' : 'Decreto nº 22.626/1933; CC, art. 591');
        }
        if (lease) {
            const rent = blocks.find(b => b.type === 'pagamentoPeriodico');
            for (const c of blocks.filter(b => b.type === 'caucao')) if (rent && Number(c.params.valor) > 3 * Number(rent.params.valor)) add('aviso', 'Na locação de imóvel urbano, a caução em dinheiro não pode exceder três meses de aluguel.', 'In Brazilian urban leases, a cash security deposit cannot exceed three months of rent.', en ? 'Brazilian Law 8,245/1991, art. 38, § 2' : 'Lei nº 8.245/1991, art. 38, § 2º');
            if (blocks.filter(b => b.type === 'caucao' || b.type === 'custodia').length > 1) add('aviso', 'Na locação, é vedada mais de uma modalidade de garantia no mesmo contrato.', 'Brazilian lease law forbids more than one type of guarantee in the same contract.', en ? 'Brazilian Law 8,245/1991, art. 37, sole paragraph' : 'Lei nº 8.245/1991, art. 37, parágrafo único');
        }
        if (has('arbitro')) add('lembrete', 'O bloco "Árbitro" funciona como terceiro que decide divergências no contrato; arbitragem propriamente dita exige convenção de arbitragem por escrito (e, em contrato de adesão, destaque e concordância específica).', 'The "Arbitrator" block is a third party deciding disputes within the contract; arbitration proper requires a written arbitration agreement (and, in adhesion contracts, specific highlighted consent).', en ? 'Brazilian Law 9,307/1996, art. 4' : 'Lei nº 9.307/1996, art. 4º');
        if (!has('foro')) add('lembrete', 'Considere a cláusula de eleição de foro (bloco "Foro de eleição").', 'Consider a jurisdiction clause (block "Jurisdiction").', en ? 'Brazilian Code of Civil Procedure, art. 63' : 'CPC, art. 63');
        if (blocks.some(b => ['pagamentoUnico', 'pagamentoPeriodico'].includes(b.type)) && !blocks.some(b => b.type === 'conversaoCambial')) add('lembrete', 'As dívidas em dinheiro pagam-se em moeda corrente: convém fixar o valor em reais (os valores do contrato já são escritos em reais e convertidos em Ether pela escala ou pela cotação).', 'Money debts are paid in legal tender: it is advisable to fix the amount in reais (contract amounts are written in BRL and converted to Ether by the scale or the price).', en ? 'Brazilian Civil Code, arts. 315 and 318' : 'CC, arts. 315 e 318');
        if (!lease && !has('arrependimento') && blocks.some(b => ['pagamentoUnico', 'custodia'].includes(b.type))) add('lembrete', 'Se for relação de consumo contratada fora do estabelecimento comercial (por exemplo, pela internet), o consumidor pode desistir em 7 dias: considere o bloco "Direito de arrependimento".', 'If this is a consumer contract made outside a business establishment (e.g. online), Brazilian law gives the consumer 7 days to withdraw: consider the "Right of withdrawal" block.', en ? 'Brazilian Consumer Code, art. 49' : 'CDC, art. 49');
        if (/(\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|[\w.+-]+@[\w-]+\.[\w.]+)/.test(allText)) add('aviso', 'O texto das cláusulas parece conter CPF, CNPJ ou e-mail: esse texto também vai para os comentários do código, que pode se tornar público. Use os "Dados das partes", que ficam só no documento assinado.', 'The clause text seems to contain an ID number or e-mail: this text also goes into the code comments, which may become public. Use "Party details", which stay only in the signed document.', en ? 'Data protection law (LGPD/GDPR)' : 'Lei nº 13.709/2018 (LGPD)');
        return out;
    }

    /** Avisos que não impedem a geração: riscos de equilíbrio entre as partes. */
    function warnings(model) {
        const out = [];
        const blocks = model.blocks || [];
        for (const r of blocks.filter(x => x.type === 'liberacaoPorEvento')) {
            const c = blocks.find(x => x.uid === r.params.alvo), e = blocks.find(x => x.uid === r.params.evento);
            if (c && e && e.params.prazo && Number(c.params.prazo) < Number(e.params.prazo) + Number(e.params.atestacao || 0)) out.push({ uid: c.uid,
                pt: 'O prazo de "' + c.label + '" (' + c.params.prazo + ' dias) é menor que o prazo de "' + e.label + '" somado ao prazo de atestação: o depositante só poderá reaver o valor depois de vencida a obrigação.',
                en: 'The deadline of "' + c.label + '" (' + c.params.prazo + ' days) is shorter than the deadline of "' + e.label + '" plus the attestation period: the depositor can only recover the amount once the obligation is overdue.' });
        }
        const hasArb = blocks.some(b => b.type === 'arbitro');
        for (const b of blocks.filter(x => BLOCKS[x.type] && BLOCKS[x.type].obligation)) {
            const pen = blocks.some(x => x.type === 'clausulaPenal' && x.params.alvo === b.uid);
            if (!hasArb && b.params.verificador === b.params.credor) {
                out.push({ uid: b.uid,
                    pt: 'Em "' + b.label + '", quem atesta é o próprio credor e não há árbitro: ' + (pen ? 'a cláusula penal depende' : 'o resultado depende') + ' da boa-fé do credor. Considere designar um terceiro para atestar ou acrescentar um árbitro.',
                    en: 'In "' + b.label + '", the attesting party is the creditor and there is no arbitrator: ' + (pen ? 'the penalty depends' : 'the outcome depends') + ' on the creditor\'s good faith. Consider a third party to attest, or add an arbitrator.' });
            }
            if (BLOCKS[b.type].obligation !== 'naoFazer' && /\[descreva|\[describe/.test(String(b.texto || BLOCKS[b.type].sentence.pt))) {
                out.push({ uid: b.uid, pt: 'Em "' + b.label + '", descreva o bem ou a prestação no lugar de "[descreva…]".', en: 'In "' + b.label + '", describe the item or service in place of "[describe…]".' });
            }
            if (BLOCKS[b.type].obligation === 'naoFazer' && /\[descreva|\[describe/.test(String(b.texto || BLOCKS[b.type].sentence.pt))) {
                out.push({ uid: b.uid, pt: 'Em "' + b.label + '", descreva a conduta vedada no lugar de "[descreva…]".', en: 'In "' + b.label + '", describe the prohibited conduct in place of "[describe…]".' });
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Contexto de geração (nomes no idioma escolhido)
    // ------------------------------------------------------------------
    function makeCtx(model, lang) {
        const en = lang === 'en';
        const w = (pt, e) => (en ? e : pt);
        // A variável de cada parte não pode coincidir com nomes gerados a partir das cláusulas (ex.: "precoEstado") nem com modificadores.
        const blockPrefixes = (model.blocks || []).map(b => camel(b.label));
        const roleVar = label => {
            const v = camel(label);
            const clash = blockPrefixes.some(pr => v !== pr && v.startsWith(pr)) || /^(apenas|only|na|in)[A-Z]/.test(v) || /^(saldo|valor|vencimento|proximo|prazo|ler|informar|atestar|pagar|depositar|liberar|reaver|sacar)[A-Z]/.test(v);
            return clash && !v.endsWith('Parte') ? v + 'Parte' : v;
        };
        const roles = (model.roles || []).map(r => ({ id: r.id, label: safe(r.label), v: roleVar(r.label), P: pascal(r.label) }));
        const roleById = id => roles.find(r => r.id === id);
        // I: sufixo dos nomes de função e evento, separado do ato por sublinhado (pagar_Aluguel).
        const blocks = (model.blocks || []).map(b => Object.assign({}, b, { label: safe(b.label), texto: b.texto == null ? b.texto : safe(b.texto), I: '_' + pascal(b.label), i: camel(b.label), U: upper(b.label) }));
        const byUid = uid => blocks.find(b => b.uid === uid);
        const arb = blocks.find(b => b.type === 'arbitro');
        const arbRole = arb ? roleById(arb.params.arbitro) : null;
        const witnessIds = new Set((model.blocks || []).filter(b => b.type === 'testemunha').map(b => b.params.testemunha));
        const partyRoles = roles.filter(r => (!arbRole || r.id !== arbRole.id) && !witnessIds.has(r.id));
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
            DadoIndisponivel: w('DadoIndisponivel', 'DataUnavailable'),
            EstadoObrigacao: w('EstadoObrigacao', 'ObligationState'), Pendente: w('Pendente', 'Pending'), Informado: w('CumprimentoInformado', 'PerformanceReported'),
            Cumprida: w('Cumprida', 'Fulfilled'), Descumprida: w('Descumprida', 'Breached'), EmDisputaObr: w('EmDisputa', 'Disputed'), SemDecisao: w('SemDecisao', 'Unresolved'),
            PRAZO_ARB: w('PRAZO_ARBITRO', 'ARBITRATION_PERIOD'),
            Aguardando_: w('AguardandoAssinaturas', 'AwaitingSignatures'), criadoEm: w('criadoEm', 'createdAt'), HASH: w('HASH_DO_TEXTO', 'TEXT_HASH'),
            SemSaldo: w('SemSaldo', 'NothingToWithdraw'), FalhaNoEnvio: w('FalhaNoEnvio', 'TransferFailed'), Reentrada: w('Reentrada', 'Reentrancy'),
            ContratoEncerrado: w('ContratoEncerrado', 'AgreementClosed'), Saque: w('Saque', 'Withdrawal'),
            devido: w('devido', 'due'), enviado: w('enviado', 'sent'), limite: w('limite', 'limit'), valor: w('valor', 'amount'), credor: w('credor', 'payee'), quando: w('quando', 'when')
        };
        const mod = role => N.apenas + role.P;
        const modPair = (a, b) => N.apenas + a.P + N.Ou + b.P;
        const allMoney = blocks.filter(b => ['pagamentoUnico', 'pagamentoPeriodico', 'custodia', 'etapas', 'caucao', 'clausulaPenal'].includes(b.type));
        const usesToken = blocks.some(b => b.type === 'pagamentoToken');
        return { lang, en, w, roles, roleById, blocks, byUid, arb, arbRole, partyRoles, N, mod, modPair, scale: model.scale || 1000, name: pascal(model.name || w('Contrato Montado', 'Composed Agreement')), allMoney, usesToken };
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
        return safe(clauseTitleRaw(block, ctx));
    }
    function clauseTitleRaw(block, ctx) {
        const def = BLOCKS[block.type];
        if (def.attached) {
            const target = ctx.byUid(block.params.alvo);
            return def.name[ctx.lang === 'en' ? 'en' : 'pt'] + (target ? ' (' + target.label + ')' : '');
        }
        const typeName = def.name[ctx.lang === 'en' ? 'en' : 'pt'];
        if (def.single || pascal(block.label) === pascal(typeName)) return def.single ? typeName : block.label;
        return block.label + ' (' + typeName.toLowerCase() + ')';
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

    /** Qualificação das partes (só no documento assinado; nunca no código). */
    function qualificacao(model, lang) {
        const en = lang === 'en';
        const roles = (model.roles || []).filter(r => r.nome || r.documento || r.endereco);
        if (!roles.length) return null;
        const items = (model.roles || []).map(r => {
            const parts = [r.label];
            if (r.nome) parts.push(r.nome);
            if (r.documento) parts.push((en ? 'ID/tax no. ' : 'documento nº ') + r.documento);
            if (r.endereco) parts.push((en ? 'address: ' : 'com endereço em ') + r.endereco);
            return parts.join(', ');
        });
        return (en ? 'The parties to this contract are: ' : 'Figuram neste contrato: ') + items.join('; ') +
            (en ? '; each also identified by their blockchain address, given at deployment.' : '; cada qual identificado também por seu endereço na "blockchain", informado na implantação.');
    }

    /** Texto integral do contrato, cuja impressão digital (SHA-256) é registrada no código. */
    function textoParaAssinatura(model, lang) {
        const head = String(model.name || '').trim().toUpperCase();
        const parts = minuta(model, lang);
        const q = qualificacao(model, lang);
        if (q) parts[0] = Object.assign({}, parts[0], { texto: q });
        return (head ? head + '\n\n' : '') + parts.map(c => c.numero + ' — ' + c.titulo + '\n' + c.texto).join('\n\n') + '\n';
    }

    function commentBlock(text, indent) {
        // Quebra o texto em linhas de até ~96 colunas, como comentário NatSpec.
        text = safe(text);
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
        const sig = blocks.find(b => b.type === 'assinaturas');
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
        let needsObligation = false;

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
        const adjOf = b => blocks.find(x => x.type === 'reajuste' && x.params.alvo === b.uid);
        const fxOf = b => blocks.find(x => x.type === 'conversaoCambial' && x.params.alvo === b.uid);
        const relOf = b => blocks.find(x => x.type === 'liberacaoPorEvento' && x.params.alvo === b.uid);
        const penOf = b => blocks.find(x => x.type === 'clausulaPenal' && x.params.alvo === b.uid);
        const arrOf = b => blocks.find(x => x.type === 'arrependimento' && x.params.alvo === b.uid);
        const subHeader = x => `\n    // ${'-'.repeat(70)}\n    // ${ordinal(blocks.indexOf(x) + 2, lang)} — ${clauseTitle(x, ctx)}\n${commentBlock(fillSentence(x, ctx), '    ')}\n    // ${'-'.repeat(70)}\n`;

        /** Valor-base de um pagamento: constante, reajustada por índice e/ou convertida pela cotação. */
        function baseOf(b, P) {
            const adj = adjOf(b), fx = fxOf(b);
            const K = fx ? `${P}_${w('VALOR_REAIS_CENTAVOS', 'AMOUNT_BRL_CENTS')}` : `${P}_${w('VALOR', 'AMOUNT')}`;
            if (fx) constants.push(`    uint256 public constant ${K} = ${Math.round(Number(b.params.valor) * 100)}; // ${money(b.params.valor, lang)} ${w('(em centavos; convertido em Ether pela cotação)', '(in cents; converted to Ether at the price)')}`);
            else constants.push(`    uint256 public constant ${K} = ${weiLiteral(toWei(b.params.valor, ctx.scale))}; // ${money(b.params.valor, lang)}`);
            if (!adj && !fx) return { expr: K, dynamic: false, code: '' };
            const idx = adj ? ctx.byUid(adj.params.indice) : null;
            const cot = fx ? ctx.byUid(fx.params.cotacao) : null;
            if (adj) needsBps = true;
            const fn = `_${w('valorBase', 'baseAmount')}${b.I}`;
            const lines = [`    /// @notice ${w('Valor-base', 'Base amount')}${adj ? w(' reajustado pelo índice', ' adjusted by the index') : ''}${fx ? w(' e convertido em Ether pela cotação', ' and converted to Ether at the price') : ''}.`,
                `    function ${fn}() private view returns (uint256 v) {`, `        v = ${K};`];
            if (idx) lines.push(`        v = v * (BPS + ${idx.i}${w('Valor', 'Value')}) / BPS; // ${w('índice em centésimos de ponto percentual (4,25% = 425)', 'index in hundredths of a percentage point (4.25% = 425)')}`);
            if (cot) lines.push(`        v = v * 1 ether / ${w('ler', 'read')}${cot.I}(); // ${w('centavos ÷ (centavos por ETH) = Ether', 'cents ÷ (cents per ETH) = Ether')}`);
            lines.push('    }');
            return { expr: fn + '()', dynamic: true, code: lines.join('\n') + '\n\n' };
        }

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
            // ${w('dias completos de atraso desde o vencimento (fração de dia não conta)', 'full days late since the due date (partial days do not count)')}
            uint256 ${w('diasAtraso', 'daysLate')} = (block.timestamp - ${w('vencimento', 'dueDate')}) / 1 days;
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
                const base = baseOf(b, P);
                const arr = arrOf(b);
                const arrHeld = b.i + w('EmArrependimento', 'InWithdrawalPeriod'), arrAt = b.i + w('PagoEm', 'PaidAt');
                constants.push(`    uint256 public constant ${P}_${w('PRAZO', 'DEADLINE')} = ${Math.round(b.params.prazo)} days;`);
                state.push(`    bool public ${paid};`);
                if (arr) state.push(`    uint256 public ${arrHeld};`, `    uint256 public ${arrAt};`);
                events.push(`    event ${w('Pagamento', 'Payment')}${b.I}(address indexed ${w('pagador', 'payer')}, uint256 ${N.valor}, uint256 ${w('encargos', 'charges')});`);
                const dm = useMod(dev);
                code.push(`${base.code}    /// @notice ${w('Vencimento do pagamento.', 'Payment due date.')}
    function ${w('vencimento', 'dueDate')}${b.I}() public view returns (uint256) {
        return ${N.inicio} + ${P}_${w('PRAZO', 'DEADLINE')};
    }

    /// @notice ${w('Valor devido agora, com encargos se houver atraso.', 'Amount due now, with charges if late.')}
    function ${w('valorDevido', 'amountDue')}${b.I}() public ${encOf(b) || base.dynamic ? 'view' : 'pure'} returns (uint256 total, uint256 ${w('encargos', 'charges')}) {
        total = ${base.expr};${lateCharges(b, `${w('vencimento', 'dueDate')}${b.I}()`, base.dynamic ? 'total' : base.expr)}
    }

    /// @notice ${w('Pagamento pelo valor exato devido.', 'Payment of the exact amount due.')}
    function ${w('pagar', 'pay')}${b.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${paid}) revert ${N.JaConcluido}();
        (uint256 total, uint256 ${w('encargos', 'charges')}) = ${w('valorDevido', 'amountDue')}${b.I}();
        if (msg.value != total) revert ${N.ValorIncorreto}(total, msg.value);
        ${paid} = true;
        ${arr ? `${arrHeld} = msg.value; // ${w('retido durante o prazo de arrependimento', 'held during the withdrawal period')}
        ${arrAt} = block.timestamp;` : credit(cre, 'msg.value')}
        emit ${w('Pagamento', 'Payment')}${b.I}(msg.sender, msg.value, ${w('encargos', 'charges')});
        ${N.verificar}();
    }`);
                if (!encOf(b)) code[0] = code[0].replace(`returns (uint256 total, uint256 ${w('encargos', 'charges')}) {\n        total = `, `returns (uint256 total, uint256 ${w('encargos', 'charges')}) {\n        ${w('encargos', 'charges')} = 0;\n        total = `);
                if (arr) {
                    const AP = `${P}_${w('PRAZO_ARREPENDIMENTO', 'WITHDRAWAL_PERIOD')}`;
                    constants.push(`    uint256 public constant ${AP} = ${Math.round(arr.params.prazo)} days;`);
                    events.push(`    event ${w('Arrependimento', 'Withdrawal')}${b.I}(address indexed ${w('destino', 'to')}, uint256 ${N.valor});`);
                    const pm = usePair(dev, cre);
                    code.push(`${subHeader(arr)}
    /// @notice ${w('Desistência do pagamento dentro do prazo de arrependimento, com devolução integral.', 'Withdrawal from the payment within the withdrawal period, with a full refund.')}
    function ${w('arrepender', 'withdrawFrom')}${b.I}() external ${dm} {
        if (${arrHeld} == 0) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${arrAt} + ${AP};
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        uint256 ${N.valor} = ${arrHeld};
        ${arrHeld} = 0;
        ${N.saldos}[${dev.v}] += ${N.valor};
        emit ${w('Arrependimento', 'Withdrawal')}${b.I}(${dev.v}, ${N.valor});
        ${N.verificar}();
    }

    /// @notice ${w('Esgotado o prazo de arrependimento, qualquer das partes confirma o pagamento, que passa ao credor.', 'After the withdrawal period, either party confirms the payment, which goes to the payee.')}
    function ${w('confirmarPagamento', 'confirmPayment')}${b.I}() external ${pm} {
        if (${arrHeld} == 0) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${arrAt} + ${AP};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        uint256 ${N.valor} = ${arrHeld};
        ${arrHeld} = 0;
        ${N.saldos}[${cre.v}] += ${N.valor};
        ${N.verificar}();
    }`);
                    retained.push(arrHeld);
                    onClose.push(`        if (${arrHeld} > 0) {
            // ${w('no encerramento: dentro do prazo de arrependimento, volta ao pagador; depois dele, vai ao credor', 'on closing: within the withdrawal period it returns to the payer; afterwards it goes to the payee')}
            ${N.saldos}[block.timestamp > ${arrAt} + ${P}_${w('PRAZO_ARREPENDIMENTO', 'WITHDRAWAL_PERIOD')} ? ${cre.v} : ${dev.v}] += ${arrHeld};
            ${arrHeld} = 0;
        }`);
                    concluded.push(`${arrHeld} == 0`);
                }
                concluded.push(paid);
            }

            if (b.type === 'pagamentoToken') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor);
                const paid = b.i + w('Pago', 'Paid');
                const dm = useMod(dev);
                constants.push(`    uint256 public constant ${P}_${w('VALOR_TOKEN', 'TOKEN_AMOUNT')} = ${Math.round(Number(b.params.valor) * 100) / 100} ether; // ${money(b.params.valor, lang)} ${w('em tBRL (18 casas decimais)', 'in tBRL (18 decimals)')}`);
                constants.push(`    uint256 public constant ${P}_${w('PRAZO', 'DEADLINE')} = ${Math.round(b.params.prazo)} days;`);
                state.push(`    bool public ${paid};`);
                events.push(`    event ${w('Pagamento', 'Payment')}${b.I}(address indexed ${w('pagador', 'payer')}, uint256 ${N.valor});`);
                code.push(`    /// @notice ${w('Pagamento em "stablecoin": antes, o devedor autoriza o contrato no próprio token (função approve).', 'Stablecoin payment: the debtor first authorizes the contract on the token itself (approve function).')}
    /// @dev ${w('O crédito é registrado antes da chamada ao token (checks-effects-interactions) e a função é protegida contra reentrância.', 'The credit is recorded before calling the token (checks-effects-interactions) and the function is reentrancy-protected.')}
    function ${w('pagar', 'pay')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) nonReentrant {
        if (${paid}) revert ${N.JaConcluido}();
        if (block.timestamp > ${N.inicio} + ${P}_${w('PRAZO', 'DEADLINE')}) revert ${N.PrazoEncerrado}(${N.inicio} + ${P}_${w('PRAZO', 'DEADLINE')});
        ${paid} = true;
        ${w('saldosToken', 'tokenBalances')}[${cre.v}] += ${P}_${w('VALOR_TOKEN', 'TOKEN_AMOUNT')};
        bool ok = token.transferFrom(msg.sender, address(this), ${P}_${w('VALOR_TOKEN', 'TOKEN_AMOUNT')});
        if (!ok) revert ${N.FalhaNoEnvio}();
        emit ${w('Pagamento', 'Payment')}${b.I}(msg.sender, ${P}_${w('VALOR_TOKEN', 'TOKEN_AMOUNT')});
        ${N.verificar}();
    }`);
                concluded.push(paid);
            }

            if (b.type === 'pagamentoPeriodico') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor);
                const pagas = b.i + w('ParcelasPagas', 'PaidInstallments');
                const acc = accOf(b);
                const accFlag = b.i + w('VencidoAntecipadamente', 'Accelerated');
                const base = baseOf(b, P);
                constants.push(`    uint256 public constant ${P}_${w('PARCELAS', 'INSTALLMENTS')} = ${Math.round(b.params.parcelas)};`);
                constants.push(`    uint256 public constant ${P}_${w('PERIODO', 'PERIOD')} = ${Math.round(b.params.periodo)} days;`);
                state.push(`    uint256 public ${pagas};`);
                if (acc) state.push(`    bool public ${accFlag};`);
                events.push(`    event ${w('Pagamento', 'Payment')}${b.I}(address indexed ${w('pagador', 'payer')}, uint256 indexed ${w('parcela', 'installment')}, uint256 ${N.valor}, uint256 ${w('encargos', 'charges')});`);
                const dm = useMod(dev);
                code.push(`${base.code}    /// @notice ${w('Vencimento da próxima parcela.', 'Due date of the next installment.')}
    /// @dev ${w('LIMITAÇÃO: datas de calendário (ex.: "todo dia 05") foram aproximadas por períodos fixos.', 'LIMITATION: calendar dates (e.g. "every 5th") were approximated by fixed periods.')}
    function ${w('proximoVencimento', 'nextDueDate')}${b.I}() public view returns (uint256) {
        return ${N.inicio} + (${pagas} + 1) * ${P}_${w('PERIODO', 'PERIOD')};
    }

    /// @notice ${w('Valor devido agora pela próxima parcela, com encargos se houver atraso.', 'Amount due now for the next installment, with charges if late.')}
    function ${w('valorDevido', 'amountDue')}${b.I}() public ${encOf(b) || base.dynamic ? 'view' : 'pure'} returns (uint256 total, uint256 ${w('encargos', 'charges')}) {
        ${encOf(b) ? '' : w('encargos', 'charges') + ' = 0;\n        '}total = ${base.expr};${lateCharges(b, `${w('proximoVencimento', 'nextDueDate')}${b.I}()`, base.dynamic ? 'total' : base.expr)}
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

    /// @notice ${w('Saldo devedor: parcelas ainda não pagas, mais os encargos de cada parcela em atraso.', 'Outstanding balance: unpaid installments, plus charges on each overdue installment.')}
    /// @dev ${w('Laço limitado ao número de parcelas (no máximo 360).', 'Loop bounded by the number of installments (at most 360).')}
    function ${w('saldoDevedor', 'outstanding')}${b.I}() public view returns (uint256 total) {
        uint256 ${w('base', 'base')}${b.I} = ${base.expr};
        for (uint256 k = ${pagas}; k < ${P}_${w('PARCELAS', 'INSTALLMENTS')}; k++) {
            total += ${w('base', 'base')}${b.I};${encOf(b) ? `
            uint256 ${w('venc', 'due')} = ${N.inicio} + (k + 1) * ${P}_${w('PERIODO', 'PERIOD')};
            if (block.timestamp > ${w('venc', 'due')} + ${P}_${w('TOLERANCIA', 'GRACE_PERIOD')}) {
                uint256 ${w('dias', 'daysLate')} = (block.timestamp - ${w('venc', 'due')}) / 1 days;
                total += ${w('base', 'base')}${b.I} * ${P}_${w('MULTA_BPS', 'LATE_FEE_BPS')} / BPS + ${w('base', 'base')}${b.I} * ${P}_${w('JUROS_MENSAIS_BPS', 'MONTHLY_INTEREST_BPS')} * ${w('dias', 'daysLate')} / (BPS * 30);
            }` : ''}
        }
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
                const cdisp = b.i + w('DisputaEm', 'DisputedAt');
                const carr = arrOf(b);
                if (carr) {
                    state.push(`    uint256 public ${b.i}${w('DepositadoEm', 'DepositedAt')};`);
                    constants.push(`    uint256 public constant ${P}_${w('PRAZO_ARREPENDIMENTO', 'WITHDRAWAL_PERIOD')} = ${Math.round(carr.params.prazo)} days;`);
                }
                if (ctx.arbRole) state.push(`    uint256 public ${cdisp};`);
                const relB = relOf(b), evB = relB ? ctx.byUid(relB.params.evento) : null;
                // Com liberação por evento: o evento ocorreu (libera ao beneficiário), falhou (permite a devolução) ou aguarda resolução.
                const EO = N.EstadoObrigacao, est = evB ? `${evB.i}${w('Estado', 'State')}` : null;
                const evReleased = !evB ? null : evB.type === 'oraculoEvento' ? `${evB.i}${w('Confirmado', 'Confirmed')}` : `${est} == ${EO}.${N.Cumprida}`;
                const evFailed = !evB ? null : evB.type === 'oraculoEvento' ? `!${evB.i}${w('Confirmado', 'Confirmed')}`
                    : `(${est} == ${EO}.${N.Descumprida} || ${est} == ${EO}.${N.SemDecisao} || (${est} == ${EO}.${N.Pendente} && block.timestamp > ${w('prazoFinal', 'finalDeadline')}${evB.I}()))`;
                const evPending = !evB || evB.type === 'oraculoEvento' ? null : `(${est} == ${EO}.${N.Informado} || ${est} == ${EO}.${N.EmDisputaObr})`;
                events.push(`    event ${w('Deposito', 'Deposit')}${b.I}(address indexed ${w('depositante', 'depositor')}, uint256 ${N.valor}, uint256 ${w('prazoFinal', 'deadline')});`);
                events.push(`    event ${w('Destinacao', 'Allocation')}${b.I}(address indexed ${w('beneficiario', 'beneficiary')}, uint256 ${N.valor});`);
                const dm = useMod(dep);
                code.push(`    /// @notice ${w('Depósito do valor; inicia a contagem do prazo.', 'Deposit of the amount; starts the deadline.')}
    function ${w('depositar', 'deposit')}${b.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Aguardando}) revert ${N.JaConcluido}();
        if (msg.value != ${P}_${w('VALOR', 'AMOUNT')}) revert ${N.ValorIncorreto}(${P}_${w('VALOR', 'AMOUNT')}, msg.value);
        ${st} = ${N.EstadoGarantia}.${N.Depositado};
        ${held} = msg.value;
        ${dl} = block.timestamp + ${P}_${w('PRAZO', 'DEADLINE')};${arrOf(b) ? `
        ${b.i}${w('DepositadoEm', 'DepositedAt')} = block.timestamp;` : ''}
        emit ${w('Deposito', 'Deposit')}${b.I}(msg.sender, msg.value, ${dl});
    }

    /// @notice ${w('Confirmação do cumprimento: o valor é liberado ao beneficiário.', 'Confirmation of performance: the amount is released to the beneficiary.')}
    /// @dev ${w('LIMITAÇÃO: o cumprimento no mundo real não é verificável pelo contrato; depende da confirmação da parte.', 'LIMITATION: real-world performance cannot be verified on-chain; it depends on the party\'s confirmation.')}
    function ${w('liberar', 'release')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        _${w('destinar', 'allocate')}${b.I}(${ben.v});
    }

    /// @notice ${w('Devolução ao depositante, esgotado o prazo sem confirmação nem disputa.', 'Refund to the depositor after the deadline without confirmation or dispute.')}${evB ? `
    /// @dev ${w('Com liberação por evento, só cabe a devolução se o evento não ocorreu (obrigação descumprida, sem decisão ou com prazo vencido); vale também após o encerramento.', 'With release on event, refund is only possible if the event failed (obligation breached, unresolved or past its deadline); also after closing.')}` : ''}
    function ${w('reaver', 'refund')}${b.I}() external ${dm}${evB ? '' : ` ${N.naSituacao}(${N.Situacao}.${N.Ativo})`} {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        if (${evB ? `${N.situacao} == ${N.Situacao}.${N.Ativo} && ` : ''}block.timestamp <= ${dl}) revert ${N.PrazoNaoEncerrado}(${dl});${evB ? `
        if (!${evFailed}) revert ${N.NaoDisponivel}(); // ${w('o evento que libera o valor ocorreu ou ainda pode ocorrer', 'the releasing event has occurred or may still occur')}` : ''}
        _${w('destinar', 'allocate')}${b.I}(${dep.v});
    }`);
                if (ctx.arbRole) {
                    const pm = usePair(dep, ben);
                    const am = useMod(ctx.arbRole);
                    code.push(`
    /// @notice ${w('Qualquer das partes submete a divergência ao árbitro.', 'Either party refers the dispute to the arbitrator.')}
    function ${w('abrirDisputa', 'openDispute')}${b.I}() external ${pm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();${evB ? `
        if (${evReleased}) revert ${N.NaoDisponivel}(); // ${w('ocorrido o evento, o valor cabe ao beneficiário', 'once the event has occurred, the amount belongs to the beneficiary')}` : ''}
        ${st} = ${N.EstadoGarantia}.${N.EmDisputa};
        ${cdisp} = block.timestamp;
    }

    /// @notice ${w('Decisão do árbitro sobre a destinação do valor.', 'Arbitrator\'s decision on where the amount goes.')}
    function ${w('decidirDisputa', 'resolveDispute')}${b.I}(bool ${w('favorBeneficiario', 'favorBeneficiary')}) external ${am} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.EmDisputa}) revert ${N.NaoDisponivel}();
        _${w('destinar', 'allocate')}${b.I}(${w('favorBeneficiario', 'favorBeneficiary')} ? ${ben.v} : ${dep.v});
    }

    /// @notice ${w('Sem decisão do árbitro no prazo, qualquer das partes encerra a disputa e o valor volta ao depositante.', 'Without the arbitrator\'s decision in time, either party ends the dispute and the amount returns to the depositor.')}
    function ${w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision')}${b.I}() external ${pm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.EmDisputa}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${cdisp} + ${N.PRAZO_ARB};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        _${w('destinar', 'allocate')}${b.I}(${dep.v});
    }`);
                }
                const rel = relB;
                const evb = evB;
                if (evb) {
                    const bm = useMod(ben);
                    code.push(`
    // ${'-'.repeat(70)}
    // ${ordinal(blocks.indexOf(rel) + 2, lang)} — ${clauseTitle(rel, ctx)}
${commentBlock(fillSentence(rel, ctx), '    ')}
    // ${'-'.repeat(70)}

    /// @notice ${evb.type === 'oraculoEvento' ? w('Liberação ao beneficiário depois que a fonte designada atestar o evento.', 'Release to the beneficiary after the designated source attests the event.') : w('Liberação ao beneficiário depois de atestado o cumprimento da obrigação indicada.', 'Release to the beneficiary once the indicated obligation is attested as fulfilled.')}
    function ${w('liberarPorEvento', 'releaseOnEvent')}${b.I}() external ${bm} {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        if (${evb.type === 'oraculoEvento' ? `!${evb.i}${w('Confirmado', 'Confirmed')}` : `${evb.i}${w('Estado', 'State')} != ${N.EstadoObrigacao}.${N.Cumprida}`}) revert ${N.NaoDisponivel}();
        _${w('destinar', 'allocate')}${b.I}(${ben.v});
    }`);
                }
                if (carr) code.push(`${subHeader(carr)}
    /// @notice ${w('Desistência do depositante dentro do prazo de arrependimento, com devolução integral.', 'Withdrawal by the depositor within the withdrawal period, with a full refund.')}
    function ${w('arrepender', 'withdrawFrom')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${N.EstadoGarantia}.${N.Depositado}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${b.i}${w('DepositadoEm', 'DepositedAt')} + ${P}_${w('PRAZO_ARREPENDIMENTO', 'WITHDRAWAL_PERIOD')};
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        _${w('destinar', 'allocate')}${b.I}(${dep.v});
    }`);
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
                onClose.push(evB ? `        if (${held} > 0) {
            if (${evReleased}) {
                ${N.saldos}[${ben.v}] += ${held}; // ${w('o evento ocorreu: o valor cabe ao beneficiário', 'the event occurred: the amount belongs to the beneficiary')}
                ${held} = 0;
                ${st} = ${N.EstadoGarantia}.${N.Concluido};
            } else if (${evPending ? `!${evPending}` : 'true'}) {
                ${N.saldos}[${dep.v}] += ${held}; // ${w('devolução ao depositante', 'refund to depositor')}
                ${held} = 0;
                ${st} = ${N.EstadoGarantia}.${N.Concluido};
            } else {
                ${st} = ${N.EstadoGarantia}.${N.Depositado}; // ${w('aguarda a resolução da obrigação, mesmo após o encerramento', 'awaits the outcome of the obligation, even after closing')}
            }
        }` : `        if (${held} > 0) {
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
                onClose.push(`        if (${at} != 0 && block.timestamp > ${at} + ${A} && ${apr} < ${E}) {
            // ${w('etapa entregue cujo prazo de aprovação já se esgotou: aprovada tacitamente', 'delivered milestone whose approval period has passed: tacitly approved')}
            uint256 ${b.i}${w('Etapa', 'Milestone')} = ${w('valorDaEtapa', 'milestoneAmount')}${b.I}(${apr});
            ${apr} += 1;
            ${at} = 0;
            ${held} -= ${b.i}${w('Etapa', 'Milestone')};
            ${N.saldos}[${cd.v}] += ${b.i}${w('Etapa', 'Milestone')};
        }
        if (${held} > 0) {
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
                const gdisp = b.i + w('DisputaEm', 'DisputedAt');
                if (ctx.arbRole) state.push(`    uint256 public ${claim};`, `    uint256 public ${gdisp};`);
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
        if (block.timestamp > ${N.encerradoEm} + ${PR}) revert ${N.PrazoEncerrado}(${N.encerradoEm} + ${PR});
        if (${N.valor} == 0 || ${N.valor} > ${held} || bytes(${w('motivo', 'reason')}).length == 0) revert ${N.ParametroInvalido}();
        ${claim} = ${N.valor};
        ${st} = ${N.EstadoGarantia}.${N.EmDisputa};
        ${gdisp} = block.timestamp;
        emit ${w('Movimento', 'Movement')}${b.I}(${w('motivo', 'reason')}, ${ben.v}, ${N.valor});
    }

    /// @notice ${w('Decisão do árbitro: quanto da caução cabe ao beneficiário (até o valor reclamado).', 'Arbitrator\'s decision: how much of the deposit goes to the beneficiary (up to the claim).')}
    function ${w('decidir', 'resolve')}${b.I}(uint256 ${w('valorAoBeneficiario', 'amountToBeneficiary')}) external ${am} ${N.naSituacao}(${N.Situacao}.${N.Encerrado}) {
        if (${st} != ${N.EstadoGarantia}.${N.EmDisputa}) revert ${N.NaoDisponivel}();
        if (${w('valorAoBeneficiario', 'amountToBeneficiary')} > ${claim}) revert ${N.ParametroInvalido}();
        _${w('repartir', 'split')}${b.I}(${w('valorAoBeneficiario', 'amountToBeneficiary')});
    }

    /// @notice ${w('Sem decisão do árbitro no prazo, qualquer das partes encerra a disputa e a caução volta integralmente ao garantidor.', 'Without the arbitrator\'s decision in time, either party ends the dispute and the full deposit returns to the guarantor.')}
    function ${w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision')}${b.I}() external ${usePair(gar, ben)} ${N.naSituacao}(${N.Situacao}.${N.Encerrado}) {
        if (${st} != ${N.EstadoGarantia}.${N.EmDisputa}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${gdisp} + ${N.PRAZO_ARB};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        _${w('repartir', 'split')}${b.I}(0);
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

            if (b.type === 'oraculoValor') {
                const src = roleById(b.params.fonte);
                const sm = useMod(src);
                const val = b.i + w('Valor', 'Value'), upd = b.i + w('AtualizadoEm', 'UpdatedAt'), V = `${P}_${w('VALIDADE', 'VALIDITY')}`;
                constants.push(`    uint256 public constant ${V} = ${Math.round(b.params.validade)} days;`);
                state.push(`    uint256 public ${val}; // ${w('valor × 100 (duas casas decimais)', 'value × 100 (two decimal places)')}`, `    uint256 public ${upd};`);
                events.push(`    event ${w('Informacao', 'Data')}${b.I}(uint256 ${N.valor}, uint256 ${N.quando});`);
                code.push(`    /// @notice ${w('Registro da informação pela fonte designada. Informe o valor multiplicado por 100 (ex.: 4,25 → 425; R$ 15.000,00 → 1500000).', 'The designated source records the data. Enter the value multiplied by 100 (e.g. 4.25 → 425; R$ 15,000.00 → 1500000).')}
    /// @param ${N.valor} ${w('valor multiplicado por 100', 'value multiplied by 100')}
    /// @dev ${w('LIMITAÇÃO: o contrato confia na fonte designada; valores negativos não são suportados.', 'LIMITATION: the contract trusts the designated source; negative values are not supported.')}
    function ${w('informar', 'report')}${b.I}(uint256 ${N.valor}) external ${sm} {
        ${val} = ${N.valor};
        ${upd} = block.timestamp;
        emit ${w('Informacao', 'Data')}${b.I}(${N.valor}, block.timestamp);
    }

    /// @notice ${w('Leitura da informação; recusada se ainda não informada ou desatualizada.', 'Reads the data; rejected if not yet reported or outdated.')}
    function ${w('ler', 'read')}${b.I}() public view returns (uint256) {
        if (${upd} == 0 || ${val} == 0 || block.timestamp > ${upd} + ${V}) revert ${N.DadoIndisponivel}(${upd});
        return ${val};
    }`);
            }

            if (b.type === 'oraculoEvento') {
                const src = roleById(b.params.fonte);
                const sm = useMod(src);
                const ok = b.i + w('Confirmado', 'Confirmed'), at = b.i + w('ConfirmadoEm', 'ConfirmedAt');
                state.push(`    bool public ${ok};`, `    uint256 public ${at};`);
                events.push(`    event ${w('Evento', 'Event')}${b.I}(uint256 ${N.quando});`);
                code.push(`    /// @notice ${w('A fonte designada atesta a ocorrência do evento (registro definitivo).', 'The designated source attests that the event occurred (final record).')}
    function ${w('atestar', 'attest')}${b.I}() external ${sm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${ok}) revert ${N.JaConcluido}();
        ${ok} = true;
        ${at} = block.timestamp;
        emit ${w('Evento', 'Event')}${b.I}(block.timestamp);
    }`);
            }

            if (BLOCKS[b.type].obligation) {
                needsObligation = true;
                const nao = b.type === 'obrigacaoNaoFazer', dar = b.type === 'obrigacaoDar';
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor), ver = roleById(b.params.verificador);
                const E = N.EstadoObrigacao, st = b.i + w('Estado', 'State');
                const S = x => `${E}.${N[x]}`;
                const ev = `${w('Obrigacao', 'Obligation')}${b.I}`;
                const pen = penOf(b);
                const held = b.i + w('GarantiaRetida', 'BondHeld');
                const penEv = `${w('ClausulaPenal', 'Penalty')}${b.I}`;
                const disp = b.i + w('DisputaEm', 'DisputedAt');
                const arb = ctx.arbRole;
                const dm = useMod(dev), vm = useMod(ver), pm = usePair(dev, cre);
                const fin = w('prazoFinal', 'finalDeadline') + b.I;
                state.push(`    ${E} public ${st};`);
                if (arb) state.push(`    uint256 public ${disp};`);
                events.push(`    event ${ev}(string ${w('ato', 'act')}, uint256 ${N.quando});`);
                let PZ, AT, inf, reab, rec;
                if (nao) {
                    PZ = `${P}_${w('DURACAO', 'DURATION')}`;
                    constants.push(`    uint256 public constant ${PZ} = ${Math.round(b.params.duracao)} days;`);
                } else {
                    PZ = `${P}_${w('PRAZO', 'DEADLINE')}`;
                    AT = `${P}_${w('PRAZO_ATESTACAO', 'ATTESTATION_PERIOD')}`;
                    inf = b.i + w('InformadoEm', 'ReportedAt');
                    reab = b.i + w('PrazoReaberto', 'ReopenedDeadline');
                    rec = b.i + w('Recusado', 'Rejected');
                    constants.push(`    uint256 public constant ${PZ} = ${Math.round(b.params.prazo)} days;`);
                    constants.push(`    uint256 public constant ${AT} = ${Math.round(b.params.atestacao)} days;`);
                    state.push(`    uint256 public ${inf};`, `    uint256 public ${reab}; // ${w('novo prazo após recusa (0 enquanto não houver)', 'new deadline after a rejection (0 if none)')}`);
                    if (arb) state.push(`    bool public ${rec};`);
                }
                // Transição para estado final: destina a garantia da cláusula penal, se houver.
                code.push(`    /// @dev ${w('Define o estado final da obrigação e destina a garantia da cláusula penal, se houver.', 'Sets the final state of the obligation and allocates the penalty bond, if any.')}
    function _${w('definir', 'settle')}${b.I}(${E} ${w('novo', 'next')}, string memory ${w('ato', 'act')}) private {
        ${st} = ${w('novo', 'next')};
        emit ${ev}(${w('ato', 'act')}, block.timestamp);${pen ? `
        if (${held} > 0) {
            uint256 ${N.valor} = ${held};
            ${held} = 0;
            address ${w('destino', 'to')} = ${w('novo', 'next')} == ${S('Descumprida')} ? ${cre.v} : ${dev.v};
            ${N.saldos}[${w('destino', 'to')}] += ${N.valor};
            emit ${penEv}(${w('novo', 'next')} == ${S('Descumprida')} ? "${w('clausula penal ao credor', 'penalty to the creditor')}" : "${w('garantia devolvida ao devedor', 'bond returned to the debtor')}", ${w('destino', 'to')}, ${N.valor});
        }` : ''}
        ${N.verificar}();
    }
`);
                if (!nao) {
                    const fnInf = dar ? w('informarEntrega', 'reportDelivery') : w('informarCumprimento', 'reportPerformance');
                    const fnAt = dar ? w('atestarRecebimento', 'attestReceipt') : w('atestarCumprimento', 'attestPerformance');
                    const fnRec = dar ? w('recusarEntrega', 'rejectDelivery') : w('recusarCumprimento', 'rejectPerformance');
                    code.push(`    /// @notice ${w('Prazo final para cumprir: o original ou, após uma recusa, o prazo reaberto.', 'Final deadline to perform: the original one or, after a rejection, the reopened one.')}
    function ${fin}() public view returns (uint256) {
        uint256 ${w('original', 'original')} = ${N.inicio} + ${PZ};
        return ${reab} > ${w('original', 'original')} ? ${reab} : ${w('original', 'original')};
    }

    /// @notice ${dar ? w('O devedor informa que entregou o bem, dentro do prazo.', 'The debtor reports that the item was delivered, within the deadline.') : w('O devedor informa que realizou a prestação, dentro do prazo.', 'The debtor reports that the service was performed, within the deadline.')}
    function ${fnInf}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${S('Pendente')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${fin}();
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        ${st} = ${S('Informado')};
        ${inf} = block.timestamp;${arb ? `\n        ${rec} = false;` : ''}
        emit ${ev}("${w('cumprimento informado', 'performance reported')}", block.timestamp);
    }

    /// @notice ${w('Quem atesta confirma o cumprimento (também durante disputa, encerrando-a).', 'The attesting party confirms performance (also during a dispute, ending it).')}
    /// @dev ${w('LIMITAÇÃO: o contrato não verifica fatos do mundo real; depende da atestação de quem foi designado.', 'LIMITATION: the contract cannot verify real-world facts; it depends on the designated party\'s attestation.')}
    function ${fnAt}${b.I}() external ${vm} {
        if (${st} != ${S('Pendente')} && ${st} != ${S('Informado')} && ${st} != ${S('EmDisputaObr')}) revert ${N.NaoDisponivel}();
        if (${st} == ${S('Pendente')} && ${N.situacao} != ${N.Situacao}.${N.Ativo}) revert ${N.SituacaoInvalida}();
        _${w('definir', 'settle')}${b.I}(${S('Cumprida')}, "${w('cumprimento atestado', 'performance attested')}");
    }

    /// @notice ${w('Recusa fundamentada, dentro do prazo de atestação; reabre ao devedor igual prazo para cumprir.', 'Reasoned rejection within the attestation period; gives the debtor the same period again to perform.')}
    /// @dev ${w('Encerrado o contrato com o cumprimento informado, a recusa ainda cabe no prazo de atestação, mas já não há prazo para cumprir de novo: segue ao árbitro, se houver, ou importa descumprimento.', 'If the contract closed with performance reported, rejection is still possible within the attestation period, but there is no time left to perform again: it goes to the arbitrator, if any, or means breach.')}
    function ${fnRec}${b.I}(string calldata ${w('motivo', 'reason')}) external ${vm} {
        if (${st} != ${S('Informado')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${inf} + ${AT};
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        if (bytes(${w('motivo', 'reason')}).length == 0) revert ${N.ParametroInvalido}();
        if (${N.situacao} != ${N.Situacao}.${N.Ativo}) {
            ${arb ? `${st} = ${S('EmDisputaObr')};
            ${disp} = block.timestamp;
            emit ${ev}(${w('motivo', 'reason')}, block.timestamp);` : `_${w('definir', 'settle')}${b.I}(${S('Descumprida')}, ${w('motivo', 'reason')});`}
            return;
        }
        uint256 ${w('novoPrazo', 'newDeadline')} = block.timestamp + ${AT};
        if (${w('novoPrazo', 'newDeadline')} > ${fin}()) ${reab} = ${w('novoPrazo', 'newDeadline')};
        ${st} = ${S('Pendente')};${arb ? `\n        ${rec} = true;` : ''}
        emit ${ev}(${w('motivo', 'reason')}, block.timestamp);
    }

    /// @notice ${w('Atestação tácita: sem atestação nem recusa no prazo, o cumprimento informado vale como atestado.', 'Tacit attestation: without attestation or rejection in time, the reported performance counts as attested.')}
    function ${w('atestarTacitamente', 'attestByTimeout')}${b.I}() external ${dm} {
        if (${st} != ${S('Informado')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${inf} + ${AT};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        _${w('definir', 'settle')}${b.I}(${S('Cumprida')}, "${w('atestacao tacita', 'tacit attestation')}");
    }

    /// @notice ${w('Vencido o prazo sem cumprimento informado, qualquer das partes declara o inadimplemento.', 'After the deadline with no performance reported, either party declares default.')}
    function ${w('declararInadimplemento', 'declareDefault')}${b.I}() external ${pm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${S('Pendente')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${fin}();
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        _${w('definir', 'settle')}${b.I}(${S('Descumprida')}, "${w('inadimplemento', 'default')}");
    }`);
                    if (arb) code.push(`
    /// @notice ${w('Recusado o cumprimento, o devedor pode, em vez de cumprir de novo, submeter a recusa ao árbitro.', 'After a rejection, instead of performing again, the debtor may refer the rejection to the arbitrator.')}
    function ${w('contestarRecusa', 'contestRejection')}${b.I}() external ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${S('Pendente')} || !${rec}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${fin}();
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        ${rec} = false;
        ${st} = ${S('EmDisputaObr')};
        ${disp} = block.timestamp;
        emit ${ev}("${w('recusa submetida ao arbitro', 'rejection referred to the arbitrator')}", block.timestamp);
    }`);
                    else code.push(`
    // ${w('LIMITAÇÃO: sem árbitro, a recusa depende da boa-fé de quem atesta; o devedor dispõe apenas do prazo reaberto para cumprir de novo.', 'LIMITATION: without an arbitrator, rejection depends on the attesting party\'s good faith; the debtor only gets the reopened period to perform again.')}`);
                    concluded.push(`(${st} == ${S('Cumprida')} || ${st} == ${S('Descumprida')} || ${st} == ${S('SemDecisao')})`);
                    // Cumprimento informado dentro do prazo de atestação, ou em disputa: a garantia aguarda a resolução após o encerramento.
                    if (pen) onClose.push(`        if (${held} > 0 && ${st} != ${S('EmDisputaObr')} && !(${st} == ${S('Informado')} && block.timestamp <= ${inf} + ${AT})) {
            uint256 ${b.i}${w('Garantia', 'Bond')} = ${held};
            ${held} = 0;
            if (${st} == ${S('Pendente')} && block.timestamp > ${fin}()) {
                ${st} = ${S('Descumprida')}; // ${w('prazo vencido sem cumprimento: inadimplemento', 'deadline passed without performance: default')}
                ${N.saldos}[${cre.v}] += ${b.i}${w('Garantia', 'Bond')};
            } else {
                if (${st} == ${S('Informado')}) ${st} = ${S('Cumprida')}; // ${w('prazo de atestação esgotado: atestação tácita', 'attestation period over: tacit attestation')}
                ${N.saldos}[${dev.v}] += ${b.i}${w('Garantia', 'Bond')}; // ${w('obrigação ainda não vencida ou cumprida', 'obligation not yet due or fulfilled')}
            }
        }`);
                } else {
                    code.push(`    /// @notice ${w('Registro de violação durante o prazo da abstenção, com a descrição do fato.', 'Records a breach during the abstention period, describing the fact.')}${arb ? ' ' + w('Havendo árbitro, a violação depende de sua confirmação.', 'With an arbitrator, the breach depends on their confirmation.') : ''}
    /// @dev ${w('LIMITAÇÃO: o contrato não observa condutas no mundo real; depende do registro de quem foi designado.', 'LIMITATION: the contract cannot observe real-world conduct; it depends on the designated party\'s record.')}
    function ${w('registrarViolacao', 'recordBreach')}${b.I}(string calldata ${w('descricao', 'description')}) external ${vm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${S('Pendente')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${N.inicio} + ${PZ};
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        if (bytes(${w('descricao', 'description')}).length == 0) revert ${N.ParametroInvalido}();
        ${arb ? `${st} = ${S('EmDisputaObr')};
        ${disp} = block.timestamp;
        emit ${ev}(${w('descricao', 'description')}, block.timestamp);` : `_${w('definir', 'settle')}${b.I}(${S('Descumprida')}, ${w('descricao', 'description')});`}
    }

    /// @notice ${w('Findo o prazo sem violação registrada, qualquer das partes declara a obrigação cumprida.', 'Once the period ends without a recorded breach, either party declares the obligation fulfilled.')}
    function ${w('declararCumprimento', 'declareFulfilled')}${b.I}() external ${pm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${st} != ${S('Pendente')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${N.inicio} + ${PZ};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        _${w('definir', 'settle')}${b.I}(${S('Cumprida')}, "${w('cumprimento', 'fulfilled')}");
    }`);
                    concluded.push(`(${st} == ${S('Cumprida')} || ${st} == ${S('Descumprida')} || ${st} == ${S('SemDecisao')})`);
                    if (pen) onClose.push(`        if (${held} > 0 && ${st} != ${S('EmDisputaObr')}) {
            uint256 ${b.i}${w('Garantia', 'Bond')} = ${held};
            ${held} = 0;
            ${N.saldos}[${dev.v}] += ${b.i}${w('Garantia', 'Bond')}; // ${w('sem violação confirmada, a garantia volta ao devedor', 'without a confirmed breach, the bond returns to the debtor')}
        }`);
                }
                if (arb) {
                    const am = useMod(arb);
                    code.push(`
    /// @notice ${w('O árbitro decide a disputa sobre o cumprimento (também após o encerramento do contrato).', 'The arbitrator decides the dispute over performance (also after the contract is closed).')}
    function ${w('decidirCumprimento', 'resolvePerformance')}${b.I}(bool ${w('cumprida', 'fulfilled')}) external ${am} {
        if (${st} != ${S('EmDisputaObr')}) revert ${N.NaoDisponivel}();
        _${w('definir', 'settle')}${b.I}(${w('cumprida', 'fulfilled')} ? ${S('Cumprida')} : ${S('Descumprida')}, ${w('cumprida', 'fulfilled')} ? "${w('cumprimento reconhecido pelo arbitro', 'performance upheld by the arbitrator')}" : "${w('descumprimento reconhecido pelo arbitro', 'breach upheld by the arbitrator')}");
    }

    /// @notice ${w('Sem decisão do árbitro no prazo, qualquer das partes encerra a disputa; a garantia volta a quem a depositou.', 'Without the arbitrator\'s decision in time, either party ends the dispute; the bond returns to whoever deposited it.')}
    function ${w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision')}${b.I}() external ${pm} {
        if (${st} != ${S('EmDisputaObr')}) revert ${N.NaoDisponivel}();
        uint256 ${N.limite} = ${disp} + ${N.PRAZO_ARB};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        _${w('definir', 'settle')}${b.I}(${S('SemDecisao')}, "${w('disputa sem decisao do arbitro', 'dispute without arbitrator decision')}");
    }`);
                }
            }

            if (b.type === 'clausulaPenal') {
                const t = ctx.byUid(b.params.alvo);
                if (t) {
                    const dev = roleById(t.params.devedor);
                    const tst = t.i + w('Estado', 'State');
                    const held = t.i + w('GarantiaRetida', 'BondHeld'), done = t.i + w('GarantiaDepositada', 'BondDeposited');
                    const V = `${t.U}_${w('CLAUSULA_PENAL', 'PENALTY')}`;
                    const ev = `${w('ClausulaPenal', 'Penalty')}${t.I}`;
                    constants.push(`    uint256 public constant ${V} = ${weiLiteral(toWei(b.params.valor, scale))}; // ${money(b.params.valor, lang)}`);
                    state.push(`    bool public ${done};`, `    uint256 public ${held};`);
                    events.push(`    event ${ev}(string ${w('ato', 'act')}, address indexed ${w('destino', 'to')}, uint256 ${N.valor});`);
                    const dm = useMod(dev);
                    code.push(`    /// @notice ${w('Depósito da garantia pelo devedor, enquanto a obrigação estiver em aberto.', 'The debtor deposits the bond while the obligation is open.')}
    /// @dev ${w('A garantia é destinada automaticamente: ao credor no descumprimento, ao devedor no cumprimento ou no encerramento antes do vencimento. LIMITAÇÃO: o contrato não obriga o depósito; a cláusula penal só alcança o valor efetivamente depositado.', 'The bond is allocated automatically: to the creditor on breach, to the debtor on performance or on closing before the due date. LIMITATION: the contract cannot force the deposit; the penalty only reaches the amount actually deposited.')}
    function ${w('depositarGarantia', 'depositBond')}${t.I}() external payable ${dm} ${N.naSituacao}(${N.Situacao}.${N.Ativo}) {
        if (${done}) revert ${N.JaConcluido}();
        if (${tst} != ${N.EstadoObrigacao}.${N.Pendente} && ${tst} != ${N.EstadoObrigacao}.${N.Informado}) revert ${N.NaoDisponivel}();
        if (msg.value != ${V}) revert ${N.ValorIncorreto}(${V}, msg.value);
        ${done} = true;
        ${held} = msg.value;
        emit ${ev}("${w('deposito', 'deposit')}", address(this), msg.value);
    }`);
                    retained.push(held);
                }
            }

            if (b.type === 'arrependimento') {
                code.push(`    // ${w('Aplicado na seção da cláusula indicada (funções de arrependimento).', 'Applied in the section of the indicated clause (withdrawal functions).')}`);
            }

            if (b.type === 'reajuste' || b.type === 'conversaoCambial') {
                code.push(`    // ${w('Aplicado no cálculo do valor-base do pagamento indicado.', 'Applied to the base amount of the indicated payment.')}`);
            }

            if (b.type === 'assinaturas') {
                const hash = '0x' + sha256Hex(textoParaAssinatura(model, lang));
                const PA = w('PRAZO_ASSINATURAS', 'SIGNATURE_PERIOD'), TS = w('TOTAL_SIGNATARIOS', 'TOTAL_SIGNATORIES');
                const signed = w('assinadoEm', 'signedAt'), count = w('assinaturas', 'signatureCount'), doc = w('documentoAssinado', 'signedDocument');
                constants.push(`    /// @notice ${w('Impressão digital (SHA-256) do texto do contrato, conferível com o arquivo de texto baixado na página.', 'Fingerprint (SHA-256) of the contract text, verifiable against the text file downloaded from the page.')}`);
                constants.push(`    bytes32 public constant ${N.HASH} = ${hash};`);
                constants.push(`    uint256 public constant ${PA} = ${Math.round(b.params.prazo)} days;`);
                constants.push(`    uint256 public constant ${TS} = ${ctx.roles.length};`);
                state.push(`    mapping(address => uint256) public ${signed};`, `    uint256 public ${count};`,
                    `    bytes32 public ${doc}; // ${w('impressão digital do PDF assinado fora da "blockchain" (opcional)', 'fingerprint of the PDF signed off-chain (optional)')}`);
                events.push(`    event ${w('Assinatura', 'Signature')}(address indexed ${w('signatario', 'signatory')}, bytes32 ${w('hashDoTexto', 'textHash')}, bytes32 ${w('documento', 'document')});`);
                events.push(`    event ${w('DocumentoRegistrado', 'DocumentRecorded')}(address indexed ${w('parte', 'party')}, bytes32 ${w('hashDoDocumento', 'documentHash')});`);
                events.push(`    event ${w('ContratoEmVigor', 'AgreementInForce')}(uint256 ${N.quando});`);
                const sm = w('apenasSignatarios', 'onlySignatories');
                modifiers.set(sm, `    modifier ${sm}() {
        if (${ctx.roles.map(r => `msg.sender != ${r.v}`).join(' && ')}) revert ${N.NaoAutorizado}();
        _;
    }`);
                const AG = `${N.Situacao}.${N.Aguardando_}`;
                code.push(`    /// @notice ${w('Registra, antes da primeira assinatura, a impressão digital (SHA-256) do PDF assinado por serviço de assinatura eletrônica (gov.br, ICP-Brasil ou equivalente estrangeiro).', 'Records, before the first signature, the fingerprint (SHA-256) of the PDF signed with an electronic signature service (gov.br, ICP-Brasil, eIDAS or equivalent).')}
    /// @dev ${w('Só a impressão digital vai para a "blockchain"; o documento, com os dados pessoais das partes, fica fora dela.', 'Only the fingerprint goes on-chain; the document, with the parties\' personal data, stays off-chain.')}
    function ${w('registrarDocumento', 'recordDocument')}(bytes32 ${w('hashDoDocumento', 'documentHash')}) external ${sm} ${N.naSituacao}(${AG}) {
        if (${count} != 0) revert ${N.NaoDisponivel}();
        if (${w('hashDoDocumento', 'documentHash')} == bytes32(0)) revert ${N.ParametroInvalido}();
        ${doc} = ${w('hashDoDocumento', 'documentHash')};
        emit ${w('DocumentoRegistrado', 'DocumentRecorded')}(msg.sender, ${w('hashDoDocumento', 'documentHash')});
    }

    /// @notice ${w('Assinatura digital do signatário, que confere a impressão digital do texto; com a última assinatura, o contrato entra em vigor.', 'Digital signature by the signatory, who checks the text fingerprint; with the last signature, the contract comes into force.')}
    /// @param ${w('hashDoTexto', 'textHash')} ${w('deve ser igual a', 'must equal')} ${N.HASH}
    function ${w('assinar', 'sign')}(bytes32 ${w('hashDoTexto', 'textHash')}) external ${sm} ${N.naSituacao}(${AG}) {
        if (${w('hashDoTexto', 'textHash')} != ${N.HASH}) revert ${N.ParametroInvalido}();
        if (${signed}[msg.sender] != 0) revert ${N.JaConcluido}();
        uint256 ${N.limite} = ${N.criadoEm} + ${PA};
        if (block.timestamp > ${N.limite}) revert ${N.PrazoEncerrado}(${N.limite});
        ${signed}[msg.sender] = block.timestamp;
        ${count} += 1;
        emit ${w('Assinatura', 'Signature')}(msg.sender, ${w('hashDoTexto', 'textHash')}, ${doc});
        if (${count} == ${TS}) {
            ${N.situacao} = ${N.Situacao}.${N.Ativo};
            ${N.inicio} = block.timestamp;
            emit ${w('ContratoEmVigor', 'AgreementInForce')}(block.timestamp);
        }
    }

    /// @notice ${w('Sem todas as assinaturas no prazo, qualquer signatário cancela o contrato (nenhum valor terá sido movimentado).', 'Without all signatures in time, any signatory cancels the contract (no amount will have moved).')}
    function ${w('cancelarPorFaltaDeAssinatura', 'cancelForMissingSignatures')}() external ${sm} ${N.naSituacao}(${AG}) {
        uint256 ${N.limite} = ${N.criadoEm} + ${PA};
        if (block.timestamp <= ${N.limite}) revert ${N.PrazoNaoEncerrado}(${N.limite});
        ${N.encerrar}();
    }`);
            }

            if (b.type === 'notificacoes') {
                const nm = useParties();
                const cnt = w('notificacoesRegistradas', 'recordedNotices');
                state.push(`    uint256 public ${cnt};`);
                events.push(`    event ${w('Notificacao', 'Notice')}(uint256 indexed ${w('numero', 'number')}, address indexed ${w('remetente', 'sender')}, address indexed ${w('destinatario', 'recipient')}, string ${w('texto', 'text')});`);
                const isParty = x => ctx.partyRoles.map(r => `${x} != ${r.v}`).join(' && ');
                code.push(`    /// @notice ${w('Registra notificação de uma parte à outra; o registro prova o conteúdo e a data.', 'Records a notice from one party to the other; the record proves its content and date.')}
    /// @dev ${w('O texto fica público na "blockchain": não inclua dados pessoais.', 'The text is public on the blockchain: do not include personal data.')}
    function ${w('notificar', 'notify')}(address ${w('destinatario', 'recipient')}, string calldata ${w('texto', 'text')}) external ${nm} {
        if (${isParty(w('destinatario', 'recipient'))}) revert ${N.ParametroInvalido}();
        if (${w('destinatario', 'recipient')} == msg.sender || bytes(${w('texto', 'text')}).length == 0) revert ${N.ParametroInvalido}();
        ${cnt} += 1;
        emit ${w('Notificacao', 'Notice')}(${cnt}, msg.sender, ${w('destinatario', 'recipient')}, ${w('texto', 'text')});
    }`);
            }

            if (b.type === 'testemunha') {
                code.push(`    // ${w('A testemunha assina pela função de assinatura acima; sem a sua assinatura, o contrato não entra em vigor.', 'The witness signs through the signature function; without their signature, the contract does not come into force.')}`);
            }

            if (BLOCKS[b.type].declarative) {
                code.push(`    // ${w('Cláusula declaratória: não é executada pelo contrato. Seu cumprimento depende das partes e, se for o caso, do Poder Judiciário.', 'Declaratory clause: not executed by the contract. Compliance depends on the parties and, where applicable, the courts.')}`);
            }

            if (b.type === 'arbitro') {
                constants.push(`    uint256 public constant ${N.PRAZO_ARB} = ${Math.round(Number(b.params.prazo) || 30)} days; // ${w('prazo para o árbitro decidir cada disputa', 'period for the arbitrator to decide each dispute')}`);
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
        const roleParams = ctx.roles.map(r => `address _${r.v}`).concat(ctx.usesToken ? ['address _token'] : []).join(', ');
        const roleChecks = ctx.roles.map(r => `_${r.v} == address(0)`).concat(ctx.usesToken ? ['_token == address(0)'] : []).join(' || ');
        const distinct = [];
        for (let a = 0; a < ctx.roles.length; a++) for (let c = a + 1; c < ctx.roles.length; c++) distinct.push(`_${ctx.roles[a].v} == _${ctx.roles[c].v}`);
        const lines = [];
        lines.push('// SPDX-License-Identifier: UNLICENSED');
        lines.push(`pragma solidity ${SOLC_VERSION};`);
        lines.push('');
        lines.push('// ' + L('ATENÇÃO: esqueleto montado a partir de blocos revisados (sem IA). Requer revisão profissional antes de qualquer uso.', 'WARNING: skeleton assembled from reviewed blocks (no AI). Requires professional review before any use.'));
        lines.push('// ' + L('Gerado com o Conversor Contratual', 'Generated with the Contract Converter') + ' (github.com/EduChacon/conversor_smartcontract)');
        lines.push('');
        if (ctx.usesToken) {
            lines.push('/// @notice ' + L('Interface mínima de "token" ERC-20 (usada pela "stablecoin").', 'Minimal ERC-20 token interface (used by the stablecoin).'));
            lines.push('interface IERC20Minimo {');
            lines.push('    function transfer(address to, uint256 value) external returns (bool);');
            lines.push('    function transferFrom(address from, address to, uint256 value) external returns (bool);');
            lines.push('}');
            lines.push('');
        }
        lines.push(`/// @title ${ctx.name}`);
        lines.push('/// @notice ' + L('Contrato montado por blocos. Cada seção abaixo transcreve, em comentário, a cláusula que implementa.', 'Contract assembled from blocks. Each section below quotes, as a comment, the clause it implements.'));
        lines.push(`contract ${ctx.name} {`);
        lines.push(`    enum ${N.Situacao} { ${N.Ativo}, ${N.Encerrado}${sig ? ', ' + N.Aguardando_ : ''} }`);
        if (needsHold) lines.push(`    enum ${N.EstadoGarantia} { ${N.Aguardando}, ${N.Depositado}, ${N.EmDisputa}, ${N.Concluido} }`);
        if (needsObligation) lines.push(`    enum ${N.EstadoObrigacao} { ${N.Pendente}, ${N.Informado}, ${N.Cumprida}, ${N.Descumprida}, ${N.EmDisputaObr}, ${N.SemDecisao} }`);
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
        lines.push(`    error ${N.DadoIndisponivel}(uint256 ${w('atualizadoEm', 'updatedAt')});`);
        lines.push('');
        lines.push(`    event ${N.ContratoEncerrado}(uint256 ${N.quando});`);
        lines.push(`    event ${N.Saque}(address indexed ${N.credor}, uint256 ${N.valor});`);
        events.forEach(e => lines.push(e));
        lines.push('');
        lines.push('    // ' + minutaTxt[0].numero + ' — ' + minutaTxt[0].titulo);
        lines.push(commentBlock(minutaTxt[0].texto, '    '));
        ctx.roles.forEach(r => lines.push(`    address public immutable ${r.v};`));
        if (sig) {
            lines.push(`    uint256 public ${N.inicio}; // ${L('data da última assinatura: início da vigência e dos prazos', 'date of the last signature: start of the term and of all deadlines')}`);
            lines.push(`    uint256 public immutable ${N.criadoEm};`);
        } else lines.push(`    uint256 public immutable ${N.inicio};`);
        if (ctx.usesToken) lines.push(`    IERC20Minimo public immutable token; // ${L('"stablecoin" usada nos pagamentos em token', 'stablecoin used for token payments')}`);
        lines.push('');
        if (needsBps) lines.push(`    uint256 private constant BPS = 10_000; // ${L('100% em pontos-base', '100% in basis points')}`);
        constants.forEach(c => lines.push(c));
        lines.push('');
        lines.push(`    ${N.Situacao} public ${N.situacao};`);
        lines.push(`    uint256 public ${N.encerradoEm};`);
        lines.push(`    mapping(address => uint256) public ${N.saldos};`);
        lines.push(`    bool private ${N.travado};`);
        if (ctx.usesToken) lines.push(`    mapping(address => uint256) public ${w('saldosToken', 'tokenBalances')};`);
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
        if (ctx.usesToken) lines.push('        token = IERC20Minimo(_token);');
        if (sig) {
            lines.push(`        ${N.situacao} = ${N.Situacao}.${N.Aguardando_};`);
            lines.push(`        ${N.criadoEm} = block.timestamp;`);
        } else lines.push(`        ${N.inicio} = block.timestamp;`);
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
        if (ctx.usesToken) {
            lines.push(`    /// @notice ${L('Saque do crédito em "stablecoin" pelo próprio titular.', 'Withdrawal of stablecoin credit by its owner.')}`);
            lines.push(`    function ${w('sacarToken', 'withdrawToken')}() external nonReentrant {`);
            lines.push(`        uint256 ${N.valor} = ${w('saldosToken', 'tokenBalances')}[msg.sender];`);
            lines.push(`        if (${N.valor} == 0) revert ${N.SemSaldo}();`);
            lines.push(`        ${w('saldosToken', 'tokenBalances')}[msg.sender] = 0;`);
            lines.push(`        bool ok = token.transfer(msg.sender, ${N.valor});`);
            lines.push(`        if (!ok) revert ${N.FalhaNoEnvio}();`);
            lines.push('    }');
            lines.push('');
        }
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
    // Legenda: cor de cada cláusula, ligações entre cláusulas e funções
    // ------------------------------------------------------------------
    const COLORS = 10;
    /** Cor (1 a COLORS) de cada cláusula, na ordem do contrato. */
    function colorOf(model, uid) {
        const i = (model.blocks || []).findIndex(b => b.uid === uid);
        return i < 0 ? 0 : (i % COLORS) + 1;
    }
    /** Cláusulas a que um bloco se liga (pagamento, obrigação, índice, evento...). */
    function linksOf(block) {
        const def = BLOCKS[block.type];
        if (!def) return [];
        return def.params.filter(p => p.kind === 'ref' && block.params[p.key]).map(p => ({ campo: p.key, uid: block.params[p.key] }));
    }
    /**
     * Legenda do contrato: { clausulas: [{ uid, numero, titulo, cor, ligacoes }], funcoes: { nome: uid|null } }.
     * As funções são atribuídas à cláusula em cuja seção do código aparecem.
     */
    function legend(model, lang) {
        const ctx = makeCtx(model, lang);
        const clausulas = ctx.blocks.map((b, i) => ({
            uid: b.uid, numero: ordinal(i + 2, lang), titulo: clauseTitle(b, ctx), rotulo: b.label, tipo: b.type,
            cor: colorOf(model, b.uid), ligacoes: linksOf(b).filter(l => ctx.byUid(l.uid)).map(l => l.uid)
        }));
        const funcoes = {};
        let code = '';
        try { code = build(model, lang); } catch (_) { /* montagem incompleta */ }
        let current = null;
        for (const line of code.split('\n')) {
            const h = /^ {4}\/\/ (?:Cláusula (\d+)ª|Clause (\d+)) — /.exec(line);
            if (h) { const n = Number(h[1] || h[2]); current = ctx.blocks[n - 2] ? ctx.blocks[n - 2].uid : null; continue; }
            const f = /^ {4}function (\w+)\(/.exec(line);
            if (f) funcoes[f[1]] = current;
        }
        return { clausulas, funcoes };
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
                const arrB = !periodic ? blocks.find(x => x.type === 'arrependimento' && x.params.alvo === b.uid) : null;
                const confirmArr = arrB ? [wait(Math.round(arrB.params.prazo) + 1, w('O prazo de arrependimento se esgota.', 'The withdrawal period ends.')),
                    call(R(dev), w('confirmarPagamento', 'confirmPayment') + I, [], null, 'sucesso', null, w('Pagamento confirmado.', 'Payment confirmed.'))] : [];
                scenarios.push(sc(w(`${b.label}: pagamento em dia e saque`, `${b.label}: on-time payment and withdrawal`), 'funcionalidade',
                    w(`${dev.label} paga o valor exato e ${cre.label} saca o crédito.`, `${dev.label} pays the exact amount and ${cre.label} withdraws the credit.`), [
                        call(R(dev), pay, [], amount(b.params.valor), 'sucesso', null, w('Pagamento no prazo.', 'On-time payment.')),
                        periodic ? query(R(cre), b.i + w('ParcelasPagas', 'PaidInstallments'), [], '1', w('Uma parcela registrada.', 'One installment recorded.'))
                            : query(R(cre), b.i + w('Pago', 'Paid'), [], 'true', w('Pagamento registrado.', 'Payment recorded.')),
                        ...(arrB ? [call(R(cre), N.sacar, [], null, 'reverter', N.SemSaldo, w('Durante o prazo de arrependimento, o valor fica retido.', 'During the withdrawal period, the amount is held.')),
                            call(R(cre), w('confirmarPagamento', 'confirmPayment') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo de arrependimento.', 'Still within the withdrawal period.')), ...confirmArr] : []),
                        call(R(cre), N.sacar, [], null, 'sucesso', null, w('O credor saca.', 'The payee withdraws.'))
                    ]));
                if (arrB) {
                    scenarios.push(Object.assign(sc(w(`${b.label}: arrependimento no prazo`, `${b.label}: withdrawal within the period`), 'funcionalidade',
                        w('Dentro do prazo, quem pagou desiste e recebe o valor de volta; fora dele, a desistência é recusada.', 'Within the period, the payer withdraws and gets the money back; afterwards, withdrawal is refused.'), [
                            call(R(dev), pay, [], amount(b.params.valor), 'sucesso', null, w('Pagamento.', 'Payment.')),
                            call(R(cre), w('arrepender', 'withdrawFrom') + I, [], null, 'reverter', N.NaoAutorizado, w('Só quem pagou pode desistir.', 'Only the payer may withdraw.')),
                            call(R(dev), w('arrepender', 'withdrawFrom') + I, [], null, 'sucesso', null, w('Desistência.', 'Withdrawal.')),
                            call(R(dev), N.sacar, [], null, 'sucesso', null, w('Quem pagou recupera o valor.', 'The payer recovers the amount.'))
                        ]), { bloco: arrB.uid }));
                    scenarios.push(Object.assign(sc(w(`${b.label}: arrependimento fora do prazo`, `${b.label}: late withdrawal`), 'seguranca',
                        w('Esgotado o prazo de arrependimento, a desistência é recusada.', 'Once the withdrawal period is over, withdrawal is refused.'), [
                            call(R(dev), pay, [], amount(b.params.valor), 'sucesso', null, w('Pagamento.', 'Payment.')),
                            wait(Math.round(arrB.params.prazo) + 1, w('O prazo se esgota.', 'The period ends.')),
                            call(R(dev), w('arrepender', 'withdrawFrom') + I, [], null, 'reverter', N.PrazoEncerrado, w('Fora do prazo.', 'Too late.'))
                        ]), { bloco: arrB.uid }));
                }
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
                    scenarios.push(Object.assign(sc(w(`${b.label}: atraso com multa e juros`, `${b.label}: late payment with fee and interest`), 'funcionalidade',
                        w('Após o vencimento e a tolerância, o valor sem encargos é recusado e o valor com encargos é aceito.', 'After the due date and grace period, the amount without charges is rejected and the amount with charges is accepted.'), [
                            wait(late, w('O pagamento atrasa.', 'The payment is late.')),
                            call(R(dev), pay, [], amount(b.params.valor), 'reverter', N.ValorIncorreto, w('Sem os encargos, o pagamento é recusado.', 'Without charges, payment is rejected.')),
                            query(R(dev), due, [], null, w('Consulta do valor atualizado.', 'Query of the updated amount.')),
                            call(R(dev), pay, [], '=' + due, 'sucesso', null, w('Pagamento com encargos.', 'Payment with charges.'))
                        ]), { bloco: enc.uid }));
                }
                const acc = blocks.find(x => x.type === 'vencimentoAntecipado' && x.params.alvo === b.uid);
                if (acc && periodic) {
                    const P = Math.round(b.params.periodo), A = Math.round(acc.params.atraso);
                    scenarios.push(Object.assign(sc(w(`${b.label}: vencimento antecipado`, `${b.label}: acceleration`), 'funcionalidade',
                        w('Antes do atraso previsto a antecipação é recusada; depois, o credor antecipa e o devedor quita o saldo.', 'Before the contractual delay acceleration is rejected; afterwards the creditor accelerates and the debtor repays the balance.'), [
                            ...(A >= 2 ? [wait(P + Math.floor(A / 2), w('Atraso menor que o limite.', 'Delay below the limit.')),
                                call(R(cre), w('declararVencimentoAntecipado', 'declareAcceleration') + I, [], null, 'reverter', N.SemAtraso, w('Ainda não cabe antecipar.', 'Too early to accelerate.')),
                                wait(A - Math.floor(A / 2) + 1, w('O atraso supera o limite.', 'The delay exceeds the limit.'))]
                                : [wait(P + A + 1, w('O atraso supera o limite.', 'The delay exceeds the limit.'))]),
                            call(R(cre), w('declararVencimentoAntecipado', 'declareAcceleration') + I, [], null, 'sucesso', null, w('Vencimento antecipado declarado.', 'Acceleration declared.')),
                            call(R(dev), pay, [], amount(b.params.valor), 'reverter', N.NaoDisponivel + '|' + N.ValorIncorreto, w('Parcelas avulsas deixam de ser aceitas.', 'Single installments are no longer accepted.')),
                            call(R(dev), w('quitar', 'repay') + I, [], '=' + w('saldoDevedor', 'outstanding') + I, 'sucesso', null, w('Quitação do saldo devedor.', 'Repayment of the balance.'))
                        ]), { bloco: acc.uid }));
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
                const carrB = blocks.find(x => x.type === 'arrependimento' && x.params.alvo === b.uid);
                if (carrB) scenarios.push(Object.assign(sc(w(`${b.label}: arrependimento do depositante`, `${b.label}: depositor's withdrawal`), 'funcionalidade',
                    w('Dentro do prazo, o depositante desiste e recupera o valor; fora dele, a desistência é recusada.', 'Within the period, the depositor withdraws and recovers the amount; afterwards, withdrawal is refused.'), [
                        call(R(dep), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                        call(R(dep), w('arrepender', 'withdrawFrom') + I, [], null, 'sucesso', null, w('Desistência.', 'Withdrawal.')),
                        call(R(dep), N.sacar, [], null, 'sucesso', null, w('O depositante saca.', 'The depositor withdraws.'))
                    ]), { bloco: carrB.uid }));
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
                        wait(Math.max(Math.round(b.params.prazo), (() => { const rl = blocks.find(x => x.type === 'liberacaoPorEvento' && x.params.alvo === b.uid); const ev = rl && ctx.byUid(rl.params.evento); return ev && ev.params.prazo ? Math.round(ev.params.prazo) : 0; })()) + 1,
                            w('O prazo se esgota (e, havendo obrigação vinculada, também o dela, sem cumprimento).', 'The deadline passes (and, with a linked obligation, so does its deadline, without performance).')),
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
                    const arbB = blocks.find(x => x.type === 'arbitro');
                    scenarios.push(sc(w(`${b.label}: árbitro em silêncio`, `${b.label}: silent arbitrator`), 'funcionalidade',
                        w('Sem decisão do árbitro no prazo, qualquer das partes encerra a disputa e o valor volta ao depositante.', 'Without the arbitrator\'s decision in time, either party ends the dispute and the amount returns to the depositor.'), [
                            call(R(dep), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                            call(R(ben), w('abrirDisputa', 'openDispute') + I, [], null, 'sucesso', null, w('Disputa aberta.', 'Dispute opened.')),
                            call(R(dep), w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo do árbitro.', 'Still within the arbitrator\'s period.')),
                            wait(Math.round(Number(arbB.params.prazo) || 30) + 1, w('O árbitro não decide no prazo.', 'The arbitrator does not decide in time.')),
                            call(R(dep), w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision') + I, [], null, 'sucesso', null, w('Disputa encerrada; o valor volta ao depositante.', 'Dispute ended; the amount returns to the depositor.')),
                            call(R(dep), N.sacar, [], null, 'sucesso', null, w('O depositante saca.', 'The depositor withdraws.'))
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
                const closeE = closeSteps();
                if (closeE) {
                    const steps = [
                        call(R(ct), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                        call(R(cd), E, [], null, 'sucesso', null, w('Entrega.', 'Delivery.')),
                        wait(Math.round(b.params.prazo) + 1, w('O prazo de aprovação se esgota em silêncio.', 'The approval period passes in silence.')),
                        ...closeE.map(x => x.acao === 'avancarTempo' ? x : x),
                        call(R(cd), N.sacar, [], null, 'sucesso', null, w('O contratado recebe a etapa aprovada tacitamente.', 'The contractor receives the tacitly approved milestone.'))
                    ];
                    if (Math.round(b.params.etapas) > 1) steps.push(call(R(ct), N.sacar, [], null, 'sucesso', null, w('O contratante recupera as etapas restantes.', 'The client recovers the remaining milestones.')));
                    scenarios.push(sc(w(`${b.label}: encerramento com etapa aprovada tacitamente`, `${b.label}: closing with a tacitly approved milestone`), 'funcionalidade',
                        w('Encerrado o contrato depois de esgotado o prazo de aprovação, a etapa entregue é paga ao contratado, e só o restante volta ao contratante.', 'If the contract closes after the approval period, the delivered milestone is paid to the contractor, and only the rest returns to the client.'), steps));
                }
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
                        const arbB = blocks.find(x => x.type === 'arbitro');
                        scenarios.push(sc(w(`${b.label}: árbitro em silêncio`, `${b.label}: silent arbitrator`), 'funcionalidade',
                            w('Pedida a retenção e sem decisão do árbitro no prazo, a caução volta integralmente ao garantidor.', 'After a retention claim with no arbitrator decision in time, the full deposit returns to the guarantor.'), [
                                call(R(gar), D, [], amount(b.params.valor), 'sucesso', null, w('Prestação da caução.', 'Deposit provided.')),
                                ...close,
                                call(R(ben), w('reter', 'claim') + I, [half(b.params.valor), w('Danos no imóvel', 'Property damage')], null, 'sucesso', null, w('Pedido de retenção.', 'Retention claim.')),
                                wait(Math.round(Number(arbB.params.prazo) || 30) + 1, w('O árbitro não decide no prazo.', 'The arbitrator does not decide in time.')),
                                call(R(gar), w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision') + I, [], null, 'sucesso', null, w('Disputa encerrada sem decisão.', 'Dispute ended without decision.')),
                                call(R(gar), N.sacar, [], null, 'sucesso', null, w('O garantidor saca a caução.', 'The guarantor withdraws the deposit.'))
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

        // Obrigações de dar, fazer e não fazer, e cláusula penal.
        // Estados: 0 pendente, 1 cumprimento informado, 2 cumprida, 3 descumprida, 4 em disputa, 5 sem decisão.
        const arbBlock = blocks.find(x => x.type === 'arbitro');
        const arbDays = arbBlock ? Math.round(Number(arbBlock.params.prazo) || 30) : 0;
        const oblNames = b => b.type === 'obrigacaoDar'
            ? { inf: w('informarEntrega', 'reportDelivery'), at: w('atestarRecebimento', 'attestReceipt'), rec: w('recusarEntrega', 'rejectDelivery') }
            : { inf: w('informarCumprimento', 'reportPerformance'), at: w('atestarCumprimento', 'attestPerformance'), rec: w('recusarCumprimento', 'rejectPerformance') };
        const ST = b => b.i + w('Estado', 'State');
        const breachSteps = t => {
            if (t.type === 'obrigacaoNaoFazer') {
                const steps = [call(R(roleById(t.params.verificador)), w('registrarViolacao', 'recordBreach') + t.I, [w('Conduta vedada praticada', 'Prohibited conduct')], null, 'sucesso', null, w('Violação registrada.', 'Breach recorded.'))];
                if (ctx.arbRole) steps.push(call(R(ctx.arbRole), w('decidirCumprimento', 'resolvePerformance') + t.I, ['false'], null, 'sucesso', null, w('O árbitro confirma a violação.', 'The arbitrator confirms the breach.')));
                return steps;
            }
            return [wait(Math.round(t.params.prazo) + 1, w('O prazo se esgota sem cumprimento.', 'The deadline passes without performance.')),
                call(R(roleById(t.params.credor)), w('declararInadimplemento', 'declareDefault') + t.I, [], null, 'sucesso', null, w('Declarado o inadimplemento.', 'Default declared.'))];
        };
        const fulfilSteps = t => t.type === 'obrigacaoNaoFazer'
            ? [wait(Math.round(t.params.duracao) + 1, w('O prazo da abstenção termina sem violação.', 'The abstention period ends without breach.')),
                call(R(roleById(t.params.devedor)), w('declararCumprimento', 'declareFulfilled') + t.I, [], null, 'sucesso', null, w('Obrigação declarada cumprida.', 'Obligation declared fulfilled.'))]
            : [call(R(roleById(t.params.verificador)), oblNames(t).at + t.I, [], null, 'sucesso', null, w('Cumprimento atestado.', 'Performance attested.'))];
        for (const b of blocks) {
            const I = b.I;
            if (b.type === 'obrigacaoDar' || b.type === 'obrigacaoFazer') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor), ver = roleById(b.params.verificador);
                const n = oblNames(b);
                const AT = Math.round(b.params.atestacao);
                const DECL = w('declararInadimplemento', 'declareDefault') + I, TAC = w('atestarTacitamente', 'attestByTimeout') + I;
                scenarios.push(sc(w(`${b.label}: cumprimento atestado`, `${b.label}: performance attested`), 'funcionalidade',
                    w(`${dev.label} informa o cumprimento e ${ver.label} o atesta; o devedor não pode atestar a própria prestação.`, `${dev.label} reports performance and ${ver.label} attests it; the debtor cannot attest its own performance.`), [
                        call(R(dev), n.inf + I, [], null, 'sucesso', null, w('O devedor informa o cumprimento.', 'The debtor reports performance.')),
                        call(R(dev), n.at + I, [], null, 'reverter', N.NaoAutorizado, w('O devedor não atesta a si mesmo.', 'The debtor cannot attest itself.')),
                        call(R(ver), n.at + I, [], null, 'sucesso', null, w('Cumprimento atestado.', 'Performance attested.')),
                        query(R(cre), ST(b), [], '2', w('A obrigação consta como cumprida.', 'The obligation is recorded as fulfilled.')),
                        call(R(cre), DECL, [], null, 'reverter', N.NaoDisponivel + '|' + N.SituacaoInvalida, w('Obrigação cumprida não admite inadimplemento.', 'A fulfilled obligation cannot be declared in default.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: inadimplemento após o prazo`, `${b.label}: default after the deadline`), 'funcionalidade',
                    w('Antes do prazo o inadimplemento é recusado; depois dele, o devedor já não pode informar o cumprimento e o inadimplemento é declarado.', 'Before the deadline default is rejected; afterwards the debtor can no longer report performance and default is declared.'), [
                        call(R(cre), DECL, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo.', 'Still within the deadline.')),
                        wait(Math.round(b.params.prazo) + 1, w('O prazo se esgota.', 'The deadline passes.')),
                        call(R(dev), n.inf + I, [], null, 'reverter', N.PrazoEncerrado, w('Fora do prazo, o devedor não informa o cumprimento.', 'After the deadline, the debtor cannot report performance.')),
                        call(R(cre), DECL, [], null, 'sucesso', null, w('Inadimplemento declarado.', 'Default declared.')),
                        query(R(cre), ST(b), [], '3', w('A obrigação consta como descumprida.', 'The obligation is recorded as breached.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: recusa reabre o prazo e silêncio vale como atestação`, `${b.label}: rejection reopens the deadline and silence counts as attestation`), 'funcionalidade',
                    w('A recusa precisa de motivo e reabre ao devedor o prazo para cumprir; sem nova manifestação de quem atesta, o novo cumprimento vale como atestado.', 'A rejection needs a reason and reopens the deadline for the debtor; without a new response from the attesting party, the new performance counts as attested.'), [
                        call(R(dev), n.inf + I, [], null, 'sucesso', null, w('O devedor informa o cumprimento.', 'The debtor reports performance.')),
                        call(R(ver), n.rec + I, [''], null, 'reverter', N.ParametroInvalido, w('Recusa sem motivo não é aceita.', 'A rejection without reason is not accepted.')),
                        call(R(ver), n.rec + I, [w('Bem entregue com defeito', 'Item delivered with a defect')], null, 'sucesso', null, w('Recusa fundamentada.', 'Reasoned rejection.')),
                        call(R(cre), DECL, [], null, 'reverter', N.PrazoNaoEncerrado, w('Com o prazo reaberto, ainda não há inadimplemento.', 'With the deadline reopened, there is no default yet.')),
                        call(R(dev), n.inf + I, [], null, 'sucesso', null, w('O devedor cumpre de novo e informa.', 'The debtor performs again and reports it.')),
                        call(R(dev), TAC, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo de quem atesta.', 'Still within the attesting party\'s period.')),
                        wait(AT + 1, w('Quem atesta permanece em silêncio.', 'The attesting party stays silent.')),
                        call(R(dev), TAC, [], null, 'sucesso', null, w('Atestação tácita.', 'Tacit attestation.')),
                        query(R(cre), ST(b), [], '2', w('A obrigação consta como cumprida.', 'The obligation is recorded as fulfilled.'))
                    ]));
                scenarios.push(sc(w(`${b.label}: recusa tardia não abre inadimplemento`, `${b.label}: late rejection cannot create a default`), 'seguranca',
                    w('Esgotado o prazo para atestar, quem atesta já não pode recusar o cumprimento informado para depois declarar o inadimplemento.', 'Once the attestation period has passed, the attesting party can no longer reject the reported performance in order to declare default.'), [
                        call(R(dev), n.inf + I, [], null, 'sucesso', null, w('O devedor informa o cumprimento.', 'The debtor reports performance.')),
                        wait(Math.max(AT, Math.round(b.params.prazo)) + 1, w('Esgotam-se o prazo para atestar e o prazo da obrigação.', 'The attestation period and the deadline pass.')),
                        call(R(ver), n.rec + I, [w('Recusa tardia', 'Late rejection')], null, 'reverter', N.PrazoEncerrado, w('A recusa fora do prazo é recusada.', 'The late rejection is refused.')),
                        call(R(cre), DECL, [], null, 'reverter', N.NaoDisponivel, w('Com o cumprimento informado, não há inadimplemento.', 'With performance reported, there is no default.')),
                        call(R(dev), TAC, [], null, 'sucesso', null, w('Atestação tácita.', 'Tacit attestation.'))
                    ]));
                if (ctx.arbRole) {
                    scenarios.push(sc(w(`${b.label}: recusa contestada e decidida pelo árbitro`, `${b.label}: rejection contested and decided by the arbitrator`), 'funcionalidade',
                        w('O devedor submete a recusa ao árbitro; durante a disputa não há inadimplemento, e só o árbitro decide.', 'The debtor refers the rejection to the arbitrator; during the dispute there is no default, and only the arbitrator decides.'), [
                            call(R(dev), n.inf + I, [], null, 'sucesso', null, w('O devedor informa o cumprimento.', 'The debtor reports performance.')),
                            call(R(ver), n.rec + I, [w('Serviço incompleto', 'Incomplete service')], null, 'sucesso', null, w('Recusa.', 'Rejection.')),
                            call(R(dev), w('contestarRecusa', 'contestRejection') + I, [], null, 'sucesso', null, w('O devedor contesta a recusa.', 'The debtor contests the rejection.')),
                            query(R(cre), ST(b), [], '4', w('A obrigação está em disputa.', 'The obligation is in dispute.')),
                            call(R(cre), w('decidirCumprimento', 'resolvePerformance') + I, ['false'], null, 'reverter', N.NaoAutorizado, w('Só o árbitro decide.', 'Only the arbitrator decides.')),
                            call(R(ctx.arbRole), w('decidirCumprimento', 'resolvePerformance') + I, ['true'], null, 'sucesso', null, w('O árbitro reconhece o cumprimento.', 'The arbitrator upholds performance.')),
                            query(R(cre), ST(b), [], '2', w('A obrigação consta como cumprida.', 'The obligation is recorded as fulfilled.'))
                        ]));
                    scenarios.push(sc(w(`${b.label}: árbitro em silêncio`, `${b.label}: silent arbitrator`), 'funcionalidade',
                        w('Sem decisão do árbitro no prazo, qualquer das partes encerra a disputa, e a garantia volta a quem a depositou.', 'Without the arbitrator\'s decision in time, either party ends the dispute, and the bond returns to whoever deposited it.'), [
                            call(R(dev), n.inf + I, [], null, 'sucesso', null, w('O devedor informa o cumprimento.', 'The debtor reports performance.')),
                            call(R(ver), n.rec + I, [w('Serviço incompleto', 'Incomplete service')], null, 'sucesso', null, w('Recusa.', 'Rejection.')),
                            call(R(dev), w('contestarRecusa', 'contestRejection') + I, [], null, 'sucesso', null, w('O devedor contesta a recusa.', 'The debtor contests the rejection.')),
                            call(R(dev), w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo do árbitro.', 'Still within the arbitrator\'s period.')),
                            wait(arbDays + 1, w('O árbitro não decide no prazo.', 'The arbitrator does not decide in time.')),
                            call(R(dev), w('encerrarDisputaSemDecisao', 'endDisputeWithoutDecision') + I, [], null, 'sucesso', null, w('Disputa encerrada sem decisão.', 'Dispute ended without decision.')),
                            query(R(cre), ST(b), [], '5', w('A obrigação consta como sem decisão.', 'The obligation is recorded as unresolved.'))
                        ]));
                }
            }
            if (b.type === 'obrigacaoNaoFazer') {
                const dev = roleById(b.params.devedor), cre = roleById(b.params.credor), ver = roleById(b.params.verificador);
                const viol = [
                    call(R(dev), w('registrarViolacao', 'recordBreach') + I, [w('Teste', 'Test')], null, 'reverter', N.NaoAutorizado, w('O devedor não registra violação.', 'The debtor cannot record a breach.')),
                    call(R(ver), w('registrarViolacao', 'recordBreach') + I, [''], null, 'reverter', N.ParametroInvalido, w('Registro sem descrição não é aceito.', 'A record without description is not accepted.')),
                    call(R(ver), w('registrarViolacao', 'recordBreach') + I, [w('Conduta vedada praticada', 'Prohibited conduct')], null, 'sucesso', null, w('Violação registrada.', 'Breach recorded.'))
                ];
                if (ctx.arbRole) viol.push(
                    query(R(cre), ST(b), [], '4', w('A violação aguarda a decisão do árbitro.', 'The breach awaits the arbitrator\'s decision.')),
                    call(R(ctx.arbRole), w('decidirCumprimento', 'resolvePerformance') + I, ['false'], null, 'sucesso', null, w('O árbitro confirma a violação.', 'The arbitrator confirms the breach.')));
                viol.push(query(R(cre), ST(b), [], '3', w('A obrigação consta como descumprida.', 'The obligation is recorded as breached.')),
                    call(R(ver), w('registrarViolacao', 'recordBreach') + I, [w('Nova conduta', 'New conduct')], null, 'reverter', N.NaoDisponivel + '|' + N.SituacaoInvalida, w('O registro não se repete.', 'The record cannot be repeated.')));
                scenarios.push(sc(w(`${b.label}: violação registrada`, `${b.label}: breach recorded`), 'funcionalidade',
                    w(`Durante o prazo, só ${ver.label} registra a violação${ctx.arbRole ? ', que depende da confirmação do árbitro' : ''}.`, `During the period, only ${ver.label} records a breach${ctx.arbRole ? ', which depends on the arbitrator\'s confirmation' : ''}.`), viol));
                scenarios.push(sc(w(`${b.label}: cumprimento ao fim do prazo`, `${b.label}: fulfilled at the end of the period`), 'funcionalidade',
                    w('Antes do fim do prazo a obrigação não pode ser declarada cumprida; depois dele, não se registra mais violação e a obrigação é declarada cumprida.', 'Before the period ends the obligation cannot be declared fulfilled; afterwards no breach can be recorded and it is declared fulfilled.'), [
                        call(R(dev), w('declararCumprimento', 'declareFulfilled') + I, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo.', 'Still within the period.')),
                        wait(Math.round(b.params.duracao) + 1, w('O prazo da abstenção termina.', 'The abstention period ends.')),
                        call(R(ver), w('registrarViolacao', 'recordBreach') + I, [w('Conduta tardia', 'Late conduct')], null, 'reverter', N.PrazoEncerrado, w('Fora do prazo, não há violação a registrar.', 'After the period, there is no breach to record.')),
                        call(R(dev), w('declararCumprimento', 'declareFulfilled') + I, [], null, 'sucesso', null, w('Obrigação declarada cumprida.', 'Obligation declared fulfilled.')),
                        query(R(cre), ST(b), [], '2', w('A obrigação consta como cumprida.', 'The obligation is recorded as fulfilled.'))
                    ]));
            }
            if (b.type === 'clausulaPenal') {
                const t = ctx.byUid(b.params.alvo);
                if (!t) continue;
                const dev = roleById(t.params.devedor), cre = roleById(t.params.credor);
                const D = w('depositarGarantia', 'depositBond') + t.I;
                const H = t.i + w('GarantiaRetida', 'BondHeld');
                scenarios.push(Object.assign(sc(w(`${t.label}: cláusula penal ao credor`, `${t.label}: penalty to the creditor`), 'funcionalidade',
                    w('O devedor deposita a garantia; descumprida a obrigação, o valor passa automaticamente ao credor, que o saca.', 'The debtor deposits the bond; once the obligation is breached, the amount goes automatically to the creditor, who withdraws it.'), [
                        call(R(dev), D, [], half(b.params.valor), 'reverter', N.ValorIncorreto, w('Depósito parcial é recusado.', 'A partial deposit is rejected.')),
                        call(R(dev), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito da garantia.', 'Bond deposited.')),
                        call(R(dev), D, [], amount(b.params.valor), 'reverter', N.JaConcluido, w('A garantia não é depositada duas vezes.', 'The bond cannot be deposited twice.')),
                        ...breachSteps(t),
                        query(R(cre), H, [], '0', w('Nada mais fica retido.', 'Nothing remains held.')),
                        call(R(cre), N.sacar, [], null, 'sucesso', null, w('O credor saca a cláusula penal.', 'The creditor withdraws the penalty.'))
                    ]), { bloco: b.uid }));
                scenarios.push(Object.assign(sc(w(`${t.label}: garantia devolvida após o cumprimento`, `${t.label}: bond returned after performance`), 'funcionalidade',
                    w('Enquanto a obrigação está em aberto, a garantia fica retida; cumprida a obrigação, volta automaticamente ao devedor.', 'While the obligation is open, the bond is held; once fulfilled, it returns automatically to the debtor.'), [
                        call(R(dev), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito da garantia.', 'Bond deposited.')),
                        query(R(cre), N.saldoRetido, [], null, w('O valor está retido.', 'The amount is held.')),
                        ...fulfilSteps(t),
                        query(R(cre), H, [], '0', w('Nada mais fica retido.', 'Nothing remains held.')),
                        call(R(dev), N.sacar, [], null, 'sucesso', null, w('O devedor saca a garantia.', 'The debtor withdraws the bond.'))
                    ]), { bloco: b.uid }));
                if (rescisao && t.type !== 'obrigacaoNaoFazer') {
                    const who = rescisao.params.quem === '*' ? dev : roleById(rescisao.params.quem);
                    scenarios.push(Object.assign(sc(w(`${t.label}: rescisão após o prazo vencido`, `${t.label}: termination after the deadline`), 'seguranca',
                        w('Quem descumpriu não escapa da cláusula penal rescindindo o contrato: vencido o prazo sem cumprimento, a rescisão entrega a garantia ao credor.', 'A defaulting debtor cannot escape the penalty by terminating: once the deadline has passed without performance, termination gives the bond to the creditor.'), [
                            call(R(dev), D, [], amount(b.params.valor), 'sucesso', null, w('Depósito da garantia.', 'Bond deposited.')),
                            wait(Math.round(t.params.prazo) + 1, w('O prazo se esgota sem cumprimento.', 'The deadline passes without performance.')),
                            call(R(who), w('rescindir', 'terminate'), [], null, 'sucesso', null, w('O contrato é rescindido.', 'The contract is terminated.')),
                            query(R(cre), ST(t), [], '3', w('A obrigação consta como descumprida.', 'The obligation is recorded as breached.')),
                            call(R(cre), N.sacar, [], null, 'sucesso', null, w('O credor saca a cláusula penal.', 'The creditor withdraws the penalty.'))
                        ]), { bloco: b.uid }));
                }
            }
        }

        // Informações externas (oráculos).
        const priceOracles = blocks.filter(o => o.type === 'oraculoValor' && blocks.some(x => x.type === 'conversaoCambial' && x.params.cotacao === o.uid));
        const priceValue = String(Math.round(ctx.scale * 100)); // R$ por ETH × 100: equivale à escala do contrato
        const refresh = () => priceOracles.map(o => call(R(roleById(o.params.fonte)), w('informar', 'report') + o.I, [priceValue], null, 'sucesso', null,
            w('A fonte atualiza a cotação (R$ ' + num(ctx.scale, lang) + ' por ETH).', 'The source updates the price (R$ ' + num(ctx.scale, lang) + ' per ETH).')));
        for (const b of blocks) {
            const I = b.I;
            if (b.type === 'oraculoValor') {
                const src = roleById(b.params.fonte);
                const isPrice = priceOracles.includes(b);
                const v = isPrice ? priceValue : '425';
                scenarios.push(sc(w(`${b.label}: informação desatualizada`, `${b.label}: outdated data`), 'seguranca',
                    w('A informação vale pelo prazo de validade; depois dele, o contrato se recusa a usá-la até nova atualização.', 'Data is valid for its validity period; afterwards the contract refuses to use it until it is updated.'), [
                        call(R(src), w('informar', 'report') + I, [v], null, 'sucesso', null, w('A fonte designada registra a informação.', 'The designated source records the data.')),
                        query(R(src), w('ler', 'read') + I, [], v, w('A informação pode ser lida.', 'The data can be read.')),
                        Object.assign(wait(Math.round(b.params.validade) + 1, w('O prazo de validade se esgota.', 'The validity period ends.')), { semAtualizar: true }),
                        { acao: 'consultar', conta: R(src), funcao: w('ler', 'read') + I, argumentos: [], esperado: 'reverter', erroEsperado: N.DadoIndisponivel, explicacao: w('A leitura de informação vencida é recusada.', 'Reading outdated data is rejected.') }
                    ]));
            }
            if (b.type === 'oraculoEvento') {
                const src = roleById(b.params.fonte);
                scenarios.push(sc(w(`${b.label}: registro do evento`, `${b.label}: event record`), 'funcionalidade',
                    w('Só a fonte designada atesta o evento, e o registro não pode ser repetido.', 'Only the designated source attests the event, and the record cannot be repeated.'), [
                        call(R(src), w('atestar', 'attest') + I, [], null, 'sucesso', null, w('A fonte atesta o evento.', 'The source attests the event.')),
                        query(R(src), b.i + w('Confirmado', 'Confirmed'), [], 'true', w('O evento consta como confirmado.', 'The event is recorded as confirmed.')),
                        call(R(src), w('atestar', 'attest') + I, [], null, 'reverter', N.JaConcluido, w('Um segundo registro é recusado.', 'A second record is rejected.'))
                    ]));
            }
            if (b.type === 'reajuste') {
                const pay = ctx.byUid(b.params.alvo), idx = ctx.byUid(b.params.indice);
                if (pay && idx) {
                    const dev = roleById(pay.params.devedor);
                    scenarios.push(Object.assign(sc(w(`${pay.label}: reajuste pelo índice`, `${pay.label}: index adjustment`), 'funcionalidade',
                        w('Informado um índice de 5%, o valor original passa a ser recusado e o valor reajustado é aceito.', 'Once a 5% index is reported, the original amount is rejected and the adjusted amount is accepted.'), [
                            call(R(roleById(idx.params.fonte)), w('informar', 'report') + idx.I, ['500'], null, 'sucesso', null, w('A fonte informa variação de 5,00%.', 'The source reports a 5.00% change.')),
                            call(R(dev), w('pagar', 'pay') + pay.I, [], amount(pay.params.valor), 'reverter', N.ValorIncorreto, w('O valor sem reajuste é recusado.', 'The unadjusted amount is rejected.')),
                            call(R(dev), w('pagar', 'pay') + pay.I, [], '=' + w('valorDevido', 'amountDue') + pay.I, 'sucesso', null, w('O valor reajustado é aceito.', 'The adjusted amount is accepted.'))
                        ]), { bloco: b.uid }));
                }
            }
            if (b.type === 'conversaoCambial') {
                const pay = ctx.byUid(b.params.alvo);
                if (pay) {
                    const dev = roleById(pay.params.devedor);
                    scenarios.push(Object.assign(Object.assign(sc(w(`${pay.label}: pagamento sem cotação válida`, `${pay.label}: payment without a valid price`), 'seguranca',
                        w('Sem cotação informada pela fonte, o contrato não converte o valor em reais e recusa o pagamento.', 'Without a price from the source, the contract cannot convert the BRL amount and rejects the payment.'), [
                            call(R(dev), w('pagar', 'pay') + pay.I, [], amount(pay.params.valor), 'reverter', N.DadoIndisponivel, w('Sem cotação, o pagamento é recusado.', 'Without a price, payment is rejected.'))
                        ]), { semPrelude: true }), { bloco: b.uid }));
                }
            }
            if (b.type === 'liberacaoPorEvento') {
                const cus = ctx.byUid(b.params.alvo), ev = ctx.byUid(b.params.evento);
                if (cus && ev) {
                    const dep = roleById(cus.params.depositante), ben = roleById(cus.params.beneficiario);
                    scenarios.push(Object.assign(sc(w(`${cus.label}: liberação pelo evento`, `${cus.label}: release on event`), 'funcionalidade',
                        w('Antes de o evento ser atestado, a liberação é recusada; depois, o beneficiário a obtém sem depender do depositante.', 'Before the event is attested, release is rejected; afterwards the beneficiary obtains it without the depositor.'), [
                            call(R(dep), w('depositar', 'deposit') + cus.I, [], amount(cus.params.valor), 'sucesso', null, w('Depósito.', 'Deposit.')),
                            call(R(ben), w('liberarPorEvento', 'releaseOnEvent') + cus.I, [], null, 'reverter', N.NaoDisponivel, w('Evento ainda não atestado.', 'Event not yet attested.')),
                            ev.type === 'oraculoEvento'
                                ? call(R(roleById(ev.params.fonte)), w('atestar', 'attest') + ev.I, [], null, 'sucesso', null, w('A fonte atesta o evento.', 'The source attests the event.'))
                                : call(R(roleById(ev.params.verificador)), oblNames(ev).at + ev.I, [], null, 'sucesso', null, w('Atestado o cumprimento da obrigação.', 'Performance of the obligation is attested.')),
                            wait(Math.round(cus.params.prazo) + 1, w('O prazo do depósito se esgota.', 'The deposit deadline passes.')),
                            call(R(dep), w('reaver', 'refund') + cus.I, [], null, 'reverter', N.NaoDisponivel, w('Atestado o evento, o depositante não pode reaver o valor.', 'Once the event is attested, the depositor cannot recover the amount.')),
                            call(R(ben), w('liberarPorEvento', 'releaseOnEvent') + cus.I, [], null, 'sucesso', null, w('Liberação ao beneficiário.', 'Release to the beneficiary.')),
                            call(R(ben), N.sacar, [], null, 'sucesso', null, w('O beneficiário saca.', 'The beneficiary withdraws.'))
                        ]), { bloco: b.uid }));
                }
            }
        }

        // "Stablecoin": autorização prévia, pagamento e saque em token.
        for (const b of blocks.filter(x => x.type === 'pagamentoToken')) {
            const dev = roleById(b.params.devedor), cre = roleById(b.params.credor);
            const tok = (Math.round(Number(b.params.valor) * 100) / 100) + ' ether';
            scenarios.push(sc(w(`${b.label}: autorização, pagamento e saque`, `${b.label}: approval, payment and withdrawal`), 'funcionalidade',
                w('O devedor autoriza o contrato no token, paga, e o credor saca os tokens.', 'The debtor authorizes the contract on the token, pays, and the payee withdraws the tokens.'), [
                    { acao: 'chamar', alvo: 'token', conta: R(dev), funcao: 'approve', argumentos: ['@Contrato', tok], esperado: 'sucesso', explicacao: w('Autorização de débito no token.', 'Debit authorization on the token.') },
                    call(R(dev), w('pagar', 'pay') + b.I, [], null, 'sucesso', null, w('Pagamento em tBRL.', 'Payment in tBRL.')),
                    { acao: 'consultar', alvo: 'token', conta: R(cre), funcao: 'balanceOf', argumentos: ['@Contrato'], esperado: 'sucesso', resultadoEsperado: tok, explicacao: w('Os tokens estão no contrato.', 'The tokens are held by the contract.') },
                    call(R(cre), w('sacarToken', 'withdrawToken'), [], null, 'sucesso', null, w('O credor saca os tokens.', 'The payee withdraws the tokens.')),
                    call(R(cre), w('sacarToken', 'withdrawToken'), [], null, 'reverter', N.SemSaldo, w('Não há saque em duplicidade.', 'No duplicate withdrawal.'))
                ]));
            scenarios.push(sc(w(`${b.label}: pagamento sem autorização`, `${b.label}: payment without approval`), 'seguranca',
                w('Sem a autorização prévia no token, o contrato não consegue debitar e o pagamento é recusado por inteiro.', 'Without prior approval on the token, the contract cannot debit and the whole payment is rejected.'), [
                    call(R(dev), w('pagar', 'pay') + b.I, [], null, 'reverter', 'autorizacao insuficiente', w('Pagamento recusado; nada é registrado.', 'Payment rejected; nothing is recorded.')),
                    query(R(cre), w('saldosToken', 'tokenBalances'), [R(cre)], '0', w('O credor não recebeu crédito indevido.', 'The payee received no undue credit.'))
                ]));
        }

        const notB = blocks.find(x => x.type === 'notificacoes');
        if (notB && ctx.partyRoles.length >= 2) {
            const a = ctx.partyRoles[0], bb = ctx.partyRoles[1];
            const NT = w('notificar', 'notify');
            scenarios.push(Object.assign(sc(w('Notificação registrada', 'Recorded notice'), 'funcionalidade',
                w('Uma parte notifica a outra; o registro fica no contrato. Notificação a si mesmo, a quem não é parte ou sem texto é recusada.', 'One party notifies the other; the record stays in the contract. Notices to oneself, to non-parties or without text are refused.'), [
                    call(R(a), NT, [R(bb), w('Fica constituído em mora o devedor.', 'The debtor is hereby put on notice of default.')], null, 'sucesso', null, w('Notificação registrada.', 'Notice recorded.')),
                    call(R(a), NT, [R(a), w('Teste', 'Test')], null, 'reverter', N.ParametroInvalido, w('Não se notifica a si mesmo.', 'Cannot notify oneself.')),
                    call(R(a), NT, [attacker, w('Teste', 'Test')], null, 'reverter', N.ParametroInvalido, w('Só se notifica quem é parte.', 'Only parties can be notified.')),
                    call(R(a), NT, [R(bb), ''], null, 'reverter', N.ParametroInvalido, w('Notificação sem texto é recusada.', 'A notice without text is refused.')),
                    query(R(a), w('notificacoesRegistradas', 'recordedNotices'), [], '1', w('Uma notificação registrada.', 'One notice recorded.'))
                ]), { bloco: notB.uid }));
        }

        // Ataque de reentrância por contrato malicioso real (crédito em Ether a um credor que é um contrato).
        const ethPay = blocks.find(x => x.type === 'pagamentoUnico' || x.type === 'pagamentoPeriodico');
        if (ethPay) {
            const dev = roleById(ethPay.params.devedor), cre = roleById(ethPay.params.credor);
            scenarios.push(Object.assign(sc(w('Ataque de reentrância por contrato malicioso', 'Reentrancy attack by a malicious contract'), 'seguranca',
                w(`Um contrato atacante ocupa o lugar de ${cre.label}, recebe um crédito legítimo e tenta sacá-lo várias vezes, reentrando no saque. A trava de reentrância e a ordem "efeitos antes da interação" devem impedir.`,
                    `An attacker contract takes ${cre.label}'s place, receives a legitimate credit and tries to withdraw it several times by re-entering the withdrawal. The reentrancy lock and the effects-before-interaction order must prevent it.`), [
                    call(R(dev), w('pagar', 'pay') + ethPay.I, [], '=' + w('valorDevido', 'amountDue') + ethPay.I, 'sucesso', null, w('Pagamento legítimo, creditado ao contrato atacante.', 'Legitimate payment, credited to the attacker contract.')),
                    ...(() => { const ab = blocks.find(x => x.type === 'arrependimento' && x.params.alvo === ethPay.uid); return ab ? [wait(Math.round(ab.params.prazo) + 1, w('O prazo de arrependimento se esgota.', 'The withdrawal period ends.')), call(R(dev), w('confirmarPagamento', 'confirmPayment') + ethPay.I, [], null, 'sucesso', null, w('Pagamento confirmado.', 'Payment confirmed.'))] : []; })(),
                    { acao: 'ataqueReentrancia', conta: attacker, sacar: N.sacar, saldos: N.saldos, explicacao: w('O contrato atacante saca e, ao receber o Ether, tenta sacar de novo.', 'The attacker contract withdraws and, on receiving Ether, tries to withdraw again.') }
                ]), { contratoAtacante: { papel: R(cre) } }));
        }

        // Teste genérico: o Atacante tenta todas as funções que alteram o estado.
        scenarios.push({ titulo: w('Conta não autorizada tenta executar cada função', 'Unauthorized account tries every function'), tipo: 'seguranca',
            objetivo: w('Toda função que altera o estado deve recusar quem não é a parte legitimada.', 'Every state-changing function must reject anyone who is not the entitled party.'),
            passos: [{ acao: 'atacarTodas', conta: attacker, ignorar: [N.sacar, w('sacarToken', 'withdrawToken')], erroEsperado: N.NaoAutorizado, explicacao: w('Chamada de cada função pela conta do Atacante.', 'Each function called by the Attacker account.') }, solv()] });

        // Assinaturas digitais: cenários próprios e, nos demais, todos assinam antes de começar.
        const sigB = blocks.find(x => x.type === 'assinaturas');
        if (sigB) {
            const HASH = '0x' + sha256Hex(textoParaAssinatura(model, lang));
            const SIGN = w('assinar', 'sign'), CANCEL = w('cancelarPorFaltaDeAssinatura', 'cancelForMissingSignatures'), DOC = w('registrarDocumento', 'recordDocument');
            const signAll = except => ctx.roles.filter(r => r !== except).map(r => call(R(r), SIGN, [HASH], null, 'sucesso', null, w(`${r.label} assina.`, `${r.label} signs.`)));
            const first = ctx.roles[0], last = ctx.roles[ctx.roles.length - 1];
            const docHash = '0x' + sha256Hex('PDF assinado de teste');
            const s1 = [
                call(R(first), SIGN, ['0x' + '0'.repeat(63) + '1'], null, 'reverter', N.ParametroInvalido, w('Assinatura que não confere com o texto é recusada.', 'A signature that does not match the text is rejected.')),
                call(attacker, SIGN, [HASH], null, 'reverter', N.NaoAutorizado, w('Quem não é signatário não assina.', 'A non-signatory cannot sign.')),
                ...signAll(last),
                call(R(first), SIGN, [HASH], null, 'reverter', N.JaConcluido, w('Não se assina duas vezes.', 'Cannot sign twice.')),
                query(R(first), N.situacao, [], '2', w('Falta uma assinatura: o contrato ainda não está em vigor.', 'One signature is missing: the contract is not yet in force.')),
                call(R(last), SIGN, [HASH], null, 'sucesso', null, w(`${last.label} assina por último.`, `${last.label} signs last.`)),
                query(R(first), N.situacao, [], '0', w('Com todas as assinaturas, o contrato entra em vigor.', 'With all signatures, the contract comes into force.'))
            ];
            scenarios.unshift(Object.assign(sc(w('Assinaturas: vigência só após todos assinarem', 'Signatures: in force only after everyone signs'), 'seguranca',
                w('Cada signatário confere a impressão digital do texto; o contrato só entra em vigor com a última assinatura.', 'Each signatory checks the text fingerprint; the contract only comes into force with the last signature.'), s1), { semAssinatura: true, bloco: sigB.uid }));
            scenarios.splice(1, 0, Object.assign(sc(w('Assinaturas: registro do PDF assinado', 'Signatures: recording the signed PDF'), 'funcionalidade',
                w('Antes da primeira assinatura, registra-se a impressão digital do PDF assinado por serviço de assinatura eletrônica; depois disso, o registro não muda.', 'Before the first signature, the fingerprint of the PDF signed with an electronic signature service is recorded; afterwards, it cannot change.'), [
                    call(R(first), DOC, ['0x' + '0'.repeat(64)], null, 'reverter', N.ParametroInvalido, w('Impressão digital vazia é recusada.', 'An empty fingerprint is rejected.')),
                    call(R(first), DOC, [docHash], null, 'sucesso', null, w('Impressão digital do PDF registrada.', 'PDF fingerprint recorded.')),
                    query(R(first), w('documentoAssinado', 'signedDocument'), [], docHash, w('O registro consta do contrato.', 'The record is in the contract.')),
                    call(R(first), SIGN, [HASH], null, 'sucesso', null, w(`${first.label} assina.`, `${first.label} signs.`)),
                    call(R(last), DOC, [HASH], null, 'reverter', N.NaoDisponivel, w('Depois da primeira assinatura, o documento não pode ser trocado.', 'After the first signature, the document cannot be replaced.'))
                ]), { semAssinatura: true, bloco: sigB.uid }));
            scenarios.splice(2, 0, Object.assign(sc(w('Assinaturas: cancelamento por falta de assinatura', 'Signatures: cancellation for missing signatures'), 'funcionalidade',
                w('Esgotado o prazo sem todas as assinaturas, já não se assina, e qualquer signatário cancela o contrato.', 'After the period without all signatures, no one can sign any more, and any signatory cancels the contract.'), [
                    call(R(first), SIGN, [HASH], null, 'sucesso', null, w(`${first.label} assina.`, `${first.label} signs.`)),
                    call(R(first), CANCEL, [], null, 'reverter', N.PrazoNaoEncerrado, w('Ainda no prazo das assinaturas.', 'Still within the signature period.')),
                    wait(Math.round(sigB.params.prazo) + 1, w('O prazo das assinaturas se esgota.', 'The signature period ends.')),
                    call(R(last), SIGN, [HASH], null, 'reverter', N.PrazoEncerrado, w('Fora do prazo, a assinatura é recusada.', 'After the period, the signature is rejected.')),
                    call(R(first), CANCEL, [], null, 'sucesso', null, w('Contrato cancelado.', 'Contract cancelled.')),
                    query(R(first), N.situacao, [], '1', w('O contrato fica encerrado.', 'The contract is closed.'))
                ]), { semAssinatura: true, bloco: sigB.uid }));
            for (const scn of scenarios) {
                if (scn.semAssinatura) { delete scn.semAssinatura; continue; }
                const papel = scn.contratoAtacante ? scn.contratoAtacante.papel : null;
                const pre = ctx.roles.map(r => papel === R(r)
                    ? { acao: 'chamarPeloAtacante', funcao: SIGN, argumentos: [HASH], explicacao: w(`${r.label} (contrato atacante) assina.`, `${r.label} (attacker contract) signs.`) }
                    : call(R(r), SIGN, [HASH], null, 'sucesso', null, w(`${r.label} assina.`, `${r.label} signs.`)));
                scn.passos = pre.concat(scn.passos);
            }
        }

        if (priceOracles.length) {
            for (const scn of scenarios) {
                if (scn.semPrelude) { delete scn.semPrelude; continue; }
                const out = refresh();
                for (const st of scn.passos) {
                    out.push(st);
                    if (st.acao === 'avancarTempo' && !st.semAtualizar) out.push(...refresh());
                }
                scn.passos = out;
            }
        }

        // Cada cenário fica associado à cláusula de que trata (para a cor na tela).
        const byTitle = ctx.blocks.slice().sort((a, b) => b.label.length - a.label.length);
        for (const scn of scenarios) {
            if (scn.bloco) continue;
            const hit = byTitle.find(b => scn.titulo.startsWith(b.label + ':'));
            if (hit) scn.bloco = hit.uid;
            else if (rescisao && /^(Rescisão|Termination)/.test(scn.titulo)) scn.bloco = rescisao.uid;
            else if (vigencia && /(vigência|term)$/.test(scn.titulo)) scn.bloco = vigencia.uid;
        }

        const moneyTotal = ctx.allMoney.reduce((s, b) => s + Number(b.params.valor) * (b.type === 'pagamentoPeriodico' ? Number(b.params.parcelas) : 1), 0);
        const balance = String(Math.max(100, Math.ceil(moneyTotal / ctx.scale * 2 + 10)));
        return {
            contrato: ctx.name,
            contas: ctx.roles.map(r => ({ nome: r.label, saldoEther: balance })).concat([{ nome: w('Atacante', 'Attacker'), saldoEther: balance }]),
            implantacao: { conta: R(ctx.roles[0]), argumentos: ctx.roles.map(r => R(r)).concat(ctx.usesToken ? ['@Token'] : []) },
            usaToken: ctx.usesToken,
            cenarios: scenarios,
            legenda: legend(model, lang),
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
                name: en ? 'Lease Agreement' : 'Contrato de Locação', scale: 1000,
                roles: [r('locador', 'Locador', 'Landlord'), r('locatario', 'Locatário', 'Tenant'), r('arbitro', 'Árbitro', 'Arbitrator')],
                blocks: [
                    blk('pagamentoPeriodico', en ? 'Rent' : 'Aluguel', { devedor: 'locatario', credor: 'locador', valor: 2000, parcelas: 12, periodo: 30 }),
                    blk('encargos', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'Rent' : 'Aluguel'), multa: 10, juros: 1, tolerancia: 0 }),
                    blk('caucao', en ? 'Security' : 'Caução', { garantidor: 'locatario', beneficiario: 'locador', valor: 6000, prazo: 30 }),
                    blk('arbitro', '', { arbitro: 'arbitro' }),
                    blk('rescisao', '', { quem: '*' }),
                    Object.assign(blk('foro', en ? 'Jurisdiction' : 'Foro', {}), { texto: en
                        ? 'The courts of São Paulo, Brazil, where the property is located, shall have jurisdiction over disputes arising from this contract.'
                        : 'Fica eleito o foro da comarca de São Paulo/SP, local do imóvel, para dirimir as controvérsias oriundas deste contrato.' })
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
                name: en ? 'Services Agreement' : 'Prestação de Serviços', scale: 1000,
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
            locacaoReajuste: () => ({
                name: en ? 'Indexed Lease' : 'Locação com Reajuste', scale: 1000,
                roles: [r('locador', 'Locador', 'Landlord'), r('locatario', 'Locatário', 'Tenant'), r('fonte', 'Fonte do índice', 'Index provider')],
                blocks: [
                    blk('pagamentoPeriodico', en ? 'Rent' : 'Aluguel', { devedor: 'locatario', credor: 'locador', valor: 2000, parcelas: 12, periodo: 30 }),
                    blk('oraculoValor', en ? 'IGP-M Index' : 'Índice IGP-M', { fonte: 'fonte', validade: 45 }),
                    blk('reajuste', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'Rent' : 'Aluguel'), indice: 'p_oraculoValor_' + (en ? 'IgpMIndex' : 'IndiceIgpM') }),
                    blk('encargos', '', { alvo: 'p_pagamentoPeriodico_' + (en ? 'Rent' : 'Aluguel'), multa: 10, juros: 1, tolerancia: 0 }),
                    blk('rescisao', '', { quem: '*' })
                ]
            }),
            pagamentoCotacao: () => ({
                name: en ? 'BRL Payment at Market Price' : 'Pagamento em Reais pela Cotação', scale: 15000,
                roles: [r('credor', 'Credor', 'Creditor'), r('devedor', 'Devedor', 'Debtor'), r('oraculo', 'Oráculo de preços', 'Price oracle')],
                blocks: [
                    blk('pagamentoUnico', en ? 'Invoice' : 'Fatura', { devedor: 'devedor', credor: 'credor', valor: 3000, prazo: 15 }),
                    blk('oraculoValor', en ? 'ETH BRL Price' : 'Cotação ETH BRL', { fonte: 'oraculo', validade: 1 }),
                    blk('conversaoCambial', '', { alvo: 'p_pagamentoUnico_' + (en ? 'Invoice' : 'Fatura'), cotacao: 'p_oraculoValor_' + (en ? 'EthBrlPrice' : 'CotacaoEthBrl') }),
                    blk('encargos', '', { alvo: 'p_pagamentoUnico_' + (en ? 'Invoice' : 'Fatura'), multa: 2, juros: 1, tolerancia: 0 })
                ]
            }),
            entregaEvento: () => ({
                name: en ? 'Purchase with Delivery Tracking' : 'Compra com Rastreio de Entrega', scale: 1000,
                roles: [r('comprador', 'Comprador', 'Buyer'), r('vendedor', 'Vendedor', 'Seller'), r('transportadora', 'Transportadora', 'Carrier'), r('arbitro', 'Árbitro', 'Arbitrator')],
                blocks: [
                    blk('custodia', en ? 'Price' : 'Preço', { depositante: 'comprador', beneficiario: 'vendedor', valor: 8000, prazo: 20 }),
                    blk('oraculoEvento', en ? 'Delivery Confirmed' : 'Entrega confirmada', { fonte: 'transportadora' }),
                    blk('liberacaoPorEvento', '', { alvo: 'p_custodia_' + (en ? 'Price' : 'Preco'), evento: 'p_oraculoEvento_' + (en ? 'DeliveryConfirmed' : 'EntregaConfirmada') }),
                    blk('arbitro', '', { arbitro: 'arbitro' })
                ]
            }),
            servicoObrigacoes: () => ({
                name: en ? 'Services with Penalty and Non-compete' : 'Serviço com Cláusula Penal e Não Concorrência', scale: 1000,
                roles: [r('contratante', 'Contratante', 'Client'), r('contratado', 'Contratado', 'Contractor')],
                blocks: [
                    blk('obrigacaoFazer', en ? 'Service' : 'Serviço', { devedor: 'contratado', credor: 'contratante', prazo: 30, verificador: 'contratante' }),
                    blk('clausulaPenal', en ? 'Service Penalty' : 'Multa pelo serviço', { alvo: 'x' + (en ? 'Service' : 'Servico'), valor: 3000 }),
                    blk('pagamentoUnico', en ? 'Fee' : 'Honorários', { devedor: 'contratante', credor: 'contratado', valor: 10000, prazo: 40 }),
                    blk('obrigacaoNaoFazer', en ? 'Non-compete' : 'Não concorrência', { devedor: 'contratado', credor: 'contratante', duracao: 180, verificador: 'contratante' }),
                    blk('clausulaPenal', en ? 'Non-compete Penalty' : 'Multa pela concorrência', { alvo: 'x' + (en ? 'NonCompete' : 'NaoConcorrencia'), valor: 5000 }),
                    Object.assign(blk('clausulaLivre', en ? 'Description of the obligations' : 'Descrição das obrigações', {}), { texto: en
                        ? 'The service consists of developing the website described in the attached proposal. The non-compete covers providing the same service to direct competitors of the client in the same city.'
                        : 'O serviço consiste no desenvolvimento do sítio eletrônico descrito na proposta anexa. A não concorrência abrange a prestação do mesmo serviço a concorrentes diretos do contratante na mesma cidade.' })
                ]
            }),
            compraEntrega: () => ({
                name: en ? 'Purchase with Attested Delivery' : 'Compra com Entrega Atestada', scale: 1000,
                roles: [r('comprador', 'Comprador', 'Buyer'), r('vendedor', 'Vendedor', 'Seller'), r('arbitro', 'Árbitro', 'Arbitrator')],
                blocks: [
                    blk('custodia', en ? 'Price' : 'Preço', { depositante: 'comprador', beneficiario: 'vendedor', valor: 20000, prazo: 45 }),
                    blk('obrigacaoDar', en ? 'Sold Item' : 'Bem vendido', { devedor: 'vendedor', credor: 'comprador', prazo: 30, verificador: 'comprador' }),
                    blk('liberacaoPorEvento', '', { alvo: 'x' + (en ? 'Price' : 'Preco'), evento: 'x' + (en ? 'SoldItem' : 'BemVendido') }),
                    blk('clausulaPenal', en ? 'Delivery Penalty' : 'Multa pela entrega', { alvo: 'x' + (en ? 'SoldItem' : 'BemVendido'), valor: 4000 }),
                    blk('arbitro', '', { arbitro: 'arbitro' })
                ]
            }),
            compraFormal: () => ({
                name: en ? 'Sale Agreement with Signatures' : 'Compra e Venda com Assinaturas', scale: 1000,
                roles: [r('vendedor', 'Vendedor', 'Seller'), r('comprador', 'Comprador', 'Buyer'), r('testemunha1', 'Primeira testemunha', 'First witness'), r('testemunha2', 'Segunda testemunha', 'Second witness')],
                blocks: [
                    Object.assign(blk('objeto', en ? 'Subject matter' : 'Objeto', {}), { texto: en
                        ? 'The subject matter of this contract is the sale of a used 2018 hatchback car, in the condition seen by the buyer, under the terms set out in the following clauses.'
                        : 'O presente contrato tem por objeto a compra e venda de um automóvel usado, modelo 2018, no estado em que se encontra e foi vistoriado pelo comprador, nas condições estabelecidas nas cláusulas seguintes.' }),
                    blk('pagamentoUnico', en ? 'Price' : 'Preço', { devedor: 'comprador', credor: 'vendedor', valor: 30000, prazo: 10 }),
                    blk('arrependimento', '', { alvo: 'x' + (en ? 'Price' : 'Preco'), prazo: 7 }),
                    Object.assign(blk('obrigacaoDar', en ? 'Car' : 'Veículo', { devedor: 'vendedor', credor: 'comprador', prazo: 20, verificador: 'comprador', atestacao: 5 }), { texto: en
                        ? '{devedor} shall deliver to {credor} the car described in the subject matter clause, with its documents and keys, within {prazo} days of deployment. Once delivery is reported, {verificador} has {atestacao} days to attest receipt or reject it with reasons; silence counts as attestation, and a rejection gives the debtor the same period again to perform. If the deadline passes with no performance reported, either party may declare default.'
                        : '{devedor} entregará a {credor} o veículo descrito na cláusula do objeto, com seus documentos e chaves, até {prazo} dias após a implantação. Informada a entrega, {verificador} terá {atestacao} dias para atestar o recebimento ou recusá-lo fundamentadamente; o silêncio importará atestação, e a recusa reabrirá ao devedor igual prazo para cumprir. Vencido o prazo sem cumprimento informado, qualquer das partes poderá declarar o inadimplemento.' }),
                    blk('clausulaPenal', en ? 'Delivery penalty' : 'Multa pela entrega', { alvo: 'x' + (en ? 'Car' : 'Veiculo'), valor: 3000 }),
                    blk('notificacoes', '', {}),
                    Object.assign(blk('protecaoDados', en ? 'Data protection' : 'Proteção de dados', {}), { texto: BLOCKS.protecaoDados.sentence[en ? 'en' : 'pt'] }),
                    Object.assign(blk('foro', en ? 'Jurisdiction' : 'Foro', {}), { texto: en
                        ? 'The courts of São Paulo, Brazil, where the buyer is domiciled, shall have jurisdiction over disputes arising from this contract.'
                        : 'Fica eleito o foro da comarca de São Paulo/SP, domicílio do comprador, para dirimir as controvérsias oriundas deste contrato.' }),
                    Object.assign(blk('localData', en ? 'Place and date' : 'Local e data', {}), { texto: en
                        ? 'Signed in São Paulo, on the date of the last signature recorded in this contract.'
                        : 'Firmado em São Paulo/SP, na data da última assinatura registrada neste contrato.' }),
                    blk('assinaturas', '', { prazo: 15 }),
                    blk('testemunha', en ? 'First witness' : 'Primeira testemunha', { testemunha: 'testemunha1' }),
                    blk('testemunha', en ? 'Second witness' : 'Segunda testemunha', { testemunha: 'testemunha2' })
                ]
            }),
            assinatura: () => ({
                name: en ? 'Subscription' : 'Assinatura de Serviço', scale: 1000,
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
            for (const p of BLOCKS[b.type].params.filter(x => x.kind === 'ref')) {
                const v = b.params[p.key];
                if (v && !uids.has(v)) {
                    const target = model.blocks.find(x => p.accepts.includes(x.type) && v.endsWith(pascal(x.label)));
                    if (target) b.params[p.key] = target.uid;
                }
            }
            if (!b.label) b.label = BLOCKS[b.type].name[en ? 'en' : 'pt'];
        }
        return normalize(model);
    }

    const PRESETS = [
        { id: 'locacao', pt: 'Locação com multa, juros, caução, árbitro e rescisão', en: 'Lease with late fee, interest, security deposit, arbitrator and termination' },
        { id: 'compraParcelada', pt: 'Compra e venda parcelada com entrada e vencimento antecipado', en: 'Installment sale with down payment and acceleration' },
        { id: 'servicos', pt: 'Prestação de serviços com sinal, etapas e rescisão', en: 'Services with signing fee, milestones and termination' },
        { id: 'garantia', pt: 'Compra com depósito em garantia, árbitro e vigência', en: 'Escrow purchase with arbitrator and term' },
        { id: 'locacaoReajuste', pt: 'Locação com reajuste pelo IGP-M (oráculo de índice)', en: 'Lease adjusted by an index (index oracle)' },
        { id: 'pagamentoCotacao', pt: 'Pagamento em reais convertido pela cotação (oráculo de preço)', en: 'BRL payment converted at market price (price oracle)' },
        { id: 'entregaEvento', pt: 'Compra com liberação ao confirmar a entrega (oráculo de evento)', en: 'Purchase released on delivery confirmation (event oracle)' },
        { id: 'servicoObrigacoes', pt: 'Prestação de serviço (fazer) com cláusula penal e não concorrência (não fazer)', en: 'Service (to do) with penalty clause and non-compete (not to do)' },
        { id: 'compraEntrega', pt: 'Compra com entrega do bem (dar) atestada pelo comprador e cláusula penal', en: 'Purchase with delivery (to give) attested by the buyer and penalty clause' },
        { id: 'compraFormal', pt: 'Compra e venda formal: objeto, arrependimento, entrega com cláusula penal, foro, assinaturas e testemunhas', en: 'Formal sale: subject matter, withdrawal right, delivery with penalty, jurisdiction, signatures and witnesses' },
        { id: 'assinatura', pt: 'Assinatura mensal com encargos, vigência e rescisão pelo cliente', en: 'Monthly subscription with charges, term and customer termination' }
    ];

    function emptyModel(lang) {
        const en = lang === 'en';
        return { name: en ? 'Composed Agreement' : 'Contrato Montado', scale: 1000, roles: [{ id: 'parteA', label: en ? 'Party A' : 'Parte A' }, { id: 'parteB', label: en ? 'Party B' : 'Parte B' }], blocks: [] };
    }

    return {
        BLOCKS, CATEGORIES, PRESETS, SOLC_VERSION, slots, missingSlots,
        newBlock, validate, warnings, normalize, legalCheck, qualificacao, textoParaAssinatura, hashDoTexto: (model, lang) => '0x' + sha256Hex(textoParaAssinatura(model, lang)), sha256Hex, minuta, build, plan, preset, emptyModel, legend, colorOf, linksOf, COLORS, fillSentence: (b, model, lang) => fillSentence(Object.assign({}, b), makeCtx(model, lang)),
        names: { pascal, camel, upper }, toWei, fieldLabel, safe, isBlockType: t => Object.prototype.hasOwnProperty.call(BLOCKS, t)
    };
}));
