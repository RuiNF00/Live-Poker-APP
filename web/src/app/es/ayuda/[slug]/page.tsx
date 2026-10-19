import { ArticlePage, articleMetadata, articleParams } from '@/components/help/routes';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => articleParams('es');
export const generateMetadata = ({ params }: Props) => articleMetadata('es', params);

export default function Page({ params }: Props) {
  return <ArticlePage locale="es" params={params} />;
}
