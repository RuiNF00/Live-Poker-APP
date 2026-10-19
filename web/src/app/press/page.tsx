import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { Mark, Wordmark } from '@/components/Brand';
import { LIVE_FEATURES } from '@/lib/help/articles';
import './press.css';

// Press kit: sweatbook.poker/press. In English, the language journalists in the poker press write in.
// Kept out of search until Rui approves the founder quote and the launch date (see QUOTE_APPROVED).
const QUOTE_APPROVED = false;
const LAUNCH = 'Late 2026'; // TODO(Rui): the store release date once both stores approve

export const metadata: Metadata = {
  title: 'Press kit',
  description: `${brand.name}: the hand book for live poker players. Fact sheet, screenshots and logos.`,
  alternates: { canonical: '/press' },
  robots: QUOTE_APPROVED ? undefined : { index: false, follow: false },
};

const FACTS: [string, string][] = [
  ['Product', `${brand.name}, a hand log and replayer for live poker players`],
  ['Platforms', 'iPhone and Android'],
  ['Launch', `${LAUNCH}, on the App Store and Google Play in 175 countries`],
  ['Languages', 'English, European Portuguese, Brazilian Portuguese and Spanish'],
  ['Price', 'Free with 3 new hands a day. Pro: $29.99 a month or $199.99 a year, with a 3-day free trial on the annual plan. Pro adds unlimited hands, staking, swap settlement, a tax report, multi-currency totals and brand-free sharing'],
  ['Founder', 'Rui, a live tournament player'],
  ['Based in', 'Portugal'],
  ['Age rating', '18+'],
  ['Website', brand.siteUrl.replace(/^https?:\/\//, '')],
  ['Press contact', 'press@sweatbook.poker'],
];

const FEATURES: [string, string][] = [
  ['A hand in 11 taps', 'Log a hand between levels, or leave a voice note and finish it later.'],
  ['A replayer for every street', 'Watch the hand back with stacks, pot and position, step by step.'],
  ['A link your friends can open', 'Share the hand as a link. Friends replay it and vote on the decision in the browser, no app needed.'],
  ['Session and bankroll in one place', 'Clock, level, stack and notes during the session; results, trips and expenses after it.'],
  LIVE_FEATURES.swaps
    ? ['Backer and swap accounts', 'Record the action you sold, makeup and swaps agreed with other players. Records and accounts only: no money moves through the app.']
    : ['Backer accounts', 'Record the action you sold, makeup and a statement for each backer. Records and accounts only: no money moves through the app.'],
  ['Festival planner', 'Full schedules, with a reminder before late reg closes.'],
  ['Bring your history', 'Import from the app you use today, from CSV.'],
  ['Encrypted backup, free', 'Cloud backup encrypted on your phone with a recovery code. No account.'],
  ['Privacy built in', 'Hide the amounts with one tap, lock the app with Face ID and export or erase everything.'],
];

// Only the 4 approved for the press in marketing/kit-imprensa.md: the others show amounts.
const SHOTS: [number, string][] = [
  [1, 'Log a hand in seconds'],
  [2, 'Replay every street'],
  [3, 'Share it and ask your friends'],
  [4, 'Your festival, in one story'],
];

const LOGOS: [string, string, string][] = [
  ['sweatbook-logo-dark.png', 'Logo on dark', 'PNG, 2400 x 640'],
  ['sweatbook-logo-light.png', 'Logo on light', 'PNG, 2400 x 640'],
  ['sweatbook-icon-1024.png', 'App icon', 'PNG, 1024 x 1024'],
  ['sweatbook-icon.svg', 'App icon', 'SVG'],
  ['sweatbook-mark.svg', 'Mark, transparent', 'SVG'],
];

export default function PressPage() {
  return (
    <div className="pk">
      <header className="pk-bar">
        <Link className="pk-logo" href="/" aria-label={brand.name}>
          <Mark size={28} />
          <Wordmark />
        </Link>
        <a className="pk-pill" href="#assets">
          Download assets
        </a>
      </header>

      <main className="pk-main">
        <section className="pk-hero">
          <span className="pk-eyebrow">Press kit</span>
          <h1>
            The hand book <em>for live poker.</em>
          </h1>
          <p className="pk-lede">
            {brand.name} lets live players log a hand in 11 taps, replay it street by street and send it to friends as a link
            they can open in any browser.
          </p>
        </section>

        <section className="pk-section" aria-labelledby="facts">
          <h2 id="facts">Fact sheet</h2>
          <dl className="pk-facts">
            {FACTS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{k === 'Press contact' ? <a href={`mailto:${v}`}>{v}</a> : v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="pk-section" aria-labelledby="story">
          <h2 id="story">The story</h2>
          <p>
            Live players have always written their hands down: on the back of a card protector, in a notes app, in a message to a
            friend at the break. Those notes are hard to read the next day and impossible to replay. {brand.name} turns them into a
            hand you can watch back, with the stacks, the action and your comment, and a link you can send to the people whose
            opinion you trust.
          </p>
          <p>
            It is built for the player who travels to festivals: one place for the session clock, the hands, the trip expenses
            {LIVE_FEATURES.swaps ? ', the backers and the swaps' : ' and the backers'}, with the amounts hidden whenever the phone is on the table.
          </p>
        </section>

        {/* Hidden, not shown as a draft, until Rui approves it: the kit and the outreach link here. */}
        {QUOTE_APPROVED && (
          <section className="pk-section" aria-labelledby="quote">
            <h2 id="quote">From the founder</h2>
            <figure className="pk-quote">
              <blockquote>
                &ldquo;I play live tournaments and I used to write my hands in my phone&apos;s notes. I never looked at them again.
                I wanted something fast enough to use between levels and good enough that my friends would actually open the hand and
                tell me what they think.&rdquo;
              </blockquote>
              <figcaption>Rui, founder of {brand.name}</figcaption>
            </figure>
          </section>
        )}

        <section className="pk-section" aria-labelledby="features">
          <h2 id="features">What it does</h2>
          <ul className="pk-features">
            {FEATURES.map(([t, d]) => (
              <li key={t}>
                <strong>{t}</strong>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pk-section" id="assets" aria-labelledby="shots">
          <h2 id="shots">Screenshots</h2>
          <p className="pk-hint">iPhone, 1320 x 2868. Tap one to open the full size.</p>
          <ul className="pk-shots">
            {SHOTS.map(([n, label]) => (
              <li key={n}>
                <a href={`/press/screenshots/sweatbook-${n}.jpg`} download>
                  <img src={`/press/screenshots/sweatbook-${n}.jpg`} alt={label} loading="lazy" width={1320} height={2868} />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="pk-section" aria-labelledby="logos">
          <h2 id="logos">Logo and icon</h2>
          <ul className="pk-logos">
            {LOGOS.map(([file, label, spec]) => (
              <li key={file}>
                <a href={`/press/${file}`} download>
                  <span className={`pk-swatch${file.includes('light') ? ' light' : ''}`}>
                    <img src={`/press/${file}`} alt={`${brand.name} ${label.toLowerCase()}`} />
                  </span>
                  <strong>{label}</strong>
                  <span>{spec}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="pk-hint">
            Colours: night {brand.colors.bg}, sweat orange {brand.colors.accent}, felt {brand.colors.felt}. Please keep
            &ldquo;Sweat&rdquo; and &ldquo;book&rdquo; in one word and don&apos;t recolour the mark.
          </p>
        </section>
      </main>

      <footer className="pk-foot">
        <p>18+. {brand.name} is a record-keeping app: it has no real-money games and no money moves through it.</p>
        <p>
          <Link href="/">{brand.siteUrl.replace(/^https?:\/\//, '')}</Link>
        </p>
      </footer>
    </div>
  );
}
