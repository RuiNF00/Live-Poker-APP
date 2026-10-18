// A screen that throws while it renders shows a calm «Algo correu mal» with
// Voltar instead of a blank screen. Only that screen goes: the store sits above
// every screen, so the hand being entered (as of the last tap that rendered)
// and the live session stay saved, and the report goes out scrubbed.

import React from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { reportCaught } from '@/lib/crash-report';
import { C } from '@/theme';

import { Button, Empty } from './ui';

export function CrashScreen({ onBack, onRetry, onSettings, extra }: { onBack?: () => void; onRetry: () => void; onSettings?: () => void; extra?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
      <Empty
        icon="alert-circle-outline"
        title={t('Algo correu mal')}
        body={t('A mão que estavas a registar e a sessão ao vivo ficaram guardadas. Volta e continua; se voltar a acontecer, fecha e abre a app.')}
        action={
          <View style={{ gap: 8 }}>
            {onBack ? <Button title={t('Voltar')} onPress={onBack} /> : null}
            <Button title={t('Tentar de novo')} kind={onBack ? 'ghost' : undefined} onPress={onRetry} />
            {/* The screen that crashes can be the one Definições opens from (Início): export and erase stay reachable. */}
            {onSettings ? <Button title={t('Definições')} kind="ghost" icon="settings-outline" onPress={onSettings} /> : null}
            {extra}
          </View>
        }
      />
    </View>
  );
}

interface Props {
  children: React.ReactNode;
  onBack: () => void;
  onSettings?: () => void;
}

export class ScreenBoundary extends React.Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[app] screen error', error);
    reportCaught(error);
  }

  private retry = () => this.setState({ error: null });

  private back = () => {
    this.setState({ error: null });
    this.props.onBack();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashScreen onBack={this.back} onRetry={this.retry} onSettings={this.props.onSettings} />;
  }
}
