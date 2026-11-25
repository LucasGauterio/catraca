'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { EventDashboardMetrics } from '@/lib/events/operations';
import {
  centsToInputBrl,
  formatEventDateBr,
  formatPriceBrl,
  getEventStatusMeta,
  parseBrlToCents,
  toDateTimeLocalValue,
  type OrganizerEventWithOccupancy,
} from '@/lib/events/utils';

interface EventManageClientProps {
  initialEvent: OrganizerEventWithOccupancy;
  initialDashboard: EventDashboardMetrics;
}

interface EventMutationResponse {
  event?: OrganizerEventWithOccupancy;
  error?: string;
  message?: string;
}

interface CheckInResponse {
  ok?: boolean;
  message?: string;
  error?: string;
}

interface CancelEventResponse {
  status?: 'cancelled';
  refundedCount?: number;
  cancelledCount?: number;
  error?: string;
  message?: string;
}

/**
 * Dedicated organizer event management client view (R04).
 * Integrates event editing (R01, R03, R05), publishing (R02), R12 dashboard metrics,
 * R10 ticket check-in, and R11 irreversible cancellation.
 */
export function EventManageClient({
  initialEvent,
  initialDashboard,
}: EventManageClientProps): React.ReactElement {
  const router = useRouter();
  const [event, setEvent] = useState<OrganizerEventWithOccupancy>(initialEvent);
  const [dashboard, setDashboard] = useState<EventDashboardMetrics>(initialDashboard);
  const [name, setName] = useState(initialEvent.name);
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(initialEvent.startsAt));
  const [location, setLocation] = useState(initialEvent.location);
  const [capacity, setCapacity] = useState(String(initialEvent.capacity));
  const [priceBrl, setPriceBrl] = useState(centsToInputBrl(initialEvent.priceCents));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [checkInCode, setCheckInCode] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInFeedback, setCheckInFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const statusMeta = getEventStatusMeta(event.status);
  const isCancelled = event.status === 'cancelled';

  async function refreshDashboard(): Promise<void> {
    setRefreshingDashboard(true);
    try {
      const response = await fetch(`/api/organizer/events/${event.id}/dashboard`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }
      const nextDashboard = (await response.json()) as EventDashboardMetrics;
      setDashboard(nextDashboard);
      setEvent((prev) => ({
        ...prev,
        occupiedSeats: nextDashboard.confirmed + nextDashboard.pending,
        availableSeats: nextDashboard.availableSeats,
      }));
    } catch {
      // Non-fatal: dashboard will remain on last loaded values.
    } finally {
      setRefreshingDashboard(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedPriceCents = parseBrlToCents(priceBrl);
    if (parsedPriceCents === null) {
      setErrorMessage('Informe um preço válido maior que zero (ex.: 100,00).');
      return;
    }

    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setErrorMessage('A lotação máxima deve ser um número inteiro maior ou igual a 1.');
      return;
    }

    if (!startsAt) {
      setErrorMessage('Informe a data e hora de início do evento.');
      return;
    }

    const startsAtDate = new Date(startsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      setErrorMessage('Data e hora de início inválidas.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/organizer/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startsAt: startsAtDate.toISOString(),
          location: location.trim(),
          capacity: parsedCapacity,
          priceCents: parsedPriceCents,
        }),
      });

      const payload = (await response.json()) as EventMutationResponse;
      if (!response.ok || !payload.event) {
        setErrorMessage(payload.message ?? 'Não foi possível salvar as alterações.');
        return;
      }

      const updated = payload.event;
      setEvent(updated);
      setName(updated.name);
      setStartsAt(toDateTimeLocalValue(updated.startsAt));
      setLocation(updated.location);
      setCapacity(String(updated.capacity));
      setPriceBrl(centsToInputBrl(updated.priceCents));
      setSuccessMessage('Evento atualizado com sucesso.');
      await refreshDashboard();
      router.refresh();
    } catch {
      setErrorMessage('Erro de conexão ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(): Promise<void> {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPublishing(true);

    try {
      const response = await fetch(`/api/organizer/events/${event.id}/publish`, {
        method: 'POST',
      });
      const payload = (await response.json()) as EventMutationResponse;
      if (!response.ok || !payload.event) {
        setErrorMessage(payload.message ?? 'Não foi possível publicar o evento.');
        return;
      }

      setEvent(payload.event);
      setSuccessMessage('Evento publicado com sucesso! Ele já está disponível para vendas.');
      await refreshDashboard();
      router.refresh();
    } catch {
      setErrorMessage('Erro de conexão ao publicar evento.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleCheckIn(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setCheckingIn(true);
    setCheckInFeedback(null);

    try {
      const response = await fetch(`/api/organizer/events/${event.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: checkInCode }),
      });

      const payload = (await response.json()) as CheckInResponse;
      if (!response.ok) {
        setCheckInFeedback({
          ok: false,
          message: payload.message ?? 'Não foi possível validar o check-in.',
        });
        return;
      }

      const ok = Boolean(payload.ok);
      setCheckInFeedback({
        ok,
        message: payload.message ?? (ok ? 'Entrada liberada' : 'Ingresso inválido para este evento'),
      });

      if (ok) {
        setCheckInCode('');
        await refreshDashboard();
        router.refresh();
      }
    } catch {
      setCheckInFeedback({
        ok: false,
        message: 'Erro de conexão ao validar check-in.',
      });
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCancelEvent(): Promise<void> {
    setCancelError(null);
    setCancelSuccess(null);
    setCancelling(true);

    try {
      const response = await fetch(`/api/organizer/events/${event.id}/cancel`, {
        method: 'POST',
      });
      const payload = (await response.json()) as CancelEventResponse;
      if (!response.ok || payload.status !== 'cancelled') {
        setCancelError(payload.message ?? 'Não foi possível cancelar o evento.');
        return;
      }

      setEvent((prev) => ({
        ...prev,
        status: 'cancelled',
        occupiedSeats: 0,
        availableSeats: 0,
      }));
      setCancelSuccess(
        `Evento cancelado. Ingressos estornados: ${payload.refundedCount ?? 0}. Ingressos pendentes cancelados: ${payload.cancelledCount ?? 0}.`,
      );
      await refreshDashboard();
      router.refresh();
    } catch {
      setCancelError('Erro de conexão ao cancelar evento.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/organizer"
          className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          &larr; Voltar para Meus Eventos
        </Link>
        <span className="font-mono text-xs text-slate-500">ID: {event.id}</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{event.name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${statusMeta.className}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {formatEventDateBr(event.startsAt)} &bull; {event.location}
            </p>
          </div>

          {event.status === 'draft' && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? 'Publicando...' : 'Publicar evento'}
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Preço atual</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">
              {formatPriceBrl(event.priceCents)}
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Lotação máxima</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">{event.capacity}</span>
          </div>
        </div>
      </div>

      {/* Painel do Evento (R12) */}
      <div
        aria-label="Painel do evento"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Painel do evento</h2>
            <p className="mt-1 text-xs text-slate-500">
              Consolidado de vendas pela vitrine e pela API de parceiros.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={refreshingDashboard}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshingDashboard ? 'Atualizando...' : 'Atualizar painel'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-metric="confirmed">
            <span className="block text-xs font-medium text-slate-500">Confirmados</span>
            <span className="mt-1 block text-2xl font-bold text-slate-900">
              {dashboard.confirmed}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-metric="pending">
            <span className="block text-xs font-medium text-slate-500">Pendentes</span>
            <span className="mt-1 block text-2xl font-bold text-slate-900">
              {dashboard.pending}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-metric="checkedIn">
            <span className="block text-xs font-medium text-slate-500">Check-ins</span>
            <span className="mt-1 block text-2xl font-bold text-slate-900">
              {dashboard.checkedIn}
            </span>
          </div>
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            data-metric="availableSeats"
          >
            <span className="block text-xs font-medium text-slate-500">Vagas disponíveis</span>
            <span className="mt-1 block text-2xl font-bold text-slate-900">
              {dashboard.availableSeats}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-metric="revenue">
            <span className="block text-xs font-medium text-slate-500">Receita</span>
            <span className="mt-1 block text-xl font-bold text-emerald-700">
              {dashboard.revenueFormatted}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-metric="refunded">
            <span className="block text-xs font-medium text-slate-500">Estornados</span>
            <span className="mt-1 block text-2xl font-bold text-slate-900">
              {dashboard.refunded}
            </span>
          </div>
        </div>
      </div>

      {/* Check-in de ingressos (R10) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">Check-in</h2>
        <p className="mt-1 text-sm text-slate-600">
          Informe o código do ingresso para validar a entrada no evento.
        </p>

        {isCancelled && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            Evento cancelado
          </div>
        )}

        <form onSubmit={handleCheckIn} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="checkin-code" className="sr-only">
              Código do ingresso
            </label>
            <input
              id="checkin-code"
              name="code"
              type="text"
              placeholder="Digite o código do ingresso (ex.: K7Q2M9XA)"
              value={checkInCode}
              onChange={(e) => setCheckInCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <button
            type="submit"
            disabled={checkingIn}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingIn ? 'Validando...' : 'Validar check-in'}
          </button>
        </form>

        {checkInFeedback && (
          <div
            role={checkInFeedback.ok ? 'status' : 'alert'}
            className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
              checkInFeedback.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {checkInFeedback.message}
          </div>
        )}
      </div>

      {/* Editar dados do evento (R01, R03, R11) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">Editar dados do evento</h2>

        {isCancelled ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Este evento foi cancelado e não pode mais ser editado ou publicado.
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700">
                Nome do evento
              </label>
              <input
                id="edit-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-starts-at"
                  className="block text-sm font-medium text-slate-700"
                >
                  Data e hora de início
                </label>
                <input
                  id="edit-starts-at"
                  name="startsAt"
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label htmlFor="edit-location" className="block text-sm font-medium text-slate-700">
                  Local
                </label>
                <input
                  id="edit-location"
                  name="location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-capacity" className="block text-sm font-medium text-slate-700">
                  Lotação máxima (mínimo atual: {Math.max(1, event.occupiedSeats)})
                </label>
                <input
                  id="edit-capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label htmlFor="edit-price" className="block text-sm font-medium text-slate-700">
                  Preço do ingresso (R$)
                </label>
                <input
                  id="edit-price"
                  name="priceBrl"
                  type="text"
                  inputMode="decimal"
                  required
                  value={priceBrl}
                  onChange={(e) => setPriceBrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Alterações de preço valem apenas para compras futuras.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {successMessage}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cancelamento irreversível (R11) */}
      {event.status === 'published' && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-red-900">Cancelar evento</h2>
              <p className="text-sm text-red-800">
                Ação irreversível: o evento sai da vitrine e da API de parceiros, não pode mais ser
                editado nem republicado, ingressos confirmados passam a estornados e pendentes a
                cancelados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEvent}
              disabled={cancelling}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelling ? 'Cancelando...' : 'Cancelar evento'}
            </button>
          </div>

          {cancelError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700"
            >
              {cancelError}
            </div>
          )}
        </div>
      )}

      {cancelSuccess && (
        <div
          role="status"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
        >
          {cancelSuccess}
        </div>
      )}
    </section>
  );
}
