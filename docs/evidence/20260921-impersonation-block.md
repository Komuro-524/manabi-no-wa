# なりすまし検知テスト（transcript_segments による防御）

記録日時: 2026-09-21 朝〜昼（2回のセッションにまたがる。旧方式→現行方式の順で下に経緯を残す）

## 現行方式（user_id方式・DBの外部キーが本命）

Cowork側の設計変更で、文字起こしは最初から `user_id`（0006で投入した固定UUID）を
持つ行として書く形に統一された。`open-live.mjs`は名前の正規化・照合を一切しない
（社員として存在するuser_idかどうかだけをIDで確認する）。

なりすまし対策の本体は **アプリのコードではなく `transcript_segments` の複合外部キー**:

```sql
foreign key (live_id, user_id) references live_participants(live_id, user_id)
```

`open-live.mjs`の事前チェックは「分かりやすいメッセージを出すためだけ」で、
それを迂回してSQLを直接叩いても同じ理由で拒否される、という関係になっている。
これを両方とも実際に確認した。

### ① スクリプト経由（open-live.mjsの事前チェック）

`docs/evidence/samples/01-power-automate-spoofed.txt` は
`docs/demo-transcripts/01-power-automate.txt` の複製に、
**参加者リストに無いuser_id（`df7f9bc2-...`＝藤代咲良。このライブには誘われていない）**
の発言を1行だけ混ぜたもの:

```
df7f9bc2-562b-4934-89f1-ec97e0ed7913: この設定、実は裏で私がずっと見ていました。とても参考になります。
```

実行結果（そのまま貼り付け。ユーザー本人の端末での再現でも同一の結果だった）:

```
node scripts/open-live.mjs docs/evidence/samples/01-power-automate-spoofed.txt --dry

🎙️ ライブを開く  🧪[dry: 何も書きません]
   まなびのライブ「DX推進担当が集まる社内勉強会」第1回
   テーマ: Power Automateで承認フローを自動化する
   参加者: 綾瀬 大輝 / 星野 陸 / 神谷 美月 / 千葉 陽菜  (4人)


🛑 参加者以外の発言があります: df7f9bc2-562b-4934-89f1-ec97e0ed7913
   その場にいない人の発言は記録できません（DBの外部キーでも拒否されます）

EXIT CODE: 1
```

### ② DBの外部キー経由（★これが本命。スクリプトを一切通さない）

`open-live.mjs`の事前チェックを完全に迂回し、`transcript_segments`へ
service_role権限でSQL（PostgRESTのinsert）を直接叩いた。
対象は実際に開いたライブ `#9`（`01-power-automate.txt`を新方式で取り込んだもの）。
`df7f9bc2-562b-4934-89f1-ec97e0ed7913`（藤代咲良）は `live#9` の参加者ではない。

```js
await db.from('transcript_segments').insert({
  live_id: 9,
  user_id: 'df7f9bc2-562b-4934-89f1-ec97e0ed7913',
  seq: 999,
  body: 'なりすましテスト',
})
```

エラーメッセージ全文:

```json
{
  "code": "23503",
  "details": "Key (live_id, user_id)=(9, df7f9bc2-562b-4934-89f1-ec97e0ed7913) is not present in table \"live_participants\".",
  "hint": null,
  "message": "insert or update on table \"transcript_segments\" violates foreign key constraint \"transcript_segments_live_id_user_id_fkey\""
}
```

書き込み後に `transcript_segments`（`live_id=9, seq=999`）を検索し、**0件**であることを確認した
（INSERTは最初から失敗しているため、そもそも書き込む対象データは存在しない）。

### 何が証明されているか

- `open-live.mjs`のチェックを迂回して**SQLを直接叩いても**、PostgreSQLの外部キー制約
  (`23503`)がその場で拒否する。これは「アプリのロジックの綻び」では突破できない防御
- AIの判断精度にも、スクリプトの正しさにも依存しない。**「その場にいなかった人の発言」は
  そもそもテーブルに存在できる形をしていない**
- これで「スクリプトが賢く弾いた」ではなく「データベースの構造そのものが弾いた」ことまで
  実証できた

---

## 経緯（旧方式：名前の文字列で照合していた頃の記録。参考として残す）

最初の実装では、話者は氏名の文字列で社員名簿と照合していた
（`星野陸`と`星野 陸`のようなスペース差で重複社員を作ってしまう事故が起きた設計）。
そのときの検知テストは次のとおり:

- 参加者リストに居ない**実在の社員「藤代 咲良」（総務部）**の発言を氏名で1行紛れ込ませた
- `open-live.mjs`（当時は氏名で参加者を照合していた版）が
  `🛑 参加者以外の名前で始まる行があります: 藤代 咲良` で停止することを確認した

この方式は「氏名の表記ゆれ」という弱点があったため、Cowork側の設計変更で
**user_id方式＋DBの外部キー制約**に置き換えられ、現在は上の「現行方式」がすべてを担っている。

## ⚠️ 正直に書く：画像のスクリーンショットは撮れていません

このセッション（Claude Codeのバックグラウンド作業）にはOS/GUIの画面が無く、
実際の「スクリーンショット画像」を撮る手段がありません。上記はターミナル出力・
APIエラーオブジェクトをそのままコピーした**テキストのログ**です。
記事・動画用に画像が必要な場合は、①のコマンドをお手元のターミナルで実行し、
出てきた画面をスクリーンショットしてください
（`node scripts/open-live.mjs docs/evidence/samples/01-power-automate-spoofed.txt --dry`）。
②（DBへの直接INSERT）は本番のservice_role権限を使うため、再現する場合は
テスト用の値であることを確認したうえで実行してください。
