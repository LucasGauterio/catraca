'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
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
}

interface EventMutationResponse {
  event?: OrganizerEventWithOccupancy;
  error?: string;
  message?: string;
}

/**
 * Dedicated organizer event management client view (R04).
 * Supports editing event attributes (R01, R03, R05), publishing draft events (R02),
 * and locking edits when cancelled (R11).
 */
export function EventManageClient({
  initialEvent,
}: EventManageClientProps): React.ReactElement {
  const router = useRouter();
  const [event, setEvent] = useState<OrganizerEventWithOccupancy>(initialEvent);
  const [name, setName] = useState(initialEvent.name);
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(initialEvent.startsAt));
  const [location, setLocation] = useState(initialEvent.location);
  const [capacity, setCapacity] = useState(String(initialEvent.capacity));
  const [priceBrl, setPriceBrl] = useState(centsToInputBrl(initialEvent.priceCents));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const statusMeta = getEventStatusMeta(event.status);
  const isCancelled = event.status === 'cancelled';

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
      router.refresh();
    } catch {
      setErrorMessage('Erro de conexão ao publicar evento.');
    } finally {
      setPublishing(false);
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

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-4">
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
          <div className="rounded-lg bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Vagas ocupadas</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">
              {event.occupiedSeats}
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Vagas disponíveis</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">
              {event.availableSeats}
            </span>
          </div>
        </div>
      </div>

      {/* F06_SLOT: OrganizerEventDashboard (R12) */}

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

      {/* F06_SLOT: OrganizerCheckInPanel (R10) */}
      {/* F06_SLOT: OrganizerCancelEventControl (R11) */}
    </section>
  );
}
