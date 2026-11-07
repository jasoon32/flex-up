import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

/** Loads the ding; music from other apps only dips while it plays. */
export function primeRestSound(): void {
  if (player) return;
  setAudioModeAsync({ interruptionMode: 'duckOthers' }).catch(() => {});
  player = createAudioPlayer(require('../../assets/rest-done.wav'));
}

export function playRestSound(): void {
  primeRestSound();
  player!.seekTo(0);
  player!.play();
}
