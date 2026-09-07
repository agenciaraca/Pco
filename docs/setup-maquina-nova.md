# Montar o projeto numa máquina nova

Escrito depois da segunda mudança de máquina (6/set/2026). A primeira, em
31/ago, foi feita copiando a pasta inteira — e o `.git` veio dez commits atrás,
com parte dos objetos pela metade. Uma sessão que começasse ali refaria trabalho
já publicado ou commitaria por cima.

**A regra que sai daquilo: o código vem por `git clone`, não por cópia.** O que
se copia é só o que o git não carrega.

## O que o git carrega, e o que não

O repositório tem tudo que é código, teste, documentação, scripts e o handoff de
design (`design pagina publicas pco/`, versionado). Um `git clone` reconstrói
95% do projeto sem transferir nada por cabo.

Fica de fora, e precisa vir junto por outro caminho:

| item | onde | por quê |
| --- | --- | --- |
| `.env`, `.env.import` | raiz | credencial de produção — nunca versionada |
| `data/` | raiz | estado de execução; `data/*` é negado por padrão no `.gitignore`, com quatro sementes abertas nominalmente |
| `backups/` | raiz | despejos locais |
| `.claude/`, `.mcp.json` | raiz | configuração local do Claude Code |
| memórias do Claude Code | `%USERPROFILE%\.claude\projects\<caminho-com-traços>\memory\` | ficam no perfil do usuário, indexadas **pelo caminho do projeto** |
| `auditoria-ava-pco/` | pasta irmã | **não é repositório git**; existe só na cópia local |

## A pegadinha do caminho: a memória do Claude Code

A pasta de memória é nomeada a partir do caminho absoluto do projeto, com `\` e
`:` virando `-`:

- `H:\ia\dev\pco` → `H--ia-dev-pco`
- `C:\ia\dev\pco` → `C--ia-dev-pco`

**Mudar o projeto de letra de disco perde as memórias em silêncio** — nada dá
erro, elas simplesmente não são encontradas. Ao migrar, renomeie a pasta para o
caminho de destino antes de copiar.

## Sequência

```powershell
git clone https://github.com/agenciaraca/Pco.git C:\ia\dev\pco
cd C:\ia\dev\pco
git log -1 --oneline          # confira o HEAD contra a máquina de origem
# copiar por cima o que não é versionado (lista acima)
git status --short            # tem de sair VAZIO
npm install --legacy-peer-deps --no-audit --no-fund
npm run typecheck
npx vitest run --maxWorkers=1  # sem o --maxWorkers=1 morre por memória no meio
npm run dev
```

## Acesso ao servidor

A chave `pco_deploy` está instalada no usuário `avapco` do VPS e **não viaja
com o projeto** — copie do `~/.ssh` da máquina antiga por caminho separado, e
acrescente ao `~/.ssh/config`:

```
Host vps
    HostName 195.200.0.253
    User avapco
    IdentityFile ~/.ssh/pco_deploy
    IdentitiesOnly yes
```

Teste com `ssh vps 'pm2 describe ava-pco | head -5'`.

## O que dá para descartar sem perda

`node_modules`, `dist`, `coverage`, `*.tsbuildinfo`, `.playwright-mcp/` e
`exportacoes/` são todos regeneráveis. Em 6/set/2026 eles eram **738 MB dos
890 MB da pasta**.

Vale conferir também `data/uploads/`: naquela limpeza, os 60 MB de lá eram 20
arquivos que eram na verdade **dois PDFs repetidos dez vezes cada**, resto do
teste do upload da biblioteca, sem referência em store nenhum. Antes de apagar
upload, cheque se o nome do arquivo aparece em algum `data/*.json` — o que está
em uso está referenciado.

Dumps SQL na raiz (`/*.sql`, ignorados) são a base inteira de clientes dos dois
WordPress de origem, com hash de senha. Cada cópia é mais uma superfície de
exposição: só leve se for usar, e apague quando terminar.
