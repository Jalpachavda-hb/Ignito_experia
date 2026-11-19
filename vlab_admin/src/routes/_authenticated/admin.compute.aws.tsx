import { createFileRoute } from '@tanstack/react-router';
import { AwsConsoleLab } from '@/pages/compute/AwsConsoleLab';

export const Route = createFileRoute('/_authenticated/admin/compute/aws')({
  component: AwsConsoleLabRoute,
});

function AwsConsoleLabRoute() {
  return <AwsConsoleLab />;
}
