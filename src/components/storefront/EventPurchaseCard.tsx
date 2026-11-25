'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatEventDateTime, formatPriceBrl } from './formatters';

export interface StorefrontEventCardData {
  id: string;
  name: string;
  startsAt: string;
  location: string;
  priceCents: number;
  capacity: number;
  availableSeats: number;
}

export interface EventPurchaseCardProps {
  event: StorefrontEventCardData;
  isAuthenticated: boolean;
}

interface PurchaseSuccessState {
  ticketId: string;
  code: string;
  status: string;
}

/**
 * Interactive storefront card displaying a published event's details, live seat availability,
 * literal `"Ingressos esgotados"` state (R07), and web purchase form for authenticated users.
 */
export function EventPurchaseCard({
  event,
  isAuthenticated,
}: EventPurchaseCardProps): React.ReactElement {
  const router = useRouter();
  const [availableSeats, setAvailableSeats] = useState<number>(event.availableSeats);
  const [cardNumber, setCardNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseSuccessState | null>(null);

  const isSoldOut = availableSeats <= 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrorMessage(null);
    setPurchaseResult(null);

    const sanitizedCard = cardNumber.replace(/\D/g, '');
    if (!/^\d{16}$/.test(sanitizedCard)) {
      setErrorMessage('Informe um número de cartão válido com 16 dígitos.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          cardNumber: sanitizedCard,
        }),
      });

      const data = (await response.json()) as {
        ticketId?: string;
        code?: string;
        status?: string;
        error?: string;
        message?: string;
      };

      if (response.status === 409 || data.error === 'sold_out') {
        setAvailableSeats(0);
        setErrorMessage('Ingressos esgotados');
        router.refresh();
        return;
      }

      if (!response.ok || !data.ticketId || !data.code) {
        setErrorMessage(data.message ?? 'Não foi possível concluir a compra.');
        return;
      }

      setPurchaseResult({
        ticketId: data.ticketId,
        code: data.code,
        status: data.status ?? 'pending',
      });
      setCardNumber('');
      setAvailableSeats((prev) => Math.max(0, prev - 1));
      router.refresh();
    } catch {
      setErrorMessage('Erro de conexão ao processar a compra. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
      data-testid={`event-card-${event.id}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">{event.name}</h2>
          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            {formatPriceBrl(event.priceCents)}
          </span>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <dt className="font-medium text-slate-700">Data e hora:</dt>
            <dd>{formatEventDateTime(event.startsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-medium text-slate-700">Local:</dt>
            <dd>{event.location}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-medium text-slate-700">Vagas disponíveis:</dt>
            <dd className={isSoldOut ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>
              {isSoldOut ? '0' : `${availableSeats} de ${event.capacity}`}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        {purchaseResult && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            <p className="font-semibold">Pedido recebido (pendente de confirmação)!</p>
            <p className="mt-1">
              Código do ingresso:{' '}
              <span className="font-mono font-bold tracking-wider">{purchaseResult.code}</span>
            </p>
            <Link
              href="/my-tickets"
              className="mt-2 inline-block font-semibold text-emerald-800 underline hover:text-emerald-950"
            >
              Acompanhar em Meus ingressos →
            </Link>
          </div>
        )}

        {isSoldOut ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700"
          >
            Ingressos esgotados
          </div>
        ) : isAuthenticated ? (
          <form onSubmit={handleSubmit} className="space-y-3">
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
                maxLength={16}
                placeholder="4000000000000001"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {errorMessage && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Processando...' : 'Comprar ingresso'}
            </button>
          </form>
        ) : (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-600">
            <p>Entre ou crie sua conta para comprar ingressos.</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Criar conta
              </Link>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
