import Link from 'next/link';
import { brand } from '@/config/brand';

export default function Home() {
  return (
    <main className="page page-center home">
      <div className="cta-logo" aria-hidden>
        {brand.name.slice(0, 1)}
      </div>
      <h1 className="home-title">{brand.name}</h1>
      <p className="home-sub">{brand.tagline.pt}</p>
      <p className="muted">Grava a mão entre jogadas, revê-a no replayer e partilha-a com os amigos para teres feedback.</p>
      <div className="cta-stores">
        {brand.appStoreUrl && (
          <a className="btn btn-primary" href={brand.appStoreUrl}>
            App Store
          </a>
        )}
        {brand.playStoreUrl && (
          <a className="btn btn-primary" href={brand.playStoreUrl}>
            Google Play
          </a>
        )}
        <Link className="btn btn-ghost" href="/h/demo">
          Ver uma mão de exemplo
        </Link>
      </div>
    </main>
  );
}
