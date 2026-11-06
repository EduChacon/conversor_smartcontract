# Conversor Contratual para Esqueleto Solidity

Ferramenta educacional e experimental que converte cláusulas contratuais escritas em linguagem natural em esqueletos de "smart contracts" na linguagem Solidity, verifica a segurança do código gerado e permite testá-lo numa "blockchain" simulada, diretamente no navegador.

**Acesse:** <https://educhacon.github.io/conversor_smartcontract/>

> **Aviso.** A ferramenta tem finalidade ilustrativa e educacional. Ela **não produz código pronto para produção nem aconselhamento jurídico**. Contratos que movimentem valores exigem revisão por profissional de Solidity e auditoria de segurança independente.

![Laboratório: contas, estado do contrato, funções e linha do tempo das transações](docs/img/readme-lab.png)

## Fluxo de uso

1. **Cláusula ou contrato.** Cole o texto, ou escolha um dos exemplos (locação, compra e venda com depósito em garantia, prestação de serviços por etapas e mútuo). Antes da conversão, é possível pedir à IA uma análise de riscos e sugestões de cláusulas complementares.
2. **Esqueleto Solidity.** A IA gera o contrato seguindo requisitos obrigatórios de segurança. O código é editável e mantém histórico de versões (desfazer e refazer); pode ser copiado, baixado (`.sol`) ou aberto diretamente no Remix IDE.
3. **Verificação de segurança.** Cada versão passa por:
   - verificador automático local (sem IA), que aponta padrões perigosos conhecidos, com referência ao registro SWC;
   - compilação real com o compilador oficial do Solidity (solc 0.8.28), executado no navegador;
   - revisão de segurança por IA e correção assistida dos problemas encontrados.
4. **Laboratório.** O contrato é implantado numa "blockchain" que roda apenas no navegador, sem carteira e sem custo. Cada parte recebe uma conta fictícia, e há sempre uma conta "Atacante". É possível chamar as funções como qualquer das partes, avançar o relógio para testar prazos e acompanhar saldos, estado do contrato, eventos e reversões.
5. **Entender e aprimorar.** Explicação didática do código, **mapa de correspondência cláusula ↔ código** (com o grau de automação de cada elemento), sugestões de otimização, refinamento por pedido e perguntas sobre o código. Ao final, é possível baixar um **relatório da sessão** em Markdown.

## Testes de funcionalidade e segurança

A IA elabora cenários de teste a partir da cláusula e do código: fluxos normais (pagamento, prazos, saques) e tentativas indevidas (conta não autorizada, valor incorreto, saque duplicado, operação fora do estado). O Laboratório **executa cada cenário de fato**, numa implantação nova, e distingue três resultados:

- **aprovado:** o contrato se comportou como esperado;
- **falhou:** o contrato aceitou operação que deveria recusar, ou recusou operação que deveria aceitar;
- **teste inválido:** o próprio cenário gerado pela IA não é executável (ex.: função inexistente), o que não indica defeito do contrato.

Os testes que falharam podem ser enviados à IA para correção do código.

![Resultado dos testes executados no Laboratório](docs/img/readme-testes.png)

## Segurança dos contratos gerados

As instruções enviadas à IA (arquivo [`assets/js/prompts.js`](assets/js/prompts.js)) impõem, entre outros requisitos:

- versão fixa do compilador e código autocontido, sem importações externas;
- partes recebidas no construtor, validadas e armazenadas como `immutable`;
- controle de acesso por modificadores em toda função que altere o estado;
- pagamentos com validação do valor exato, padrão de saque ("pull payment"), envio por `call` com verificação do retorno, ordem "checks-effects-interactions" e trava contra reentrância;
- proibição de `tx.origin`, `selfdestruct`, `delegatecall`, `assembly` e aleatoriedade baseada em dados do bloco;
- máquina de estados, erros personalizados e eventos;
- percentuais em pontos-base, sem perda de precisão;
- registro expresso das limitações do "on-chain", como valores em reais, que dependem de oráculo, e fatos do mundo real, que dependem de confirmação de parte ou árbitro.

As instruções incluem ainda um **modelo de referência** que demonstra esses padrões, para que modelos leves os reproduzam.

### Ciclo de autocorreção

Depois de gerar ou alterar o código, o aplicativo o verifica e o compila. Havendo erro de compilação ou achado de gravidade alta ou média, devolve o código à IA com a lista de problemas, até o número de rodadas configurado.

![Verificação de segurança e compilação](docs/img/readme-seguranca.png)

## Parâmetros da IA

No painel **Parâmetros da IA**, é possível ajustar:

| Parâmetro | Padrão | Observação |
|---|---|---|
| Modelo | `gemini-flash-latest` | A lista é atualizada com os modelos disponíveis para a sua chave. Modelos leves (ex.: Flash-Lite) funcionam bem com 2 ou 3 rodadas de autocorreção. |
| Temperatura | 0,2 | Valores baixos tornam o código mais previsível. |
| Rodadas de autocorreção | 2 | De 0 a 3. |
| Compilação automática | ativada | Baixa o compilador, cerca de 9 MB, uma única vez. |

## Chave da API e privacidade

- A ferramenta usa a API Gemini do Google. A chave pode ser obtida gratuitamente no [Google AI Studio](https://aistudio.google.com/app/apikey).
- A chave fica apenas no navegador: por padrão, até o fechamento da aba; com a opção "Lembrar neste navegador", de forma persistente. Ela é enviada somente ao Google, no cabeçalho `x-goog-api-key`, e nunca no endereço da requisição.
- Recomenda-se restringir a chave, no Google Cloud Console, ao referenciador HTTP `https://educhacon.github.io/*` e apenas à "Generative Language API".
- O texto da cláusula e o código são enviados ao Google. No plano gratuito, o Google pode utilizar esse conteúdo para aprimorar seus produtos; por isso, não insira dados pessoais nem informações confidenciais.
- A página adota política de segurança de conteúdo (CSP): só executa scripts do próprio site e só se conecta à API Gemini. As respostas da IA são exibidas sem interpretação de HTML.

## Estrutura do projeto

```
index.html                    página principal (endereço publicado no GitHub Pages)
assets/css/app.css            estilos (temas claro e escuro)
assets/js/app.js              controlador da interface e ciclo de autocorreção
assets/js/prompts.js          instruções enviadas à IA
assets/js/gemini.js           cliente da API Gemini
assets/js/security-scan.js    verificador local de segurança
assets/js/compiler.js         interface com o compilador
assets/js/solc-worker.js      compilador Solidity em "Web Worker"
assets/js/lab.js              Laboratório e execução dos cenários
assets/js/markdown.js         exibição segura das respostas
assets/js/i18n.js             textos em português e inglês
assets/vendor/evm-lab.js      "blockchain" simulada (gerada a partir de src/evm-lab.mjs)
tests/                        testes automatizados
```

## Desenvolvimento

O site é estático e não requer etapa de compilação para ser publicado. Para rodar os testes ou regenerar a "blockchain" simulada:

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

`npm test` executa os testes do verificador de segurança e um teste de integração que compila um contrato com o solc oficial e o executa na mesma EVM usada pela página, com pagamento, saque, prazo e tentativas de ataque.

## Limitações

- O verificador local é heurístico: pode deixar de apontar problemas ou apontar falsos positivos. Não substitui ferramentas como Slither ou Mythril.
- A IA pode errar. O código e os cenários de teste precisam de revisão humana.
- A "blockchain" simulada reproduz a EVM (versão Cancun), mas não reproduz custos reais de "gás", oráculos nem interação com outros contratos implantados na rede.
