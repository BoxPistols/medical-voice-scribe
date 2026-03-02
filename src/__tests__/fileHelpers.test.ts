import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCsvContent,
  buildCsvFilename,
  buildJsonFilename,
  validateImportFile,
  validateImportData,
  buildChatHistoryText,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/fileHelpers';
import { mockSoapNote, mockEmptySoapNote } from './fixtures/soapNote';

describe('buildCsvContent', () => {
  it('should generate CSV with header row', () => {
    const csv = buildCsvContent(mockSoapNote);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"項目","内容"');
  });

  it('should include all SOAP fields', () => {
    const csv = buildCsvContent(mockSoapNote);

    expect(csv).toContain('"要約"');
    expect(csv).toContain('"主訴"');
    expect(csv).toContain('"期間"');
    expect(csv).toContain('"現病歴"');
    expect(csv).toContain('"症状"');
    expect(csv).toContain('"重症度"');
    expect(csv).toContain('"血圧"');
    expect(csv).toContain('"脈拍"');
    expect(csv).toContain('"診断名"');
    expect(csv).toContain('"ICD-10"');
    expect(csv).toContain('"治療方針"');
    expect(csv).toContain('"処方薬"');
    expect(csv).toContain('"フォローアップ"');
  });

  it('should contain correct data values', () => {
    const csv = buildCsvContent(mockSoapNote);

    expect(csv).toContain('緊張型頭痛');
    expect(csv).toContain('G44.2');
    expect(csv).toContain('145/95 mmHg');
    expect(csv).toContain('ロキソプロフェン');
  });

  it('should have 27 rows (header + 26 data rows)', () => {
    const csv = buildCsvContent(mockSoapNote);
    const lines = csv.split('\n');
    expect(lines.length).toBe(27);
  });

  it('should handle empty SOAP note', () => {
    const csv = buildCsvContent(mockEmptySoapNote);
    const lines = csv.split('\n');

    // Should still have all rows
    expect(lines.length).toBe(27);

    // Data values should be empty strings (but still properly escaped)
    expect(lines[1]).toBe('"要約",""');
  });

  it('should escape double quotes in CSV cells', () => {
    const noteWithQuotes = {
      ...mockSoapNote,
      summary: '引用 "テスト" データ',
    };
    const csv = buildCsvContent(noteWithQuotes);
    expect(csv).toContain('引用 ""テスト"" データ');
  });

  it('should join array fields with comma-space', () => {
    const csv = buildCsvContent(mockSoapNote);
    // symptoms: ["頭痛", "めまい", "吐き気"]
    expect(csv).toContain('頭痛, めまい, 吐き気');
  });

  it('should format medication fields', () => {
    const csv = buildCsvContent(mockSoapNote);
    // medication: name dosage frequency duration
    expect(csv).toContain('ロキソプロフェン 60mg 1日3回 毎食後 7日分');
  });
});

describe('buildCsvFilename / buildJsonFilename', () => {
  it('should generate CSV filename with timestamp', () => {
    const filename = buildCsvFilename();
    expect(filename).toMatch(/^soap_note_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
  });

  it('should generate JSON filename with timestamp', () => {
    const filename = buildJsonFilename();
    expect(filename).toMatch(/^soap_note_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });
});

describe('validateImportFile', () => {
  it('should accept valid JSON file', () => {
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    expect(validateImportFile(file)).toEqual({ valid: true });
  });

  it('should reject file exceeding size limit', () => {
    // Create a file mock with large size
    const largeContent = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1);
    const file = new File([largeContent], 'large.json', { type: 'application/json' });
    const result = validateImportFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it('should reject non-JSON file', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const result = validateImportFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('JSON');
  });

  it('should reject CSV file', () => {
    const file = new File(['a,b'], 'data.csv', { type: 'text/csv' });
    const result = validateImportFile(file);
    expect(result.valid).toBe(false);
  });

  it('should accept file exactly at size limit', () => {
    const content = 'x'.repeat(MAX_FILE_SIZE_BYTES);
    const file = new File([content], 'exact.json', { type: 'application/json' });
    expect(validateImportFile(file)).toEqual({ valid: true });
  });
});

describe('validateImportData', () => {
  it('should accept valid SOAP note data', () => {
    expect(validateImportData(mockSoapNote)).toEqual({ valid: true });
  });

  it('should reject null', () => {
    const result = validateImportData(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('無効なJSON');
  });

  it('should reject non-object', () => {
    expect(validateImportData('string')).toEqual({
      valid: false,
      error: '無効なJSON形式です。',
    });
    expect(validateImportData(42)).toEqual({
      valid: false,
      error: '無効なJSON形式です。',
    });
  });

  it('should reject object without soap', () => {
    const result = validateImportData({ patientInfo: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('soap');
  });

  it('should reject object without patientInfo', () => {
    const result = validateImportData({ soap: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('patientInfo');
  });

  it('should reject soap missing required sections', () => {
    const result = validateImportData({
      patientInfo: {},
      soap: { subjective: {}, objective: {} },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('S/O/A/P');
  });

  it('should reject soap with non-object sections', () => {
    const result = validateImportData({
      patientInfo: {},
      soap: {
        subjective: 'string',
        objective: {},
        assessment: {},
        plan: {},
      },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('構造');
  });

  it('should accept minimal valid structure', () => {
    const result = validateImportData({
      patientInfo: {},
      soap: {
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe('buildChatHistoryText', () => {
  const baseDate = new Date('2026-02-07T10:30:00');

  it('should return empty string for empty messages', () => {
    expect(buildChatHistoryText([])).toBe('');
  });

  it('should format single user message', () => {
    const text = buildChatHistoryText([
      { role: 'user', content: 'テストメッセージ', timestamp: baseDate },
    ]);

    expect(text).toContain('診療サポート チャット履歴');
    expect(text).toContain('あなた');
    expect(text).toContain('テストメッセージ');
  });

  it('should format assistant messages with correct role', () => {
    const text = buildChatHistoryText([
      { role: 'assistant', content: '回答です', timestamp: baseDate },
    ]);

    expect(text).toContain('AIサポート');
    expect(text).toContain('回答です');
  });

  it('should format multiple messages in order', () => {
    const messages = [
      { role: 'user', content: '質問1', timestamp: new Date('2026-02-07T10:00:00') },
      { role: 'assistant', content: '回答1', timestamp: new Date('2026-02-07T10:01:00') },
      { role: 'user', content: '質問2', timestamp: new Date('2026-02-07T10:02:00') },
    ];
    const text = buildChatHistoryText(messages);

    const q1Idx = text.indexOf('質問1');
    const a1Idx = text.indexOf('回答1');
    const q2Idx = text.indexOf('質問2');

    expect(q1Idx).toBeLessThan(a1Idx);
    expect(a1Idx).toBeLessThan(q2Idx);
  });

  it('should include separator line', () => {
    const text = buildChatHistoryText([
      { role: 'user', content: 'test', timestamp: baseDate },
    ]);

    expect(text).toContain('='.repeat(40));
  });

  it('should include timestamp in HH:MM format', () => {
    const text = buildChatHistoryText([
      { role: 'user', content: 'test', timestamp: baseDate },
    ]);

    // Should contain time in format like [10:30]
    expect(text).toMatch(/\[\d{2}:\d{2}\]/);
  });
});
