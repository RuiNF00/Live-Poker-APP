import { ArticlePage, articleMetadata, articleParams } from '@/components/help/routes';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => articleParams('en');
export const generateMetadata = ({ params }: Props) => articleMetadata('en', params);

export default function Page({ params }: Props) {
  return <ArticlePage locale="en" params={params} />;
}
