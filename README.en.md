[Português](README.md) · **English**

# Contract Clause to Solidity Skeleton Converter

An educational tool that turns a contract written in plain language into a Solidity smart contract, checks the code's security and lets you test it on a simulated blockchain, all in the browser. **No programming skills and no AI are required.**

**Open the tool:** <https://educhacon.github.io/conversor_smartcontract/> (use the "English" link at the top right).

> **Notice.** This is an educational and research tool. It **does not produce code ready for real money nor legal advice**. Contracts that handle value require review by a Solidity professional and an independent security audit.

![A contract built clause by clause, with highlighted blanks](docs/img/en/contract.png)

## Contents

1. [What this is, in plain words](#1-what-this-is-in-plain-words)
2. [Getting started](#2-getting-started)
3. [How to read the results](#3-how-to-read-the-results)
4. [The three conversion modes](#4-the-three-conversion-modes)
5. [Available blocks](#5-available-blocks)
6. [Ether price](#6-ether-price)
7. [Artificial intelligence (optional)](#7-artificial-intelligence-optional)
8. [Taking the contract to a real testnet](#8-taking-the-contract-to-a-real-testnet)
9. [Contract security](#9-contract-security)
10. [Glossary](#10-glossary)
11. [FAQ](#11-faq)
12. [Limitations](#12-limitations)
13. [For developers](#13-for-developers)
14. [Authorship and license](#14-authorship-and-license)

## 1. What this is, in plain words

A **smart contract** is a program published on a blockchain that carries out part of an agreement on its own: it receives payments, holds money in escrow, releases funds when a condition is met and rejects anyone who is not entitled. Once published, nobody can change it, and every operation is recorded.

This tool bridges the **legal text** and the **code**:

- you build the contract as a normal document, clause by clause;
- behind the scenes, each clause becomes reviewed Solidity code, with the clause itself quoted as a comment;
- the code is checked, compiled and **actually tested** on a simulated blockchain in the browser, including against fraud attempts.

**What it does not do:** it does not publish anything on a real network, move money, replace a lawyer or auditor, or automate what depends on the real world (e.g. whether a property was handed over). In those cases the contract relies on a party's or an arbitrator's confirmation, and the code records that limitation.

## 2. Getting started

The page has a **"How to use: hands-on tutorials"** section with **guided walkthroughs on the page itself**. The steps below summarize the first tutorial.

**Step 1 — Choose "Build a contract" and an example.** Under "Start from an example", pick a contract (lease, installment sale, services, escrow or subscription). It appears as a document with numbered clauses.

**Step 2 — Edit the contract.** Click the text to rewrite it freely. The **highlighted parts** (parties, amounts, deadlines and percentages) are what the code executes; change them in the fields themselves. Use **"+ Add clause"** to include new blocks. If the text mentions an amount outside the highlighted parts, the page warns that it will not be executed.

**Step 3 — Generate the smart contract.** Click **"Generate the smart contract"**. The code appears below and then automatically follows your changes to the contract.

![Generated code, with each clause quoted as a comment](docs/img/en/code.png)

**Step 4 — Check security.** Section § 3 shows the automatic checker and the compilation result.

![Security check and compilation](docs/img/en/security.png)

**Step 5 — Test.** In section § 4, click **"Run the predefined tests"**. To test by hand, click **"Deploy and interact"**: choose who calls each function, enter amounts, move time forward and follow balances and records. The **"i"** button explains each function.

![Predefined test results](docs/img/en/tests.png)

![Lab: accounts, contract status, functions and transaction log](docs/img/en/lab.png)

**Step 6 — Keep a record.** Use **"Report"** to download a file with the contract, code, checks and tests, or **"Download .sol"** for the code.

## 3. How to read the results

| Where | What it means |
|---|---|
| **Automatic checker** | Flags known dangerous patterns by severity (high, medium, low, info). Reviewed blocks and templates should show no relevant findings. |
| **Compilation** | "Compiled without errors" means the official Solidity compiler accepted the code. |
| **Test score** | Share of scenarios passed. **Passed**: the contract behaved as it should. **Failed**: it accepted what it should reject, or rejected what it should accept. **Invalid test**: the test itself is faulty, which does not indicate a contract failure. |
| **Rejection ("revert")** | The contract rejected the operation and undid everything. The reason is shown in full, e.g. "Unauthorized" (the caller is not the entitled party) or "WrongAmount" (the amount differs from what is due). |
| **Solvency** | Confirms that the money held by the contract equals exactly what the parties are owed plus what is held in guarantees. |
| **"i" button** | Explains each function: the clause it implements, who can call it, when, and why it may be rejected. |

## 4. The three conversion modes

| Mode | Uses AI? | Purpose |
|---|---|---|
| **Build a contract** (default) | No | Build the contract from reviewed blocks with freely editable text. Reproducible result. |
| **Ready-made templates** | No | Quick test: paste a clause and its amounts are extracted by rules into one of four templates (lease, escrow sale, milestone services and loan). |
| **Free text** | Yes | Convert any clause with AI, with automatic checking, compilation and fixing. |

## 5. Available blocks

| Block | What it does |
|---|---|
| One-time payment | One party pays the other an amount within a deadline. |
| Periodic payment | Installments every so many days (rent, installments, fees). |
| Late fee and interest | Charges for late payment, linked to a payment, with a grace period. |
| Acceleration | After a prolonged delay, the creditor accelerates the outstanding balance. |
| Escrow deposit | Amount held until performance is confirmed; refunded if the deadline passes. |
| Milestone deliveries | Payment per approved milestone, with reasoned rejection and tacit approval. |
| Security deposit | Returned after the contract ends; retention decided by the arbitrator. |
| Arbitrator | Decides disputes over held amounts. |
| Termination | Closes the contract and returns held amounts to whoever deposited them. |
| Term | Closes the contract after a period. |
| Free clause | Any text (jurisdiction, confidentiality...). Part of the contract but not executed by the code. |

Custom clauses can be saved in **"My blocks"** and exported or imported as a file, to reuse or share.

## 6. Ether price

Contract amounts are written in Brazilian reais (BRL), but the blockchain works with Ether. The **"Ether price"** panel converts between ETH, BRL and USD. The main source is **CoinGecko** (price aggregated across exchanges), with **Coinbase** as a fallback; the price refreshes every 60 seconds while the panel is open.

With **"Use this price in the contract"**, BRL amounts are converted at that price and the payments clause records the source and time. Otherwise a didactic scale applies (R$ 1,000 per 1 test ETH).

## 7. Artificial intelligence (optional)

With a free key from [Google AI Studio](https://aistudio.google.com/app/apikey), AI can help to:

- adapt the composed contract to the specifics of a clause (the predefined tests run again afterwards);
- analyze risks, suggest clauses, explain the code and map clause ↔ code;
- convert clauses that do not fit the blocks ("Free text" mode);
- generate additional tests.

The default model is lightweight and has the largest free quota. If it is not available for your key, the app picks another one. When the free tier limit is reached, the app waits and retries.

**Privacy:** the key stays only in your browser and is sent only to Google. On the free tier, Google may use the content sent to improve its products; do not enter personal or confidential data. The non-AI modes do not send the contract anywhere.

## 8. Taking the contract to a real testnet

1. Use **"Open in Remix"** or download the `.sol` file.
2. In Remix IDE, compile with version `0.8.28`.
3. Install the MetaMask wallet, create a test account and select the **Sepolia** network.
4. Get free test Ether from a Sepolia faucet (see the list at [ethereum.org](https://ethereum.org/developers/docs/networks/)).
5. In Remix, under "Deploy & Run Transactions", choose **"Injected Provider - MetaMask"**, enter the parties' addresses and deploy.

**Never** use mainnet or real money without a professional audit.

## 9. Contract security

Blocks, templates and AI instructions follow, among others:

- a pinned compiler version and self-contained code;
- access control: only the entitled party performs each act;
- payment of the exact amount;
- withdrawal pattern ("pull payment"): each party withdraws its own credit;
- reentrancy protection and checks-effects-interactions order;
- no dangerous features (`tx.origin`, `selfdestruct`, `delegatecall`, `assembly`);
- explicit notes on on-chain limitations.

The project's automated tests compile every block, template and example, plus 40 random block combinations, and require all of them to pass functional, attack and solvency scenarios.

## 10. Glossary

| Term | Meaning |
|---|---|
| Blockchain | A public, shared record of operations that cannot be changed once written. |
| Smart contract | A program published on a blockchain that automatically enforces agreed rules. |
| Solidity | The programming language of Ethereum smart contracts. |
| Ether (ETH) | Ethereum's currency, used for payments and fees. |
| Wei | The smallest fraction of Ether (1 ETH = 10¹⁸ wei). |
| Gas | The processing cost of each operation on the network. |
| Wallet | An app that holds an account's keys and signs operations (e.g. MetaMask). |
| Deployment | Publishing the contract on the network. |
| Revert | The contract rejects the operation; nothing changes. |
| Pull payment | Each creditor withdraws its own credit, which is safer than automatic sending. |
| Testnet | A public network with worthless Ether, for experiments (e.g. Sepolia). |
| Audit | An independent security review, indispensable before real use. |

## 11. FAQ

**Do I need AI?** No. Building contracts, ready-made templates, checks, compilation and tests all work without AI or a key.

**Can I use it with real money?** No. The code is educational and requires professional review and an audit.

**Does my data go anywhere?** Without AI, the contract stays in your browser. With AI, the text goes to Google's API. The price lookup contacts CoinGecko or Coinbase only when you open the panel.

**Why does the Ether amount change?** Because Ether's price varies. When the code is generated, the Ether amount is fixed by the chosen scale or price.

**What if I write something in the text that is not in the highlighted fields?** It becomes part of the wording but is not executed. The page warns when amounts appear outside the fields.

**How do I reuse a clause I wrote?** Use "Save as my block"; it becomes available under "+ Add clause" → "My blocks" and can be exported as a file.

## 12. Limitations

- The automatic checker is heuristic and does not replace specialized tools or an audit.
- The blocks cover a broad family of payment and obligation contracts, but not every contract.
- Real-world facts and calendar dates are approximated (party or arbitrator confirmation; fixed periods in days).
- The simulated blockchain reproduces the EVM, but not real gas costs or interaction with other contracts.
- The price is a reference and varies over time.

## 13. For developers

The site is static (HTML, CSS and JavaScript) and needs no build step to be published. To run the tests or rebuild the simulated blockchain:

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

Main files: `assets/js/blocks.js` (blocks), `assets/js/composer.js` (contract builder), `assets/js/templates.js` (ready-made templates), `assets/js/lab.js` (Lab), `assets/js/security-scan.js` (checker), `assets/js/prompts.js` (AI instructions) and `src/evm-lab.mjs` (simulated EVM).

## 14. Authorship and license

© 2025-2026 Eduardo Chacon ([github.com/EduChacon](https://github.com/EduChacon)). **All rights reserved.** Using the tool through the published page is free for personal, educational and research purposes. Copying, modifying or redistributing the code requires prior permission: see the [`LICENSE`](LICENSE) file. Third-party components keep their own licenses.
