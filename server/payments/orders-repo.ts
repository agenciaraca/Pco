// Repository de orders (pedidos de compra).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { Order, OrderStatus } from './types';

const store = new JsonStore<Order>('payment-orders.json', () => []);

function newId(): string {
  return `ord-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<Order[]> {
  const all = await store.getAll();
  return [...all].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function listForUser(userId: string): Promise<Order[]> {
  const all = await store.filter((o) => o.userId === userId);
  return [...all].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function findById(id: string): Promise<Order | null> {
  return await store.findOne((o) => o.id === id);
}

export async function findByExternalId(externalId: string): Promise<Order | null> {
  return await store.findOne((o) => o.externalId === externalId);
}

interface CreateInput {
  userId: string;
  userEmail: string;
  productId: string;
  productSnapshot: Order['productSnapshot'];
  gatewayId: string;
  gatewayProvider: Order['gatewayProvider'];
  amountCents: number;
  currency: string;
}

export async function createOrder(input: CreateInput): Promise<Order> {
  const now = new Date().toISOString();
  const o: Order = {
    id: newId(),
    userId: input.userId,
    userEmail: input.userEmail,
    productId: input.productId,
    productSnapshot: input.productSnapshot,
    gatewayId: input.gatewayId,
    gatewayProvider: input.gatewayProvider,
    externalId: null,
    status: 'pending',
    amountCents: input.amountCents,
    currency: input.currency,
    events: [{ ts: now, status: 'pending', note: 'Order criada' }],
    checkoutUrl: null,
    qrCode: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
  await store.unshift(o);
  return o;
}

export async function attachGatewayResult(
  id: string,
  data: { externalId: string; checkoutUrl?: string; qrCode?: string; status: OrderStatus },
): Promise<Order | null> {
  return await store.update(
    (o) => o.id === id,
    (o) => ({
      ...o,
      externalId: data.externalId,
      checkoutUrl: data.checkoutUrl ?? null,
      qrCode: data.qrCode ?? null,
      status: data.status,
      updatedAt: new Date().toISOString(),
      events: [
        ...o.events,
        {
          ts: new Date().toISOString(),
          status: data.status,
          note: `Gateway respondeu (externalId ${data.externalId})`,
        },
      ],
    }),
  );
}

export async function updateStatus(
  id: string,
  status: OrderStatus,
  note?: string,
): Promise<Order | null> {
  return await store.update(
    (o) => o.id === id,
    (o) => {
      const now = new Date().toISOString();
      return {
        ...o,
        status,
        updatedAt: now,
        ...(status === 'paid' && !o.paidAt ? { paidAt: now } : {}),
        events: [...o.events, { ts: now, status, note }],
      };
    },
  );
}
