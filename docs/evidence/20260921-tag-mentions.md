# 0009_tag_mentions 適用と格上げ判定の期間区切り確認

記録日時: 2026-09-21 昼

## 【1】0009適用

```
supabase/migrations/0009_tag_mentions.sql を適用

RLS有効=1 / ポリシー=0 / 参加者への外部キー=1 / 埋め戻し件数=6
```

期待どおり。埋め戻し件数6件は、適用時点の`knowledge_cards`総数（6件）と一致した
（`live_participants`に居ない話者名義のカードは無かったため、全件そのまま埋め戻された）。

## 【2】【3】`--dry`で「格上げの条件」の行を確認 → **出力されなかった**

```
node scripts/recorder.mjs --live 12 --dry
TAG_PROPOSE_MIN_SPEAKERS=1 node scripts/recorder.mjs --live 12 --dry
```

両方とも、期待していた `格上げの条件: 直近30日に 延べ3回 または 2人以上`
（環境変数を変えた場合は `... または 1人以上`）の行が**出力されなかった**。

出力されたのはここまで:
```
   辞書: 正式12 / 格上げ候補0 / 候補36 / 全55件
🚪 門1の結果
   貼る 8件（🌱候補 4 / 🌱新しい候補 2 / ✅正式 2） / 落ちた 0件
...
🧪 --dry なのでDBには書きません
```

### 原因（コードを読んで特定）

`scripts/recorder.mjs` の `if (DRY_RUN) { ...; process.exit(0) }` が
（門1の結果を表示した直後、およそ302〜307行目）、
「格上げの条件」を表示する6.5節（`tag_mentions`を数えて`proposed`にする処理。
およそ373〜409行目）より**前**にある。`--dry`は必ずこの`process.exit(0)`で
終了するため、6.5節そのものに到達できず、条件の行を出す余地が無い。

`docs/QUESTIONS.md`に詳細と修正候補（A: ログ出力位置を早める／B: 別の一覧ツールに分ける）を記録した。
`scripts/recorder.mjs`はCowork側が継続して触っているファイルのため、こちらでは修正していない。

## 【4】evidence

`npm run evidence -- --label tag-mentions`:

| テーブル | 件数 |
|---|---|
| transcript_segments | 39（新規） |
| tag_mentions | 6（新規・埋め戻し分と一致） |
| agent_runs | 16（前回と同じ。`--dry`のみなので書き込みなし） |
| tags status: proposed | 0（変化なし） |

## 【5】後片付け

`.tmp_mentions/` を削除済み。
