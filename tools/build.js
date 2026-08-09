/* =====================================================================
 *  やさいのつくりかた — ページ生成スクリプト
 *
 *  実行:  node tools/build.js   （リポジトリのどこからでも可）
 *
 *  生成するもの:
 *    ・index.html / start.html / ch01〜ch11.html / zukan.html /
 *      view.html / terms.html   … 全16ページ
 *    ・assets/src/*.src.js       … 18本のサンプルをビューア用に複製
 *                                  （.gitignore 済み。再生成はこれで行う）
 *
 *  【注意】上記のファイルは毎回まるごと上書きされます。
 *          HTML を直接手で編集しても、次にこれを走らせると消えます。
 *          文章を直すときは、このスクリプトの中の該当箇所を直してください。
 *
 *  入力:
 *    ・assets/_index_original.bak.html … 01〜07章の本文の出典。消さないこと
 *    ・リポジトリ直下の *.js（18本）    … ビューア用の複製元
 *
 *  手書きで管理しているもの（このスクリプトは触りません）:
 *    ・assets/site.css / assets/labs.js / assets/havok-lab.js
 * ===================================================================== */
/* index.html（1枚もの）を複数ページに組み替えるビルドスクリプト */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "assets/_index_original.bak.html"), "utf8");

/* ---------- 元ファイルから <section class="chapter" id="X"> を取り出す ---------- */
function grabSection(id) {
  const open = SRC.indexOf('<section class="chapter" id="' + id + '"');
  if (open < 0) throw new Error("section not found: " + id);
  const close = SRC.indexOf("</section>", open);
  if (close < 0) throw new Error("close not found: " + id);
  return SRC.slice(open, close + "</section>".length);
}

/* body の先頭に「3行まとめ」、末尾に「やってみよう」を差し込む */
function inject(sec, recap, tryBox) {
  if (recap) {
    sec = sec.replace(/<div class="body"[^>]*>/, (m) => m + "\n" + recap);
  }
  if (tryBox) {
    const i = sec.lastIndexOf("</div>");
    sec = sec.slice(0, i) + tryBox + "\n  " + sec.slice(i);
  }
  return sec;
}

function recapBox(items) {
  return (
    '    <div class="recap">\n' +
    '      <span class="label">この章の3行まとめ</span>\n' +
    "      <ul>\n" +
    items.map((s) => "        <li>" + s + "</li>").join("\n") +
    "\n      </ul>\n    </div>\n"
  );
}

function tryBox(items) {
  return (
    '\n    <div class="try">\n' +
    '      <span class="label">やってみよう</span>\n' +
    "      <ol>\n" +
    items.map((s) => "        <li>" + s + "</li>").join("\n") +
    "\n      </ol>\n    </div>\n"
  );
}

/* ---------- ページ定義 ---------- */
const P = {
  leaf: "var(--p-leaf)", potato: "var(--p-potato)", suika: "var(--p-suika)",
  carrot: "var(--p-carrot)", tomato: "var(--p-tomato)", melon: "var(--p-melon)",
  nasu: "var(--p-nasu)", okra: "var(--p-okra)", corn: "var(--p-corn)",
  onion: "var(--p-onion)"
};

const pages = [];

/* ---- 00 まず動かしてみる（新規） ---- */
pages.push({
  file: "start.html",
  no: "00",
  tag: "START",
  color: P.leaf,
  title: "まず動かしてみる",
  sub: "Babylon.js Playground に貼って実行する",
  crumb: "はじめに",
  html: `<section class="chapter" id="start" style="--ch:${P.leaf}">
  <div class="chapter-head">
    <div class="chnum">00<small>START</small></div>
    <div>
      <h2>まず動かしてみる</h2>
      <p class="sub">読む前に、動かす。5分で終わります</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "この18本は、<b>ブラウザだけ</b>で動きます。インストールは何も要りません。",
    "Babylon.js Playground という公式サイトに、ファイルの中身を<b>まるごと貼って実行</b>するだけです。",
    "先に動かして、数字をひとつ壊してみる。<b>説明を読むのはそのあと</b>のほうが、ずっと早く分かります。"
  ])}
    <p>
      このプロジェクトの .js ファイルは、ふつうの Web ページに読み込んで使うものではありません。
      <b>Babylon.js Playground</b>（バビロン・ジェイエス・プレイグラウンド）という、
      ブラウザの中で3Dのプログラムを書いて即座に実行できる公式サイトのための形になっています。
    </p>

    <ol class="steps">
      <li>
        <h3>Playground を開く</h3>
        <p><a href="https://playground.babylonjs.com/" target="_blank" rel="noopener">playground.babylonjs.com</a>
        をブラウザで開きます。左が入力欄、右が3Dの画面です。
        パソコンのほうがやりやすいですが、スマホでも動きます。</p>
      </li>
      <li>
        <h3>もとから入っているコードを全部消す</h3>
        <p>左側をクリックして、<code>Ctrl</code>+<code>A</code>（Mac は <code>⌘</code>+<code>A</code>）で全選択 → <code>Delete</code>。
        まっさらにしてから貼るのがコツです。混ざると動きません。</p>
      </li>
      <li>
        <h3><b>ニンジン.js</b> の中身を全部コピーして貼る</h3>
        <p>最初の1本は <b>ニンジン.js</b> がおすすめです。18本のなかでいちばん構造が素直で、
        「円錐に溝を彫る」だけでできています。ファイルをテキストエディタで開き、
        全部コピーして、Playground の左側に貼り付けます。</p>
      </li>
      <li>
        <h3>実行する</h3>
        <p>上の <b>Run</b> ボタン（または <code>Alt</code>+<code>Enter</code>）。
        数秒待つと、ざるに人参が盛られていきます。
        右下にスライダーが出るので、動かしてみてください。</p>
        <div class="trap">
          <span class="label">うまくいかないとき</span>
          <p><b>真っ黒のまま／エラーが出る</b> — 貼り付けたときに古いコードが残っていないか確認してください。
          また、物理エンジン（Havok）の読み込みに数秒かかります。少し待ってみてください。</p>
          <p><b>動きがカクカクする</b> — 3Dの計算をパソコンが全部やっています。
          ブラウザの他のタブを閉じると軽くなります。</p>
        </div>
      </li>
      <li>
        <h3>数字をひとつ、わざと壊す</h3>
        <p>ファイルの上のほうにある <code>PRESETS</code> の中から <code>radius: 2.05</code> を探して、
        <code>radius: 6.0</code> に書き換えて Run。ぶっとい人参が出てきます。
        <b>どの数字が何に効くかは、壊すといちばん早く分かります。</b>
        壊しても保存されないので、いくらでも試して大丈夫です。</p>
      </li>
    </ol>

    <h3>18本のうち、どれから読むか</h3>
    <ul>
      <li><b>ニンジン.js</b> — いちばん素直。円錐 + 溝。まずこれ。</li>
      <li><b>キュウリ.js</b> — 稜（縦のすじ）とイボ。テクスチャの作りが分かりやすい。</li>
      <li><b>トマト.js</b> — 肩が折り返す形。ここから少し難しくなります。</li>
      <li><b>シイタケ.js / トウモロコシ.js</b> — 構造が複雑。慣れてから。</li>
    </ul>

    <div class="note">
      <b>プログラミングが初めてでも大丈夫。</b>
      この教材で使う数学は、<b>三角関数（sin・cos）</b>と<b>座標</b>と<b>比例</b>がほとんどです。
      高校1年までの内容で、9割は追えます。分からない言葉が出てきたら
      <a href="terms.html">用語集</a>を見てください。
    </div>
${tryBox([
    "ニンジン.js を Playground で動かして、スライダーを全部いじってみる。",
    "<code>length</code>（長さ）を <code>40</code> にして、ありえない人参を出す。",
    "ファイル内の <code>START_SEED = 20260726</code> を別の数字にして、形が変わることを確かめる（→ <a href=\"ch02.html\">02章</a>）。"
  ])}
  </div>
</section>`
});

/* ---- 01〜08 は既存の章を流用 ---- */
const legacy = [
  {
    id: "ch01", file: "ch01.html", no: "01", tag: "CONFIG", color: P.leaf,
    title: "「作る」と「読み込む」はどう違うのか", crumb: "第01章",
    recap: [
      "ふつうの3Dは、誰かが作った<b>モデルファイルを読み込んで</b>表示します。",
      "このプロジェクトは逆で、<b>実行した瞬間に座標を計算で作ります</b>。これを手続き的生成といいます。",
      "だから1個ずつ形が違い、あとから自由に変えられ、しかもデータが軽い。"
    ],
    try: [
      "ニンジン.js の先頭のコメント（構成 0〜9）を読んで、他のファイルにも同じ並びがあるか確かめる。",
      "手続き的生成のいいところ3つを、自分の言葉で1行ずつ書いてみる。",
      "身のまわりで「数式で説明できそうな形」を3つ探す（例：ソフトクリーム、ネジ、松ぼっくり）。"
    ]
  },
  {
    id: "ch02", file: "ch02.html", no: "02", tag: "Rng", color: P.potato,
    title: "同じ種からは、同じ野菜が生える", crumb: "第02章",
    recap: [
      "野菜を1個ずつ違う形にするには乱数が要りますが、<code>Math.random()</code> は使いません。",
      "<b>やり直しがきかない</b>からです。いい形が出ても、二度と同じものは作れません。",
      "そこで「種（シード）」を渡すと<b>いつも同じ順番</b>で数字が出る乱数を、自分で作ります。"
    ],
    try: [
      "同じシードを2回入れて、まったく同じ形が出ることを確かめる。",
      "気に入った形が出たシードの数字を、メモしておく。これが「保存」になります。",
      "ニンジン.js の <code>START_SEED</code>（175行目あたり）を自分の誕生日（例 20260801）にして実行する。"
    ]
  },
  {
    id: "ch03", file: "ch03.html", no: "03", tag: "Noise", color: P.suika,
    title: "でこぼこを、なめらかな乱数で作る", crumb: "第03章",
    recap: [
      "乱数をそのまま並べると<b>砂嵐</b>になります。となりと何の関係もない値だからです。",
      "自然の模様は「近いところは似ていて、遠いところは違う」。これを作るのが<b>ノイズ</b>です。",
      "細かさを半分ずつにして<b>重ねる</b>（fBm）と、遠目にはムラ、近くではざらつきが出ます。"
    ],
    try: [
      "「重ねる回数」を1のまま、細かさだけ最大にしてみる。素材に見えないことを確かめる。",
      "回数を4にして、細かさを6に戻す。どちらが自然に見えるか比べる。",
      "スイカのパレットで、縞に見える設定を自分で探す。"
    ]
  },
  {
    id: "ch04", file: "ch04.html", no: "04", tag: "Profile", color: P.carrot,
    title: "横顔を1本描けば、立体になる", crumb: "第04章",
    recap: [
      "野菜の形は、<b>たった1本の折れ線</b>（横顔＝プロファイル）から作られています。",
      "それを軸のまわりに1周させると立体になります。ろくろと同じ、数学でいう<b>回転体</b>です。",
      "でこぼこ・稜・イボは、その半径 r を<b>角度と高さで少し増減させているだけ</b>です。"
    ],
    try: [
      "プリセットを「トマト」にして、点をドラッグしてナスに近づけてみる。",
      "稜の本数を6にして、トマトらしい房のふくらみを作る。",
      "自分の好きな野菜（大根・かぼちゃなど）の横顔を、紙に描いてから再現してみる。"
    ],
    // 「縦横比も横顔の一部」という話を、実験のすぐ下に足す
    patch: (sec) =>
      sec.replace(
        '<div class="trap">',
        `<div class="note">
      <b>縦横比も、横顔が決めている。</b>
      左の方眼は<b>タテとヨコが同じ目盛り</b>です。だから半径 r と高さは同じ単位で、
      この2つの比がそのまま「背が高い野菜か、平たい野菜か」になります。
      プリセットを切り替えると方眼に対する大きさが変わるのは、そのためです。
      トマトを縦長のまま作ると、どんなに色と質感を作り込んでも卵にしか見えません。
      <b>形の似ていなさは、たいてい縦横比のせい</b>です。
    </div>
    <div class="trap">`
      )
  },
  {
    id: "ch05", file: "ch05.html", no: "05", tag: "Mesh", color: P.tomato,
    title: "三角形の向きと、面の傾き", crumb: "第05章",
    recap: [
      "3Dの立体の正体は、<b>点の座標</b>と<b>点を三角形に結ぶ番号表</b>の2つだけです。",
      "三角形には表と裏があり（巻き順）、裏向きの面は初めから描かれません（背面カリング）。",
      "面の向き＝<b>法線</b>が明るさを決めます。平均してならすと、なめらかに見えます。"
    ],
    try: [
      "「巻き順をわざと逆にする」＋「裏面を描かない」で、トマトを消してみる。",
      "「法線をならす」を切って、カクカクになる様子を見る。分割数を8まで下げるとよく分かる。",
      "「法線の色」モードで、上を向いた面が何色になるか観察する（緑が強くなります）。"
    ]
  },
  {
    id: "ch06", file: "ch06.html", no: "06", tag: "Texture", color: P.melon,
    title: "模様も、その場で描く", crumb: "第06章",
    recap: [
      "立体に模様を貼るには「立体のどこが画像のどこか」の対応表が要ります。これが<b>UV</b>です。",
      "画像ファイルを持たないので、模様も <code>&lt;canvas&gt;</code> に<b>1ピクセルずつ計算で描き</b>ます。",
      "色（albedo）・光り方（ORM）・凹凸（normal）の<b>3枚</b>を、同じ元データから作ります。"
    ],
    try: [
      "「UVの格子を重ねて見る」を入れて、上下の極で格子が1点に集まることを確かめる。",
      "スイカの縞で「細かさ」を上げると、何本の縞になるか数える。",
      "きゅうりのイボを、強さ0にしてみる。イボが無いと何に見えるか。"
    ]
  },
  {
    id: "ch07", file: "ch07.html", no: "07", tag: "PBR", color: P.nasu,
    title: "「濡れている」「粉をふいている」を数値で言う", crumb: "第07章",
    recap: [
      "形と模様が合っていても、<b>光り方を外すとプラスチックの飾り</b>になります。",
      "いまの3Dは、材質を現実の光の振る舞いに沿った少数の数値で表します（PBR）。",
      "いちばん効くのは <b>roughness（粗さ）</b>。0で鏡、1で紙です。"
    ],
    try: [
      "粗さを0.05まで下げて、野菜が「置物」になる瞬間を見る。",
      "ナスのプリセットから、クリアコートだけを0にする。何に見えるか。",
      "オクラのプリセットで sheen を0にして、産毛の有無を比べる。"
    ]
  },
];

for (const L of legacy) {
  let sec = grabSection(L.id);
  if (L.patch) sec = L.patch(sec);
  pages.push({
    file: L.file, no: L.no, tag: L.tag, color: L.color, title: L.title,
    crumb: L.crumb,
    html: inject(sec, recapBox(L.recap), tryBox(L.try))
  });
}

/* ---- 08 物理（本物の Havok を動かす） ---- */
pages.push({
  file: "ch08.html", no: "08", tag: "Havok", color: P.okra,
  title: "盛り付けは、手で置かない", crumb: "第08章",
  scripts: ["assets/havok-lab.js"],
  html: `<section class="chapter" id="ch08" style="--ch:${P.okra}">
  <div class="chapter-head">
    <div class="chnum">08<small>Havok</small></div>
    <div>
      <h2>盛り付けは、手で置かない</h2>
      <p class="sub">physics engine — 物理エンジンで自然に積む</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "ざるに野菜を盛るとき、座標を手で決めると「並べました」という嘘くさい絵になります。",
    "そこで<b>物理エンジン</b>に落としてもらう。重力と摩擦と反発だけ与えて、あとは任せます。",
    "ただし全部いっぺんに出すと山にならないので、<b>0.26秒おきに1本ずつ</b>落とします。"
  ])}
    <p>
      ざるに野菜を8本盛る。座標を手で決めると、どうしても「並べました」という絵になります。
      重なり方に嘘があるからです。そこで<b>物理エンジンに落としてもらう</b>。
      重力と摩擦と反発だけ与えて、あとは転がるに任せます。Babylon.js では <b>Havok</b> を使います。
    </p>
    <p>
      ただし、全部いっぺんに出すとうまくいきません。生成した瞬間、
      野菜どうしが<b>互いにめり込んだ状態から始まる</b>からです。
      物理エンジンはそのめり込みを押しのけようとしますが、
      全員が同時に押し合うので行き場がなく、結果は<b>中央に押し固められた不自然な塊</b>になります
      （めり込んだまま噛み合って止まる個体も出ます）。
      物によっては器の外まで弾き出されます。
      だからサンプルは<b>0.26秒おきに1本ずつ</b>、山の頂点のすぐ上から落としています。
      1本ぶんのめり込みなら、次が来るまでに必ず解けるからです。
    </p>

    <h3>この実験だけは、本物の Havok が動きます</h3>
    <p>
      ほかの章の実験は、しくみが分かるように自前で書いた簡易版です。
      でもこの章の主役は物理エンジンそのものなので、下のデモは
      <b>Babylon.js と Havok を本当に読み込んで動かしています</b>。
      使っている API も数値も、18本のサンプルからそのまま持ってきたものです。
      そのぶんダウンロードが大きい（合計10MBほど）ので、ボタンを押すまで読み込みません。
    </p>
    <figure>
<pre><span class="k">const</span> havok = <span class="k">await</span> HavokPhysics();          <span class="c">// WASM の読み込みを待つ</span>
<span class="c">// 第1引数 false = 固定タイムステップ。true だとフレーム落ちのたびに
// ステップ幅が変わり、接触が解けたり深く食い込んだりを繰り返す</span>
<span class="k">const</span> hk = <span class="k">new</span> BABYLON.HavokPlugin(<span class="k">false</span>, havok);
scene.enablePhysics(<span class="k">new</span> V3(<span class="n">0</span>, -<span class="n">620</span>, <span class="n">0</span>), hk);   <span class="c">// 重力は cm/s^2</span>
hk.setTimeStep(<span class="n">1</span> / <span class="n">120</span>);</pre>
      <figcaption>ニンジン.js の物理初期化。下のデモもまったく同じ手順で動いている</figcaption>
    </figure>

    <div class="lab">
      <p class="lab-title">実験 — 本物の Havok で盛り付ける</p>
      <div class="lab-cols side">
        <div class="controls">
          <button class="btn" id="hkStart" type="button">3Dデモを読み込む（約10MB）</button>
          <div id="hkPanel" hidden>
            <div class="chips">
              <button class="chip" type="button" id="hkOne">1個ずつ落とす</button>
              <button class="chip" type="button" id="hkAll">全部いっぺんに出す</button>
              <button class="chip" type="button" id="hkReset">やり直す</button>
            </div>
            <div class="ctrl">
              <label for="hkFric">摩擦 <span class="v" id="hkFricV">0.88</span></label>
              <input type="range" id="hkFric" min="0" max="1" step="0.01" value="0.88">
            </div>
            <div class="ctrl">
              <label for="hkRest">反発 <span class="v" id="hkRestV">0.02</span></label>
              <input type="range" id="hkRest" min="0" max="0.8" step="0.01" value="0.02">
            </div>
            <div class="ctrl">
              <label for="hkGrav">重力 <span class="v" id="hkGravV">620 cm/s²</span></label>
              <input type="range" id="hkGrav" min="200" max="981" step="1" value="620">
            </div>
          </div>
          <div class="readout">
            状態：<b id="hkStatus">まだ読み込んでいません</b><br>
            落とした数：<b id="hkCount">0 / 8 個</b>
          </div>
          <p class="hint">摩擦と反発は、次に落とす1個からではなく<b>すでに転がっている野菜にも</b>その場で効きます。</p>
        </div>
        <div>
          <canvas id="hkCanvas" width="640" height="412" aria-label="Havok で野菜がざるに落ちる3Dデモ"></canvas>
          <p class="hint">ドラッグで視点を回せます。ホイールで寄り引き。</p>
        </div>
      </div>
    </div>

    <h3>器のような「へこんだ形」は、箱や球では代用できない</h3>
    <p>
      落ちてくる野菜のほうは、多少ざっくりでも構いません。実際サンプルも
      <b>凸包（とつほう）</b>——輪ゴムをかけたときの外形——で当たり判定を作っています。
      でもざるはそうはいきません。中がへこんでいるので、箱や球で近似すると
      野菜が中に入れず、フタの上に乗ってしまいます。
    </p>
    <p>
      そこでざるだけは<b>三角形メッシュそのもの</b>を当たり判定にします
      （<code>PhysicsShapeMesh</code>）。計算は重いのですが、ざるは動かないので許されます。
      <b>動くものは凸包、動かないものはメッシュ</b>。これは物理エンジン全般の定石です。
    </p>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p>物理エンジンは<b>メートル単位で作られています</b>。
      このプロジェクトはcm単位なので、そのまま実際の重力 <code>981</code> を入れると、
      1ステップあたりのめり込みが許容量を超えて押し戻され続け、野菜がプルプル震えます。
      デモの重力スライダーを最大まで上げると、実際に震えはじめます。
      サンプルでは重力を <code>620</code> まで落として回避しています。
      「正しい物理」より「破綻しない物理」を採る、という判断です。</p>
    </div>
${tryBox([
    "「1個ずつ落とす」で盛りつけたあと、「全部いっぺんに出す」を押して、山ではなく塊になることを見比べる。",
    "反発を0.5まで上げてから「やり直す」。実物の野菜は跳ねません。",
    "摩擦を0にすると、どんな盛り方になるか観察する。",
    "重力を981まで上げて、野菜が細かく震えはじめるところを探す。",
    "視点をドラッグして真横から見る。手で並べたのでは作れない重なり方になっているはず。"
  ])}
  </div>
</section>`
});

/* ---- 09 部品を組み合わせる（新規） ---- */
pages.push({
  file: "ch09.html", no: "09", tag: "Parts", color: P.corn,
  title: "部品を作って、組み合わせる", crumb: "第09章",
  html: `<section class="chapter" id="ch09" style="--ch:${P.corn}">
  <div class="chapter-head">
    <div class="chnum">09<small>Parts</small></div>
    <div>
      <h2>部品を作って、組み合わせる</h2>
      <p class="sub">instancing &amp; merging — 粒・ひだ・房</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "回転体（04章）は「1本の横顔を回す」ので、<b>粒やひだのような部品の集まりは作れません</b>。",
    "そこで部品を1個だけ作り、位置を変えて<b>何百個も並べ、最後にひとつに合体</b>させます。",
    "ブドウの房のように詰め込むものは、まず適当に置いて、<b>めり込みを押し返してほぐし</b>ます。"
  ])}
    <p>
      トウモロコシの粒、シイタケのひだ、ブドウの房。この3つは、これまでのやり方では作れません。
      どれも<b>同じような部品がたくさん集まってできている</b>からです。
      円柱にでこぼこ（ノイズ）を足しても、粒には見えません。トウモロコシ.js のコメントに
      「円柱に変位をかけるとゴルフボールになる」と書いてあるのはこの話です。
    </p>

    <h3>やり方は「1個作って、たくさん置いて、合体」</h3>
    <ol>
      <li>粒を<b>1個だけ</b>ちゃんと作る（形も法線もUVも）</li>
      <li>場所と向きと大きさを変えながら、<b>何百個ぶんの座標を並べる</b></li>
      <li>ぜんぶを<b>1つのメッシュに合体</b>する（マージ）</li>
    </ol>
    <p>
      3番目がなぜ要るのか。GPUに「これを描いて」と頼む回数を<b>ドローコール</b>といいます。
      粒が600個で600回頼むと、1回あたりの準備の手間だけで重くなります。
      合体して1回にまとめれば、頂点の数は同じでも一気に速くなります。
      形がぜんぶ同じで色だけ違う場合は、<b>インスタンス</b>という仕組みで
      「同じ形をここに600個置いて」と1回で頼むこともできます（ブドウ.js の粒はこの方式です）。
    </p>

    <h3>粒は、列ごとに半分ずらして噛み合わせる</h3>
    <p>
      とうもろこしの粒は、まっすぐな格子には並んでいません。
      縦の列をなしていて、<b>となりの列とは半ピッチずれて噛み合っています</b>。
      レンガの積み方と同じです。ずらさないと、たちまち作り物のビーズになります。
    </p>

    <div class="lab">
      <p class="lab-title">実験 — 粒を並べる（円柱を切り開いた展開図）</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="knCols">列の数 <span class="v" id="knColsV">16 列</span></label>
            <input type="range" id="knCols" min="6" max="26" step="1" value="16">
          </div>
          <div class="ctrl">
            <label for="knRows">段の数 <span class="v" id="knRowsV">11 段</span></label>
            <input type="range" id="knRows" min="5" max="20" step="1" value="11">
          </div>
          <div class="ctrl">
            <label for="knShift">となりの列とのずれ <span class="v" id="knShiftV">0.50</span></label>
            <input type="range" id="knShift" min="0" max="0.5" step="0.01" value="0.5">
          </div>
          <div class="ctrl">
            <label for="knSize">粒の大きさ <span class="v" id="knSizeV">1.00</span></label>
            <input type="range" id="knSize" min="0.7" max="1.25" step="0.01" value="1">
          </div>
          <div class="readout">
            粒の数：<b id="knCount">176 粒</b><br>
            見え方：<b id="knGap">ちょうど接している</b>
          </div>
          <p class="hint">ずれを0にすると、とたんに「工業製品」になります。0.5がとうもろこしです。</p>
        </div>
        <div>
          <canvas id="kernelCanvas" width="560" height="360" aria-label="とうもろこしの粒の並び方"></canvas>
        </div>
      </div>
    </div>

    <h3>房は「ばらまいてから、ほぐす」</h3>
    <p>
      ブドウの房は、格子では並びません。かといって完全にランダムに置くと、粒どうしがめり込みます。
      そこで<b>リラクゼーション</b>（緩和）という手を使います。
      考え方はとても単純で、
    </p>
    <ul>
      <li>まず、房の形のなかに<b>適当にばらまく</b></li>
      <li>めり込んでいる2粒を見つけたら、<b>めり込んだぶんの半分ずつ、互いに押し返す</b></li>
      <li>これを何回もくり返す</li>
    </ul>
    <p>
      押し返すだけなので、いつかは重ならなくなります。
      物理エンジン（08章）を使わずに、自然な詰まり方が作れる安上がりな方法です。
      ブドウ.js のコメントに「配置 → 重なり解消リラクゼーション → インスタンス化」とあるのが、まさにこれです。
    </p>

    <div class="lab">
      <p class="lab-title">実験 — 重なりをほぐす</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="pkCount">粒の数 <span class="v" id="pkCountV">38 粒</span></label>
            <input type="range" id="pkCount" min="15" max="60" step="1" value="38">
          </div>
          <div class="chips">
            <button class="chip" type="button" id="pkStep">1回ほぐす</button>
            <button class="chip" type="button" id="pkRun" aria-pressed="false">自動でほぐす</button>
            <button class="chip" type="button" id="pkReset">まきなおす</button>
          </div>
          <div class="readout">
            重なっている組：<b id="pkOverlap">— 組</b><br>
            ほぐした回数：<b id="pkIter">0 回</b>
          </div>
          <p class="hint">赤く縁取られた粒が、まだめり込んでいる粒です。0組になれば完成。</p>
        </div>
        <div>
          <canvas id="packCanvas" width="480" height="420" aria-label="ブドウの粒の重なりをほぐすデモ"></canvas>
        </div>
      </div>
    </div>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p>シイタケの<b>ひだ</b>を、模様（テクスチャの縞）で済ませてはいけません。
      ざるに盛れば必ず何本かは裏返って、ひだが正面に来ます。
      そのとき縞で描いたひだは「線を引いた円盤」になり、一発で嘘だとわかります。
      シイタケ.js は、ひだを<b>実体のメッシュとして1枚ずつ立てて</b>います。
      「正面から見ると同じに見えるが、別の角度で崩れる」——これが手抜きの見つかり方です。</p>
    </div>
${tryBox([
    "列のずれを0にして、とうもろこしに見えなくなることを確かめる。",
    "粒の大きさを0.8にする。すき間が空くと何に見えるか。",
    "粒の数を60にして「自動でほぐす」。何回で0組になるか数える。",
    "粒の数を60、房を狭くしたつもりで想像する。ほぐしても0にならない場合、何が足りないか考える。"
  ])}
  </div>
</section>`
});

/* ---- 10 曲がった軸（新規） ---- */
pages.push({
  file: "ch10.html", no: "10", tag: "Spine", color: P.potato,
  title: "曲がったものを作る", crumb: "第10章",
  html: `<section class="chapter" id="ch10" style="--ch:${P.potato}">
  <div class="chapter-head">
    <div class="chnum">10<small>Spine</small></div>
    <div>
      <h2>曲がったものを作る</h2>
      <p class="sub">sweep along a spine — 軸に沿った掃引</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "回転体（04章）は<b>まっすぐな軸</b>しか作れません。バナナもきゅうりも、実物は曲がっています。",
    "そこで先に<b>軸（スパイン）そのものを曲げた線として決め</b>、その各点に断面を置いていきます。",
    "断面は必ず<b>軸に垂直</b>に置くこと。水平に置くと、曲がった内側でつぶれます。"
  ])}
    <p>
      04章の回転体は、まっすぐな棒のまわりに横顔を回して作りました。
      でもバナナは曲がっています。きゅうりも少し曲がっています。ゴーヤも。
      まっすぐ作ってから全体を曲げる、という手もありますが、それだと断面がゆがみます。
    </p>
    <p>
      正しいやり方は逆で、<b>先に軸を決める</b>。
      バナナ.js のコメントに「Spine … 軸。果柄と果実で曲率の向きが逆になる」とあります。
      軸は3D空間のなかの1本の曲線で、それを何十個かの点に分けます。
      そして各点で、<b>その点での進行方向に垂直な平面</b>のうえに断面（円や多角形）を置く。
      あとは、となりの断面どうしを四角形でつなげば立体になります。
    </p>

    <figure>
<pre><span class="c">// 軸のうえの点 S(t) と、そこでの向き（接線）を求める</span>
<span class="k">const</span> S = spine(t);            <span class="c">// 軸の位置</span>
<span class="k">const</span> T = tangent(t);          <span class="c">// 進む向き（接線）</span>
<span class="k">const</span> N = perpendicular(T);    <span class="c">// T に垂直な向き（2本）</span>
<span class="k">const</span> B = cross(T, N);

<span class="c">// 断面の点を、その平面のうえに置く</span>
p = S + N * (r * Math.cos(a)) + B * (r * Math.sin(a));</pre>
      <figcaption>掃引の中心にある3行。N と B が「断面を置く平面」を決めている</figcaption>
    </figure>

    <div class="lab">
      <p class="lab-title">実験 — 軸を曲げる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="spPreset">
            <button class="chip" type="button" data-v="banana" aria-pressed="true">バナナ</button>
            <button class="chip" type="button" data-v="kyuri">キュウリ</button>
            <button class="chip" type="button" data-v="goya">ゴーヤ</button>
          </div>
          <div class="ctrl">
            <label for="spBend">曲がりの強さ <span class="v" id="spBendV">0.85</span></label>
            <input type="range" id="spBend" min="0" max="1.6" step="0.01" value="0.85">
          </div>
          <div class="ctrl">
            <label for="spRidge">断面の稜（りょう）の数 <span class="v" id="spRidgeV">5 本</span></label>
            <input type="range" id="spRidge" min="0" max="10" step="1" value="5">
          </div>
          <div class="ctrl">
            <label for="spTwist">ねじれ <span class="v" id="spTwistV">0.00</span></label>
            <input type="range" id="spTwist" min="0" max="1.5" step="0.01" value="0">
          </div>
          <label class="switch"><input type="checkbox" id="spShowSpine" checked>軸（スパイン）を赤線で表示</label>
          <p class="hint">稜を0にすると断面が円になり、とたんに「曲がったソーセージ」になります。バナナは5稜。</p>
        </div>
        <div>
          <canvas id="spineCanvas" width="560" height="440" aria-label="曲がった軸に沿った掃引のデモ"></canvas>
        </div>
      </div>
    </div>

    <h3>実物は「一様に曲がって」いない</h3>
    <p>
      バナナ.js に、こう書いてあります。「曲率は一様ではなく、中央より両端が強い」。
      同じ半径の円弧にすると、きれいすぎて作り物に見えます。
      実際のコードでは、軸の曲がり具合を場所ごとに変えています。
      さらに果柄（へたの部分）では<b>曲がる向きが逆</b>になります。ここを直線にすると、
      いかにも「くっつけました」という形になります。
    </p>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p>断面を「水平のまま」置くと失敗します。軸が斜めになっているところでは、
      断面が斜めに切られた形になり、<b>曲がりの内側だけがつぶれます</b>。
      必ず接線に垂直な平面のうえに置くこと。
      もうひとつ、垂直な向き N の取り方を場所ごとに勝手に決めると、
      となりの断面との間で<b>勝手にねじれます</b>（テクスチャがよじれて分かります）。
      ひとつ前の断面の向きを引き継いでいくのが定石です。</p>
    </div>
${tryBox([
    "曲がりを0にして、まっすぐな棒に戻す。04章の回転体と同じものになることを確かめる。",
    "ねじれを0.8まで上げて、模様のよじれ方を見る。",
    "キュウリのプリセットで稜を10本にする。実物のきゅうりの縦すじは何本か、本物を見て数えてみる。"
  ])}
  </div>
</section>`
});

/* ---- 11 シーンと光（新規） ---- */
pages.push({
  file: "ch11.html", no: "11", tag: "Scene", color: P.suika,
  title: "見せ方を決める（光と露出）", crumb: "第11章",
  html: `<section class="chapter" id="ch11" style="--ch:${P.suika}">
  <div class="chapter-head">
    <div class="chnum">11<small>Scene</small></div>
    <div>
      <h2>見せ方を決める（光と露出）</h2>
      <p class="sub">IBL / shadow / SSAO / tone mapping</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "形・模様・質感がぜんぶ正しくても、<b>光の当て方を外すと台無し</b>になります。",
    "いまの3Dは、360度の風景写真をそのまま光源として使います（<b>IBL</b>）。",
    "明るさは計算のなかでは1を超えます。それを画面用に圧縮するのが<b>トーンマッピング</b>です。"
  ])}
    <p>
      18本のファイルの最後のほうに、必ず同じような行が並んでいます。
      <code>IBL / ライト / 影 / SSAO2 / トーンマッピング</code>。
      ここは野菜そのものではなく、<b>写真でいうところの照明とカメラの設定</b>です。
      同じ野菜でも、この設定次第で「おいしそう」にも「標本」にもなります。
    </p>

    <h3>光は「電球」ではなく「風景」で当てる</h3>
    <p>
      現実で野菜を見るとき、光は電球ひとつから来ているわけではありません。
      窓から入った空の光、白い壁の照り返し、机の反射。四方八方から来ています。
      これを再現するために、<b>360度ぐるりと撮った風景の画像を、そのまま光源として使います</b>。
      これを IBL（イメージ・ベースド・ライティング＝画像による照明）といいます。
      野菜の表面に映り込む「まわりの景色」も、これで一気に本物らしくなります。
    </p>
    <ul>
      <li><b>キーライト</b> — 主役の1灯。影の向きを決める。</li>
      <li><b>影（シャドウマップ）</b> — 光から見て手前にあるものの距離を記録して、影を落とす。</li>
      <li><b>SSAO</b> — 物どうしの<b>すみっこ</b>を暗くする。ざるに盛った野菜のすき間が締まる。</li>
    </ul>

    <h3>明るさは1を超える。だから圧縮する</h3>
    <p>
      画面で出せる白は 255 が上限です。でも計算の途中では、ハイライトの明るさは
      平気で 5 や 20 になります。そのまま切り捨てると、光っている部分が
      <b>ベターっとした真っ白</b>になって、形が消えます。
      そこで、明るいところほど強く圧縮する関数を通してから画面に出します。
      これが<b>トーンマッピング</b>です。写真の「白飛びしにくい設定」と同じことをしています。
    </p>

    <div class="lab">
      <p class="lab-title">実験 — 光と露出を動かす</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="scLight">光の向き <span class="v" id="scLightV">-35°</span></label>
            <input type="range" id="scLight" min="-180" max="180" step="1" value="-35">
          </div>
          <div class="ctrl">
            <label for="scAmb">まわりの光（環境光） <span class="v" id="scAmbV">1.00</span></label>
            <input type="range" id="scAmb" min="0" max="2.2" step="0.01" value="1">
          </div>
          <div class="ctrl">
            <label for="scExpo">露出 <span class="v" id="scExpoV">1.00</span></label>
            <input type="range" id="scExpo" min="0.2" max="3" step="0.01" value="1">
          </div>
          <label class="switch"><input type="checkbox" id="scTone" checked>トーンマッピングを使う</label>
          <div class="readout">いまの状態：<b id="scWarn">—</b></div>
          <p class="hint">トーンマッピングを切って露出を2.5にすると、ハイライトが白く潰れて形が消えます。</p>
        </div>
        <div>
          <canvas id="sceneCanvas" width="560" height="440" aria-label="光と露出のデモ"></canvas>
        </div>
      </div>
    </div>

    <h3>環境光を落とすと、影が「真っ黒」になる</h3>
    <p>
      環境光を0にしてみてください。光が当たっていない側が、完全な黒になります。
      現実にはこうなりません。まわりの壁や机から必ず光が回り込むからです。
      逆に環境光を上げすぎると、影が消えて<b>ぺったりした絵</b>になります。
      「まわりからどれくらい光が回り込むか」を決めるのが、この数値です。
    </p>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p>色には<b>sRGB</b>と<b>リニア</b>の2種類があります。
      画面に表示するための色（sRGB）と、光の計算をするための色（リニア）は別物で、
      そのまま混ぜると濁ったり明るくなりすぎたりします。
      各ファイルのコメントに「sRGB相当のHSV（後でリニアへ）」と書いてあるのはこの区別です。
      Babylon.js では色を作るときに <code>toLinearSpace()</code> を通します。
      ここを忘れると、「なぜか全体が白っぽい」という直しにくいバグになります。</p>
    </div>
${tryBox([
    "トーンマッピングを切って、露出を2.5まで上げる。ハイライトが潰れて形が消える様子を見る。",
    "環境光を0にして、影の側が真っ黒になることを確かめる。",
    "光の向きを真後ろ（180°）にする。輪郭だけが光る「逆光」になります。",
    "自分のスマホで野菜を撮り、窓の光がどちらから来ているか観察する。"
  ])}
  </div>
</section>`
});

/* ---- 図鑑 ---- */
pages.push({
  file: "zukan.html", no: "18", tag: "FILES", color: P.corn,
  title: "どのファイルで、何が学べるか", crumb: "図鑑",
  html: grabSection("zukan")
});

/* ---- ソースビューア ---- */
pages.push({
  file: "view.html",
  no: "SRC",
  tag: "SOURCE",
  color: P.leaf,
  title: "サンプルのソースを読む",
  crumb: "ソースを読む",
  html: `<section class="chapter" id="view" style="--ch:${P.leaf}">
  <div class="chapter-head">
    <div class="chnum" style="font-size:13px">src<small style="opacity:.7">SOURCE</small></div>
    <div>
      <h2>サンプルのソースを読む</h2>
      <p class="sub">18本の .js を、そのまま表示します</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <p style="max-width:70ch">
      読みたいファイルを選んでください。行番号つきで全文が出ます。
      <b>「コードをコピー」</b>を押せばファイルまるごとがクリップボードに入るので、
      そのまま <a href="https://playground.babylonjs.com/" target="_blank" rel="noopener">Babylon.js Playground</a>
      に貼れば動きます（→ <a href="start.html">00 まず動かしてみる</a>）。
      行番号はコピーに含まれません。
    </p>

    <div class="filechips" id="viewChips"></div>

    <div class="viewer">
      <div class="viewer-bar">
        <b id="viewTitle">—</b>
        <span class="d" id="viewDesc"></span>
        <span class="meta" id="viewMeta"></span>
        <button class="chip" type="button" id="viewCopy">コードをコピー</button>
        <a id="viewRaw" href="#" target="_blank" rel="noopener">別のタブで開く ↗</a>
      </div>
      <div class="codewrap" id="viewWrap">
        <pre class="gutter" id="viewGutter" aria-hidden="true"></pre>
        <pre class="code"><code id="viewCode"></code></pre>
      </div>
    </div>

    <div class="body" style="margin-top:34px">
      <h3>どこを読めばいいか</h3>
      <p>
        18本とも、ファイルの先頭に「構成」というコメントがあります。
        並びはどのファイルも同じなので、番号とこのサイトの章を対応させておきます。
      </p>
      <table>
        <tr><th>ファイル内の番号</th><th>中身</th><th>対応する章</th></tr>
        <tr><td>0. CONFIG</td><td>品種プリセット。太さや長さの数値</td><td><a href="ch01.html">01 手続き生成</a></td></tr>
        <tr><td>1. Rng</td><td>シード付き擬似乱数</td><td><a href="ch02.html">02 乱数</a></td></tr>
        <tr><td>2. Noise</td><td>値ノイズ / fBm</td><td><a href="ch03.html">03 ノイズ</a></td></tr>
        <tr><td>3. Mesh utils</td><td>巻き順の判定・法線の溶接・掃引</td><td><a href="ch05.html">05 面と法線</a> / <a href="ch10.html">10 曲がり</a></td></tr>
        <tr><td>4. Profile</td><td>断面のテーブル、稜やくぼみ</td><td><a href="ch04.html">04 かたち</a></td></tr>
        <tr><td>5. TextureLab</td><td>アルベド・ORM・法線マップの生成</td><td><a href="ch06.html">06 テクスチャ</a></td></tr>
        <tr><td>6. 本体</td><td>その野菜そのものの組み立て</td><td><a href="ch09.html">09 部品</a></td></tr>
        <tr><td>7. Basket</td><td>ざる</td><td><a href="ch08.html">08 物理</a></td></tr>
        <tr><td>8. Scene / 物理</td><td>光・影・露出と Havok</td><td><a href="ch11.html">11 光</a> / <a href="ch08.html">08 物理</a></td></tr>
        <tr><td>9. GUI</td><td>右下のスライダー</td><td>—</td></tr>
      </table>
      <div class="note">
        <b>コメントの【対策】を探してみてください。</b>
        これは「一度失敗して直した記録」です。なぜその数値なのか、なぜその順番なのかが、
        たいていそこに書いてあります。このサイトの各章にある「つまずきポイント」は、
        ほとんどがここから拾ってきたものです。
      </div>
    </div>
  </div>
</section>`
});

/* ---- 用語集（検索窓を足す） ---- */
{
  let sec = grabSection("terms");
  sec = sec.replace(
    "<table>",
    '<input type="search" class="termsearch" id="termFilter" placeholder="言葉で絞り込む（例：法線、シード、UV）">\n    <table id="termTable">'
  );
  pages.push({
    file: "terms.html", no: "用語", tag: "GLOSSARY", color: P.onion,
    title: "コードに出てくる言葉", crumb: "用語集",
    html: sec
  });
}

/* ---------- 共通の骨組み ---------- */
const NAV_ITEMS = [
  ["index.html", "目次"],
  ["start.html", "00 はじめ"],
  ["ch01.html", "01 生成"],
  ["ch02.html", "02 乱数"],
  ["ch03.html", "03 ノイズ"],
  ["ch04.html", "04 かたち"],
  ["ch05.html", "05 面"],
  ["ch06.html", "06 模様"],
  ["ch07.html", "07 質感"],
  ["ch08.html", "08 物理"],
  ["ch09.html", "09 部品"],
  ["ch10.html", "10 曲がり"],
  ["ch11.html", "11 光"],
  ["zukan.html", "図鑑"],
  ["view.html", "ソース"],
  ["terms.html", "用語"]
];
function navHTML(cur) {
  return NAV_ITEMS.map(
    ([f, label]) =>
      '      <a href="' + f + '"' + (f === cur ? ' aria-current="page"' : "") + ">" + label + "</a>"
  ).join("\n");
}

function shell(o) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.fullTitle || o.title + " — やさいのつくりかた"}</title>
<meta name="description" content="${o.desc || ""}">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/labs.js" defer></script>${(o.scripts || []).map((s) => '\n<script src="' + s + '" defer></script>').join("")}
</head>
<body>
<header class="topbar">
  <div class="topbar-in">
    <a class="brand" href="index.html">やさいのつくりかた<span class="dot">.</span></a>
    <nav class="navlinks" aria-label="章">
${navHTML(o.cur)}
    </nav>
  </div>
</header>

<main id="top" class="page">
${o.body}
</main>

<footer>
  <div class="wrap">
    <div><b>やさいのつくりかた</b> — Babylon.js による手続き的モデリングの学習ノート</div>
    <div><a href="index.html">目次へ戻る</a></div>
  </div>
</footer>
</body>
</html>
`;
}

function pagerHTML(prev, next) {
  const cell = (p, dir, cls) =>
    p
      ? `<a class="${cls}" href="${p.file}"><span class="dir">${dir}</span><span class="ttl">${p.no} ${p.title}</span></a>`
      : `<span class="${cls} none"></span>`;
  return `  <div class="pager">
    ${cell(prev, "← まえの章", "prev")}
    ${cell(next, "つぎの章 →", "next")}
  </div>`;
}

/* ---------- 章ページを書き出す ---------- */
pages.forEach((p, i) => {
  const prev = i > 0 ? pages[i - 1] : null;
  const next = i < pages.length - 1 ? pages[i + 1] : null;
  const body = `<div class="wrap" style="--ch:${p.color}">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span>${p.crumb}</p>
${p.html}
${pagerHTML(prev, next)}
</div>`;
  fs.writeFileSync(
    path.join(ROOT, p.file),
    shell({ title: p.title, body: body, desc: p.title, cur: p.file, scripts: p.scripts }),
    "utf8"
  );
  console.log("wrote", p.file);
});

/* ---------- サンプルのソースを、ビューアから読める形で書き出す ----------
   file:// では fetch も XHR も使えないので、<script> で読める形にしておく。
   ビューアは http で開かれたときは fetch を優先し、これは控えとして使う。 */
{
  const srcDir = path.join(ROOT, "assets/src");
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
  const list = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  let total = 0;
  for (const f of list) {
    const code = fs.readFileSync(path.join(ROOT, f), "utf8");
    const out =
      "window.__SRC=window.__SRC||{};\nwindow.__SRC[" +
      JSON.stringify(f) +
      "]=" +
      JSON.stringify(code) +
      ";\n";
    fs.writeFileSync(path.join(srcDir, f.replace(/\.js$/, ".src.js")), out, "utf8");
    total += out.length;
  }
  console.log("wrote assets/src/ —", list.length, "files,", Math.round(total / 1024), "KB");
}

/* ---------- トップページ ---------- */
const HUB_BLURB = {
  "start.html": "インストールなし。ブラウザだけで18本を動かす手順。まずここから。",
  "ch01.html": "モデルファイルを読み込まずに、実行した瞬間に座標を計算で作る。その利点と代償。",
  "ch02.html": "Math.random() を使わない理由。「種」を渡すと毎回同じ結果になる乱数を自分で書く。",
  "ch03.html": "となり合う値がなめらかにつながる乱数。重ねると自然物の模様になる（fBm）。",
  "ch04.html": "横顔の折れ線を1本描いて軸のまわりに回す。この教材の背骨にあたる章。",
  "ch05.html": "3Dモデルの正体は座標の配列と三角形の番号表。裏返ると立体が消える理由。",
  "ch06.html": "UVで立体と画像を対応させ、模様を1ピクセルずつ計算で描く。色・光り方・凹凸の3枚。",
  "ch07.html": "「濡れている」「粉をふいている」を数値で書く。粗さ・クリアコート・透け。",
  "ch08.html": "ざるへの盛り付けは手で置かない。重力と摩擦だけ与えて物理エンジンに任せる。",
  "ch09.html": "粒・ひだ・房。部品を1個作って何百個並べ、合体させる。重なりはほぐす。",
  "ch10.html": "バナナやきゅうりは曲がっている。先に軸を決め、断面を軸に垂直に置いていく。",
  "ch11.html": "同じ野菜でも光で別物になる。IBL・影・露出・トーンマッピング。",
  "zukan.html": "18本それぞれの「そこでしか出てこない技術」の一覧。カードからソースへ飛べます。",
  "view.html": "18本の .js をその場で表示。全選択してコピーすれば、そのまま Playground に貼れます。",
  "terms.html": "法線、UV、巻き順、ORM……最初の1周で引っかかる言葉だけ。検索できます。"
};

const hubCards = pages
  .map(
    (p) => `      <a class="hubcard" href="${p.file}" style="--ch:${p.color}">
        <span class="no">${p.no}<span style="opacity:.55;margin-left:8px">${p.tag}</span></span>
        <h3>${p.title}</h3>
        <p>${p.blurb || HUB_BLURB[p.file] || ""}</p>
      </a>`
  )
  .join("\n");

const indexBody = `<section class="hero">
  <div class="hero-grid">
    <div>
      <p class="eyebrow">Babylon.js / procedural vegetables</p>
      <h1>3Dの野菜は、<br><span class="accent">数式から育つ</span>。</h1>
      <p class="lede">
        このサイトで扱う18本のプログラムは、3Dモデルも写真も1枚も読み込みません。
        点の座標を計算で並べ、模様をその場で描き、光り方を数値で決める。
        絵を描く技術ではなく、形を組み立てる技術です。中学・高校の数学で追えるところから順に見ていきます。
      </p>
      <div class="hero-cta">
        <a class="btn" href="start.html">まず動かしてみる</a>
        <a class="btn ghost" href="ch01.html">01章から読む</a>
        <button class="btn ghost" id="heroReplay" type="button">もう一度育てる</button>
      </div>
    </div>
    <div class="stage">
      <canvas id="heroCanvas" width="640" height="480" aria-label="トマトが点から立体へ組み上がる様子"></canvas>
      <div class="stage-caption">
        <b id="heroStage">準備中</b>
        <span id="heroCount">0 頂点</span>
      </div>
    </div>
  </div>
</section>

<div class="wrap">

<section class="chapter" id="howto" style="--ch:var(--p-leaf);border-top:0;padding-top:34px">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">読み方<small style="opacity:.7">HOW TO</small></div>
    <div>
      <h2>このサイトの使い方</h2>
      <p class="sub">上から順でも、気になる章からでも</p>
    </div>
  </div>
  <div class="body">
    <p>
      各章には<b>その場で動かせる実験</b>がついています。スライダーを動かすと、
      文章で説明していることが目の前で起きます。読むより先に、まず動かしてください。
      むずかしい言葉は<a href="terms.html">用語集</a>にまとめてあります。
    </p>
    <ul class="roadmap">
      <li><span class="rn">A</span><span class="rt"><b>とにかく動かしたい人</b><span><a href="start.html">00 まず動かしてみる</a> → 好きな章の実験だけ触る</span></span></li>
      <li><span class="rn">B</span><span class="rt"><b>順番に理解したい人</b><span>01 → 02 → 03 …… と上から。04章（かたち）と05章（面と法線）がこの教材の背骨です。</span></span></li>
      <li><span class="rn">C</span><span class="rt"><b>コードを読みたい人</b><span><a href="zukan.html">図鑑</a>でファイルを選ぶ → 対応する章に戻る</span></span></li>
    </ul>
    <div class="note">
      <b>必要な数学。</b>
      sin・cos（三角関数）、座標、比例、それに少しだけベクトル（内積・外積）。
      高校1年までの内容でだいたい追えます。出てきたところで、そのつど説明します。
    </div>
  </div>
</section>

<section class="chapter" id="chapters" style="--ch:var(--p-tomato)">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">目次<small style="opacity:.7">INDEX</small></div>
    <div>
      <h2>ぜんぶで11章</h2>
      <p class="sub">1本の .js ファイルを、上から順にほどいていく構成</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <div class="hub">
${hubCards}
    </div>
  </div>
</section>

</div>`;

fs.writeFileSync(
  path.join(ROOT, "index.html"),
  shell({
    fullTitle: "やさいのつくりかた — コードで野菜を育てる技術ノート",
    cur: "index.html",
    desc: "Babylon.js で野菜を手続き的に生成する18本のサンプルを、中学生・高校生向けに解説する学習ポータル",
    body: indexBody
  }),
  "utf8"
);
console.log("wrote index.html");
