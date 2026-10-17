import { IndexPage, indexMetadata } from '@/components/help/routes';

export const metadata = indexMetadata('pt');

export default function Page() {
  return <IndexPage locale="pt" />;
}
