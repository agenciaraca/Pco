import { useState, useEffect, useRef } from 'react';
import {
  User,
  Save,
  Lock,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Flame,
  Award,
  PlayCircle,
  Download,
  Trash2,
  Target,
  Globe,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';
import LocaleSwitcher from '../components/LocaleSwitcher';
import {
  useMyProgress,
  useMyStudyHeatmap,
  useCertificates,
  useMyNotificationPrefs,
  useSnoozeNotifications,
  useMyDeletionRequest,
  useRequestAccountDeletion,
  useCancelDeletionRequest,
  useUpdateMyNotificationPrefs,
} from '../data/hooks';
import * as api from '../data/api';
import TwoFactorAuthCard from '../components/TwoFactorAuthCard';
import AchievementsPanel from '../components/AchievementsPanel';
import StudyHeatmap from '../components/StudyHeatmap';
import { SemConexao, FalhaAoCarregar } from '../components/EstadosDeConsulta';
import ProfileCompleteness, {
  type ProfileItem,
} from '../components/ProfileCompleteness';

export default function Profile() {
  const { user, patchUser } = useAuth();
  const toast = useToast();
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const progressQ = useMyProgress();
  const heatmapQ = useMyStudyHeatmap();
  const certsQ = useCertificates();
  const notifPrefsQ = useMyNotificationPrefs();
  const updateNotifPrefs = useUpdateMyNotificationPrefs();
  const snoozeMut = useSnoozeNotifications();
  const myDeletionQ = useMyDeletionRequest();
  const reqDeletionMut = useRequestAccountDeletion();
  const cancelDeletionMut = useCancelDeletionRequest();

  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  const profileItems: ProfileItem[] = [
    {
      key: 'name',
      label: 'Nome completo preenchido',
      done: !!user?.name && user.name.trim().length >= 4,
      hint: 'Informe nome e sobrenome',
    },
    {
      key: 'avatar',
      label: 'Foto de perfil',
      done: !!user?.avatarUrl,
      hint: 'Faça upload de uma foto pra deixar seu perfil mais pessoal',
    },
    {
      key: 'totp',
      label: 'Autenticação em duas etapas (2FA)',
      done: user?.totpEnabled === true,
      hint: 'Ativa um código por app autenticador na hora de logar — protege sua conta',
    },
    {
      key: 'weekly_goal',
      label: 'Meta semanal de estudo definida',
      done: !!progressQ.data?.weeklyGoalMinutes,
      hint: 'Configure quantos minutos por semana você quer estudar',
    },
  ];

  const currentGoal = progressQ.data?.weeklyGoalMinutes ?? 180;
  const weekMinutes = progressQ.data?.weekMinutes ?? 0;
  const [goalDraft, setGoalDraft] = useState<number>(currentGoal);
  const [savingGoal, setSavingGoal] = useState(false);
  useEffect(() => {
    if (progressQ.data?.weeklyGoalMinutes) {
      setGoalDraft(progressQ.data.weeklyGoalMinutes);
    }
  }, [progressQ.data?.weeklyGoalMinutes]);

  async function onSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (goalDraft === currentGoal) return;
    if (!Number.isInteger(goalDraft) || goalDraft < 15 || goalDraft > 2400) {
      toast.error('Meta deve estar entre 15 e 2400 minutos por semana.');
      return;
    }
    setSavingGoal(true);
    try {
      await api.setMyWeeklyGoal(goalDraft);
      toast.success(`Meta semanal atualizada para ${goalDraft} minutos.`);
      progressQ.refetch();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setSavingGoal(false);
    }
  }

  if (!user) {
    return (
      <div className="pco-card p-8 text-center text-sm text-ink-muted">
        Você precisa estar logado.
      </div>
    );
  }

  const initials = (name || user.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    if (name.trim().length < 2) {
      setProfileError('Informe seu nome.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await api.updateMyProfile({ name: name.trim(), avatarUrl: avatarUrl ?? null });
      patchUser({ name: updated.name, avatarUrl: updated.avatarUrl ?? null });
      toast.success('Perfil atualizado');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProfileError(null);
    try {
      const res = await api.uploadFile(file);
      setAvatarUrl(res.url);
      toast.info('Avatar enviado — clique Salvar para confirmar.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Falha no upload.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleRequestDeletion() {
    const reason = prompt(
      'Solicitar exclusão da conta? Direito ao esquecimento (LGPD Art. 18).\n\nO motivo é opcional e ajuda a equipe.',
    );
    if (reason === null) return;
    try {
      await reqDeletionMut.mutateAsync(reason || undefined);
      toast.success(
        'Solicitação enviada',
        'Os administradores serão notificados e processarão sua solicitação.',
      );
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleCancelDeletion() {
    if (!myDeletionQ.data) return;
    if (!confirm('Cancelar a solicitação de exclusão?')) return;
    try {
      await cancelDeletionMut.mutateAsync(myDeletionQ.data.id);
      toast.success('Solicitação cancelada');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await api.exportMyData();
      toast.success('Download iniciado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setExporting(false);
    }
  }

  async function onChangePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);
    if (newPwd.length < 8) {
      setPwdError('A nova senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('As senhas não conferem.');
      return;
    }
    setSavingPwd(true);
    try {
      await api.changeMyPassword(currentPwd, newPwd);
      setPwdSuccess(true);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      toast.success('Senha alterada — outras sessões foram encerradas.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('senha atual')) {
        setPwdError('Senha atual incorreta.');
      } else {
        setPwdError(msg || 'Erro ao alterar senha.');
      }
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Meu Perfil</h1>
        <p className="pco-section-subtitle mt-1">Seus dados pessoais e segurança da conta.</p>
      </header>

      <ProfileCompleteness items={profileItems} />

      <div className="pco-card p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="h-20 w-20 rounded-2xl object-cover shadow-soft"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-2xl font-bold text-white shadow-soft">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-surface-gray grid place-items-center text-pco-blue shadow-soft hover:bg-pco-blue hover:text-white transition-colors"
              title="Trocar avatar"
              aria-label="Trocar avatar"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Camera size={12} strokeWidth={2} />
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPickAvatar}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-pco-deep">{user.name}</h2>
            <p className="text-sm text-ink-muted">{user.email}</p>
            <p className="text-xs text-ink-subtle mt-1 capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      {user.role === 'student' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            Icon={PlayCircle}
            label="Aulas concluídas"
            value={String(progressQ.data?.completedLessonIds.length ?? 0)}
            color="text-pco-blue"
          />
          <StatCard
            Icon={Flame}
            label="Sequência"
            value={`${progressQ.data?.streakDays ?? 0} dia(s)`}
            color="text-pco-orange"
          />
          <StatCard
            Icon={Award}
            label="Certificados emitidos"
            value={String(
              (certsQ.data ?? []).filter((c) => c.status === 'issued').length,
            )}
            color="text-status-gold"
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={onSaveProfile} className="pco-card p-6 space-y-4">
          <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <User size={16} className="text-pco-blue" strokeWidth={1.75} />
            Dados pessoais
          </h3>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Nome completo</label>
            <input
              className="pco-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">E-mail</label>
            <input className="pco-input opacity-60" type="text" value={user.email} disabled />
            <p className="text-xs text-ink-subtle mt-1">
              Para alterar e-mail, contate o administrador.
            </p>
          </div>
          {profileError && (
            <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}
          <button
            type="submit"
            className="pco-btn-primary"
            disabled={savingProfile || uploading}
          >
            <Save size={14} strokeWidth={2} />
            {savingProfile ? `${t('common.save')}...` : t('common.save')}
          </button>
        </form>

        <div className="pco-card p-6 space-y-3">
          <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <Globe size={16} className="text-pco-blue" strokeWidth={1.75} />
            {t('profile.language')}
          </h3>
          <p className="text-xs text-ink-muted">
            {t('profile.languageHint')}
          </p>
          <LocaleSwitcher variant="inline" className="pt-1" />
        </div>

        <form onSubmit={onChangePwd} className="pco-card p-6 space-y-4">
          <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <Lock size={16} className="text-pco-blue" strokeWidth={1.75} />
            Alterar senha
          </h3>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Senha atual</label>
            <input
              className="pco-input"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Nova senha</label>
            <input
              className="pco-input"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
              Confirmar nova senha
            </label>
            <input
              className="pco-input"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {pwdError && (
            <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}
          {pwdSuccess && (
            <div className="flex items-start gap-2 rounded-lg bg-status-success/10 p-2 text-xs text-status-success">
              <CheckCircle2 size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>Senha alterada. Outros dispositivos foram desconectados.</span>
            </div>
          )}
          <button type="submit" className="pco-btn-primary" disabled={savingPwd}>
            <Lock size={14} strokeWidth={2} />
            {savingPwd ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>

      <div className="pco-card p-6 space-y-3">
        <h3 className="text-base font-semibold text-pco-deep">
          Preferências de e-mail
        </h3>
        <p className="text-xs text-ink-muted">
          E-mails essenciais (reset de senha, pagamento confirmado, matrícula) sempre são
          enviados. Aqui você controla os opcionais.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notifPrefsQ.data?.receiveBroadcasts !== false}
            onChange={(e) => {
              updateNotifPrefs.mutate(
                { receiveBroadcasts: e.target.checked },
                {
                  onSuccess: () => toast.success('Preferências salvas'),
                  onError: (err) =>
                    toast.error('Falha', err instanceof Error ? err.message : 'Erro'),
                },
              );
            }}
            className="accent-pco-blue"
          />
          Quero receber comunicados e novidades (campanhas)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notifPrefsQ.data?.receiveReengagement !== false}
            onChange={(e) => {
              updateNotifPrefs.mutate(
                { receiveReengagement: e.target.checked },
                {
                  onSuccess: () => toast.success('Preferências salvas'),
                  onError: (err) =>
                    toast.error('Falha', err instanceof Error ? err.message : 'Erro'),
                },
              );
            }}
            className="accent-pco-blue"
          />
          Quero receber lembretes quando ficar muito tempo sem entrar
        </label>

        <div className="border-t border-pco-border pt-3 mt-3">
          <h4 className="text-sm font-semibold text-pco-deep mb-1">
            Pausar notificações in-app
          </h4>
          <p className="text-xs text-ink-muted mb-2">
            O sininho fica em silêncio. Notificações continuam chegando, mas
            o badge não aparece até a data escolhida.
          </p>
          {notifPrefsQ.data?.snoozedUntil &&
          new Date(notifPrefsQ.data.snoozedUntil) > new Date() ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-pco-orange">
                Pausado até{' '}
                {new Date(notifPrefsQ.data.snoozedUntil).toLocaleString('pt-BR')}
              </span>
              <button
                type="button"
                onClick={() =>
                  snoozeMut.mutate(0, {
                    onSuccess: () => toast.success('Notificações reativadas'),
                  })
                }
                disabled={snoozeMut.isPending}
                className="pco-btn-ghost text-xs"
              >
                Reativar agora
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[1, 3, 7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    snoozeMut.mutate(days, {
                      onSuccess: () =>
                        toast.success(`Pausado por ${days} dia${days > 1 ? 's' : ''}`),
                    })
                  }
                  disabled={snoozeMut.isPending}
                  className="pco-btn-ghost text-xs"
                >
                  {days}d
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSaveGoal} className="pco-card p-6 space-y-4">
        <header className="flex items-center gap-2">
          <Target size={18} className="text-pco-blue" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-pco-deep">Meta semanal de estudo</h3>
        </header>
        <p className="text-xs text-ink-muted">
          Quantos minutos você quer estudar por semana? A barra de progresso no
          dashboard usa essa meta como referência. Recomendamos 180 min (3h)
          como ponto de partida.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Minutos por semana ({Math.round(goalDraft / 60 * 10) / 10}h)
            </span>
            <input
              type="range"
              min={15}
              max={1500}
              step={15}
              value={goalDraft}
              onChange={(e) => setGoalDraft(Number(e.target.value))}
              className="w-full mt-2 accent-pco-blue"
            />
            <div className="flex items-center justify-between text-xs text-ink-subtle mt-1">
              <span>15min</span>
              <strong className="text-base text-pco-deep">{goalDraft} min</strong>
              <span>25h</span>
            </div>
          </label>
          <button
            type="submit"
            disabled={savingGoal || goalDraft === currentGoal}
            className="pco-btn-primary text-xs shrink-0 disabled:opacity-50"
          >
            <Save size={12} strokeWidth={2} />
            {savingGoal ? 'Salvando…' : 'Salvar meta'}
          </button>
        </div>
        {progressQ.data && (
          <div className="text-xs text-ink-muted bg-surface-off rounded-lg p-3">
            Esta semana você estudou aproximadamente <strong>{weekMinutes} min</strong>
            {currentGoal > 0 && (
              <>
                {' '}
                de <strong>{currentGoal} min</strong> ({Math.min(100, Math.round((weekMinutes / currentGoal) * 100))}% da meta).
              </>
            )}
          </div>
        )}
      </form>

      <section className="pco-card p-6 space-y-3">
        <header className="flex items-center gap-2">
          <Flame size={18} className="text-pco-orange" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-pco-deep">Sua trajetória de estudo</h3>
        </header>
        <p className="text-xs text-ink-muted">
          Cada quadradinho é um dia. Quanto mais aulas você concluiu nesse dia,
          mais escuro fica.
        </p>
        {heatmapQ.fetchStatus === 'paused' ? (
          <SemConexao oQue="o seu histórico" />
        ) : heatmapQ.isError ? (
          <FalhaAoCarregar
            erro={heatmapQ.error}
            oQue="o seu histórico"
            aoTentarDeNovo={() => void heatmapQ.refetch()}
          />
        ) : heatmapQ.isPending ? (
          <div className="text-xs text-ink-muted">Carregando heatmap…</div>
        ) : heatmapQ.data ? (
          <StudyHeatmap days={heatmapQ.data.days} summary={heatmapQ.data.summary} />
        ) : (
          <div className="text-xs text-ink-subtle">Sem dados ainda.</div>
        )}
      </section>

      <AchievementsPanel />

      <TwoFactorAuthCard
        enabled={user?.totpEnabled === true}
        onChanged={(enabled) => patchUser({ totpEnabled: enabled })}
      />

      <div className="pco-card p-6">
        <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
          <Download size={16} className="text-pco-blue" strokeWidth={1.75} />
          Exportar meus dados
        </h3>
        <p className="mt-2 text-xs text-ink-muted">
          Baixe um arquivo JSON com todos os seus dados pessoais: perfil e ficha, matrículas,
          progresso, anotações, tempo assistido, certificados, pedidos, agendamentos, chamados
          de suporte, avisos, conquistas, avaliações, mensagens no fórum e histórico do Tutor.
          Inclui também o que a escola registra <strong>sobre</strong> você e que não aparece em
          nenhuma outra tela: seu índice de risco de evasão, as anotações da coordenação e os
          planos de retomada gerados a seu respeito. Direito garantido pela LGPD (Art. 18).
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 pco-btn-secondary text-xs"
        >
          <Download size={12} strokeWidth={2} />
          {exporting ? 'Preparando...' : 'Baixar meus dados'}
        </button>
      </div>

      <div className="pco-card p-6 border-status-danger/30 bg-status-danger/[0.03]">
        <h3 className="text-base font-semibold text-status-danger flex items-center gap-2">
          <Trash2 size={16} className="text-status-danger" strokeWidth={1.75} />
          Excluir minha conta
        </h3>
        <p className="mt-2 text-xs text-ink-muted">
          Direito ao esquecimento (LGPD Art. 18). Sua solicitação será enviada aos
          administradores, que processarão a remoção de todos os seus dados pessoais.
        </p>
        {myDeletionQ.data ? (
          <div className="mt-3 p-3 rounded bg-pco-orange/5 border border-pco-orange/30">
            <div className="text-xs font-semibold text-pco-orange">
              Solicitação {myDeletionQ.data.status === 'pending' ? 'pendente' : myDeletionQ.data.status}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Enviada em{' '}
              {new Date(myDeletionQ.data.requestedAt).toLocaleString('pt-BR')}
              {myDeletionQ.data.reason && (
                <>
                  <br />
                  <span className="italic">"{myDeletionQ.data.reason}"</span>
                </>
              )}
            </div>
            {myDeletionQ.data.status === 'pending' && (
              <button
                type="button"
                onClick={handleCancelDeletion}
                disabled={cancelDeletionMut.isPending}
                className="mt-2 pco-btn-ghost text-xs"
              >
                Cancelar solicitação
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRequestDeletion}
            disabled={reqDeletionMut.isPending}
            className="mt-3 pco-btn-ghost text-xs text-status-danger hover:bg-status-danger/10"
          >
            <Trash2 size={12} strokeWidth={2} />
            {reqDeletionMut.isPending
              ? 'Enviando solicitação...'
              : 'Solicitar exclusão da conta'}
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
  color,
}: {
  Icon: typeof Flame;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="pco-card p-4">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={2} className={color} />
        <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
    </div>
  );
}
