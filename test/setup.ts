import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Portão de entrada desligado por padrão nos testes.
//
// Ele exige matrícula ou pedido pago para logar, e quase toda suíte de servidor
// faz login para testar OUTRA coisa — fórum, conteúdo, pedidos. Deixá-lo ligado
// aqui faria cada uma delas falhar por um motivo alheio ao que investigam, e a
// correção seria semear matrícula em dezenas de arquivos.
//
// Quem testa o portão liga explicitamente (ver `test/portao-de-entrada.test.ts`),
// que é também a única forma de o teste dizer, na cara, o que está exercitando.
process.env.EXIGIR_MATRICULA_PARA_ENTRAR = 'false';

afterEach(() => {
  cleanup();
});

// jsdom não implementa matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom não implementa ResizeObserver (recharts usa)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;
