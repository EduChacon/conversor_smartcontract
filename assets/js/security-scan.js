/*
 * Verificador estático (heurístico) de segurança para código Solidity.
 *
 * Executa inteiramente no navegador, sem IA e sem rede. Não substitui
 * ferramentas como Slither/Mythril nem auditoria profissional: serve para
 * apontar, de forma determinística, padrões reconhecidamente perigosos no
 * esqueleto gerado. As referências SWC remetem ao "Smart Contract Weakness
 * Classification Registry" (https://swcregistry.io).
 *
 * Funciona como script clássico no navegador (window.SecurityScan) e como
 * módulo CommonJS no Node (para os testes em tests/).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SecurityScan = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 };

    // Textos de cada regra, em português e inglês.
    const RULES = {
        'no-pragma': {
            severity: 'medium', swc: 'SWC-103',
            pt: ['Declaração "pragma solidity" ausente', 'Sem a declaração de versão, o contrato pode ser compilado com versão incompatível ou insegura.', 'Declare uma versão fixa, por exemplo "pragma solidity 0.8.28;".'],
            en: ['Missing "pragma solidity" declaration', 'Without a version declaration the contract may be compiled with an incompatible or unsafe compiler.', 'Declare a fixed version, e.g. "pragma solidity 0.8.28;".']
        },
        'old-compiler': {
            severity: 'high', swc: 'SWC-101 / SWC-102',
            pt: ['Versão do compilador anterior à 0.8.0', 'Versões anteriores à 0.8.0 não verificam estouro aritmético ("overflow"/"underflow") e contêm defeitos conhecidos.', 'Use Solidity 0.8.x recente, com versão fixa.'],
            en: ['Compiler version older than 0.8.0', 'Versions before 0.8.0 do not check arithmetic overflow/underflow and contain known bugs.', 'Use a recent, pinned Solidity 0.8.x.']
        },
        'floating-pragma': {
            severity: 'low', swc: 'SWC-103',
            pt: ['"pragma" flutuante', 'Faixas de versão ("^", ">=") permitem implantar com compilador diferente do testado.', 'Fixe a versão exata antes da implantação (ex.: "pragma solidity 0.8.28;").'],
            en: ['Floating pragma', 'Version ranges ("^", ">=") allow deploying with a compiler other than the tested one.', 'Pin the exact version before deployment (e.g. "pragma solidity 0.8.28;").']
        },
        'no-spdx': {
            severity: 'info', swc: null,
            pt: ['Identificador de licença SPDX ausente', 'O compilador emite aviso quando falta o comentário "SPDX-License-Identifier".', 'Inclua, na primeira linha, "// SPDX-License-Identifier: UNLICENSED" (ou a licença adequada).'],
            en: ['Missing SPDX license identifier', 'The compiler warns when the "SPDX-License-Identifier" comment is missing.', 'Add "// SPDX-License-Identifier: UNLICENSED" (or the proper license) on the first line.']
        },
        'tx-origin': {
            severity: 'high', swc: 'SWC-115',
            pt: ['Uso de "tx.origin"', '"tx.origin" para autorização permite ataques de "phishing": um contrato intermediário pode agir em nome da vítima.', 'Use "msg.sender" para controle de acesso.'],
            en: ['Use of "tx.origin"', 'Authorizing with "tx.origin" enables phishing attacks through an intermediary contract.', 'Use "msg.sender" for access control.']
        },
        'selfdestruct': {
            severity: 'high', swc: 'SWC-106',
            pt: ['Uso de "selfdestruct"', '"selfdestruct" está obsoleto (EIP-6780) e, se acessível indevidamente, permite retirar todo o saldo do contrato.', 'Remova "selfdestruct"; preveja encerramento por máquina de estados e saque controlado.'],
            en: ['Use of "selfdestruct"', '"selfdestruct" is deprecated (EIP-6780) and, if reachable, lets an attacker drain the contract.', 'Remove "selfdestruct"; model termination with a state machine and controlled withdrawals.']
        },
        'delegatecall': {
            severity: 'high', swc: 'SWC-112',
            pt: ['Uso de "delegatecall"', '"delegatecall" executa código externo com o armazenamento deste contrato; destino não confiável permite tomada total do contrato.', 'Evite "delegatecall" em esqueletos; se indispensável, restrinja o destino a endereço fixo e auditado.'],
            en: ['Use of "delegatecall"', '"delegatecall" runs external code against this contract\'s storage; an untrusted target allows full takeover.', 'Avoid "delegatecall"; if unavoidable, restrict the target to a fixed, audited address.']
        },
        'assembly': {
            severity: 'medium', swc: null,
            pt: ['Bloco "assembly"', 'Código "assembly" contorna as verificações de segurança do compilador.', 'Substitua por Solidity de alto nível, salvo necessidade comprovada e revisão especializada.'],
            en: ['Inline "assembly" block', 'Assembly bypasses the compiler\'s safety checks.', 'Replace with high-level Solidity unless strictly needed and expert-reviewed.']
        },
        'transfer-send': {
            severity: 'medium', swc: 'SWC-134',
            pt: ['Envio de Ether com "transfer" ou "send"', '"transfer"/"send" repassam apenas 2300 de gás e podem falhar com carteiras de contrato (ex.: "multisig"), travando o fluxo de pagamento.', 'Use o padrão de saque ("pull payment"): registre o crédito e permita que o credor saque com "call{value: ...}", verificando o retorno e protegendo contra reentrância.'],
            en: ['Ether sent with "transfer" or "send"', '"transfer"/"send" forward only 2300 gas and may fail with smart-contract wallets, blocking payments.', 'Use the pull-payment pattern: credit balances and let the payee withdraw with "call{value: ...}", checking the result and guarding against reentrancy.']
        },
        'unchecked-call': {
            severity: 'high', swc: 'SWC-104',
            pt: ['Retorno de chamada de baixo nível não verificado', 'Se ".call" falhar e o retorno não for verificado, o contrato prossegue como se o pagamento tivesse ocorrido.', 'Capture o retorno, ex.: "(bool ok, ) = destino.call{value: v}(\\"\\"); if (!ok) revert FalhaNoEnvio();".'],
            en: ['Unchecked low-level call return value', 'If ".call" fails and the result is ignored, execution continues as if the payment succeeded.', 'Capture and check it, e.g. "(bool ok, ) = to.call{value: v}(\\"\\"); if (!ok) revert TransferFailed();".']
        },
        'reentrancy-guard': {
            severity: 'medium', swc: 'SWC-107',
            pt: ['Chamada externa sem proteção contra reentrância', 'A função envia valor ou chama outro contrato sem modificador de trava (ex.: "nonReentrant").', 'Aplique uma trava de reentrância e o padrão "checks-effects-interactions".'],
            en: ['External call without reentrancy guard', 'The function sends value or calls another contract without a lock modifier (e.g. "nonReentrant").', 'Add a reentrancy lock and follow checks-effects-interactions.']
        },
        'cei-violation': {
            severity: 'high', swc: 'SWC-107',
            pt: ['Estado alterado depois de chamada externa', 'A variável de estado é modificada após a chamada externa, o que viola o padrão "checks-effects-interactions" e abre espaço para reentrância.', 'Atualize o estado (ex.: zerar o saldo) antes de transferir valores.'],
            en: ['State written after external call', 'A state variable is modified after an external call, violating checks-effects-interactions and enabling reentrancy.', 'Update state (e.g. zero the balance) before transferring value.']
        },
        'no-access-control': {
            severity: 'medium', swc: 'SWC-105 / SWC-106',
            pt: ['Função pública altera o estado sem verificar quem chama', 'Qualquer conta pode executar esta função, pois não há modificador de acesso nem verificação de "msg.sender".', 'Restrinja à parte legitimada (ex.: modificador "apenasLocador") ou documente por que o acesso é livre.'],
            en: ['Public state-changing function without caller check', 'Any account can call this function: there is no access modifier and no "msg.sender" check.', 'Restrict it to the entitled party (e.g. an "onlyLandlord" modifier) or document why it is permissionless.']
        },
        'payable-no-value-check': {
            severity: 'low', swc: null,
            pt: ['Função "payable" sem validar "msg.value"', 'A função aceita qualquer valor, inclusive zero ou quantia diversa da contratada.', 'Valide o valor recebido (ex.: "if (msg.value != valorAluguel) revert ValorIncorreto();").'],
            en: ['"payable" function without "msg.value" check', 'The function accepts any amount, including zero or a different amount than agreed.', 'Validate the amount (e.g. "if (msg.value != rent) revert WrongAmount();").']
        },
        'locked-ether': {
            severity: 'medium', swc: null,
            pt: ['Ether pode ficar retido no contrato', 'O contrato recebe Ether, mas não há função que o envie a alguém.', 'Preveja função de saque protegida para o credor.'],
            en: ['Ether may be locked in the contract', 'The contract receives Ether but no function ever sends it out.', 'Add a protected withdrawal function for the payee.']
        },
        'weak-randomness': {
            severity: 'high', swc: 'SWC-120',
            pt: ['Aleatoriedade derivada de dados do bloco', 'Valores como "block.timestamp", "blockhash" ou "block.prevrandao" podem ser previstos ou influenciados.', 'Use um oráculo de aleatoriedade verificável (VRF) ou esquema "commit-reveal".'],
            en: ['Randomness derived from block data', 'Values such as "block.timestamp", "blockhash" or "block.prevrandao" can be predicted or influenced.', 'Use a verifiable randomness oracle (VRF) or a commit-reveal scheme.']
        },
        'timestamp': {
            severity: 'info', swc: 'SWC-116',
            pt: ['Dependência de "block.timestamp"', 'O horário do bloco pode variar alguns segundos por ação do validador; é aceitável para prazos em dias, não para precisão de segundos.', 'Mantenha prazos com folga (dias) e documente a tolerância.'],
            en: ['Dependence on "block.timestamp"', 'Block time can drift by a few seconds under validator control; fine for day-level deadlines, not for second precision.', 'Keep deadlines coarse (days) and document the tolerance.']
        },
        'unchecked-block': {
            severity: 'low', swc: 'SWC-101',
            pt: ['Bloco "unchecked"', 'Dentro de "unchecked" não há verificação de estouro aritmético.', 'Use somente quando o limite for comprovado e comente a justificativa.'],
            en: ['"unchecked" block', 'Arithmetic overflow is not checked inside "unchecked".', 'Use only when bounds are proven, and comment why.']
        },
        'unbounded-loop': {
            severity: 'medium', swc: 'SWC-128',
            pt: ['Laço sobre lista de tamanho variável', 'Laços que percorrem arrays crescentes podem exceder o limite de gás e travar a função (negação de serviço).', 'Evite percorrer listas inteiras; use mapeamentos ou processamento em lotes.'],
            en: ['Loop over a dynamically sized array', 'Loops over growing arrays can exceed the gas limit and brick the function (denial of service).', 'Avoid iterating whole lists; use mappings or batching.']
        },
        'balance-equality': {
            severity: 'medium', swc: 'SWC-132',
            pt: ['Igualdade estrita com o saldo do contrato', 'O saldo pode ser alterado à força (ex.: por "selfdestruct" de terceiros), quebrando comparações "==".', 'Controle os valores em variável própria de contabilidade, não em "address(this).balance".'],
            en: ['Strict equality on contract balance', 'The balance can be forcibly changed, breaking "==" comparisons.', 'Track amounts in an accounting variable instead of "address(this).balance".']
        },
        'ecrecover': {
            severity: 'medium', swc: 'SWC-117 / SWC-121',
            pt: ['Uso direto de "ecrecover"', 'Assinaturas sem "nonce", sem domínio (EIP-712) e sem checagem de maleabilidade permitem reutilização.', 'Use EIP-712 com "nonce" e prazo, e rejeite assinaturas maleáveis.'],
            en: ['Direct use of "ecrecover"', 'Signatures without nonce, domain separation (EIP-712) and malleability checks can be replayed.', 'Use EIP-712 with nonce and deadline, and reject malleable signatures.']
        },
        'divide-before-multiply': {
            severity: 'low', swc: null,
            pt: ['Divisão antes de multiplicação', 'A divisão inteira trunca o resultado; dividir antes de multiplicar perde precisão (ex.: em multas e juros).', 'Multiplique primeiro e divida ao final (ex.: "valor * multaBps / 10_000").'],
            en: ['Division before multiplication', 'Integer division truncates; dividing first loses precision (e.g. in fees and interest).', 'Multiply first and divide last (e.g. "amount * feeBps / 10_000").']
        },
        'hardcoded-address': {
            severity: 'low', swc: null,
            pt: ['Endereço fixo no código', 'Endereços escritos diretamente no código dificultam testes e podem apontar para conta errada em outra rede.', 'Receba os endereços das partes no construtor e armazene-os como "immutable".'],
            en: ['Hard-coded address', 'Addresses written in the code hinder testing and may point to the wrong account on another network.', 'Take party addresses in the constructor and store them as "immutable".']
        },
        'imports': {
            severity: 'info', swc: null,
            pt: ['Importação de arquivo externo', 'O compilador do navegador não resolve "import"; a verificação de compilação só será possível no Remix ou em ambiente local.', 'Prefira código autocontido no esqueleto ou compile no Remix.'],
            en: ['External import', 'The in-browser compiler does not resolve imports; compile in Remix or locally instead.', 'Prefer self-contained code for the skeleton, or compile in Remix.']
        },
        'no-contract': {
            severity: 'high', swc: null,
            pt: ['Nenhum contrato encontrado', 'Não foi localizada declaração "contract" no código.', 'Gere novamente o esqueleto.'],
            en: ['No contract found', 'No "contract" declaration was found in the code.', 'Generate the skeleton again.']
        }
    };

    /**
     * Substitui comentários e literais de texto por espaços, preservando
     * quebras de linha (para manter a numeração) e o tamanho do texto.
     */
    function stripCommentsAndStrings(src) {
        const out = src.split('');
        let i = 0;
        const n = src.length;
        const blank = (from, to) => {
            for (let k = from; k < to && k < n; k++) {
                if (out[k] !== '\n') out[k] = ' ';
            }
        };
        while (i < n) {
            const c = src[i];
            const next = src[i + 1];
            if (c === '/' && next === '/') {
                let j = i;
                while (j < n && src[j] !== '\n') j++;
                blank(i, j);
                i = j;
            } else if (c === '/' && next === '*') {
                let j = src.indexOf('*/', i + 2);
                j = j === -1 ? n : j + 2;
                blank(i, j);
                i = j;
            } else if (c === '"' || c === "'") {
                let j = i + 1;
                while (j < n && src[j] !== c && src[j] !== '\n') {
                    if (src[j] === '\\') j++;
                    j++;
                }
                // Preserva as aspas, apaga o conteúdo.
                blank(i + 1, j);
                i = j + 1;
            } else {
                i++;
            }
        }
        return out.join('');
    }

    function lineOf(src, index) {
        let line = 1;
        for (let i = 0; i < index && i < src.length; i++) {
            if (src[i] === '\n') line++;
        }
        return line;
    }

    function matchBracket(src, openIndex, open, close) {
        let depth = 0;
        for (let i = openIndex; i < src.length; i++) {
            if (src[i] === open) depth++;
            else if (src[i] === close) {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    const HEADER_KEYWORDS = new Set([
        'public', 'external', 'internal', 'private', 'view', 'pure', 'payable',
        'virtual', 'override', 'returns', 'memory', 'calldata', 'storage', 'nonpayable'
    ]);

    /** Localiza funções, construtor, receive, fallback e modificadores. */
    function parseCallables(clean) {
        const items = [];
        const re = /\b(function\s+([A-Za-z_$][\w$]*)|constructor|receive|fallback|modifier\s+([A-Za-z_$][\w$]*))\s*\(/g;
        let m;
        while ((m = re.exec(clean)) !== null) {
            const kind = m[1].startsWith('function') ? 'function'
                : m[1].startsWith('modifier') ? 'modifier' : m[1];
            const name = m[2] || m[3] || kind;
            const parenOpen = clean.indexOf('(', m.index + m[1].length);
            const parenClose = matchBracket(clean, parenOpen, '(', ')');
            if (parenClose === -1) continue;
            // Cabeçalho: do fim dos parâmetros até "{" ou ";".
            let k = parenClose + 1;
            while (k < clean.length && clean[k] !== '{' && clean[k] !== ';') k++;
            const header = clean.slice(parenClose + 1, k);
            let body = '';
            let bodyStart = -1;
            let end = k;
            if (clean[k] === '{') {
                const close = matchBracket(clean, k, '{', '}');
                if (close === -1) continue;
                bodyStart = k + 1;
                body = clean.slice(k + 1, close);
                end = close;
            }
            // Remove "returns (...)" para não confundir tipos com modificadores.
            const headerNoReturns = header.replace(/\breturns\s*\([^)]*\)/g, ' ');
            const words = headerNoReturns.match(/[A-Za-z_$][\w$]*/g) || [];
            const modifiers = words.filter(w => !HEADER_KEYWORDS.has(w));
            const visibility = (header.match(/\b(public|external|internal|private)\b/) || [])[1]
                || (kind === 'receive' || kind === 'fallback' ? 'external' : (kind === 'function' ? 'public' : null));
            items.push({
                kind,
                name,
                start: m.index,
                bodyStart,
                end,
                header,
                body,
                modifiers,
                visibility,
                isView: /\b(view|pure)\b/.test(header),
                isPayable: /\bpayable\b/.test(header)
            });
            re.lastIndex = Math.max(re.lastIndex, end);
        }
        return items;
    }

    /** Nomes de variáveis de estado declaradas no corpo dos contratos. */
    function parseStateVariables(clean, callables) {
        // Apaga corpos de funções/modificadores e declarações de struct/enum/evento/erro.
        const masked = clean.split('');
        for (const c of callables) {
            for (let i = c.start; i <= c.end && i < masked.length; i++) {
                if (masked[i] !== '\n') masked[i] = ' ';
            }
        }
        let text = masked.join('');
        text = text.replace(/\b(struct|enum)\s+\w+\s*\{[^}]*\}/g, m => m.replace(/[^\n]/g, ' '));
        const names = new Set();
        const contractRe = /\b(contract|abstract\s+contract|library)\s+\w+[^{]*\{/g;
        let m;
        while ((m = contractRe.exec(text)) !== null) {
            const open = m.index + m[0].length - 1;
            const close = matchBracket(text, open, '{', '}');
            if (close === -1) continue;
            const body = text.slice(open + 1, close);
            for (const stmt of body.split(';')) {
                const s = stmt.replace(/\s+/g, ' ').trim();
                if (!s || /^(event|error|using|import|pragma)\b/.test(s)) continue;
                const decl = s.split(/=(?![>=])/)[0].trim();
                const ident = decl.match(/([A-Za-z_$][\w$]*)\s*$/);
                if (ident && !HEADER_KEYWORDS.has(ident[1])) names.add(ident[1]);
            }
        }
        return names;
    }

    const EXTERNAL_CALL_RE = /\.(call|delegatecall|staticcall)\s*(\{[^}]*\})?\s*\(|\.(transfer|send)\s*\(/g;

    function findExternalCalls(body) {
        const calls = [];
        let m;
        EXTERNAL_CALL_RE.lastIndex = 0;
        while ((m = EXTERNAL_CALL_RE.exec(body)) !== null) {
            const kind = m[1] || m[3];
            const parenOpen = m.index + m[0].length - 1;
            const parenClose = matchBracket(body, parenOpen, '(', ')');
            const args = parenClose === -1 ? '' : body.slice(parenOpen + 1, parenClose);
            const argCount = args.trim() === '' ? 0 : splitTopLevel(args).length;
            const hasValue = !!(m[2] && /\bvalue\s*:/.test(m[2]));
            calls.push({ kind, index: m.index, end: parenClose === -1 ? m.index : parenClose, argCount, hasValue });
        }
        return calls;
    }

    function splitTopLevel(args) {
        const parts = [];
        let depth = 0;
        let cur = '';
        for (const ch of args) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            if (ch === ')' || ch === ']' || ch === '}') depth--;
            if (ch === ',' && depth === 0) {
                parts.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        parts.push(cur);
        return parts;
    }

    function escapeRe(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function writesState(text, stateVars) {
        for (const v of stateVars) {
            const name = escapeRe(v);
            const re = new RegExp(
                '(^|[^\\w$.])(' + name + ')\\s*(\\[[^\\]]*\\]\\s*)*(\\.\\w+\\s*)*(=(?!=)|\\+=|-=|\\*=|\\/=|\\+\\+|--)' +
                '|(\\+\\+|--)\\s*' + name + '\\b' +
                '|\\bdelete\\s+' + name + '\\b' +
                '|(^|[^\\w$.])' + name + '\\s*\\.\\s*(push|pop)\\s*\\('
            );
            if (re.test(text)) return v;
        }
        return null;
    }

    function statementStart(body, index) {
        let i = index;
        while (i > 0 && body[i - 1] !== ';' && body[i - 1] !== '{' && body[i - 1] !== '}') i--;
        return i;
    }

    /**
     * Analisa o código e devolve a lista de achados, ordenada por gravidade.
     * @param {string} source código Solidity
     * @param {{lang?: 'pt'|'en'}} [options]
     */
    function scan(source, options) {
        const lang = (options && options.lang) === 'en' ? 'en' : 'pt';
        const findings = [];
        const seen = new Set();
        const src = String(source || '');
        const clean = stripCommentsAndStrings(src);

        function add(rule, index, extra) {
            const def = RULES[rule];
            const line = index == null ? null : lineOf(src, index);
            const key = rule + ':' + line + ':' + (extra || '');
            if (seen.has(key)) return;
            seen.add(key);
            const [title, description, recommendation] = def[lang];
            // Achado reconhecido: comentário "VERIFICADO:"/"VERIFIED:" na própria linha ou na anterior.
            let acknowledged = false;
            if (line) {
                const lines = src.split('\n');
                const near = (lines[line - 1] || '') + '\n' + (lines[line - 2] || '');
                acknowledged = /\/\/\s*(VERIFICADO|VERIFIED)\s*:/i.test(near);
            }
            findings.push({
                acknowledged,
                rule,
                severity: def.severity,
                swc: def.swc,
                line,
                title: extra ? title + ' — ' + extra : title,
                description,
                recommendation
            });
        }

        if (!src.trim()) return findings;

        // --- Cabeçalho do arquivo ---
        if (!/SPDX-License-Identifier\s*:/.test(src)) add('no-spdx', null);
        const pragmaRaw = /\bpragma\s+solidity\s+([^;]+);/.exec(clean);
        if (!pragmaRaw) {
            add('no-pragma', null);
        } else {
            const spec = pragmaRaw[1].trim();
            const versions = spec.match(/\d+\.\d+\.\d+|\d+\.\d+/g) || [];
            const lowest = versions[0];
            if (lowest) {
                const [maj, min] = lowest.split('.').map(Number);
                if (maj === 0 && min < 8) add('old-compiler', pragmaRaw.index);
            }
            if (/[\^~><*]|\|\|/.test(spec) || versions.length > 1) add('floating-pragma', pragmaRaw.index);
        }

        if (!/\b(contract|library|interface)\s+[A-Za-z_$]/.test(clean)) add('no-contract', null);

        // --- Padrões simples ---
        const simple = [
            [/\btx\.origin\b/g, 'tx-origin'],
            [/\b(selfdestruct|suicide)\s*\(/g, 'selfdestruct'],
            [/\.delegatecall\s*\(/g, 'delegatecall'],
            [/\bassembly\s*(\("[^"]*"\)\s*)?\{/g, 'assembly'],
            [/\bunchecked\s*\{/g, 'unchecked-block'],
            [/\becrecover\s*\(/g, 'ecrecover'],
            [/address\s*\(\s*this\s*\)\s*\.\s*balance\s*(==|!=)|(==|!=)\s*address\s*\(\s*this\s*\)\s*\.\s*balance/g, 'balance-equality'],
            [/^\s*import\b/gm, 'imports']
        ];
        for (const [re, rule] of simple) {
            let m;
            while ((m = re.exec(clean)) !== null) add(rule, m.index);
        }

        // Aleatoriedade fraca: dados do bloco dentro de keccak256 ou com módulo "%".
        {
            const re = /keccak256\s*\(([^;]*)\)|\b(block\.(timestamp|prevrandao|difficulty|number)|blockhash\s*\([^)]*\))\s*%/g;
            let m;
            while ((m = re.exec(clean)) !== null) {
                if (m[1] === undefined || /block\.(timestamp|prevrandao|difficulty|number)|blockhash\s*\(/.test(m[1])) {
                    add('weak-randomness', m.index);
                }
            }
        }

        // Uso de block.timestamp (informativo, apenas uma vez).
        {
            const m = /\bblock\.timestamp\b|\bnow\b/.exec(clean);
            if (m) add('timestamp', m.index);
        }

        // Endereços fixos (no texto original, pois são literais numéricos).
        {
            const re = /\b0x[0-9a-fA-F]{40}\b/g;
            let m;
            while ((m = re.exec(clean)) !== null) add('hardcoded-address', m.index);
        }

        // Divisão antes de multiplicação na mesma expressão.
        {
            const re = /\/\s*([\w.$\[\]]+|\([^()]*\))\s*\*/g;
            let m;
            while ((m = re.exec(clean)) !== null) {
                // Ignora "/*" residual (comentários já foram apagados).
                add('divide-before-multiply', m.index);
            }
        }

        // --- Análise por função ---
        const callables = parseCallables(clean);
        const stateVars = parseStateVariables(clean, callables);
        const modifierDefs = callables.filter(c => c.kind === 'modifier');
        const lockModifiers = new Set(modifierDefs
            .filter(md => /nonReentrant|noReentr|reentr|lock|trava/i.test(md.name) ||
                (/\b(require|if)\b/.test(md.body) && /_;/.test(md.body) && /=\s*(true|1|2|_ENTERED|ENTERED)\b/.test(md.body) && /=\s*(false|0|1|_NOT_ENTERED|NOT_ENTERED)\b/.test(md.body)))
            .map(md => md.name));
        // Aceita também modificadores herdados com nome convencional.
        const isLock = name => lockModifiers.has(name) || /^nonReentrant$/i.test(name);
        const accessModifiers = new Set(modifierDefs
            .filter(md => /\bmsg\.sender\b/.test(md.body))
            .map(md => md.name));
        const isAccessModifier = name => accessModifiers.has(name) ||
            /^(only|apenas|somente|so)[A-Z_]/.test(name) || /^(onlyOwner|onlyRole|auth)$/.test(name);

        let receivesEther = false;
        let sendsEther = false;

        for (const fn of callables) {
            if (fn.kind === 'modifier') continue;
            const body = fn.body;
            if (fn.isPayable || fn.kind === 'receive' || (fn.kind === 'fallback' && fn.isPayable)) receivesEther = true;

            const calls = findExternalCalls(body);
            for (const call of calls) {
                const absolute = fn.bodyStart + call.index;
                if ((call.kind === 'transfer' || call.kind === 'send') && call.argCount === 1) {
                    sendsEther = true;
                    add('transfer-send', absolute);
                    if (call.kind === 'send') {
                        const stmt = body.slice(statementStart(body, call.index), call.index);
                        if (!/\b(require|assert|if)\s*\(|=/.test(stmt)) add('unchecked-call', absolute, 'send');
                    }
                }
                if (call.kind === 'call') {
                    if (call.hasValue) sendsEther = true;
                    const stmtStart = statementStart(body, call.index);
                    const stmt = body.slice(stmtStart, call.index);
                    const assigned = /\(\s*bool\s+([A-Za-z_$][\w$]*)/.exec(stmt) || /\bbool\s+([A-Za-z_$][\w$]*)\s*,?\s*\)?\s*=/.exec(stmt) || /\(\s*([A-Za-z_$][\w$]*)\s*,[^)]*\)\s*=\s*[^=]*$/.exec(stmt);
                    const inRequire = /\b(require|assert)\s*\(\s*$/.test(stmt) || /\b(require|assert)\s*\([^;]*$/.test(stmt);
                    if (!assigned && !inRequire) {
                        add('unchecked-call', absolute);
                    } else if (assigned) {
                        const v = escapeRe(assigned[1]);
                        const rest = body.slice(call.end);
                        const checked = new RegExp('\\b(require|assert)\\s*\\(\\s*' + v + '\\b|\\bif\\s*\\(\\s*!\\s*' + v + '\\b|\\bif\\s*\\(\\s*' + v + '\\s*==\\s*false|\\bif\\s*\\(\\s*' + v + '\\s*\\)').test(rest);
                        if (!checked) add('unchecked-call', absolute);
                    }
                }
                if (call.kind === 'call' || call.kind === 'delegatecall' || ((call.kind === 'transfer' || call.kind === 'send') && call.argCount === 1)) {
                    // Reentrância: trava e ordem das operações.
                    if (call.kind === 'call' && !fn.modifiers.some(isLock)) {
                        add('reentrancy-guard', absolute, fn.name);
                    }
                    const after = body.slice(call.end + 1);
                    const written = writesState(after, stateVars);
                    if (written && (call.kind === 'call' || call.kind === 'delegatecall')) {
                        add('cei-violation', absolute, fn.name + ' → ' + written);
                    }
                }
            }

            // Controle de acesso em funções públicas que alteram estado.
            if (fn.kind === 'function' && (fn.visibility === 'public' || fn.visibility === 'external') && !fn.isView && fn.bodyStart !== -1) {
                const hasAccessModifier = fn.modifiers.some(isAccessModifier);
                const checksSender = /\bmsg\.sender\b/.test(body);
                // Funções que chamam outro modificador definido no contrato que use msg.sender.
                if (!hasAccessModifier && !checksSender && writesState(body, stateVars)) {
                    add('no-access-control', fn.start, fn.name);
                }
            }

            // "payable" sem conferência do valor.
            if (fn.kind === 'function' && fn.isPayable && fn.bodyStart !== -1 && !/\bmsg\.value\b/.test(body)) {
                add('payable-no-value-check', fn.start, fn.name);
            }

            // Laços sobre arrays de tamanho variável.
            {
                const re = /\b(for|while)\s*\(([^;{]*;)?[^;{]*\.length\b/g;
                let m;
                while ((m = re.exec(body)) !== null) add('unbounded-loop', fn.bodyStart + m.index, fn.name);
            }
        }

        if (receivesEther && !sendsEther) {
            const idx = clean.search(/\bpayable\b|\breceive\s*\(/);
            add('locked-ether', idx === -1 ? null : idx);
        }

        findings.sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || ((a.line || 0) - (b.line || 0)));
        return findings;
    }

    function summarize(findings) {
        const counts = { high: 0, medium: 0, low: 0, info: 0 };
        for (const f of findings) counts[f.severity]++;
        return counts;
    }

    return { scan, summarize, stripCommentsAndStrings, RULES, SEVERITY_ORDER };
}));
