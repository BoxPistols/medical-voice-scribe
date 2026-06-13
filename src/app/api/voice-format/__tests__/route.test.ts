import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../../analyze/types'

// OpenAI モック — new OpenAI() に対応するためクラスで定義
const mockCreate = vi.fn()
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } }
    },
  }
})

// テスト用ヘルパー: Request オブジェクト生成
function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/voice-format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// OpenAI レスポンスのファクトリー
function makeOpenAIResponse(content: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  return {
    choices: [{ message: { content } }],
    usage: usage ?? { prompt_tokens: 100, completion_tokens: 50 },
  }
}

describe('/api/voice-format', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'sk-test-key'
  })

  // ---- 入力バリデーション ----

  describe('入力バリデーション', () => {
    it('text が空文字の場合 400 を返す', async () => {
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: '', mode: 'organize' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('テキストがありません')
    })

    it('text が空白のみの場合 400 を返す', async () => {
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: '   ', mode: 'organize' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('テキストがありません')
    })

    it('text が未指定の場合 400 を返す', async () => {
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ mode: 'organize' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('テキストがありません')
    })

    it('text が文字列でない場合 400 を返す', async () => {
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 123, mode: 'organize' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('テキストがありません')
    })

    it('mode が未指定の場合 400 を返す', async () => {
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('modeは organize または summarize')
    })

    it('mode が無効な値の場合 400 を返す', async () => {
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'invalid' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('modeは organize または summarize')
    })
  })

  // ---- モデル選択 ----

  describe('モデル選択', () => {
    it('有効なモデルが指定された場合そのモデルを使用する', async () => {
      const targetModel = AVAILABLE_MODELS[1].id
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ formatted: 'テスト', changes: [] }))
      )
      const { POST } = await import('../route')
      await POST(makeRequest({ text: 'テスト', mode: 'organize', model: targetModel }))
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: targetModel })
      )
    })

    it('無効なモデルの場合デフォルトモデルを使用する', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ formatted: 'テスト', changes: [] }))
      )
      const { POST } = await import('../route')
      await POST(makeRequest({ text: 'テスト', mode: 'organize', model: 'invalid-model' }))
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: DEFAULT_MODEL })
      )
    })

    it('モデル未指定の場合デフォルトモデルを使用する', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ formatted: 'テスト', changes: [] }))
      )
      const { POST } = await import('../route')
      await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: DEFAULT_MODEL })
      )
    })
  })

  // ---- 整理モード (organize) ----

  describe('整理モード', () => {
    it('正常な整理結果を返す', async () => {
      const organizeResult = { formatted: '整理されたテキスト', changes: ['句読点追加', 'フィラー除去'] }
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify(organizeResult), { prompt_tokens: 200, completion_tokens: 100 })
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'えーとテスト', mode: 'organize' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.result).toEqual(organizeResult)
      expect(data.tokenUsage).toBeDefined()
      expect(data.tokenUsage.totalTokens).toBe(300)
      expect(data.tokenUsage.estimatedCostJPY).toBeGreaterThan(0)
    })

    it('formatted が欠けている場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ changes: ['変更'] }))
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toContain('formatted/changes')
    })

    it('changes が配列でない場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ formatted: 'テスト', changes: '文字列' }))
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toContain('formatted/changes')
    })
  })

  // ---- 要約モード (summarize) ----

  describe('要約モード', () => {
    it('正常な要約結果を返す', async () => {
      const summarizeResult = {
        summary: '概要テスト',
        keyPoints: ['要点1', '要点2'],
        actionItems: ['アクション1'],
        keywords: ['キーワード1'],
      }
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify(summarizeResult))
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト文章', mode: 'summarize' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.result).toEqual(summarizeResult)
    })

    it('summary が欠けている場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ keyPoints: [], actionItems: [], keywords: [] }))
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'summarize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toContain('summary/keyPoints/actionItems/keywords')
    })

    it('keyPoints が欠けている場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ summary: '概要', actionItems: [], keywords: [] }))
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'summarize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toContain('summary/keyPoints/actionItems/keywords')
    })

    it('actionItems が配列でない場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ summary: '概要', keyPoints: [], actionItems: 'not-array', keywords: [] }))
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'summarize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toContain('summary/keyPoints/actionItems/keywords')
    })
  })

  // ---- エラーハンドリング ----

  describe('エラーハンドリング', () => {
    it('OPENAI_API_KEY 未設定の場合エラーを返す', async () => {
      delete process.env.OPENAI_API_KEY
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toContain('OPENAI_API_KEY')
    })

    it('AI からの応答が空の場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }], usage: null })
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('AIからの応答がありませんでした')
    })

    it('AI が不正な JSON を返した場合 500 を返す', async () => {
      mockCreate.mockResolvedValueOnce(makeOpenAIResponse('これはJSONではありません'))
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('AIの応答を解析できませんでした')
    })

    it('OpenAI API がエラーを投げた場合 500 を返す', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'))
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Rate limit exceeded')
    })
  })

  // ---- トークンコスト計算 ----

  describe('トークンコスト計算', () => {
    it('usage がない場合 tokenUsage が null になる', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ formatted: 'テスト', changes: [] }) } }],
        usage: null,
      })
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.tokenUsage).toBeNull()
    })

    it('コストが正しく計算される（JPY = USD × 150）', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(
          JSON.stringify({ formatted: 'テスト', changes: [] }),
          { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }
        )
      )
      const { POST } = await import('../route')
      const res = await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      const data = await res.json()

      // デフォルトモデル gpt-5.4-nano: input $0.05/1M, output $0.20/1M
      const expectedUSD = 0.05 + 0.20
      expect(data.tokenUsage.estimatedCostUSD).toBeCloseTo(expectedUSD, 4)
      expect(data.tokenUsage.estimatedCostJPY).toBeCloseTo(expectedUSD * 150, 2)
    })
  })

  // ---- プロンプト選択 ----

  describe('プロンプト選択', () => {
    it('organize モードでシステムプロンプトに「整理」が含まれる', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ formatted: 'テスト', changes: [] }))
      )
      const { POST } = await import('../route')
      await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      const callArgs = mockCreate.mock.calls[0][0]
      const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('整理')
    })

    it('summarize モードでシステムプロンプトに「要約」が含まれる', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ summary: '概要', keyPoints: [], actionItems: [], keywords: [] }))
      )
      const { POST } = await import('../route')
      await POST(makeRequest({ text: 'テスト', mode: 'summarize' }))
      const callArgs = mockCreate.mock.calls[0][0]
      const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('要約')
    })

    it('response_format に json_object が指定される', async () => {
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(JSON.stringify({ formatted: 'テスト', changes: [] }))
      )
      const { POST } = await import('../route')
      await POST(makeRequest({ text: 'テスト', mode: 'organize' }))
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.response_format).toEqual({ type: 'json_object' })
    })
  })
})
