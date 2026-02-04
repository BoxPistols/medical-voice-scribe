import { describe, it, expect } from 'vitest'
import { generateRecommendations, MAX_RECOMMENDATIONS } from './generateRecommendations'
import type { SoapNote } from '@/app/api/analyze/types'

// テスト用のモックSOAPノート
const createMockSoapNote = (overrides?: Partial<SoapNote>): SoapNote => ({
  soap: {
    subjective: {
      presentIllness: "頭痛が3日前から続いている",
      symptoms: ["頭痛"],
      severity: "中程度",
      onset: "3日前",
      associatedSymptoms: [],
      pastMedicalHistory: "特になし",
      medications: [],
    },
    objective: {
      vitalSigns: {
        bloodPressure: "120/80",
        pulse: "72",
        temperature: "36.5",
        respiratoryRate: "16",
      },
      physicalExam: "特記事項なし",
      laboratoryFindings: "",
    },
    assessment: {
      diagnosis: "緊張型頭痛",
      icd10: "G44.2",
      differentialDiagnosis: [],
      clinicalImpression: "経過観察",
    },
    plan: {
      treatment: "鎮痛剤処方",
      medications: [],
      tests: [],
      referral: "",
      followUp: "",
      patientEducation: "",
    },
  },
  summary: "頭痛の患者",
  patientInfo: {
    chiefComplaint: "頭痛",
    duration: "3日間",
  },
  ...overrides,
})

describe('generateRecommendations', () => {
  it('nullのSOAPノートの場合は空配列を返す', () => {
    const result = generateRecommendations(null)
    expect(result).toEqual([])
  })

  it('soapがundefinedの場合は空配列を返す', () => {
    const result = generateRecommendations({ soap: undefined } as SoapNote)
    expect(result).toEqual([])
  })

  it('鑑別診断がある場合は推奨を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.assessment.differentialDiagnosis = ['片頭痛', '緊張型頭痛', '群発頭痛']

    const result = generateRecommendations(soapNote)

    const differentialRec = result.find(r => r.id === 'differential-check')
    expect(differentialRec).toBeDefined()
    expect(differentialRec?.priority).toBe('high')
    expect(differentialRec?.type).toBe('differential')
  })

  it('重症度に「重」が含まれる場合は警告を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.subjective.severity = '重度'

    const result = generateRecommendations(soapNote)

    const severityWarning = result.find(r => r.id === 'severity-warning')
    expect(severityWarning).toBeDefined()
    expect(severityWarning?.priority).toBe('high')
    expect(severityWarning?.type).toBe('warning')
  })

  it('重症度に「強」が含まれる場合は警告を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.subjective.severity = '強い痛み'

    const result = generateRecommendations(soapNote)

    const severityWarning = result.find(r => r.id === 'severity-warning')
    expect(severityWarning).toBeDefined()
  })

  it('検査提案がある場合は推奨を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.plan.tests = ['血液検査', 'CT', 'MRI']

    const result = generateRecommendations(soapNote)

    const testsRec = result.find(r => r.id === 'tests-suggested')
    expect(testsRec).toBeDefined()
    expect(testsRec?.priority).toBe('medium')
    expect(testsRec?.description).toContain('血液検査')
  })

  it('フォローアップがある場合は推奨を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.plan.followUp = '1週間後に再診'

    const result = generateRecommendations(soapNote)

    const followupRec = result.find(r => r.id === 'followup-reminder')
    expect(followupRec).toBeDefined()
    expect(followupRec?.description).toContain('1週間後に再診')
  })

  it('患者教育がある場合は推奨を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.plan.patientEducation = '安静にしてください'

    const result = generateRecommendations(soapNote)

    const educationRec = result.find(r => r.id === 'patient-education')
    expect(educationRec).toBeDefined()
    expect(educationRec?.priority).toBe('low')
  })

  it('新規処方薬と既存薬がある場合は相互作用の警告を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.plan.medications = [{ name: 'ロキソニン', dosage: '60mg', frequency: '1日3回' }]
    soapNote.soap.subjective.medications = ['アスピリン', 'ワーファリン']

    const result = generateRecommendations(soapNote)

    const drugInteractionRec = result.find(r => r.id === 'drug-interaction')
    expect(drugInteractionRec).toBeDefined()
    expect(drugInteractionRec?.priority).toBe('high')
    expect(drugInteractionRec?.description).toContain('アスピリン')
  })

  it('随伴症状が3つ以上ある場合は包括的評価の推奨を生成する', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.subjective.associatedSymptoms = ['吐き気', '光過敏', '音過敏']

    const result = generateRecommendations(soapNote)

    const associatedRec = result.find(r => r.id === 'associated-symptoms')
    expect(associatedRec).toBeDefined()
    expect(associatedRec?.description).toContain('3つの随伴症状')
  })

  it('随伴症状が2つ以下の場合は包括的評価の推奨を生成しない', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.subjective.associatedSymptoms = ['吐き気', '光過敏']

    const result = generateRecommendations(soapNote)

    const associatedRec = result.find(r => r.id === 'associated-symptoms')
    expect(associatedRec).toBeUndefined()
  })

  it('推奨は優先度順にソートされる', () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.assessment.differentialDiagnosis = ['片頭痛'] // high
    soapNote.soap.plan.tests = ['血液検査'] // medium
    soapNote.soap.plan.patientEducation = '説明' // low

    const result = generateRecommendations(soapNote)

    // highが最初に来ることを確認
    expect(result[0].priority).toBe('high')
  })

  it(`最大${MAX_RECOMMENDATIONS}件の推奨を返す`, () => {
    const soapNote = createMockSoapNote()
    soapNote.soap.assessment.differentialDiagnosis = ['診断1', '診断2']
    soapNote.soap.subjective.severity = '重度'
    soapNote.soap.plan.tests = ['検査1']
    soapNote.soap.plan.followUp = 'フォロー'
    soapNote.soap.plan.patientEducation = '教育'
    soapNote.soap.plan.medications = [{ name: '薬', dosage: '1', frequency: '1' }]
    soapNote.soap.subjective.medications = ['既存薬']
    soapNote.soap.subjective.associatedSymptoms = ['症状1', '症状2', '症状3']

    const result = generateRecommendations(soapNote)

    expect(result.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS)
  })
})
