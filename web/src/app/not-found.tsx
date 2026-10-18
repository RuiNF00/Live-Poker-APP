import Link from 'next/link';
import { brand } from '@/config/brand';

export default function NotFound() {
  return (
    <main className="page page-center">
      <h1 className="hand-title">Esta mão já não existe.</h1>
      <p className="muted">O link pode ter sido apagado por quem o partilhou.</p>
      <Link className="btn btn-primary" href="/">
        {brand.name}
      </Link>
    </main>
  );
}
