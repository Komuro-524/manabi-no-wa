# F8: 途中で止まったライブのやり直しを、人に返す

記録日時: 2026-09-21 昼過ぎ

## やったこと

1. `docs/evidence/samples/f8-crash-test.txt` をライブ#20として開いた
2. service_roleで`lives.ingest_status`を強制的に`running`にし、
   「取り込みの途中でプロセスが落ちた」状態を再現した
3. `node scripts/recorder.mjs --live 20` を実行

## 結果

```
🛑 ライブ #20 は前回 途中で止まっていました（ingest_status=running）
   前回の取り込みが途中で止まった（ingest_status=running のまま開始された）。二重書き込みを避けるためやり直さず人に返す

exit code: 1
```

**LLMを一切呼んでいない**（「🧠 抽出中...」が出ていない＝費用$0）。

## DBの確認

```
lives#20:        ingest_status = 'needs_review'
agent_runs(最新): status='failed', error/note に理由が入っている, cost_usd=null（呼んでいないため）
knowledge_cards(live#20): 0件（二重書き込みが起きていない）
```

## 確認できたこと

- `recorder.mjs`は、開始時点で`ingest_status='running'`（＝前回が完了せず終わった痕跡）を見つけたら、
  **やり直さず即座に`needs_review`で止まる**
- LLMを呼ぶ前に判定しているため、途中まで進んでいたかもしれない知見カードに
  重ねて書いてしまう事故（二重生成）が起きない
- `agent_runs`に理由（前回が途中で止まった旨）が残るので、管理者は
  「なぜneeds_reviewになったか」を`needs_review`の他のケース（渡していない行番号を指した等）と
  区別して追える
