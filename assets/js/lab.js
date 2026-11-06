/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Laboratório: implanta o contrato compilado numa "blockchain" simulada
 * (assets/vendor/evm-lab.js), com contas fictícias, e permite:
 *  - interagir com as funções como qualquer das partes;
 *  - avançar o relógio para testar prazos;
 *  - acompanhar saldos, estado do contrato e a linha do tempo de transações;
 *  - executar cenários de teste (gerados pela IA) e ver o que passou ou falhou.
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});
    const t = (k, v) => CSC.t(k, v);

    Object.assign(CSC.texts.pt, {
        labTitle: 'Laboratório: teste em "blockchain" simulada',
        labIntro: 'O contrato é implantado numa "blockchain" que roda só no seu navegador: sem carteira, sem custo e sem risco. Cada parte recebe uma conta fictícia com 100 ETH de teste. Experimente as funções como cada parte, avance o tempo e veja o contrato aceitar ou recusar as operações.',
        labConceptAccount: 'Conta',
        labConceptAccountText: 'Cada parte é identificada por um endereço (0x...). Quem chama a função é o "msg.sender".',
        labConceptTx: 'Transação',
        labConceptTxText: 'Toda alteração é uma transação registrada em bloco, com custo de "gás".',
        labConceptRevert: 'Reversão',
        labConceptRevertText: 'Se uma regra é violada, o contrato reverte: nada muda e o Ether volta a quem enviou.',
        labDeployButton: 'Implantar e interagir',
        labRedeployButton: 'Reiniciar laboratório',
        labScenariosButton: 'Gerar testes com IA',
        labRerunButton: 'Executar os testes novamente',
        labNeedsCompile: 'Compilando o código para o laboratório...',
        labCompileErrors: 'Corrija os erros de compilação antes de usar o laboratório (seção 3).',
        labNoDeployable: 'Nenhum contrato implantável foi encontrado no código.',
        labLoadFailed: 'Não foi possível iniciar a "blockchain" simulada: {msg}',
        labDeployTitle: 'Implantação (construtor)',
        labDeployHint: 'Use "@Nome" para o endereço de uma conta, "1 ether" para valores e "30 days" para prazos.',
        labDeployAs: 'Implantar como',
        labDeploy: 'Implantar contrato',
        labDeployed: 'Contrato {name} implantado em {address}.',
        labDeployFailed: 'A implantação foi revertida: {error}',
        labAccounts: 'Contas e saldos',
        labContractRow: 'Contrato',
        labClock: 'Data do bloco',
        labAdvance: 'Avançar',
        labDay: '+1 dia',
        labWeek: '+7 dias',
        labMonth: '+30 dias',
        labYear: '+1 ano',
        labState: 'Estado do contrato',
        labStateEmpty: 'O contrato não expõe variáveis públicas.',
        labFunctions: 'Funções',
        labFunctionsHint: 'Escolha quem chama a função e clique em Executar. Funções "payable" recebem Ether.',
        labCallAs: 'Como',
        labValue: 'Valor (ETH)',
        labExecute: 'Executar',
        labQuery: 'Consultar',
        labTimeline: 'Linha do tempo das transações',
        labTimelineEmpty: 'Nenhuma transação ainda.',
        labTxOk: 'Executada',
        labTxReverted: 'Revertida',
        labGas: 'gás',
        labEvents: 'Eventos',
        labRevertExplain: 'O contrato recusou a operação e desfez todas as alterações.',
        labResult: 'Resultado',
        labInvalidArg: 'Argumento inválido para "{name}" ({type}): {value}',
        labScenariosTitle: 'Testes de funcionalidade e segurança',
        labScenariosIntro: 'A IA propõe cenários a partir da cláusula e do código; o laboratório os executa de verdade, cada um a partir de uma implantação nova.',
        labScenariosIntroTemplate: 'Cenários predefinidos do modelo revisado (sem IA), executados de verdade, cada um a partir de uma implantação nova. Servem também de teste de regressão após edições ou adaptações.',
        labGeneratingScenarios: 'A IA está elaborando os cenários de teste...',
        labRunningScenario: 'Executando cenário {i} de {n}...',
        labSummary: '{pass} de {total} cenários aprovados',
        labSummaryDetail: '{fail} com falha do contrato · {invalid} com teste inválido',
        labTypeFunctional: 'Funcionalidade',
        labTypeSecurity: 'Segurança',
        labPassed: 'Aprovado',
        labFailed: 'Falhou',
        labInvalid: 'Teste inválido',
        labStepExpectedSuccess: 'esperado: sucesso',
        labStepExpectedRevert: 'esperado: reversão',
        labStepAdvance: 'Avançar o tempo em {time}',
        labVulnerability: 'Possível falha de segurança: a operação deveria ter sido recusada, mas foi aceita.',
        labFunctionalFailure: 'O contrato recusou uma operação que deveria aceitar.',
        labWrongError: 'Revertida com erro diferente do esperado ({got}; esperado {expected}).',
        labWrongResult: 'Resultado {got}; esperado {expected}.',
        labInvalidStep: 'Passo não executável: {msg}',
        labUnknownFunction: 'a função "{name}" não existe na ABI',
        labUnknownAccount: 'conta "{name}" desconhecida',
        labFixFromTests: 'Corrigir com IA a partir das falhas',
        labNoFailures: 'Nenhum teste apontou falha do contrato.',
        labScenarioError: 'Não foi possível executar os cenários: {msg}',
        panic_1: 'falha de "assert"',
        panic_17: 'estouro aritmético ("overflow"/"underflow")',
        panic_18: 'divisão por zero',
        panic_33: 'valor inválido para "enum"',
        panic_50: 'acesso fora dos limites de array',
        errInsufficient: 'A conta não tem saldo suficiente para enviar esse valor.',
        errWrongAmount: 'Valor incorreto: devido {due}; enviado {sent}.',
        errLimit: 'limite: {date} UTC',
        labParticipants: 'Contas participantes',
        labDueFill: 'preencher o valor devido',
        labDueFilled: 'Valor devido preenchido: {v}.',
        stateOf: '{a} de {b}',
        fnInfoTitle: 'Sobre a função',
        fnInfoClause: 'Cláusula que esta função implementa',
        fnInfoWhat: 'O que faz',
        fnInfoWho: 'Quem pode chamar',
        fnInfoAnyone: 'Qualquer conta. A função atua sobre o próprio crédito de quem chama.',
        fnInfoAnyoneRead: 'Qualquer conta (apenas leitura).',
        fnInfoMoney: 'Dinheiro',
        fnInfoPayable: 'Recebe Ether junto com a chamada. Informe o valor no campo "Valor (ETH)".',
        fnInfoNoPayable: 'Não recebe Ether.',
        fnInfoView: 'É uma consulta: não altera o contrato e não gera transação.',
        fnInfoWhen: 'Quando pode ser usada',
        fnInfoStatus: 'Somente com o contrato na situação "{s}".',
        fnInfoAlways: 'A qualquer tempo, observadas as condições abaixo.',
        fnInfoGuard: 'Protegida contra reentrância (a função não pode ser reaberta durante a própria execução).',
        fnInfoErrors: 'Pode ser recusada quando',
        fnInfoNoErrors: 'Não há recusas previstas no código.',
        fnInfoEvents: 'Registros (eventos) emitidos',
        fnInfoSignature: 'Assinatura técnica',
        fnInfoButton: 'Explicar a função',
        fnInfoClose: 'Fechar',
        errDesc_NaoAutorizado: 'quem chama não é a parte autorizada',
        errDesc_SituacaoInvalida: 'o contrato não está na situação exigida (por exemplo, já foi encerrado)',
        errDesc_ValorIncorreto: 'o valor enviado é diferente do valor devido',
        errDesc_JaConcluido: 'a obrigação já foi cumprida',
        errDesc_NaoDisponivel: 'a ação não está disponível neste momento',
        errDesc_PrazoNaoEncerrado: 'o prazo ainda não terminou',
        errDesc_PrazoEncerrado: 'o prazo já terminou',
        errDesc_SemAtrasoSuficiente: 'o atraso ainda não atingiu o limite contratual',
        errDesc_SemSaldo: 'não há crédito a sacar',
        errDesc_FalhaNoEnvio: 'o envio do Ether ao destinatário falhou',
        errDesc_Reentrada: 'houve tentativa de reabrir a função durante a própria execução (ataque de reentrância)',
        errDesc_ParametroInvalido: 'algum dado informado é inválido',
        errDesc_EnderecoInvalido: 'algum endereço informado é inválido',
        errDesc_ForaDoPrazo: 'a operação ocorreu fora do prazo',
        labSolvencyOk: 'Solvência conferida: saldo do contrato {bal} ETH = créditos das partes {cred} ETH + valores retidos {held} ETH.',
        labSolvencyFail: 'Falha de solvência: saldo do contrato {bal} ETH ≠ créditos {cred} ETH + retidos {held} ETH.',
        errOutOfGas: 'A execução esgotou o limite de "gás".'
    });
    Object.assign(CSC.texts.en, {
        labTitle: 'Lab: testing on a simulated blockchain',
        labIntro: 'The contract is deployed to a blockchain that runs only in your browser: no wallet, no cost, no risk. Each party gets a fictitious account with 100 test ETH. Try the functions as each party, move time forward and watch the contract accept or reject operations.',
        labConceptAccount: 'Account',
        labConceptAccountText: 'Each party is identified by an address (0x...). Whoever calls the function is "msg.sender".',
        labConceptTx: 'Transaction',
        labConceptTxText: 'Every change is a transaction recorded in a block, with a gas cost.',
        labConceptRevert: 'Revert',
        labConceptRevertText: 'If a rule is broken the contract reverts: nothing changes and the Ether goes back to the sender.',
        labDeployButton: 'Deploy and interact',
        labRedeployButton: 'Reset lab',
        labScenariosButton: 'Generate tests with AI',
        labRerunButton: 'Run the tests again',
        labNeedsCompile: 'Compiling the code for the lab...',
        labCompileErrors: 'Fix the compilation errors before using the lab (section 3).',
        labNoDeployable: 'No deployable contract was found in the code.',
        labLoadFailed: 'Could not start the simulated blockchain: {msg}',
        labDeployTitle: 'Deployment (constructor)',
        labDeployHint: 'Use "@Name" for an account address, "1 ether" for amounts and "30 days" for deadlines.',
        labDeployAs: 'Deploy as',
        labDeploy: 'Deploy contract',
        labDeployed: 'Contract {name} deployed at {address}.',
        labDeployFailed: 'Deployment reverted: {error}',
        labAccounts: 'Accounts and balances',
        labContractRow: 'Contract',
        labClock: 'Block date',
        labAdvance: 'Advance',
        labDay: '+1 day',
        labWeek: '+7 days',
        labMonth: '+30 days',
        labYear: '+1 year',
        labState: 'Contract state',
        labStateEmpty: 'The contract exposes no public variables.',
        labFunctions: 'Functions',
        labFunctionsHint: 'Choose who calls the function and click Run. "payable" functions receive Ether.',
        labCallAs: 'As',
        labValue: 'Value (ETH)',
        labExecute: 'Run',
        labQuery: 'Query',
        labTimeline: 'Transaction timeline',
        labTimelineEmpty: 'No transactions yet.',
        labTxOk: 'Executed',
        labTxReverted: 'Reverted',
        labGas: 'gas',
        labEvents: 'Events',
        labRevertExplain: 'The contract rejected the operation and undid every change.',
        labResult: 'Result',
        labInvalidArg: 'Invalid argument for "{name}" ({type}): {value}',
        labScenariosTitle: 'Functional and security tests',
        labScenariosIntro: 'The AI proposes scenarios from the clause and code; the lab actually runs them, each one on a fresh deployment.',
        labScenariosIntroTemplate: 'Predefined scenarios of the reviewed template (no AI), actually executed, each on a fresh deployment. They also work as regression tests after edits or adaptations.',
        labGeneratingScenarios: 'The AI is drafting the test scenarios...',
        labRunningScenario: 'Running scenario {i} of {n}...',
        labSummary: '{pass} of {total} scenarios passed',
        labSummaryDetail: '{fail} contract failure(s) · {invalid} invalid test(s)',
        labTypeFunctional: 'Functionality',
        labTypeSecurity: 'Security',
        labPassed: 'Passed',
        labFailed: 'Failed',
        labInvalid: 'Invalid test',
        labStepExpectedSuccess: 'expected: success',
        labStepExpectedRevert: 'expected: revert',
        labStepAdvance: 'Advance time by {time}',
        labVulnerability: 'Possible security flaw: the operation should have been rejected but was accepted.',
        labFunctionalFailure: 'The contract rejected an operation it should accept.',
        labWrongError: 'Reverted with a different error than expected ({got}; expected {expected}).',
        labWrongResult: 'Result {got}; expected {expected}.',
        labInvalidStep: 'Step could not run: {msg}',
        labUnknownFunction: 'function "{name}" does not exist in the ABI',
        labUnknownAccount: 'unknown account "{name}"',
        labFixFromTests: 'Fix with AI based on the failures',
        labNoFailures: 'No test pointed to a contract failure.',
        labScenarioError: 'Could not run the scenarios: {msg}',
        panic_1: 'assertion failure',
        panic_17: 'arithmetic overflow/underflow',
        panic_18: 'division by zero',
        panic_33: 'invalid enum value',
        panic_50: 'array index out of bounds',
        errInsufficient: 'The account does not have enough balance to send this amount.',
        errWrongAmount: 'Wrong amount: due {due}; sent {sent}.',
        errLimit: 'limit: {date} UTC',
        labParticipants: 'Participating accounts',
        labDueFill: 'fill in the amount due',
        labDueFilled: 'Amount due filled in: {v}.',
        stateOf: '{a} of {b}',
        fnInfoTitle: 'About the function',
        fnInfoClause: 'Clause implemented by this function',
        fnInfoWhat: 'What it does',
        fnInfoWho: 'Who can call it',
        fnInfoAnyone: 'Any account. The function acts on the caller\'s own credit.',
        fnInfoAnyoneRead: 'Any account (read only).',
        fnInfoMoney: 'Money',
        fnInfoPayable: 'Receives Ether with the call. Enter the amount in the "Value (ETH)" field.',
        fnInfoNoPayable: 'Does not receive Ether.',
        fnInfoView: 'It is a query: it does not change the contract and creates no transaction.',
        fnInfoWhen: 'When it can be used',
        fnInfoStatus: 'Only while the contract status is "{s}".',
        fnInfoAlways: 'At any time, subject to the conditions below.',
        fnInfoGuard: 'Protected against reentrancy (it cannot be re-entered during its own execution).',
        fnInfoErrors: 'It may be rejected when',
        fnInfoNoErrors: 'The code foresees no rejections.',
        fnInfoEvents: 'Records (events) emitted',
        fnInfoSignature: 'Technical signature',
        fnInfoButton: 'Explain the function',
        fnInfoClose: 'Close',
        errDesc_Unauthorized: 'the caller is not the authorized party',
        errDesc_InvalidStatus: 'the contract is not in the required status (for example, already closed)',
        errDesc_WrongAmount: 'the amount sent differs from the amount due',
        errDesc_AlreadyCompleted: 'the obligation has already been fulfilled',
        errDesc_NotAvailable: 'the action is not available at this moment',
        errDesc_DeadlineNotReached: 'the deadline has not passed yet',
        errDesc_DeadlinePassed: 'the deadline has already passed',
        errDesc_NotLateEnough: 'the delay has not reached the contractual limit',
        errDesc_NothingToWithdraw: 'there is no credit to withdraw',
        errDesc_TransferFailed: 'sending Ether to the recipient failed',
        errDesc_Reentrancy: 'the function was re-entered during its own execution (reentrancy attack)',
        errDesc_InvalidParameter: 'some given data is invalid',
        labSolvencyOk: 'Solvency checked: contract balance {bal} ETH = parties\' credits {cred} ETH + held amounts {held} ETH.',
        labSolvencyFail: 'Solvency failure: contract balance {bal} ETH ≠ credits {cred} ETH + held {held} ETH.',
        errOutOfGas: 'Execution ran out of gas.'
    });

    // ---------- Utilidades ----------
    const ACCOUNT_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#f87171'];
    const UNITS = { ether: 18, eth: 18, gwei: 9, wei: 0 };
    const TIME = { second: 1, seconds: 1, sec: 1, s: 1, minute: 60, minutes: 60, min: 60, hour: 3600, hours: 3600, h: 3600, day: 86400, days: 86400, dia: 86400, dias: 86400, d: 86400, week: 604800, weeks: 604800, semana: 604800, semanas: 604800, year: 31536000, years: 31536000, ano: 31536000, anos: 31536000 };

    function el(tag, attrs, children) {
        const node = document.createElement(tag);
        if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
                if (v == null || v === false) continue;
                if (k === 'class') node.className = v;
                else if (k === 'text') node.textContent = v;
                else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
                else node.setAttribute(k, v === true ? '' : v);
            }
        }
        for (const c of [].concat(children || [])) {
            if (c == null || c === false) continue;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
        return node;
    }

    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const shortAddr = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';

    function formatEth(wei, digits) {
        const s = window.EvmLab.formatEther(wei);
        const n = Number(s);
        if (!isFinite(n)) return s;
        return n.toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { maximumFractionDigits: digits == null ? 4 : digits });
    }

    /**
     * Equivalente em reais. Usa a escala do próprio contrato (a mesma usada
     * para converter os valores em Ether); sem ela, a cotação de mercado.
     */
    let contractScale = null;
    function brlPerEth() {
        if (contractScale) return contractScale;
        const q = CSC.rates && CSC.rates.current();
        return q ? q.brl : null;
    }
    function brlOf(wei) {
        const rate = brlPerEth();
        if (!rate) return null;
        return Number(window.EvmLab.formatEther(wei)) * rate;
    }
    function fmtBrl(v) { return Number(v).toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function approxBrl(wei) {
        if (!wei) return '';
        const v = brlOf(wei);
        return v == null ? '' : ' (≈ ' + fmtBrl(v) + ')';
    }
    /** Valor monetário legível: "3,068 ETH (≈ R$ 3.068,00)". */
    function moneyText(wei) { return formatEth(wei, 6) + ' ETH' + approxBrl(wei); }

    function formatDuration(seconds) {
        const s = Number(seconds);
        if (s % 86400 === 0) return (s / 86400) + (CSC.lang === 'en' ? ' day(s)' : ' dia(s)');
        if (s % 3600 === 0) return (s / 3600) + (CSC.lang === 'en' ? ' hour(s)' : ' hora(s)');
        return s + ' s';
    }

    function parseAmount(raw, defaultUnit) {
        const s = String(raw).trim().replace(/_/g, '');
        const m = /^(-?\d+(?:[.,]\d+)?)\s*([a-zA-Zçã]+)?$/.exec(s);
        if (!m) throw new Error('number');
        const num = m[1].replace(',', '.');
        const unit = (m[2] || defaultUnit || '').toLowerCase();
        if (unit in UNITS) return window.EvmLab.parseUnits(num, UNITS[unit]);
        if (unit in TIME) {
            const v = Number(num) * TIME[unit];
            if (!Number.isFinite(v)) throw new Error('number');
            return BigInt(Math.round(v));
        }
        if (unit) throw new Error('unit');
        if (/[.]/.test(num)) throw new Error('decimal');
        return BigInt(num);
    }

    // ---------- Estado do laboratório ----------
    const lab = {
        chain: null,
        contract: null,      // { name, abi, bytecode, address, enums }
        accounts: [],        // { label, address, color }
        deployConfig: null,  // { from, args }
        timeline: [],
        scenarioPlan: null,
        scenarioResults: null,
        dom: {}
    };

    function accountByName(name) {
        const key = norm(String(name).replace(/^@/, ''));
        return lab.accounts.find(a => norm(a.label) === key);
    }
    function labelFor(address) {
        if (!address) return '';
        const a = lab.accounts.find(x => x.address.toLowerCase() === String(address).toLowerCase());
        if (a) return a.label;
        if (lab.contract && lab.contract.address && lab.contract.address.toLowerCase() === String(address).toLowerCase()) return t('labContractRow');
        return shortAddr(address);
    }

    /** Converte texto do usuário/IA no tipo exigido pela ABI. */
    function parseArg(raw, param) {
        const type = param.type;
        const value = typeof raw === 'string' ? raw.trim() : raw;
        try {
            if (type.endsWith(']')) {
                const inner = Object.assign({}, param, { type: type.replace(/\[\d*\]$/, '') });
                const arr = Array.isArray(value) ? value : JSON.parse(value);
                return arr.map(v => parseArg(typeof v === 'string' ? v : JSON.stringify(v), inner));
            }
            if (type === 'address' || type === 'address payable') {
                if (/^@/.test(value)) {
                    if (norm(value) === 'contrato' || norm(value) === 'contract') return lab.contract.address;
                    const acc = accountByName(value);
                    if (!acc) throw new Error(t('labUnknownAccount', { name: value }));
                    return acc.address;
                }
                const acc = accountByName(value);
                if (acc) return acc.address;
                return window.EvmLab.getAddress(value);
            }
            if (/^u?int/.test(type)) return parseAmount(value);
            if (type === 'bool') {
                if (/^(true|verdadeiro|sim|1)$/i.test(value)) return true;
                if (/^(false|falso|nao|não|0)$/i.test(value)) return false;
                throw new Error('bool');
            }
            if (type === 'string') return String(value);
            if (/^bytes/.test(type)) {
                if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error('hex');
                if (type !== 'bytes') {
                    const size = Number(type.slice(5));
                    return '0x' + value.slice(2).padEnd(size * 2, '0').slice(0, size * 2);
                }
                return value;
            }
            if (type === 'tuple') return JSON.parse(value);
            return value;
        } catch (e) {
            const msg = e && e.message && e.message.length > 12 ? e.message : t('labInvalidArg', { name: param.name || '?', type, value: String(raw) });
            throw new Error(msg);
        }
    }

    /** Extrai os nomes dos membros de cada enum do código-fonte. */
    function parseEnums(source) {
        const enums = {};
        const re = /\benum\s+(\w+)\s*\{([^}]*)\}/g;
        let m;
        while ((m = re.exec(source)) !== null) {
            enums[m[1]] = m[2].split(',').map(s => s.trim()).filter(Boolean);
        }
        return enums;
    }

    function formatValue(value, output) {
        const internal = (output && output.internalType) || '';
        const enumMatch = /^enum\s+(?:\w+\.)?(\w+)$/.exec(internal);
        if (enumMatch && lab.contract && lab.contract.enums[enumMatch[1]] && typeof value !== 'object') {
            const names = lab.contract.enums[enumMatch[1]];
            const idx = Number(value);
            return (names[idx] || String(value)) + ' (' + idx + ')';
        }
        if (typeof value === 'bigint') {
            if (value >= 10n ** 14n) return moneyText(value);
            // Valores na faixa de datas Unix (2017 a 2096) são exibidos também como data.
            if (value >= 1500000000n && value <= 4000000000n) {
                const d = new Date(Number(value) * 1000).toLocaleDateString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { timeZone: 'UTC' });
                return d;
            }
            if (value > 0n && value % 86400n === 0n && /(prazo|dura|period|tempo|time|dias|days|interval)/i.test((output && output.name) || '')) {
                return formatDuration(value);
            }
            return value.toLocaleString ? value.toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR') : value.toString();
        }
        if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) {
            const label = labelFor(value);
            return label === shortAddr(value) ? value : label + ' (' + shortAddr(value) + ')';
        }
        if (Array.isArray(value)) return '[' + value.map(v => formatValue(v)).join(', ') + ']';
        if (value && typeof value === 'object') {
            return '{ ' + Object.entries(value).map(([k, v]) => k + ': ' + formatValue(v)).join(', ') + ' }';
        }
        return String(value);
    }

    function formatResult(result, fnAbi) {
        if (result === undefined) return '—';
        const outputs = (fnAbi && fnAbi.outputs) || [];
        if (outputs.length <= 1) {
            // Getters públicos têm saída sem nome: usa o nome da função para reconhecer prazos.
            const out = outputs[0] && !outputs[0].name ? Object.assign({}, outputs[0], { name: fnAbi.name }) : outputs[0];
            return formatValue(result, out);
        }
        return outputs.map((o, i) => (o.name || '#' + i) + ': ' + formatValue(result[i], o)).join(' · ');
    }

    function describeRevert(error) {
        if (!error) return '';
        if (error.name === 'Panic') {
            const code = Number(error.args && error.args[0]);
            return 'Panic: ' + t('panic_' + code);
        }
        if (error.name === 'Error') return '"' + (error.args && error.args[0]) + '"';
        if (error.name === 'SaldoInsuficiente') return t('errInsufficient');
        if (error.name === 'OutOfGas') return t('errOutOfGas');
        const desc = t('errDesc_' + error.name);
        const args = error.args || [];
        if (/^(ValorIncorreto|WrongAmount)$/.test(error.name) && args.length === 2) {
            return t('errWrongAmount', { due: moneyText(args[0]), sent: moneyText(args[1]) });
        }
        if (/^(PrazoNaoEncerrado|DeadlineNotReached|PrazoEncerrado|DeadlinePassed|SemAtrasoSuficiente|NotLateEnough|ForaDoPrazo)$/.test(error.name) && args.length) {
            const date = new Date(Number(args[args.length - 1]) * 1000).toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });
            return (desc !== 'errDesc_' + error.name ? desc : error.name) + ' (' + t('errLimit', { date }) + ')';
        }
        const argText = args.map(a => formatValue(a)).join(', ');
        if (desc !== 'errDesc_' + error.name) return desc.charAt(0).toUpperCase() + desc.slice(1) + (argText ? ' (' + argText + ')' : '') + ' [' + error.name + ']';
        return error.name + (argText ? '(' + argText + ')' : '');
    }

    function sameError(got, expected) {
        if (!expected) return true;
        if (String(expected).includes('|')) return String(expected).split('|').some(e => sameError(got, e.trim()));
        const g = norm(got && got.name);
        const e = norm(String(expected).replace(/\(.*$/, ''));
        if (g === e) return true;
        // "Error" com mensagem: compara com a mensagem.
        if (got && got.name === 'Error' && got.args && norm(got.args[0]) === e) return true;
        return false;
    }

    function deployableContracts(contracts) {
        return (contracts || []).filter(c => c.bytecode && c.bytecode.length > 2 && c.abi);
    }

    function pickContract(contracts, preferred) {
        const list = deployableContracts(contracts);
        if (!list.length) return null;
        if (preferred) {
            const p = list.find(c => norm(c.name) === norm(preferred));
            if (p) return p;
        }
        // O contrato principal costuma ser o de maior bytecode.
        return list.slice().sort((a, b) => b.bytecode.length - a.bytecode.length)[0];
    }

    function constructorOf(abi) {
        return abi.find(x => x.type === 'constructor') || { inputs: [], stateMutability: 'nonpayable' };
    }

    function prettyName(param) {
        const base = String(param || '').replace(/^_+|_+$/g, '');
        if (!base) return null;
        return base.charAt(0).toUpperCase() + base.slice(1);
    }

    /** Contas padrão: uma por parâmetro "address" do construtor, mais o Atacante. */
    function defaultAccounts(abi) {
        const names = [];
        for (const input of constructorOf(abi).inputs) {
            if (/^address/.test(input.type)) {
                const n = prettyName(input.name);
                if (n && !names.some(x => norm(x) === norm(n))) names.push(n);
            }
        }
        if (!names.length) names.push(CSC.lang === 'en' ? 'Owner' : 'Parte1', CSC.lang === 'en' ? 'Counterparty' : 'Parte2');
        names.push(CSC.lang === 'en' ? 'Attacker' : 'Atacante');
        return names.map(n => ({ nome: n, saldoEther: '100' }));
    }

    function defaultArg(input) {
        const name = norm(input.name);
        if (/^address/.test(input.type)) return '@' + (prettyName(input.name) || (lab.accounts[0] && lab.accounts[0].label) || '');
        if (/^u?int/.test(input.type)) {
            if (/(prazo|dias|duracao|duration|deadline|periodo|period|tempo|time|vencimento|due)/.test(name)) return '30 days';
            if (/(bps|percent|percentual|taxa|rate|multa|juros|fee|interest)/.test(name)) return '1000';
            if (/(parcelas|numero|quantidade|count|installments|etapas|milestones)/.test(name)) return '3';
            return '1 ether';
        }
        if (input.type === 'bool') return 'true';
        if (input.type === 'string') return 'texto';
        return '';
    }

    // ---------- Núcleo: implantar e chamar ----------
    async function newChain(accountsSpec) {
        if (!window.EvmLab) throw new Error('EVM');
        const chain = await window.EvmLab.Chain.create();
        const accounts = [];
        for (let i = 0; i < accountsSpec.length; i++) {
            const spec = accountsSpec[i];
            const label = String(spec.nome || spec.label).replace(/^@/, '').trim();
            if (!label || accounts.some(a => norm(a.label) === norm(label))) continue;
            let balance = '100';
            try { balance = String(Number(String(spec.saldoEther || '100').replace(/[^\d.]/g, '')) || 100); } catch (_) { /* padrão */ }
            const acc = await chain.addAccount(label, balance);
            acc.color = ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length];
            accounts.push(acc);
        }
        return { chain, accounts };
    }

    async function deployInto(env, compiled, deploy) {
        const ctor = constructorOf(compiled.abi);
        const saved = { accounts: lab.accounts, contract: lab.contract };
        lab.accounts = env.accounts;
        lab.contract = { address: null, enums: parseEnums(compiled.source || '') };
        try {
            const args = ctor.inputs.map((input, i) => parseArg((deploy.argumentos || [])[i] ?? '', input));
            const fromAcc = accountByName(deploy.conta) || env.accounts[0];
            const value = deploy.valor ? parseAmount(deploy.valor, /^\d+$/.test(String(deploy.valor).trim()) ? 'wei' : 'ether') : 0n;
            const res = await env.chain.deploy({ from: fromAcc.address, abi: compiled.abi, bytecode: compiled.bytecode, args, value });
            return Object.assign(res, { from: fromAcc });
        } finally {
            lab.accounts = saved.accounts;
            lab.contract = saved.contract;
        }
    }

    // ---------- Interface do laboratório interativo ----------
    function renderDeployForm(compiled) {
        const d = lab.dom;
        d.deployForm.textContent = '';
        const ctor = constructorOf(compiled.abi);
        const plan = lab.scenarioPlan;
        const accountsSpec = (plan && plan.contas && plan.contas.length) ? plan.contas : defaultAccounts(compiled.abi);
        const fields = ctor.inputs.map((input, i) => {
            const id = 'labCtorArg' + i;
            const preset = plan && plan.implantacao && plan.implantacao.argumentos && plan.implantacao.argumentos[i];
            return el('label', { class: 'lab-field', for: id }, [
                el('span', { class: 'lab-field-name', text: (input.name || '#' + i) }),
                el('span', { class: 'lab-type', text: input.type }),
                el('input', { id, type: 'text', value: preset != null ? preset : defaultArg(input), 'data-index': String(i), spellcheck: 'false' })
            ]);
        });
        const accountsInput = el('input', { type: 'text', id: 'labAccountsInput', value: accountsSpec.map(a => a.nome).join(', '), spellcheck: 'false' });
        const deployAsSelect = el('select', { id: 'labDeployAs' }, accountsSpec.map(a => el('option', { value: a.nome, text: a.nome })));
        if (plan && plan.implantacao && plan.implantacao.conta) deployAsSelect.value = plan.implantacao.conta.replace(/^@/, '');
        accountsInput.addEventListener('change', () => {
            const names = accountsInput.value.split(',').map(s => s.trim()).filter(Boolean);
            deployAsSelect.textContent = '';
            names.forEach(n => deployAsSelect.appendChild(el('option', { value: n, text: n })));
        });
        const valueField = ctor.stateMutability === 'payable'
            ? el('label', { class: 'lab-field' }, [el('span', { class: 'lab-field-name', text: t('labValue') }), el('input', { id: 'labCtorValue', type: 'text', value: '0' })])
            : null;

        d.deployForm.appendChild(el('h4', { class: 'block-title', text: t('labDeployTitle') + ' — ' + compiled.name }));
        d.deployForm.appendChild(el('p', { class: 'muted small', text: t('labDeployHint') }));
        d.deployForm.appendChild(el('label', { class: 'lab-field' }, [el('span', { class: 'lab-field-name', text: t('labParticipants') }), accountsInput]));
        fields.forEach(f => d.deployForm.appendChild(f));
        if (valueField) d.deployForm.appendChild(valueField);
        d.deployForm.appendChild(el('div', { class: 'lab-inline' }, [
            el('span', { class: 'muted small', text: t('labDeployAs') }), deployAsSelect,
            el('button', { type: 'button', class: 'btn btn-ink', text: t('labDeploy'), onclick: () => doDeploy(compiled) })
        ]));
        d.deployForm.hidden = false;
    }

    async function doDeploy(compiled) {
        const d = lab.dom;
        clearStatus();
        try {
            const names = document.getElementById('labAccountsInput').value.split(',').map(s => s.trim()).filter(Boolean);
            const env = await newChain(names.map(n => ({ nome: n, saldoEther: '100' })));
            const args = Array.from(d.deployForm.querySelectorAll('input[data-index]')).map(i => i.value);
            const valueInput = document.getElementById('labCtorValue');
            const deploy = { conta: document.getElementById('labDeployAs').value, argumentos: args, valor: valueInput ? valueInput.value : '' };
            const res = await deployInto(env, compiled, deploy);
            lab.chain = env.chain;
            lab.accounts = env.accounts;
            lab.timeline = [];
            if (!res.ok) {
                lab.contract = null;
                setStatus(t('labDeployFailed', { error: describeRevert(res.error) }), 'error');
                return;
            }
            lab.contract = { name: compiled.name, abi: compiled.abi, bytecode: compiled.bytecode, address: res.address, enums: parseEnums(compiled.source || ''), source: compiled.source || '' };
            lab.timeline.push({ ok: true, actor: res.from.label, fn: 'constructor', value: 0n, gas: res.gasUsed, events: res.events || [], time: lab.chain.timestamp });
            setStatus(t('labDeployed', { name: compiled.name, address: shortAddr(res.address) }), 'ok');
            d.workspace.hidden = false;
            await renderWorkspace();
        } catch (e) {
            setStatus(t('labDeployFailed', { error: e.message }), 'error');
        }
    }

    async function renderAccounts() {
        const d = lab.dom;
        d.accounts.textContent = '';
        d.accounts.appendChild(el('h4', { class: 'block-title', text: t('labAccounts') }));
        const rows = [];
        for (const a of lab.accounts) {
            const bal = await lab.chain.balanceOf(a.address);
            rows.push(el('tr', {}, [
                el('th', { scope: 'row' }, [el('span', { class: 'party-mark', 'data-color': a.color }), a.label]),
                el('td', {}, [el('code', { title: a.address, text: shortAddr(a.address) })]),
                el('td', { class: 'num', text: formatEth(bal) + ' ETH' + approxBrl(bal) })
            ]));
        }
        if (lab.contract && lab.contract.address) {
            const bal = await lab.chain.balanceOf(lab.contract.address);
            rows.push(el('tr', { class: 'row-contract' }, [
                el('th', { scope: 'row', text: t('labContractRow') + ' ' + lab.contract.name }),
                el('td', {}, [el('code', { title: lab.contract.address, text: shortAddr(lab.contract.address) })]),
                el('td', { class: 'num', text: formatEth(bal) + ' ETH' + approxBrl(bal) })
            ]));
        }
        d.accounts.appendChild(el('table', { class: 'ledger compact' }, [el('tbody', {}, rows)]));
        d.accounts.querySelectorAll('.party-mark[data-color]').forEach(node => { node.style.backgroundColor = node.getAttribute('data-color'); });

        const date = new Date(Number(lab.chain.timestamp) * 1000);
        const fmt = date.toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
        const advance = secs => async () => { lab.chain.advanceTime(secs); await renderWorkspace(true); (lab.dueFills || []).forEach(f => f()); };
        d.accounts.appendChild(el('div', { class: 'clock' }, [
            el('p', {}, [el('span', { class: 'field-label', text: t('labClock') }), el('br'), el('span', { class: 'clock-date', text: fmt })]),
            el('div', { class: 'clock-buttons' }, [
                el('button', { type: 'button', class: 'link-btn', text: t('labDay'), onclick: advance(86400) }),
                el('button', { type: 'button', class: 'link-btn', text: t('labWeek'), onclick: advance(7 * 86400) }),
                el('button', { type: 'button', class: 'link-btn', text: t('labMonth'), onclick: advance(30 * 86400) }),
                el('button', { type: 'button', class: 'link-btn', text: t('labYear'), onclick: advance(365 * 86400) })
            ])
        ]));
    }

    /** Rótulo legível a partir do nome técnico (ALUGUEL_MULTA_BPS → "Aluguel multa (%)"). */
    function humanLabel(name) {
        let words;
        if (/^[A-Z0-9_]+$/.test(name)) words = name.toLowerCase().split('_');
        else words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
        const isBps = words[words.length - 1] === 'bps';
        if (isBps) words.pop();
        let label = words.filter(Boolean).join(' ');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        return isBps ? label + ' (%)' : label;
    }

    async function renderState() {
        const d = lab.dom;
        d.state.textContent = '';
        d.state.appendChild(el('h4', { class: 'block-title', text: t('labState') }));
        const getters = lab.contract.abi.filter(x => x.type === 'function' && (x.stateMutability === 'view' || x.stateMutability === 'pure') && x.inputs.length === 0);
        if (!getters.length) {
            d.state.appendChild(el('p', { class: 'muted small', text: t('labStateEmpty') }));
            return;
        }
        const owner = lab.accounts[0];
        const values = {};
        for (const g of getters) {
            const r = await lab.chain.call({ from: owner.address, to: lab.contract.address, abi: lab.contract.abi, functionName: g.name, args: [] });
            values[g.name] = r;
        }
        const dl = el('dl', { class: 'state-list' });
        const timeLike = /(prazo|periodo|tolerancia|atraso|vigencia|duracao|period|deadline|grace|delay|term|return)/i;
        for (const g of getters) {
            const r = values[g.name];
            let text;
            if (!r.ok) text = '⚠ ' + describeRevert(r.error);
            else {
                const v = Array.isArray(r.result) ? r.result : r.result;
                if (/_BPS$/i.test(g.name) && typeof v === 'bigint') text = (Number(v) / 100).toLocaleString(CSC.lang === 'en' ? 'en-US' : 'pt-BR') + '%';
                else if (typeof v === 'bigint' && v > 0n && v % 86400n === 0n && timeLike.test(g.name) && v < 10n ** 12n) text = formatDuration(v);
                else {
                    text = formatResult(r.result, g);
                    // "Parcelas pagas: 1 de 12", quando houver a constante correspondente.
                    const total = Object.keys(values).find(k => /_(PARCELAS|INSTALLMENTS|ETAPAS|MILESTONES)$/.test(k) && norm(g.name).startsWith(norm(k.split('_')[0])));
                    if (total && /(pagas|paid|aprovadas|approved)/i.test(g.name) && values[total].ok) text = t('stateOf', { a: String(v), b: String(values[total].result) });
                }
            }
            dl.appendChild(el('dt', {}, [el('span', { text: humanLabel(g.name) }), el('code', { class: 'state-raw', text: g.name })]));
            dl.appendChild(el('dd', { text }));
        }
        d.state.appendChild(dl);
    }

    // ---------- Explicação de cada função (botão "i") ----------
    function functionSource(source, name) {
        const re = new RegExp('\\bfunction\\s+' + name.replace(/[$]/g, '\\$') + '\\s*\\(');
        const m = re.exec(source);
        if (!m) return null;
        const open = source.indexOf('{', m.index);
        let depth = 0, end = open;
        for (let i = open; i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        return { start: m.index, header: source.slice(m.index, open), body: source.slice(open + 1, end) };
    }

    function natspecBefore(source, index) {
        const lines = source.slice(0, index).split('\n');
        lines.pop();
        const out = [];
        while (lines.length && /^\s*\/\/\//.test(lines[lines.length - 1])) out.unshift(lines.pop().replace(/^\s*\/\/\/\s?/, ''));
        return out.map(l => l.replace(/^@notice\s*/, '').replace(/^@dev\s*/, '').replace(/^@param\s+/, '')).filter(Boolean);
    }

    /** Seção de cláusula mais próxima acima da função (código gerado pelo montador). */
    function clauseBefore(source, index) {
        const before = source.slice(0, index);
        const re = /\/\/\s*((?:Cláusula|Clause)\s+\d+ª?\s+—\s+[^\n]+)\n((?:\s*\/\/\/[^\n]*\n)+)/g;
        let m, last = null;
        while ((m = re.exec(before)) !== null) last = m;
        if (!last) return null;
        return { title: last[1].trim(), text: last[2].split('\n').map(l => l.replace(/^\s*\/\/\/\s?/, '')).join(' ').replace(/\s+/g, ' ').trim() };
    }

    function roleLabelFromVar(v) {
        const acc = lab.accounts.find(a => norm(a.label) === norm(v));
        return acc ? acc.label : v;
    }

    function describeFunction(fnAbi) {
        const source = (lab.contract && lab.contract.source) || '';
        const f = functionSource(source, fnAbi.name);
        const isView = fnAbi.stateMutability === 'view' || fnAbi.stateMutability === 'pure';
        const info = { name: fnAbi.name, signature: fnAbi.name + '(' + fnAbi.inputs.map(i => i.type + (i.name ? ' ' + i.name : '')).join(', ') + ')' + (fnAbi.outputs && fnAbi.outputs.length ? ' → ' + fnAbi.outputs.map(o => o.type).join(', ') : ''), isView, payable: fnAbi.stateMutability === 'payable', who: [], status: null, guard: false, errors: [], events: [], notes: [], clause: null };
        if (!f) return info;
        info.notes = natspecBefore(source, f.start);
        info.clause = clauseBefore(source, f.start);
        const mods = (f.header.replace(/\breturns\s*\([^)]*\)/, '').match(/\b[A-Za-z_]\w*\s*(\([^)]*\))?/g) || []).map(x => x.trim());
        const errs = new Set();
        for (const m of mods) {
            const name = m.replace(/\(.*$/, '');
            if (/^(public|external|internal|private|view|pure|payable|virtual|override|function)$/.test(name) || name === fnAbi.name) continue;
            const def = new RegExp('modifier\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}').exec(source);
            if (!def) continue;
            const senders = (def[1].match(/msg\.sender\s*!=\s*(\w+)/g) || []).map(x => x.replace(/msg\.sender\s*!=\s*/, ''));
            if (senders.length) info.who.push(...senders.map(roleLabelFromVar));
            const st = /\((\w+)\.(\w+)\)/.exec(m);
            if (st && /situacao|status|naSituacao|inStatus/i.test(def[1] + name)) info.status = st[2];
            if (/nonReentrant/i.test(name)) info.guard = true;
            (def[1].match(/revert\s+(\w+)\s*\(/g) || []).forEach(x => errs.add(x.replace(/revert\s+|\s*\(/g, '')));
        }
        (f.body.match(/revert\s+(\w+)\s*\(/g) || []).forEach(x => errs.add(x.replace(/revert\s+|\s*\(/g, '')));
        // Erros de funções privadas chamadas pela função (um nível).
        (f.body.match(/\b(_\w+)\s*\(/g) || []).forEach(call => {
            const inner = functionSource(source, call.replace(/\s*\($/, ''));
            if (inner) (inner.body.match(/revert\s+(\w+)\s*\(/g) || []).forEach(x => errs.add(x.replace(/revert\s+|\s*\(/g, '')));
        });
        info.errors = Array.from(errs);
        info.events = Array.from(new Set((f.body.match(/emit\s+(\w+)/g) || []).map(x => x.replace(/emit\s+/, ''))));
        info.anyone = !info.who.length && /msg\.sender/.test(f.body);
        return info;
    }

    let infoDialog = null;
    function showFunctionInfo(fnAbi) {
        const info = describeFunction(fnAbi);
        if (!infoDialog) {
            infoDialog = el('dialog', { class: 'fn-dialog', 'aria-labelledby': 'fnDialogTitle' });
            document.body.appendChild(infoDialog);
            infoDialog.addEventListener('click', e => { if (e.target === infoDialog) infoDialog.close(); });
        }
        infoDialog.textContent = '';
        const section = (title, content) => el('section', {}, [el('h4', { class: 'field-label', text: title }), ...[].concat(content)]);
        const errDesc = name => { const k = 'errDesc_' + name; const d = t(k); return d === k ? name : d; };
        const who = info.isView ? t('fnInfoAnyoneRead') : info.who.length ? Array.from(new Set(info.who)).join(CSC.lang === 'en' ? ' or ' : ' ou ') : info.anyone ? t('fnInfoAnyone') : t('fnInfoAnyone');
        const when = [info.status ? t('fnInfoStatus', { s: info.status }) : t('fnInfoAlways')];
        if (info.guard) when.push(t('fnInfoGuard'));
        infoDialog.append(
            el('header', { class: 'fn-dialog-head' }, [
                el('p', { class: 'field-label', text: t('fnInfoTitle') }),
                el('h3', { id: 'fnDialogTitle', class: 'fn-dialog-title' }, [el('code', { text: info.name })]),
                el('button', { type: 'button', class: 'icon-btn fn-dialog-close', 'aria-label': t('fnInfoClose'), text: '×', onclick: () => infoDialog.close() })
            ]),
            info.clause ? section(t('fnInfoClause'), [el('p', { class: 'fn-dialog-clause' }, [el('strong', { text: info.clause.title + '. ' }), info.clause.text])]) : null,
            info.notes.length ? section(t('fnInfoWhat'), info.notes.map(n => el('p', { text: n }))) : null,
            section(t('fnInfoWho'), el('p', { text: who })),
            section(t('fnInfoMoney'), el('p', { text: info.isView ? t('fnInfoView') : info.payable ? t('fnInfoPayable') : t('fnInfoNoPayable') })),
            info.isView ? null : section(t('fnInfoWhen'), when.map(w => el('p', { text: w }))),
            info.isView ? null : section(t('fnInfoErrors'), info.errors.length ? el('ul', {}, info.errors.map(e => el('li', {}, [el('code', { text: e }), ': ' + errDesc(e)]))) : el('p', { text: t('fnInfoNoErrors') })),
            info.events.length ? section(t('fnInfoEvents'), el('p', {}, info.events.map((e, i) => el('code', { text: (i ? ', ' : '') + e })))) : null,
            section(t('fnInfoSignature'), el('p', {}, [el('code', { text: info.signature })]))
        );
        infoDialog.showModal();
    }

    /** Função de consulta que informa quanto uma função "payable" deve receber. */
    function dueGetter(fn) {
        const views = lab.contract.abi.filter(x => x.type === 'function' && (x.stateMutability === 'view' || x.stateMutability === 'pure') && x.inputs.length === 0).map(x => x.name);
        const has = n => views.find(v => v.toLowerCase() === n.toLowerCase());
        const rest = fn.name.replace(/^(pagar|pay|quitar|repay|depositar|deposit|fund|liberar|disburse)/i, '');
        const U = rest.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
        const cands = /^(quitar|repay)/i.test(fn.name)
            ? ['saldoDevedor' + rest, 'outstanding' + rest, 'saldoDevedor', 'outstandingBalance']
            : ['valorDevido' + rest, 'amountDue' + rest, U + '_VALOR', U + '_AMOUNT', U + '_VALOR_TOTAL', U + '_TOTAL',
                'valorDevido', 'amountDue', 'valor' + rest, rest ? rest.charAt(0).toLowerCase() + rest.slice(1) : '', 'preco', 'price', 'valorTotal', 'totalAmount', 'valorEmprestimo', 'loanAmount', 'valorAluguel', 'rent', 'installmentAmount'];
        for (const c of cands) { const v = c && has(c); if (v) return v; }
        return null;
    }

    async function fillDue(fn, input, output) {
        const getter = dueGetter(fn);
        if (!getter) return;
        const r = await lab.chain.call({ from: lab.accounts[0].address, to: lab.contract.address, abi: lab.contract.abi, functionName: getter, args: [] });
        if (!r.ok) return;
        const wei = BigInt(Array.isArray(r.result) ? r.result[0] : r.result);
        input.value = window.EvmLab.formatEther(wei);
        input.title = moneyText(wei);
        if (output) { output.className = 'fn-output'; output.textContent = t('labDueFilled', { v: moneyText(wei) }); }
    }

    function renderFunctions() {
        const d = lab.dom;
        d.functions.textContent = '';
        d.functions.appendChild(el('h4', { class: 'block-title', text: t('labFunctions') }));
        d.functions.appendChild(el('p', { class: 'muted small', text: t('labFunctionsHint') }));
        const fns = lab.contract.abi.filter(x => x.type === 'function' && !((x.stateMutability === 'view' || x.stateMutability === 'pure') && x.inputs.length === 0));
        lab.dueFills = [];
        const grid = el('div', { class: 'fn-grid' });
        for (const fn of fns) {
            const isView = fn.stateMutability === 'view' || fn.stateMutability === 'pure';
            const isPayable = fn.stateMutability === 'payable';
            const inputs = fn.inputs.map((input, i) => el('label', { class: 'lab-field' }, [
                el('span', { class: 'lab-field-name', text: input.name || '#' + i }),
                el('span', { class: 'lab-type', text: input.type }),
                el('input', { type: 'text', 'data-arg': String(i), placeholder: defaultArg(input), spellcheck: 'false' })
            ]));
            const asSelect = el('select', { class: 'fn-as' }, lab.accounts.map(a => el('option', { value: a.label, text: a.label })));
            // Pré-seleciona a parte autorizada pela própria função.
            try {
                const info = describeFunction(fn);
                const who = info.who && info.who[0] && accountByName(info.who[0]);
                if (who) asSelect.value = who.label;
            } catch (_) { /* mantém o padrão */ }
            const valueInput = isPayable ? el('input', { type: 'text', class: 'fn-value', value: '0', 'aria-label': t('labValue') }) : null;
            const dueLink = isPayable && dueGetter(fn) ? el('button', { type: 'button', class: 'link-btn due-link', text: t('labDueFill') }) : null;
            const output = el('div', { class: 'fn-output', role: 'status', 'aria-live': 'polite' });
            const card = el('div', { class: 'fn-card' + (isPayable ? ' fn-payable' : '') + (isView ? ' fn-view' : '') }, [
                el('div', { class: 'fn-head' }, [
                    el('code', { class: 'fn-name', text: fn.name }),
                    el('button', { type: 'button', class: 'info-btn', title: t('fnInfoButton'), 'aria-label': t('fnInfoButton') + ': ' + fn.name, text: 'i', onclick: () => showFunctionInfo(fn) }),
                    isPayable ? el('span', { class: 'tag tag-payable', text: 'payable' }) : null,
                    isView ? el('span', { class: 'tag tag-view', text: fn.stateMutability }) : null
                ]),
                ...inputs,
                el('div', { class: 'lab-inline' }, [
                    el('span', { class: 'muted small', text: t('labCallAs') }), asSelect,
                    valueInput ? el('span', { class: 'muted small', text: t('labValue') }) : null, valueInput, dueLink,
                    el('button', {
                        type: 'button', class: 'btn ' + (isView ? 'btn-quiet' : 'btn-ink'), text: isView ? t('labQuery') : t('labExecute'),
                        onclick: async () => {
                            output.textContent = '';
                            try {
                                const args = fn.inputs.map((input, i) => {
                                    const field = card.querySelector('input[data-arg="' + i + '"]');
                                    return parseArg(field.value || field.placeholder, input);
                                });
                                const value = valueInput ? parseAmount(valueInput.value || '0', 'ether') : 0n;
                                const actor = accountByName(asSelect.value);
                                const r = await lab.chain.call({ from: actor.address, to: lab.contract.address, abi: lab.contract.abi, functionName: fn.name, args, value });
                                if (isView) {
                                    output.className = 'fn-output ' + (r.ok ? 'ok' : 'err');
                                    output.textContent = r.ok ? t('labResult') + ': ' + formatResult(r.result, fn) : '✗ ' + describeRevert(r.error);
                                    return;
                                }
                                lab.timeline.unshift({ ok: r.ok, actor: actor.label, fn: fn.name, args, value, gas: r.gasUsed, events: r.events || [], error: r.error, time: lab.chain.timestamp });
                                output.className = 'fn-output ' + (r.ok ? 'ok' : 'err');
                                output.textContent = r.ok ? '✓ ' + t('labTxOk') : '✗ ' + t('labTxReverted') + ': ' + describeRevert(r.error);
                                await renderWorkspace(true);
                            } catch (e) {
                                output.className = 'fn-output err';
                                output.textContent = '⚠ ' + e.message;
                            }
                        }
                    })
                ]),
                output
            ]);
            if (dueLink) {
                dueLink.addEventListener('click', () => fillDue(fn, valueInput, output));
                const refill = () => fillDue(fn, valueInput, null);
                lab.dueFills.push(refill);
                refill();
            }
            grid.appendChild(card);
        }
        d.functions.appendChild(grid);
    }

    function renderTimeline() {
        const d = lab.dom;
        d.timeline.textContent = '';
        d.timeline.appendChild(el('h4', { class: 'block-title', text: t('labTimeline') }));
        if (!lab.timeline.length) {
            d.timeline.appendChild(el('p', { class: 'muted small', text: t('labTimelineEmpty') }));
            return;
        }
        const list = el('ol', { class: 'timeline', reversed: true });
        for (const tx of lab.timeline) {
            const date = new Date(Number(tx.time) * 1000).toLocaleDateString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { timeZone: 'UTC' });
            const head = el('div', { class: 'tx-head' }, [
                el('span', { class: 'tx-icon', text: tx.ok ? '✓' : '✗' }),
                el('strong', { text: tx.actor }),
                el('span', { text: ' → ' }),
                el('code', { text: tx.fn + '(' + (tx.args || []).map(a => formatValue(a)).join(', ') + ')' }),
                tx.value ? el('span', { class: 'tag tag-payable', text: formatEth(tx.value) + ' ETH' }) : null,
                el('span', { class: 'muted small tx-meta', text: date + ' · ' + String(tx.gas || 0n) + ' ' + t('labGas') })
            ]);
            const body = [];
            if (!tx.ok) {
                body.push(el('p', { class: 'tx-revert', text: t('labTxReverted') + ': ' + describeRevert(tx.error) }));
                body.push(el('p', { class: 'muted small', text: t('labRevertExplain') }));
            }
            if (tx.events && tx.events.length) {
                body.push(el('ul', { class: 'tx-events' }, tx.events.map(ev => el('li', {}, [
                    el('span', { class: 'tag tag-event', text: ev.name }),
                    el('span', { class: 'small', text: ' ' + Object.entries(ev.args || {}).map(([k, v]) => k + ': ' + formatValue(v)).join(' · ') })
                ]))));
            }
            list.appendChild(el('li', { class: 'tx ' + (tx.ok ? 'tx-ok' : 'tx-err') }, [head].concat(body)));
        }
        d.timeline.appendChild(list);
    }

    async function renderWorkspace(keepFunctions) {
        await renderAccounts();
        await renderState();
        if (!keepFunctions) renderFunctions();
        renderTimeline();
    }

    function setStatus(text, kind) {
        const s = lab.dom.status;
        s.textContent = text;
        s.className = 'status-line ' + (kind === 'ok' ? 'status-ok' : kind === 'error' ? 'status-error' : '');
        s.hidden = !text;
    }
    function clearStatus() { setStatus('', ''); }

    // ---------- Cenários de teste ----------
    function abiSummary(abi) {
        const sig = x => x.name + '(' + (x.inputs || []).map(i => i.type + ' ' + (i.name || '')).join(', ') + ')';
        const lines = [];
        const ctor = constructorOf(abi);
        lines.push('constructor(' + ctor.inputs.map(i => i.type + ' ' + i.name).join(', ') + ')' + (ctor.stateMutability === 'payable' ? ' payable' : ''));
        for (const x of abi.filter(a => a.type === 'function')) {
            lines.push('function ' + sig(x) + ' ' + x.stateMutability + (x.outputs && x.outputs.length ? ' returns (' + x.outputs.map(o => o.type).join(', ') + ')' : ''));
        }
        for (const x of abi.filter(a => a.type === 'error')) lines.push('error ' + sig(x));
        for (const x of abi.filter(a => a.type === 'event')) lines.push('event ' + sig(x));
        return lines.join('\n');
    }

    function compareExpected(result, expected, fnAbi) {
        if (expected == null || String(expected).trim() === '') return { ok: true };
        const out = (fnAbi.outputs || [])[0];
        const got = Array.isArray(result) ? result[0] : result;
        let ok = false;
        try {
            if (out) {
                const parsed = parseArg(String(expected), out);
                ok = typeof parsed === 'string' && typeof got === 'string' ? parsed.toLowerCase() === got.toLowerCase() : String(parsed) === String(got);
            }
        } catch (_) { /* compara como texto abaixo */ }
        if (!ok) {
            const g = norm(formatValue(got, out));
            ok = g === norm(expected) || g.startsWith(norm(expected));
        }
        return { ok, got: formatValue(got, out) };
    }

    async function runScenario(plan, scenario, compiled) {
        const steps = [];
        const env = await newChain(plan.contas);
        let ensured = env.accounts;
        // Garante a presença do Atacante.
        if (!ensured.some(a => /^(atacante|attacker)$/.test(norm(a.label)))) {
            const acc = await env.chain.addAccount(CSC.lang === 'en' ? 'Attacker' : 'Atacante', '100');
            acc.color = ACCOUNT_COLORS[ensured.length % ACCOUNT_COLORS.length];
            ensured.push(acc);
        }
        const dep = await deployInto(env, compiled, plan.implantacao);
        if (!dep.ok) {
            return { status: 'invalid', steps: [{ status: 'invalid', text: 'constructor', note: t('labDeployFailed', { error: describeRevert(dep.error) }) }] };
        }
        const saved = { accounts: lab.accounts, contract: lab.contract };
        lab.accounts = env.accounts;
        lab.contract = { name: compiled.name, abi: compiled.abi, address: dep.address, enums: parseEnums(compiled.source || '') };
        let status = 'pass';
        try {
            for (const step of scenario.passos || []) {
                const entry = { explicacao: step.explicacao || '' };
                try {
                    if (step.acao === 'verificarSolvencia') {
                        // Saldo do contrato = créditos das partes + valores retidos.
                        const bal = await env.chain.balanceOf(dep.address);
                        let credits = 0n;
                        for (const acc of env.accounts) {
                            const r = await env.chain.call({ from: acc.address, to: dep.address, abi: compiled.abi, functionName: step.saldos, args: [acc.address] });
                            if (r.ok) credits += BigInt(r.result);
                        }
                        const h = await env.chain.call({ from: env.accounts[0].address, to: dep.address, abi: compiled.abi, functionName: step.retido, args: [] });
                        const held = h.ok ? BigInt(h.result) : 0n;
                        const ok = bal === credits + held;
                        entry.status = ok ? 'pass' : 'fail';
                        entry.text = t(ok ? 'labSolvencyOk' : 'labSolvencyFail', { bal: formatEth(bal, 6), cred: formatEth(credits, 6), held: formatEth(held, 6) });
                        steps.push(entry);
                        if (!ok) status = 'fail';
                        continue;
                    }
                    if (step.acao === 'atacarTodas') {
                        const attackerAcc = accountByName(step.conta);
                        const ignore = new Set(step.ignorar || []);
                        const fns = compiled.abi.filter(x => x.type === 'function' && x.stateMutability !== 'view' && x.stateMutability !== 'pure' && !ignore.has(x.name));
                        for (const fn of fns) {
                            const args = fn.inputs.map(i => /^u?int/.test(i.type) ? 1n : i.type === 'bool' ? true : i.type === 'string' ? 'x' : /^address/.test(i.type) ? attackerAcc.address : /^bytes/.test(i.type) ? '0x' : 0n);
                            const r = await env.chain.call({ from: attackerAcc.address, to: dep.address, abi: compiled.abi, functionName: fn.name, args });
                            const ok = !r.ok && sameError(r.error, step.erroEsperado);
                            const sub = { explicacao: '', text: attackerAcc.label + ' → ' + fn.name + '()', expected: t('labStepExpectedRevert'),
                                outcome: r.ok ? '✓ ' + t('labTxOk') : '✗ ' + t('labTxReverted') + ': ' + describeRevert(r.error), status: ok ? 'pass' : 'fail' };
                            if (!ok) sub.note = r.ok ? t('labVulnerability') : t('labWrongError', { got: describeRevert(r.error), expected: step.erroEsperado });
                            steps.push(sub);
                            if (!ok) status = 'fail';
                        }
                        continue;
                    }
                    if (step.acao === 'avancarTempo') {
                        const secs = parseAmount(step.segundos || '0', 'seconds');
                        env.chain.advanceTime(secs);
                        entry.status = 'pass';
                        entry.text = t('labStepAdvance', { time: formatDuration(secs) });
                        steps.push(entry);
                        continue;
                    }
                    const fnAbi = compiled.abi.find(x => x.type === 'function' && x.name === step.funcao && (x.inputs || []).length === (step.argumentos || []).length)
                        || compiled.abi.find(x => x.type === 'function' && x.name === step.funcao);
                    if (!fnAbi) throw new Error(t('labUnknownFunction', { name: step.funcao }));
                    const actor = accountByName(step.conta || env.accounts[0].label);
                    if (!actor) throw new Error(t('labUnknownAccount', { name: step.conta }));
                    const args = fnAbi.inputs.map((input, i) => parseArg((step.argumentos || [])[i] ?? '', input));
                    let value = 0n;
                    if (step.valor && /^=/.test(String(step.valor).trim())) {
                        // Valor obtido de uma função de consulta (ex.: "=valorDevido").
                        const viewName = String(step.valor).trim().slice(1);
                        const q = await env.chain.call({ from: actor.address, to: dep.address, abi: compiled.abi, functionName: viewName, args: [] });
                        if (!q.ok) throw new Error(t('labUnknownFunction', { name: viewName }));
                        value = BigInt(Array.isArray(q.result) ? q.result[0] : q.result);
                    } else if (step.valor) {
                        value = parseAmount(step.valor, /^\d+$/.test(String(step.valor).trim()) ? 'wei' : 'ether');
                    }
                    entry.text = actor.label + ' → ' + fnAbi.name + '(' + args.map(a => formatValue(a)).join(', ') + ')' + (value ? ' + ' + formatEth(value) + ' ETH' : '');
                    const r = await env.chain.call({ from: actor.address, to: dep.address, abi: compiled.abi, functionName: fnAbi.name, args, value });
                    const expectRevert = step.esperado === 'reverter';
                    entry.expected = expectRevert ? t('labStepExpectedRevert') : t('labStepExpectedSuccess');
                    entry.outcome = r.ok ? '✓ ' + t('labTxOk') + (step.acao === 'consultar' ? ': ' + formatResult(r.result, fnAbi) : '') : '✗ ' + t('labTxReverted') + ': ' + describeRevert(r.error);
                    entry.events = r.events || [];
                    if (expectRevert && r.ok) {
                        entry.status = 'fail';
                        entry.note = t('labVulnerability');
                    } else if (!expectRevert && !r.ok) {
                        entry.status = 'fail';
                        entry.note = t('labFunctionalFailure');
                    } else if (expectRevert && !r.ok && !sameError(r.error, step.erroEsperado)) {
                        entry.status = 'warn';
                        entry.note = t('labWrongError', { got: describeRevert(r.error), expected: step.erroEsperado });
                    } else if (r.ok && step.acao === 'consultar' && step.resultadoEsperado) {
                        const cmp = compareExpected(r.result, step.resultadoEsperado, fnAbi);
                        entry.status = cmp.ok ? 'pass' : 'fail';
                        if (!cmp.ok) entry.note = t('labWrongResult', { got: cmp.got, expected: step.resultadoEsperado });
                    } else {
                        entry.status = 'pass';
                    }
                } catch (e) {
                    entry.status = 'invalid';
                    entry.text = entry.text || ((step.conta || '?') + ' → ' + (step.funcao || step.acao));
                    entry.note = t('labInvalidStep', { msg: e.message });
                }
                steps.push(entry);
                if (entry.status === 'fail') status = 'fail';
                else if (entry.status === 'invalid' && status === 'pass') status = 'invalid';
            }
        } finally {
            lab.accounts = saved.accounts;
            lab.contract = saved.contract;
        }
        return { status, steps };
    }

    function renderScenarioResults() {
        const d = lab.dom;
        const results = lab.scenarioResults;
        d.scenarios.textContent = '';
        if (!results) return;
        const total = results.length;
        const pass = results.filter(r => r.result.status === 'pass').length;
        const fail = results.filter(r => r.result.status === 'fail').length;
        const invalid = results.filter(r => r.result.status === 'invalid').length;
        const pct = total ? Math.round(pass / total * 100) : 0;

        const bar = el('div', { class: 'score-bar', role: 'img', 'aria-label': t('labSummary', { pass, total }) }, [
            el('span', { class: 'score-pass', 'data-w': String(total ? pass / total * 100 : 0) }),
            el('span', { class: 'score-fail', 'data-w': String(total ? fail / total * 100 : 0) }),
            el('span', { class: 'score-invalid', 'data-w': String(total ? invalid / total * 100 : 0) })
        ]);
        bar.querySelectorAll('[data-w]').forEach(s => { s.style.width = s.getAttribute('data-w') + '%'; });

        d.scenarios.appendChild(el('div', { class: 'score' }, [
            el('div', { class: 'score-number', text: pct + '%' }),
            el('div', { class: 'score-text' }, [
                el('strong', { text: t('labSummary', { pass, total }) }),
                el('span', { class: 'muted small', text: t('labSummaryDetail', { fail, invalid }) }),
                bar
            ])
        ]));

        for (const { scenario, result } of results) {
            const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '?';
            const label = result.status === 'pass' ? t('labPassed') : result.status === 'fail' ? t('labFailed') : t('labInvalid');
            const details = el('details', { class: 'scenario scenario-' + result.status, open: result.status === 'fail' ? true : null }, [
                el('summary', {}, [
                    el('span', { class: 'scenario-icon', text: icon }),
                    el('span', { class: 'tag ' + (scenario.tipo === 'seguranca' ? 'tag-security' : 'tag-functional'), text: scenario.tipo === 'seguranca' ? t('labTypeSecurity') : t('labTypeFunctional') }),
                    el('strong', { class: 'scenario-title', text: scenario.titulo }),
                    el('span', { class: 'scenario-status', text: label })
                ]),
                el('p', { class: 'scenario-goal', text: scenario.objetivo }),
                el('ol', { class: 'steps' }, result.steps.map(s => el('li', { class: 'step-' + s.status }, [
                    el('div', { class: 'step-line' }, [
                        el('span', { class: 'step-icon', text: s.status === 'pass' ? '✓' : s.status === 'fail' ? '✗' : s.status === 'warn' ? '!' : '?' }),
                        el('code', { text: s.text || '' }),
                        s.expected ? el('span', { class: 'muted small', text: ' · ' + s.expected }) : null
                    ]),
                    s.outcome ? el('div', { class: 'small step-outcome', text: s.outcome }) : null,
                    s.events && s.events.length ? el('div', { class: 'small' }, s.events.map(ev => el('span', { class: 'tag tag-event', text: ev.name }))) : null,
                    s.note ? el('div', { class: 'small step-note', text: s.note }) : null,
                    s.explicacao ? el('div', { class: 'muted small', text: s.explicacao }) : null
                ])))
            ]);
            d.scenarios.appendChild(details);
        }
        d.scenarioActions.hidden = false;
        d.fixFromTests.hidden = fail === 0;
    }

    /** Texto com as falhas, para a correção por IA. */
    function failuresText() {
        if (!lab.scenarioResults) return '';
        const lines = [];
        for (const { scenario, result } of lab.scenarioResults) {
            if (result.status !== 'fail') continue;
            lines.push('Cenário: ' + scenario.titulo + ' (' + scenario.tipo + ') — ' + scenario.objetivo);
            for (const s of result.steps) {
                if (s.status === 'fail') lines.push('  - ' + s.text + ' | ' + (s.expected || '') + ' | obtido: ' + (s.outcome || '') + ' | ' + (s.note || ''));
            }
        }
        return lines.join('\n');
    }

    async function runAllScenarios(plan, compiled, onProgress) {
        const results = [];
        const list = plan.cenarios || [];
        for (let i = 0; i < list.length; i++) {
            if (onProgress) onProgress(i + 1, list.length);
            let result;
            try {
                result = await runScenario(plan, list[i], compiled);
            } catch (e) {
                result = { status: 'invalid', steps: [{ status: 'invalid', text: '', note: t('labInvalidStep', { msg: e.message }) }] };
            }
            results.push({ scenario: list[i], result });
        }
        return results;
    }

    // ---------- API pública ----------
    CSC.lab = {
        init(dom) { lab.dom = dom; },
        reset() {
            lab.chain = null;
            lab.contract = null;
            lab.accounts = [];
            lab.timeline = [];
            lab.scenarioPlan = null;
            lab.scenarioResults = null;
            if (lab.dom.workspace) {
                lab.dom.workspace.hidden = true;
                lab.dom.deployForm.hidden = true;
                lab.dom.scenarios.textContent = '';
                lab.dom.scenarioActions.hidden = true;
                clearStatus();
            }
        },
        pickContract,
        abiSummary,
        failuresText,
        setStatus,
        hasPlan: () => !!lab.scenarioPlan,
        /** Prepara a implantação interativa do contrato compilado. */
        timelineForReport() {
            return lab.timeline.slice().reverse().map(tx => {
                const date = new Date(Number(tx.time) * 1000).toLocaleDateString(CSC.lang === 'en' ? 'en-US' : 'pt-BR', { timeZone: 'UTC' });
                return date + ' — ' + tx.actor + ' → ' + tx.fn + '(' + (tx.args || []).map(a => formatValue(a)).join(', ') + ')' + (tx.value ? ' + ' + moneyText(tx.value) : '') + ': ' + (tx.ok ? t('labTxOk') : t('labTxReverted') + ' — ' + describeRevert(tx.error));
            });
        },
        setScale(scale) { contractScale = scale > 0 ? Number(scale) : null; },
        prepare(compiled, plan) {
            if (plan) lab.scenarioPlan = plan;
            lab.dom.workspace.hidden = true;
            renderDeployForm(compiled);
        },
        async runPlan(plan, compiled, onProgress) {
            lab.scenarioPlan = plan;
            const intro = document.getElementById('labScenariosIntro');
            if (intro) intro.textContent = t(plan.origem === 'modelo' ? 'labScenariosIntroTemplate' : 'labScenariosIntro');
            lab.scenarioResults = await runAllScenarios(plan, compiled, onProgress);
            renderScenarioResults();
            return lab.scenarioResults;
        },
        async rerun(compiled, onProgress) {
            if (!lab.scenarioPlan) return null;
            return this.runPlan(lab.scenarioPlan, compiled, onProgress);
        },
        rerender() {
            if (lab.scenarioResults) renderScenarioResults();
            if (lab.chain && lab.contract && !lab.dom.workspace.hidden) renderWorkspace();
        },
        summaryForReport() {
            if (!lab.scenarioResults) return null;
            return lab.scenarioResults.map(({ scenario, result }) => ({
                titulo: scenario.titulo, tipo: scenario.tipo, status: result.status,
                passos: result.steps.map(s => ({ status: s.status, texto: s.text, resultado: s.outcome, nota: s.note }))
            }));
        },
        _internals: { parseArg, parseAmount, describeRevert, runScenario, describeFunction, setContract: c => { lab.contract = c; lab.accounts = c.accounts || []; } }
    };
})();
