/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Modo sem IA: modelos de contrato revisados, extração de parâmetros por
 * regras e cenários de teste predefinidos.
 *
 * Cada modelo é escrito uma única vez, em português; a versão em inglês é
 * obtida pela troca dos identificadores (mapa "en") e dos trechos {{pt|en}}.
 * A mesma entrada gera sempre o mesmo código (resultado reprodutível).
 *
 * Funciona como script clássico (window.CSC.templates) e como módulo
 * CommonJS (testes em tests/).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else {
        root.CSC = root.CSC || {};
        root.CSC.templates = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SOLC_VERSION = '0.8.28';

    // Identificadores comuns a todos os modelos.
    const COMMON_EN = {
        Situacao: 'Status', situacao: 'status', saldos: 'balances', sacar: 'withdraw', travado: 'locked',
        NaoAutorizado: 'Unauthorized', ParametroInvalido: 'InvalidParameter', SituacaoInvalida: 'InvalidStatus',
        ValorIncorreto: 'WrongAmount', SemSaldo: 'NothingToWithdraw', FalhaNoEnvio: 'TransferFailed', Reentrada: 'Reentrancy',
        Saque: 'Withdrawal', credor: 'payee', valor: 'amount', devido: 'due', enviado: 'sent', naSituacao: 'inStatus',
        Encerrado: 'Closed', Ativo: 'Active', quando: 'when', BPS: 'BPS', apenasPartes: 'onlyParties', limite: 'limit'
    };

    const HEADER = (name, title) => `// SPDX-License-Identifier: UNLICENSED
pragma solidity ${SOLC_VERSION};

// {{ATENÇÃO: esqueleto gerado a partir de modelo revisado (sem IA). Requer revisão profissional antes de qualquer uso.|WARNING: skeleton generated from a reviewed template (no AI). Requires professional review before any use.}}
// {{Gerado com o Conversor Contratual|Generated with the Contract Converter}} (github.com/EduChacon/conversor_smartcontract)

/// @title ${name}
/// @notice ${title}
/// @dev {{LIMITAÇÃO: valores em moeda fiduciária foram convertidos em wei pela escala didática do laboratório; a conversão real exige oráculo de preços ou acordo entre as partes.|LIMITATION: fiat amounts were converted to wei using the lab's didactic scale; real conversion requires a price oracle or agreement between the parties.}}`;

    const FOOTER = '\n// {{Lembre-se: ESTE CÓDIGO É UM PONTO DE PARTIDA E NECESSITA DE REVISÃO E ADAPTAÇÃO POR UM ESPECIALISTA ANTES DE QUALQUER USO.|Remember: THIS CODE IS A STARTING POINT AND MUST BE REVIEWED AND ADAPTED BY AN EXPERT BEFORE ANY USE.}}\n';

    const WITHDRAW = `
    /// @notice {{Saque do crédito disponível pelo próprio titular (padrão "pull payment").|Withdrawal of available credit by its owner ("pull payment" pattern).}}
    function sacar() external nonReentrant {
        uint256 valor = saldos[msg.sender];
        if (valor == 0) revert SemSaldo();
        saldos[msg.sender] = 0; // {{efeito antes da interação|effect before interaction}}
        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        if (!ok) revert FalhaNoEnvio();
        emit Saque(msg.sender, valor);
    }`;

    const GUARDS = `
    modifier naSituacao(Situacao s) {
        if (situacao != s) revert SituacaoInvalida();
        _;
    }

    modifier nonReentrant() {
        if (travado) revert Reentrada();
        travado = true;
        _;
        travado = false;
    }`;

    // ------------------------------------------------------------------
    // Modelos
    // ------------------------------------------------------------------
    const TEMPLATES = {
        locacao: {
            name: { pt: 'Locação (aluguel periódico, multa e juros)', en: 'Lease (periodic rent, late fee and interest)' },
            contract: { pt: 'ContratoDeLocacao', en: 'LeaseAgreement' },
            roles: [
                { key: 'locador', pt: 'Locador', en: 'Landlord' },
                { key: 'locatario', pt: 'Locatario', en: 'Tenant' }
            ],
            fields: [
                { key: 'valorAluguel', type: 'money', pt: 'Valor do aluguel', en: 'Rent amount', def: 2000 },
                { key: 'numeroParcelas', type: 'int', pt: 'Número de parcelas', en: 'Number of payments', def: 12, min: 1, max: 600 },
                { key: 'periodoDias', type: 'days', pt: 'Periodicidade (dias)', en: 'Period (days)', def: 30, min: 1 },
                { key: 'multaPercent', type: 'percent', pt: 'Multa por atraso (%)', en: 'Late fee (%)', def: 0 },
                { key: 'jurosPercent', type: 'percent', pt: 'Juros de mora ao mês (%)', en: 'Monthly late interest (%)', def: 0 },
                { key: 'toleranciaDias', type: 'days', pt: 'Tolerância (dias)', en: 'Grace period (days)', def: 0, min: 0 }
            ],
            en: {
                ContratoDeLocacao: 'LeaseAgreement', locador: 'landlord', locatario: 'tenant', valorAluguel: 'rent',
                numeroParcelas: 'installments', periodo: 'period', multaBps: 'lateFeeBps', jurosMensaisBps: 'monthlyInterestBps',
                tolerancia: 'gracePeriod', inicio: 'start', parcelasPagas: 'paidInstallments', apenasLocatario: 'onlyTenant',
                AluguelPago: 'RentPaid', ContratoEncerrado: 'AgreementClosed', parcela: 'installment', encargos: 'charges',
                proximoVencimento: 'nextDueDate', valorDevido: 'amountDue', pagarAluguel: 'payRent', total: 'total',
                vencimento: 'dueDate', diasAtraso: 'daysLate', multa: 'fee', juros: 'interest', MES: 'MONTH',
                _locador: '_landlord', _locatario: '_tenant', _valorAluguel: '_rent', _numeroParcelas: '_installments',
                _periodo: '_period', _multaBps: '_lateFeeBps', _jurosMensaisBps: '_monthlyInterestBps', _tolerancia: '_gracePeriod'
            },
            code: () => `${HEADER('ContratoDeLocacao', '{{Pagamento periódico de aluguel com multa e juros de mora.|Periodic rent payment with late fee and late interest.}}')}
contract ContratoDeLocacao {
    enum Situacao { Ativo, Encerrado }

    error NaoAutorizado();
    error ParametroInvalido();
    error SituacaoInvalida();
    error ValorIncorreto(uint256 devido, uint256 enviado);
    error SemSaldo();
    error FalhaNoEnvio();
    error Reentrada();

    event AluguelPago(address indexed locatario, uint256 indexed parcela, uint256 valor, uint256 encargos);
    event ContratoEncerrado(uint256 quando);
    event Saque(address indexed credor, uint256 valor);

    uint256 private constant BPS = 10_000; // {{100% em pontos-base|100% in basis points}}
    uint256 private constant MES = 30;     // {{dias por mês, para juros "pro rata die"|days per month, for pro rata interest}}

    address public immutable locador;
    address public immutable locatario;
    uint256 public immutable valorAluguel;
    uint256 public immutable numeroParcelas;
    uint256 public immutable periodo;          // {{em segundos|in seconds}}
    uint256 public immutable multaBps;
    uint256 public immutable jurosMensaisBps;
    uint256 public immutable tolerancia;       // {{em segundos|in seconds}}
    uint256 public immutable inicio;

    Situacao public situacao;
    uint256 public parcelasPagas;
    mapping(address => uint256) public saldos;
    bool private travado;

    modifier apenasLocatario() {
        if (msg.sender != locatario) revert NaoAutorizado();
        _;
    }
${GUARDS}

    constructor(
        address _locador,
        address _locatario,
        uint256 _valorAluguel,
        uint256 _numeroParcelas,
        uint256 _periodo,
        uint256 _multaBps,
        uint256 _jurosMensaisBps,
        uint256 _tolerancia
    ) {
        if (_locador == address(0) || _locatario == address(0) || _locador == _locatario) revert ParametroInvalido();
        if (_valorAluguel == 0 || _numeroParcelas == 0 || _periodo == 0) revert ParametroInvalido();
        if (_multaBps > BPS || _jurosMensaisBps > BPS) revert ParametroInvalido();
        locador = _locador;
        locatario = _locatario;
        valorAluguel = _valorAluguel;
        numeroParcelas = _numeroParcelas;
        periodo = _periodo;
        multaBps = _multaBps;
        jurosMensaisBps = _jurosMensaisBps;
        tolerancia = _tolerancia;
        inicio = block.timestamp;
    }

    /// @notice {{Vencimento da próxima parcela (a primeira vence um período após a implantação).|Due date of the next installment (the first is due one period after deployment).}}
    /// @dev {{LIMITAÇÃO: datas de calendário (ex.: "todo dia 05") foram aproximadas por períodos fixos.|LIMITATION: calendar dates (e.g. "every 5th") were approximated by fixed periods.}}
    function proximoVencimento() public view returns (uint256) {
        return inicio + (parcelasPagas + 1) * periodo;
    }

    /// @notice {{Valor devido agora pela próxima parcela, com multa e juros se houver atraso além da tolerância.|Amount due now for the next installment, with fee and interest if late beyond the grace period.}}
    function valorDevido() public view returns (uint256 total, uint256 encargos) {
        uint256 vencimento = proximoVencimento();
        total = valorAluguel;
        if (block.timestamp > vencimento + tolerancia) {
            // {{dias completos de atraso desde o vencimento (fração de dia não conta)|full days late since the due date (partial days do not count)}}
            uint256 diasAtraso = (block.timestamp - vencimento) / 1 days;
            uint256 multa = valorAluguel * multaBps / BPS;
            // {{juros simples "pro rata die": multiplica antes de dividir|simple pro rata interest: multiply before dividing}}
            uint256 juros = valorAluguel * jurosMensaisBps * diasAtraso / (BPS * MES);
            encargos = multa + juros;
            total += encargos;
        }
    }

    /// @notice {{Pagamento da próxima parcela pelo locatário, pelo valor exato devido.|Payment of the next installment by the tenant, for the exact amount due.}}
    function pagarAluguel() external payable apenasLocatario naSituacao(Situacao.Ativo) {
        (uint256 total, uint256 encargos) = valorDevido();
        if (msg.value != total) revert ValorIncorreto(total, msg.value);
        parcelasPagas += 1;
        saldos[locador] += msg.value;
        emit AluguelPago(msg.sender, parcelasPagas, msg.value, encargos);
        if (parcelasPagas == numeroParcelas) {
            situacao = Situacao.Encerrado;
            emit ContratoEncerrado(block.timestamp);
        }
    }
${WITHDRAW}
}${FOOTER}`,
            deployArgs: (p, R, money) => [R('locador'), R('locatario'), money(p.valorAluguel), String(p.numeroParcelas), p.periodoDias + ' days', String(bps(p.multaPercent)), String(bps(p.jurosPercent)), p.toleranciaDias + ' days'],
            scenarios: (p, R, money, L) => {
                const late = p.periodoDias + p.toleranciaDias + 10;
                const list = [
                    sc(L('Pagamento pontual e saque pelo locador', 'On-time payment and landlord withdrawal'), 'funcionalidade',
                        L('Fluxo normal: o locatário paga o valor exato e o locador saca o crédito.', 'Normal flow: the tenant pays the exact amount and the landlord withdraws the credit.'), [
                            call(R('locatario'), 'pagarAluguel', [], money(p.valorAluguel), 'sucesso', null, L('Pagamento da primeira parcela, no prazo.', 'First installment, on time.')),
                            query(R('locador'), 'parcelasPagas', [], '1', L('O contrato registra uma parcela paga.', 'The contract records one paid installment.')),
                            call(R('locador'), 'sacar', [], null, 'sucesso', null, L('O locador saca o valor recebido.', 'The landlord withdraws the amount received.'))
                        ]),
                    sc(L('Pagamento em atraso com encargos', 'Late payment with charges'), 'funcionalidade',
                        L('Após o vencimento e a tolerância, o valor devido passa a incluir multa e juros.', 'After the due date and grace period, the amount due includes fee and interest.'), [
                            wait(late + ' days', L('O tempo avança além do vencimento.', 'Time moves past the due date.')),
                            query(R('locatario'), 'valorDevido', [], null, L('Consulta do valor atualizado.', 'Query of the updated amount.')),
                            call(R('locatario'), 'pagarAluguel', [], '=valorDevido', 'sucesso', null, L('Pagamento do valor com encargos.', 'Payment including charges.'))
                        ]),
                    sc(L('Terceiro tenta pagar no lugar do locatário', 'Third party tries to pay instead of the tenant'), 'seguranca',
                        L('Somente o locatário pode pagar; isso evita registros indevidos de quitação.', 'Only the tenant may pay; this prevents improper payment records.'), [
                            call(R('Atacante'), 'pagarAluguel', [], money(p.valorAluguel), 'reverter', 'NaoAutorizado', L('A conta não autorizada deve ser recusada.', 'The unauthorized account must be rejected.'))
                        ]),
                    sc(L('Pagamento com valor menor que o devido', 'Payment below the amount due'), 'seguranca',
                        L('O contrato exige o valor exato; pagamentos parciais são recusados.', 'The contract requires the exact amount; partial payments are rejected.'), [
                            call(R('locatario'), 'pagarAluguel', [], money(p.valorAluguel / 2), 'reverter', 'ValorIncorreto', L('Metade do valor deve ser recusada.', 'Half the amount must be rejected.'))
                        ]),
                    sc(L('Saque indevido e saque duplicado', 'Improper and duplicate withdrawal'), 'seguranca',
                        L('Só o titular do crédito saca, e uma única vez.', 'Only the credit owner can withdraw, and only once.'), [
                            call(R('locatario'), 'pagarAluguel', [], money(p.valorAluguel), 'sucesso', null, L('Pagamento regular.', 'Regular payment.')),
                            call(R('Atacante'), 'sacar', [], null, 'reverter', 'SemSaldo', L('O atacante não tem crédito a sacar.', 'The attacker has no credit to withdraw.')),
                            call(R('locador'), 'sacar', [], null, 'sucesso', null, L('O locador saca.', 'The landlord withdraws.')),
                            call(R('locador'), 'sacar', [], null, 'reverter', 'SemSaldo', L('Um segundo saque deve ser recusado.', 'A second withdrawal must be rejected.'))
                        ])
                ];
                if (p.numeroParcelas <= 24) {
                    const steps = [];
                    for (let i = 0; i < p.numeroParcelas; i++) steps.push(call(R('locatario'), 'pagarAluguel', [], money(p.valorAluguel), 'sucesso', null, L('Parcela ', 'Installment ') + (i + 1) + '.'));
                    steps.push(query(R('locador'), 'situacao', [], '1', L('Após a última parcela, o contrato fica encerrado.', 'After the last installment, the agreement is closed.')));
                    steps.push(call(R('locatario'), 'pagarAluguel', [], money(p.valorAluguel), 'reverter', 'SituacaoInvalida', L('Não se aceitam pagamentos após o encerramento.', 'No payments are accepted after closing.')));
                    list.push(sc(L('Encerramento após a última parcela', 'Closing after the last installment'), 'funcionalidade',
                        L('Pagas todas as parcelas, o contrato se encerra e recusa novos pagamentos.', 'Once all installments are paid, the agreement closes and rejects further payments.'), steps));
                }
                return list;
            }
        },

        garantia: {
            name: { pt: 'Compra e venda com depósito em garantia', en: 'Sale with escrow deposit' },
            contract: { pt: 'CompraComGarantia', en: 'EscrowSale' },
            roles: [
                { key: 'comprador', pt: 'Comprador', en: 'Buyer' },
                { key: 'vendedor', pt: 'Vendedor', en: 'Seller' },
                { key: 'arbitro', pt: 'Arbitro', en: 'Arbitrator' }
            ],
            fields: [
                { key: 'preco', type: 'money', pt: 'Preço depositado', en: 'Deposited price', def: 50000 },
                { key: 'prazoEntregaDias', type: 'days', pt: 'Prazo de entrega (dias)', en: 'Delivery deadline (days)', def: 30, min: 1 }
            ],
            en: {
                CompraComGarantia: 'EscrowSale', AguardandoDeposito: 'AwaitingDeposit', Depositado: 'Deposited', EmDisputa: 'InDispute',
                Concluido: 'Completed', PrazoNaoEncerrado: 'DeadlineNotReached', comprador: 'buyer', vendedor: 'seller', arbitro: 'arbitrator',
                preco: 'price', prazoEntrega: 'deliveryPeriod', prazoFinal: 'deadline', apenasComprador: 'onlyBuyer', apenasArbitro: 'onlyArbitrator',
                Depositou: 'PriceDeposited', RecebimentoConfirmado: 'ReceiptConfirmed', ValorDevolvido: 'Refunded', DisputaAberta: 'DisputeOpened',
                DisputaDecidida: 'DisputeResolved', depositar: 'deposit', confirmarRecebimento: 'confirmReceipt', reaverPorFaltaDeEntrega: 'refundForNonDelivery',
                abrirDisputa: 'openDispute', decidirDisputa: 'resolveDispute', favorVendedor: 'favorSeller', parte: 'party', beneficiario: 'beneficiary',
                _comprador: '_buyer', _vendedor: '_seller', _arbitro: '_arbitrator', _preco: '_price', _prazoEntrega: '_deliveryPeriod'
            },
            code: () => `${HEADER('CompraComGarantia', '{{Preço retido em garantia até a confirmação da entrega, com devolução por atraso e decisão de árbitro em caso de disputa.|Price held in escrow until delivery is confirmed, with refund for delay and arbitrator decision in case of dispute.}}')}
contract CompraComGarantia {
    enum Situacao { AguardandoDeposito, Depositado, EmDisputa, Concluido }

    error NaoAutorizado();
    error ParametroInvalido();
    error SituacaoInvalida();
    error ValorIncorreto(uint256 devido, uint256 enviado);
    error PrazoNaoEncerrado(uint256 prazoFinal);
    error SemSaldo();
    error FalhaNoEnvio();
    error Reentrada();

    event Depositou(address indexed comprador, uint256 valor, uint256 prazoFinal);
    event RecebimentoConfirmado(address indexed comprador);
    event ValorDevolvido(address indexed comprador, uint256 valor);
    event DisputaAberta(address indexed parte);
    event DisputaDecidida(address indexed arbitro, address indexed beneficiario);
    event Saque(address indexed credor, uint256 valor);

    address public immutable comprador;
    address public immutable vendedor;
    address public immutable arbitro;
    uint256 public immutable preco;
    uint256 public immutable prazoEntrega; // {{em segundos, contado do depósito|in seconds, counted from the deposit}}

    Situacao public situacao;
    uint256 public prazoFinal;
    mapping(address => uint256) public saldos;
    bool private travado;

    modifier apenasComprador() {
        if (msg.sender != comprador) revert NaoAutorizado();
        _;
    }

    modifier apenasArbitro() {
        if (msg.sender != arbitro) revert NaoAutorizado();
        _;
    }

    modifier apenasPartes() {
        if (msg.sender != comprador && msg.sender != vendedor) revert NaoAutorizado();
        _;
    }
${GUARDS}

    constructor(address _comprador, address _vendedor, address _arbitro, uint256 _preco, uint256 _prazoEntrega) {
        if (_comprador == address(0) || _vendedor == address(0) || _arbitro == address(0)) revert ParametroInvalido();
        if (_comprador == _vendedor || _arbitro == _comprador || _arbitro == _vendedor) revert ParametroInvalido();
        if (_preco == 0 || _prazoEntrega == 0) revert ParametroInvalido();
        comprador = _comprador;
        vendedor = _vendedor;
        arbitro = _arbitro;
        preco = _preco;
        prazoEntrega = _prazoEntrega;
    }

    /// @notice {{Depósito do preço pelo comprador; inicia a contagem do prazo de entrega.|Buyer deposits the price; starts the delivery deadline.}}
    function depositar() external payable apenasComprador naSituacao(Situacao.AguardandoDeposito) {
        if (msg.value != preco) revert ValorIncorreto(preco, msg.value);
        prazoFinal = block.timestamp + prazoEntrega;
        situacao = Situacao.Depositado;
        emit Depositou(msg.sender, msg.value, prazoFinal);
    }

    /// @notice {{Confirmação do recebimento pelo comprador: o valor é liberado ao vendedor.|Buyer confirms receipt: the amount is released to the seller.}}
    /// @dev {{LIMITAÇÃO: a entrega física não é verificável pelo contrato; depende da confirmação da parte.|LIMITATION: physical delivery cannot be verified on-chain; it depends on the party's confirmation.}}
    function confirmarRecebimento() external apenasComprador naSituacao(Situacao.Depositado) {
        situacao = Situacao.Concluido;
        saldos[vendedor] += preco;
        emit RecebimentoConfirmado(msg.sender);
    }

    /// @notice {{Devolução ao comprador se o prazo de entrega se esgotar sem confirmação nem disputa.|Refund to the buyer if the delivery deadline passes without confirmation or dispute.}}
    function reaverPorFaltaDeEntrega() external apenasComprador naSituacao(Situacao.Depositado) {
        if (block.timestamp <= prazoFinal) revert PrazoNaoEncerrado(prazoFinal);
        situacao = Situacao.Concluido;
        saldos[comprador] += preco;
        emit ValorDevolvido(msg.sender, preco);
    }

    /// @notice {{Qualquer das partes pode submeter a divergência ao árbitro.|Either party may refer the dispute to the arbitrator.}}
    function abrirDisputa() external apenasPartes naSituacao(Situacao.Depositado) {
        situacao = Situacao.EmDisputa;
        emit DisputaAberta(msg.sender);
    }

    /// @notice {{Decisão do árbitro sobre a destinação do valor.|Arbitrator's decision on where the funds go.}}
    function decidirDisputa(bool favorVendedor) external apenasArbitro naSituacao(Situacao.EmDisputa) {
        situacao = Situacao.Concluido;
        address beneficiario = favorVendedor ? vendedor : comprador;
        saldos[beneficiario] += preco;
        emit DisputaDecidida(msg.sender, beneficiario);
    }
${WITHDRAW}
}${FOOTER}`,
            deployArgs: (p, R, money) => [R('comprador'), R('vendedor'), R('arbitro'), money(p.preco), p.prazoEntregaDias + ' days'],
            scenarios: (p, R, money, L) => [
                sc(L('Depósito, confirmação e saque pelo vendedor', 'Deposit, confirmation and seller withdrawal'), 'funcionalidade',
                    L('Fluxo normal: o preço fica retido e é liberado com a confirmação do recebimento.', 'Normal flow: the price is held and released upon confirmation of receipt.'), [
                        call(R('comprador'), 'depositar', [], money(p.preco), 'sucesso', null, L('O comprador deposita o preço.', 'The buyer deposits the price.')),
                        call(R('comprador'), 'confirmarRecebimento', [], null, 'sucesso', null, L('O comprador confirma o recebimento.', 'The buyer confirms receipt.')),
                        call(R('vendedor'), 'sacar', [], null, 'sucesso', null, L('O vendedor saca o preço.', 'The seller withdraws the price.'))
                    ]),
                sc(L('Devolução por falta de entrega no prazo', 'Refund for non-delivery'), 'funcionalidade',
                    L('Esgotado o prazo sem confirmação, o comprador reaver o valor.', 'After the deadline without confirmation, the buyer recovers the amount.'), [
                        call(R('comprador'), 'depositar', [], money(p.preco), 'sucesso', null, L('Depósito.', 'Deposit.')),
                        wait((p.prazoEntregaDias + 1) + ' days', L('O prazo de entrega se esgota.', 'The delivery deadline passes.')),
                        call(R('comprador'), 'reaverPorFaltaDeEntrega', [], null, 'sucesso', null, L('O comprador pede a devolução.', 'The buyer requests the refund.')),
                        call(R('comprador'), 'sacar', [], null, 'sucesso', null, L('O comprador saca o valor.', 'The buyer withdraws the amount.'))
                    ]),
                sc(L('Devolução pedida antes do prazo', 'Refund requested before the deadline'), 'seguranca',
                    L('O comprador não pode desfazer o negócio antes de esgotado o prazo de entrega.', 'The buyer cannot unwind the deal before the delivery deadline.'), [
                        call(R('comprador'), 'depositar', [], money(p.preco), 'sucesso', null, L('Depósito.', 'Deposit.')),
                        call(R('comprador'), 'reaverPorFaltaDeEntrega', [], null, 'reverter', 'PrazoNaoEncerrado', L('O pedido antecipado deve ser recusado.', 'The early request must be rejected.'))
                    ]),
                sc(L('Vendedor tenta liberar o valor para si', 'Seller tries to release the funds'), 'seguranca',
                    L('Só o comprador confirma o recebimento.', 'Only the buyer confirms receipt.'), [
                        call(R('comprador'), 'depositar', [], money(p.preco), 'sucesso', null, L('Depósito.', 'Deposit.')),
                        call(R('vendedor'), 'confirmarRecebimento', [], null, 'reverter', 'NaoAutorizado', L('O vendedor não pode confirmar em nome do comprador.', 'The seller cannot confirm on the buyer\'s behalf.'))
                    ]),
                sc(L('Disputa decidida pelo árbitro', 'Dispute decided by the arbitrator'), 'funcionalidade',
                    L('Havendo divergência, só o árbitro decide a destinação do valor.', 'In a dispute, only the arbitrator decides where the funds go.'), [
                        call(R('comprador'), 'depositar', [], money(p.preco), 'sucesso', null, L('Depósito.', 'Deposit.')),
                        call(R('vendedor'), 'abrirDisputa', [], null, 'sucesso', null, L('O vendedor abre disputa.', 'The seller opens a dispute.')),
                        call(R('Atacante'), 'decidirDisputa', ['true'], null, 'reverter', 'NaoAutorizado', L('Terceiro não pode decidir.', 'A third party cannot decide.')),
                        call(R('arbitro'), 'decidirDisputa', ['true'], null, 'sucesso', null, L('O árbitro decide a favor do vendedor.', 'The arbitrator decides for the seller.')),
                        call(R('vendedor'), 'sacar', [], null, 'sucesso', null, L('O vendedor saca.', 'The seller withdraws.'))
                    ]),
                sc(L('Depósito com valor incorreto', 'Deposit with wrong amount'), 'seguranca',
                    L('O depósito deve corresponder exatamente ao preço.', 'The deposit must match the price exactly.'), [
                        call(R('comprador'), 'depositar', [], money(p.preco / 2), 'reverter', 'ValorIncorreto', L('Metade do preço deve ser recusada.', 'Half the price must be rejected.'))
                    ])
            ]
        },

        servicos: {
            name: { pt: 'Prestação de serviços por etapas', en: 'Milestone-based services' },
            contract: { pt: 'ServicosPorEtapas', en: 'MilestoneServices' },
            roles: [
                { key: 'contratante', pt: 'Contratante', en: 'Client' },
                { key: 'contratado', pt: 'Contratado', en: 'Contractor' }
            ],
            fields: [
                { key: 'valorTotal', type: 'money', pt: 'Valor total', en: 'Total amount', def: 30000 },
                { key: 'numeroEtapas', type: 'int', pt: 'Número de etapas', en: 'Number of milestones', def: 3, min: 1, max: 100 },
                { key: 'prazoAprovacaoDias', type: 'days', pt: 'Prazo para aprovar ou recusar (dias)', en: 'Approval period (days)', def: 5, min: 1 }
            ],
            en: {
                ServicosPorEtapas: 'MilestoneServices', AguardandoDeposito: 'AwaitingDeposit', EmExecucao: 'InProgress',
                EtapaJaEntregue: 'MilestoneAlreadyDelivered', EtapaNaoEntregue: 'MilestoneNotDelivered', PrazoNaoEncerrado: 'PeriodNotOver', PrazoEncerrado: 'PeriodOver',
                contratante: 'client', contratado: 'contractor', valorTotal: 'totalAmount', numeroEtapas: 'milestones', prazoAprovacao: 'approvalPeriod',
                etapasAprovadas: 'approvedMilestones', entregueEm: 'deliveredAt', valorPago: 'amountPaid', apenasContratante: 'onlyClient', apenasContratado: 'onlyContractor',
                Depositado: 'Funded', EtapaEntregue: 'MilestoneDelivered', EtapaAprovada: 'MilestoneApproved', EtapaRecusada: 'MilestoneRejected', Rescindido: 'Terminated',
                tacita: 'tacit', motivo: 'reason', etapa: 'milestone', devolvido: 'refunded', restante: 'remaining',
                depositar: 'fund', entregarEtapa: 'deliverMilestone', aprovarEtapa: 'approveMilestone', recusarEtapa: 'rejectMilestone',
                aprovarPorDecursoDePrazo: 'approveByTimeout', rescindir: 'terminate', valorDaEtapa: 'milestoneAmount', _aprovar: '_approve', indice: 'index',
                _contratante: '_client', _contratado: '_contractor', _valorTotal: '_totalAmount', _numeroEtapas: '_milestones', _prazoAprovacao: '_approvalPeriod'
            },
            code: () => `${HEADER('ServicosPorEtapas', '{{Pagamento por etapa aprovada, com aprovação tácita após o prazo e rescisão a qualquer tempo.|Payment per approved milestone, with tacit approval after the period and termination at any time.}}')}
contract ServicosPorEtapas {
    enum Situacao { AguardandoDeposito, EmExecucao, Encerrado }

    error NaoAutorizado();
    error ParametroInvalido();
    error SituacaoInvalida();
    error ValorIncorreto(uint256 devido, uint256 enviado);
    error EtapaJaEntregue();
    error EtapaNaoEntregue();
    error PrazoNaoEncerrado(uint256 limite);
    error PrazoEncerrado(uint256 limite);
    error SemSaldo();
    error FalhaNoEnvio();
    error Reentrada();

    event Depositado(address indexed contratante, uint256 valor);
    event EtapaEntregue(uint256 indexed etapa, uint256 quando);
    event EtapaAprovada(uint256 indexed etapa, uint256 valor, bool tacita);
    event EtapaRecusada(uint256 indexed etapa, string motivo);
    event Rescindido(address indexed parte, uint256 devolvido);
    event Saque(address indexed credor, uint256 valor);

    address public immutable contratante;
    address public immutable contratado;
    uint256 public immutable valorTotal;
    uint256 public immutable numeroEtapas;
    uint256 public immutable prazoAprovacao; // {{em segundos|in seconds}}

    Situacao public situacao;
    uint256 public etapasAprovadas;
    uint256 public entregueEm; // {{0 enquanto a etapa atual não foi entregue|0 while the current milestone has not been delivered}}
    uint256 public valorPago;
    mapping(address => uint256) public saldos;
    bool private travado;

    modifier apenasContratante() {
        if (msg.sender != contratante) revert NaoAutorizado();
        _;
    }

    modifier apenasContratado() {
        if (msg.sender != contratado) revert NaoAutorizado();
        _;
    }

    modifier apenasPartes() {
        if (msg.sender != contratante && msg.sender != contratado) revert NaoAutorizado();
        _;
    }
${GUARDS}

    constructor(address _contratante, address _contratado, uint256 _valorTotal, uint256 _numeroEtapas, uint256 _prazoAprovacao) {
        if (_contratante == address(0) || _contratado == address(0) || _contratante == _contratado) revert ParametroInvalido();
        if (_valorTotal == 0 || _numeroEtapas == 0 || _prazoAprovacao == 0 || _valorTotal < _numeroEtapas) revert ParametroInvalido();
        contratante = _contratante;
        contratado = _contratado;
        valorTotal = _valorTotal;
        numeroEtapas = _numeroEtapas;
        prazoAprovacao = _prazoAprovacao;
    }

    /// @notice {{Valor da etapa de índice informado (a última absorve o resto da divisão).|Amount of the given milestone (the last one absorbs the division remainder).}}
    function valorDaEtapa(uint256 indice) public view returns (uint256) {
        uint256 base = valorTotal / numeroEtapas;
        return indice + 1 == numeroEtapas ? valorTotal - base * (numeroEtapas - 1) : base;
    }

    /// @notice {{Depósito do valor total pelo contratante, que fica retido até a aprovação de cada etapa.|Client deposits the total amount, held until each milestone is approved.}}
    function depositar() external payable apenasContratante naSituacao(Situacao.AguardandoDeposito) {
        if (msg.value != valorTotal) revert ValorIncorreto(valorTotal, msg.value);
        situacao = Situacao.EmExecucao;
        emit Depositado(msg.sender, msg.value);
    }

    /// @notice {{Registro da entrega da etapa atual pelo contratado.|Contractor records delivery of the current milestone.}}
    function entregarEtapa() external apenasContratado naSituacao(Situacao.EmExecucao) {
        if (entregueEm != 0) revert EtapaJaEntregue();
        entregueEm = block.timestamp;
        emit EtapaEntregue(etapasAprovadas + 1, block.timestamp);
    }

    /// @notice {{Aprovação expressa da etapa entregue.|Express approval of the delivered milestone.}}
    function aprovarEtapa() external apenasContratante naSituacao(Situacao.EmExecucao) {
        if (entregueEm == 0) revert EtapaNaoEntregue();
        _aprovar(false);
    }

    /// @notice {{Recusa fundamentada, dentro do prazo; a etapa volta a ficar pendente de entrega.|Reasoned rejection within the period; the milestone returns to pending delivery.}}
    function recusarEtapa(string calldata motivo) external apenasContratante naSituacao(Situacao.EmExecucao) {
        if (entregueEm == 0) revert EtapaNaoEntregue();
        if (block.timestamp > entregueEm + prazoAprovacao) revert PrazoEncerrado(entregueEm + prazoAprovacao);
        if (bytes(motivo).length == 0) revert ParametroInvalido();
        entregueEm = 0;
        emit EtapaRecusada(etapasAprovadas + 1, motivo);
    }

    /// @notice {{Aprovação tácita: o silêncio do contratante após o prazo importa aprovação.|Tacit approval: the client's silence after the period means approval.}}
    /// @dev {{LIMITAÇÃO: "dias úteis" foram aproximados por dias corridos.|LIMITATION: "business days" were approximated by calendar days.}}
    function aprovarPorDecursoDePrazo() external apenasContratado naSituacao(Situacao.EmExecucao) {
        if (entregueEm == 0) revert EtapaNaoEntregue();
        if (block.timestamp <= entregueEm + prazoAprovacao) revert PrazoNaoEncerrado(entregueEm + prazoAprovacao);
        _aprovar(true);
    }

    /// @notice {{Rescisão por qualquer das partes: são devidas apenas as etapas já aprovadas; o restante volta ao contratante.|Termination by either party: only approved milestones are owed; the rest returns to the client.}}
    function rescindir() external apenasPartes naSituacao(Situacao.EmExecucao) {
        uint256 restante = valorTotal - valorPago;
        situacao = Situacao.Encerrado;
        saldos[contratante] += restante;
        emit Rescindido(msg.sender, restante);
    }

    function _aprovar(bool tacita) private {
        uint256 valor = valorDaEtapa(etapasAprovadas);
        etapasAprovadas += 1;
        entregueEm = 0;
        valorPago += valor;
        saldos[contratado] += valor;
        emit EtapaAprovada(etapasAprovadas, valor, tacita);
        if (etapasAprovadas == numeroEtapas) situacao = Situacao.Encerrado;
    }
${WITHDRAW}
}${FOOTER}`,
            deployArgs: (p, R, money) => [R('contratante'), R('contratado'), money(p.valorTotal), String(p.numeroEtapas), p.prazoAprovacaoDias + ' days'],
            scenarios: (p, R, money, L) => [
                sc(L('Etapa entregue, aprovada e paga', 'Milestone delivered, approved and paid'), 'funcionalidade',
                    L('Fluxo normal: depósito, entrega, aprovação e saque da etapa.', 'Normal flow: funding, delivery, approval and milestone withdrawal.'), [
                        call(R('contratante'), 'depositar', [], money(p.valorTotal), 'sucesso', null, L('O contratante deposita o valor total.', 'The client funds the total amount.')),
                        call(R('contratado'), 'entregarEtapa', [], null, 'sucesso', null, L('O contratado entrega a etapa.', 'The contractor delivers the milestone.')),
                        call(R('contratante'), 'aprovarEtapa', [], null, 'sucesso', null, L('O contratante aprova.', 'The client approves.')),
                        query(R('contratado'), 'etapasAprovadas', [], '1', L('Uma etapa aprovada.', 'One milestone approved.')),
                        call(R('contratado'), 'sacar', [], null, 'sucesso', null, L('O contratado saca o valor da etapa.', 'The contractor withdraws the milestone amount.'))
                    ]),
                sc(L('Aprovação tácita pelo decurso do prazo', 'Tacit approval after the period'), 'funcionalidade',
                    L('O silêncio do contratante após o prazo importa aprovação.', 'The client\'s silence after the period means approval.'), [
                        call(R('contratante'), 'depositar', [], money(p.valorTotal), 'sucesso', null, L('Depósito.', 'Funding.')),
                        call(R('contratado'), 'entregarEtapa', [], null, 'sucesso', null, L('Entrega.', 'Delivery.')),
                        wait((p.prazoAprovacaoDias + 1) + ' days', L('O prazo de aprovação se esgota.', 'The approval period ends.')),
                        call(R('contratado'), 'aprovarPorDecursoDePrazo', [], null, 'sucesso', null, L('O contratado registra a aprovação tácita.', 'The contractor records tacit approval.'))
                    ]),
                sc(L('Aprovação tácita antes do prazo', 'Tacit approval before the period ends'), 'seguranca',
                    L('O contratado não pode antecipar a aprovação tácita.', 'The contractor cannot anticipate tacit approval.'), [
                        call(R('contratante'), 'depositar', [], money(p.valorTotal), 'sucesso', null, L('Depósito.', 'Funding.')),
                        call(R('contratado'), 'entregarEtapa', [], null, 'sucesso', null, L('Entrega.', 'Delivery.')),
                        call(R('contratado'), 'aprovarPorDecursoDePrazo', [], null, 'reverter', 'PrazoNaoEncerrado', L('A tentativa antecipada deve ser recusada.', 'The early attempt must be rejected.'))
                    ]),
                sc(L('Recusa fundamentada da entrega', 'Reasoned rejection of the delivery'), 'funcionalidade',
                    L('A recusa devolve a etapa à situação de pendente; não é possível aprová-la sem nova entrega.', 'Rejection returns the milestone to pending; it cannot be approved without a new delivery.'), [
                        call(R('contratante'), 'depositar', [], money(p.valorTotal), 'sucesso', null, L('Depósito.', 'Funding.')),
                        call(R('contratado'), 'entregarEtapa', [], null, 'sucesso', null, L('Entrega.', 'Delivery.')),
                        call(R('contratante'), 'recusarEtapa', [L('Entrega incompleta', 'Incomplete delivery')], null, 'sucesso', null, L('Recusa com motivo.', 'Rejection with reason.')),
                        call(R('contratante'), 'aprovarEtapa', [], null, 'reverter', 'EtapaNaoEntregue', L('Sem nova entrega, não há o que aprovar.', 'Without a new delivery, there is nothing to approve.'))
                    ]),
                sc(L('Rescisão com devolução das etapas não aprovadas', 'Termination with refund of unapproved milestones'), 'funcionalidade',
                    L('Rescindido o contrato, o contratante recebe de volta o valor das etapas não aprovadas.', 'Upon termination, the client recovers the amount of unapproved milestones.'), [
                        call(R('contratante'), 'depositar', [], money(p.valorTotal), 'sucesso', null, L('Depósito.', 'Funding.')),
                        call(R('contratado'), 'entregarEtapa', [], null, 'sucesso', null, L('Entrega da primeira etapa.', 'First milestone delivered.')),
                        call(R('contratante'), 'aprovarEtapa', [], null, 'sucesso', null, L('Aprovação.', 'Approval.')),
                        call(R('contratante'), 'rescindir', [], null, 'sucesso', null, L('O contratante rescinde.', 'The client terminates.')),
                        call(R('contratante'), 'sacar', [], null, 'sucesso', null, L('O contratante saca o valor restante.', 'The client withdraws the remaining amount.'))
                    ]),
                sc(L('Terceiro tenta aprovar ou rescindir', 'Third party tries to approve or terminate'), 'seguranca',
                    L('Somente as partes podem praticar os atos do contrato.', 'Only the parties can act under the agreement.'), [
                        call(R('contratante'), 'depositar', [], money(p.valorTotal), 'sucesso', null, L('Depósito.', 'Funding.')),
                        call(R('Atacante'), 'rescindir', [], null, 'reverter', 'NaoAutorizado', L('O atacante não pode rescindir.', 'The attacker cannot terminate.')),
                        call(R('contratado'), 'aprovarEtapa', [], null, 'reverter', 'NaoAutorizado', L('O contratado não pode aprovar a própria entrega.', 'The contractor cannot approve its own delivery.'))
                    ])
            ]
        },

        mutuo: {
            name: { pt: 'Mútuo (empréstimo) em parcelas', en: 'Loan repaid in installments' },
            contract: { pt: 'ContratoDeMutuo', en: 'LoanAgreement' },
            roles: [
                { key: 'mutuante', pt: 'Mutuante', en: 'Lender' },
                { key: 'mutuario', pt: 'Mutuario', en: 'Borrower' }
            ],
            fields: [
                { key: 'valorEmprestimo', type: 'money', pt: 'Valor emprestado', en: 'Loan amount', def: 12000 },
                { key: 'numeroParcelas', type: 'int', pt: 'Número de parcelas', en: 'Number of installments', def: 12, min: 1, max: 600 },
                { key: 'valorParcela', type: 'money', pt: 'Valor de cada parcela', en: 'Installment amount', def: 1050 },
                { key: 'periodoDias', type: 'days', pt: 'Periodicidade (dias)', en: 'Period (days)', def: 30, min: 1 },
                { key: 'atrasoVencimentoDias', type: 'days', pt: 'Atraso que autoriza o vencimento antecipado (dias)', en: 'Delay that accelerates the debt (days)', def: 60, min: 1 }
            ],
            en: {
                ContratoDeMutuo: 'LoanAgreement', AguardandoLiberacao: 'AwaitingDisbursement', VencidoAntecipadamente: 'Accelerated', Quitado: 'Repaid',
                SemAtrasoSuficiente: 'NotLateEnough', mutuante: 'lender', mutuario: 'borrower', valorEmprestimo: 'loanAmount', numeroParcelas: 'installments',
                valorParcela: 'installmentAmount', periodo: 'period', atrasoVencimento: 'accelerationDelay', liberadoEm: 'disbursedAt', parcelasPagas: 'paidInstallments',
                apenasMutuante: 'onlyLender', apenasMutuario: 'onlyBorrower', Liberado: 'Disbursed', ParcelaPaga: 'InstallmentPaid', VencimentoAntecipado: 'Acceleration',
                SaldoQuitado: 'BalanceRepaid', liberar: 'disburse', vencimentoDaParcela: 'installmentDueDate', saldoDevedor: 'outstandingBalance', pagarParcela: 'payInstallment',
                declararVencimentoAntecipado: 'declareAcceleration', quitarSaldo: 'repayBalance', numero: 'number', parcela: 'installment', limite: 'limit', saldo: 'balance',
                _mutuante: '_lender', _mutuario: '_borrower', _valorEmprestimo: '_loanAmount', _numeroParcelas: '_installments', _valorParcela: '_installmentAmount',
                _periodo: '_period', _atrasoVencimento: '_accelerationDelay'
            },
            code: () => `${HEADER('ContratoDeMutuo', '{{Empréstimo restituído em parcelas, com vencimento antecipado da dívida em caso de atraso prolongado.|Loan repaid in installments, with debt acceleration in case of prolonged delay.}}')}
contract ContratoDeMutuo {
    enum Situacao { AguardandoLiberacao, Ativo, VencidoAntecipadamente, Quitado }

    error NaoAutorizado();
    error ParametroInvalido();
    error SituacaoInvalida();
    error ValorIncorreto(uint256 devido, uint256 enviado);
    error SemAtrasoSuficiente(uint256 limite);
    error SemSaldo();
    error FalhaNoEnvio();
    error Reentrada();

    event Liberado(address indexed mutuante, uint256 valor);
    event ParcelaPaga(uint256 indexed numero, uint256 valor);
    event VencimentoAntecipado(uint256 saldo);
    event SaldoQuitado(uint256 valor);
    event Saque(address indexed credor, uint256 valor);

    address public immutable mutuante;
    address public immutable mutuario;
    uint256 public immutable valorEmprestimo;
    uint256 public immutable numeroParcelas;
    uint256 public immutable valorParcela;
    uint256 public immutable periodo;           // {{em segundos|in seconds}}
    uint256 public immutable atrasoVencimento;  // {{em segundos|in seconds}}

    Situacao public situacao;
    uint256 public liberadoEm;
    uint256 public parcelasPagas;
    mapping(address => uint256) public saldos;
    bool private travado;

    modifier apenasMutuante() {
        if (msg.sender != mutuante) revert NaoAutorizado();
        _;
    }

    modifier apenasMutuario() {
        if (msg.sender != mutuario) revert NaoAutorizado();
        _;
    }
${GUARDS}

    constructor(
        address _mutuante,
        address _mutuario,
        uint256 _valorEmprestimo,
        uint256 _numeroParcelas,
        uint256 _valorParcela,
        uint256 _periodo,
        uint256 _atrasoVencimento
    ) {
        if (_mutuante == address(0) || _mutuario == address(0) || _mutuante == _mutuario) revert ParametroInvalido();
        if (_valorEmprestimo == 0 || _numeroParcelas == 0 || _valorParcela == 0 || _periodo == 0 || _atrasoVencimento == 0) revert ParametroInvalido();
        mutuante = _mutuante;
        mutuario = _mutuario;
        valorEmprestimo = _valorEmprestimo;
        numeroParcelas = _numeroParcelas;
        valorParcela = _valorParcela;
        periodo = _periodo;
        atrasoVencimento = _atrasoVencimento;
    }

    /// @notice {{Liberação do valor pelo mutuante; o crédito fica disponível para saque do mutuário.|Lender disburses the amount; the credit becomes available for the borrower to withdraw.}}
    function liberar() external payable apenasMutuante naSituacao(Situacao.AguardandoLiberacao) {
        if (msg.value != valorEmprestimo) revert ValorIncorreto(valorEmprestimo, msg.value);
        liberadoEm = block.timestamp;
        situacao = Situacao.Ativo;
        saldos[mutuario] += msg.value;
        emit Liberado(msg.sender, msg.value);
    }

    /// @notice {{Vencimento da parcela de número informado (a primeira vence um período após a liberação).|Due date of the given installment (the first is due one period after disbursement).}}
    function vencimentoDaParcela(uint256 numero) public view returns (uint256) {
        return liberadoEm + numero * periodo;
    }

    /// @notice {{Saldo devedor: parcelas ainda não pagas.|Outstanding balance: installments not yet paid.}}
    function saldoDevedor() public view returns (uint256) {
        return (numeroParcelas - parcelasPagas) * valorParcela;
    }

    /// @notice {{Pagamento da próxima parcela pelo mutuário, pelo valor exato.|Borrower pays the next installment, for the exact amount.}}
    function pagarParcela() external payable apenasMutuario naSituacao(Situacao.Ativo) {
        if (msg.value != valorParcela) revert ValorIncorreto(valorParcela, msg.value);
        parcelasPagas += 1;
        saldos[mutuante] += msg.value;
        emit ParcelaPaga(parcelasPagas, msg.value);
        if (parcelasPagas == numeroParcelas) situacao = Situacao.Quitado;
    }

    /// @notice {{Vencimento antecipado, se a parcela em aberto estiver atrasada além do limite contratual.|Debt acceleration if the open installment is late beyond the contractual limit.}}
    function declararVencimentoAntecipado() external apenasMutuante naSituacao(Situacao.Ativo) {
        uint256 limite = vencimentoDaParcela(parcelasPagas + 1) + atrasoVencimento;
        if (block.timestamp <= limite) revert SemAtrasoSuficiente(limite);
        situacao = Situacao.VencidoAntecipadamente;
        emit VencimentoAntecipado(saldoDevedor());
    }

    /// @notice {{Quitação integral do saldo devedor pelo mutuário.|Borrower repays the entire outstanding balance.}}
    function quitarSaldo() external payable apenasMutuario {
        if (situacao != Situacao.Ativo && situacao != Situacao.VencidoAntecipadamente) revert SituacaoInvalida();
        uint256 saldo = saldoDevedor();
        if (msg.value != saldo) revert ValorIncorreto(saldo, msg.value);
        parcelasPagas = numeroParcelas;
        situacao = Situacao.Quitado;
        saldos[mutuante] += msg.value;
        emit SaldoQuitado(msg.value);
    }
${WITHDRAW}
}${FOOTER}`,
            deployArgs: (p, R, money) => [R('mutuante'), R('mutuario'), money(p.valorEmprestimo), String(p.numeroParcelas), money(p.valorParcela), p.periodoDias + ' days', p.atrasoVencimentoDias + ' days'],
            scenarios: (p, R, money, L) => [
                sc(L('Liberação, saque e pagamento de parcela', 'Disbursement, withdrawal and installment payment'), 'funcionalidade',
                    L('Fluxo normal: o mutuante libera, o mutuário saca e paga a primeira parcela.', 'Normal flow: the lender disburses, the borrower withdraws and pays the first installment.'), [
                        call(R('mutuante'), 'liberar', [], money(p.valorEmprestimo), 'sucesso', null, L('Liberação do empréstimo.', 'Loan disbursement.')),
                        call(R('mutuario'), 'sacar', [], null, 'sucesso', null, L('O mutuário saca o valor emprestado.', 'The borrower withdraws the loan.')),
                        call(R('mutuario'), 'pagarParcela', [], money(p.valorParcela), 'sucesso', null, L('Pagamento da primeira parcela.', 'First installment paid.')),
                        query(R('mutuante'), 'parcelasPagas', [], '1', L('Uma parcela paga.', 'One installment paid.'))
                    ]),
                sc(L('Vencimento antecipado sem atraso suficiente', 'Acceleration without enough delay'), 'seguranca',
                    L('O mutuante só pode antecipar o vencimento após o atraso previsto no contrato.', 'The lender can accelerate only after the contractual delay.'), [
                        call(R('mutuante'), 'liberar', [], money(p.valorEmprestimo), 'sucesso', null, L('Liberação.', 'Disbursement.')),
                        wait((p.periodoDias + Math.max(1, Math.floor(p.atrasoVencimentoDias / 2))) + ' days', L('Atraso menor que o limite.', 'Delay below the limit.')),
                        call(R('mutuante'), 'declararVencimentoAntecipado', [], null, 'reverter', 'SemAtrasoSuficiente', L('A antecipação deve ser recusada.', 'The acceleration must be rejected.'))
                    ]),
                sc(L('Vencimento antecipado e quitação do saldo', 'Acceleration and repayment of the balance'), 'funcionalidade',
                    L('Superado o atraso previsto, a dívida vence antecipadamente e pode ser quitada de uma vez.', 'Once the contractual delay is exceeded, the debt is accelerated and can be repaid at once.'), [
                        call(R('mutuante'), 'liberar', [], money(p.valorEmprestimo), 'sucesso', null, L('Liberação.', 'Disbursement.')),
                        wait((p.periodoDias + p.atrasoVencimentoDias + 1) + ' days', L('Atraso superior ao limite.', 'Delay beyond the limit.')),
                        call(R('mutuante'), 'declararVencimentoAntecipado', [], null, 'sucesso', null, L('O mutuante declara o vencimento antecipado.', 'The lender declares acceleration.')),
                        query(R('mutuante'), 'situacao', [], '2', L('Situação: vencido antecipadamente.', 'Status: accelerated.')),
                        call(R('mutuario'), 'quitarSaldo', [], '=saldoDevedor', 'sucesso', null, L('O mutuário quita o saldo devedor.', 'The borrower repays the balance.'))
                    ]),
                sc(L('Terceiro tenta pagar ou antecipar', 'Third party tries to pay or accelerate'), 'seguranca',
                    L('Só as partes legitimadas praticam os atos do contrato.', 'Only the entitled parties can act under the agreement.'), [
                        call(R('mutuante'), 'liberar', [], money(p.valorEmprestimo), 'sucesso', null, L('Liberação.', 'Disbursement.')),
                        call(R('Atacante'), 'pagarParcela', [], money(p.valorParcela), 'reverter', 'NaoAutorizado', L('Pagamento por terceiro recusado.', 'Third-party payment rejected.')),
                        call(R('mutuario'), 'declararVencimentoAntecipado', [], null, 'reverter', 'NaoAutorizado', L('O mutuário não pode declarar o vencimento.', 'The borrower cannot declare acceleration.'))
                    ]),
                sc(L('Liberação com valor incorreto', 'Disbursement with wrong amount'), 'seguranca',
                    L('A liberação deve corresponder exatamente ao valor contratado.', 'The disbursement must match the contracted amount exactly.'), [
                        call(R('mutuante'), 'liberar', [], money(p.valorEmprestimo / 2), 'reverter', 'ValorIncorreto', L('Metade do valor deve ser recusada.', 'Half the amount must be rejected.'))
                    ])
            ]
        }
    };

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------
    function bps(percent) { return Math.round(Number(percent || 0) * 100); }
    function sc(titulo, tipo, objetivo, passos) { return { titulo, tipo, objetivo, passos }; }
    function call(conta, funcao, argumentos, valor, esperado, erroEsperado, explicacao) {
        const s = { acao: 'chamar', conta, funcao, argumentos, esperado, explicacao };
        if (valor) s.valor = valor;
        if (erroEsperado) s.erroEsperado = erroEsperado;
        return s;
    }
    function query(conta, funcao, argumentos, resultadoEsperado, explicacao) {
        const s = { acao: 'consultar', conta, funcao, argumentos, esperado: 'sucesso', explicacao };
        if (resultadoEsperado != null) s.resultadoEsperado = resultadoEsperado;
        return s;
    }
    function wait(segundos, explicacao) { return { acao: 'avancarTempo', segundos, explicacao }; }

    function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    /** Aplica idioma: trechos {{pt|en}} e, em inglês, troca de identificadores. */
    function localize(code, tpl, lang) {
        let out = code.replace(/\{\{([^|{}]*)\|([^{}]*)\}\}/g, (m, pt, en) => (lang === 'en' ? en : pt));
        if (lang === 'en') {
            const map = Object.assign({}, COMMON_EN, tpl.en);
            const keys = Object.keys(map).sort((a, b) => b.length - a.length);
            const re = new RegExp('(?<![\\w$])(' + keys.map(escapeRe).join('|') + ')(?![\\w$])', 'g');
            out = out.split('\n').map(line => {
                // Não altera o texto de comentários (já em inglês) nem literais.
                const idx = line.indexOf('//');
                const head = idx === -1 ? line : line.slice(0, idx);
                const tail = idx === -1 ? '' : line.slice(idx);
                return head.replace(/"[^"]*"|[^"]+/g, part => part.startsWith('"') ? part : part.replace(re, k => map[k])) + tail;
            }).join('\n');
        }
        return out;
    }

    function nameMapper(tpl, lang) {
        if (lang !== 'en') return n => n;
        const map = Object.assign({}, COMMON_EN, tpl.en);
        return n => (n in map ? map[n] : n);
    }

    function roleLabel(tpl, key, lang) {
        if (key === 'Atacante') return lang === 'en' ? 'Attacker' : 'Atacante';
        const r = tpl.roles.find(x => x.key === key);
        return r ? r[lang === 'en' ? 'en' : 'pt'] : key;
    }

    function formatEther(n) {
        const fixed = Number(n).toFixed(6).replace(/\.?0+$/, '');
        return fixed === '' ? '0' : fixed;
    }

    /** Normaliza e valida os parâmetros; devolve { params, errors }. */
    function normalize(type, raw) {
        const tpl = TEMPLATES[type];
        const params = {};
        const errors = [];
        for (const f of tpl.fields) {
            let v = raw && raw[f.key] != null && raw[f.key] !== '' ? Number(String(raw[f.key]).replace(',', '.')) : f.def;
            if (!Number.isFinite(v) || v < 0) { errors.push(f.key); v = f.def; }
            if (f.type === 'int' || f.type === 'days') v = Math.round(v);
            if (f.min != null && v < f.min) { errors.push(f.key); v = f.min; }
            if (f.max != null && v > f.max) { errors.push(f.key); v = f.max; }
            if (f.type === 'percent' && v > 100) { errors.push(f.key); v = 100; }
            if (f.type === 'money' && v <= 0) { errors.push(f.key); v = f.def; }
            params[f.key] = v;
        }
        params.escala = raw && Number(raw.escala) > 0 ? Number(raw.escala) : 1000;
        return { params, errors };
    }

    /** Código Solidity do modelo, no idioma pedido. */
    function build(type, raw, lang) {
        const tpl = TEMPLATES[type];
        return localize(tpl.code(), tpl, lang);
    }

    /** Plano de implantação e cenários no formato executado pelo Laboratório. */
    function plan(type, raw, lang) {
        const tpl = TEMPLATES[type];
        const { params } = normalize(type, raw);
        const N = nameMapper(tpl, lang);
        const R = key => '@' + roleLabel(tpl, key, lang);
        const money = amount => formatEther(amount / params.escala) + ' ether';
        const L = (pt, en) => (lang === 'en' ? en : pt);
        const moneyFields = tpl.fields.filter(f => f.type === 'money').map(f => params[f.key] / params.escala);
        const needed = Math.max.apply(null, moneyFields.concat([1])) * (params.numeroParcelas || params.numeroEtapas || 1) * 2;
        const balance = String(Math.max(100, Math.ceil(needed + 10)));
        const scenarios = tpl.scenarios(params, R, money, L).map(s => Object.assign({}, s, {
            passos: s.passos.map(p => Object.assign({}, p, {
                funcao: p.funcao ? N(p.funcao) : p.funcao,
                erroEsperado: p.erroEsperado ? N(p.erroEsperado) : p.erroEsperado,
                valor: p.valor && p.valor.startsWith('=') ? '=' + N(p.valor.slice(1)) : p.valor
            }))
        }));
        return {
            contrato: tpl.contract[lang === 'en' ? 'en' : 'pt'],
            contas: tpl.roles.map(r => ({ nome: r[lang === 'en' ? 'en' : 'pt'], saldoEther: balance }))
                .concat([{ nome: lang === 'en' ? 'Attacker' : 'Atacante', saldoEther: balance }]),
            implantacao: { conta: R(tpl.roles[0].key), argumentos: tpl.deployArgs(params, R, money) },
            cenarios: scenarios,
            origem: 'modelo'
        };
    }

    // ------------------------------------------------------------------
    // Extração por regras (português e inglês)
    // ------------------------------------------------------------------
    const NUMBER_WORDS = {
        um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
        onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, sessenta: 60, noventa: 90,
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
        fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90
    };
    const NUM = '(\\d+(?:[.,]\\d+)?|' + Object.keys(NUMBER_WORDS).join('|') + ')';

    function toNumber(s) {
        const k = String(s).toLowerCase();
        if (k in NUMBER_WORDS) return NUMBER_WORDS[k];
        return Number(k.replace(',', '.'));
    }

    /** "2.000,00" (BR) ou "2,000.00" (EN) → 2000. */
    function parseMoney(s) {
        let t = String(s).trim().replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
        const lastComma = t.lastIndexOf(',');
        const lastDot = t.lastIndexOf('.');
        if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.');
        else if (lastDot > lastComma && t.length - lastDot === 4 && lastComma === -1 && (t.match(/\./g) || []).length >= 1) t = t.replace(/\./g, '');
        else t = t.replace(/,/g, '');
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    }

    const TYPE_HINTS = {
        locacao: /\b(alug\w*|loca[cç][aã]o|locat[aá]ri[oa]|locador[a]?|rent\w*|lease\w*|tenant|landlord)\b/gi,
        garantia: /\b(dep[oó]sit\w*|garantia|escrow|comprador[a]?|vendedor[a]?|buyer|seller|compra e venda|sale|purchase)\b/gi,
        servicos: /\b(etapas?|servi[cç]os?|contratad[oa]|contratante|marcos?|milestones?|contractor|client|deliver\w*|projeto|project)\b/gi,
        mutuo: /\b(m[uú]tuo|empr[eé]stim\w*|mutuante|mutu[aá]ri[oa]|loan|lender|borrower|lends?)\b/gi
    };

    function detect(text) {
        const scores = {};
        let best = null;
        for (const [type, re] of Object.entries(TYPE_HINTS)) {
            const m = String(text || '').match(re);
            scores[type] = m ? m.length : 0;
            if (scores[type] > 0 && (!best || scores[type] > scores[best])) best = type;
        }
        return { type: best, scores };
    }

    function contextBefore(text, index, size) {
        return text.slice(Math.max(0, index - (size || 60)), index).toLowerCase();
    }

    /**
     * Extrai parâmetros do texto. Devolve { type, values, found } — "found"
     * lista os campos efetivamente encontrados no texto.
     */
    function extract(text, forcedType) {
        const src = String(text || '');
        const type = forcedType || detect(src).type;
        if (!type) return { type: null, values: {}, found: [] };
        const values = {};
        const found = [];
        const set = (k, v) => { if (v != null && Number.isFinite(v) && !(k in values)) { values[k] = v; found.push(k); } };

        // Valores monetários, com o contexto anterior.
        const money = [];
        const moneyRe = /(?:R\$|US\$|U\$|\$|BRL|USD|EUR|€)\s*([\d][\d.,]*)/gi;
        let m;
        while ((m = moneyRe.exec(src)) !== null) {
            const v = parseMoney(m[1]);
            if (v) money.push({ v, ctx: contextBefore(src, m.index, 80) + ' ' + src.slice(m.index, m.index + 60).toLowerCase() });
        }
        // Percentuais.
        const pct = [];
        const pctRe = new RegExp(NUM + '\\s*(?:%|por cento|percent)', 'gi');
        while ((m = pctRe.exec(src)) !== null) {
            const before = contextBefore(src, m.index, 60);
            pct.push({ v: toNumber(m[1]), ctx: before });
        }
        // Prazos em dias.
        const days = [];
        const dayRe = new RegExp(NUM + '\\s*(?:\\(\\w+\\)\\s*)?(?:dias?|days?)(\\s*[úu]teis|\\s*business)?', 'gi');
        while ((m = dayRe.exec(src)) !== null) {
            days.push({ v: toNumber(m[1]), before: contextBefore(src, m.index, 50), after: src.slice(m.index + m[0].length, m.index + m[0].length + 30).toLowerCase() });
        }
        // Quantidades (parcelas, etapas, meses).
        const counts = [];
        const countRe = new RegExp(NUM + '\\s*(?:\\(\\w+\\)\\s*)?(?:(?:iguais|mensais|sucessivas|equal|monthly|consecutive)\\s+)?(parcelas|presta[cç][oõ]es|installments?|meses|months|etapas|milestones|instalments?)', 'gi');
        while ((m = countRe.exec(src)) !== null) counts.push({ v: toNumber(m[1]), kind: m[2].toLowerCase() });

        // Percentual: associado à palavra-chave mais próxima ANTES dele.
        const PCT_KINDS = [/multa|fine|penalt|late fee/g, /juros|interest/g];
        const kindOf = before => {
            let best = null;
            let bestPos = -1;
            for (const k of PCT_KINDS) {
                k.lastIndex = 0;
                let mm;
                while ((mm = k.exec(before)) !== null) {
                    if (mm.index > bestPos) { bestPos = mm.index; best = k; }
                }
            }
            return best;
        };
        const pctFor = kind => {
            const hit = pct.find(p => kindOf(p.ctx) === kind);
            return hit ? hit.v : undefined;
        };
        // Prazo: primeiro pela palavra-chave antes do número; depois, logo após.
        const dayFor = re => (days.find(d => re.test(d.before)) || days.find(d => re.test(d.after)) || {}).v;
        const countFor = re => (counts.find(c => re.test(c.kind)) || {}).v;

        if (type === 'locacao') {
            set('valorAluguel', money.length ? money[0].v : null);
            set('multaPercent', pctFor(PCT_KINDS[0]));
            set('jurosPercent', pctFor(PCT_KINDS[1]));
            set('numeroParcelas', countFor(/parcelas|presta|installment|instalment|meses|months/));
            set('toleranciaDias', dayFor(/toler|car[eê]ncia|grace/));
            if (/mensa|ao m[eê]s|monthly|per month|todo dia|every month|each month/i.test(src)) set('periodoDias', 30);
        } else if (type === 'garantia') {
            set('preco', money.length ? money[0].v : null);
            set('prazoEntregaDias', dayFor(/entreg|deliver/) || (days[0] && days[0].v));
        } else if (type === 'servicos') {
            set('valorTotal', money.length ? money[0].v : null);
            set('numeroEtapas', countFor(/etapas|milestone|parcelas|presta|installment|instalment/));
            set('prazoAprovacaoDias', dayFor(/aprov|recus|approv|reject/) || (days[0] && days[0].v));
        } else if (type === 'mutuo') {
            const parcelaMoney = money.find(x => /parcela|presta|installment|instalment/.test(x.ctx.slice(-140)) && x !== money[0]);
            set('valorEmprestimo', money.length ? money[0].v : null);
            set('numeroParcelas', countFor(/parcelas|presta|installment|instalment|meses|months/));
            set('valorParcela', parcelaMoney ? parcelaMoney.v : (money[1] ? money[1].v : null));
            set('atrasoVencimentoDias', dayFor(/atraso|vencimento antecipado|delay|late|accelerat/));
            if (/mensa|monthly|per month/i.test(src)) set('periodoDias', 30);
            if (!('valorParcela' in values) && values.valorEmprestimo && values.numeroParcelas) {
                values.valorParcela = Math.ceil(values.valorEmprestimo / values.numeroParcelas * 100) / 100;
            }
        }
        return { type, values, found };
    }

    function list(lang) {
        return Object.keys(TEMPLATES).map(k => ({ id: k, name: TEMPLATES[k].name[lang === 'en' ? 'en' : 'pt'] }));
    }

    function fields(type, lang) {
        return TEMPLATES[type].fields.map(f => ({ key: f.key, type: f.type, label: f[lang === 'en' ? 'en' : 'pt'], def: f.def, min: f.min, max: f.max }));
    }

    function roles(type, lang) {
        return TEMPLATES[type].roles.map(r => r[lang === 'en' ? 'en' : 'pt']);
    }

    return { list, fields, roles, detect, extract, normalize, build, plan, parseMoney, TEMPLATES, SOLC_VERSION };
}));
