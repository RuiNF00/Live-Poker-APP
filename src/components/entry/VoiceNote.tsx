// "Guardar rápido": at the table there is rarely time for the whole hand. One
// tap records a voice note, one more stops it and saves the hand as it is; the
// note plays back when the hand is completed after the session.

import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { voiceNoteExists } from '@/lib/voice-note';
import { C, R, S } from '@/theme';

import { Button, IconButton, Row, T, tap } from '../ui';

export const MAX_NOTE_S = 60;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Records one note; `onDone` gets the file when it stops, by a tap or at the time limit. */
export function useVoiceCapture(onDone: (uri: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(false);
  const was = useRef(false);
  const cancelled = useRef(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (was.current && !rec.isRecording) {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!cancelled.current && recorder.uri) done.current(recorder.uri);
    }
    was.current = rec.isRecording;
  }, [rec.isRecording, recorder]);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('Microfone desligado'), t('Ativa o microfone para o Sweatbook nas definições do telemóvel.'));
        return;
      }
      tap('medium');
      cancelled.current = false;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_NOTE_S });
    } finally {
      setStarting(false);
    }
  };
  const stop = async () => {
    tap('medium');
    await recorder.stop();
  };
  const cancel = async () => {
    tap();
    cancelled.current = true;
    await recorder.stop();
  };
  return { recording: rec.isRecording, ms: rec.durationMillis, start, stop, cancel };
}

/** Takes the place of the dock while recording. */
export function RecordingBar({ ms, onStop, onCancel }: { ms: number; onStop: () => void; onCancel: () => void }) {
  return (
    <View style={{ gap: S.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.allin }} />
          <T v="h2">{t('A gravar')}</T>
          <T v="mono" color={C.textDim}>
            {clock(ms)} / {clock(MAX_NOTE_S * 1000)}
          </T>
        </Row>
        <Pressable onPress={onCancel} hitSlop={10}>
          <T v="small" color={C.textDim}>
            {t('Cancelar')}
          </T>
        </Pressable>
      </Row>
      <T v="tiny" color={C.textDim}>
        {t('Diz as ações e os valores. Completas a mão depois da sessão.')}
      </T>
      <Button title={t('Parar e guardar')} size="lg" icon={<Ionicons name="stop" size={18} color={C.accentInk} />} onPress={onStop} />
    </View>
  );
}

/** Plays the note back: a full row on the hand screen, an icon in the entry header. */
export function VoiceNotePlayer({ uri, compact }: { uri: string; compact?: boolean }) {
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  if (!voiceNoteExists(uri)) return null;
  const toggle = () => {
    if (st.playing) return player.pause();
    if (st.didJustFinish || (st.duration > 0 && st.currentTime >= st.duration - 0.05)) player.seekTo(0);
    player.play();
  };
  if (compact) return <IconButton name={st.playing ? 'pause' : 'mic'} label={t('Ouvir nota de voz')} color={C.accent} onPress={toggle} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Ouvir nota de voz')}
      onPress={() => {
        tap();
        toggle();
      }}
      style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 12, opacity: pressed ? 0.8 : 1 })}>
      <Row gap={10}>
        <Ionicons name={st.playing ? 'pause-circle' : 'play-circle'} size={30} color={C.accent} />
        <T v="h3" style={{ flex: 1 }}>
          {t('Nota de voz')}
        </T>
        <T v="mono" color={C.textDim}>
          {st.playing ? clock(st.currentTime * 1000) : st.duration > 0 && Number.isFinite(st.duration) ? clock(st.duration * 1000) : ''}
        </T>
      </Row>
    </Pressable>
  );
}
