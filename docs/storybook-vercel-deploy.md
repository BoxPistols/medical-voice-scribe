# Storybook を Vercel にデプロイする手順

同一リポジトリから Next.js アプリと Storybook を別々の Vercel プロジェクトとしてデプロイする構成。
リポジトリの追加やコード構造の変更は不要。

## 構成

| プロジェクト | ビルドコマンド | 出力先 | URL |
|---|---|---|---|
| medical-voice-scribe | `next build` | `.next` | https://medical-voice-scribe.vercel.app |
| medical-voice-scribe-docs | `npm run build-storybook` | `storybook-static` | https://medical-voice-scribe-docs.vercel.app |

## セットアップ手順

### 1. Vercel CLI でプロジェクト作成

```bash
# プロジェクト作成
vercel project add medical-voice-scribe-docs

# ローカルディレクトリとリンク
vercel link --project medical-voice-scribe-docs --yes
```

### 2. ビルド設定を API 経由で適用

```bash
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")

curl -s -X PATCH "https://api.vercel.com/v9/projects/<PROJECT_ID>?teamId=<TEAM_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buildCommand": "npm run build-storybook",
    "outputDirectory": "storybook-static",
    "framework": null,
    "installCommand": "npm install"
  }'
```

`PROJECT_ID` と `TEAM_ID` は `.vercel/project.json` から取得できる。

### 3. デプロイ

```bash
vercel deploy --prod
```

### 4. GitHub 自動デプロイの接続（ダッシュボード）

CLI では Git 接続の API が制限されているため、ダッシュボードで行う。

1. https://vercel.com/ でプロジェクト設定を開く
2. **Settings > Git** に移動
3. **Connected Git Repository** で同じリポジトリを接続

接続後は main への push で自動デプロイされる。

## ローカル確認

```bash
# Storybook 開発サーバー
npm run storybook

# 静的ビルド確認
npm run build-storybook
npx serve storybook-static
```

## 注意事項

- `.vercel/` はリンク先プロジェクトの情報を保持する。Next.js 側に戻す場合は `vercel link --project medical-voice-scribe --yes` で切り替える
- `storybook-static/` は `.gitignore` に含まれているため、リポジトリへの影響はない
