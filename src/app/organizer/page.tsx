import { redirect } from 'next/navigation';
import { OrganizerDashboardClient } from '@/components/organizer/OrganizerDashboardClient';
import { AuthError, requireOrganizer, type AuthenticatedUser } from '@/lib/auth';
import { listOrganizerEvents } from '@/lib/events/service';

export const dynamic = 'force-dynamic';

/**
 * Organizer dashboard page strictly protected by `requireOrganizer()` (R13).
 * Loads only events belonging to the authenticated organizer.
 */
export default async function OrganizerPage(): Promise<React.ReactElement> {
  let organizer: AuthenticatedUser;
  try {
    organizer = await requireOrganizer();
  } catch (error: unknown) {
    if (error instanceof AuthError && error.statusCode === 403) {
      redirect('/');
    }
    redirect('/login');
  }

  const events = await listOrganizerEvents(organizer.id);

  return (
    <OrganizerDashboardClient
      organizerName={organizer.name}
      initialEvents={events}
    />
  );
}
