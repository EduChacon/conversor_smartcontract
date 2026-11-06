/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
// Testes dos modelos sem IA: para cada modelo e idioma, o código deve
// compilar, não ter achados altos/médios e passar em todos os cenários
// predefinidos executados na EVM simulada (mesmo executor da página).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solc = require('solc');
const { scan } = require('../assets/js/security-scan.js');
const templates = require('../assets/js/templates.js');

// Ambiente mínimo para reutilizar o executor do Laboratório no Node.
globalThis.window = globalThis;
require('../assets/js/i18n.js');
globalThis.EvmLab = await import('../src/evm-lab.mjs');
require('../assets/js/lab.js');
const CSC = globalThis.CSC;

function compile(source) {
    const input = {
        language: 'Solidity',
        sources: { 'Contrato.sol': { content: source } },
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
    };
    const out = JSON.parse(solc.compile(JSON.stringify(input)));
    const errors = (out.errors || []).filter(e => e.severity === 'error');
    const warnings = (out.errors || []).filter(e => e.severity === 'warning');
    return { out, errors, warnings };
}

for (const lang of ['pt', 'en']) {
    for (const { id } of templates.list(lang)) {
        test(`modelo ${id} (${lang}): compila, sem achados e cenários aprovados`, async () => {
            CSC.lang = lang;
            const code = templates.build(id, {}, lang);
            assert.ok(!/\{\{|\}\}/.test(code), 'marcadores de idioma não substituídos');
            if (lang === 'en') assert.ok(!/\b(pagar|sacar|saldos|locador|comprador|contratante|mutuante|apenas)\w*/.test(code.replace(/\/\/.*$/gm, '')), 'identificador em português no código em inglês');

            const findings = scan(code).filter(f => f.severity === 'high' || f.severity === 'medium' || f.severity === 'low');
            assert.deepEqual(findings.map(f => f.rule + '@' + f.line), []);

            const { out, errors, warnings } = compile(code);
            assert.equal(errors.length, 0, errors.map(e => e.formattedMessage).join('\n'));
            assert.equal(warnings.length, 0, warnings.map(e => e.formattedMessage).join('\n'));

            const plan = templates.plan(id, {}, lang);
            const contracts = Object.entries(out.contracts['Contrato.sol']).map(([name, c]) => ({ name, abi: c.abi, bytecode: c.evm.bytecode.object }));
            const chosen = CSC.lab.pickContract(contracts, plan.contrato);
            assert.equal(chosen.name, plan.contrato);
            const compiled = Object.assign({ source: code }, chosen);
            for (const scenario of plan.cenarios) {
                const result = await CSC.lab._internals.runScenario(plan, scenario, compiled);
                const bad = result.steps.filter(s => s.status !== 'pass');
                assert.equal(result.status, 'pass', `${scenario.titulo}: ` + JSON.stringify(bad, (k, v) => typeof v === 'bigint' ? v.toString() : v));
            }
        });
    }
}

test('extração por regras em português', () => {
    const r = templates.extract('O LOCATÁRIO pagará ao LOCADOR a quantia de R$ 2.000,00 mensais, todo dia 05, a título de aluguel. Em caso de atraso, incidirá multa de 10% sobre o valor devido e juros de 1% ao mês, durante 24 meses.');
    assert.equal(r.type, 'locacao');
    assert.equal(r.values.valorAluguel, 2000);
    assert.equal(r.values.multaPercent, 10);
    assert.equal(r.values.jurosPercent, 1);
    assert.equal(r.values.numeroParcelas, 24);
    assert.equal(r.values.periodoDias, 30);
});

test('extração por regras em inglês', () => {
    const r = templates.extract('The LENDER lends the BORROWER R$ 12,000.00, to be repaid in 12 monthly instalments of R$ 1,050.00, the first due 30 days after disbursement. A delay of more than 60 days in any instalment accelerates the entire debt.');
    assert.equal(r.type, 'mutuo');
    assert.equal(r.values.valorEmprestimo, 12000);
    assert.equal(r.values.valorParcela, 1050);
    assert.equal(r.values.numeroParcelas, 12);
    assert.equal(r.values.atrasoVencimentoDias, 60);
});

test('extração: garantia e serviços', () => {
    const g = templates.extract('O COMPRADOR depositará o preço de R$ 50.000,00, que ficará retido até a confirmação do recebimento do bem. Se o bem não for entregue em até 30 dias contados do depósito, o COMPRADOR poderá reaver integralmente o valor depositado.');
    assert.equal(g.type, 'garantia');
    assert.equal(g.values.preco, 50000);
    assert.equal(g.values.prazoEntregaDias, 30);
    const s = templates.extract('O CONTRATANTE pagará ao CONTRATADO R$ 30.000,00 em três parcelas iguais, cada uma devida após a aprovação da respectiva etapa. O CONTRATANTE terá 5 dias úteis para aprovar ou recusar cada entrega.');
    assert.equal(s.type, 'servicos');
    assert.equal(s.values.valorTotal, 30000);
    assert.equal(s.values.numeroEtapas, 3);
    assert.equal(s.values.prazoAprovacaoDias, 5);
});

test('parâmetros extraídos alimentam o plano em ether pela escala', () => {
    const plan = templates.plan('locacao', { valorAluguel: 2500, escala: 1000, numeroParcelas: 3 }, 'pt');
    assert.deepEqual(plan.implantacao.argumentos.slice(0, 4), ['@Locador', '@Locatario', '2.5 ether', '3']);
});
