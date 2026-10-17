import { ArticlePage, articleMetadata, articleParams } from '@/components/help/routes';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => articleParams('pt');
export const generateMetadata = ({ params }: Props) => articleMetadata('pt', params);

export default function Page({ params }: Props) {
  return <ArticlePage locale="pt" params={params} />;
}
