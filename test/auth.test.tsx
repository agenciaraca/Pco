import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/app/auth/AuthContext';
import type { ReactNode } from 'react';

vi.mock('../src/app/data/api', () => ({
  login: vi.fn(async (email: string) => ({
    user: {
      id: email.includes('admin') ? 'admin-001' : 'stu-001',
      name: email.includes('admin') ? 'Admin Demo' : 'Aluno Demo',
      email,
      role: email.includes('admin') ? 'admin' : 'student',
    },
    token: 'mock-jwt',
  })),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('inicia sem usuário', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('login estudante define role student', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('aluno@pco.local', 'demo1234');
    });
    expect(result.current.user?.role).toBe('student');
    expect(result.current.user?.email).toBe('aluno@pco.local');
  });

  it('login admin define role admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('admin@pco.local', 'demo1234');
    });
    expect(result.current.user?.role).toBe('admin');
  });

  it('logout limpa storage e estado', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('aluno@pco.local', 'demo1234');
    });
    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('ava-pco-auth')).toBeNull();
  });

  it('hidrata sessão de localStorage', async () => {
    localStorage.setItem(
      'ava-pco-auth',
      JSON.stringify({
        user: { id: 'x', name: 'X', email: 'x@y.com', role: 'student' },
        token: 'cached',
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.id).toBe('x'));
  });
});
