import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';
import { useT } from '../i18n';

const checkboxes = [
  'Li e aceito os Termos de Uso do AVA PCO.',
  'Li e aceito a Política de Privacidade.',
  'Entendo que o Tutor Virtual é uma ferramenta de apoio pedagógico limitada aos cursos da PCO.',
  'Entendo que o Tutor Virtual não substitui professores, supervisão clínica, atendimento psicológico, médico ou jurídico.',
  'Autorizo o uso dos meus dados acadêmicos para acompanhamento da minha jornada dentro do AVA.',
];

export default function Terms() {
  const t = useT();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<boolean[]>(new Array(checkboxes.length).fill(false));
  const allChecked = checked.every(Boolean);

  return (
    <div className="min-h-screen bg-surface-off px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Logo className="mb-8" />

        <div className="pco-card p-8">
          <h1 className="text-2xl font-bold text-pco-deep">{t('terms.title')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Antes de seguir, leia e confirme os itens abaixo. Eles garantem clareza no uso do AVA PCO.
          </p>

          <div className="mt-6 max-h-72 overflow-y-auto rounded-xl border border-surface-gray bg-surface-off p-5 text-sm text-ink-muted leading-relaxed">
            <h3 className="font-semibold text-pco-deep mb-2">1. Sobre o AVA PCO</h3>
            <p className="mb-3">
              O AVA PCO é o ambiente virtual de aprendizagem destinado exclusivamente ao estudo dos
              cursos da PCO. Ele não realiza vendas, cobranças ou matrícula comercial.
            </p>
            <h3 className="font-semibold text-pco-deep mb-2">2. Tutor Virtual e limites</h3>
            <p className="mb-3">
              O Tutor Virtual é uma ferramenta pedagógica baseada em IA, com escopo limitado às
              dúvidas dos cursos. Não substitui supervisão clínica, atendimento psicológico,
              orientação médica ou jurídica.
            </p>
            <h3 className="font-semibold text-pco-deep mb-2">3. Privacidade</h3>
            <p>
              Seus dados acadêmicos são utilizados para acompanhamento da sua jornada de
              aprendizagem dentro do AVA, conforme detalhado na Política de Privacidade da PCO.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {checkboxes.map((label, i) => (
              <label
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-gray cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
                  checked={checked[i]}
                  onChange={(e) => {
                    const next = [...checked];
                    next[i] = e.target.checked;
                    setChecked(next);
                  }}
                />
                <span className="text-sm text-ink-base">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            disabled={!allChecked}
            className="mt-6 pco-btn-primary w-full justify-center"
          >
            Concordo e entrar no AVA
            <ArrowRight size={14} strokeWidth={2} />
          </button>

          <Link
            to="/login"
            className="mt-4 block text-center text-xs text-ink-muted hover:text-pco-blue"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
