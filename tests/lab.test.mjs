// Teste de integração: compila com o solc oficial e executa na EVM simulada
// (mesmo pacote usado pela página). Requer "npm install".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Chain, parseEther } from '../src/evm-lab.mjs';

const require = createRequire(import.meta.url);
const solc = require('solc');

const SOURCE = `// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

contract ContratoDeAluguel {
    enum Situacao { Ativo, Encerrado }
    error NaoAutorizado();
    error ValorIncorreto();
    error SemSaldo();
    error FalhaNoEnvio();
    error Reentrada();
    error EnderecoInvalido();
    error ForaDoPrazo(uint256 agora, uint256 limite);

    event AluguelPago(address indexed pagador, uint256 valor);
    event Saque(address indexed credor, uint256 valor);

    address public immutable locador;
    address public immutable locatario;
    uint256 public immutable valorAluguel;
    uint256 public immutable vencimento;
    mapping(address => uint256) public saldos;
    bool private travado;

    modifier apenasLocatario() { if (msg.sender != locatario) revert NaoAutorizado(); _; }
    modifier nonReentrant() { if (travado) revert Reentrada(); travado = true; _; travado = false; }

    constructor(address _locador, address _locatario, uint256 _valor) {
        if (_locador == address(0) || _locatario == address(0) || _locador == _locatario) revert EnderecoInvalido();
        locador = _locador; locatario = _locatario; valorAluguel = _valor;
        vencimento = block.timestamp + 30 days;
    }

    function pagarAluguel() external payable apenasLocatario {
        if (msg.value != valorAluguel) revert ValorIncorreto();
        if (block.timestamp > vencimento) revert ForaDoPrazo(block.timestamp, vencimento);
        saldos[locador] += msg.value;
        emit AluguelPago(msg.sender, msg.value);
    }

    function sacar() external nonReentrant {
        uint256 valor = saldos[msg.sender];
        if (valor == 0) revert SemSaldo();
        saldos[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        if (!ok) revert FalhaNoEnvio();
        emit Saque(msg.sender, valor);
    }
}`;

function compile(source) {
    const input = {
        language: 'Solidity',
        sources: { 'Contrato.sol': { content: source } },
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } }
    };
    const out = JSON.parse(solc.compile(JSON.stringify(input)));
    const errors = (out.errors || []).filter(e => e.severity === 'error');
    assert.equal(errors.length, 0, errors.map(e => e.formattedMessage).join('\n'));
    const c = out.contracts['Contrato.sol'].ContratoDeAluguel;
    return { abi: c.abi, bytecode: c.evm.bytecode.object };
}

test('implanta e executa o contrato: pagamento, saque e ataques', async () => {
    const { abi, bytecode } = compile(SOURCE);
    const chain = await Chain.create();
    const locador = await chain.addAccount('Locador', 10);
    const locatario = await chain.addAccount('Locatário', 10);
    const atacante = await chain.addAccount('Atacante', 10);

    const valor = parseEther('1');
    const dep = await chain.deploy({ from: locador.address, abi, bytecode, args: [locador.address, locatario.address, valor] });
    assert.ok(dep.ok, JSON.stringify(dep.error));
    const at = dep.address;

    // Construtor rejeita partes iguais.
    const bad = await chain.deploy({ from: locador.address, abi, bytecode, args: [locador.address, locador.address, valor] });
    assert.equal(bad.ok, false);
    assert.equal(bad.error.name, 'EnderecoInvalido');

    // Ataque: terceiro tenta pagar.
    const r1 = await chain.call({ from: atacante.address, to: at, abi, functionName: 'pagarAluguel', value: valor });
    assert.equal(r1.ok, false);
    assert.equal(r1.error.name, 'NaoAutorizado');

    // Valor errado.
    const r2 = await chain.call({ from: locatario.address, to: at, abi, functionName: 'pagarAluguel', value: parseEther('0.5') });
    assert.equal(r2.error.name, 'ValorIncorreto');

    // Pagamento correto emite evento.
    const r3 = await chain.call({ from: locatario.address, to: at, abi, functionName: 'pagarAluguel', value: valor });
    assert.ok(r3.ok, JSON.stringify(r3.error));
    assert.equal(r3.events[0].name, 'AluguelPago');

    // Leitura de estado.
    const s = await chain.call({ from: locador.address, to: at, abi, functionName: 'saldos', args: [locador.address] });
    assert.equal(s.result, valor);

    // Atacante não consegue sacar.
    const r4 = await chain.call({ from: atacante.address, to: at, abi, functionName: 'sacar' });
    assert.equal(r4.error.name, 'SemSaldo');

    // Locador saca; saldo dele aumenta; segundo saque falha.
    const antes = await chain.balanceOf(locador.address);
    const r5 = await chain.call({ from: locador.address, to: at, abi, functionName: 'sacar' });
    assert.ok(r5.ok, JSON.stringify(r5.error));
    assert.equal((await chain.balanceOf(locador.address)) - antes, valor);
    const r6 = await chain.call({ from: locador.address, to: at, abi, functionName: 'sacar' });
    assert.equal(r6.error.name, 'SemSaldo');

    // Prazo: após 31 dias, pagamento é recusado com argumentos decodificados.
    chain.advanceTime(31 * 24 * 3600);
    const r7 = await chain.call({ from: locatario.address, to: at, abi, functionName: 'pagarAluguel', value: valor });
    assert.equal(r7.error.name, 'ForaDoPrazo');
    assert.equal(r7.error.args.length, 2);
});

test('o modelo de referência das instruções compila e não tem achados', async () => {
    globalThis.window = globalThis.window || {};
    require('../assets/js/prompts.js');
    const { scan } = require('../assets/js/security-scan.js');
    const system = globalThis.window.CSC.prompts.generate('x', 'pt').system;
    const ref = /```solidity\n([\s\S]*?)```/.exec(system)[1];
    assert.deepEqual(scan(ref).filter(f => f.severity !== 'info'), []);
    const input = { language: 'Solidity', sources: { 'R.sol': { content: ref } }, settings: { outputSelection: { '*': { '*': [] } } } };
    const out = JSON.parse(solc.compile(JSON.stringify(input)));
    const errors = (out.errors || []).filter(e => e.severity === 'error');
    assert.equal(errors.length, 0, errors.map(e => e.formattedMessage).join('\n'));
});
