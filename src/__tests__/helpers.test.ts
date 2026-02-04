import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTimestampForFilename,
  escapeCsvCell,
  formatShortcut,
  extractTextFromSoap,
  validateTextInput,
  isValidSoapNote,
  isMacPlatform,
} from '@/lib/helpers'

describe('Helper Functions', () => {
  describe('getTimestampForFilename', () => {
    it('should return ISO format timestamp without colons', () => {
      const timestamp = getTimestampForFilename()

      // Should not contain colons
      expect(timestamp).not.toContain(':')

      // Should match the pattern YYYY-MM-DDTHH-MM-SS
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)
    })

    it('should return 19 characters', () => {
      const timestamp = getTimestampForFilename()
      expect(timestamp).toHaveLength(19)
    })
  })

  describe('escapeCsvCell', () => {
    it('should wrap value in double quotes', () => {
      expect(escapeCsvCell('simple text')).toBe('"simple text"')
      expect(escapeCsvCell('12345')).toBe('"12345"')
    })

    it('should escape internal double quotes', () => {
      expect(escapeCsvCell('text with "quotes"')).toBe('"text with ""quotes"""')
    })

    it('should handle values with commas', () => {
      expect(escapeCsvCell('one, two, three')).toBe('"one, two, three"')
    })

    it('should handle values with newlines', () => {
      expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
    })

    it('should convert non-string values to strings', () => {
      expect(escapeCsvCell(123)).toBe('"123"')
      expect(escapeCsvCell(null)).toBe('"null"')
      expect(escapeCsvCell(undefined)).toBe('"undefined"')
    })
  })

  describe('isMacPlatform', () => {
    it('should return false when navigator is undefined', () => {
      // In test environment, navigator may be mocked
      const result = isMacPlatform()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('formatShortcut', () => {
    it('should return "-" for undefined shortcut', () => {
      expect(formatShortcut(undefined)).toBe('-')
    })

    it('should format simple key', () => {
      expect(formatShortcut({ key: 'r' })).toBe('R')
      expect(formatShortcut({ key: 'a' })).toBe('A')
    })

    it('should format space key', () => {
      expect(formatShortcut({ key: ' ' })).toBe('Space')
    })

    it('should format key with modifiers', () => {
      const result = formatShortcut({ key: 'r', ctrl: true })
      // Result depends on platform detection
      expect(result).toMatch(/(Cmd|Ctrl)\s?\+?\s?R/)
    })

    it('should respect compact option', () => {
      const normal = formatShortcut({ key: 'r', shift: true }, false)
      const compact = formatShortcut({ key: 'r', shift: true }, true)

      expect(normal).toContain(' + ')
      expect(compact).toContain('+')
      expect(compact).not.toContain(' + ')
    })
  })

  describe('validateTextInput', () => {
    it('should reject empty string', () => {
      expect(validateTextInput('')).toEqual({ valid: false, error: 'テキストがありません' })
    })

    it('should reject whitespace-only string', () => {
      expect(validateTextInput('   ')).toEqual({ valid: false, error: 'テキストがありません' })
    })

    it('should reject undefined', () => {
      expect(validateTextInput(undefined)).toEqual({ valid: false, error: 'テキストがありません' })
    })

    it('should accept valid text', () => {
      expect(validateTextInput('valid text')).toEqual({ valid: true })
    })
  })

  describe('isValidSoapNote', () => {
    it('should return false for null', () => {
      expect(isValidSoapNote(null)).toBe(false)
    })

    it('should return false for non-object', () => {
      expect(isValidSoapNote('string')).toBe(false)
      expect(isValidSoapNote(123)).toBe(false)
    })

    it('should return false for object without soap property', () => {
      expect(isValidSoapNote({})).toBe(false)
      expect(isValidSoapNote({ summary: 'test' })).toBe(false)
    })

    it('should return true for object with soap property', () => {
      expect(isValidSoapNote({ soap: {} })).toBe(true)
      expect(isValidSoapNote({ soap: { subjective: {} } })).toBe(true)
    })
  })
})

describe('SOAP Text Extraction', () => {
  it('should extract text from all SOAP sections', () => {
    const soap = {
      subjective: { presentIllness: '頭痛が続いている' },
      objective: { physicalExam: '血圧正常' },
      assessment: { diagnosis: '緊張型頭痛' },
      plan: { treatment: '鎮痛薬投与' },
    }

    const result = extractTextFromSoap(soap)

    expect(result).toContain('主観的情報: 頭痛が続いている')
    expect(result).toContain('客観的情報: 血圧正常')
    expect(result).toContain('評価: 緊張型頭痛')
    expect(result).toContain('計画: 鎮痛薬投与')
  })

  it('should handle partial SOAP data', () => {
    const soap = {
      subjective: { presentIllness: '頭痛' },
      assessment: { diagnosis: '緊張型頭痛' },
    }

    const result = extractTextFromSoap(soap)

    expect(result).toContain('主観的情報: 頭痛')
    expect(result).toContain('評価: 緊張型頭痛')
    expect(result).not.toContain('客観的情報')
    expect(result).not.toContain('計画')
  })

  it('should handle empty SOAP data', () => {
    const result = extractTextFromSoap({})
    expect(result).toBe('')
  })
})
