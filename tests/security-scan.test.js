// Testes do verificador local de segurança.
// Execução: node --test tests/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scan, summarize, stripCommentsAndStrings } = require('../assets/js/security-scan.js');

const rules = code => scan(code).map(f => f.rule);

const SECURE = `// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

// ATENÇÃO: Este é um esqueleto de contrato Solidity gerado por IA.
contract ContratoDeAluguel {
    error NaoAutorizado();
    error ValorIncorreto();
    error SemSaldo();
    error FalhaNoEnvio();
    error Reentrada();

    event AluguelPago(address indexed pagador, uint256 valor, uint256 competencia);
    event Saque(address indexed credor, uint256 valor);

    address public immutable locador;
    address public immutable locatario;
    uint256 public immutable valorAluguel;
    uint256 public constant MULTA_BPS = 1_000; // 10%
    mapping(address => uint256) public saldos;
    bool private travado;

    modifier apenasLocatario() {
        if (msg.sender != locatario) revert NaoAutorizado();
        _;
    }

    modifier nonReentrant() {
        if (travado) revert Reentrada();
        travado = true;
        _;
        travado = false;
    }

    constructor(address _locador, address _locatario, uint256 _valor) {
        locador = _locador;
        locatario = _locatario;
        valorAluguel = _valor;
    }

    function pagarAluguel(uint256 competencia) external payable apenasLocatario {
        if (msg.value != valorAluguel) revert ValorIncorreto();
        saldos[locador] += msg.value;
        emit AluguelPago(msg.sender, msg.value, competencia);
    }

    function calcularMulta(uint256 valor) public pure returns (uint256) {
        return valor * MULTA_BPS / 10_000;
    }

    function sacar() external nonReentrant {
        uint256 valor = saldos[msg.sender];
        if (valor == 0) revert SemSaldo();
        saldos[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        if (!ok) revert FalhaNoEnvio();
        emit Saque(msg.sender, valor);
    }
}
// Lembre-se: ESTE CÓDIGO É UM PONTO DE PARTIDA E NECESSITA DE REVISÃO.
`;

test('contrato seguro de referência não gera achados altos ou médios', () => {
    const findings = scan(SECURE);
    const counts = summarize(findings);
    assert.equal(counts.high, 0, JSON.stringify(findings, null, 2));
    assert.equal(counts.medium, 0, JSON.stringify(findings, null, 2));
});

test('detecta tx.origin, selfdestruct, delegatecall e assembly', () => {
    const code = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract X {
    address owner;
    function kill() public { require(tx.origin == owner); selfdestruct(payable(owner)); }
    function proxy(address t) public { require(msg.sender == owner); t.delegatecall(""); }
    function a() public pure returns (uint r) { assembly { r := 1 } }
}`;
    const r = rules(code);
    for (const rule of ['tx-origin', 'selfdestruct', 'delegatecall', 'assembly']) {
        assert.ok(r.includes(rule), rule + ' não detectado: ' + r.join(', '));
    }
});

test('detecta reentrância clássica: chamada antes da atualização do saldo', () => {
    const code = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract Banco {
    mapping(address => uint256) public saldos;
    function depositar() external payable { require(msg.value > 0); saldos[msg.sender] += msg.value; }
    function sacar() external {
        uint256 v = saldos[msg.sender];
        (bool ok, ) = msg.sender.call{value: v}("");
        require(ok);
        saldos[msg.sender] = 0;
    }
}`;
    const r = rules(code);
    assert.ok(r.includes('cei-violation'), r.join(', '));
    assert.ok(r.includes('reentrancy-guard'), r.join(', '));
    assert.ok(!r.includes('unchecked-call'), r.join(', '));
});

test('detecta retorno de call não verificado', () => {
    const code = `pragma solidity 0.8.28;
contract P {
    address payable dono;
    function pagar() external { require(msg.sender == dono); dono.call{value: 1 ether}(""); }
}`;
    assert.ok(rules(code).includes('unchecked-call'));
});

test('retorno capturado mas jamais verificado também é apontado', () => {
    const code = `pragma solidity 0.8.28;
contract P {
    address payable dono;
    function pagar() external { require(msg.sender == dono); (bool ok, ) = dono.call{value: 1}(""); }
}`;
    assert.ok(rules(code).includes('unchecked-call'));
});

test('transfer e send de Ether são apontados; transfer de token (2 argumentos) não', () => {
    const eth = `pragma solidity 0.8.28;
contract A { address payable b; function f() external { require(msg.sender == b); b.transfer(1); } }`;
    const token = `pragma solidity 0.8.28;
interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }
contract B { IERC20 t; address d; function f() external { require(msg.sender == d); require(t.transfer(d, 1)); } }`;
    assert.ok(rules(eth).includes('transfer-send'));
    assert.ok(!rules(token).includes('transfer-send'));
});

test('função pública que altera estado sem controle de acesso', () => {
    const code = `pragma solidity 0.8.28;
contract C { bool public inadimplente; function registrarAtraso() public { inadimplente = true; } }`;
    assert.ok(rules(code).includes('no-access-control'));
});

test('modificador de acesso conhecido afasta o apontamento', () => {
    const code = `pragma solidity 0.8.28;
contract C {
    address dono; bool public inadimplente;
    modifier apenasDono() { require(msg.sender == dono); _; }
    function registrarAtraso() public apenasDono { inadimplente = true; }
}`;
    assert.ok(!rules(code).includes('no-access-control'));
});

test('pragma antigo, flutuante e ausência de SPDX', () => {
    const r = rules('pragma solidity ^0.6.0; contract C {}');
    assert.ok(r.includes('old-compiler'));
    assert.ok(r.includes('floating-pragma'));
    assert.ok(r.includes('no-spdx'));
    assert.ok(rules('contract C {}').includes('no-pragma'));
});

test('Ether retido quando há payable e nenhuma saída', () => {
    const code = `pragma solidity 0.8.28;
contract C { address l; function pagar() external payable { require(msg.sender == l); require(msg.value == 1); } }`;
    assert.ok(rules(code).includes('locked-ether'));
});

test('aleatoriedade fraca, laço ilimitado e divisão antes de multiplicação', () => {
    const code = `pragma solidity 0.8.28;
contract C {
    address[] public partes; address d;
    function sortear() external view returns (uint) { return uint(keccak256(abi.encodePacked(block.timestamp))) % partes.length; }
    function pagarTodos() external { require(msg.sender == d); for (uint i = 0; i < partes.length; i++) { partes[i]; } }
    function multa(uint v) external pure returns (uint) { return v / 100 * 10; }
}`;
    const r = rules(code);
    assert.ok(r.includes('weak-randomness'), r.join(', '));
    assert.ok(r.includes('unbounded-loop'), r.join(', '));
    assert.ok(r.includes('divide-before-multiply'), r.join(', '));
});

test('padrões dentro de comentários e textos são ignorados', () => {
    const code = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract C {
    // tx.origin não deve ser usado; selfdestruct(x) também não.
    /* delegatecall( */
    string public aviso = "tx.origin selfdestruct(";
}`;
    const r = rules(code);
    assert.ok(!r.includes('tx-origin'));
    assert.ok(!r.includes('selfdestruct'));
    assert.ok(!r.includes('delegatecall'));
});

test('a remoção de comentários preserva tamanho e linhas', () => {
    const src = 'a // x\nb /* y\nz */ c "q"';
    const out = stripCommentsAndStrings(src);
    assert.equal(out.length, src.length);
    assert.equal(out.split('\n').length, src.split('\n').length);
});

test('mensagens em inglês', () => {
    const [f] = scan('contract C { function f() public { tx.origin; } }', { lang: 'en' }).filter(x => x.rule === 'tx-origin');
    assert.match(f.title, /tx\.origin/);
    assert.match(f.recommendation, /msg\.sender/);
});

test('comentário VERIFICADO marca o achado como reconhecido', () => {
    const code = `pragma solidity 0.8.28;
contract C {
    bool public sinal;
    // VERIFICADO: qualquer pessoa pode sinalizar; não há valores envolvidos.
    function sinalizar() public { sinal = true; }
}`;
    const f = scan(code).find(x => x.rule === 'no-access-control');
    assert.ok(f && f.acknowledged);
});
