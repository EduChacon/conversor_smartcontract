// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @title RealDigitalDeTeste (tBRL)
/// @notice "Stablecoin" fictícia, usada só no Laboratório, no padrão ERC-20
///         (1 tBRL representa R$ 1,00; 18 casas decimais). Cada conta recebe
///         saldo inicial na implantação. Sem valor real.
contract RealDigitalDeTeste {
    string public constant name = "Real Digital de Teste";
    string public constant symbol = "tBRL";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address[] memory contas, uint256 saldoInicial) {
        for (uint256 i = 0; i < contas.length; i++) {
            balanceOf[contas[i]] = saldoInicial;
            totalSupply += saldoInicial;
            emit Transfer(address(0), contas[i], saldoInicial);
        }
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    /// @notice Autoriza "spender" (por exemplo, o contrato) a retirar até "value" da sua conta.
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "autorizacao insuficiente");
        allowance[from][msg.sender] = allowed - value;
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        require(balanceOf[from] >= value, "saldo insuficiente");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
