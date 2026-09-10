// Health check agregado para admin. Combina sinais de todos os módulos
// (gateways, e-mail, webhooks, AI, erros recentes, disco) em um único snapshot.

import { eq } from 'drizzle-orm';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as gatewaysRepo from '../payments/gateways-repo';
import { metodoConfigurado } from '../payments/roteamento';
import { METODOS_PAGAMENTO } from '../../shared/metodos-pagamento';
import * as emailConfigs from '../notifications/config-store';
import * as emailLogs from '../notifications/log-store';
import * as webhookEndpoints from '../webhooks/endpoints-store';
import * as webhookDeliveries from '../webhooks/delivery-store';
import * as aiConfigs from '../repositories/ai-configs';
import { listErrors } from '../errors/store';
import { hasDb, getDb, schema } from '../db/client';
import * as usersStore from '../auth/users-store';

export type HealthStatus = 'ok' | 'warn' | 'error' | 'na';

export interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  message: string;
  metric?: string | number;
}

export interface HealthSnapshot {
  generatedAt: string;
  overall: HealthStatus;
  checks: HealthCheckItem[];
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

export async function buildSnapshot(): Promise<HealthSnapshot> {
  const checks: HealthCheckItem[] = [];

  // 1) Storage backend
  checks.push({
    id: 'storage',
    label: 'Storage',
    status: 'ok',
    message: hasDb() ? 'Postgres conectado' : 'JSON local (DATA_DIR)',
  });

  // 2) Gateways
  try {
    const gws = await gatewaysRepo.listAll();
    const active = gws.filter((g) => g.active);
    // Dois gateways ativos e nenhum roteamento **não é** um estado saudável, e
    // era o estado de produção: a tela dizia "apenas o gateway ativo é usado",
    // no singular, enquanto o código pegava `listActive()[0]`. Como o cadastro
    // faz `unshift`, esse primeiro é o último criado — quem cadastrasse um
    // gateway novo e ativo levava todas as vendas na hora.
    const semRota = (
      await Promise.all(
        METODOS_PAGAMENTO.map(async (m) => ((await metodoConfigurado(m)) ? null : m)),
      )
    ).filter((m): m is (typeof METODOS_PAGAMENTO)[number] => m !== null);
    const ambiguo = active.length > 1 && semRota.length === METODOS_PAGAMENTO.length;
    checks.push({
      id: 'gateways',
      label: 'Gateways de pagamento',
      status: active.length === 0 || ambiguo ? 'warn' : 'ok',
      message:
        active.length === 0
          ? 'Nenhum gateway ativo — checkout não funciona'
          : ambiguo
            ? `${active.length} gateways ativos e nenhum roteamento: quem cobra é o primeiro da lista, não uma escolha`
            : semRota.length > 0
              ? `${active.length} ativo(s) de ${gws.length} · sem roteamento para ${semRota.join(', ')}`
              : `${active.length} ativo(s) de ${gws.length} · roteamento configurado`,
      metric: active.length,
    });
  } catch (err) {
    checks.push({
      id: 'gateways',
      label: 'Gateways de pagamento',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro ao listar',
    });
  }

  /*
    2b) O reserva rebaixa a promessa de parcelamento?

    A promessa é o mínimo entre os candidatos da rota, então um reserva fraco
    derruba o método inteiro — e isso não dá erro em lugar nenhum: aparece como
    uma linha a menos na vitrine, que é onde ninguém procura.

    Aconteceu duas vezes com o mesmo par: Asaas faz 6x no boleto, Pagar.me faz
    1x, e `min(6,1) = 1`. Em 5/set o site parou de anunciar o boleto parcelado
    que a escola vende; foi desfeito em 6/set e **voltou em 8/set**, pela tela.
    Duas vezes o mesmo prejuízo diz que faltava código, não atenção.

    É `warn`, e não `error`, porque rebaixar pode ser deliberado — aceitar menos
    parcelas para ter um segundo gateway é troca legítima, e é do dono. O que
    não pode é acontecer em silêncio.
  */
  try {
    const { rebaixamentosDeParcela } = await import('../payments/reserva-rebaixa');
    const quedas = await rebaixamentosDeParcela();
    if (quedas.length > 0) {
      checks.push({
        id: 'parcelamento',
        label: 'Promessa de parcelamento',
        status: 'warn',
        // O número anda junto: quanto se prometia, quanto se promete, por quem.
        message: quedas
          .map(
            (q) =>
              `${q.metodo}: ${q.comOPrincipal}x cai para ${q.comOReserva}x por causa do reserva (${q.reserva})`,
          )
          .join(' · '),
        metric: quedas.length,
      });
    }
  } catch {
    // ignora
  }

  /*
    2c) A página do curso se contradiz?

    Os chips do topo contam os módulos reais; a grade "Conteúdo do curso" vem
    de `curriculum`, um campo editorial digitado à mão. Medido em 9/set/2026 no
    carro-chefe: **19 no chip, 15 na grade**. Quatro módulos que o aluno compra
    não aparecem no lugar em que ele decide comprar, e a página mostra os dois
    números na mesma tela.

    Nada disso dá erro: a página responde 200 e os dois números estão lá.
  */
  try {
    const { conferirGrades } = await import('../public/vitrine-coerente');
    const r = await conferirGrades();
    if (r.erro) {
      checks.push({
        id: 'vitrine-grade',
        label: 'Grade publicada',
        status: 'na',
        message: `Não deu para conferir as grades: ${r.erro}`,
      });
    } else if (r.divergentes.length > 0) {
      checks.push({
        id: 'vitrine-grade',
        label: 'Grade publicada',
        status: 'warn',
        message: r.divergentes
          .map(
            (d) =>
              `${d.titulo}: a página anuncia ${d.modulos} módulos e a grade lista ${d.naGrade}`,
          )
          .join(' · '),
        metric: r.divergentes.length,
      });
    }
  } catch {
    // ignora
  }

  // 3) E-mail config
  try {
    const cfgs = await emailConfigs.listConfigs();
    const active = cfgs.find((c) => c.enabled && c.provider !== 'mock');
    if (!active) {
      checks.push({
        id: 'email',
        label: 'E-mail transacional',
        status: 'warn',
        message:
          cfgs.length === 0
            ? 'Nenhuma configuração — alunos não recebem e-mails'
            : 'Apenas mock ativo (sem provider real)',
      });
    } else {
      checks.push({
        id: 'email',
        label: 'E-mail transacional',
        status: active.lastTestStatus === 'error' ? 'error' : 'ok',
        message: `Provider: ${active.provider}${active.lastTestStatus ? ` · último teste: ${active.lastTestStatus}` : ''}`,
      });
    }
  } catch (err) {
    checks.push({
      id: 'email',
      label: 'E-mail transacional',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro',
    });
  }

  // 4) E-mail entregas recentes (últimas 24h)
  try {
    const logs = await emailLogs.listLogs(500);
    const cutoff = Date.now() - 24 * 60 * 60_000;
    const recent = logs.filter((l) => new Date(l.ts).getTime() >= cutoff);
    const failed = recent.filter((l) => l.status === 'failed').length;
    const sent = recent.filter((l) => l.status === 'sent').length;
    checks.push({
      id: 'email_recent',
      label: 'Envios de e-mail (24h)',
      status: failed > sent ? 'warn' : 'ok',
      message: `${sent} enviados, ${failed} falhos`,
      metric: sent,
    });
  } catch {
    // ignora — pode não existir log ainda
  }

  // 5) Webhooks
  try {
    const eps = await webhookEndpoints.listEndpoints();
    const active = eps.filter((e) => e.enabled);
    const recentFailed = active.filter(
      (e) => e.lastFailureAt && (!e.lastSuccessAt || e.lastFailureAt > e.lastSuccessAt),
    ).length;
    checks.push({
      id: 'webhooks',
      label: 'Webhooks de saída',
      status: recentFailed > 0 ? 'warn' : 'ok',
      message:
        eps.length === 0
          ? 'Nenhum endpoint configurado'
          : `${active.length} ativos${recentFailed > 0 ? `, ${recentFailed} com falha recente` : ''}`,
      metric: active.length,
    });
  } catch (err) {
    checks.push({
      id: 'webhooks',
      label: 'Webhooks de saída',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro',
    });
  }

  // 6) Webhook deliveries recentes
  try {
    const dl = await webhookDeliveries.listAll(200);
    const cutoff = Date.now() - 60 * 60_000;
    const recent = dl.filter((d) => new Date(d.createdAt).getTime() >= cutoff);
    const failed = recent.filter((d) => d.status === 'failed').length;
    const success = recent.filter((d) => d.status === 'success').length;
    checks.push({
      id: 'webhook_deliveries',
      label: 'Entregas webhook (1h)',
      status: failed > 0 && failed >= success ? 'warn' : 'ok',
      message: `${success} ok, ${failed} falhas`,
      metric: success,
    });
  } catch {
    // ignora
  }

  // 7) AI providers
  try {
    const configs = await aiConfigs.listConfigs();
    const active = configs.filter((c) => c.active);
    checks.push({
      id: 'ai',
      label: 'IAs',
      status: active.length === 0 ? 'warn' : 'ok',
      message:
        active.length === 0
          ? 'Nenhuma IA habilitada — Tutor não responde'
          : `${active.length} habilitada(s) de ${configs.length}`,
      metric: active.length,
    });
  } catch (err) {
    checks.push({
      id: 'ai',
      label: 'IAs',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro',
    });
  }

  // 8) Erros do servidor (últimas 24h)
  try {
    const errs = await listErrors({ limit: 500 });
    const cutoff = Date.now() - 24 * 60 * 60_000;
    const recent = errs.filter((e) => new Date(e.ts).getTime() >= cutoff);
    checks.push({
      id: 'errors',
      label: 'Erros 5xx (24h)',
      status: recent.length > 50 ? 'error' : recent.length > 10 ? 'warn' : 'ok',
      message: `${recent.length} ocorrências`,
      metric: recent.length,
    });
  } catch {
    // ignora
  }

  // 9) Aluno sem credencial de login
  //
  // Credencial e aluno moram em lugares diferentes: a senha vive no store de
  // usuários e a pessoa como aluno vive no Postgres. Quem entra por um caminho
  // que escreve só no banco — carga da migração, sincronizador da loja — fica
  // visível no admin, com matrícula, e não consegue entrar. Em 17/ago/2026 eram
  // 63 pessoas assim, e nada no sistema denunciava. Este check denuncia.
  try {
    const db = getDb();
    if (db) {
      const alunosDb = await db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.role, 'student'));
      const comCredencial = new Set(
        (await usersStore.listUsers()).map((u) => u.email.toLowerCase()),
      );
      const semLogin = alunosDb.filter((r) => !comCredencial.has((r.email ?? '').toLowerCase()));
      checks.push({
        id: 'alunos-sem-login',
        label: 'Alunos sem credencial',
        status: semLogin.length === 0 ? 'ok' : 'error',
        message:
          semLogin.length === 0
            ? 'todo aluno do banco consegue tentar entrar'
            : `${semLogin.length} aluno(s) aparecem no admin e NÃO conseguem entrar — rode scripts/provision_missing_logins.ts`,
        metric: semLogin.length,
      });
    }
  } catch {
    // ignora
  }

  /*
    10) A venda está passando?

    Entre 3 e 5/set/2026 toda compra falhou e ninguém soube por dois dias, com
    campanha paga rodando. O botão de testar gateway não pega esse caso — ele
    lê credencial, e a credencial estava boa; "produto não habilitado" só
    aparece na cobrança real. O único sinal era a fila de pedidos falhando.

    `taxaFalhaPct` nulo é 'na', não 'ok': pouco movimento não é saúde
    confirmada, e um verde ali diria que se mediu quando não se mediu.
  */
  try {
    const { avaliarCheckout, resumoLegivel } = await import('../payments/saude-do-checkout');
    const sc = await avaliarCheckout();
    checks.push({
      id: 'checkout',
      label: 'Checkout (24h)',
      /*
        `alertaDeRecusas` é conferido ANTES do `null`, e a ordem é o conserto.

        Recusa antes do pedido não aparece em `payment_orders`, então o dia em
        que ninguém consegue nem criar pedido dá `taxaFalhaPct === null` — e
        este cartão pintava 'na' ("sem base para medir") justamente quando a
        venda estava parada. Foi o que aconteceu em 7/set/2026.
      */
      status: sc.alertaDeRecusas
        ? 'error'
        : sc.taxaFalhaPct === null
          ? 'na'
          : sc.alerta
            ? 'error'
            : 'ok',
      message: resumoLegivel(sc),
      metric: sc.taxaFalhaPct ?? '—',
    });
  } catch {
    // ignora
  }

  /*
    11) Workers.

    Faltava aqui, e é onde o operador olha primeiro. Até 7/set/2026 nove dos
    treze workers não guardavam nada sobre o próprio ciclo: um tick que
    lançava era engolido, o status ficava com o último resultado bem-sucedido,
    e `/admin/jobs` mostrava tudo verde. Agora que eles reportam, o painel de
    saúde precisa perguntar.

    **O estado sai só de `saudavel === false`**, que é falha medida. `enabled`
    ficou de fora de propósito: em Vercel Functions worker nenhum roda, e
    tratar isso como problema encheria o painel de alarme falso justamente
    onde não há o que alarmar. Quem quiser ver quem está parado tem
    `/admin/jobs`.

    O nome de quem falhou vai na mensagem. É o que transforma "algum worker
    falhou" em "o aviso de vencimento de acesso falhou" — sem isso, o alerta
    manda alguém abrir outra tela para descobrir o que ele já sabia.
  */
  try {
    const { listarJobs } = await import('../jobs/inventario');
    const jobs = listarJobs();
    const comFalha = jobs.filter((j) => j.saudavel === false);
    const medidos = jobs.filter((j) => j.saudavel !== null);
    /*
      Um tick pode completar e não ter feito nada.

      `saudavel` responde "o ciclo terminou?". Os workers que percorrem itens
      pegam o erro POR ITEM, contam e seguem — então um tick que examina 200
      lembretes, falha nos 200 e devolve `{ enviados: 0, erros: 200 }` termina
      bem e fica verde aqui. É a forma exata do defeito que este projeto
      persegue: a rotina rodou, contou e reportou sucesso, e ninguém recebeu o
      aviso da sessão que pagou.

      Dois níveis, porque as duas situações pedem ações diferentes:

      - **nada passou** (`erros > 0` e `ok === 0`) é `error`: é o worker mudo,
        e a causa costuma ser uma só — credencial de e-mail vencida, provedor
        fora. Vale acordar alguém.
      - **algo falhou** (`erros > 0` com algum `ok`) é `warn`: endereço
        inválido de um aluno entre duzentos não pode pintar o painel de
        vermelho, mas também não pode sumir.

      `ultimoCiclo: null` fica de fora dos dois: é "não conta itens", não zero.
    */
    const mudos = jobs.filter(
      (j) => j.ultimoCiclo && j.ultimoCiclo.erros > 0 && j.ultimoCiclo.ok === 0,
    );
    const comAlgumErro = jobs.filter(
      (j) => j.ultimoCiclo && j.ultimoCiclo.erros > 0 && j.ultimoCiclo.ok > 0,
    );
    const nomes = (lista: typeof jobs) => lista.map((j) => j.rotulo).join(', ');
    checks.push({
      id: 'workers',
      label: 'Workers',
      status:
        comFalha.length > 0 || mudos.length > 0
          ? 'error'
          : comAlgumErro.length > 0
            ? 'warn'
            : medidos.length === 0
              ? 'na'
              : 'ok',
      message:
        comFalha.length > 0 || mudos.length > 0
          ? [
              comFalha.length > 0 ? `Falhando: ${nomes(comFalha)}` : '',
              mudos.length > 0 ? `Rodou sem entregar nada: ${nomes(mudos)}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : comAlgumErro.length > 0
            ? `Com erros no último ciclo: ${nomes(comAlgumErro)}`
            : medidos.length === 0
              ? 'Nenhum ciclo completou ainda nesta vida do processo'
              : `${medidos.length} de ${jobs.length} já rodaram, sem falha no último ciclo`,
      metric: `${medidos.length}/${jobs.length}`,
    });
  } catch {
    // ignora
  }

  /*
    12) Backup — e a pergunta é feita ao DISCO.

    O painel tinha doze verificações e nenhuma sobre a cópia dos dados. É a
    mesma falta que os workers tinham até 7/set/2026, no lugar em que ela custa
    mais: backup incompleto é indistinguível de backup completo até o dia em
    que alguém precisa dele.

    Perguntar ao worker não resolveria. O status dele fala só desta vida do
    processo, a snapshot acontece numa janela de uma hora, e produção reinicia
    o tempo todo — na maior parte do dia ele não tem o que responder. Quem
    sabe de que dia é a última cópia é o disco.

    Três estados, e o terceiro é o que não podia faltar:

    - **`error`** quando há banco e nenhuma cópia dele em disco. É o estado que
      pode custar a base inteira.
    - **`warn`** quando a cópia existe mas está atrasada. Um dia de atraso é
      normal (a snapshot é de madrugada e o dia vira antes dela); dois já é
      sinal de que alguma noite passou em branco.
    - **`na`** quando não deu para olhar. Não conseguir ler o diretório não é
      "não há backup", e tratar como se fosse mandaria alguém correr atrás de
      uma cópia que está lá.
  */
  try {
    const { copiaMaisRecente } = await import('../db/ultima-copia');
    const copia = await copiaMaisRecente();
    const alvo = hasDb() ? copia.banco : copia.qualquer;
    const oQue = hasDb() ? 'do banco' : 'dos arquivos';
    if (copia.erro) {
      checks.push({
        id: 'backup',
        label: 'Backup',
        status: 'na',
        message: `Não deu para olhar as cópias: ${copia.erro}`,
      });
    } else if (!alvo) {
      checks.push({
        id: 'backup',
        label: 'Backup',
        status: 'error',
        message: `Nenhuma cópia ${oQue} em disco`,
      });
    } else {
      const atrasada = alvo.idadeEmDias >= 2;
      checks.push({
        id: 'backup',
        label: 'Backup',
        status: atrasada ? 'warn' : 'ok',
        // O número anda com a base: a data e o que ela contém, para que o
        // "ok" seja conferível sem abrir outra tela.
        message:
          `Última cópia ${oQue}: ${alvo.data}` +
          (hasDb() ? ` · ${alvo.tabelas} tabelas` : '') +
          ` · ${alvo.arquivos} arquivos` +
          (atrasada ? ` · ATRASADA (${alvo.idadeEmDias} dias)` : ''),
        metric: alvo.idadeEmDias,
      });
    }
  } catch {
    // ignora
  }

  /*
    12b) O rotador de log está vigiando alguma coisa?

    Ele existe para que o disco cheio não derrube a aplicação. Medido em
    produção em 9/set/2026: o alvo é `~/ava-pco/app.log`, parado desde 24/jul,
    enquanto o log vivo é o do PM2 — que cresce e não tem rotação. O worker
    dizia-se saudável porque "não precisou rotacionar" e "não há o que
    rotacionar" eram a mesma resposta.

    `null` continua sendo "ainda não olhou", e não vira aviso: o primeiro ciclo
    deste worker só acontece cinco minutos depois do boot.
  */
  try {
    const { getStatus } = await import('../services/log-rotator');
    const s = getStatus();
    const receita =
      'Defina APP_LOG_PATH para onde a aplicação de fato escreve, ou rotacione ' +
      'o log pelo gerenciador do processo (pm2 install pm2-logrotate).';
    // Duas formas de "vigiar o nada", e a segunda é a que acontece de verdade:
    // o arquivo existe, tem tamanho e cara de log, e ninguém escreve nele.
    const paradoHaDias = s.alvoParadoDesde
      ? Math.floor((Date.now() - new Date(s.alvoParadoDesde).getTime()) / 86_400_000)
      : null;
    if (s.alvoExiste === false) {
      checks.push({
        id: 'log-rotator',
        label: 'Rotação de log',
        status: 'warn',
        message: `Vigiando um caminho que não existe: ${s.logPath}. ${receita}`,
      });
    } else if (paradoHaDias !== null && paradoHaDias >= 7) {
      checks.push({
        id: 'log-rotator',
        label: 'Rotação de log',
        status: 'warn',
        message:
          `O log vigiado não recebe uma linha há ${paradoHaDias} dias (${s.logPath}) — ` +
          `a aplicação escreve em outro lugar, e esse outro lugar não tem rotação. ${receita}`,
        metric: paradoHaDias,
      });
    }
  } catch {
    // ignora
  }

  // 13) Disk usage (data dir)
  try {
    const usage = await diskUsage(DATA_DIR);
    checks.push({
      id: 'disk',
      label: 'Disco (data/)',
      status: usage > 1024 * 1024 * 1024 ? 'warn' : 'ok',
      message: formatBytes(usage),
      metric: usage,
    });
  } catch {
    // ignora
  }

  const overall: HealthStatus = checks.some((c) => c.status === 'error')
    ? 'error'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'ok';

  return {
    generatedAt: new Date().toISOString(),
    overall,
    checks,
  };
}

async function diskUsage(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += await diskUsage(full);
      } else if (e.isFile()) {
        const st = await fs.stat(full);
        total += st.size;
      }
    }
  } catch {
    // ignora dirs sem permissão
  }
  return total;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
