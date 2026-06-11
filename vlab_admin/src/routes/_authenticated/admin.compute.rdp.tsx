import { createFileRoute } from '@tanstack/react-router';
import { RemoteDesktop } from '@/pages/compute/RemoteDesktop';

export const Route = createFileRoute('/_authenticated/admin/compute/rdp')({
  component: RemoteDesktopRoute,
});

function RemoteDesktopRoute() {
  return <RemoteDesktop />;
}
