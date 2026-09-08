/**
 * Preenchimento de endereço pelo CEP, do lado do aluno logado.
 *
 * O site público já faz isso (`server/public/client.ts`), e as duas telas de
 * compra não podem divergir: a mesma rota, as mesmas três respostas, a mesma
 * regra sobre o que pode ser sobrescrito.
 *
 * A rota é nossa (`GET /public/cep/:cep`), e o porquê está em
 * `server/public/cep.ts`: o IP e o CEP de quem compra não vão para terceiro
 * nenhum, o cache é do servidor, e a queda do serviço externo é tratada lá em
 * vez de virar erro de rede no console de quem está pagando.
 */
import { useEffect, useRef, useState } from 'react';
import { apenasDigitos, cepValido } from '../../../shared/endereco';
import { request } from './client';

export interface EnderecoDoCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

type RespostaCep = { encontrado: true; endereco: EnderecoDoCep } | { encontrado: false };

/**
 * Os quatro estados que a tela precisa distinguir.
 *
 * `inexistente` e `indisponivel` **não podem ser achatados**: o primeiro é os
 * Correios dizendo que este CEP não existe, e mandar conferir faz sentido; o
 * segundo é não ter conseguido perguntar, e mandar conferir um CEP correto no
 * momento da compra é o defeito que a rota existe para não cometer.
 */
export type EstadoCep = 'ocioso' | 'buscando' | 'preenchido' | 'inexistente' | 'indisponivel';

/**
 * Consulta o CEP quando ele fica completo e entrega o endereço a `aplicar`.
 *
 * `aplicar` é lida de uma ref de propósito: a função é recriada a cada render
 * do formulário, e depender da identidade dela faria a consulta recomeçar a
 * cada tecla digitada em qualquer campo.
 */
export function usePreenchimentoPorCep(
  cep: string,
  aplicar: (endereco: EnderecoDoCep) => void,
): EstadoCep {
  const [estado, setEstado] = useState<EstadoCep>('ocioso');
  const ultimo = useRef('');
  const pedido = useRef(0);
  const aplicarRef = useRef(aplicar);
  // Escrever a ref durante o render é proibido (o React pode descartar o
  // render), então a atualização vai num efeito sem lista de dependências:
  // roda depois de todo render, e antes do efeito de consulta abaixo.
  useEffect(() => {
    aplicarRef.current = aplicar;
  });

  useEffect(() => {
    const d = apenasDigitos(cep);
    if (!cepValido(d)) {
      ultimo.current = '';
      setEstado('ocioso');
      return;
    }
    if (d === ultimo.current) return;
    ultimo.current = d;
    const meu = ++pedido.current;
    setEstado('buscando');
    request<RespostaCep>(`/public/cep/${d}`)
      .then((r) => {
        if (meu !== pedido.current) return; // resposta atrasada de um CEP anterior
        if (r.encontrado) {
          aplicarRef.current(r.endereco);
          setEstado('preenchido');
        } else {
          setEstado('inexistente');
        }
      })
      .catch(() => {
        // 503 daqui e queda de rede são a mesma coisa para quem lê: não deu
        // para perguntar. Nenhum dos dois autoriza dizer "não existe".
        if (meu === pedido.current) setEstado('indisponivel');
      });
  }, [cep]);

  return estado;
}

/** A frase que vai abaixo do campo. `null` quando não há o que dizer. */
export function recadoDoCep(estado: EstadoCep): string | null {
  if (estado === 'buscando') return 'Buscando endereço…';
  if (estado === 'inexistente')
    return 'CEP não encontrado. Confira o número ou preencha o endereço à mão.';
  if (estado === 'indisponivel')
    return 'Não deu para buscar o endereço agora — pode preencher à mão.';
  return null;
}
