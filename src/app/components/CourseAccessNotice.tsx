import { CalendarClock, Lock, PauseCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMyCourseAccess } from '../data/hooks';
import { ehEstadoDeSituacao, mensagemDeAcesso } from '../../../shared/mensagens-acesso';

/**
 * Aviso do prazo de acesso ao curso.
 *
 * Só aparece quando há algo a dizer: acesso vencido, ou vencendo nos próximos
 * 30 dias. Curso sem prazo e prazo folgado não geram ruído — um selo permanente
 * de "você ainda tem 400 dias" só treina o aluno a ignorar o aviso.
 */
export default function CourseAccessNotice({ courseId }: { courseId: string }) {
  const { data } = useMyCourseAccess();
  const row = data?.find((r) => r.courseId === courseId);
  if (!row) return null;
  if (row.state === 'lifetime' || row.state === 'active') return null;

  const vence = row.expiresAt
    ? new Date(row.expiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Situação da matrícula: suspensa ou cancelada.
  //
  // Este ramo não existia, e o efeito era 376 pessoas em produção vendo o curso
  // normal na estante, clicando numa aula e recebendo silêncio — o servidor
  // devolvia 403 com a explicação pronta e nenhuma tela a mostrava.
  //
  // Não repete o botão de renovar: renovar não é o que resolve nem o pagamento
  // pendente nem o cancelamento, e mandar a pessoa para a página errada na hora
  // em que ela já está barrada é o mesmo erro do e-mail que não existia.
  if (ehEstadoDeSituacao(row.state)) {
    const msg = mensagemDeAcesso(row.state);
    const suspensa = row.state === 'suspended';
    // Classes escritas por extenso, nunca montadas por interpolação: o Tailwind
    // varre o código por nome completo, e `bg-${cor}/5` não existiria no CSS
    // gerado — o aviso apareceria sem cor nenhuma, e sem erro que denunciasse.
    const moldura = suspensa
      ? 'border-status-warning/30 bg-status-warning/5'
      : 'border-status-danger/30 bg-status-danger/5';
    const corIcone = suspensa ? 'text-status-warning' : 'text-status-danger';
    const Icone = suspensa ? PauseCircle : Lock;
    return (
      <div className={`rounded-xl border p-4 ${moldura}`}>
        <div className="flex items-start gap-3">
          <Icone size={18} strokeWidth={1.75} className={`${corIcone} mt-0.5 shrink-0`} />
          <div>
            <h2 className="text-sm font-semibold text-pco-deep">{msg.titulo}</h2>
            <p className="mt-1 text-sm text-ink-muted">{msg.corpo}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Seu progresso, suas anotações e seu certificado continuam guardados.
            </p>
            <Link
              to={`/suporte?assunto=acesso&titulo=${encodeURIComponent(msg.titulo)}`}
              className="pco-btn-primary text-xs mt-3"
            >
              Falar com a coordenação
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (row.state === 'expired') {
    return (
      <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
        <div className="flex items-start gap-3">
          <Lock size={18} strokeWidth={1.75} className="text-status-danger mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-pco-deep">
              Seu acesso a este curso terminou{vence ? ` em ${vence}` : ''}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              As aulas ficam indisponíveis até você renovar. Seu progresso, suas anotações e seu
              certificado continuam guardados — quando renovar, você volta de onde parou.
            </p>
            {/* O texto anterior mandava "responder o e-mail de aviso de
                vencimento" — e-mail que nenhuma parte do sistema envia. Mandar
                o aluno atrás de algo inexistente, na hora em que ele já está
                barrado, é a pior hora possível. Aqui vai para um canal que
                existe, com o assunto já escolhido. */}
            <Link
              to={`/suporte?assunto=acesso&titulo=${encodeURIComponent('Renovação de acesso ao curso')}`}
              className="pco-btn-primary text-xs mt-3"
            >
              Pedir renovação
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // O ramo final é `expiring` **por nome**, não "tudo o que sobrou".
  //
  // Enquanto era um `else`, qualquer estado novo caía aqui e virava "seu acesso
  // termina em N dias" — uma contagem regressiva errada, dita com toda a
  // confiança, para alguém cujo caso é outro. Estado que este componente não
  // conhece não deve inventar mensagem: cala, e quem decide é quem o
  // acrescentar.
  if (row.state !== 'expiring') return null;

  const dias = row.daysLeft ?? 0;
  return (
    <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
      <div className="flex items-start gap-3">
        <CalendarClock
          size={18}
          strokeWidth={1.75}
          className="text-status-warning mt-0.5 shrink-0"
        />
        <div>
          <h2 className="text-sm font-semibold text-pco-deep">
            {dias <= 1
              ? 'Seu acesso a este curso termina hoje'
              : `Seu acesso a este curso termina em ${dias} dias`}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {vence ? `Vale até ${vence}. ` : ''}
            Depois disso as aulas ficam indisponíveis até a renovação. Se faltam módulos, este é um
            bom momento para adiantar.
          </p>
        </div>
      </div>
    </div>
  );
}
