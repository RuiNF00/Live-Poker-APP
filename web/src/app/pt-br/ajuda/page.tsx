import { IndexPage, indexMetadata } from '@/components/help/routes';

export const metadata = indexMetadata('br');

export default function Page() {
  return <IndexPage locale="br" />;
}
