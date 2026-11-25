'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  formatEventDateBr,
  formatPriceBrl,
  getEventStatusMeta,
  parseBrlToCents,
  type OrganizerEventWithOccupancy,
} from '@/lib/events/utils';

interface OrganizerDashboardClientProps {
  organizerName: string;
  initialEvents: OrganizerEventWithOccupancy[];
}

interface CreateEventResponse {
  event?: OrganizerEventWithOccupancy;
  error?: string;
  message?: string;
}

/**
 * Interactive organizer workspace listing only the authenticated organizer's events (R13)
 * and providing a creation form that enforces R01 and creates draft events (R02).
 */
export function OrganizerDashboardClient({
  organizerName,
  initialEvents,
}: OrganizerDashboardClientProps): React.ReactElement {
  const router = useRouter();
  const [events, setEvents] = useState<OrganizerEventWithOccupancy[]>(initialEvents);
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [priceBrl, setPriceBrl] = useState('100,00');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleCreateEvent(e: FormEvent<HTMLFormElement>): Promise<void> {
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

    setSubmitting(true);
    try {
      const response = await fetch('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startsAt: startsAtDate.toISOString(),
          location: location.trim(),
          capacity: parsedCapacity,
          priceCents: parsedPriceCents,
        }),
      });

      const payload = (await response.json()) as CreateEventResponse;
      if (!response.ok || !payload.event) {
        setErrorMessage(payload.message ?? 'Não foi possível criar o evento.');
        return;
      }

      const createdEvent = payload.event;
      setEvents((prev) => [createdEvent, ...prev]);
      setName('');
      setStartsAt('');
      setLocation('');
      setCapacity('50');
      setPriceBrl('100,00');
      setSuccessMessage(`Evento "${createdEvent.name}" criado em rascunho.`);
      router.refresh();
    } catch {
      setErrorMessage('Erro de conexão ao criar evento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Área do Organizador</h1>
            <p className="mt-1 text-sm text-slate-600">
              Bem-vindo, <span className="font-semibold text-slate-900">{organizerName}</span>.
              Crie novos eventos em rascunho, publique-os na vitrine e acompanhe suas vagas.
            </p>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Acesso Organizador
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Criar evento</h2>
            <p className="mt-1 text-xs text-slate-500">
              Todo evento nasce como <strong>Rascunho</strong> e só fica visível ao público após
              ser publicado.
            </p>

            <form onSubmit={handleCreateEvent} className="mt-5 space-y-4">
              <div>
                <label htmlFor="event-name" className="block text-sm font-medium text-slate-700">
                  Nome do evento
                </label>
                <input
                  id="event-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Show de Jazz no Teatro"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="event-starts-at"
                  className="block text-sm font-medium text-slate-700"
                >
                  Data e hora de início
                </label>
                <input
                  id="event-starts-at"
                  name="startsAt"
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="event-location"
                  className="block text-sm font-medium text-slate-700"
                >
                  Local
                </label>
                <input
                  id="event-location"
                  name="location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex.: Auditório Central, São Paulo - SP"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="event-capacity"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Lotação máxima
                  </label>
                  <input
                    id="event-capacity"
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
                  <label
                    htmlFor="event-price"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Preço (R$)
                  </label>
                  <input
                    id="event-price"
                    name="priceBrl"
                    type="text"
                    inputMode="decimal"
                    required
                    value={priceBrl}
                    onChange={(e) => setPriceBrl(e.target.value)}
                    placeholder="100,00"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Criando evento...' : 'Criar evento'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">Meus eventos</h2>
              <span className="text-xs font-medium text-slate-500">
                {events.length} {events.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>

            {events.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Você ainda não criou nenhum evento.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Use o formulário ao lado para criar seu primeiro evento em rascunho.
                </p>
              </div>
            ) : (
              <ul className="mt-5 space-y-4">
                {events.map((event) => {
                  const statusMeta = getEventStatusMeta(event.status);
                  return (
                    <li
                      key={event.id}
                      className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{event.name}</h3>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {formatEventDateBr(event.startsAt)} &bull; {event.location}
                          </p>
                        </div>

                        <Link
                          href={`/organizer/events/${event.id}`}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          Gerenciar evento
                        </Link>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                        <div>
                          <span className="block text-slate-500">Preço</span>
                          <span className="font-semibold text-slate-900">
                            {formatPriceBrl(event.priceCents)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Lotação</span>
                          <span className="font-semibold text-slate-900">
                            {event.occupiedSeats} / {event.capacity} ocupadas
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Disponíveis</span>
                          <span className="font-semibold text-slate-900">
                            {event.availableSeats}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
