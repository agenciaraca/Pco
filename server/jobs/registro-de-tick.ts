/**
 * Um worker que falha todo ciclo não pode aparecer verde no painel.
 *
 * Os treze workers seguem o mesmo molde: `setInterval` chamando um tick
 * assíncrono, com o erro engolido para que um ciclo ruim não derrube o
 * processo. Isso está certo — o que estava errado é o que sobra depois.
 *
 * O tick típico gravava `lastRunAt` e `lastRunResult` **depois** de o trabalho
 * voltar. Se ele lançasse, a gravação não acontecia e o `.catch(() => {})`
 * apagava o rastro: o status ficava com o último resultado **bem-sucedido**,
 * `enabled` continuava `true`, e `/admin/jobs` mostrava um worker saudável com
 * um carimbo de hora velho. Ninguém vigia carimbo de hora. O worker podia estar
 * falhando há um mês.
 *
 * É a mesma classe do `catch` vazio da sondagem da Sandra, que custou pagamento
 * real deixando de virar matrícula em silêncio até a janela de 10 dias fechar.
 * Lá o conserto foi contar falhas seguidas e expor `saudavel`; aqui isso vira
 * peça única, para os nove workers que não sabiam dizer nada.
 *
 * **Por que uma falha já derruba `saudavel`.** Não há limiar. Para um worker
 * diário — o aviso de vencimento de acesso, por exemplo — um ciclo perdido é um
 * dia inteiro de aluno não avisado; esperar a terceira falha seria esperar três
 * dias. E como `saudavel` volta a `true` no primeiro sucesso, ele descreve o
 * estado de agora, não dispara alarme. Quem quiser graduar a gravidade tem
 * `falhasSeguidas`.
 */

export interface RegistroDeTick {
  /** Quando o último ciclo falhou. `null` = nenhum falhou nesta vida do processo. */
  ultimaFalhaEm: string | null;
  /** A mensagem da última falha, para a tela dizer o que houve. */
  ultimaFalha: string | null;
  /** Zerado a cada sucesso. É o que separa soluço de worker quebrado. */
  falhasSeguidas: number;
  /**
   * `null` é **"ainda não rodou"**, não "ok" — a mesma regra das telas de
   * métrica deste projeto. Zero e verde são afirmações; ausência de medição
   * não é nenhuma das duas.
   */
  saudavel: boolean | null;
}

export function novoRegistro(): RegistroDeTick {
  return {
    ultimaFalhaEm: null,
    ultimaFalha: null,
    falhasSeguidas: 0,
    saudavel: null,
  };
}

/**
 * Roda o tick e **nunca lança**: o `setInterval` continua vivo, como antes.
 * A diferença é que a falha passa a existir no status em vez de sumir.
 */
export async function comRegistro(
  registro: RegistroDeTick,
  tick: () => Promise<unknown>,
  rotulo: string,
): Promise<void> {
  try {
    await tick();
    registro.falhasSeguidas = 0;
    registro.saudavel = true;
  } catch (err) {
    registro.falhasSeguidas++;
    registro.ultimaFalhaEm = new Date().toISOString();
    registro.ultimaFalha = err instanceof Error ? err.message : String(err);
    registro.saudavel = false;
    // O log continua, além do status: quem está no terminal vê na hora, e quem
    // chega depois vê na tela. Um não substitui o outro.
    // eslint-disable-next-line no-console
    console.error(`[${rotulo}] ciclo falhou:`, registro.ultimaFalha);
  }
}

/** Só para teste: devolve o registro ao estado de "ainda não rodou". */
export function zerarRegistro(registro: RegistroDeTick): void {
  registro.ultimaFalhaEm = null;
  registro.ultimaFalha = null;
  registro.falhasSeguidas = 0;
  registro.saudavel = null;
}
