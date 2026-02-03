# AI Medical Scribe - 医療書記自動生成システム

リアルタイム音声認識とAIによるSOAPカルテ自動生成を実現する、医療従事者向けプロトタイプアプリケーション

## 目次

- [概要](#概要)
- [主要機能](#主要機能)
- [技術スタック](#技術スタック)
- [システムアーキテクチャ](#システムアーキテクチャ)
- [セットアップ](#セットアップ)
- [使い方](#使い方)
- [API設計](#api設計)
- [データフロー](#データフロー)
- [プロンプトエンジニアリング](#プロンプトエンジニアリング)
- [UI/UXデザイン](#uiuxデザイン)
- [今後の拡張可能性](#今後の拡張可能性)
- [注意事項](#注意事項)

## 概要

本システムは、医師と患者の会話をリアルタイムで音声認識し、AIが自動的にSOAP形式（Subjective, Objective, Assessment, Plan）の電子カルテを生成するWebアプリケーションです。

### 開発背景

医療現場では、診察後のカルテ記入作業が医師の大きな負担となっています。本システムは、この作業を自動化し、医師が診察に集中できる環境を提供することを目的としています。

### 開発期間

2-3時間で実装可能なMVP（Minimum Viable Product）として設計されています。

## 主要機能

### 1. リアルタイム音声認識

- **Web Speech API**を使用したブラウザネイティブな音声認識
- 連続認識モード対応
- 日本語（ja-JP）完全対応
- マイク許可管理

### 2. AI駆動のSOAPカルテ生成

OpenAI GPT-4o-miniを使用した、以下の情報を含む詳細な医療記録の自動生成：

#### 患者情報
- 主訴（Chief Complaint）
- 症状期間

#### S（Subjective - 主観的情報）
- 現病歴の詳細
- 症状リスト
- 重症度評価
- 発症様式
- 随伴症状
- 既往歴
- 現在服用中の薬剤

#### O（Objective - 客観的情報）
- バイタルサイン（血圧、脈拍、体温、呼吸数）
- 身体所見
- 検査所見

#### A（Assessment - 評価・診断）
- 診断名（日本語）
- ICD-10コード（国際疾病分類）
- 鑑別診断リスト
- 臨床的評価

#### P（Plan - 治療計画）
- 治療方針
- 処方薬詳細（薬剤名、用量、用法、期間）
- 追加検査項目
- 専門医への紹介
- フォローアップ計画
- 患者指導内容

### 3. カルテ音声読み上げ機能

生成されたSOAPカルテを音声で確認できる、Text-to-Speech（TTS）機能を搭載：

- **Web Speech Synthesis API**を使用したブラウザネイティブな音声合成
- 日本語音声による自然な読み上げ
- 読み上げ速度の調整機能（0.5x / 0.75x / 1.0x / 1.25x / 1.5x）
- 複数の日本語音声から選択可能
- SOAP全項目の構造化された読み上げ
  - 要約 → 患者情報 → S（主観的情報）→ O（客観的情報）→ A（評価・診断）→ P（治療計画）
- 処方内容の詳細読み上げ（薬剤名、用量、用法、期間）
- 再生/停止コントロール

#### 音声読み上げの利点
- 手が離せない状況でのカルテ確認
- 視覚的な確認と聴覚的な確認による二重チェック
- 長文カルテの内容把握がより容易に
- アクセシビリティ向上（視覚障害のあるユーザー支援）

### 4. モダンなUI/UX

- レスポンシブデザイン（PC/タブレット/スマートフォン対応）
- リアルタイムステータス表示
- 2カラムレイアウト（入力 | 出力）
- PC版：リサイズ可能な分割ビュー、レイアウトプリセット機能
- モバイル版：アコーディオン形式の切り替え
- アクセシビリティ対応（ARIA属性、セマンティックHTML）

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 16.1.6 | Reactフレームワーク（App Router使用） |
| React | 19.2.3 | UIライブラリ |
| TypeScript | 5.x | 型安全性の確保 |
| Tailwind CSS | 4.x | ユーティリティファーストCSS |
| DM Sans | - | UI用サンセリフフォント |
| JetBrains Mono | - | コード・データ表示用モノスペースフォント |

### バックエンド

| 技術 | 用途 |
|------|------|
| Next.js API Routes | サーバーサイドAPI |
| OpenAI API | GPT-4o-miniによるテキスト生成 |

### ブラウザAPI

| 技術 | 用途 |
|------|------|
| Web Speech API (Recognition) | ブラウザネイティブ音声認識（音声→テキスト） |
| Web Speech API (Synthesis) | ブラウザネイティブ音声合成（テキスト→音声） |

### 開発ツール

| ツール | 用途 |
|--------|------|
| ESLint | コード品質チェック |
| PostCSS | CSS処理 |
| Git | バージョン管理 |

## システムアーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │            React Component (page.tsx)             │  │
│  │                                                   │  │
│  │  ┌────────────┐          ┌──────────────────┐   │  │
│  │  │ Web Speech │          │  User Interface  │   │  │
│  │  │    API     │─────────▶│  - Input Panel   │   │  │
│  │  │ (ja-JP)    │          │  - Output Panel  │   │  │
│  │  └────────────┘          │  - Controls      │   │  │
│  │                          └──────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
│                            │                            │
│                            │ HTTP POST                  │
│                            ▼                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │     Next.js API Route (/api/analyze)             │  │
│  │  - リクエスト検証                                  │  │
│  │  - プロンプト構築                                  │  │
│  │  - OpenAI API呼び出し                             │  │
│  └───────────────────────────────────────────────────┘  │
│                            │                            │
└────────────────────────────┼────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   OpenAI API    │
                    │   GPT-4o-mini   │
                    │  JSON Response  │
                    └─────────────────┘
```

### ディレクトリ構造

```
medical-scribe-demo/
├── src/
│   └── app/
│       ├── api/
│       │   └── analyze/
│       │       ├── route.ts          # OpenAI API統合
│       │       ├── prompt.ts         # システムプロンプト定義
│       │       └── types.ts          # TypeScript型定義
│       ├── globals.css               # グローバルスタイル
│       ├── layout.tsx                # ルートレイアウト
│       └── page.tsx                  # メインページ（音声認識・読み上げ・UI）
├── .env.local                        # 環境変数（APIキー）
├── package.json                      # 依存関係
└── README.md                         # このファイル
```

## セットアップ

### 前提条件

- Node.js 18.x 以上
- npm または yarn
- OpenAI APIキー
- Chromeまたは最新のブラウザ（Web Speech API対応）

### インストール手順

1. リポジトリをクローン

```bash
git clone https://github.com/BoxPistols/medical-scribe-demo.git
cd medical-scribe-demo
```

2. 依存関係をインストール

```bash
npm install
```

3. 環境変数を設定

プロジェクトルートに `.env.local` ファイルを作成：

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

OpenAI APIキーは [OpenAI Platform](https://platform.openai.com/) で取得できます。

4. 開発サーバーを起動

```bash
npm run dev
```

5. ブラウザでアクセス

```
http://localhost:3000
```

## 使い方

### 基本的な操作フロー

1. **録音開始**
   - 「録音」ボタンをクリック
   - ブラウザがマイクへのアクセス許可を要求（初回のみ）
   - 録音中は「録音中」ステータスが表示される

2. **会話の入力**
   - 音声で会話を入力
   - または、テキストエリアに直接入力も可能

3. **SOAPカルテ生成**
   - 「カルテ生成」ボタンをクリック
   - AIが会話を解析（5-15秒程度）
   - 右パネルに詳細なSOAPカルテが表示される

4. **カルテの音声読み上げ（オプション）**
   - カルテパネル右上の「読み上げ」ボタンをクリック
   - SOAP全項目が日本語音声で読み上げられる
   - 読み上げ中は「停止」ボタンで中断可能
   - **速度調整**: 0.5倍速〜1.5倍速まで選択可能
   - **音声選択**: 利用可能な日本語音声から選択可能（ブラウザ・OSに依存）
   - 手が離せない状況や、聴覚的な確認をしたい場合に便利

5. **結果の確認**
   - 要約、患者情報、SOAP各セクションを確認
   - バイタルサイン、処方内容などの詳細情報を閲覧

6. **クリア**
   - 「クリア」ボタンで全データをリセット

### サンプル会話文

以下のような会話を入力してテストできます：

```
医師: 今日はどうされましたか？
患者: 2週間くらい前から頭痛がひどくて、特に朝起きたときに痛みます。ズキズキする感じです。
医師: 他に症状はありますか？
患者: 少しめまいと吐き気があります。あと最近疲れやすいです。
医師: 既往歴はありますか？何か薬を飲んでいますか？
患者: 高血圧で5年前からアムロジピンを飲んでいます。
医師: では診察しますね。血圧を測りましょう。
患者: はい。
医師: 血圧は145/95、少し高めですね。体温は36.8度、脈拍は78です。目を見せてください。瞳孔は正常ですね。
医師: 頭のCTは必要ないと思いますが、念のため血液検査をしましょう。処方箋を出しますね。
患者: ありがとうございます。
医師: ロキソプロフェン60mgを1日3回、食後に7日分出します。あとアムロジピンは継続してください。1週間後にまた来てください。
```

## API設計

### エンドポイント

#### POST /api/analyze

会話テキストを受け取り、SOAP形式のカルテを生成します。

**リクエスト**

```typescript
{
  text: string  // 会話テキスト（必須）
}
```

**レスポンス（成功時）**

```typescript
{
  summary: string,
  patientInfo: {
    chiefComplaint: string,
    duration: string
  },
  soap: {
    subjective: {
      presentIllness: string,
      symptoms: string[],
      severity: string,
      onset: string,
      associatedSymptoms: string[],
      pastMedicalHistory: string,
      medications: string[]
    },
    objective: {
      vitalSigns: {
        bloodPressure: string,
        pulse: string,
        temperature: string,
        respiratoryRate: string
      },
      physicalExam: string,
      laboratoryFindings: string
    },
    assessment: {
      diagnosis: string,
      icd10: string,
      differentialDiagnosis: string[],
      clinicalImpression: string
    },
    plan: {
      treatment: string,
      medications: Array<{
        name: string,
        dosage: string,
        frequency: string,
        duration: string
      }>,
      tests: string[],
      referral: string,
      followUp: string,
      patientEducation: string
    }
  }
}
```

**レスポンス（エラー時）**

```typescript
{
  error: string  // エラーメッセージ
}
```

### APIの内部処理

1. **入力検証**
   - テキストの存在確認
   - 空文字列のチェック

2. **プロンプト構築**
   - システムプロンプトの設定
   - 医療記録専門家としての指示
   - JSON出力形式の指定

3. **OpenAI API呼び出し**
   - モデル: `gpt-4o-mini`
   - レスポンス形式: `json_object`
   - 温度: デフォルト値（0.7-1.0）

4. **レスポンス処理**
   - JSON パース
   - エラーハンドリング
   - クライアントへの返却

## データフロー

### 1. 音声入力フロー

```
User Speech
    ↓
Web Speech API (Browser)
    ↓
Recognition Event
    ↓
State Update (React)
    ↓
Transcript Display
```

### 2. AI解析フロー

```
User Click "Generate"
    ↓
Fetch API Call
    ↓
Next.js API Route (/api/analyze)
    ↓
System Prompt + User Text
    ↓
OpenAI API (GPT-4o-mini)
    ↓
JSON Response
    ↓
Validation & Error Handling
    ↓
State Update (React)
    ↓
SOAP Display with Structured Data
```

### 3. 音声読み上げフロー

```
User Click "Read Aloud"
    ↓
Extract Text from SOAP Note
    ↓
Format for Natural Speech
  - 要約 → 患者情報 → S → O → A → P
  - 区切り文字、読点の最適化
    ↓
Create SpeechSynthesisUtterance
  - Language: ja-JP
  - Rate: 0.5x ~ 1.5x (User Setting)
  - Voice: Selected Japanese Voice
    ↓
Web Speech Synthesis API (Browser)
    ↓
Audio Output (Speaker/Headphone)
```

**制御機能:**
- 再生中: 停止ボタンで即座に中断
- 速度調整: リアルタイムで変更可能
- 音声選択: ブラウザ対応の日本語音声から選択

## プロンプトエンジニアリング

### システムプロンプトの設計思想

本システムの核心は、OpenAI APIに送信するプロンプトの品質にあります。以下の戦略で医療記録の質を最大化しています。

#### 1. ロール設定

```
あなたは経験豊富な医療記録専門家です。
```

明確なロールを設定することで、AIの出力品質を向上させています。

#### 2. 詳細な出力構造の指定

JSONスキーマを明示的に指定し、以下を実現：

- 構造化されたデータ出力
- フィールドの一貫性
- クライアント側の処理簡略化

#### 3. 医学的妥当性の指示

```
会話から推測できる情報を最大限に活用し、臨床的に妥当な詳細を補完してください
```

限られた会話情報から、臨床的に矛盾のない記録を生成するよう指示しています。

#### 4. 専門用語の使用

```
医学用語を適切に使用し、実際の診療記録としての完成度を高めてください
```

実際の医療現場で使用される表現を優先させています。

#### 5. 不確実性の明示

```
不明な情報は「記載なし」と明記してください
```

推測と事実を明確に区別し、医療安全を確保しています。

## UI/UXデザイン

### デザインコンセプト

**"Clinical Professionalism meets Modern Web"**

医療現場の信頼性と、モダンWebアプリケーションの使いやすさを両立しています。

### カラーパレット

```css
/* ベースカラー - 清潔感のあるクリニカルパレット */
--bg-primary: #fafbfc;      /* 背景 */
--bg-secondary: #ffffff;     /* パネル */

/* アクセントカラー - ティール（医療的で落ち着いた印象） */
--accent-primary: #14b8a6;   /* プライマリアクション */
--accent-warm: #f59e0b;      /* 録音ボタン */

/* SOAPカラー - 視覚的識別性 */
--soap-s: #ef4444;  /* 主観的情報（赤） */
--soap-o: #3b82f6;  /* 客観的情報（青） */
--soap-a: #10b981;  /* 評価（緑） */
--soap-p: #8b5cf6;  /* 計画（紫） */
```

### タイポグラフィ

| 用途 | フォント | 特徴 |
|------|---------|------|
| UI全般 | DM Sans | 可読性が高く、モダンな印象 |
| データ表示 | JetBrains Mono | 等幅で、医療データの視認性向上 |

### レスポンシブブレークポイント

```css
/* モバイル */
@media (max-width: 640px)

/* タブレット */
@media (max-width: 1024px)

/* デスクトップ */
@media (min-width: 1024px)
```

### アクセシビリティ

- セマンティックHTML（`<header>`, `<main>`, `<section>`）
- ARIA属性（`aria-label`, `aria-pressed`）
- キーボードナビゲーション対応
- フォーカス表示
- カラーコントラスト比（WCAG AA準拠）

## 今後の拡張可能性

### Phase 1: 機能強化（短期）

- ✅ **完了**: カルテ音声読み上げ機能（速度調整、音声選択）
- **計画中** ([Issue #2](https://github.com/BoxPistols/medical-scribe-demo/issues/2)): データエクスポート/インポート機能
  - JSON形式エクスポート/インポート
  - CSV形式エクスポート（Excel対応）
  - PDF形式エクスポート
- カルテのコピー機能（クリップボード）
- 履歴機能（LocalStorage/IndexedDB）
- 音声認識精度の表示
- 複数言語対応（英語、中国語）

### Phase 2: データ統合（中期）

- ICD-10 API統合（NIH Clinical Tables）
- RxNorm API統合（標準薬剤名称）
- FHIR形式でのデータエクスポート
- 電子カルテシステムとの連携

### Phase 3: AI機能拡張（中期）

- GPT-4による高精度解析
- ファインチューニングモデルの導入
- 医療画像解析統合
- リアルタイムAI提案機能

### Phase 4: エンタープライズ機能（長期）

- ユーザー認証・権限管理
- 患者データベース統合
- 監査ログ機能
- HIPAA/GDPR準拠のセキュリティ
- マルチテナント対応
- クラウドバックアップ

### 技術的な拡張

- WebSocket によるリアルタイム通信
- PWA 対応（オフライン機能）
- E2Eテスト（Playwright/Cypress）
- パフォーマンス最適化
- CDN統合

## 注意事項

### 重要な制限事項

1. **デモンストレーション用途のみ**
   - 本システムは概念実証（PoC）として開発されています
   - 実際の臨床現場での使用は想定していません

2. **医療機器ではありません**
   - 薬機法（医薬品医療機器等法）の適用外です
   - 診断や治療の根拠として使用しないでください

3. **AI生成内容の不確実性**
   - GPT-4o-miniの出力は100%正確ではありません
   - 必ず医師による確認・修正が必要です
   - 幻覚（Hallucination）により事実と異なる内容が生成される可能性があります

4. **プライバシーとセキュリティ**
   - 実際の患者情報は入力しないでください
   - OpenAI APIに送信されたデータは30日間保存されます
   - 医療機関で使用する場合は、適切なデータ保護対策が必要です

5. **ブラウザ互換性**
   - Web Speech APIはChrome/Edgeで最適に動作します
   - SafariおよびFirefoxでは機能が制限される場合があります

### コスト

OpenAI APIの使用料金が発生します：

- **GPT-4o-mini**: $0.150 / 1M input tokens, $0.600 / 1M output tokens
- 1回の解析あたり約$0.001-0.005（会話の長さによる）

### 法的考慮事項

- **個人情報保護法**: 実際の患者情報を扱う場合は適用対象
- **医療法**: 医療広告規制に注意
- **利用規約**: OpenAI利用規約の遵守が必要

## ライセンス

MIT License

## 作成者

開発期間: 2-3時間
技術スタック: Next.js 14, TypeScript, OpenAI API, Web Speech API

## 参考資料

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Next.js Documentation](https://nextjs.org/docs)
- [SOAP Note Format](https://en.wikipedia.org/wiki/SOAP_note)
- [ICD-10 - WHO](https://www.who.int/standards/classifications/classification-of-diseases)
