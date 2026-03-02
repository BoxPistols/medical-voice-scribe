/**
 * Mock implementations for Web Speech API
 */
import { vi } from 'vitest';

export class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }

  abort() {
    this.onend?.();
  }

  /** Simulate receiving a speech result */
  simulateResult(transcript: string, isFinal: boolean = true) {
    this.onresult?.({
      resultIndex: 0,
      results: [
        [{ transcript, confidence: 0.95 }],
      ],
      // Mimic SpeechRecognitionResultList
      [Symbol.iterator]: function* () {
        yield [{ transcript, confidence: 0.95 }];
      },
    });
    if (isFinal && !this.continuous) {
      this.onend?.();
    }
  }

  /** Simulate an error */
  simulateError(error: string = 'no-speech') {
    this.onerror?.({ error });
  }
}

export class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'ja-JP';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((event: unknown) => void) | null = null;

  constructor(text: string = '') {
    this.text = text;
  }
}

export const createMockSpeechSynthesis = () => {
  const voices: SpeechSynthesisVoice[] = [
    {
      name: 'Google 日本語',
      lang: 'ja-JP',
      voiceURI: 'Google 日本語',
      localService: false,
      default: true,
    },
    {
      name: 'Kyoko',
      lang: 'ja-JP',
      voiceURI: 'Kyoko',
      localService: true,
      default: false,
    },
    {
      name: 'Google US English',
      lang: 'en-US',
      voiceURI: 'Google US English',
      localService: false,
      default: false,
    },
  ] as SpeechSynthesisVoice[];

  return {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices),
    speaking: false,
    paused: false,
    pending: false,
    onvoiceschanged: null as (() => void) | null,
  };
};
