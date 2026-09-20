# タグ承認サイクル実演 — ① 昇格前（門1で落ちる）

記録日時: 2026-09-21 01:20 JST ごろ

## 状況

- タグ「エージェント設計」（id=21）は過去の記録係Aの実行で自然発生した候補タグで、
  昇格前は `status = 'candidate'`。
- `docs/evidence/samples/gate-demo-transcript.txt` は「エージェント設計」について
  詳しい人（桜庭芽衣）と興味を持つ人（早坂悠人）が話す短いデモ文字起こし。
- これを記録係A（`scripts/recorder.mjs`）に `--dry` で読ませる。
  `--dry` はDBには書かないが、LLM抽出と🚪門1の判定はそのまま実行される
  （形だけでなく実際の判定結果を確認できる）。

## コマンド

```
node scripts/recorder.mjs docs/evidence/samples/gate-demo-transcript.txt --dry
```

## 結果（そのまま貼り付け）

```
📄 docs/evidence/samples/gate-demo-transcript.txt
   280文字 → 1個の塊に分割

🧠 抽出中...
  塊1: z-ai/glm-5.3-flash / $0.00039

   カード候補 2件 / 興味 1件 / アンコール 0回
   ここまでの費用 $0.000390

   辞書: 正式11件 / 全44件
🚪 門1の結果
   通った 0件 / 落ちた 2件
   ✕ エージェント設計 — まだ候補（candidate）
   ✕ エージェント設計 — まだ候補（candidate）

🧪 --dry なのでDBには書きません

{
  "passed": [],
  "dropped": [
    { "tag": "エージェント設計", "why": "まだ候補（candidate）" },
    { "tag": "エージェント設計", "why": "まだ候補（candidate）" }
  ],
  "interests": [
    { "tag": "エージェント設計", "person": "早坂悠人" }
  ],
  "encore": 0
}
```

## 読み方

LLMは「エージェント設計」を知見カードのタグとして正しく2回抽出できているが、
まだ辞書上 `candidate`（＝管理者が未承認）のため 🚪門1（形の検査ではなく「まだ候補」判定）で
**2件とも落ちている**。DESIGN.md §8-8 のとおり「AIが `official` にしない」がここで機能している。

→ 続き: `docs/evidence/20260921-tag-gate-after.md`（同じタグを昇格させたあと同じ文字起こしを流す）
