import { describe, it, expect } from 'vitest';
import {
  getLayoutPresetWidth,
  cycleTheme,
  buildCopySectionS,
  buildCopySectionO,
  buildCopySectionA,
  buildCopySectionP,
  type ThemeMode,
} from '@/lib/uiHelpers';
import { mockSoapNote, mockEmptySoapNote } from './fixtures/soapNote';

describe('getLayoutPresetWidth', () => {
  it('should return 50 for equal preset', () => {
    expect(getLayoutPresetWidth('equal')).toBe(50);
  });

  it('should return 65 for left preset', () => {
    expect(getLayoutPresetWidth('left')).toBe(65);
  });

  it('should return 35 for right preset', () => {
    expect(getLayoutPresetWidth('right')).toBe(35);
  });
});

describe('cycleTheme', () => {
  it('should cycle light → dark', () => {
    expect(cycleTheme('light')).toBe('dark');
  });

  it('should cycle dark → system', () => {
    expect(cycleTheme('dark')).toBe('system');
  });

  it('should cycle system → light', () => {
    expect(cycleTheme('system')).toBe('light');
  });

  it('should complete full cycle', () => {
    let theme: ThemeMode = 'light';
    theme = cycleTheme(theme); // dark
    theme = cycleTheme(theme); // system
    theme = cycleTheme(theme); // light
    expect(theme).toBe('light');
  });
});

describe('buildCopySectionS', () => {
  it('should include section header', () => {
    const text = buildCopySectionS(mockSoapNote);
    expect(text).toContain('【主観的情報 (Subjective)】');
  });

  it('should include present illness', () => {
    const text = buildCopySectionS(mockSoapNote);
    expect(text).toContain('現病歴:');
    expect(text).toContain(mockSoapNote.soap.subjective.presentIllness);
  });

  it('should include symptoms as bullet list', () => {
    const text = buildCopySectionS(mockSoapNote);
    expect(text).toContain('症状:');
    expect(text).toContain('• 頭痛');
    expect(text).toContain('• めまい');
    expect(text).toContain('• 吐き気');
  });

  it('should include severity', () => {
    const text = buildCopySectionS(mockSoapNote);
    expect(text).toContain('重症度: 中等度');
  });

  it('should include past medical history', () => {
    const text = buildCopySectionS(mockSoapNote);
    expect(text).toContain('既往歴:');
    expect(text).toContain('高血圧');
  });

  it('should handle empty SOAP note', () => {
    const text = buildCopySectionS(mockEmptySoapNote);
    expect(text).toContain('【主観的情報 (Subjective)】');
    expect(text).not.toContain('現病歴:');
  });
});

describe('buildCopySectionO', () => {
  it('should include section header', () => {
    const text = buildCopySectionO(mockSoapNote);
    expect(text).toContain('【客観的情報 (Objective)】');
  });

  it('should include vital signs', () => {
    const text = buildCopySectionO(mockSoapNote);
    expect(text).toContain('バイタルサイン:');
    expect(text).toContain('• 血圧: 145/95 mmHg');
    expect(text).toContain('• 脈拍: 78 bpm');
    expect(text).toContain('• 体温: 36.8°C');
    expect(text).toContain('• 呼吸数: 16 回/分');
  });

  it('should include physical exam', () => {
    const text = buildCopySectionO(mockSoapNote);
    expect(text).toContain('身体所見:');
    expect(text).toContain('瞳孔正常、頸部硬直なし');
  });

  it('should handle empty SOAP note', () => {
    const text = buildCopySectionO(mockEmptySoapNote);
    expect(text).toContain('【客観的情報 (Objective)】');
    // Empty vital signs should still show headers if object exists but values are empty
  });
});

describe('buildCopySectionA', () => {
  it('should include section header', () => {
    const text = buildCopySectionA(mockSoapNote);
    expect(text).toContain('【評価・診断 (Assessment)】');
  });

  it('should include diagnosis and ICD-10', () => {
    const text = buildCopySectionA(mockSoapNote);
    expect(text).toContain('診断名: 緊張型頭痛');
    expect(text).toContain('ICD-10: G44.2');
  });

  it('should include differential diagnosis', () => {
    const text = buildCopySectionA(mockSoapNote);
    expect(text).toContain('鑑別診断:');
    expect(text).toContain('• 片頭痛');
    expect(text).toContain('• 高血圧性頭痛');
  });

  it('should include clinical impression', () => {
    const text = buildCopySectionA(mockSoapNote);
    expect(text).toContain('臨床的評価:');
    expect(text).toContain('ストレスによる緊張型頭痛の可能性が高い');
  });

  it('should handle empty SOAP note', () => {
    const text = buildCopySectionA(mockEmptySoapNote);
    expect(text).toContain('【評価・診断 (Assessment)】');
    expect(text).not.toContain('診断名:');
  });
});

describe('buildCopySectionP', () => {
  it('should include section header', () => {
    const text = buildCopySectionP(mockSoapNote);
    expect(text).toContain('【計画 (Plan)】');
  });

  it('should include treatment plan', () => {
    const text = buildCopySectionP(mockSoapNote);
    expect(text).toContain('治療方針:');
    expect(text).toContain('鎮痛薬投与、生活指導');
  });

  it('should include medications with details', () => {
    const text = buildCopySectionP(mockSoapNote);
    expect(text).toContain('処方:');
    expect(text).toContain('1. ロキソプロフェン');
    expect(text).toContain('用量: 60mg');
    expect(text).toContain('頻度: 1日3回 毎食後');
    expect(text).toContain('期間: 7日分');
  });

  it('should include follow-up', () => {
    const text = buildCopySectionP(mockSoapNote);
    expect(text).toContain('フォローアップ:');
    expect(text).toContain('1週間後再診');
  });

  it('should handle empty SOAP note', () => {
    const text = buildCopySectionP(mockEmptySoapNote);
    expect(text).toContain('【計画 (Plan)】');
    expect(text).not.toContain('治療方針:');
  });

  it('should handle multiple medications', () => {
    const multiMedNote = {
      ...mockSoapNote,
      soap: {
        ...mockSoapNote.soap,
        plan: {
          ...mockSoapNote.soap.plan,
          medications: [
            { name: '薬A', dosage: '10mg', frequency: '1日1回', duration: '14日' },
            { name: '薬B', dosage: '20mg', frequency: '1日2回', duration: '7日' },
          ],
        },
      },
    };
    const text = buildCopySectionP(multiMedNote);
    expect(text).toContain('1. 薬A');
    expect(text).toContain('2. 薬B');
  });
});
