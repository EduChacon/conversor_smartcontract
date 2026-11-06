/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
// Testes da montagem por blocos: exemplos prontos e combinações aleatórias
// (determinísticas) devem compilar sem erros nem avisos, não ter achados do
// verificador e passar em todos os cenários, inclusive ataque a todas as
// funções e conferência de solvência.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solc = require('solc');
const { scan } = require('../assets/js/security-scan.js');
const blocks = require('../assets/js/blocks.js');

globalThis.window = globalThis;
require('../assets/js/i18n.js');
globalThis.EvmLab = await import('../src/evm-lab.mjs');
require('../assets/js/lab-helpers.js');
require('../assets/js/lab.js');
const CSC = globalThis.CSC;

function compile(source) {
    const input = {
        language: 'Solidity',
        sources: { 'Contrato.sol': { content: source } },
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } }
    };
    const out = JSON.parse(solc.compile(JSON.stringify(input)));
    return {
        out,
        errors: (out.errors || []).filter(e => e.severity === 'error'),
        warnings: (out.errors || []).filter(e => e.severity === 'warning')
    };
}

async function check(model, lang, label) {
    CSC.lang = lang;
    const v = blocks.validate(model);
    assert.deepEqual(v.map(x => x.pt), [], label + ': montagem inválida');
    const code = blocks.build(model, lang);
    const findings = scan(code).filter(f => ['high', 'medium', 'low'].includes(f.severity) && !f.acknowledged);
    assert.deepEqual(findings.map(f => f.rule + '@' + f.line + ' ' + f.title), [], label + ': achados');
    const { out, errors, warnings } = compile(code);
    assert.equal(errors.length, 0, label + '\n' + errors.map(e => e.formattedMessage).join('\n'));
    assert.equal(warnings.length, 0, label + '\n' + warnings.map(e => e.formattedMessage).join('\n'));
    const plan = blocks.plan(model, lang);
    const name = plan.contrato;
    const c = out.contracts['Contrato.sol'][name];
    assert.ok(c, label + ': contrato principal ausente');
    assert.ok(c.evm.deployedBytecode.object.length / 2 <= 24576, label + ': contrato acima de 24 KB');
    const compiled = { name, abi: c.abi, bytecode: c.evm.bytecode.object, source: code };
    for (const scenario of plan.cenarios) {
        const result = await CSC.lab._internals.runScenario(plan, scenario, compiled);
        // Recusa por motivo diferente do esperado ("warn") também reprova o cenário.
        const bad = result.steps.filter(s => s.status !== 'pass');
        assert.equal(result.status === 'pass' && !bad.length ? 'pass' : 'fail', 'pass', `${label} — ${scenario.titulo}: ` + JSON.stringify(bad, (k, val) => typeof val === 'bigint' ? val.toString() : val));
    }
    return plan.cenarios.length;
}

for (const lang of ['pt', 'en']) {
    for (const p of blocks.PRESETS) {
        test(`exemplo de montagem ${p.id} (${lang})`, async () => {
            const n = await check(blocks.preset(p.id, lang), lang, p.id + '/' + lang);
            assert.ok(n >= 4);
        });
    }
}

// Gerador pseudoaleatório determinístico.
function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('combinações aleatórias de blocos (60 montagens)', async () => {
    const rand = rng(20251106);
    const pick = arr => arr[Math.floor(rand() * arr.length)];
    let total = 0;
    for (let k = 0; k < 60; k++) {
        const lang = k % 2 ? 'en' : 'pt';
        const roles = [{ id: 'a', label: lang === 'en' ? 'Alice' : 'Ana' }, { id: 'b', label: lang === 'en' ? 'Bob' : 'Bruno' }, { id: 'c', label: lang === 'en' ? 'Carol' : 'Carla' }];
        const model = { name: 'Montagem ' + k, scale: 1000, roles, blocks: [] };
        const add = type => { const b = blocks.newBlock(type, roles, lang, model.blocks); model.blocks.push(b); return b; };
        const nPay = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < nPay; i++) {
            const b = add(pick(['pagamentoUnico', 'pagamentoPeriodico', 'pagamentoUnico', 'pagamentoPeriodico', 'pagamentoToken']));
            b.params.devedor = pick(['a', 'b']);
            b.params.credor = b.params.devedor === 'a' ? 'b' : 'a';
            b.params.valor = 100 + Math.floor(rand() * 5000);
            if (b.type === 'pagamentoToken') { b.params.prazo = 1 + Math.floor(rand() * 20); continue; }
            if (b.type === 'pagamentoPeriodico') { b.params.parcelas = 1 + Math.floor(rand() * 6); b.params.periodo = 10 + Math.floor(rand() * 30); }
            else b.params.prazo = 1 + Math.floor(rand() * 20);
            if (rand() < 0.6) { const e = add('encargos'); e.params.alvo = b.uid; e.params.multa = Math.floor(rand() * 20); e.params.juros = Math.floor(rand() * 5); e.params.tolerancia = Math.floor(rand() * 5); }
            if (b.type === 'pagamentoPeriodico' && rand() < 0.5) { const a = add('vencimentoAntecipado'); a.params.alvo = b.uid; a.params.atraso = 5 + Math.floor(rand() * 60); }
        }
        const arb = rand() < 0.5;
        if (rand() < 0.5) { const c = add('custodia'); c.params.depositante = 'a'; c.params.beneficiario = 'b'; c.params.valor = 500 + Math.floor(rand() * 9000); c.params.prazo = 1 + Math.floor(rand() * 40); }
        if (rand() < 0.5) { const e = add('etapas'); e.params.contratante = 'b'; e.params.contratado = 'a'; e.params.valor = 1000 + Math.floor(rand() * 9000); e.params.etapas = 1 + Math.floor(rand() * 5); e.params.prazo = 1 + Math.floor(rand() * 10); }
        const ending = rand();
        if (ending < 0.4) { const r = add('rescisao'); r.params.quem = pick(['*', 'a', 'b']); }
        else if (ending < 0.7) { const v = add('vigencia'); v.params.duracao = 30 + Math.floor(rand() * 400); }
        if (rand() < 0.5) { const c = add('caucao'); c.params.garantidor = 'b'; c.params.beneficiario = 'a'; c.params.valor = 100 + Math.floor(rand() * 3000); c.params.prazo = 1 + Math.floor(rand() * 30); }
        if (model.blocks.some(b => b.type === 'caucao' || b.type === 'etapas') && !model.blocks.some(b => b.type === 'rescisao' || b.type === 'vigencia')) { const v = add('vigencia'); v.params.duracao = 30 + Math.floor(rand() * 400); }
        if (arb) { const a = add('arbitro'); a.params.arbitro = 'c'; a.params.prazo = 1 + Math.floor(rand() * 40); }
        if (rand() < 0.3) add('clausulaLivre');
        // Obrigações de dar, fazer e não fazer, com cláusula penal.
        if (rand() < 0.5) {
            const o = add(pick(['obrigacaoDar', 'obrigacaoFazer', 'obrigacaoNaoFazer']));
            o.params.devedor = pick(['a', 'b']);
            o.params.credor = o.params.devedor === 'a' ? 'b' : 'a';
            o.params.verificador = rand() < 0.7 ? o.params.credor : 'c';
            if (o.type === 'obrigacaoNaoFazer') o.params.duracao = 1 + Math.floor(rand() * 200); else o.params.prazo = 1 + Math.floor(rand() * 40);
            if (rand() < 0.6) { const c = add('clausulaPenal'); c.params.alvo = o.uid; c.params.valor = 100 + Math.floor(rand() * 5000); }
            const cus0 = model.blocks.find(b => b.type === 'custodia');
            if (cus0 && o.type !== 'obrigacaoNaoFazer' && o.params.verificador !== cus0.params.beneficiario && rand() < 0.5) {
                const rel = add('liberacaoPorEvento'); rel.params.alvo = cus0.uid; rel.params.evento = o.uid;
            }
        }
        // Informações externas (oráculos) ligadas aos pagamentos e garantias.
        const pays = model.blocks.filter(b => b.type === 'pagamentoUnico' || b.type === 'pagamentoPeriodico');
        if (pays.length && rand() < 0.5) {
            const o = add('oraculoValor'); o.params.fonte = 'c'; o.params.validade = 1 + Math.floor(rand() * 60);
            const target = pick(pays);
            const kind = rand() < 0.5 ? 'reajuste' : 'conversaoCambial';
            const x = add(kind); x.params.alvo = target.uid; x.params[kind === 'reajuste' ? 'indice' : 'cotacao'] = o.uid;
        }
        const cus = model.blocks.find(b => b.type === 'custodia');
        if (cus && !model.blocks.some(b => b.type === 'liberacaoPorEvento') && rand() < 0.6) {
            const ev = add('oraculoEvento'); ev.params.fonte = 'c';
            const rel = add('liberacaoPorEvento'); rel.params.alvo = cus.uid; rel.params.evento = ev.uid;
        }
        // Regras de validação: rescisão ao alcance de quem deposita; árbitro não atesta obrigações.
        const resc = model.blocks.find(b => b.type === 'rescisao');
        if (resc && model.blocks.some(b => (b.type === 'caucao' && resc.params.quem !== b.params.garantidor) || (b.type === 'etapas' && resc.params.quem !== b.params.contratante))) resc.params.quem = '*';
        if (arb) for (const o of model.blocks.filter(b => b.params && b.params.verificador === 'c')) o.params.verificador = o.params.credor;
        if (!model.blocks.some(b => b.type === 'arbitro' || b.params.verificador === 'c' || ((b.type === 'oraculoValor' || b.type === 'oraculoEvento') && b.params.fonte === 'c'))) model.roles = roles.slice(0, 2);
        total += await check(model, lang, 'combinação ' + k + ' [' + model.blocks.map(b => b.type).join(', ') + ']');
    }
    assert.ok(total > 100);
});

test('validação aponta problemas de montagem', () => {
    const roles = [{ id: 'a', label: 'Ana' }, { id: 'b', label: 'Bruno' }];
    const model = { roles, blocks: [] };
    assert.ok(blocks.validate(model).length > 0, 'sem blocos');
    const p = blocks.newBlock('pagamentoUnico', roles, 'pt', []);
    p.params.devedor = 'a'; p.params.credor = 'a';
    model.blocks.push(p);
    assert.ok(blocks.validate(model).some(e => /diferentes/.test(e.pt)));
    const e = blocks.newBlock('encargos', roles, 'pt', []);
    e.params.alvo = 'inexistente';
    model.blocks.push(e);
    assert.ok(blocks.validate(model).some(x => /pagamento/.test(x.pt)));
});

test('redação personalizada mantém as lacunas', () => {
    const roles = [{ id: 'a', label: 'Ana' }, { id: 'b', label: 'Bruno' }];
    const p = blocks.newBlock('pagamentoUnico', roles, 'pt', []);
    p.texto = 'Fica ajustado que {devedor} entregará a {credor} a importância de {valor} no prazo de {prazo} dias.';
    const model = { roles, blocks: [p], scale: 1000 };
    assert.deepEqual(blocks.validate(model), []);
    const min = blocks.minuta(model, 'pt');
    assert.match(min[1].texto, /Fica ajustado que Ana entregará a Bruno a importância de R\$ 5\.000,00 no prazo de 10 dias\./);
    assert.match(blocks.build(model, 'pt'), /Fica ajustado que Ana entregará/);
    p.texto = 'Texto sem lacunas';
    assert.ok(blocks.validate(model).some(e => /lacunas/.test(e.pt)));
});
