// Voice note for a story (Pro). Tap to record up to 30 s, tap again to stop,
// listen back or delete. The note goes to the server with the story frame and
// comes back as the story's video.

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { permissionOff } from '@/lib/permission-off';
import { C, F, R } from '@/theme';

import { Row, T, tap } from './ui';

export const MAX_VOICE_S = 30;

function secs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `0:${String(s).padStart(2, '0')}`;
}

export function VoiceRecorder({
  uri,
  onChange,
  locked,
  onLocked,
}: {
  uri: string | null;
  /** The new note and its length in ms (null when deleted). */
  onChange: (uri: string | null, ms?: number) => void;
  /** Free plan: the button opens the paywall instead. */
  locked: boolean;
  onLocked: () => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(uri ?? undefined);
  const playing = useAudioPlayerStatus(player);
  const was = useRef(false);
  const took = useRef(0);
  useEffect(() => {
    if (rec.isRecording) took.current = rec.durationMillis;
  }, [rec.isRecording, rec.durationMillis]);

  // Recording also stops on its own at 30 s; pick up the file either way.
  useEffect(() => {
    if (was.current && !rec.isRecording) {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (recorder.uri) onChange(recorder.uri, took.current);
    }
    was.current = rec.isRecording;
  }, [rec.isRecording, recorder, onChange]);

  const start = async () => {
    if (locked) return onLocked();
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      permissionOff('microphone');
      return;
    }
    tap('medium');
    if (playing.playing) player.pause();
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_VOICE_S });
    } catch {
      // A phone call or another app holding the microphone.
      notice(t('Não deu para gravar'), t('O microfone está ocupado. Tenta outra vez daqui a pouco.'));
    }
  };

  const stop = async () => {
    tap();
    await recorder.stop();
  };

  const toggle = () => {
    if (playing.playing) player.pause();
    else {
      if (playing.didJustFinish || playing.currentTime >= playing.duration - 0.05) player.seekTo(0);
      player.play();
    }
  };

  const box = { backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: rec.isRecording ? C.accent : C.border, padding: 12 };

  if (rec.isRecording) {
    return (
      <Pressable onPress={stop} style={box}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.allin }} />
            <T v="h2">{t('A gravar')}</T>
            <T v="mono" color={C.textDim}>
              {secs(rec.durationMillis)} / 0:{MAX_VOICE_S}
            </T>
          </Row>
          <View style={{ backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <T style={{ fontFamily: F.bold, color: C.accentInk }}>{t('Parar')}</T>
          </View>
        </Row>
      </Pressable>
    );
  }

  if (uri) {
    return (
      <View style={box}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={toggle} hitSlop={8}>
            <Row gap={10}>
              <Ionicons name={playing.playing ? 'pause-circle' : 'play-circle'} size={30} color={C.accent} />
              <T v="h2">{t('A tua voz')}</T>
              <T v="mono" color={C.textDim}>
                {secs((playing.duration || 0) * 1000)}
              </T>
            </Row>
          </Pressable>
          <Row gap={16}>
            <Pressable onPress={start} hitSlop={8}>
              <Ionicons name="refresh" size={20} color={C.textDim} />
            </Pressable>
            <Pressable
              onPress={() => {
                if (playing.playing) player.pause();
                onChange(null);
              }}
              hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={C.danger} />
            </Pressable>
          </Row>
        </Row>
      </View>
    );
  }

  return (
    <Pressable onPress={start} style={({ pressed }) => [box, { opacity: pressed ? 0.8 : 1 }]}>
      <Row gap={10}>
        <Ionicons name="mic" size={22} color={C.accent} />
        <View style={{ flex: 1 }}>
          <T v="h2">{t('Explica a mão com a tua voz')}</T>
          <T v="tiny">{t('Até {n} segundos. A história sai em vídeo.', { n: MAX_VOICE_S })}</T>
        </View>
        {locked ? (
          <View style={{ backgroundColor: C.accentSoft, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <T v="tiny" color={C.accent} style={{ fontFamily: F.bold }}>
              PRO
            </T>
          </View>
        ) : null}
      </Row>
    </Pressable>
  );
}
