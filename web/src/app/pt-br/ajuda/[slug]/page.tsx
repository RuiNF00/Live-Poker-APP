import { ArticlePage, articleMetadata, articleParams } from '@/components/help/routes';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => articleParams('br');
export const generateMetadata = ({ params }: Props) => articleMetadata('br', params);

export default function Page({ params }: Props) {
  return <ArticlePage locale="br" params={params} />;
}
