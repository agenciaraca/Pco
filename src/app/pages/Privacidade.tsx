import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';
import { useSettings } from '../data/hooks';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function Privacidade() {
  const { data } = useSettings();
  useDocumentMeta({
    title: 'Política de Privacidade — AVA PCO',
    description: 'Política de privacidade da plataforma AVA PCO conforme LGPD.',
  });
  const siteName = data?.siteName ?? 'AVA PCO';
  const contact = data?.contactEmail ?? 'contato@psicanaliseclinica.online';

  return (
    <div className="min-h-screen bg-surface-off px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <Logo />
          <Link
            to="/login"
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Voltar ao login
          </Link>
        </header>

        <article className="pco-card p-8 text-sm text-ink-muted leading-relaxed space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-pco-deep">Política de Privacidade</h1>
            <p className="mt-1 text-xs text-ink-subtle">
              Aplicável a {siteName}. Última atualização: {new Date().toLocaleDateString('pt-BR')}.
            </p>
          </header>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">1. Dados que coletamos</h2>
            <p>
              Para operar o ambiente virtual de aprendizagem, coletamos: nome, e-mail, data de
              acesso, progresso nos cursos, interações com Tutor Virtual e biblioteca, eventuais
              avaliações respondidas e certificados emitidos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">2. Finalidades do tratamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Permitir o acesso autenticado ao AVA;</li>
              <li>Acompanhar progresso pedagógico e emitir certificados;</li>
              <li>
                Identificar risco de evasão e oferecer planos de retomada (somente para a equipe
                pedagógica);
              </li>
              <li>Atender solicitações de suporte;</li>
              <li>Cumprir obrigações legais.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">3. Base legal (LGPD)</h2>
            <p>
              Tratamos seus dados com base em: (i) execução de contrato e procedimentos
              preliminares, (ii) cumprimento de obrigação legal, (iii) legítimo interesse para
              acompanhamento pedagógico, e (iv) consentimento, quando aplicável (Art. 7º da Lei
              13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">4. Compartilhamento</h2>
            <p>
              Não vendemos dados pessoais. Compartilhamos somente com fornecedores de
              infraestrutura (hospedagem, e-mail) e provedores de IA quando solicitado pelo
              próprio usuário (ex.: pergunta ao Tutor Virtual). Esses parceiros tratam dados
              sob nossa instrução e contrato de operador.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">5. Retenção</h2>
            <p>
              Mantemos dados acadêmicos enquanto durar o vínculo com o AVA e por até 5 anos
              após o término, para emissão de declarações e certificados. Logs técnicos são
              mantidos por até 12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">6. Seus direitos</h2>
            <p>
              Você pode, a qualquer momento, solicitar acesso, correção, anonimização,
              portabilidade ou eliminação de seus dados pessoais (Art. 18 da LGPD). Para exercer,
              envie e-mail para <a href={`mailto:${contact}`} className="text-pco-blue hover:underline">{contact}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">7. Segurança</h2>
            <p>
              Senhas são armazenadas em hash bcrypt; sessões usam JWT com possibilidade de
              revogação em todos os dispositivos pelo próprio usuário. Mantemos logs de
              auditoria e captura de erros para investigação de incidentes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">8. Cookies</h2>
            <p>
              {data?.cookiePolicyText ??
                'Usamos cookies essenciais para autenticação e preferências. Não utilizamos cookies de rastreamento publicitário.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pco-deep mb-2">9. Alterações</h2>
            <p>
              Esta política pode ser atualizada para refletir mudanças legais ou operacionais.
              A data no topo indica a versão vigente.
            </p>
          </section>

          <footer className="border-t border-surface-gray pt-4 text-xs">
            Em caso de dúvidas, fale com{' '}
            <a href={`mailto:${contact}`} className="text-pco-blue hover:underline">
              {contact}
            </a>
            .
          </footer>
        </article>
      </div>
    </div>
  );
}
