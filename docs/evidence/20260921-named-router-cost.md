# Named Router 切り替えによる費用比較（orcarouter/auto → orcarouter/manabi-recorder）

記録日時: 2026-09-21 昼

タグ付けエージェントA（`scripts/recorder.mjs`）が使うモデル指定を
`orcarouter/auto`（候補は全モデル）から `orcarouter/manabi-recorder`
（Named Router。フロンティア級には上がらない候補だけで構成）へ切り替えた前後で、
**同じ3本のデモトランスクリプトを同じ内容のまま**再実行し、費用と選ばれたモデルを比較した。

## before（`orcarouter/auto` 時代。旧live#6〜#8。今回削除済み）

| ライブ | テーマ | 塊1のモデル | 費用 |
|---|---|---|---|
| #6 | Power Automate | deepseek/deepseek-v4-flash-vision-exp | $0.003028 |
| #7 | SQL | deepseek/deepseek-v4-pro-0813 | $0.025784 |
| #8 | 議事録の書き方 | deepseek/deepseek-v4-flash-vision-exp | $0.008642 |
| **合計** | | | **$0.037454** |

## after（`orcarouter/manabi-recorder` 時代。新live#9〜#11）

| ライブ | テーマ | 塊1のモデル（--dry） | 費用（--dry） | 塊1のモデル（本番） | 費用（本番） |
|---|---|---|---|---|---|
| #9 | Power Automate | openai/gpt-oss-120b | $0.000302 | openai/gpt-oss-120b | $0.000336 |
| #10 | SQL | openai/gpt-oss-120b | $0.000224 | openai/gpt-oss-120b | $0.000252 |
| #11 | 議事録の書き方 | openai/gpt-oss-120b | $0.000242 | openai/gpt-oss-120b | $0.000262 |
| **合計（本番のみ）** | | | | | **$0.000850** |

## 比較

| | 合計費用 | 選ばれたモデルの傾向 |
|---|---|---|
| before（auto） | $0.037454 | 都度違う（deepseek系。1回は高価な `-pro` 系にまで上がった） |
| after（manabi-recorder） | $0.000850 | **毎回同じ `openai/gpt-oss-120b`（安定）** |
| 削減率 | **約97.7%削減**（44倍） | ルーターの候補を絞ったことで、たまたま高価なモデルに化けるブレが無くなった |

## 副作用として見つかったこと（正直に書く）

`manabi-recorder`ルーターに切り替えたことで**選ばれるモデルが変わった結果**、
タグの書き方の癖も変わった。今回、3本とも既存の正式タグ名と完全一致せず、
🚪門1で知見カードの多くが「辞書に無い候補」として落ちた:

| ライブ | LLMが書いたタグ | 辞書の正式名 | 結果 |
|---|---|---|---|
| #9 | `PowerAutomate`（スペース無し） | `Power Automate` | 不一致で落ちる |
| #10 | `SQL最適化` / `インデックス` | `SQL` | 不一致で落ちる（`SQL`単体は書かれなかった） |
| #11 | `議事録` | `議事録の書き方` | 不一致で落ちる |

以前の`auto`実行（live#6〜#8）ではタグ名が辞書と一致していたため、
**費用だけを見て「安いモデルの方が良い」と即断するのは危険**という発見でもある。
コストと抽出品質はトレードオフになり得るため、辞書と一致しやすいモデルを
Named Routerの候補に優先的に入れる、あるいは🚪門1に「かな読みが近い正式タグへの
自動吸着」（DESIGN.md §5 門1の検査3で言及されている「空似」判定）を実装するかの
どちらかの対応が要る。`docs/QUESTIONS.md`に記録する。
