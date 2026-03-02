import { describe, it, expect, vi } from 'vitest';
import {
  buildCsvContent,
  buildCsvFilename,
  buildJsonFilename,
  validateImportFile,
  validateImportData,
  buildChatHistoryText,
} from '@/lib/fileHelpers';
import { buildSpeechText } from '@/lib/audioHelpers';
import { buildCopySectionS } from '@/lib/uiHelpers';
import { mockSoapNote, mockEmptySoapNote } from './fixtures/soapNote';

describe('File Features Integration', () => {
  describe('JSON Export workflow', () => {
    it('should serialize SOAP note to JSON string', () => {
      const jsonStr = JSON.stringify(mockSoapNote, null, 2);
      expect(jsonStr).toContain('"summary"');
      expect(jsonStr).toContain('"soap"');
      expect(jsonStr).toContain('"subjective"');

      // Should be valid JSON that can be parsed back
      const parsed = JSON.parse(jsonStr);
      expect(parsed.summary).toBe(mockSoapNote.summary);
    });

    it('should generate valid JSON filename', () => {
      const filename = buildJsonFilename();
      expect(filename).toMatch(/^soap_note_.*\.json$/);
      expect(filename).not.toContain(':');
    });

    it('should produce valid JSON that passes import validation', () => {
      const jsonStr = JSON.stringify(mockSoapNote);
      const parsed = JSON.parse(jsonStr);
      const result = validateImportData(parsed);
      expect(result.valid).toBe(true);
    });
  });

  describe('CSV Export workflow', () => {
    it('should generate complete CSV content', () => {
      const csv = buildCsvContent(mockSoapNote);

      // Should be parseable as CSV
      const rows = csv.split('\n');
      expect(rows.length).toBeGreaterThan(10);

      // Each row should have exactly 2 cells
      rows.forEach(row => {
        // Count commas that are not inside quoted strings
        const cells = row.match(/"[^"]*"/g) || [];
        expect(cells.length).toBe(2);
      });
    });

    it('should generate valid CSV filename', () => {
      const filename = buildCsvFilename();
      expect(filename).toMatch(/^soap_note_.*\.csv$/);
      expect(filename).not.toContain(':');
    });

    it('should properly escape special characters in CSV', () => {
      const noteWithSpecials = {
        ...mockSoapNote,
        summary: '引用 "テスト" & カンマ, 改行\nあり',
      };
      const csv = buildCsvContent(noteWithSpecials);

      // Double quotes should be escaped
      expect(csv).toContain('""テスト""');
    });

    it('should handle medications with all fields populated', () => {
      const csv = buildCsvContent(mockSoapNote);

      // Should contain medication info
      expect(csv).toContain('ロキソプロフェン');
      expect(csv).toContain('60mg');
    });

    it('should handle empty arrays gracefully', () => {
      const csv = buildCsvContent(mockEmptySoapNote);

      // Should still produce valid CSV
      const rows = csv.split('\n');
      expect(rows.length).toBe(27); // Same number of rows
    });
  });

  describe('File Import validation workflow', () => {
    it('should accept valid JSON file for import', () => {
      const content = JSON.stringify(mockSoapNote);
      const file = new File([content], 'soap_note.json', { type: 'application/json' });

      const fileResult = validateImportFile(file);
      expect(fileResult.valid).toBe(true);

      // Also validate the data
      const parsed = JSON.parse(content);
      const dataResult = validateImportData(parsed);
      expect(dataResult.valid).toBe(true);
    });

    it('should reject oversized files', () => {
      const hugeContent = 'x'.repeat(11 * 1024 * 1024);
      const file = new File([hugeContent], 'huge.json', { type: 'application/json' });

      const result = validateImportFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });

    it('should reject non-JSON files', () => {
      const file = new File(['data'], 'note.txt', { type: 'text/plain' });
      const result = validateImportFile(file);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid JSON data', () => {
      expect(validateImportData(null).valid).toBe(false);
      expect(validateImportData('string').valid).toBe(false);
      expect(validateImportData(123).valid).toBe(false);
      expect(validateImportData([]).valid).toBe(false);
    });

    it('should reject SOAP note missing required sections', () => {
      const incomplete = {
        patientInfo: { chiefComplaint: 'test', duration: 'test' },
        soap: {
          subjective: {},
          // missing: objective, assessment, plan
        },
      };
      const result = validateImportData(incomplete);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('S/O/A/P');
    });

    it('should accept minimal valid SOAP structure', () => {
      const minimal = {
        patientInfo: {},
        soap: {
          subjective: {},
          objective: {},
          assessment: {},
          plan: {},
        },
      };
      expect(validateImportData(minimal).valid).toBe(true);
    });
  });

  describe('Export → Import round-trip', () => {
    it('should survive JSON round-trip', () => {
      // Export
      const exported = JSON.stringify(mockSoapNote, null, 2);

      // Import
      const imported = JSON.parse(exported);
      const validation = validateImportData(imported);
      expect(validation.valid).toBe(true);

      // Data integrity
      expect(imported.summary).toBe(mockSoapNote.summary);
      expect(imported.soap.assessment.diagnosis).toBe(mockSoapNote.soap.assessment.diagnosis);
    });
  });

  describe('Chat history export', () => {
    it('should build text from chat messages', () => {
      const messages = [
        { role: 'user', content: '頭痛の鑑別診断を教えて', timestamp: new Date('2026-02-07T10:00:00') },
        { role: 'assistant', content: '頭痛の鑑別診断には...', timestamp: new Date('2026-02-07T10:01:00') },
      ];

      const text = buildChatHistoryText(messages);

      expect(text).toContain('診療サポート チャット履歴');
      expect(text).toContain('あなた');
      expect(text).toContain('AIサポート');
      expect(text).toContain('頭痛の鑑別診断を教えて');
      expect(text).toContain('頭痛の鑑別診断には...');
    });

    it('should return empty string for no messages', () => {
      expect(buildChatHistoryText([])).toBe('');
    });

    it('should preserve message order', () => {
      const messages = [
        { role: 'user', content: 'A', timestamp: new Date('2026-02-07T10:00:00') },
        { role: 'assistant', content: 'B', timestamp: new Date('2026-02-07T10:01:00') },
        { role: 'user', content: 'C', timestamp: new Date('2026-02-07T10:02:00') },
      ];
      const text = buildChatHistoryText(messages);

      const idxA = text.indexOf('A');
      const idxB = text.indexOf('B');
      const idxC = text.indexOf('] あなた:\nC');

      expect(idxA).toBeLessThan(idxB);
      expect(idxB).toBeLessThan(idxC);
    });
  });

  describe('Clipboard copy simulation', () => {
    it('should build S section copy text correctly', () => {
      const text = buildCopySectionS(mockSoapNote);

      expect(text).toContain('【主観的情報');
      expect(text).toContain('現病歴');
      expect(text).toContain('症状');
    });

    it('should build complete chart text for copy', () => {
      const text = buildSpeechText(mockSoapNote);
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain('S、主観的情報');
      expect(text).toContain('O、客観的情報');
      expect(text).toContain('A、評価・診断');
      expect(text).toContain('P、治療計画');
    });
  });
});
