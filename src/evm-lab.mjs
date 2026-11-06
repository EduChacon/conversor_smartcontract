/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * "Blockchain" simulada para o Laboratório (fonte do pacote
 * assets/vendor/evm-lab.js, gerado por "npm run build").
 *
 * Usa a EVM oficial em JavaScript (@ethereumjs/vm) para implantar e executar
 * o contrato compilado inteiramente no navegador, com contas fictícias,
 * controle do relógio do bloco e decodificação de eventos e reversões (viem).
 * Não há rede, carteira nem custo real.
 */
import { createVM } from '@ethereumjs/vm';
import { createBlock } from '@ethereumjs/block';
import { Common, Mainnet, Hardfork } from '@ethereumjs/common';
import { Address, createAccount, createAddressFromString, bytesToHex, hexToBytes } from '@ethereumjs/util';
import {
    encodeDeployData, encodeFunctionData, decodeFunctionResult, decodeEventLog,
    decodeErrorResult, parseEther, formatEther, parseUnits, getAddress, keccak256, toHex
} from 'viem';

const GAS_LIMIT = 30_000_000n;
const START_TIME = 1_767_225_600n; // 01/01/2026 00:00:00 UTC

/** Endereço determinístico e legível para cada conta fictícia. */
function addressFor(label, index) {
    const hash = keccak256(toHex('conversor-smartcontract:' + index + ':' + label));
    return getAddress('0x' + hash.slice(-40));
}

function describeError(abi, returnHex, exception) {
    if (returnHex && returnHex !== '0x') {
        try {
            const decoded = decodeErrorResult({ abi, data: returnHex });
            return { name: decoded.errorName, args: decoded.args ? Array.from(decoded.args) : [] };
        } catch (_) {
            return { name: 'RevertDesconhecido', args: [returnHex] };
        }
    }
    const msg = String(exception && (exception.error || exception.message) || exception || 'revert');
    if (/out of gas/i.test(msg)) return { name: 'OutOfGas', args: [] };
    if (/insufficient balance/i.test(msg)) return { name: 'SaldoInsuficiente', args: [] };
    return { name: msg === 'revert' ? 'Revert' : msg, args: [] };
}

function decodeLogs(abi, logs) {
    const events = [];
    for (const [, topics, data] of logs || []) {
        try {
            const ev = decodeEventLog({ abi, data: bytesToHex(data), topics: topics.map(t => bytesToHex(t)) });
            events.push({ name: ev.eventName, args: ev.args });
        } catch (_) {
            events.push({ name: '(evento não decodificado)', args: {} });
        }
    }
    return events;
}

export class Chain {
    static async create() {
        const chain = new Chain();
        chain.common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });
        chain.vm = await createVM({ common: chain.common });
        chain.timestamp = START_TIME;
        chain.blockNumber = 1n;
        chain.accounts = [];
        return chain;
    }

    block() {
        return createBlock({
            header: {
                number: this.blockNumber,
                timestamp: this.timestamp,
                gasLimit: GAS_LIMIT,
                baseFeePerGas: 7n
            }
        }, { common: this.common });
    }

    /** Cria conta fictícia com saldo inicial (em ether). */
    async addAccount(label, etherBalance) {
        const address = addressFor(label, this.accounts.length);
        await this.vm.stateManager.putAccount(createAddressFromString(address), createAccount({ balance: parseEther(String(etherBalance)) }));
        const account = { label, address };
        this.accounts.push(account);
        return account;
    }

    async balanceOf(address) {
        const acc = await this.vm.stateManager.getAccount(createAddressFromString(address));
        return acc ? acc.balance : 0n;
    }

    advanceTime(seconds) {
        this.timestamp += BigInt(seconds);
        this.blockNumber += 1n;
    }

    /** Gás intrínseco da transação (base + dados), como na rede real. */
    intrinsicGas(dataHex, isCreate) {
        const bytes = hexToBytes(dataHex);
        let g = isCreate ? 53000n : 21000n;
        for (const b of bytes) g += b === 0 ? 4n : 16n;
        if (isCreate) g += 2n * BigInt(Math.ceil(bytes.length / 32)); // EIP-3860
        return g;
    }

    /** Debita o custo do gás de uma conta (cobrança opcional no laboratório). */
    async debit(address, amount) {
        const addr = createAddressFromString(address);
        const acc = await this.vm.stateManager.getAccount(addr);
        if (!acc) return;
        acc.balance = acc.balance > amount ? acc.balance - amount : 0n;
        await this.vm.stateManager.putAccount(addr, acc);
    }

    async run({ from, to, data, value }) {
        const result = await this.vm.evm.runCall({
            caller: createAddressFromString(from),
            origin: createAddressFromString(from),
            to: to ? createAddressFromString(to) : undefined,
            data: hexToBytes(data),
            value: value || 0n,
            gasLimit: GAS_LIMIT,
            gasPrice: 0n,
            block: this.block()
        });
        this.blockNumber += 1n;
        this.timestamp += 12n; // um bloco a cada 12 s
        return result;
    }

    async deploy({ from, abi, bytecode, args, value }) {
        const data = encodeDeployData({ abi, bytecode: bytecode.startsWith('0x') ? bytecode : '0x' + bytecode, args: args || [] });
        const r = await this.run({ from, data, value });
        const ex = r.execResult;
        const gasTotal = this.intrinsicGas(data, true) + ex.executionGasUsed;
        if (ex.exceptionError) {
            return { ok: false, gasUsed: ex.executionGasUsed, gasTotal, error: describeError(abi, bytesToHex(ex.returnValue), ex.exceptionError) };
        }
        return { ok: true, address: r.createdAddress.toString(), gasUsed: ex.executionGasUsed, gasTotal, events: decodeLogs(abi, ex.logs) };
    }

    async call({ from, to, abi, functionName, args, value }) {
        const data = encodeFunctionData({ abi, functionName, args: args || [] });
        const r = await this.run({ from, to, data, value });
        const ex = r.execResult;
        const gasTotal = this.intrinsicGas(data, false) + ex.executionGasUsed;
        if (ex.exceptionError) {
            return { ok: false, gasUsed: ex.executionGasUsed, gasTotal, error: describeError(abi, bytesToHex(ex.returnValue), ex.exceptionError) };
        }
        let result;
        try {
            result = decodeFunctionResult({ abi, functionName, data: bytesToHex(ex.returnValue) });
        } catch (_) {
            result = undefined;
        }
        return { ok: true, result, gasUsed: ex.executionGasUsed, gasTotal, events: decodeLogs(abi, ex.logs) };
    }
}

export { parseEther, formatEther, parseUnits, getAddress, Address, encodeFunctionData };
