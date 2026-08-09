/* =====================================================================
 *  やさいのつくりかた — ページ生成スクリプト
 *
 *  実行:  node tools/build.js   （リポジトリのどこからでも可）
 *
 *  生成するもの:
 *    ・index.html / start.html / ch01〜ch11.html / zukan.html /
 *      view.html / terms.html   … 全16ページ
 *    ・assets/src/*.src.js       … 23本のサンプルをビューア用に複製
 *                                  （.gitignore 済み。再生成はこれで行う）
 *
 *  【注意】上記のファイルは毎回まるごと上書きされます。
 *          HTML を直接手で編集しても、次にこれを走らせると消えます。
 *          文章を直すときは、このスクリプトの中の該当箇所を直してください。
 *
 *  入力:
 *    ・assets/_index_original.bak.html … 01〜07章の本文の出典。消さないこと
 *    ・リポジトリ直下の *.js（23本）    … ビューア用の複製元
 *
 *  手書きで管理しているもの（このスクリプトは触りません）:
 *    ・assets/site.css / assets/labs.js / assets/havok-lab.js
 *
 *  別のスクリプトが作るもの:
 *    ・assets/thumbs/*.jpg と thumbs.js … 図鑑カードの実行結果サムネイル。
 *      収録は node tools/shoot.js（ヘッドレスの Chrome で実際に動かして撮る）。
 *      サンプルの見た目を変えたときだけ撮り直せば足ります
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
    "この23本は、<b>ブラウザだけ</b>で動きます。インストールは何も要りません。",
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
        <p>最初の1本は <b>ニンジン.js</b> がおすすめです。23本のなかでいちばん構造が素直で、
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

    <h3>23本のうち、どれから読むか</h3>
    <ul>
      <li><b>ニンジン.js</b> — いちばん素直。円錐 + 溝。まずこれ。</li>
      <li><b>キュウリ.js</b> — 稜（縦のすじ）とイボ。テクスチャの作りが分かりやすい。</li>
      <li><b>トマト.js / サクランボ.js</b> — 肩が折り返す形。ここから少し難しくなります。</li>
      <li><b>シイタケ.js / トウモロコシ.js</b> — 構造が複雑。慣れてから。</li>
      <li><b>ブロッコリー.js / ロマネスコ.js</b> — 作り方がまったく別。最後でかまいません（→ <a href="ch12.html">12章</a>）。</li>
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
      "ブロッコリー.js の先頭を開いて、4番と5番が別のものに入れ替わっていることを確かめる。",
      "身のまわりで「数式で説明できそうな形」を3つ探す（例：ソフトクリーム、ネジ、松ぼっくり）。"
    ],
    // 5本追加されて「18本すべてが同じ9層」が成り立たなくなったので、
    // 見出しと本文を差し替え、例外の3本への案内を足す
    patch: (sec) =>
      sec
        .replace("18本ぜんぶ合わせても", "23本ぜんぶ合わせても")
        .replace(
          "<h3>18本すべてが同じ9層でできている</h3>",
          "<h3>ほとんどのファイルが、同じ9層でできている</h3>"
        )
        .replace(
          `      トマトもシイタケも玉ねぎも、ファイルの構造はまったく同じです。上から順に読めば、
      どの野菜でも同じ場所に同じ役割のコードがあります。このサイトの章立ても、この層に対応させてあります。`,
          `      トマトもシイタケも玉ねぎも、ファイルの構造はまったく同じです。上から順に読めば、
      どの野菜でも同じ場所に同じ役割のコードがあります。このサイトの第I部（01〜11章）は、この層に対応させてあります。`
        )
        .replace(
          "<figcaption>トマト.js の冒頭。18本すべてがこの並びで書かれている</figcaption>",
          "<figcaption>トマト.js の冒頭。23本のうち20本が、この並びで書かれている</figcaption>"
        )
        .replace(
          '    <div class="note">\n      <b>読む順番のおすすめ。</b>',
          `    <div class="trap">
      <span class="label">ただし、例外が3本あります</span>
      <p><b>ブロッコリー.js / カリフラワー.js / ロマネスコ.js</b> は、この9層に収まりません。
      形を「横顔」で言い表せないので <b>4. Profile が無く</b>、
      枝分かれした形にはUVが張れないので <b>5. TextureLab も無い</b>。
      代わりに <b>Corymb</b>（房の再帰）や <b>Fractal</b>（黄金角の再帰配置）という層が入っています。
      この3本の作り方は<a href="ch12.html">第II部（12〜16章）</a>にまとめました。</p>
    </div>
    <div class="note">
      <b>読む順番のおすすめ。</b>`
        )
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
    ],
    patch: (sec) => sec.replace("18本すべてに入っている Rng", "23本すべてに入っている Rng")
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
      使っている API も数値も、サンプルからそのまま持ってきたものです。
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
      どのファイルも、最後のほうに必ず同じような行が並んでいます。
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

/* =====================================================================
 *  第II部 — 構造そのものをつくる（12〜16）
 *
 *  01〜11章は「1本の .js を上から順にほどく」構成で、ファイルの
 *  9層（CONFIG / Rng / Noise / Mesh / Profile / TextureLab / 本体 /
 *  Basket / Scene）にそのまま対応していた。
 *  あとから加わった5本（枝豆・サクランボ・ブロッコリー・カリフラワー・
 *  ロマネスコ）のうち3本は、その9層に収まらない。
 *    ・Profile が無い（回転体でも掃引でもない。再帰で生える）
 *    ・TextureLab が無い（UVが張れないので頂点カラー）
 *    ・代わりに Corymb / Fractal という層がある
 *  そこで第II部として、層ではなく「作り方の種類」で章を立てる。
 * ===================================================================== */

/* ---- 12 再帰と自己相似（新規） ---- */
pages.push({
  file: "ch12.html", no: "12", tag: "Recursion", color: P.leaf,
  title: "くり返しが、形をつくる", crumb: "第12章",
  html: `<section class="chapter" id="ch12" style="--ch:${P.leaf}">
  <div class="chapter-head">
    <div class="chnum">12<small>Recursion</small></div>
    <div>
      <h2>くり返しが、形をつくる</h2>
      <p class="sub">recursion &amp; self-similarity — 再帰と自己相似</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "ブロッコリーやロマネスコは、横顔を回しても（04章）軸に沿わせても（10章）作れません。",
    "この3本の正体は<b>同じ手順を、小さくしてくり返す</b>ことです。これを<b>再帰</b>といいます。",
    "むずかしいのは作り方ではなく<b>どこで止めるか</b>。止め方を外すと、粒がバラバラになるか個数が爆発します。"
  ])}
    <p>
      ここまでの章で作ってきた野菜は、どれも「1個のかたまり」でした。
      横顔を回して作るか（04章）、曲がった軸に断面を並べて作るか（10章）。
      ところがブロッコリー・カリフラワー・ロマネスコは、そのどちらでもありません。
      これらは<b>枝が分かれて、その先でまた枝が分かれてできた構造</b>で、
      形を1本の折れ線で言い表すことができません。
    </p>
    <p>
      こういうものは、<b>自分自身を呼び出す関数</b>で作ります。
      「円錐をひとつ描く。その表面に、少し小さい円錐をいくつか置く。
      置いた円錐それぞれについて、また同じことをする」——
      これだけで、あの複雑な形が出てきます。
    </p>

    <h3>ロマネスコの正体は、2行で言える</h3>
    <p>
      ロマネスコを「ブロッコリーの房を尖らせたもの」と考えると、絶対に似ません。
      ロマネスコ.js の冒頭には、こう書いてあります。
    </p>
    <ul>
      <li>(a) 親の円錐の面のうえに、子を「<b>頂点からの距離が等比数列</b> s<sub>i</sub> = S·λ<sup>i</sup>、
        <b>方位が137.5°ずつ</b>」で置く</li>
      <li>(b) <b>子の大きさを、その距離に比例させる</b></li>
    </ul>
    <p>
      この2つが揃うと<b>自己相似</b>になります。どこを拡大しても同じ形が出てくる、という性質です。
      そして自己相似になったとたん、見る向きによって8本・13本・21本と数の変わる螺旋が
      <b>勝手に</b>現れます。螺旋を線として描こうとしたり、子を等間隔に並べたりすると、
      ただのイガグリで終わります（この螺旋の話は<a href="ch13.html">13章</a>で）。
    </p>
    <figure>
<pre><span class="k">function</span> growFractal(cfg, rng, out, base, axis, rho, H, level) {
    <span class="k">const</span> L = cfg.levels[Math.min(level, cfg.levels.length - <span class="n">1</span>)];
    <span class="c">// 打ち切りの判定。ここが章の本題</span>
    <span class="k">const</span> leaf = (level &gt;= cfg.maxLevel)
        || (L.coneK * rho * L.startFrac &lt; cfg.minChild);
    ...
    <span class="k">for</span> (<span class="k">let</span> i = <span class="n">0</span>; i &lt;= iMax; i++) {
        <span class="k">const</span> f  = L.startFrac * Math.pow(lam, i);   <span class="c">// 頂点からの距離（等比）</span>
        <span class="k">const</span> th = th0 + i * <span class="n">2.3999632</span>;              <span class="c">// 137.5° ずつ回す</span>
        <span class="k">const</span> cr = L.coneK * coneR(rho, ..., tt);   <span class="c">// その場所の半径に見合う大きさ</span>
        growFractal(cfg, rng, out, cb, ax, cr, cr * CL.aspect, level + <span class="n">1</span>);
    }
}</pre>
      <figcaption>ロマネスコ.js の中心。自分自身を呼んでいるのが分かる</figcaption>
    </figure>

    <h3>「何階層まで」で止めてはいけない</h3>
    <p>
      再帰でいちばん大事なのは、<b>止める条件</b>です。素直に考えると「3階層まで潜る」と
      決めたくなります。でもこれをやると失敗します。
    </p>
    <p>
      頭の下側にある大きな小塔は、3階層では末端がまだ1cm近くあります。
      つるつるした大きな瘤にしか見えません。逆に頂上付近の小さな小塔は、
      3階層目がもう見えない大きさになっています。
      <b>実物のロマネスコは、大きい小塔ほど深く分岐していて、
      末端の粒の絶対的な大きさがどこでも1〜2mmに揃っています。</b>
      だから打ち切りは階層数ではなく、<code>minChild</code>（cm単位の大きさ）で決めます。
    </p>

    <div class="lab">
      <p class="lab-title">実験 — どこで止めるか</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="fracK">子の大きさの比 <span class="v" id="fracKV">0.52</span></label>
            <input type="range" id="fracK" min="0.30" max="0.62" step="0.01" value="0.52">
          </div>
          <div class="ctrl">
            <label for="fracMin">打ち切る粒の大きさ <span class="v" id="fracMinV">1.5 mm</span></label>
            <input type="range" id="fracMin" min="0.8" max="9" step="0.1" value="1.5">
          </div>
          <label class="switch"><input type="checkbox" id="fracDepth">階層数で打ち切る（3階層）</label>
          <div class="readout" id="fracOut"></div>
          <p class="hint">「階層数で打ち切る」を入れると、末端の大きさがそろわなくなります。最後の行の「倍」を見てください。</p>
        </div>
        <div>
          <canvas id="fracCanvas" width="520" height="460" aria-label="再帰で置いた円錐の側面図"></canvas>
        </div>
      </div>
    </div>

    <h3>本気で作ると1000万個になる</h3>
    <p>
      実験で「打ち切る粒の大きさ」を下げていくと、個数がすごい勢いで増えます。
      これは計算してみると分かります。子は1階層あたり k 倍にしか小さくならないので、
      4.6cmの頭から1mmの粒まで届くには、k = 0.5 でも
      log(0.001/0.046) / log(0.5) ≒ <b>5.5階層</b>。
      1階層あたり親の面を埋めるのに必要な個数を掛けると、末端は<b>1000万個</b>になります。
      実物のロマネスコは、本当にその規模で分岐しています。
    </p>
    <p>
      パソコンでは無理です。そこでロマネスコ.js は、末端だけ<b>「面に粒を彫る」</b>ことで
      代用しています。ジオメトリは輪郭だけを担当し、細かい螺旋は面の凹凸に任せる。
      作りたいものが大きすぎるときは、<b>どこまでを本物の形で作り、
      どこからを表面の細工で済ませるか</b>を決めることになります。
    </p>
    <div class="note">
      <b>被覆率という物差し。</b>
      親の面が子で埋まっているかどうかは、式で確かめられます。
      親の側面積を子の底面積で割った<b>被覆率 = k²·ρ /( S·(1−λ²) )</b>。
      これが1を切ると親の面がそのまま見えて、「つるつるの円錐に粒が点在する」絵になります。
      子を小さくすれば実物に近づく、と単純には言えません。
      小さくすると面を埋めるのに必要な個数が増えて、すぐ破綻します。
      <b>子の大きさと個数は、独立に決められません。</b>
    </div>

    <h3>ブロッコリーは、順番が逆</h3>
    <p>
      同じ再帰でも、ブロッコリーは作り方が逆向きです。
      素直に「頭の縄張りを3〜4個に分けて、それぞれをまた分けて……」とやると、
      房と房のあいだに<b>穴が空きます</b>。3個に分けたとき、隣り合う子の中心は
      100°以上離れてしまうからです。
    </p>
    <p>
      そこでブロッコリー.js は、<b>先に房の位置を全部決めます</b>。
      頭の表面にフィボナッチ格子で均等に並べ（これも<a href="ch13.html">13章</a>の話です）、
      そのあとで近いものどうしを k-means でまとめ直し、
      まとまりの中心へ向かって枝を伸ばす。こうすれば、
      表面が埋まっていることが最初から保証されます。
    </p>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>子の軸を、親の面の法線のままにしないこと。</b>
      面に垂直なまま生やすと、小塔が放射状に開いて<b>ウニ</b>になります。
      実物はどの小塔も頭のてっぺんを向いて寝ているので、
      法線から親の軸のほうへ大きく寄せます（<code>tilt</code>）。
      上から見て星形・ヒトデ形になったら、たいていここが原因です。</p>
    </div>
${tryBox([
    "「階層数で打ち切る」を入れて、末端の「いちばん大きい ÷ いちばん小さい」が何倍になるか読み取る。",
    "打ち切る大きさを0.8mmまで下げて、円錐の総数が何個になるか見る。",
    "子の大きさの比を0.30まで下げる。親の面が見えてくる（被覆率が1を切る）ことを確かめる。",
    "身のまわりで自己相似な形を3つ探す（例：シダの葉、雷、木の枝）。"
  ])}
  </div>
</section>`
});

/* ---- 13 葉序（新規） ---- */
pages.push({
  file: "ch13.html", no: "13", tag: "Phyllotaxis", color: P.corn,
  title: "螺旋は、描かない", crumb: "第13章",
  html: `<section class="chapter" id="ch13" style="--ch:${P.corn}">
  <div class="chapter-head">
    <div class="chnum">13<small>Phyllotaxis</small></div>
    <div>
      <h2>螺旋は、描かない</h2>
      <p class="sub">phyllotaxis — 葉序・黄金角・フィボナッチ</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "ロマネスコやひまわりの螺旋は、<b>螺旋を描いて作るのではありません</b>。",
    "1個置くごとに <b>137.5°</b> ずつ回すだけ。すると螺旋が<b>勝手に</b>見えてきます。",
    "しかもその本数は 8・13・21 ……と<b>フィボナッチ数</b>になります。狙って作った数ではありません。"
  ])}
    <p>
      ロマネスコの写真を見ると、螺旋が右回りと左回りに走っているのが分かります。
      数えると8本だったり13本だったり21本だったりします。
      これをプログラムで作ろうとして、螺旋を線として描き始めると、まず失敗します。
      <b>螺旋は、作った結果として出てくるものであって、作るものではありません。</b>
    </p>
    <p>
      やっているのは、たった1行です。
    </p>
    <figure>
<pre><span class="k">const</span> th = th0 + i * <span class="n">2.3999632</span>;   <span class="c">// i 番目の子の方位。2.3999632 rad = 137.5°</span></pre>
      <figcaption>ロマネスコ.js / ブロッコリー.js / カリフラワー.js に共通して出てくる定数</figcaption>
    </figure>
    <p>
      1個置くたびに137.5°回す。それだけです。この角度を<b>黄金角</b>といいます。
      植物が葉や種をつける角度で、<b>葉序（ようじょ）</b>と呼ばれる仕組みです。
    </p>

    <h3>なぜ137.5°なのか</h3>
    <p>
      植物にとって、あとから出る葉は先に出た葉の真上に来ると困ります。日陰になるからです。
      では「いちばん重ならない角度」は何度か。
      たとえば90°だと、4個置くと元に戻ってしまい、4方向にしか葉が出ません。
      120°なら3方向。<b>分数で表せる角度は、必ずどこかで重なります。</b>
    </p>
    <p>
      だから、いちばん<b>分数で表しにくい</b>数を使えばいい。
      それが黄金比 φ = (1+√5)/2 で、360° ÷ φ² ≒ <b>137.507°</b>。
      これが「もっとも重ならない角度」になります。
    </p>

    <h3>螺旋の本数がフィボナッチ数になる理由</h3>
    <p>
      i 番目と i+m 番目が同じ方向に並んで見えるのは、
      m 個ぶん回した角 m×137.5° が、<b>ちょうど1周の整数倍に近い</b>ときです。
      そういう m を小さいほうから探すと、1, 2, 3, 5, 8, 13, 21, 34 ……
      つまりフィボナッチ数が出てきます。
      この m が、そのまま<b>目に見える螺旋（斜列）の本数</b>です。
      下の実験で角度を少しずらすと、本数がフィボナッチ数から外れ、
      同時に見た目が「植物らしくなくなる」のが分かります。
    </p>

    <div class="lab">
      <p class="lab-title">実験 — 角度をずらしてみる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="phylPre">
            <button class="chip" type="button" data-a="137.5" aria-pressed="true">137.5°（黄金角）</button>
            <button class="chip" type="button" data-a="137.0">137.0°</button>
            <button class="chip" type="button" data-a="120">120°</button>
            <button class="chip" type="button" data-a="90">90°</button>
          </div>
          <div class="ctrl">
            <label for="phylAng">回す角度 <span class="v" id="phylAngV">137.5°</span></label>
            <input type="range" id="phylAng" min="130" max="145" step="0.1" value="137.5">
          </div>
          <div class="ctrl">
            <label for="phylN">置く数 <span class="v" id="phylNV">140 個</span></label>
            <input type="range" id="phylN" min="40" max="600" step="10" value="140">
          </div>
          <label class="switch"><input type="checkbox" id="phylLink" checked>斜列を線でつなぐ</label>
          <div class="readout" id="phylOut"></div>
          <p class="hint">137.5 から 0.5 ずらすだけで、螺旋がほどけて「腕」が見えはじめます。</p>
        </div>
        <div>
          <canvas id="phylCanvas" width="460" height="460" aria-label="黄金角で並べた点の配置"></canvas>
        </div>
      </div>
    </div>

    <h3>球の上に均等に置く — フィボナッチ格子</h3>
    <p>
      同じ考え方は、球の表面に点を均等にばらまくのにも使えます。
      緯度・経度で等分すると<b>極のあたりだけ混み合います</b>（06章のUVと同じ問題です）。
      そこで、高さ方向を等間隔に切って、方位を137.5°ずつ回す。
      すると、どこでも同じ密度で並びます。
    </p>
    <figure>
<pre><span class="c">// フィボナッチ球。等面積で並ぶので密度が極でも崩れない</span>
<span class="k">const</span> lz = <span class="n">1</span> - <span class="n">2</span> * (k + <span class="n">0.5</span>) / M;
<span class="k">const</span> lr = Math.sqrt(Math.max(<span class="n">0</span>, <span class="n">1</span> - lz * lz));
<span class="k">const</span> th = k * <span class="n">2.3999632</span> + spin;
<span class="k">const</span> d = vec(lr * Math.cos(th), lr * Math.sin(th), lz);</pre>
      <figcaption>ブロッコリー.js。蕾の粒2〜4万個も、房の位置も、これで並べている</figcaption>
    </figure>

    <h3>おまけ — 螺旋の格子は「まっすぐ」にできる</h3>
    <p>
      ロマネスコには都合のいい性質があります。
      <b>対数極座標</b> (x, y) = (θ/2π, ln f / ln λ) という座標に取り替えると、
      葉序の格子は<b>どの階層でも、まったく同じ形の格子</b>になります。
      螺旋が、ただの斜めの格子になるのです。
      だから1枚のテクスチャを、大きさの違う何千個の円錐すべてに貼り回せます。
      ロマネスコ.js が数万個の小塔を実時間で組めているのは、ここのおかげです。
    </p>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>粒の半径を「格子の目盛」で決めてはいけません。</b>
      黄金角の格子では、いちばん近い節点は「1つ隣」ではなく、
      <b>フィボナッチ数だけ離れた節点</b>です。しかもその距離は5〜6目盛にもなります。
      目盛を基準に「半径0.6」と決めると、粒がぽつぽつ散った点描になります。
      ロマネスコ.js は、最初に最近接距離 <code>DMIN</code> を総当たりで求めてから、
      それを基準に粒の大きさを決めています。</p>
    </div>
${tryBox([
    "137.5°のまま「斜列を線でつなぐ」を入れて、赤・青・黄の線がどう走っているか見る。",
    "角度を135.0°にする。螺旋がほどけて放射状の腕になることを確かめる。",
    "置く数を40から600まで動かす。本数が 5/8/13 → 13/21/34 → 34/55/89 と、フィボナッチ数を1つずつ繰り上がっていくのを見る。",
    "ひまわり・松ぼっくり・パイナップルの写真で、螺旋の本数を数えてみる。"
  ])}
  </div>
</section>`
});

/* ---- 14 頂点カラーと焼き込みAO（新規） ---- */
pages.push({
  file: "ch14.html", no: "14", tag: "VertexColor", color: P.suika,
  title: "模様を貼らずに、頂点で塗る", crumb: "第14章",
  html: `<section class="chapter" id="ch14" style="--ch:${P.suika}">
  <div class="chapter-head">
    <div class="chnum">14<small>VertexColor</small></div>
    <div>
      <h2>模様を貼らずに、頂点で塗る</h2>
      <p class="sub">vertex colors &amp; baked occlusion — 頂点カラーと焼き込み遮蔽</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "06章では模様をテクスチャに描きました。でもブロッコリーには<b>UVが張れません</b>。",
    "枝分かれした構造に、破綻のない展開図は作れないからです。",
    "代わりに<b>頂点1個ずつに色を持たせ</b>、さらに「谷の暗さ」をそこへ焼き込みます。"
  ])}
    <p>
      06章では、模様をテクスチャ（2Dの絵）に描いて立体に貼りました。
      第I部で扱った野菜は、それで足りました。どれも1個のかたまりで、
      地球儀のように「経度・緯度」を割り当てられたからです。
    </p>
    <p>
      ブロッコリーではこれができません。枝が分かれて、その先でまた分かれた構造を、
      1枚の紙に破れ目なく広げることはできないからです。
      そして困ったことに、ブロッコリー.js は<b>テクスチャを1枚も使っていません</b>
      （ざるの網代だけは別です）。
    </p>
    <p>
      では色はどこから来るのか。<b>頂点そのものが色を持っています。</b>
      3Dモデルは座標・三角形の番号表・法線・UVでできている、と05章で書きました。
      そこにもう1本、<code>colors</code> という配列を足すだけです。
      三角形の内側は、3つの頂点の色を混ぜて塗られます。
    </p>
    <figure>
<pre>vd.positions = ...;
vd.normals   = ...;
vd.colors    = colors;     <span class="c">// 頂点1個につき RGBA の4つ</span>
vd.indices   = ...;
vd.applyToMesh(mesh, <span class="k">false</span>);

curd.albedoColor = <span class="k">new</span> BABYLON.Color3(<span class="n">1</span>, <span class="n">1</span>, <span class="n">1</span>);   <span class="c">// 実色は頂点カラー</span></pre>
      <figcaption>ブロッコリー.js。マテリアルの色は白のまま、頂点の色が掛かる</figcaption>
    </figure>
    <p>
      必要な情報はぜんぶ「その粒がどこにあって、どっちを向いているか」から決まります。
      だったら、わざわざ2Dの絵を経由するより、頂点に直接書いたほうが正確で速い。
      これがブロッコリー.js の判断です。
    </p>

    <h3>質感を作っているのは、粒ではなく「谷の暗さ」</h3>
    <p>
      ブロッコリーの蕾の粒を2〜4万個ちゃんと並べても、それだけでは
      <b>粒があるのに平板</b>に見えます。足りないのは<b>影</b>です。
      粒と粒のあいだの谷には、まわりの光がほとんど届きません。この暗さが質感の正体です。
    </p>
    <p>
      ところが、この谷は1〜2mmしかありません。11章に出てきた SSAO は画面上での処理なので、
      この細かさは解像できません。そこでブロッコリー.js は、
      <b>頂点を作るときに、その場で暗さを計算して色に焼き込みます</b>。
    </p>
    <figure>
<pre><span class="c">// 隣の房が「空をどれだけ覆っているか」を立体角で足す</span>
<span class="k">for</span> (<span class="k">const</span> d <span class="k">of</span> list) {
    <span class="k">const</span> dist = <span class="c">/* 粒から隣の房の中心までの距離 */</span>;
    <span class="k">const</span> nd = <span class="c">/* 粒の向きと、その方向の内積。裏側は数えない */</span>;
    <span class="k">if</span> (nd &lt;= <span class="n">0</span>) <span class="k">continue</span>;
    <span class="k">const</span> rr = d.R / Math.max(dist, d.R);
    <span class="c">// 半径 R の球が距離 dist から張る立体角の、半球に対する比</span>
    occ += <span class="n">0.5</span> * (<span class="n">1</span> - Math.sqrt(<span class="n">1</span> - rr * rr)) * nd;
}
<span class="k">return</span> clamp(<span class="n">1</span> - occ * strength, floor, <span class="n">1</span>);</pre>
      <figcaption>ブロッコリー.js の sphereAO()。房を球とみなして解析的に解いている</figcaption>
    </figure>
    <p>
      本物の影のように光線を飛ばして調べるのではなく、
      <b>隣の房を球だと思って、公式で解いています</b>。だから速い。
      数万個の頂点それぞれで、近くの房だけを見て計算します。
    </p>

    <div class="lab">
      <p class="lab-title">実験 — 谷の暗さを消してみる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="curdAO">遮蔽の強さ <span class="v" id="curdAOV">1.02</span></label>
            <input type="range" id="curdAO" min="0" max="2.2" step="0.02" value="1.02">
          </div>
          <div class="ctrl">
            <label for="curdFloor">暗さの下限 <span class="v" id="curdFloorV">0.20</span></label>
            <input type="range" id="curdFloor" min="0.05" max="0.85" step="0.01" value="0.20">
          </div>
          <label class="switch"><input type="checkbox" id="curdWhite">白い花蕾（カリフラワー）にする</label>
          <div class="readout" id="curdOut"></div>
          <p class="hint">強さを0にすると、粒はそのままなのに絵が平らになります。これが「谷の暗さ」の効果です。</p>
        </div>
        <div>
          <canvas id="curdCanvas" width="480" height="440" aria-label="蕾の粒と谷の暗さのデモ"></canvas>
        </div>
      </div>
    </div>

    <h3>暗くするのに、黒を掛けてはいけない</h3>
    <p>
      遮蔽を色に反映するとき、素直に「色 × 明るさ」とやると、谷が<b>黒く濁ります</b>。
      実物の谷は黒ではなく、<b>深い緑</b>です。
      そこでブロッコリー.js は掛け算ではなく、<b>谷の色へ寄せる</b>書き方をしています。
    </p>
    <figure>
<pre><span class="c">// 遮蔽は「黒く掛ける」のではなく谷の色へ寄せる</span>
<span class="k">const</span> dr = mix(DEEP[<span class="n">0</span>], cr, ao);
<span class="k">const</span> dg = mix(DEEP[<span class="n">1</span>], cg, ao);
<span class="k">const</span> db = mix(DEEP[<span class="n">2</span>], cb, ao);</pre>
      <figcaption>ao が 1 なら元の色、0 なら谷の色。あいだは混ぜる</figcaption>
    </figure>
    <p>
      白いカリフラワーでは、この差がもっとはっきり出ます。
      白い野菜は谷に落ちた光も回り込んでくるので、暗くなりません。
      ブロッコリーと同じ遮蔽を掛けると、<b>白い塊に墨を流した</b>ようになります。
      実験の「白い花蕾にする」を入れて、下限が0.16のままだとどうなるか見てください
      （<a href="ch16.html">16章</a>へ続きます）。
    </p>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>粒をインスタンスにしてはいけません。</b>
      同じ形を何万個も並べるとき、09章で出てきた「インスタンス」を使いたくなります。
      でもインスタンスは<b>1個につき1色</b>しか持てません。
      この野菜の質感は「同じ粒のなかで、外を向いた面は明るく谷を向いた面は暗い」という
      頂点単位の濃淡がほぼ全部なので、それが出せなくなります。
      1枚のメッシュに焼き込めば濃淡も出るし、描画も1回で済みます。</p>
      <p><b>もうひとつ。</b>頂点カラーを RGBA の4つ組で入れると、Babylon.js は
      <code>hasVertexAlpha</code> を立てて<b>透過パス</b>へ回します。
      透過パスは深度書き込みが切られるので、粒どうしが互いを正しく隠せなくなります。
      不透明なら <code>mesh.hasVertexAlpha = false</code> を明示します。</p>
    </div>
${tryBox([
    "遮蔽の強さを0にする。粒の数は変わらないのに平板に見えることを確かめる。",
    "強さを2.2まで上げる。今度は「煤けた」感じになることを見る。",
    "「白い花蕾」を入れたまま、下限をいくつまで上げると自然に見えるか探す。",
    "ブロッコリーの実物を上から見て、谷がどれくらい暗いか観察する。"
  ])}
  </div>
</section>`
});

/* ---- 15 シェル法の毛（新規） ---- */
pages.push({
  file: "ch15.html", no: "15", tag: "Shell", color: P.okra,
  title: "毛は、薄い殻を重ねて生やす", crumb: "第15章",
  html: `<section class="chapter" id="ch15" style="--ch:${P.okra}">
  <div class="chapter-head">
    <div class="chnum">15<small>Shell</small></div>
    <div>
      <h2>毛は、薄い殻を重ねて生やす</h2>
      <p class="sub">shell fur — シェル法</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "枝豆のいちばんの特徴は産毛です。でも<b>法線マップでは毛は出ません</b>。輪郭がつるつるのままだからです。",
    "そこで本体の少し外側に、毛の点々を描いた<b>透明な殻</b>を1枚2枚と重ねます。",
    "正面はうっすら、輪郭では殻が斜めに重なって濃くなる。これが毛に見えます。"
  ])}
    <p>
      07章で、オクラの産毛は <b>sheen</b>（布のような照り）で表しました。
      表面が縁のあたりで柔らかく光る、という質感です。オクラはそれで足ります。
      でも枝豆はそうはいきません。枝豆の毛はもっと長く、密で、
      <b>シルエットに毛が立って見える</b>からです。
    </p>
    <p>
      06章の法線マップは「実際には形を変えず、光の当たり方だけ嘘をつく」技術でした。
      安上がりですが、弱点があります。<b>輪郭には効かない。</b>
      横から見たときの縁は形そのものなので、いくら法線をいじっても滑らかなままです。
    </p>

    <h3>やり方 — 少し大きい殻を、何枚か重ねる</h3>
    <p>
      そこで<b>シェル法</b>（shell fur）を使います。考え方はとても素朴です。
    </p>
    <ol>
      <li>莢のメッシュを、ほんの少し外側へ膨らませたコピーを作る</li>
      <li>そこに「毛の断面の点々」を描いた半透明のテクスチャを貼る</li>
      <li>これを、膨らませる量を変えながら2〜3枚重ねる</li>
    </ol>
    <p>
      毛を1本ずつ作るわけではありません。毛を<b>輪切りにした点々</b>を、
      高さ違いで何枚か置いているだけです。それでも毛に見えます。
      正面から見ると点々はまばらに散っているだけですが、
      輪郭のあたりでは同じ点々を<b>斜めから何枚も透かして見る</b>ことになるので、
      そこだけ濃く積み上がるからです。
    </p>
    <figure>
<pre><span class="k">for</span> (<span class="k">let</span> k = <span class="n">0</span>; k &lt; <span class="n">3</span>; k++) {
    <span class="k">const</span> f = <span class="k">new</span> BABYLON.StandardMaterial(<span class="s">"edamameFuzz"</span> + k, scene);
    f.opacityTexture = <span class="k">this</span>.fuzzTex;      <span class="c">// 毛の点々（アルファ）</span>
    f.alpha = cfg.fuzzAlpha * Math.pow(<span class="n">0.55</span>, k);  <span class="c">// 外側の殻ほど薄く</span>
    f.backFaceCulling = <span class="k">false</span>;
    f.disableDepthWrite = <span class="k">true</span>;             <span class="c">// 前後で悩まないようにする</span>
    <span class="k">this</span>.fuzzMats.push(f);
}</pre>
      <figcaption>枝豆.js。殻ごとにアルファを 0.55 倍ずつ落としていく</figcaption>
    </figure>

    <div class="lab">
      <p class="lab-title">実験 — 殻を重ねる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="fuzzShell">殻の枚数 <span class="v" id="fuzzShellV">2 枚</span></label>
            <input type="range" id="fuzzShell" min="0" max="4" step="1" value="2">
          </div>
          <div class="ctrl">
            <label for="fuzzLen">毛の長さ <span class="v" id="fuzzLenV">0.075</span></label>
            <input type="range" id="fuzzLen" min="0.01" max="0.20" step="0.005" value="0.075">
          </div>
          <div class="ctrl">
            <label for="fuzzA">毛の濃さ <span class="v" id="fuzzAV">0.30</span></label>
            <input type="range" id="fuzzA" min="0.05" max="0.9" step="0.01" value="0.30">
          </div>
          <div class="readout" id="fuzzOut"></div>
          <p class="hint">枚数を0にすると輪郭がつるつるになります。1枚でも入れると、縁だけ毛羽立って見えます。</p>
        </div>
        <div>
          <canvas id="fuzzCanvas" width="520" height="380" aria-label="シェル法による産毛のデモ"></canvas>
        </div>
      </div>
    </div>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p>枝豆.js は最初、<code>opacityFresnel</code>（見る角度で透明度を変える機能）を使って
      「輪郭付近だけ毛を見せる」つもりでした。ところが Babylon.js のこの機能は
      <code>alpha += left*(1-F) + F*right</code> という<b>足し算</b>で、
      しかも <code>leftColor</code> が<b>正面</b>側です。
      白と黒を入れたところ、正面のアルファに 1.0 が足されて完全に不透明になり、
      莢が<b>霜をかぶったように真っ白</b>になりました。
      いまは素直なシェル法に戻してあります。
      「便利そうな機能を、中身を確かめずに使うと壊れる」という記録です。</p>
    </div>
    <div class="note">
      <b>毛の色を純白にしない。</b>
      産毛は白っぽく見えますが、そのまま白で描くと霜に見えます。
      枝豆.js は毛の色に莢の緑を3割混ぜています。
      塩ゆでにしたときは <code>fuzzAlpha</code> を0.7倍にします。
      濡れた毛は寝て束になるからです。
    </div>
${tryBox([
    "殻の枚数を0にして、輪郭が完全に滑らかになることを確かめる。",
    "枚数1・濃さ0.9と、枚数3・濃さ0.3を見比べる。どちらが毛らしいか。",
    "毛の長さを0.20まで伸ばす。どのあたりから「カビ」に見えはじめるか。",
    "実物の枝豆を明るいほうへかざして、輪郭に毛が立つのを見る。"
  ])}
  </div>
</section>`
});

/* ---- 16 差分でつくる（新規） ---- */
pages.push({
  file: "ch16.html", no: "16", tag: "Variants", color: P.onion,
  title: "「似ているのに別物」を作り分ける", crumb: "第16章",
  html: `<section class="chapter" id="ch16" style="--ch:${P.onion}">
  <div class="chapter-head">
    <div class="chnum">16<small>Variants</small></div>
    <div>
      <h2>「似ているのに別物」を作り分ける</h2>
      <p class="sub">differential design — 差分でつくる</p>
    </div>
  </div>
  <div class="body">
${recapBox([
    "ブロッコリーとカリフラワーは、<b>ほぼ同じプログラム</b>です。違うのは数値だけ。",
    "でも<b>色を白くしただけでは絶対に似ません</b>。変えるべきは色ではなく構造です。",
    "実物を2つ並べて「何が違うか」を書き出す作業が、手続き的生成の設計そのものです。"
  ])}
    <p>
      カリフラワー.js は、ブロッコリー.js の骨格（散房花序の再帰 → 花蕾ドーム → 粒）を
      そのまま使っています。茎も、ざるも、物理も、GUIも共通です。
      にもかかわらず、冒頭にはこう書いてあります。
      <b>「同じ設定のまま色を白くしても絶対に似ません」</b>。
    </p>
    <p>
      これは手続き的生成の一番おいしいところであり、一番むずかしいところでもあります。
      数値を変えるだけで別の野菜になる。でも<b>どの数値を変えるかは、実物を見ないと分からない</b>。
      カリフラワー.js が実際に変えたのは、次の4か所です。
    </p>

    <table>
      <tr><th>変えたところ</th><th>ブロッコリー</th><th>カリフラワー</th><th>なぜ</th></tr>
      <tr><td>房のあいだ</td><td>areaKeep 0.975<br>domeSwell 1.09</td><td>areaKeep 1.00<br>domeSwell 1.22</td>
        <td>ブロッコリーは房と房が枝まで裂けている。カリフラワーは押し合って固まっていて、境目は浅い溝でしかない</td></tr>
      <tr><td>粒のかたち</td><td>budAspect 1.28</td><td>budAspect 0.52</td>
        <td>ブロッコリーは球状の蕾が1個ずつ外へ伸びる。カリフラワーは粒が法線方向へ潰れて繋がっている</td></tr>
      <tr><td>谷の暗さ</td><td>強さ 1.02 / 下限 0.20</td><td>強さ 0.48 / 下限 0.56</td>
        <td>白いので谷に落ちても光が回り込む。同じ遮蔽だと白い塊に墨を流したようになる</td></tr>
      <tr><td>据わり方</td><td>切り口で立つ</td><td>葉柄の上に座る</td>
        <td>葉が輪になって外へ張り出しているので、その上に載る。物理の凸包にも葉柄を入れる</td></tr>
    </table>

    <div class="lab">
      <p class="lab-title">実験 — 1項目ずつカリフラワーに近づける</p>
      <div class="lab-cols side">
        <div class="controls">
          <label class="switch"><input type="checkbox" id="diffSwell">房を裂かず、大きく重ねる</label>
          <label class="switch"><input type="checkbox" id="diffFuse">粒を潰して融合させる</label>
          <label class="switch"><input type="checkbox" id="diffAo">谷の暗さをゆるめる</label>
          <label class="switch"><input type="checkbox" id="diffCol">色を白くする</label>
          <div class="readout" id="diffOut"></div>
          <p class="hint">「色を白くする」だけを入れてみてください。白いブロッコリーにしかなりません。
          （このミニチュアでは areaKeep と domeSwell を1本のつまみにまとめてあります）</p>
        </div>
        <div>
          <canvas id="diffCanvas" width="480" height="440" aria-label="ブロッコリーからカリフラワーへの差分デモ"></canvas>
        </div>
      </div>
    </div>

    <h3>差分は3種類ある</h3>
    <p>
      23本のサンプルを見渡すと、「似ているものを作り分ける」やり方は3つに分けられます。
    </p>
    <ul>
      <li><b>別の野菜にする</b> — ブロッコリー → カリフラワー。骨格を残して構造の数値を変える。
        ファイルは別々にする（共通部分をライブラリにまとめてしまうと、実物と見比べて直す作業がやりにくくなる）。</li>
      <li><b>品種を切り替える</b> — 同じファイルのなかの <code>PRESETS</code>。
        サクランボ.js には佐藤錦・ナポレオン・紅秀峰の3つが入っています。</li>
      <li><b>状態を切り替える</b> — 枝豆.js の「生／塩ゆで」。形は同じで、色と質感だけが変わる。</li>
    </ul>

    <h3>品種の差は、たいてい「色の分布」</h3>
    <p>
      サクランボの3品種は、形の数値もわずかに違いますが、効いているのはほとんど色です。
      しかも「赤の濃さ」ではなく<b>赤がどこまで回り込んでいるか</b>です。
    </p>
    <figure>
<pre>satonishiki: { blushFloor: <span class="n">0.30</span>, blushSpread: <span class="n">1.15</span> },  <span class="c">// 日陰に黄色が残る</span>
napoleon:    { blushFloor: <span class="n">0.16</span>, blushSpread: <span class="n">1.45</span> },  <span class="c">// 色づきが浅く黄色が広い</span>
benishuho:   { blushFloor: <span class="n">0.74</span>, blushSpread: <span class="n">1.70</span> }   <span class="c">// 全体が濃い赤。黄色はほぼ残らない</span></pre>
      <figcaption>サクランボ.js。blushFloor は「日陰側にどれだけ赤が残るか」の下限</figcaption>
    </figure>
    <p>
      サクランボ.js は、<b>日向側（u = 0.5）から赤が回り込む</b>という1つの仕組みで
      3品種ぜんぶを作っています。「品種ごとにテクスチャを描く」のではなく、
      <b>共通の仕組みに、品種ごとの数値を入れる</b>。これが手続き的生成の考え方です。
    </p>

    <h3>状態の差は、色・艶・付着物</h3>
    <p>
      枝豆.js の「塩ゆで」は、形をまったく変えません。変わるのはこれだけです。
    </p>
    <ul>
      <li>色が冴える（くすみを取って彩度を上げる）</li>
      <li>粗さを 0.74 倍にして濡れた艶を出す。ただし<b>鏡面にはしない</b>（緑のプラスチックになる）</li>
      <li>白い粉（ブルーム）を 0.35 倍に落とす。茹でると落ちるので</li>
      <li>産毛のアルファを 0.7 倍。濡れた毛は寝て束になる</li>
      <li>塩の粒を乗せる</li>
    </ul>

    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>色から手をつけると、必ず失敗します。</b>
      「カリフラワーはブロッコリーの白いやつ」「ナポレオンは佐藤錦の色違い」——
      こう考えているうちは似ません。実物を並べて、
      まず<b>シルエットの違い</b>、次に<b>表面の粒立ちの違い</b>、
      最後に色、の順で見てください。
      このサイトのサンプルのコメントに残っている失敗は、
      ほとんどが「構造の違いを色でごまかそうとした」記録です。</p>
    </div>
${tryBox([
    "「色を白くする」だけを入れて、白いブロッコリーにしかならないことを確かめる。",
    "4つ全部を入れてから、ひとつずつ戻す。いちばん効いているのはどれか。",
    "自分でスーパーへ行き、ブロッコリーとカリフラワーの写真を撮って並べる。違いを5つ書き出す。",
    "サクランボ.js の benishuho の blushFloor を 0.10 にして実行し、何品種に見えるか確かめる。"
  ])}
  </div>
</section>`
});

/* ---- 図鑑 ---- */
{
  let sec = grabSection("zukan");
  // 5本追加されたので、見出しの本数を直す
  sec = sec
    .replace('<div class="chnum">18<small>FILES</small></div>',
             '<div class="chnum">23<small>FILES</small></div>')
    .replace("18本それぞれに、そこでしか出てこない技術がある",
             "23本それぞれに、そこでしか出てこない技術がある")
    .replace(
      `      左の色帯は、そのファイルのコードに実際に書かれている果皮の色です。
      同じ枠組みなのに、担当する「難所」が1本ずつ違います。`,
      `      写真は<b>実際に動かした結果</b>です。1枚も画像を読み込まず、
      すべてその場で計算して描かれています。
      <b>写真を押すと、そのサンプルがこのサイトの中で動きます</b>
      （組み立てに数秒かかります）。
      左の色帯は、そのファイルのコードに実際に書かれている果皮の色。
      同じ枠組みなのに、担当する「難所」が1本ずつ違います。`
    );
  pages.push({
    file: "zukan.html", no: "23", tag: "FILES", color: P.corn,
    title: "どのファイルで、何が学べるか", crumb: "図鑑",
    // サムネイルの一覧。tools/shoot.js が書き出す。labs.js より先に読ませる
    scripts: ["assets/thumbs/thumbs.js"],
    html: sec
  });
}

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
      <p class="sub">23本の .js を、そのまま表示します</p>
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
        <a id="viewPlay" href="play.html">▶ 動かす</a>
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
        どのファイルも、先頭に「構成」というコメントがあります。
        並びはだいたい共通なので、番号とこのサイトの章を対応させておきます。
      </p>
      <table>
        <tr><th>ファイル内の番号</th><th>中身</th><th>対応する章</th></tr>
        <tr><td>0. CONFIG</td><td>品種プリセット。太さや長さの数値</td><td><a href="ch01.html">01 手続き生成</a> / <a href="ch16.html">16 差分</a></td></tr>
        <tr><td>1. Rng</td><td>シード付き擬似乱数</td><td><a href="ch02.html">02 乱数</a></td></tr>
        <tr><td>2. Noise</td><td>値ノイズ / fBm</td><td><a href="ch03.html">03 ノイズ</a></td></tr>
        <tr><td>3. Mesh utils</td><td>巻き順の判定・法線の溶接・掃引</td><td><a href="ch05.html">05 面と法線</a> / <a href="ch10.html">10 曲がり</a></td></tr>
        <tr><td>4. Profile / Fields</td><td>断面のテーブル、稜やくぼみ、膨らみの場</td><td><a href="ch04.html">04 かたち</a></td></tr>
        <tr><td>5. TextureLab</td><td>アルベド・ORM・法線マップの生成</td><td><a href="ch06.html">06 テクスチャ</a> / <a href="ch15.html">15 毛</a></td></tr>
        <tr><td>6. 本体</td><td>その野菜そのものの組み立て</td><td><a href="ch09.html">09 部品</a></td></tr>
        <tr><td>7. Basket</td><td>ざる</td><td><a href="ch08.html">08 物理</a></td></tr>
        <tr><td>8. Scene / 物理</td><td>光・影・露出と Havok</td><td><a href="ch11.html">11 光</a> / <a href="ch08.html">08 物理</a></td></tr>
        <tr><td>9. GUI</td><td>右下のスライダー</td><td>—</td></tr>
      </table>
      <p>
        ただし、あとから加わった<b>ブロッコリー・カリフラワー・ロマネスコ</b>の3本は、
        この並びに収まりません。Profile も TextureLab も持たず、
        代わりに <b>Corymb</b>（散房花序の再帰）や <b>Fractal</b>（黄金角の再帰配置）という層があります。
      </p>
      <table>
        <tr><th>この3本だけにある番号</th><th>中身</th><th>対応する章</th></tr>
        <tr><td>4. Fields</td><td>頭部の包絡面 / 瘤の場 / 遮蔽（AO）</td><td><a href="ch14.html">14 頂点カラー</a></td></tr>
        <tr><td>5. Corymb / Fractal</td><td>房や小塔の再帰生成</td><td><a href="ch12.html">12 再帰</a> / <a href="ch13.html">13 螺旋</a></td></tr>
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
  // 第II部（12〜16章）で出てくる語を足す
  sec = sec.replace(
    "    </table>",
    `      <tr><td>再帰</td><td>関数が自分自身を呼ぶこと。枝分かれした形はこれで作る（<a href="ch12.html">12章</a>）。</td></tr>
      <tr><td>自己相似</td><td>どこを拡大しても同じ形が出てくる性質。ロマネスコがその代表。</td></tr>
      <tr><td>葉序 / phyllotaxis</td><td>植物が葉や種をつける並び方。137.5°ずつ回すのが基本（<a href="ch13.html">13章</a>）。</td></tr>
      <tr><td>黄金角</td><td>360° ÷ φ² ≒ 137.5°。もっとも重なりにくい角度。</td></tr>
      <tr><td>斜列 / parastichy</td><td>葉序の並びに目で見える螺旋。本数がフィボナッチ数になる。</td></tr>
      <tr><td>フィボナッチ格子</td><td>球や円板に点を等密度でばらまく方法。極でも混み合わない。</td></tr>
      <tr><td>散房花序</td><td>枝の長さを変えて花を同じ高さに揃える咲き方。ブロッコリーの頭はこれ。</td></tr>
      <tr><td>包絡面 / envelope</td><td>房の先端がそろって作る、頭全体のなめらかな面。</td></tr>
      <tr><td>頂点カラー</td><td>頂点ひとつずつが持つ色。テクスチャを貼らずに塗る（<a href="ch14.html">14章</a>）。</td></tr>
      <tr><td>遮蔽 / AO</td><td>すみっこに光が届かない暗さ。ここでは頂点の色へ焼き込んでいる。</td></tr>
      <tr><td>焼き込む / bake</td><td>実行のたびに計算せず、あらかじめ結果を色や画像へ書き込んでおくこと。</td></tr>
      <tr><td>シェル法 / shell fur</td><td>少し大きくしたコピーを重ねて毛を出す手法（<a href="ch15.html">15章</a>）。</td></tr>
      <tr><td>被覆率</td><td>親の面が子でどれだけ埋まっているかの比。1を切ると下地が見える。</td></tr>
    </table>`
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
  ["ch12.html", "12 再帰"],
  ["ch13.html", "13 螺旋"],
  ["ch14.html", "14 頂点色"],
  ["ch15.html", "15 毛"],
  ["ch16.html", "16 差分"],
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
${(o.scripts || []).map((s) => '<script src="' + s + '" defer></script>\n').join("")}<script src="assets/labs.js" defer></script>
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

/* ---------- サンプルを実行するページ ----------
   章立ての流れには入れないので、pages とは別に単独で書き出す。
   図鑑のサムネイルからここへ飛ぶ。 */
{
  const body = `<div class="wrap" style="--ch:var(--p-leaf)">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span><a href="zukan.html">図鑑</a><span class="sep">/</span>実行</p>
  <section class="chapter" id="play" style="--ch:var(--p-leaf);padding-top:26px">
    <div class="chapter-head">
      <div class="chnum" style="font-size:13px">RUN<small style="opacity:.7">PLAY</small></div>
      <div>
        <h2 id="playTitle">—</h2>
        <p class="sub">このページで、サンプルがそのまま動いています</p>
      </div>
    </div>
    <div class="body" style="max-width:none">
      <div class="playbar">
        <span id="playState">準備中…</span>
        <a id="playSrc" href="view.html">ソースを読む →</a>
        <a id="playRaw" href="#" target="_blank" rel="noopener">.js を直接開く ↗</a>
        <a href="zukan.html">図鑑へ戻る</a>
      </div>
      <div class="playstage" id="playStage">
        <canvas id="playCanvas" touch-action="none"></canvas>
      </div>
      <p class="hint" style="margin-top:10px">
        3Dモデルも写真も読み込んでいません。このページを開いた瞬間に、
        座標も模様も計算で作られています。組み立てに数秒かかります。
        右下のつまみで品種や個数を変えると、その場で作り直されます。
      </p>
    </div>
  </section>
</div>`;
  fs.writeFileSync(
    path.join(ROOT, "play.html"),
    shell({
      title: "サンプルを動かす",
      fullTitle: "サンプルを動かす — やさいのつくりかた",
      desc: "選んだサンプルをその場で実行します",
      cur: "zukan.html",
      body: body,
      scripts: ["assets/play.js"]
    }),
    "utf8"
  );
  console.log("wrote play.html");
}

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
  "start.html": "インストールなし。ブラウザだけで23本を動かす手順。まずここから。",
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
  "ch12.html": "ブロッコリーもロマネスコも、同じ手順を小さくしてくり返しただけ。むずかしいのは止め方。",
  "ch13.html": "137.5°ずつ回して置くだけで、8本・13本・21本の螺旋が勝手に現れる。",
  "ch14.html": "枝分かれした形にUVは張れない。色も影も、頂点ひとつずつに焼き込む。",
  "ch15.html": "産毛は法線マップでは出ない。少し大きい殻を重ねて、輪郭に毛を立てる。",
  "ch16.html": "ブロッコリーとカリフラワーは同じプログラム。色を白くしただけでは似ない。",
  "zukan.html": "23本それぞれの「そこでしか出てこない技術」の一覧。カードからソースへ飛べます。",
  "view.html": "23本の .js をその場で表示。全選択してコピーすれば、そのまま Playground に貼れます。",
  "terms.html": "法線、UV、巻き順、ORM……最初の1周で引っかかる言葉だけ。検索できます。"
};

const card = (p) => `      <a class="hubcard" href="${p.file}" style="--ch:${p.color}">
        <span class="no">${p.no}<span style="opacity:.55;margin-left:8px">${p.tag}</span></span>
        <h3>${p.title}</h3>
        <p>${p.blurb || HUB_BLURB[p.file] || ""}</p>
      </a>`;
const cardsFor = (files) =>
  pages.filter((p) => files.indexOf(p.file) >= 0).map(card).join("\n");

const PART1 = ["start.html", "ch01.html", "ch02.html", "ch03.html", "ch04.html",
  "ch05.html", "ch06.html", "ch07.html", "ch08.html", "ch09.html", "ch10.html", "ch11.html"];
const PART2 = ["ch12.html", "ch13.html", "ch14.html", "ch15.html", "ch16.html"];
const REFS = ["zukan.html", "view.html", "terms.html"];

const indexBody = `<section class="hero">
  <div class="hero-grid">
    <div>
      <p class="eyebrow">Babylon.js / procedural vegetables</p>
      <h1>3Dの野菜は、<br><span class="accent">数式から育つ</span>。</h1>
      <p class="lede">
        このサイトで扱う23本のプログラムは、3Dモデルも写真も1枚も読み込みません。
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
      <li><span class="rn">D</span><span class="rt"><b>もう一周した人</b><span>第II部（<a href="ch12.html">12</a>〜<a href="ch16.html">16</a>）へ。ブロッコリー・ロマネスコの3本は、第I部のやり方では作れません</span></span></li>
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
    <div class="chnum" style="font-size:15px">第I部<small style="opacity:.7">PART I</small></div>
    <div>
      <h2>1個の野菜をつくる（00〜11）</h2>
      <p class="sub">1本の .js ファイルを、上から順にほどいていく構成</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <div class="hub">
${cardsFor(PART1)}
    </div>
  </div>
</section>

<section class="chapter" id="chapters2" style="--ch:var(--p-leaf)">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">第II部<small style="opacity:.7">PART II</small></div>
    <div>
      <h2>構造そのものをつくる（12〜16）</h2>
      <p class="sub">回転体でも掃引でも作れない野菜が持ち込んだ、5つの技術</p>
    </div>
  </div>
  <div class="body">
    <p>
      第I部の11章は、ファイルの構成（CONFIG → Rng → Noise → Profile → TextureLab → 本体 …）に
      そのまま対応していました。ところが、あとから加わった<b>ブロッコリー・カリフラワー・ロマネスコ</b>は、
      その並びに収まりません。<b>横顔（Profile）が無く、テクスチャも1枚も使わない</b>からです。
      形は再帰で生え、色は頂点そのものが持っています。
      第II部は、層ではなく「作り方の種類」で立てた5章です。
    </p>
  </div>
  <div class="body" style="max-width:none">
    <div class="hub">
${cardsFor(PART2)}
    </div>
  </div>
</section>

<section class="chapter" id="refs" style="--ch:var(--p-corn)">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">資料<small style="opacity:.7">REFERENCE</small></div>
    <div>
      <h2>23本を引く</h2>
      <p class="sub">ファイルから逆に読みたいとき</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <div class="hub">
${cardsFor(REFS)}
    </div>
  </div>
</section>

</div>`;

fs.writeFileSync(
  path.join(ROOT, "index.html"),
  shell({
    fullTitle: "やさいのつくりかた — コードで野菜を育てる技術ノート",
    cur: "index.html",
    desc: "Babylon.js で野菜を手続き的に生成する23本のサンプルを、中学生・高校生向けに解説する学習ポータル",
    body: indexBody
  }),
  "utf8"
);
console.log("wrote index.html");
