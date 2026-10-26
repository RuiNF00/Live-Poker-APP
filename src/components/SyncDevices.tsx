// «Usar noutro aparelho»: the same data on a second phone or an iPad, with no account. The device
// that has the copy shows its code (and a QR the other's camera opens the app with); the other one
// joins it: what each has is put together, nothing is lost or counted twice (backup-merge.ts), and
// from then on both read the copy when they open (cloud-guard pullDue). Lazy, like CloudBackup.tsx.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { download, formatCode, joinCloud, loadCloud, onCloudChange, parseCode, syncCloud, type CloudState } from '@/lib/cloud-backup';
import { syncLink, takeLinkedCode } from '@/lib/cloud-code';
import { countsOf, joinWarnings, secondConfirm, SHOW_CODE_MS, type JoinWarning } from '@/lib/cloud-guard';
import { buildBackup, importSummary, type BackupData } from '@/store/backup';
import { useStore } from '@/store/store';
import { C, F, R, S } from '@/theme';

import { activate, ask, confirmTurnOn, errText, note, shareCode, syncedAgo, type ImportData } from './CloudBackup';
import { Button, Card, Field, ListGroup, ListItem, Row, Stat, StatGrid, T, tap } from './ui';

/** While the code is on screen and no other device has joined yet: a read every 20 s, for 5 minutes at most. */
const WATCH_MS = 20_000;
const WATCH_TRIES = 15;

/** The code as a QR (sweatbook://sync#…), dark on white as cameras read best. The encoder loads with this screen only. */
function CodeQR({ c, size = 208 }: { c: CloudState; size?: number }) {
  const [cells, setCells] = useState<{ n: number; d: string } | null>(null);
  useEffect(() => {
    let live = true;
    import('toqr')
      .then(({ toQR }) => {
        const m = toQR(syncLink(c));
        const n = Math.round(Math.sqrt(m.length));
        let d = '';
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y * n + x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
        if (live) setCells({ n, d });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [c]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('QR com o código da cópia')} style={{ width: size, height: size, borderRadius: R.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      {cells ? (
        // 4 modules of white around it: the quiet zone the standard asks for.
        <Svg width={size} height={size} viewBox={`0 0 ${cells.n + 8} ${cells.n + 8}`}>
          <Rect x={0} y={0} width={cells.n + 8} height={cells.n + 8} fill="#FFFFFF" />
          <Path d={cells.d} fill="#000000" />
        </Svg>
      ) : null}
    </View>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ListGroup>
      {items.map((label, i) => (
        <ListItem
          key={i}
          left={
            <T v="mono" color={C.accent} style={{ width: 16 }}>
              {String(i + 1)}
            </T>
          }
          title={label}
          numberOfLines={3}
        />
      ))}
    </ListGroup>
  );
}

/** What each warning says on the join screen and in the second confirmation. */
function warningText(w: JoinWarning): string {
  if (w === 'link') return t('Se alguém te enviou este link, não juntes: essa pessoa passa a ver tudo o que guardas.');
  if (w === 'empty_copy') return t('Esta cópia está vazia e este aparelho tem dados. Se juntares, tudo o que tens aqui vai para essa cópia. Só o faças se a criaste agora num aparelho teu.');
  return t('Este aparelho deixa de usar o código que tinha. A cópia desse código fica no servidor até expirar.');
}

/** The code and its QR while on screen; after SHOW_CODE_MS both are covered, so nobody reads them off the screen later. */
function CodeCard({ cloud }: { cloud: CloudState }) {
  const [shownAt, setShownAt] = useState(Date.now);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHidden(true), SHOW_CODE_MS);
    return () => clearTimeout(id);
  }, [shownAt]);
  if (hidden)
    return (
      <Card style={{ alignItems: 'center', gap: S.md }}>
        <View style={{ width: 208, height: 208, borderRadius: R.md, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.lg }}>
          <Ionicons name="eye-off-outline" size={32} color={C.textDim} />
          <T v="h3" style={{ textAlign: 'center' }}>
            {t('Código escondido')}
          </T>
        </View>
        <T v="small" style={{ textAlign: 'center' }}>
          {t('Escondemos o código ao fim de 5 minutos, para ninguém o ler do teu ecrã.')}
        </T>
        <Button
          size="sm"
          kind="secondary"
          icon="eye-outline"
          title={t('Mostrar o código')}
          style={{ alignSelf: 'stretch' }}
          onPress={() => {
            setHidden(false);
            setShownAt(Date.now());
          }}
        />
      </Card>
    );
  return (
    <Card style={{ alignItems: 'center', gap: S.md }}>
      <CodeQR c={cloud} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Copiar código')}
        onPress={async () => {
          await Clipboard.setStringAsync(formatCode(cloud));
          note(t('Código copiado'));
        }}
        style={({ pressed }) => ({ alignSelf: 'stretch', backgroundColor: C.bgDeep, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
        <T selectable style={{ flex: 1, fontFamily: F.mono, fontSize: 14, letterSpacing: 1, color: C.text, textAlign: 'center' }}>
          {formatCode(cloud)}
        </T>
        <Ionicons name="copy-outline" size={18} color={C.accent} />
      </Pressable>
      <Button size="sm" kind="secondary" icon="share-outline" title={t('Enviar o código')} style={{ alignSelf: 'stretch' }} onPress={() => shareCode(cloud)} />
    </Card>
  );
}

/**
 * `join`: opened to type a code. `fromLink`: opened by a sweatbook://sync link; the code waits in
 * memory (takeLinkedCode), never in the route, and joining it takes the link warning and two yeses.
 */
export function SyncDevices({ join: joinFirst, fromLink }: { join?: boolean; fromLink?: boolean }) {
  const store = useStore();
  const latest = useRef(store);
  latest.current = store;
  const [linked] = useState(() => (fromLink ? takeLinkedCode() : null));
  const [cloud, setCloud] = useState<CloudState | null | undefined>(undefined);
  const [joining, setJoining] = useState(!!joinFirst || !!fromLink);
  const [code, setCode] = useState(linked ? formatCode(linked) : '');
  // The copy behind the typed code, read and shown before anything joins.
  const [preview, setPreview] = useState<{ c: CloudState; remote: BackupData } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    loadCloud().then(setCloud);
    return onCloudChange(setCloud);
  }, []);
  // «há 3 min» moves on while the screen is open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const showing = !!cloud && !cloud.gone && !joining;
  const shared = !!cloud?.shared;
  // The code is on screen and no device has used it yet: watch for the other one, so this one says
  // «Ligado» as soon as it joins (and from then on reads the copy when it opens).
  useEffect(() => {
    if (!showing || shared) return;
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > WATCH_TRIES) return clearInterval(id);
      loadCloud().then((c) => {
        if (c && !c.gone && c.lastAt) syncCloud(c, buildBackup(latest.current), { onRemote: (r) => latest.current.importData(r, { sync: true }) }).catch(() => {});
      });
    }, WATCH_MS);
    return () => clearInterval(id);
  }, [showing, shared]);
  useEffect(() => {
    if (shared) tap('success');
  }, [shared]);

  const syncNow = async () => {
    if (!cloud || busy) return;
    tap();
    setBusy(true);
    try {
      await syncCloud(cloud, buildBackup(latest.current), {
        onRemote: (r) => {
          const n = latest.current.importData(r, { sync: true });
          if (Object.values(n).some((v) => v > 0)) note(t('Sincronizado com o outro aparelho'), importSummary(n));
        },
      });
    } catch (e) {
      note(t('Não deu para sincronizar'), errText(e));
    } finally {
      setBusy(false);
    }
  };

  const typed = parseCode(code);
  // Still the code from the link (not one typed over it): the link warning stays.
  const viaLink = !!linked && !!typed && typed.id === linked.id && typed.secret === linked.secret;

  /** First step: read the copy behind the code and show what it holds. Nothing joins yet. */
  const look = async () => {
    const c = parseCode(code);
    if (!c) return note(t('Código inválido'), t('O código tem 26 letras e números, como aparece no outro aparelho.'));
    // The code this device already uses: nothing to join, just sync.
    if (cloud && !cloud.gone && cloud.id === c.id && cloud.secret === c.secret) {
      setJoining(false);
      return syncNow();
    }
    tap();
    setBusy(true);
    try {
      setPreview({ c, remote: await download(c) });
    } catch (e) {
      note(t('Não deu para ler a cópia'), errText(e));
    } finally {
      setBusy(false);
    }
  };

  const warnings = preview
    ? joinWarnings({ remote: countsOf(preview.remote), local: countsOf(buildBackup(store)), fromLink: viaLink, otherCode: !!cloud && !cloud.gone })
    : [];

  const doJoin = async (c: CloudState, remote: BackupData) => {
    tap('medium');
    setBusy(true);
    try {
      let n: ReturnType<ImportData> | null = null;
      await joinCloud(
        c,
        buildBackup(latest.current),
        (r) => {
          n = latest.current.importData(r, { sync: true });
        },
        remote,
      );
      setJoining(false);
      setPreview(null);
      setCode('');
      tap('success');
      note(t('Aparelho ligado'), n ? `${importSummary(n)} ${t('A partir de agora, os dois aparelhos ficam iguais sempre que os abres.')}` : undefined);
    } catch (e) {
      note(t('Não deu para juntar'), errText(e));
    } finally {
      setBusy(false);
    }
  };

  /** Second step: yes, and for a link or an empty copy over data here, a second, deliberate yes. */
  const join = () => {
    if (!preview) return;
    const { c, remote } = preview;
    const hasData = store.hands.length > 0 || store.sessions.length > 0 || store.players.length > 0;
    const body = [
      hasData ? t('O que tens neste aparelho junta-se ao que está na cópia. Nada se apaga e nada fica a dobrar.') : t('As mãos, sessões e notas da cópia vêm para este aparelho.'),
      t('Usa só um código dos teus aparelhos: quem tem o código vê tudo o que está na cópia.'),
    ].join('\n\n');
    const go = () => void doJoin(c, remote);
    ask(t('Juntar este aparelho?'), body, t('Juntar'), () => {
      if (!secondConfirm(warnings)) return go();
      // A beat later: on iOS a second alert opened from the first one's button can be swallowed.
      setTimeout(() => ask(t('Tens a certeza?'), warnings.filter((w) => w !== 'other_code').map(warningText).join('\n\n'), t('Juntar mesmo assim'), go), 350);
    });
  };

  const turnOn = () =>
    confirmTurnOn(async () => {
      setBusy(true);
      try {
        setCloud(await activate(buildBackup(latest.current)));
        setJoining(false);
      } catch {
        // Already said.
      } finally {
        setBusy(false);
      }
    });

  if (cloud === undefined) return null;

  const header = (icon: React.ComponentProps<typeof Ionicons>['name'], title: string, body: string) => (
    <View style={{ alignItems: 'center', gap: S.md, paddingTop: S.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={C.accent} />
      </View>
      <T v="title" style={{ textAlign: 'center', fontSize: 26 }}>
        {title}
      </T>
      <T v="callout" style={{ textAlign: 'center', maxWidth: 340 }}>
        {body}
      </T>
    </View>
  );

  const warningCards = (list: JoinWarning[]) =>
    list.map((w) => (
      <Card key={w} tone="warn" style={{ gap: S.sm }}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Ionicons name="warning-outline" size={20} color={C.warn} />
          <T v="small" color={w === 'other_code' ? undefined : C.warn} style={{ flex: 1 }}>
            {warningText(w)}
          </T>
        </Row>
      </Card>
    ));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {showing && cloud ? (
        <>
          {header('phone-portrait-outline', t('Os mesmos dados nos teus aparelhos'), t('No iPhone, no iPad ou num telemóvel novo. Sem conta e sem email: só este código.'))}
          <CodeCard cloud={cloud} />
          <Steps
            items={[
              t('No outro aparelho, instala a Sweatbook.'),
              Platform.OS === 'ios' ? t('Aponta a câmara do outro aparelho a este QR, ou escreve o código em Definições › Cópia na nuvem › Já tenho um código.') : t('No outro aparelho, abre Definições › Cópia na nuvem › Já tenho um código e escreve o código.'),
              t('Os dois juntam o que têm. Depois, ficam iguais sempre que os abres.'),
            ]}
          />
          <Card tone={shared ? undefined : 'accent'} style={{ gap: S.sm }}>
            <Row gap={10}>
              <Ionicons name={shared ? 'checkmark-circle' : 'time-outline'} size={20} color={shared ? C.good : C.accent} />
              <T v="h3" style={{ flex: 1 }}>
                {shared ? t('Ligado a outro aparelho') : t('À espera do outro aparelho…')}
              </T>
            </Row>
            <T v="small">
              {shared
                ? t('Sincronizada {ago}. Abre a app no outro aparelho para ele receber o que fizeste aqui.', { ago: syncedAgo(cloud.syncedAt ?? cloud.lastAt ?? now, now) })
                : t('Quando o outro aparelho juntar o código, aparece aqui.')}
            </T>
            <Button size="sm" kind="secondary" icon="sync-outline" title={busy ? t('A sincronizar…') : t('Sincronizar agora')} disabled={busy} style={{ alignSelf: 'flex-start' }} onPress={syncNow} />
          </Card>
          <T v="tiny" style={{ textAlign: 'center' }}>
            {t('Quem tem este código vê os teus dados. Mostra-o só nos teus aparelhos.')}
          </T>
          <Button size="sm" kind="plain" icon="key-outline" title={t('Este é o aparelho novo? Escrever o código')} style={{ alignSelf: 'center' }} onPress={() => setJoining(true)} />
        </>
      ) : preview ? (
        <>
          {header('cloud-download-outline', t('O que está nesta cópia'), t('Confirma que é a tua antes de juntar este aparelho.'))}
          <StatGrid cols={3}>
            <Stat label={t('Sessões')} value={String(preview.remote.sessions.length)} />
            <Stat label={t('Mãos')} value={String(preview.remote.hands.length)} />
            <Stat label={t('Jogadores')} value={String(preview.remote.players.length)} />
          </StatGrid>
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Última alteração: {ago}', { ago: preview.remote.exportedAt ? syncedAgo(preview.remote.exportedAt, now) : '—' })}
          </T>
          {warningCards(warnings)}
          <View style={{ gap: S.sm }}>
            <Button title={busy ? t('A juntar…') : t('Juntar este aparelho')} icon="link-outline" disabled={busy} onPress={join} />
            <Button kind="ghost" title={t('Cancelar')} disabled={busy} onPress={() => setPreview(null)} />
          </View>
        </>
      ) : (
        <>
          {header('key-outline', t('Juntar este aparelho'), t('Escreve o código que aparece no outro aparelho, em Definições › Cópia na nuvem › Usar noutro aparelho.'))}
          {viaLink ? warningCards(['link']) : null}
          <View style={{ gap: S.sm }}>
            <Field
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              accessibilityLabel={t('Código da cópia')}
              placeholder="XXXXX-XXXXX-XXXXXXXXXXXXXXXX"
              inputStyle={{ fontFamily: F.mono }}
            />
            <Button title={busy ? t('A ler a cópia…') : t('Ver o que a cópia tem')} icon="search-outline" disabled={busy || !code.trim()} onPress={look} />
            {Platform.OS === 'ios' ? (
              <T v="tiny" style={{ textAlign: 'center' }}>
                {t('Ou aponta a câmara deste iPhone ou iPad ao QR do outro aparelho.')}
              </T>
            ) : null}
          </View>
          <Steps items={[t('Tudo o que tens neste aparelho fica.'), t('O que está na cópia junta-se, sem nada a dobrar.'), t('Depois, os dois aparelhos ficam iguais sempre que os abres.')]} />
          {cloud && !cloud.gone ? (
            <Button size="sm" kind="plain" title={t('Mostrar o código deste aparelho')} style={{ alignSelf: 'center' }} onPress={() => setJoining(false)} />
          ) : (
            <Card style={{ gap: S.sm }}>
              <T v="small">{t('Ainda não tens código? Ativa a cópia na nuvem no aparelho onde tens os dados. Aparece lá o código para este.')}</T>
              <Button size="sm" kind="secondary" icon="cloud-upload-outline" title={busy ? t('A ativar…') : t('Ativar neste aparelho')} disabled={busy} style={{ alignSelf: 'flex-start' }} onPress={turnOn} />
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}
