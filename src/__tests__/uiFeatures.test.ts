import { describe, it, expect } from 'vitest';
import {
  getLayoutPresetWidth,
  cycleTheme,
  buildCopySectionS,
  buildCopySectionO,
  buildCopySectionA,
  buildCopySectionP,
  type ThemeMode,
  type LayoutPreset,
} from '@/lib/uiHelpers';
import { mockSoapNote, mockEmptySoapNote } from './fixtures/soapNote';

describe('UI Features Integration', () => {
  describe('Theme cycling workflow', () => {
    it('should complete full theme cycle', () => {
      let theme: ThemeMode = 'light';
      const themeHistory: ThemeMode[] = [theme];

      for (let i = 0; i < 3; i++) {
        theme = cycleTheme(theme);
        themeHistory.push(theme);
      }

      expect(themeHistory).toEqual(['light', 'dark', 'system', 'light']);
    });

    it('should cycle indefinitely without errors', () => {
      let theme: ThemeMode = 'light';
      for (let i = 0; i < 100; i++) {
        theme = cycleTheme(theme);
      }
      // After 100 cycles (33 full cycles + 1), should be at 'dark'
      expect(theme).toBe('dark');
    });
  });

  describe('Layout preset workflow', () => {
    it('should return correct widths for all presets', () => {
      const presets: LayoutPreset[] = ['equal', 'left', 'right'];
      const widths = presets.map(getLayoutPresetWidth);

      expect(widths).toEqual([50, 65, 35]);
    });

    it('should have complementary right panel widths', () => {
      const presets: LayoutPreset[] = ['equal', 'left', 'right'];
      presets.forEach(preset => {
        const leftWidth = getLayoutPresetWidth(preset);
        const rightWidth = 100 - leftWidth;
        expect(rightWidth).toBeGreaterThan(0);
        expect(rightWidth).toBeLessThan(100);
      });
    });

    it('should have equal preset at 50/50', () => {
      expect(getLayoutPresetWidth('equal')).toBe(50);
      expect(100 - getLayoutPresetWidth('equal')).toBe(50);
    });

    it('should have left preset favoring left panel', () => {
      const leftWidth = getLayoutPresetWidth('left');
      expect(leftWidth).toBeGreaterThan(50);
    });

    it('should have right preset favoring right panel', () => {
      const leftWidth = getLayoutPresetWidth('right');
      expect(leftWidth).toBeLessThan(50);
    });
  });

  describe('Section copy - complete SOAP workflow', () => {
    it('should build all 4 sections without errors', () => {
      const sections = [
        buildCopySectionS(mockSoapNote),
        buildCopySectionO(mockSoapNote),
        buildCopySectionA(mockSoapNote),
        buildCopySectionP(mockSoapNote),
      ];

      sections.forEach(section => {
        expect(section).toBeTruthy();
        expect(section.length).toBeGreaterThan(10);
      });
    });

    it('should have unique headers for each section', () => {
      const headers = [
        buildCopySectionS(mockSoapNote).split('\n')[0],
        buildCopySectionO(mockSoapNote).split('\n')[0],
        buildCopySectionA(mockSoapNote).split('\n')[0],
        buildCopySectionP(mockSoapNote).split('\n')[0],
      ];

      const uniqueHeaders = new Set(headers);
      expect(uniqueHeaders.size).toBe(4);
    });

    it('should include correct data in S section', () => {
      const text = buildCopySectionS(mockSoapNote);
      expect(text).toContain('Subjective');
      expect(text).toContain('頭痛');
      expect(text).toContain('めまい');
      expect(text).toContain('中等度');
    });

    it('should include correct data in O section', () => {
      const text = buildCopySectionO(mockSoapNote);
      expect(text).toContain('Objective');
      expect(text).toContain('145/95 mmHg');
      expect(text).toContain('78 bpm');
    });

    it('should include correct data in A section', () => {
      const text = buildCopySectionA(mockSoapNote);
      expect(text).toContain('Assessment');
      expect(text).toContain('緊張型頭痛');
      expect(text).toContain('G44.2');
      expect(text).toContain('片頭痛');
    });

    it('should include correct data in P section', () => {
      const text = buildCopySectionP(mockSoapNote);
      expect(text).toContain('Plan');
      expect(text).toContain('ロキソプロフェン');
      expect(text).toContain('1週間後再診');
    });

    it('should handle empty SOAP note gracefully for all sections', () => {
      const sections = [
        buildCopySectionS(mockEmptySoapNote),
        buildCopySectionO(mockEmptySoapNote),
        buildCopySectionA(mockEmptySoapNote),
        buildCopySectionP(mockEmptySoapNote),
      ];

      sections.forEach(section => {
        expect(section).toBeTruthy();
        // Should still have headers
        expect(section).toContain('【');
        expect(section).toContain('】');
      });
    });
  });

  describe('Section copy - edge cases', () => {
    it('should handle SOAP note with missing vital signs', () => {
      const noVitals = {
        ...mockSoapNote,
        soap: {
          ...mockSoapNote.soap,
          objective: {
            ...mockSoapNote.soap.objective,
            vitalSigns: {
              bloodPressure: '',
              pulse: '',
              temperature: '',
              respiratoryRate: '',
            },
          },
        },
      };
      const text = buildCopySectionO(noVitals);
      expect(text).toContain('【客観的情報');
    });

    it('should handle SOAP note with no medications', () => {
      const noMeds = {
        ...mockSoapNote,
        soap: {
          ...mockSoapNote.soap,
          plan: {
            ...mockSoapNote.soap.plan,
            medications: [],
          },
        },
      };
      const text = buildCopySectionP(noMeds);
      expect(text).not.toContain('処方:');
    });

    it('should handle SOAP note with multiple medications', () => {
      const multiMeds = {
        ...mockSoapNote,
        soap: {
          ...mockSoapNote.soap,
          plan: {
            ...mockSoapNote.soap.plan,
            medications: [
              { name: '薬A', dosage: '10mg', frequency: '1日1回', duration: '7日' },
              { name: '薬B', dosage: '5mg', frequency: '1日2回', duration: '14日' },
              { name: '薬C', dosage: '25mg', frequency: '1日3回', duration: '5日' },
            ],
          },
        },
      };
      const text = buildCopySectionP(multiMeds);
      expect(text).toContain('1. 薬A');
      expect(text).toContain('2. 薬B');
      expect(text).toContain('3. 薬C');
    });

    it('should handle SOAP note with no differential diagnosis', () => {
      const noDiff = {
        ...mockSoapNote,
        soap: {
          ...mockSoapNote.soap,
          assessment: {
            ...mockSoapNote.soap.assessment,
            differentialDiagnosis: [],
          },
        },
      };
      const text = buildCopySectionA(noDiff);
      expect(text).toContain('診断名');
      expect(text).not.toContain('鑑別診断:');
    });
  });
});
