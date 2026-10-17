import { IndexPage, indexMetadata } from '@/components/help/routes';

export const metadata = indexMetadata('es');

export default function Page() {
  return <IndexPage locale="es" />;
}
