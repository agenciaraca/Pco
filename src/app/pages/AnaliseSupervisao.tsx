import { Stethoscope, Users, Compass, Calendar, AlertCircle } from 'lucide-react';
import { sessionServices, professionals } from '../data/seed';

export default function AnaliseSupervisao() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Análise e Supervisão</h1>
        <p className="pco-section-subtitle mt-1">
          Serviços opcionais de apoio à sua trajetória formativa.
        </p>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">
          Análise e supervisão são serviços opcionais, contratados separadamente, e não são
          obrigatórios para conclusão do curso ou emissão de certificado.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        {sessionServices.map((s) => {
          const Icon =
            s.type === 'analise' ? Stethoscope : s.type === 'supervisao' ? Users : Compass;
          return (
            <div key={s.id} className="pco-card pco-card-hover">
              <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center mb-3">
                <Icon size={18} className="text-pco-blue" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-semibold text-pco-deep">{s.name}</h3>
              <p className="mt-1 text-xs text-ink-muted">{s.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-off p-2">
                  <div className="text-[10px] text-ink-subtle">Duração</div>
                  <div className="font-semibold text-pco-deep">{s.durationMinutes} min</div>
                </div>
                <div className="rounded-lg bg-surface-off p-2">
                  <div className="text-[10px] text-ink-subtle">Valor</div>
                  <div className="font-semibold text-pco-deep">
                    R$ {s.price.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
              <button className="pco-btn-primary w-full justify-center text-xs mt-4">
                <Calendar size={12} strokeWidth={2} />
                Ver horários
              </button>
              <p className="mt-2 text-[10px] text-ink-subtle text-center">Serviço opcional</p>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-4">Profissionais</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {professionals.map((p) => (
            <div key={p.id} className="pco-card pco-card-hover">
              <div className="flex items-start gap-4">
                <div
                  className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${p.avatarColor} grid place-items-center text-white text-base font-semibold shrink-0`}
                >
                  {p.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-pco-deep">{p.name}</h3>
                  <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{p.bio}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.specialties.map((sp) => (
                      <span key={sp} className="pco-badge bg-pco-blue/10 text-pco-blue">
                        {sp}
                      </span>
                    ))}
                  </div>
                  <button className="mt-3 pco-btn-secondary text-xs">Ver agenda</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-4">Minhas sessões</h2>
        <div className="pco-card text-center py-10">
          <p className="text-sm text-ink-muted">
            Você ainda não tem sessões agendadas. Escolha um serviço para iniciar.
          </p>
        </div>
      </section>
    </div>
  );
}
