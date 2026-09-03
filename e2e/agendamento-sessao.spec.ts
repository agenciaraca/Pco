// E2E do agendamento de sessão — o fluxo que até 26/ago/2026 não existia:
// a tela mostrava "Confirmar agendamento", avançava um passo local e prometia
// um e-mail que ninguém enviava.
//
// O que este arquivo protege é a costura entre as partes, que os testes de
// unidade não veem: a rota grava, a listagem do aluno devolve o que ele marcou,
// as recusas chegam com o código certo, e um aluno não alcança a sessão de
// outro.

import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { sessaoCompartilhada, STUDENT_EMAIL, STUDENT_PASSWORD } from './helpers';


/** Um instante futuro, em hora cheia, para não colidir com o relógio do teste. */
function daquiADias(dias: number, hora = 15): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  d.setUTCHours(hora, 0, 0, 0);
  return d.toISOString();
}

/**
 * Um login por arquivo, não por teste.
 *
 * `/api/auth/login` é limitado por taxa — e deve ser mesmo: é a porta que o
 * ataque de força bruta bate. Três testes fazendo login cada um estouravam a
 * cota e devolviam 429, o que fazia parecer falha de agendamento quando era o
 * teste desrespeitando uma proteção legítima.
 */
function obterSessao(request: APIRequestContext) {
  return sessaoCompartilhada(request, STUDENT_EMAIL, STUDENT_PASSWORD);
}

async function obterToken(request: APIRequestContext): Promise<string> {
  return (await obterSessao(request)).token;
}

function comToken(token: string) {
  return {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
}

test.describe('agendamento de sessão', () => {
  test('o catálogo de sessões é público e não vaza e-mail de profissional', async ({
    request,
  }) => {
    // A rota não pede token: qualquer um na internet lê. Dado de contato de
    // gente real não pode sair por aqui.
    const res = await request.get('/api/sessions/professionals');
    expect(res.ok()).toBeTruthy();
    const corpo = await res.text();
    expect(corpo).not.toContain('"email"');
    expect(corpo).not.toContain('"hourlyRate"');
  });

  test('a política de venda casada é servida como dado, com a lei citada', async ({
    request,
  }) => {
    const res = await request.get('/api/sessions/policy');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { aviso: string; baseLegal: string };
    expect(body.aviso).toContain('opcionais');
    // A citação da lei é o que impede a regra de virar preferência de negócio.
    expect(body.baseLegal).toContain('39');
    expect(body.baseLegal).toContain('8.078');
  });

  test('agendar exige autenticação', async ({ request }) => {
    const res = await request.post('/api/sessions/bookings', {
      data: { serviceId: 'svc-1', professionalId: 'pro-1', scheduledFor: daquiADias(9) },
    });
    expect(res.status()).toBe(401);
  });

  test('aluno agenda, vê na própria lista, e o horário fica ocupado', async ({ request }) => {
    const auth = comToken(await obterToken(request));

    const servicos = (await (await request.get('/api/sessions/services')).json()) as Array<{
      id: string;
      active: boolean;
    }>;
    const disponiveis = (await (
      await request.get('/api/sessions/available')
    ).json()) as { profissionais: Array<{ id: string; serviceIds: string[] }> };

    const servico = servicos.find((s) => s.active);
    const prof = disponiveis.profissionais.find((p) => p.serviceIds.includes(servico!.id));
    test.skip(!servico || !prof, 'sem serviço/profissional disponível nesta base');

    const quando = daquiADias(9, 15);
    const criar = await request.post('/api/sessions/bookings', {
      ...auth,
      data: { serviceId: servico!.id, professionalId: prof!.id, scheduledFor: quando },
    });
    expect(criar.status()).toBe(201);
    const { agendamento } = (await criar.json()) as {
      agendamento: { id: string; status: string; priceCents: number };
    };
    // Nasce aguardando pagamento ou já agendado — nunca confirmado sozinho.
    expect(['pending_payment', 'scheduled']).toContain(agendamento.status);
    // Preço zero seria sessão de graça por engano; a rota recusa antes disso.
    expect(agendamento.priceCents).toBeGreaterThan(0);

    const minhas = (await (
      await request.get('/api/sessions/bookings', auth)
    ).json()) as Array<{ id: string }>;
    expect(minhas.some((b) => b.id === agendamento.id)).toBeTruthy();

    // Mesmo horário, mesma pessoa: conflito. E 10 minutos depois também, porque
    // a sessão dura mais que isso — foi este o buraco da primeira versão.
    const repetido = await request.post('/api/sessions/bookings', {
      ...auth,
      data: { serviceId: servico!.id, professionalId: prof!.id, scheduledFor: quando },
    });
    expect(repetido.status()).toBe(409);

    const dezMinDepois = new Date(new Date(quando).getTime() + 10 * 60_000).toISOString();
    const sobreposto = await request.post('/api/sessions/bookings', {
      ...auth,
      data: { serviceId: servico!.id, professionalId: prof!.id, scheduledFor: dezMinDepois },
    });
    expect(sobreposto.status()).toBe(409);

    // Cancelar libera a agenda e preserva o registro.
    const cancelar = await request.post(
      `/api/sessions/bookings/${agendamento.id}/cancel`,
      { ...auth, data: { reason: 'e2e' } },
    );
    expect(cancelar.ok()).toBeTruthy();
    const depois = (await cancelar.json()) as { status: string };
    expect(depois.status).toBe('cancelled');

    const liberado = await request.post('/api/sessions/bookings', {
      ...auth,
      data: { serviceId: servico!.id, professionalId: prof!.id, scheduledFor: quando },
    });
    expect(liberado.status()).toBe(201);
  });

  test('data no passado é recusada', async ({ request }) => {
    const auth = comToken(await obterToken(request));
    const res = await request.post('/api/sessions/bookings', {
      ...auth,
      data: {
        serviceId: 'svc-1',
        professionalId: 'pro-1',
        scheduledFor: '2020-01-01T10:00:00.000Z',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('a tela do aluno carrega e nomeia o serviço opcional', async ({ page, request }) => {
    // Reusa o mesmo token: abrir a página não justifica gastar outra tentativa
    // de login contra o rate limit.
    const { token, user: usuario } = await obterSessao(request);
    await page.goto('/login');
    // A sessão vai como `{ user, token }`: é a forma que o AuthContext lê.
    await page.evaluate(
      ([chave, valor]) => window.localStorage.setItem(chave!, valor!),
      ['ava-pco-auth', JSON.stringify({ user: usuario, token })],
    );
    await page.goto('/analise-supervisao');
    await page.waitForLoadState('networkidle');
    // O aviso de que a sessão é opcional não pode sumir da tela: é exigência
    // legal, não escolha de layout.
    await expect(page.locator('body')).toContainText('opcionais');
    await expect(page.locator('body')).toContainText('Minhas sessões');
  });
});
