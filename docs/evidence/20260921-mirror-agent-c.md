# 🔍 エージェントC（自己分析係）実演記録

> 🖼️ **本物のスクリーンショットでの検証は `docs/evidence/20260921-mirror-real-shots.md` にある。**
> このファイルはダミー画像（1x1ピクセル）で配線だけを確認した記録で、抽出精度の検証はしていない。

> ⚠️ **この記録は旧実装のもの（2026-09-21 未明）。** 当時は候補タグを「まだ候補」として捨てていた。
> 9/20 会議の決定どおりに直した現在は、**候補のタグでもカードと `user_tags` を作り**、承認の効果は
> 「**正式タグとして全員に見えるようになる**（過去に語った人にも遡って付く）」こと。→ `DESIGN.md` §5.4


記録日時: 2026-09-21 01:4x JST ごろ

## スコープ

DESIGN.md §3.4 のうち、**サーバー側の処理だけ**を実装した。

- ❌ `getDisplayMedia` での画面共有開始・終了時刻の宣言・数分おきの静止画取得・前フレームとの重複除去
  → これは相方が担当するブラウザ側UIなので今回は作っていない
- ✅ 「同意のうえで集め終わった静止画をまとめて受け取り、タグ候補を出して门1を通し、
     本人にしか見えない `user_tags`（`visibility='private'`, `source='self'`）に書く」
  → `scripts/mirror.mjs` として実装した

## テストした内容と、テストできなかった内容

実際のスクリーンショット（相方のUIが無いと作れない）が無いため、
1x1ピクセルの最小PNGを2枚使って**配線（プラン全体）**を検証した。
「タグ候補の抽出精度」自体はダミー画像では検証できない
（→ `docs/QUESTIONS.md` に暫定として記録した）。

### ① --dry での実行

```
node scripts/mirror.mjs --user 226578cf-8980-4829-806c-d3510fee6238 --dry test1.png test2.png

🔍 自己分析: 星野 陸
   受け取った静止画: 2枚（このプロセスの外には一切保存しません）

🧠 まとめて1回だけ解析中...
   z-ai/glm-5.3-flash / $0.000116
   候補 0件

🚪 門1の結果
   通った 0件 / 落ちた 0件

🧪 --dry なのでDBには書きません
```

真っ白に近い画像からは何も無理に絞り出さず、`candidates: []` を返した。
これは `lib/agents/prompts/mirror.md` の「無理に絞り出さないこと」の指示が
効いている証拠でもある（幻覚で適当なタグを作らなかった）。

### ② 実書き込みでの実行

```
node scripts/mirror.mjs --user 226578cf-8980-4829-806c-d3510fee6238 test1.png test2.png

✅ 書き込み完了
   本人だけに見える知見タグ 0件（visibility=private, source=self）
   費用 $0.000064
```

`npm run evidence -- --label mirror-run` で `self_analysis_sessions` が `0 → 1` に
増えたことを確認した（セッションの記録自体は候補0件でも必ず残る）。

## 🚪門1・書き込みルールについて

`scripts/mirror.mjs` の門1（形の検査・辞書照合・candidate登録）は
`scripts/recorder.mjs` と全く同じロジックで実装している。
その実際の合否判定（`まだ候補` で落ちる／`official` なら通る）は
`docs/evidence/20260921-tag-gate-before.md` / `-after.md` で
recorder側を使ってすでに実演済みのため、ここでは重複させていない。

C固有で確認できたこと:

- 通ったタグは必ず `kind='knowledge'`, `source='self'`, `visibility='private'` で書く
  （コードで固定。LLMの出力では上書きできない）
- 画像はメモリ上でBase64化してAPIに渡すだけで、ファイルにもDBにも一切コピーしていない
  （`scripts/mirror.mjs` を読めば、画像を書き出す処理が無いことが確認できる）
- 「採用」ボタン（`visibility: private → public`）は新しいテーブルを作らず、
  `0002_rls.sql` で既にある `set_tag_visibility()`（本人しか自分の行を動かせない security definer 関数）
  をそのまま使う設計にした。C側では何も追加していない
