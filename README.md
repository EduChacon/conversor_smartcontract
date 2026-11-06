**Português** · [English](README.en.md)

# Conversor Contratual para Esqueleto Solidity

Ferramenta educacional que transforma um contrato escrito em linguagem comum num "smart contract" (contrato inteligente) em Solidity, verifica a segurança do código e permite testá-lo numa "blockchain" simulada, tudo no navegador. **Não é preciso saber programar nem usar inteligência artificial.**

**Acesse:** <https://educhacon.github.io/conversor_smartcontract/>

> **Advertência.** A ferramenta tem finalidade educacional e de pesquisa. Ela **não produz código pronto para uso com dinheiro real nem aconselhamento jurídico**. Contratos que movimentem valores exigem revisão por profissional de Solidity e auditoria de segurança independente.

![Contrato montado por cláusulas, com as lacunas destacadas](docs/img/pt/contrato.png)

## Sumário

1. [O que é isto, em linguagem simples](#1-o-que-é-isto-em-linguagem-simples)
2. [Primeiros passos](#2-primeiros-passos)
3. [Como ler os resultados](#3-como-ler-os-resultados)
4. [Os três modos de conversão](#4-os-três-modos-de-conversão)
5. [Blocos disponíveis](#5-blocos-disponíveis)
6. [Cotação do Ether](#6-cotação-do-ether)
7. [Inteligência artificial (opcional)](#7-inteligência-artificial-opcional)
8. [Levar o contrato a uma rede de teste real](#8-levar-o-contrato-a-uma-rede-de-teste-real)
9. [Segurança dos contratos](#9-segurança-dos-contratos)
10. [Glossário](#10-glossário)
11. [Perguntas frequentes](#11-perguntas-frequentes)
12. [Limitações](#12-limitações)
13. [Para desenvolvedores](#13-para-desenvolvedores)
14. [Autoria e licença](#14-autoria-e-licença)

## 1. O que é isto, em linguagem simples

Um **"smart contract"** é um programa publicado numa "blockchain" que executa sozinho parte de um contrato: recebe pagamentos, guarda valores em garantia, libera dinheiro quando uma condição se cumpre e recusa quem não tem direito. Ninguém pode alterá-lo depois de publicado, e cada operação fica registrada.

Esta ferramenta faz a ponte entre o **texto jurídico** e o **código**:

- você monta o contrato como um documento comum, cláusula por cláusula;
- por trás, cada cláusula vira um trecho de código Solidity já revisado, com a própria cláusula transcrita em comentário;
- o código é verificado, compilado e **testado de verdade** numa "blockchain" simulada no navegador, inclusive contra tentativas de fraude.

**O que ela não faz:** não publica nada numa rede real, não movimenta dinheiro, não substitui advogado nem auditor e não automatiza o que depende do mundo real (por exemplo, verificar se um imóvel foi entregue). Nesses casos, o contrato depende da confirmação de uma parte ou de um árbitro, e o código registra essa limitação.

## 2. Primeiros passos

A página traz a seção **"Como usar: tutoriais práticos"**, com **passo a passo guiado na própria tela**. O roteiro abaixo resume o primeiro tutorial.

**Passo 1 — Escolha o modo "Montar contrato" e um exemplo.** Em "Começar de um exemplo", escolha um contrato (locação, compra parcelada, serviços, garantia ou assinatura). Ele aparece como um documento, com cláusulas numeradas.

**Passo 2 — Edite o contrato.** Clique no texto para reescrevê-lo livremente. Os **trechos destacados** (partes, valores, prazos e percentuais) são os que o código executa; altere-os nos próprios campos. Use **"+ Acrescentar cláusula"** para incluir novos blocos. Se o texto mencionar um valor fora dos trechos destacados, a página avisa que ele não será executado.

**Passo 3 — Gere o "smart contract".** Clique em **"Gerar o 'smart contract'"**. O código aparece logo abaixo e passa a acompanhar automaticamente as alterações feitas no contrato.

![Código gerado, com cada cláusula transcrita em comentário](docs/img/pt/codigo.png)

**Passo 4 — Confira a segurança.** A seção § 3 mostra o verificador automático e o resultado da compilação.

![Verificação de segurança e compilação](docs/img/pt/seguranca.png)

**Passo 5 — Teste.** Na seção § 4, clique em **"Executar os testes predefinidos"**. Para testar à mão, clique em **"Implantar e interagir"**: escolha quem chama cada função, informe valores, avance o tempo e acompanhe saldos e registros. O botão **"i"** explica cada função.

![Resultado dos testes predefinidos](docs/img/pt/testes.png)

![Laboratório: contas, estado do contrato, funções e registro de transações](docs/img/pt/laboratorio.png)

**Passo 6 — Guarde o resultado.** Use **"Relatório"** para baixar um arquivo com o contrato, o código, a verificação e os testes, ou **"Baixar .sol"** para o código.

## 3. Como ler os resultados

| Onde | O que significa |
|---|---|
| **Verificador automático** | Aponta padrões perigosos conhecidos, por gravidade (alta, média, baixa, informativa). Nos blocos e modelos revisados, não deve haver achados relevantes. |
| **Compilação** | "Compilado sem erros" significa que o compilador oficial do Solidity aceitou o código. |
| **Placar dos testes** | Percentual de cenários aprovados. **Aprovado**: o contrato agiu como deveria. **Falhou**: aceitou o que devia recusar, ou recusou o que devia aceitar. **Teste inválido**: o próprio teste é defeituoso, o que não indica falha do contrato. |
| **Recusa ("reversão")** | O contrato recusou a operação e desfez tudo. O motivo aparece por extenso: por exemplo, "NaoAutorizado" (quem chamou não é a parte autorizada) ou "ValorIncorreto" (o valor difere do devido). |
| **Solvência** | Confere que o dinheiro guardado no contrato é exatamente a soma do que as partes têm a receber mais o que está retido em garantia. |
| **Botão "i"** | Explica cada função: a cláusula que ela implementa, quem pode chamá-la, quando e por quais motivos pode ser recusada. |

## 4. Os três modos de conversão

| Modo | Usa IA? | Para quê |
|---|---|---|
| **Montar contrato** (padrão) | Não | Montar o contrato com blocos revisados e texto livremente editável. Resultado reprodutível. |
| **Modelos prontos** | Não | Testar rapidamente: cole uma cláusula, e os valores são extraídos por regras para um dos quatro modelos (locação, compra e venda com garantia, serviços por etapas e mútuo). |
| **Texto livre** | Sim | Converter qualquer cláusula com a IA, com verificação, compilação e correção automáticas. |

## 5. Blocos disponíveis

| Bloco | O que faz |
|---|---|
| Pagamento único | Uma parte paga à outra um valor, em prazo definido. |
| Pagamento periódico | Parcelas a cada tantos dias (aluguel, prestações, mensalidades). |
| Multa e juros de mora | Encargos por atraso, ligados a um pagamento, com tolerância. |
| Vencimento antecipado | Após atraso prolongado, o credor antecipa o saldo devedor. |
| Depósito em garantia | Valor retido até a confirmação do cumprimento; devolução se o prazo vencer. |
| Entregas por etapas | Pagamento por etapa aprovada, com recusa fundamentada e aprovação tácita. |
| Caução | Garantia devolvida após o término; retenção decidida pelo árbitro. |
| Árbitro | Decide as disputas sobre valores retidos. |
| Rescisão | Encerra o contrato e devolve os valores retidos a quem os depositou. |
| Prazo de vigência | Encerra o contrato após o prazo. |
| Cláusula livre | Qualquer texto (foro, confidencialidade...). Integra o contrato, mas não é executada pelo código. |

Cláusulas personalizadas podem ser salvas em **"Meus blocos"** e exportadas ou importadas em arquivo, para reutilizar ou compartilhar.

## 6. Cotação do Ether

Os valores do contrato são escritos em reais, mas a "blockchain" trabalha com Ether. No painel **"Cotação do Ether"**, você converte entre ETH, reais e dólares. A fonte principal é a **CoinGecko** (preço agregado de várias corretoras), com a **Coinbase** como reserva; a cotação é atualizada a cada 60 segundos enquanto o painel estiver aberto.

Com **"Usar esta cotação no contrato"**, os valores em reais passam a ser convertidos pela cotação, e a cláusula de pagamentos registra a fonte e o horário. Sem isso, vale uma escala didática (R$ 1.000 por 1 ETH de teste).

## 7. Inteligência artificial (opcional)

Com uma chave gratuita do [Google AI Studio](https://aistudio.google.com/app/apikey), a IA ajuda a:

- adaptar o contrato montado a particularidades da cláusula (os testes predefinidos são repetidos depois);
- analisar riscos, sugerir cláusulas, explicar o código e mapear cláusula ↔ código;
- converter cláusulas que não cabem nos blocos (modo "Texto livre");
- gerar testes adicionais.

O modelo padrão é leve e tem a maior cota gratuita. Se ele não estiver disponível para a chave, o aplicativo escolhe outro. No limite do plano gratuito, o aplicativo aguarda e tenta de novo.

**Privacidade:** a chave fica apenas no seu navegador e só é enviada ao Google. No plano gratuito, o Google pode usar o conteúdo enviado para aprimorar seus produtos; não insira dados pessoais nem confidenciais. Os modos sem IA não enviam o contrato a ninguém.

## 8. Levar o contrato a uma rede de teste real

1. Use **"Abrir no Remix"** ou baixe o arquivo `.sol`.
2. No Remix IDE, compile com a versão `0.8.28`.
3. Instale a carteira MetaMask, crie uma conta de teste e selecione a rede **Sepolia**.
4. Obtenha Ether de teste gratuito numa "faucet" de Sepolia (há uma lista em [ethereum.org](https://ethereum.org/developers/docs/networks/)).
5. No Remix, em "Deploy & Run Transactions", escolha **"Injected Provider - MetaMask"**, informe os endereços das partes e implante.

**Nunca** use a rede principal nem dinheiro real sem auditoria profissional.

## 9. Segurança dos contratos

Os blocos, os modelos e as instruções da IA seguem, entre outros requisitos:

- versão fixa do compilador e código autocontido;
- controle de acesso: só a parte legitimada pratica cada ato;
- pagamento pelo valor exato;
- padrão de saque ("pull payment"): cada parte retira o próprio crédito;
- proteção contra reentrância e ordem "checks-effects-interactions";
- proibição de recursos perigosos (`tx.origin`, `selfdestruct`, `delegatecall`, `assembly`);
- registro das limitações do "on-chain".

Os testes automatizados do projeto compilam cada bloco, modelo e exemplo, além de 40 combinações aleatórias de blocos, e exigem que todos passem nos cenários de funcionalidade, ataque e solvência.

## 10. Glossário

| Termo | Significado |
|---|---|
| "Blockchain" | Registro público e compartilhado de operações, que não pode ser alterado depois de gravado. |
| "Smart contract" | Programa publicado na "blockchain" que executa automaticamente regras combinadas. |
| Solidity | Linguagem de programação dos "smart contracts" da rede Ethereum. |
| Ether (ETH) | Moeda da rede Ethereum, usada para pagamentos e taxas. |
| Wei | Menor fração do Ether (1 ETH = 10¹⁸ wei). |
| "Gás" | Custo de processamento de cada operação na rede. |
| Carteira | Aplicativo que guarda as chaves de uma conta e assina operações (ex.: MetaMask). |
| Implantação ("deploy") | Publicação do contrato na rede. |
| Reversão ("revert") | Recusa da operação pelo contrato; nada é alterado. |
| Saque ("pull payment") | Modelo em que cada credor retira o próprio crédito, o que é mais seguro do que o envio automático. |
| Rede de teste | Rede pública com Ether sem valor, para experimentos (ex.: Sepolia). |
| Auditoria | Revisão independente de segurança, indispensável antes do uso real. |

## 11. Perguntas frequentes

**Preciso de IA?** Não. Montar contrato, modelos prontos, verificação, compilação e testes funcionam sem IA e sem chave.

**Posso usar com dinheiro real?** Não. O código é educacional e exige revisão profissional e auditoria.

**Meus dados vão para algum lugar?** Sem IA, o contrato fica no seu navegador. Com IA, o texto vai à API do Google. A consulta de cotação acessa a CoinGecko ou a Coinbase, apenas quando você abre o painel.

**Por que o valor em Ether muda?** Porque o Ether tem cotação variável. Ao gerar o código, o valor em Ether fica fixado pela escala ou pela cotação escolhida.

**O que acontece se eu escrever no texto algo que não está nos campos destacados?** O texto passa a fazer parte da redação, mas não é executado. A página avisa quando há valores fora dos campos.

**Como reaproveito uma cláusula que escrevi?** Use "Salvar como meu bloco"; ela fica disponível em "+ Acrescentar cláusula" → "Meus blocos" e pode ser exportada em arquivo.

## 12. Limitações

- O verificador automático é heurístico e não substitui ferramentas especializadas nem auditoria.
- Os blocos cobrem uma família ampla de contratos de pagamento e obrigação, mas não todo contrato.
- Fatos do mundo real e datas de calendário são aproximados (confirmação de parte ou árbitro; períodos fixos em dias).
- A "blockchain" simulada reproduz a EVM, mas não custos reais de "gás" nem interação com outros contratos.
- A cotação é de referência e varia ao longo do tempo.

## 13. Para desenvolvedores

O site é estático (HTML, CSS e JavaScript), sem etapa de compilação para publicação. Para rodar os testes ou regenerar a "blockchain" simulada:

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

Principais arquivos: `assets/js/blocks.js` (blocos), `assets/js/composer.js` (montador), `assets/js/templates.js` (modelos prontos), `assets/js/lab.js` (Laboratório), `assets/js/security-scan.js` (verificador), `assets/js/prompts.js` (instruções da IA) e `src/evm-lab.mjs` (EVM simulada).

## 14. Autoria e licença

© 2025-2026 Eduardo Chacon ([github.com/EduChacon](https://github.com/EduChacon)). **Todos os direitos reservados.** O uso da ferramenta pela página publicada é livre para fins pessoais, educacionais e de pesquisa. A cópia, modificação ou redistribuição do código exige autorização prévia: veja o arquivo [`LICENSE`](LICENSE). Componentes de terceiros mantêm as próprias licenças.
