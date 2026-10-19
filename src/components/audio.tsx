// Everything that plays or records sound loads from one lazy chunk, so expo-audio stays out of
// the launch bundle. Import these, never VoiceNote or VoiceRecorder directly: a second way in
// makes them shared modules, and shared modules go in the launch bundle.

import React from 'react';

const chunk = () => import('./audio-chunk');

export const VoiceNotePlayer = React.lazy(() => chunk().then((m) => ({ default: m.VoiceNotePlayer })));
export const VoiceCapture = React.lazy(() => chunk().then((m) => ({ default: m.VoiceCapture })));
export const VoiceRecorder = React.lazy(() => chunk().then((m) => ({ default: m.VoiceRecorder })));
