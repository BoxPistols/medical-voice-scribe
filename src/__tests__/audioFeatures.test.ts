import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatElapsedTime, buildSpeechText, getVoiceForLanguage } from '@/lib/audioHelpers';
import { mockSoapNote, mockEmptySoapNote } from './fixtures/soapNote';
import { MockSpeechRecognition, MockSpeechSynthesisUtterance, createMockSpeechSynthesis } from './fixtures/speechMocks';

describe('Audio Features Integration', () => {
  describe('Speech Recognition mock', () => {
    it('should create a mock recognition instance', () => {
      const recognition = new MockSpeechRecognition();
      expect(recognition.continuous).toBe(false);
      expect(recognition.interimResults).toBe(false);
      expect(recognition.lang).toBe('');
    });

    it('should configure recognition for Japanese medical dictation', () => {
      const recognition = new MockSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      expect(recognition.continuous).toBe(true);
      expect(recognition.interimResults).toBe(true);
      expect(recognition.lang).toBe('ja-JP');
    });

    it('should handle start callback', () => {
      const recognition = new MockSpeechRecognition();
      const onStart = vi.fn();
      recognition.onstart = onStart;
      recognition.start();
      expect(onStart).toHaveBeenCalled();
    });

    it('should handle stop and trigger onend', () => {
      const recognition = new MockSpeechRecognition();
      const onEnd = vi.fn();
      recognition.onend = onEnd;
      recognition.stop();
      expect(onEnd).toHaveBeenCalled();
    });

    it('should simulate receiving a result', () => {
      const recognition = new MockSpeechRecognition();
      const onResult = vi.fn();
      recognition.onresult = onResult;

      recognition.simulateResult('テスト音声入力');
      expect(onResult).toHaveBeenCalled();
    });

    it('should simulate an error', () => {
      const recognition = new MockSpeechRecognition();
      const onError = vi.fn();
      recognition.onerror = onError;

      recognition.simulateError('no-speech');
      expect(onError).toHaveBeenCalledWith({ error: 'no-speech' });
    });

    it('should handle continuous mode without auto-ending', () => {
      const recognition = new MockSpeechRecognition();
      recognition.continuous = true;
      const onEnd = vi.fn();
      recognition.onend = onEnd;

      recognition.simulateResult('テスト');
      expect(onEnd).not.toHaveBeenCalled();
    });
  });

  describe('Speech Synthesis mock', () => {
    it('should create a mock synthesis instance', () => {
      const synthesis = createMockSpeechSynthesis();
      expect(synthesis.getVoices()).toHaveLength(3);
      expect(synthesis.speak).toBeDefined();
      expect(synthesis.cancel).toBeDefined();
    });

    it('should return Japanese voices', () => {
      const synthesis = createMockSpeechSynthesis();
      const voices = synthesis.getVoices();
      const jaVoices = voices.filter((v: SpeechSynthesisVoice) => v.lang === 'ja-JP');
      expect(jaVoices).toHaveLength(2);
    });

    it('should create utterance with correct properties', () => {
      const utterance = new MockSpeechSynthesisUtterance('テスト文章');
      expect(utterance.text).toBe('テスト文章');
      expect(utterance.lang).toBe('ja-JP');
      expect(utterance.rate).toBe(1);
      expect(utterance.pitch).toBe(1);
    });
  });

  describe('TTS text generation workflow', () => {
    it('should generate speech text from SOAP note and format correctly', () => {
      const text = buildSpeechText(mockSoapNote);

      // Verify the text follows the expected TTS flow
      const sections = text.split('\n\n');
      expect(sections.length).toBeGreaterThan(4);

      // First section should be summary
      expect(sections[0]).toContain('要約');

      // Should end with Plan section
      const lastNonEmpty = sections.filter(s => s.trim()).pop();
      expect(lastNonEmpty).toContain('P、治療計画');
    });

    it('should be able to create utterance from generated speech text', () => {
      const text = buildSpeechText(mockSoapNote);
      const utterance = new MockSpeechSynthesisUtterance(text);

      expect(utterance.text.length).toBeGreaterThan(100);
      expect(utterance.text).toContain('要約');
    });

    it('should select correct voice for TTS', () => {
      const synthesis = createMockSpeechSynthesis();
      const voices = synthesis.getVoices();
      const selectedVoice = getVoiceForLanguage(voices, 'ja-JP');

      expect(selectedVoice).not.toBeNull();
      expect(selectedVoice!.lang).toBe('ja-JP');
    });
  });

  describe('Recording timer formatting', () => {
    it('should display recording timer in correct format during short sessions', () => {
      // Simulate a 2-minute 30-second recording
      expect(formatElapsedTime(150)).toBe('02:30');
    });

    it('should display recording timer for long sessions', () => {
      // Simulate a 1-hour 15-minute recording
      expect(formatElapsedTime(4500)).toBe('01:15:00');
    });

    it('should handle timer at exactly 0', () => {
      expect(formatElapsedTime(0)).toBe('00:00');
    });

    it('should count up correctly across boundaries', () => {
      // Boundary: 59 seconds to 1 minute
      expect(formatElapsedTime(59)).toBe('00:59');
      expect(formatElapsedTime(60)).toBe('01:00');

      // Boundary: 59:59 to 1:00:00
      expect(formatElapsedTime(3599)).toBe('59:59');
      expect(formatElapsedTime(3600)).toBe('01:00:00');
    });
  });

  describe('Speech rate and voice configuration', () => {
    it('should configure utterance with custom speech rate', () => {
      const utterance = new MockSpeechSynthesisUtterance('テスト');
      utterance.rate = 1.5;
      expect(utterance.rate).toBe(1.5);
    });

    it('should configure utterance with custom pitch', () => {
      const utterance = new MockSpeechSynthesisUtterance('テスト');
      utterance.pitch = 0.8;
      expect(utterance.pitch).toBe(0.8);
    });

    it('should assign a voice to utterance', () => {
      const synthesis = createMockSpeechSynthesis();
      const voices = synthesis.getVoices();
      const utterance = new MockSpeechSynthesisUtterance('テスト');

      const selectedVoice = getVoiceForLanguage(voices, 'ja-JP');
      utterance.voice = selectedVoice;

      expect(utterance.voice).not.toBeNull();
      expect(utterance.voice!.lang).toBe('ja-JP');
    });

    it('should fall back to first voice for unknown language', () => {
      const synthesis = createMockSpeechSynthesis();
      const voices = synthesis.getVoices();
      const voice = getVoiceForLanguage(voices, 'ko-KR');

      // Should fall back to first voice
      expect(voice).not.toBeNull();
      expect(voice!.name).toBe('Google 日本語');
    });
  });
});
