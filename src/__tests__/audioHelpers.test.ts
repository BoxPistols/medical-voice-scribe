import { describe, it, expect } from 'vitest';
import { formatElapsedTime, buildSpeechText, getVoiceForLanguage } from '@/lib/audioHelpers';
import { mockSoapNote, mockEmptySoapNote } from './fixtures/soapNote';

describe('formatElapsedTime', () => {
  it('should format 0 seconds as 00:00', () => {
    expect(formatElapsedTime(0)).toBe('00:00');
  });

  it('should format seconds under a minute', () => {
    expect(formatElapsedTime(30)).toBe('00:30');
    expect(formatElapsedTime(59)).toBe('00:59');
  });

  it('should format exactly one minute', () => {
    expect(formatElapsedTime(60)).toBe('01:00');
  });

  it('should format minutes and seconds', () => {
    expect(formatElapsedTime(90)).toBe('01:30');
    expect(formatElapsedTime(754)).toBe('12:34');
  });

  it('should format just under an hour as MM:SS', () => {
    expect(formatElapsedTime(3599)).toBe('59:59');
  });

  it('should format exactly one hour with HH:MM:SS', () => {
    expect(formatElapsedTime(3600)).toBe('01:00:00');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatElapsedTime(3661)).toBe('01:01:01');
    expect(formatElapsedTime(7384)).toBe('02:03:04');
  });

  it('should pad single digits', () => {
    expect(formatElapsedTime(5)).toBe('00:05');
    expect(formatElapsedTime(3605)).toBe('01:00:05');
  });
});

describe('buildSpeechText', () => {
  it('should build full speech text from complete SOAP note', () => {
    const text = buildSpeechText(mockSoapNote);

    // Summary
    expect(text).toContain('要約。');
    expect(text).toContain(mockSoapNote.summary);

    // Patient info
    expect(text).toContain('患者情報。');
    expect(text).toContain('主訴、頭痛。');

    // Subjective
    expect(text).toContain('S、主観的情報。');
    expect(text).toContain('現病歴、');
    expect(text).toContain('症状、頭痛、めまい、吐き気。');
    expect(text).toContain('重症度、中等度。');

    // Objective
    expect(text).toContain('O、客観的情報。');
    expect(text).toContain('バイタルサイン、');
    expect(text).toContain('血圧145/95 mmHg');

    // Assessment
    expect(text).toContain('A、評価・診断。');
    expect(text).toContain('診断名、緊張型頭痛。');
    expect(text).toContain('鑑別診断、片頭痛、高血圧性頭痛。');

    // Plan
    expect(text).toContain('P、治療計画。');
    expect(text).toContain('治療方針、');
    expect(text).toContain('処方、');
    expect(text).toContain('フォローアップ、');
  });

  it('should handle empty SOAP note', () => {
    const text = buildSpeechText(mockEmptySoapNote);

    // Should still contain section headers
    expect(text).toContain('S、主観的情報。');
    expect(text).toContain('O、客観的情報。');
    expect(text).toContain('A、評価・診断。');
    expect(text).toContain('P、治療計画。');

    // Should not contain data fields
    expect(text).not.toContain('現病歴、');
    expect(text).not.toContain('処方、');
  });

  it('should handle SOAP note with partial data', () => {
    const partial = {
      ...mockEmptySoapNote,
      summary: 'テスト要約',
      soap: {
        ...mockEmptySoapNote.soap,
        subjective: {
          ...mockEmptySoapNote.soap.subjective,
          presentIllness: 'テスト現病歴',
        },
      },
    };
    const text = buildSpeechText(partial);

    expect(text).toContain('要約。テスト要約');
    expect(text).toContain('現病歴、テスト現病歴。');
  });
});

describe('getVoiceForLanguage', () => {
  const mockVoices = [
    { name: 'Google 日本語', lang: 'ja-JP' },
    { name: 'Kyoko', lang: 'ja-JP' },
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Google UK English', lang: 'en-GB' },
  ] as SpeechSynthesisVoice[];

  it('should return exact language match', () => {
    const voice = getVoiceForLanguage(mockVoices, 'ja-JP');
    expect(voice?.name).toBe('Google 日本語');
  });

  it('should return exact match for en-US', () => {
    const voice = getVoiceForLanguage(mockVoices, 'en-US');
    expect(voice?.name).toBe('Google US English');
  });

  it('should fall back to partial match (base language)', () => {
    const voice = getVoiceForLanguage(mockVoices, 'ja');
    expect(voice?.lang).toBe('ja-JP');
  });

  it('should fall back to partial match for English', () => {
    const voice = getVoiceForLanguage(mockVoices, 'en');
    // Should match first en-* voice
    expect(voice?.lang).toMatch(/^en/);
  });

  it('should return first voice as fallback when no match', () => {
    const voice = getVoiceForLanguage(mockVoices, 'zh-CN');
    expect(voice?.name).toBe('Google 日本語');
  });

  it('should return null for empty voices array', () => {
    const voice = getVoiceForLanguage([], 'ja-JP');
    expect(voice).toBeNull();
  });
});
