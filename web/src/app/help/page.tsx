import { IndexPage, indexMetadata } from '@/components/help/routes';

export const metadata = indexMetadata('en');

export default function Page() {
  return <IndexPage locale="en" />;
}
