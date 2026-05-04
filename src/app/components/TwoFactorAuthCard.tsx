import { useState } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import * as api from '../data/api';
import { useToast } from './Toast';

interface Props {
  enabled: boolean;
  onChanged: (enabled: boolean) => void;
}

export default function TwoFactorAuthCard({ enabled, onChanged }: Props) {
  const toast = useToast();
  const [setup, setSetup] = useState<api.TotpSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  async function handleStartSetup() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.totpSetup();
      setSetup(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function handleEnable() {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Digite o código de 6 dígitos do app autenticador.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.totpEnable(code.trim());
      setBackupCodes(r.backupCodes);
      setSetup(null);
      setCode('');
      onChanged(true);
      toast.success('2FA ativado', 'Guarde os códigos de backup com segurança.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setError(null);
    if (!code.trim()) {
      setError('Digite o código atual ou um código de backup.');
      return;
    }
    setBusy(true);
    try {
      await api.totpDisable(code.trim());
      onChanged(false);
      setCode('');
      setConfirmDisable(false);
      setBackupCodes(null);
      toast.success('2FA desativado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Digite o código atual de 6 dígitos.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.totpRegenBackupCodes(code.trim());
      setBackupCodes(r.backupCodes);
      setCode('');
      toast.success('Códigos regenerados', 'Os antigos foram invalidados.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pco-card p-6 space-y-4">
      <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
        {enabled ? (
          <ShieldCheck size={16} className="text-status-success" strokeWidth={1.75} />
        ) : (
          <ShieldOff size={16} className="text-ink-muted" strokeWidth={1.75} />
        )}
        Autenticação em duas etapas (2FA)
        {enabled && (
          <span className="pco-badge bg-status-success/10 text-status-success">ativo</span>
        )}
      </h3>
      <p className="text-xs text-ink-muted">
        Adicione uma camada extra de segurança usando um app autenticador (Google
        Authenticator, Authy, 1Password, Microsoft Authenticator, etc.).
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
          <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Modo: 2FA já ativo */}
      {enabled && !backupCodes && !confirmDisable && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirmDisable(true)}
            className="pco-btn-ghost text-xs text-status-danger"
          >
            Desativar
          </button>
          <button
            type="button"
            onClick={() => {
              setBackupCodes(null);
              setConfirmDisable(false);
              setCode('');
            }}
            className="pco-btn-ghost text-xs"
          >
            <RefreshCw size={11} strokeWidth={2} />
            Regenerar códigos de backup
          </button>
        </div>
      )}

      {/* Modo: confirmação de desativar */}
      {enabled && confirmDisable && (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted">
            Digite o código atual do app (ou um código de backup) para desativar:
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="pco-input text-center text-lg tracking-[0.4em]"
            placeholder="000000"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy}
              className="pco-btn-ghost text-xs text-status-danger"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : null}
              Desativar 2FA
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDisable(false);
                setCode('');
                setError(null);
              }}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modo: setup iniciado, aguardando código */}
      {!enabled && setup && (
        <div className="space-y-3">
          <div className="rounded-lg border border-pco-blue/30 bg-pco-blue/5 p-3 text-xs space-y-2">
            <p className="font-semibold text-pco-deep">
              Adicione esta chave ao app autenticador:
            </p>
            <code className="block font-mono text-sm bg-white border border-pco-border rounded p-2 break-all select-all">
              {setup.secret}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(setup.secret);
                toast.info('Copiado');
              }}
              className="pco-btn-ghost text-xs"
            >
              <Copy size={11} strokeWidth={2} />
              Copiar
            </button>
            <p className="text-[11px] text-ink-subtle">
              Ou use a URI <code className="break-all">otpauth://...</code> abaixo (cole no
              app):
            </p>
            <code className="block font-mono text-[10px] bg-white border border-pco-border rounded p-2 break-all select-all">
              {setup.uri}
            </code>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
              Código atual do app
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pco-input text-center text-lg tracking-[0.4em]"
              placeholder="000000"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="pco-btn-primary text-xs"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Confirmar e ativar
            </button>
            <button
              type="button"
              onClick={() => {
                setSetup(null);
                setCode('');
                setError(null);
              }}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modo: 2FA já ativo, regenerando */}
      {enabled && !confirmDisable && !backupCodes && (
        <details className="text-xs">
          <summary className="cursor-pointer text-pco-blue hover:underline">
            Regenerar códigos de backup (avançado)
          </summary>
          <div className="mt-2 space-y-2 p-3 rounded-lg border border-pco-border">
            <p className="text-ink-muted">
              Isto invalida todos os códigos de backup atuais. Digite o código TOTP atual:
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pco-input text-center text-lg tracking-[0.4em]"
              placeholder="000000"
            />
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy}
              className="pco-btn-ghost text-xs"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : null}
              Regenerar
            </button>
          </div>
        </details>
      )}

      {/* Modo: nada configurado */}
      {!enabled && !setup && (
        <button
          type="button"
          onClick={handleStartSetup}
          disabled={busy}
          className="pco-btn-primary text-xs"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />}
          Ativar 2FA
        </button>
      )}

      {/* Backup codes display */}
      {backupCodes && (
        <div className="rounded-lg border border-pco-blue/30 bg-pco-blue/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-pco-deep">
            Guarde estes códigos de backup em local seguro
          </p>
          <p className="text-[11px] text-ink-muted">
            Cada código pode ser usado uma única vez. Use-os se perder acesso ao seu app
            autenticador.
          </p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm bg-white p-3 border border-pco-border rounded">
            {backupCodes.map((c) => (
              <div key={c} className="select-all py-0.5">
                {c}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(backupCodes.join('\n'));
                toast.info('Códigos copiados');
              }}
              className="pco-btn-ghost text-xs"
            >
              <Copy size={11} strokeWidth={2} />
              Copiar todos
            </button>
            <button
              type="button"
              onClick={() => setBackupCodes(null)}
              className="pco-btn-ghost text-xs"
            >
              Já guardei
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
