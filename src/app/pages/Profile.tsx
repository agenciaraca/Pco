import { useState, useRef } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useMyProgress, useCertificates } from '../data/hooks';
import * as api from '../data/api';
import TwoFactorAuthCard from '../components/TwoFactorAuthCard';

export default function Profile() {
  const { user, patchUser } = useAuth();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const progressQ = useMyProgress();
  const certsQ = useCertificates();

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
    if (
      !confirm(
        'Solicitar exclusão da conta?\n\nUm administrador receberá a solicitação e processará a remoção de todos os seus dados conforme LGPD. Você continua com acesso até a aprovação.',
      )
    ) {
      return;
    }
    setRequestingDeletion(true);
    try {
      await api.requestAccountDeletion();
      toast.success('Solicitação enviada', 'Os administradores foram notificados.');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setRequestingDeletion(false);
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
            <p className="text-[11px] text-ink-subtle mt-1">
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
            {savingProfile ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>

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
          Baixe um arquivo JSON com todos os seus dados pessoais (perfil, progresso de aulas,
          anotações, histórico do Tutor, certificados). Direito garantido pela LGPD (Art. 18).
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
        <button
          type="button"
          onClick={handleRequestDeletion}
          disabled={requestingDeletion}
          className="mt-3 pco-btn-ghost text-xs text-status-danger hover:bg-status-danger/10"
        >
          <Trash2 size={12} strokeWidth={2} />
          {requestingDeletion ? 'Enviando solicitação...' : 'Solicitar exclusão da conta'}
        </button>
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
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
    </div>
  );
}
