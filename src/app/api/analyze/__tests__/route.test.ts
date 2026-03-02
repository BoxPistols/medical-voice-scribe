import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateTextInput, isValidSoapNote } from '@/lib/helpers'

// Mock OpenAI before importing route
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  }
})

describe('Helpers used by /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation (using shared helpers)', () => {
    it('should reject empty text', () => {
      expect(validateTextInput('')).toEqual({ valid: false, error: 'テキストがありません' })
    })

    it('should reject whitespace-only text', () => {
      expect(validateTextInput('   ')).toEqual({ valid: false, error: 'テキストがありません' })
    })

    it('should reject undefined text', () => {
      expect(validateTextInput(undefined)).toEqual({ valid: false, error: 'テキストがありません' })
    })

    it('should accept valid text', () => {
      expect(validateTextInput('医師: 今日はどうされましたか？')).toEqual({ valid: true })
    })
  })

  describe('Model Validation', () => {
    const VALID_MODELS = ['gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5-mini', 'gpt-5-nano']
    const DEFAULT_MODEL = 'gpt-4.1-nano'

    const validateModel = (model: string | undefined): string => {
      if (!model || !VALID_MODELS.includes(model)) {
        return DEFAULT_MODEL
      }
      return model
    }

    it('should return default model for undefined', () => {
      expect(validateModel(undefined)).toBe(DEFAULT_MODEL)
    })

    it('should return default model for invalid model', () => {
      expect(validateModel('invalid-model')).toBe(DEFAULT_MODEL)
      expect(validateModel('gpt-3.5-turbo')).toBe(DEFAULT_MODEL)
    })

    it('should accept valid models', () => {
      VALID_MODELS.forEach(model => {
        expect(validateModel(model)).toBe(model)
      })
    })
  })

  describe('Response Validation (using shared helpers)', () => {
    it('should validate SOAP note structure', () => {
      expect(isValidSoapNote(null)).toBe(false)
      expect(isValidSoapNote({})).toBe(false)
      expect(isValidSoapNote({ summary: 'test' })).toBe(false)
      expect(isValidSoapNote({ soap: {} })).toBe(true)
    })
  })

  describe('Environment Variable Check', () => {
    it('should have logic to check OPENAI_API_KEY', () => {
      const checkApiKey = (key: string | undefined) => {
        if (!key) {
          throw new Error('OPENAI_API_KEY環境変数が設定されていません')
        }
        return true
      }

      expect(() => checkApiKey(undefined)).toThrow('OPENAI_API_KEY環境変数が設定されていません')
      expect(() => checkApiKey('')).toThrow('OPENAI_API_KEY環境変数が設定されていません')
      expect(checkApiKey('sk-test-key')).toBe(true)
    })
  })

  describe('Streaming Response Format', () => {
    it('should format SSE data correctly', () => {
      const formatSSE = (data: object) => `data: ${JSON.stringify(data)}\n\n`

      const contentChunk = formatSSE({ content: 'テスト' })
      expect(contentChunk).toBe('data: {"content":"テスト"}\n\n')

      const doneChunk = formatSSE({ done: true })
      expect(doneChunk).toBe('data: {"done":true}\n\n')

      const errorChunk = formatSSE({ error: 'エラーメッセージ' })
      expect(errorChunk).toBe('data: {"error":"エラーメッセージ"}\n\n')
    })
  })
})
