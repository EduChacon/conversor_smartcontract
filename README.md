# Conversor Contratual para Esqueleto Solidity

Ferramenta educacional e experimental que converte cláusulas contratuais escritas em linguagem natural em esqueletos de "smart contracts" na linguagem Solidity, verifica a segurança do código e permite testá-lo numa "blockchain" simulada, diretamente no navegador. Funciona em português e em inglês.

**Acesse:** <https://educhacon.github.io/conversor_smartcontract/>

> **Advertência.** A ferramenta tem finalidade ilustrativa e educacional. Ela **não produz código pronto para produção nem aconselhamento jurídico**. Contratos que movimentem valores exigem revisão por profissional de Solidity e auditoria de segurança independente.

![Laboratório: contas e saldos, estado do contrato, funções e registro das transações](docs/img/readme-lab.png)

## Dois modos de conversão

| | Modelos revisados | Texto livre |
|---|---|---|
| Usa IA? | Não | Sim (API Gemini) |
| Abrangência | Locação; compra e venda com depósito em garantia; prestação de serviços por etapas; mútuo | Qualquer cláusula |
| Resultado | Reprodutível: a mesma entrada gera sempre o mesmo código | Varia conforme o modelo de IA |
| Testes | Cenários predefinidos de funcionalidade e segurança | Cenários gerados pela IA |

**Modelos revisados (padrão, sem IA).** O texto colado passa por uma extração por regras, que identifica o tipo de contrato e os parâmetros: valores em R$ ou US$, percentuais de multa e juros, prazos em dias, número de parcelas ou etapas. Esses parâmetros preenchem um formulário, que o usuário confere antes de gerar o código a partir de um modelo Solidity já revisado e testado.

**Texto livre (com IA).** A IA redige o contrato seguindo requisitos obrigatórios de segurança. Em seguida, o aplicativo verifica e compila o código e, havendo problemas, devolve-o à IA para correção (ciclo de autocorreção).

**A IA é facultativa e complementar.** Com uma chave da API, também é possível:

a) conferir com IA os parâmetros extraídos por regras;
b) adaptar o código do modelo a particularidades da cláusula, com os testes do modelo repetidos automaticamente;
c) pedir análise de riscos, sugestões de cláusulas, explicação do código, mapa de correspondência cláusula ↔ código, revisão de segurança e testes adicionais.

## Laboratório: testes em "blockchain" simulada

O contrato é implantado numa "blockchain" que roda apenas no navegador, sem carteira e sem custo. Cada parte recebe uma conta fictícia, e há sempre uma conta "Atacante". É possível:

- executar os **testes predefinidos do modelo** ou gerar testes com IA, com resultado aprovado, falhou ou teste inválido;
- chamar as funções como qualquer das partes e avançar o relógio para testar prazos;
- acompanhar saldos, estado do contrato, eventos e reversões num registro numerado das transações.

![Resultado dos testes predefinidos de um modelo](docs/img/readme-testes.png)

## Segurança dos contratos

Os modelos e as instruções enviadas à IA ([`assets/js/prompts.js`](assets/js/prompts.js)) adotam, entre outros requisitos:

- versão fixa do compilador e código autocontido, sem importações externas;
- partes recebidas no construtor, validadas e armazenadas como `immutable`;
- controle de acesso por modificadores em toda função que altere o estado;
- pagamentos pelo valor exato, padrão de saque ("pull payment"), envio por `call` com verificação do retorno, ordem "checks-effects-interactions" e trava contra reentrância;
- proibição de `tx.origin`, `selfdestruct`, `delegatecall`, `assembly` e aleatoriedade baseada em dados do bloco;
- máquina de estados, erros personalizados e eventos;
- percentuais em pontos-base, sem perda de precisão;
- registro expresso das limitações do "on-chain", como valores em moeda fiduciária e fatos do mundo real.

Cada versão do código passa por um **verificador local** (heurístico, sem IA, com referências ao registro SWC) e pode ser **compilada no navegador** com o compilador oficial (solc 0.8.28).

![Verificação de segurança e compilação](docs/img/readme-seguranca.png)

## Uso com IA (facultativo)

- A chave da API Gemini pode ser obtida gratuitamente no [Google AI Studio](https://aistudio.google.com/app/apikey).
- O modelo padrão é `gemini-flash-lite-latest`, de maior cota gratuita. Se o modelo escolhido não estiver disponível para a chave, o aplicativo passa a usar outro disponível.
- Ao atingir o limite de requisições do plano gratuito, o aplicativo aguarda o tempo indicado pelo Google, com contagem regressiva, e tenta novamente. O painel de configuração mostra quantas requisições foram feitas na sessão.
- Parâmetros ajustáveis: modelo, temperatura (padrão 0,2), rodadas de autocorreção (padrão 2) e compilação automática.

### Chave da API e privacidade

- A chave fica apenas no navegador: por padrão, até o fechamento da aba; com a opção "Lembrar neste navegador", de forma persistente. É enviada somente ao Google, no cabeçalho `x-goog-api-key`.
- Recomenda-se restringir a chave, no Google Cloud Console, ao referenciador HTTP `https://educhacon.github.io/*` e apenas à "Generative Language API".
- O texto e o código enviados à IA vão ao Google. No plano gratuito, o Google pode utilizar esse conteúdo para aprimorar seus produtos; por isso, não insira dados pessoais nem informações confidenciais. O modo de modelos revisados não envia nada a terceiros.
- A página adota política de segurança de conteúdo (CSP): só executa scripts do próprio site e só se conecta à API Gemini. As respostas da IA são exibidas sem interpretação de HTML.

## Estrutura do projeto

```
index.html                    página principal (endereço publicado no GitHub Pages)
assets/css/app.css            estilos (tema claro e escuro)
assets/js/app.js              controlador da interface
assets/js/templates.js        modelos revisados, extração por regras e cenários predefinidos
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

O site é estático e não exige etapa de compilação para ser publicado. Para rodar os testes ou regenerar a "blockchain" simulada:

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

`npm test` executa, entre outros:

- os testes do verificador de segurança e da extração por regras, em português e em inglês;
- para cada modelo e idioma, a compilação com o solc oficial (sem erros nem avisos), o verificador local (sem achados) e todos os cenários predefinidos na mesma EVM usada pela página.

## Limitações

- O verificador local é heurístico: pode deixar de apontar problemas ou apontar falsos positivos. Não substitui ferramentas como Slither ou Mythril.
- A extração por regras cobre redações usuais; textos atípicos podem exigir ajuste manual dos campos ou conferência com IA.
- A IA pode errar. O código e os cenários gerados por ela precisam de revisão humana.
- A "blockchain" simulada reproduz a EVM (versão Cancun), mas não reproduz custos reais de "gás", oráculos nem interação com outros contratos implantados na rede.
