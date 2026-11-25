'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { isEventSoldOut, SOLD_OUT_LABEL } from '@/lib/tickets/labels';

export interface StorefrontEventItem {
  id: string;
  name: string;
  formattedStartsAt: string;
  location: string;
  priceCents: number;
  formattedPrice: string;
  capacity: number;
  availableSeats: number;
}

export interface StorefrontClientProps {
  events: StorefrontEventItem[];
  isAuthenticated: boolean;
}

interface PurchaseFeedback {
  ticketId: string;
  code: string;
  status: string;
}

interface PurchaseApiResponse {
  ticketId?: string;
  code?: string;
  status?: string;
  error?: string;
  message?: string;
}

interface EventCardState {
  cardNumber: string;
  submitting: boolean;
  errorMessage: string | null;
  purchasedTicket: PurchaseFeedback | null;
}

const DEFAULT_CARD_STATE: EventCardState = {
  cardNumber: '',
  submitting: false,
  errorMessage: null,
  purchasedTicket: null,
};

/**
 * Interactive public storefront catalog allowing visitors to browse published events
 * and authenticated users to purchase tickets with immediate sold-out feedback (R02, R06, R07).
 */
export function StorefrontClient({
  events,
  isAuthenticated,
}: StorefrontClientProps): React.ReactElement {
  const [seatsByEventId, setSeatsByEventId] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const event of events) {
      initial[event.id] = event.availableSeats;
    }
    return initial;
  });

  const [cardStateByEventId, setCardStateByEventId] = useState<Record<string, EventCardState>>({});

  function getCardState(eventId: string): EventCardState {
    return cardStateByEventId[eventId] ?? DEFAULT_CARD_STATE;
  }

  function updateCardState(eventId: string, patch: Partial<EventCardState>): void {
    setCardStateByEventId((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] ?? DEFAULT_CARD_STATE),
        ...patch,
      },
    }));
  }

  async function handlePurchase(eventId: string, e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const state = getCardState(eventId);
    const cardNumber = state.cardNumber.trim();

    updateCardState(eventId, {
      submitting: true,
      errorMessage: null,
      purchasedTicket: null,
    });

    try {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, cardNumber }),
      });

      const data = (await response.json()) as PurchaseApiResponse;

      if (response.status === 202 && data.ticketId && data.code) {
        setSeatsByEventId((prev) => ({
          ...prev,
          [eventId]: Math.max(0, (prev[eventId] ?? 1) - 1),
        }));
        updateCardState(eventId, {
          cardNumber: '',
          submitting: false,
          errorMessage: null,
          purchasedTicket: {
            ticketId: data.ticketId,
            code: data.code,
            status: data.status ?? 'pending',
          },
        });
        return;
      }

      if (response.status === 409 && data.error === 'sold_out') {
        setSeatsByEventId((prev) => ({
          ...prev,
          [eventId]: 0,
        }));
        updateCardState(eventId, {
          submitting: false,
          errorMessage: SOLD_OUT_LABEL,
        });
        return;
      }

      updateCardState(eventId, {
        submitting: false,
        errorMessage: data.message ?? 'Não foi possível concluir a compra.',
      });
    } catch {
      updateCardState(eventId, {
        submitting: false,
        errorMessage: 'Erro de conexão ao tentar comprar ingresso.',
      });
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Nenhum evento publicado disponível no momento.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {events.map((event) => {
        const availableSeats = seatsByEventId[event.id] ?? event.availableSeats;
        const soldOut = isEventSoldOut(availableSeats);
        const cardState = getCardState(event.id);

        return (
          <article
            key={event.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-900">{event.name}</h2>
                <span className="shrink-0 rounded-md bg-blue-50 px-3 py-1 text-base font-semibold text-blue-700">
                  {event.formattedPrice}
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
                <div className="flex gap-2">
                  <dt className="font-medium text-slate-800">Data e hora:</dt>
                  <dd>{event.formattedStartsAt}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-slate-800">Local:</dt>
                  <dd>{event.location}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-slate-800">Vagas disponíveis:</dt>
                  <dd>{availableSeats}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              {soldOut ? (
                <div
                  role="status"
                  className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm font-semibold text-red-700"
                >
                  {SOLD_OUT_LABEL}
                </div>
              ) : isAuthenticated ? (
                <form
                  onSubmit={(e) => {
                    void handlePurchase(event.id, e);
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor={`card-${event.id}`}
                      className="block text-xs font-medium text-slate-700"
                    >
                      Número do cartão (16 dígitos)
                    </label>
                    <input
                      id={`card-${event.id}`}
                      name="cardNumber"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={16}
                      placeholder="4000000000000001"
                      value={cardState.cardNumber}
                      onChange={(e) => {
                        updateCardState(event.id, { cardNumber: e.target.value });
                      }}
                      disabled={cardState.submitting}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={cardState.submitting}
                    className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cardState.submitting ? 'Processando...' : 'Comprar ingresso'}
                  </button>
                </form>
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-medium">Entre ou crie uma conta para comprar</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link
                      href="/login"
                      className="font-semibold text-blue-600 underline hover:text-blue-700"
                    >
                      Entrar
                    </Link>
                    <Link
                      href="/register"
                      className="font-semibold text-blue-600 underline hover:text-blue-700"
                    >
                      Criar conta
                    </Link>
                  </div>
                </div>
              )}

              {cardState.errorMessage && !soldOut && (
                <p
                  role="alert"
                  className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {cardState.errorMessage}
                </p>
              )}

              {cardState.purchasedTicket && (
                <div
                  role="status"
                  className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                >
                  <p className="font-semibold">
                    Compra recebida! Status: pendente
                  </p>
                  <p className="mt-1">
                    Código do ingresso:{' '}
                    <span className="font-mono font-bold">
                      {cardState.purchasedTicket.code}
                    </span>
                  </p>
                  <Link
                    href="/my-tickets"
                    className="mt-2 inline-block font-semibold text-emerald-800 underline hover:text-emerald-950"
                  >
                    Meus ingressos
                  </Link>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
