// =====================================================================
//  Photoreal Romanesco  /  写実的なロマネスコ
//  BUILD: romanesco-A
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  ブロッコリー版・カリフラワー版と、茎・葉柄・ざる・物理・GUI は共通です。
//  ただし頭部の作り方だけは完全に別物になります。
//
//  【対策】ロマネスコを「ブロッコリーの房を尖らせたもの」と考えると
//          絶対に似ません。この野菜の正体は次の2つに尽きます。
//
//          (a) 親の円錐面の上に、子を「頂点からの距離が等比数列
//              s_i = S·λ^i、方位が黄金角 137.5°ずつ」で置く
//          (b) 子の大きさを s_i に比例させる
//
//          この2つが揃うと自己相似になり、見る向きによって
//          8本・13本・21本と数の変わる螺旋（斜列）が「勝手に」現れます。
//          螺旋を線として描こうとしたり、子を等間隔に並べたりすると、
//          ただのイガグリで終わります。
//
//  他に、実物と見比べて外せなかった点:
//
//  ・小塔は素の円錐ではない。根元がふくらんで先が細く伸びる尖塔形
//    （母線 r = ρ(1-t)^1.15）。pow = 1 の直円錐だとパーティ帽の山になる
//  ・頭全体だけは逆に外へ張り出した釣鐘形（pow = 0.62）
//  ・子の軸は「親の面の法線」ではなく、そこから親の軸へ大きく寄せた向き。
//    寄せ方が足りないと小塔が真横へ張り出し、上から見て星形になる。
//    実物はどの小塔も頭のてっぺんを向いて寝ており、輪郭は
//    「段のついた三角錐」であって放射状のヒトデではない
//  ・頭の底は絞れている（tuck）。素の円錐だと底が最大径のまま平らな
//    円盤で残り、下端の小塔がそこからぶら下がって真っ黒な空洞ができる
//  ・子の大きさは「親の公称半径」ではなく「その場所の局所半径」で決める。
//    絞った底に公称半径ぶんの巨大な小塔が刺さるとヒトデに戻る
//  ・分岐を「何階層まで」で止めてはいけない。頭の下側の大きな小塔は
//    3階層では末端が 1cm 近くになり、つるつるの大きな瘤に見える。
//    実物は大きい小塔ほど深く分岐し、末端の粒の絶対サイズが
//    どこでも 1〜2mm に揃っている。打ち切りは minChild（cm）で決める
//  ・暗さは「頭の輪郭からどれだけ引っ込んでいるか」でほぼ決まる。
//    数千個の円錐を総当たりする必要はない
//  ・色は一様な黄緑ではない。小塔ごとに黄色寄り・青緑寄りのばらつきがある
//
//  【対策】写真計測されたロマネスコを調べると、ジオメトリは驚くほど粗く、
//          螺旋の細部はすべて法線マップに入っている。細部を頂点変位で
//          出そうとすると、斜列 21 本を解像するのに周方向 60 分割以上が
//          要り、末端が数千個あるので必ず破綻する。
//  【対策】この野菜には都合のよい性質がある。対数極座標
//          (x, y) = (θ/2π, ln f / ln λ) の上では、葉序の格子は
//          どの階層でも まったく同じ形になる。つまり 1 枚のテクスチャを
//          全部の円錐に貼り回せる。ジオメトリは輪郭だけを担当する
//  【対策】粒の半径は「格子の目盛」ではなく「最近接の節点までの距離」で
//          決める。黄金角の格子では最近接は 1 つ隣ではなくフィボナッチ数
//          だけ離れた節点で、その距離は 5〜6 目盛にもなる。目盛で 0.6 と
//          決めていたため、粒がぽつぽつ散った点描になっていた
//  【対策】末端まで実ジオメトリで分岐させることは原理的にできない。
//          子の大きさの比 k で 1 階層あたり k 倍にしか縮まないので、
//          4.6cm の頭から 1mm の粒まで届くには k = 0.5 でも 5.5 階層、
//          被覆に必要な個数を掛けると 10^7 個になる。実物のロマネスコは
//          本当にその規模で分岐している。
//          そこで末端は「面に葉序の粒を彫る」ことで代用する。
//          対数極座標 (x, y) = (θ/2π, ln f / ln λ) の上では、葉序の節点は
//          (i·0.382 mod 1, i) という単純な格子になる。最寄りの節点までの
//          距離を測って丸い山を立てれば、そのまま螺旋に並んだ粒になる。
//          余弦波の和で作るとうねった尾根になり、粒には見えない。
//  【対策】彫った粒を解像するには、周方向に斜列の本数の 3 倍、
//          母線方向に節点の数の 2 倍の分割が要る。ここを削ると
//          模様が潰れて、ただの滑らかな円錐に戻る（実際それで
//          何度も「素体が見えている」と誤診した）。
//          そのため末端の個数より、末端 1 個あたりの分割を優先する
//
//  構造の確認用に、GUI の「表示」に 断面 を用意した（scene.clipPlane で
//  z > 0 側を捨てる）。この模型は「閉じた円錐の殻」を入れ子にしたもので、
//  内部は空洞である。実物は白い髄が中心にあり、そこから枝が放射している。
//  外から見るぶんには差は出ないが、半割りを作りたい場合は髄と枝を
//  別に生やす必要がある
// =====================================================================

var createScene = async function () {

    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    // レベルごとの円錐と螺旋の設定
    // lambda … 頂点からの距離の等比。子の個数は log(minFrac)/log(lambda)
    // coneK  … 子の底面半径 / 親の底面半径（頂点からの距離比で割り引く前）
    // tilt   … 子の軸を親の軸へ寄せる割合（0 = 面法線のまま）
    // 【対策】この螺旋が自己相似になる条件は「親の母線が直線（pow ≒ 1）」。
    //         親を釣鐘形（pow = 0.62）にすると、頂点へ近づくほど面積が
    //         子の面積より速く残り、被覆率が 0.31 → 0.12 と落ちていく。
    //         結果、小塔がまばらに散った「つるつるの円錐」になる。
    //         被覆率 = coneK²·ρ / (2·S·(1-λ))  ≒ 1 になるよう組で決める
    // 【対策】被覆率 = coneK²·ρ / (2·S·(1-λ)) が 1 を切ると、親の面が
    //         そのまま見えて「つるつるの円錐に粒が点在する」絵になる。
    //         写真の実物は、どの階層でも親の面が完全に子で埋まっている。
    // 【対策】そのうえで、子は親の 1/4 前後でなければならない。前の版は
    //         0.55 まで大きくして数を減らしていたが、写真を数えると
    //         親1個あたり 25〜40 個の子が螺旋に並んでいる。
    //         大きさの比 k と1階層あたりの個数 N は独立に決められない：
    //         3階層で末端が 1mm 台になるには k ≒ 0.25、
    //         そのとき面を埋めるのに要る N は 28 前後、λ = 0.22^(1/N)
    // 【対策】子の大きさの比 k と、1階層あたりの個数 N は独立に決められない。
    //         親の側面積 πρS を子の底面積 πk²ρ² で埋めるので、
    //             被覆率 = k²·ρ / ( S · (1 - λ²) ),  N = ln(minFrac)/ln(λ)
    //         被覆率が 1 を切ると親の面が露出して「つるつるの円錐に粒が
    //         点在する」絵になり、逆に k を写真どおり 0.25 まで小さくすると
    //         被覆に必要な N が 120 を超え、3階層で 170 万個になって破綻する。
    //         被覆率 1.3 を保ったまま実時間で組める上限が k ≒ 0.50 / N ≒ 29。
    //         末端が写真より一段粗くなるぶんは、末端円錐の面に細かい
    //         凹凸（tipBump）を入れて補う
    // 【対策】pow を 1 より大きくすると母線が凹み、子を置き終えた先が
    //         「長い滑らかな針」として残る。実物の小塔の先端も尖っては
    //         いるが、それは短い円錐であって針ではない。アザミや
    //         ドリアンに見えていた原因はここ。母線はほぼ直線にする
    // 【対策】minFrac は「頂点側の何割に子を置かないか」でもある。0.23 だと
    //         円錐の先 23% が裸のまま残り、aspect が高いとそこが長い針になる
    const LEVELS_STD = [
        // 0 : 頭全体。ほぼ直円錐
        { pow: 0.96, seg: 200, ring: 90, segTip: 200, ringTip: 90,
          lambda: 0.9598, minFrac: 0.060, startFrac: 0.995, coneK: 0.520, aspect: 2.43,
          tuck: 0.46, tilt: 0.62, tiltBase: 0.40, sink: 0.30, jitterA: 0.028, jitterT: 0.009 },
        // 1 : 一次の小塔
        { pow: 1.03, seg: 44, ring: 22, segTip: 22, ringTip: 13,
          lambda: 0.9400, minFrac: 0.190, startFrac: 0.97, coneK: 0.530, aspect: 1.34,
          tuck: 0.0, tilt: 0.56, tiltBase: 0.34, sink: 0.30, jitterA: 0.042, jitterT: 0.013 },
        // 2 : 二次
        { pow: 1.04, seg: 16, ring: 9, segTip: 17, ringTip: 10,
          lambda: 0.9395, minFrac: 0.190, startFrac: 0.97, coneK: 0.530, aspect: 1.32,
          tuck: 0.0, tilt: 0.56, tiltBase: 0.36, sink: 0.30, jitterA: 0.056, jitterT: 0.017 },
        // 3 : 三次（末端）
        { pow: 1.06, seg: 12, ring: 7, segTip: 15, ringTip: 9,
          lambda: 0.9395, minFrac: 0.190, startFrac: 0.97, coneK: 0.530, aspect: 1.30,
          tuck: 0.0, tilt: 0.58, tiltBase: 0.38, sink: 0.30, jitterA: 0.070, jitterT: 0.020 }
    ];

    const PRESETS = {
        standard: {
            label: "ロマネスコ（標準）",

            // --- 主茎
            stemH: 4.60, stemR: 1.85, stemTopR: 1.82,
            stemFlutes: 7, fluteAmp: 0.048, stemBell: 0.13, stemLobe: 0.048,
            scarCount: 0, scarSize: 0.0,

            // --- 頭
            headRho: 4.60,         // 底面半径（最大径は底より少し上）
            headH: 11.20,          // 高さ
            headSink: 0.55,        // 茎へ潜らせる量
            // 【対策】ジオメトリの再帰は2階層で打ち止め、3階層目から下は
            //         面に彫った葉序模様で表す。実ジオメトリで潜ると、
            //         被覆に必要な個数が指数で効いて必ず破綻する
            maxLevel: 3,
            minChild: 0.115,       // 末端の円錐の半径（cm）
            coreDim: 0.97,         // 親の面をどれだけ沈めるか（1 = 沈めない）
            headDim: 0.90,         // 頭全体の円錐（素体）の沈め方
            // 【対策】素体（頭と一次小塔）は必ず 1 割ほど覗く。そこが
            //         滑らかだと「つるつるの殻が透けている」と読める。
            //         凹凸を入れてあっても、メッシュが粗いと解像できない。
            //         大きな親の面だけ分割を上げて、凹凸を効かせる
            bumpAbs: 0.048,        // 全部の円錐面に入れる細かい凹凸（cm）
            bumpFreq: 30.0,
            spiralAmp: 0.26,       // 面に彫り込む葉序模様の深さ（局所半径比）
            spiralFine: 0.45,      // 1段細かい粒の混ぜ具合
            budRadius: 0.62,       // 粒の半径（最近接の節点までの距離に対する比）
            // 【対策】彫る粒の螺旋は、子を置く螺旋と同じ λ である必要はない。
            //         同じにすると「粒の細かさ」と「子の個数」が連動し、
            //         片方を直すともう片方が壊れる。分けて持つ
            budLambda: 0.900,
            // 法線マップ側の設定。budTexAR は「1周 2πr が y の1目盛の
            // 何倍か」で、これを外すと粒が周方向へ引き伸ばされて縞になる
            budTexSize: 1024,
            budTexRows: 21,
            budTexAR: 36.3,
            budTexStrength: 26.0,
            budBumpLevel: 1.0,
            levels: LEVELS_STD,

            // --- 遮蔽
            aoDepth: 1.60,         // 頭の輪郭から何cm引っ込むと真っ暗か
            aoFloor: 0.26,

            // --- 葉柄の切り跡
            leafCount: 10,
            leafCutRatio: 1.00,
            ribW: 0.70, ribT: 0.32,
            ribLenCut: 2.9, ribLenFull: 10.0,
            bladeW: 1.9, bladeCup: 0.40, bladeWave: 0.42, leafVeins: 3.2,

            // --- 色（sRGB）
            tipCol: [0.635, 0.700, 0.252],
            sideCol: [0.412, 0.505, 0.150],
            deepCol: [0.092, 0.142, 0.036],
            coreCol: [0.240, 0.320, 0.080],
            yellowCol: [0.735, 0.760, 0.280],
            yellowAmt: 0.30,

            branchHi: [0.560, 0.660, 0.290],
            branchLo: [0.420, 0.520, 0.190],
            stemHi: [0.640, 0.740, 0.360],
            stemLo: [0.470, 0.575, 0.240],
            stemScar: [0.790, 0.840, 0.520],
            cutRind: [0.330, 0.450, 0.165],
            cutFlesh: [0.860, 0.880, 0.660],
            cutCore: [0.790, 0.830, 0.585],
            cutVein: [0.610, 0.690, 0.410],
            bladeTop: [0.245, 0.375, 0.150],
            bladeVein: [0.575, 0.670, 0.340],
            ribCol: [0.640, 0.740, 0.370],
            ribCut: [0.845, 0.875, 0.640],

            budRough: 0.78, stemRough: 0.42, stemCoat: 0.24
        },

        tall: {
            label: "とんがり（高い頭）",
            stemH: 4.20, stemR: 1.72, stemTopR: 1.70,
            stemFlutes: 7, fluteAmp: 0.046, stemBell: 0.12, stemLobe: 0.046,
            scarCount: 0, scarSize: 0.0,
            headRho: 4.10, headH: 12.20, headSink: 0.50,
            maxLevel: 3, minChild: 0.108, coreDim: 0.97, headDim: 0.90, bumpAbs: 0.048, bumpFreq: 31.0, spiralAmp: 0.26, spiralFine: 0.45, budRadius: 0.58, budLambda: 0.902, budTexSize: 1024, budTexRows: 21, budTexAR: 34.0, budTexStrength: 26.0, budBumpLevel: 1.0,
            levels: LEVELS_STD.map((L, i) => Object.assign({}, L, {
                pow: [1.02, 1.05, 1.06, 1.08][i],
                lambda: [0.9640, 0.9490, 0.9480, 0.9480][i],
                aspect: [2.98, 1.40, 1.38, 1.36][i]
            })),
            aoDepth: 1.50, aoFloor: 0.25,
            leafCount: 9, leafCutRatio: 1.00,
            ribW: 0.64, ribT: 0.30, ribLenCut: 2.7, ribLenFull: 9.4,
            bladeW: 1.8, bladeCup: 0.40, bladeWave: 0.42, leafVeins: 3.2,
            tipCol: [0.615, 0.685, 0.235],
            sideCol: [0.392, 0.488, 0.138],
            deepCol: [0.086, 0.134, 0.032],
            coreCol: [0.222, 0.302, 0.072],
            yellowCol: [0.718, 0.745, 0.265],
            yellowAmt: 0.26,
            branchHi: [0.545, 0.648, 0.276],
            branchLo: [0.405, 0.505, 0.180],
            stemHi: [0.625, 0.728, 0.345],
            stemLo: [0.455, 0.562, 0.230],
            stemScar: [0.780, 0.832, 0.508],
            cutRind: [0.322, 0.442, 0.158],
            cutFlesh: [0.852, 0.874, 0.650],
            cutCore: [0.782, 0.824, 0.576],
            cutVein: [0.602, 0.682, 0.402],
            bladeTop: [0.235, 0.365, 0.144],
            bladeVein: [0.565, 0.660, 0.332],
            ribCol: [0.628, 0.730, 0.358],
            ribCut: [0.838, 0.868, 0.630],
            budRough: 0.78, stemRough: 0.42, stemCoat: 0.24
        },

        fine: {
            label: "きめ細かい（小塔が多い）",
            stemH: 4.40, stemR: 1.80, stemTopR: 1.78,
            stemFlutes: 7, fluteAmp: 0.048, stemBell: 0.13, stemLobe: 0.048,
            scarCount: 0, scarSize: 0.0,
            headRho: 4.45, headH: 10.60, headSink: 0.55,
            maxLevel: 3, minChild: 0.098, coreDim: 0.97, headDim: 0.91, bumpAbs: 0.046, bumpFreq: 34.0, spiralAmp: 0.28, spiralFine: 0.48, budRadius: 0.56, budLambda: 0.896, budTexSize: 1024, budTexRows: 21, budTexAR: 38.0, budTexStrength: 28.0, budBumpLevel: 1.05,
            levels: LEVELS_STD.map((L, i) => Object.assign({}, L, {
                pow: [0.98, 1.03, 1.04, 1.06][i],
                aspectHead: 0,
                lambda: [0.9615, 0.9550, 0.9545, 0.9545][i],
                minFrac: [0.048, 0.185, 0.185, 0.185][i],
                aspect: [2.38, 1.30, 1.28, 1.26][i],
                coneK: [0.480, 0.458, 0.460, 0.462][i]
            })),
            aoDepth: 1.45, aoFloor: 0.28,
            leafCount: 10, leafCutRatio: 1.00,
            ribW: 0.68, ribT: 0.31, ribLenCut: 2.8, ribLenFull: 9.6,
            bladeW: 1.9, bladeCup: 0.40, bladeWave: 0.42, leafVeins: 3.2,
            tipCol: [0.652, 0.712, 0.268],
            sideCol: [0.425, 0.518, 0.162],
            deepCol: [0.098, 0.150, 0.040],
            coreCol: [0.252, 0.334, 0.086],
            yellowCol: [0.748, 0.772, 0.292],
            yellowAmt: 0.34,
            branchHi: [0.570, 0.670, 0.300],
            branchLo: [0.430, 0.530, 0.198],
            stemHi: [0.650, 0.748, 0.368],
            stemLo: [0.478, 0.582, 0.248],
            stemScar: [0.796, 0.845, 0.528],
            cutRind: [0.336, 0.456, 0.170],
            cutFlesh: [0.865, 0.884, 0.666],
            cutCore: [0.795, 0.835, 0.590],
            cutVein: [0.616, 0.695, 0.416],
            bladeTop: [0.250, 0.382, 0.155],
            bladeVein: [0.582, 0.676, 0.346],
            ribCol: [0.648, 0.746, 0.376],
            ribCut: [0.850, 0.880, 0.646],
            budRough: 0.78, stemRough: 0.42, stemCoat: 0.24
        }
    };

    const GLOBAL = {
        pose: 0,                   // 0 = 立てる（写真の向き） / 1 = 寝かせる
        quality: 1,                // 0 = 粗い / 1 = 標準 / 2 = 細かい

        // ざる
        showBasket: true,
        basketRim: 15.0,
        basketDepth: 5.0,
        basketThick: 0.50,
        basketSegments: 96,
        basketRings: 34,

        // 物理（ざるへ落として据わらせる）
        // 【対策】1単位 = 1cm なので重力も cm/s² で与える。9.8 のままだと
        //         100 倍ゆっくり沈み、水中を漂っているように見える
        gravity: 600,
        physicsHz: 120,
        dropHeight: 2.6,
        pieceMass: 0.45,
        friction: 0.95,
        restitution: 0.01,
        linearDamping: 0.22,
        angularDamping: 0.94,
        settleSpeed: 3.0, settleSpin: 3.0, settleHold: 0.40,
        settleTimeout: 7.0,

        // 遮蔽（頂点に焼く AO）
        // 【対策】ここが弱いと、粒が何万個あっても平板な緑の塊に見える。
        //         逆に強すぎると房の谷が真っ黒に潰れて炭になる
        // 【対策】白いので谷まで光が回り込む。ブロッコリーと同じ遮蔽を
        //         掛けると、白い塊に墨を流したようになる
        aoStrength: 0.48,
        aoFloor: 0.56,
        aoRange: 3.0,
        skinShrink: 0.95,          // 下地を粒より奥へ引っ込める割合              // 何倍の半径まで隣のドームを見るか

        stemSides: 72,
        stemRings: 46,
        branchSides: 12,
        branchRings: 9,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.072,
        dofFStop: 2.6,

        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    // 粒の細かさ。間隔と半径を同時に動かす
    // 【対策】間隔だけ変えると密度が変わって「まばらな粒」「団子」になる。
    //         見た目を保ったまま数だけ増減させるには半径も同率で動かす
    const QUALITY = [
        { label: "粗い", k: 1.34 },
        { label: "標準", k: 1.00 },
        { label: "細かい", k: 0.82 }
    ];

    const START_VARIETY = "standard";
    const START_SEED = 20260808;
    const BUILD = "romanesco-M";

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        const q = QUALITY[clamp(cfg.quality, 0, 2)].k;
        cfg.budR = cfg.budR * q;
        // 包絡面の面積。上半球 + 赤道下の張り出しぶんを 0.78 で見積もる
        cfg.headArea = TAU * cfg.headRx * cfg.headRx * 0.95;
        cfg.headRy = cfg.headRx * cfg.headFlat;
        return cfg;
    }

    // 主茎の半径プロファイル（切り口 → 分岐）。相対値
    // 【対策】切り口 1.00 に対し、1/3 上がった所が 0.75 まで細る。
    //         この「くびれ」が無いと円柱になり、ブロッコリーに見えない
    // 枝の起点を茎のどこに潜らせるか
    // 寝かせたとき、茎の先（切り口）が向く world 方向。
    // 既定カメラ（α = -1.05 / β = 1.16）で画面の右やや下になるよう逆算した値
    const POSE_LIE = new BABYLON.Vector3(-0.890, 0.180, -0.421);

    const BRANCH_ROOT_S = 0.84;

    const STEM_PROFILE = [1.000, 0.862, 0.792, 0.760, 0.774, 0.828, 0.906, 0.990];

    // =================================================================
    // 1. Rng
    // =================================================================
    class Rng {
        constructor(seed) { this.s = seed >>> 0; }
        next() {
            this.s = (this.s + 0x6D2B79F5) | 0;
            let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
        range(a, b) { return a + (b - a) * this.next(); }
        gauss(m, sd) {
            const u = Math.max(1e-9, this.next()), v = this.next();
            return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
        }
        int(n) { return Math.floor(this.next() * n) % n; }
    }

    // =================================================================
    // 2. Noise
    // =================================================================
    const Noise = {
        _h3(x, y, z, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
                ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 2166136261);
            h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
            return (h >>> 0) / 4294967295;
        },
        v3(x, y, z, seed) {
            const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
            const xf = x - xi, yf = y - yi, zf = z - zi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
            const H = this._h3;
            const c000 = H(xi, yi, zi, seed), c100 = H(xi + 1, yi, zi, seed);
            const c010 = H(xi, yi + 1, zi, seed), c110 = H(xi + 1, yi + 1, zi, seed);
            const c001 = H(xi, yi, zi + 1, seed), c101 = H(xi + 1, yi, zi + 1, seed);
            const c011 = H(xi, yi + 1, zi + 1, seed), c111 = H(xi + 1, yi + 1, zi + 1, seed);
            const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
            const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
            const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
            return y0 + (y1 - y0) * w;
        },
        fbm3(x, y, z, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) { s += a * this.v3(x * f, y * f, z * f, seed + o * 137); n += a; f *= 2; a *= 0.5; }
            return s / n;
        },
        _h2(x, y, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
            return (h >>> 0) / 4294967295;
        },
        v2u(x, y, px, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const p = Math.max(1, px | 0);
            let x0 = xi % p; if (x0 < 0) x0 += p;
            let x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
            const a = this._h2(x0, yi, seed), b = this._h2(x1, yi, seed);
            const c = this._h2(x0, yi + 1, seed), d = this._h2(x1, yi + 1, seed);
            const t0 = a + (b - a) * u, t1 = c + (d - c) * u;
            return t0 + (t1 - t0) * v;
        },
        fbm2u(x, y, period, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * this.v2u(x * f, y * f, (period * f) | 0, seed + o * 131);
                n += a; f *= 2; a *= 0.5;
            }
            return s / n;
        }
    };

    // =================================================================
    // 3. Mesh utils
    // =================================================================
    // --- 素のベクトル演算。Vector3 を何十万回も作ると GC で固まる ------
    const vec = (x, y, z) => ({ x, y, z });
    const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
    const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const vmul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
    const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const vcross = (a, b) => ({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    });
    const vlen = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    function vnorm(a) { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }

    // n に直交する2軸。n が上向きに近いときだけ基準軸を切り替える
    function basisFrom(n) {
        const a = Math.abs(n.y) < 0.90 ? vec(0, 1, 0) : vec(1, 0, 0);
        const e1 = vnorm(vcross(a, n));
        const e2 = vcross(n, e1);
        return { e1, e2 };
    }

    // t を軸に、開き角 ang・方位 phi の方向を作る
    function coneDir(t, ang, phi, e1, e2) {
        const s = Math.sin(ang), c = Math.cos(ang);
        return vnorm(vec(
            t.x * c + (e1.x * Math.cos(phi) + e2.x * Math.sin(phi)) * s,
            t.y * c + (e1.y * Math.cos(phi) + e2.y * Math.sin(phi)) * s,
            t.z * c + (e1.z * Math.cos(phi) + e2.z * Math.sin(phi)) * s
        ));
    }

    // --- 頂点バッファ -------------------------------------------------
    // 【対策】枝も蕾も1枚のメッシュにまとめる。粒だけで数十万頂点になるので
    //         配列 push ではなく型付き配列に直接書く。容量は足りなくなったら倍にする
    class MeshBuf {
        constructor(maxV, maxT) {
            maxV = Math.max(64, maxV | 0); maxT = Math.max(64, maxT | 0);
            this.pos = new Float32Array(maxV * 3);
            this.nrm = new Float32Array(maxV * 3);
            this.col = new Float32Array(maxV * 4);
            this.uv = new Float32Array(maxV * 2);
            this.idx = new Uint32Array(maxT * 3);
            this.nv = 0; this.nt = 0;
        }
        _growV() {
            const m = (this.pos.length / 3) * 2;
            const p = new Float32Array(m * 3); p.set(this.pos); this.pos = p;
            const n = new Float32Array(m * 3); n.set(this.nrm); this.nrm = n;
            const c = new Float32Array(m * 4); c.set(this.col); this.col = c;
            const u = new Float32Array(m * 2); u.set(this.uv); this.uv = u;
        }
        _growT() {
            const m = (this.idx.length / 3) * 2;
            const a = new Uint32Array(m * 3); a.set(this.idx); this.idx = a;
        }
        vert(x, y, z, nx, ny, nz, r, g, b, u, v) {
            if ((this.nv + 1) * 3 > this.pos.length) this._growV();
            const i = this.nv++, p = i * 3, q = i * 4, w = i * 2;
            this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
            this.nrm[p] = nx; this.nrm[p + 1] = ny; this.nrm[p + 2] = nz;
            this.col[q] = r; this.col[q + 1] = g; this.col[q + 2] = b; this.col[q + 3] = 1;
            this.uv[w] = u || 0; this.uv[w + 1] = v || 0;
            return i;
        }
        tri(a, b, c) {
            if ((this.nt + 1) * 3 > this.idx.length) this._growT();
            const t = this.nt++ * 3;
            this.idx[t] = a; this.idx[t + 1] = b; this.idx[t + 2] = c;
        }
        quad(a, b, c, d) { this.tri(a, c, b); this.tri(b, c, d); }

        // 【対策】巻き順を手で合わせようとすると、掃引・ドーム・粒・葉痕で
        //         必ずどれか裏返る。法線は全部こちらで解析的に持っているので、
        //         「面法線と頂点法線が同じ側を向いているか」で判定して
        //         合わない側へ倒す。Babylon の ComputeNormals は
        //         (P1-P2)×(P3-P2) を面法線とするので、その式に揃える
        orient() {
            const P = this.pos, N = this.nrm, I = this.idx;
            let flipped = 0;
            for (let t = 0; t < this.nt; t++) {
                const i0 = I[t * 3] * 3, i1 = I[t * 3 + 1] * 3, i2 = I[t * 3 + 2] * 3;
                const ax = P[i0] - P[i1], ay = P[i0 + 1] - P[i1 + 1], az = P[i0 + 2] - P[i1 + 2];
                const bx = P[i2] - P[i1], by = P[i2 + 1] - P[i1 + 1], bz = P[i2 + 2] - P[i1 + 2];
                const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
                const nx = N[i0] + N[i1] + N[i2], ny = N[i0 + 1] + N[i1 + 1] + N[i2 + 1];
                const nz = N[i0 + 2] + N[i1 + 2] + N[i2 + 2];
                if (fx * nx + fy * ny + fz * nz < 0) {
                    const a = I[t * 3 + 1]; I[t * 3 + 1] = I[t * 3 + 2]; I[t * 3 + 2] = a;
                    flipped++;
                }
            }
            return flipped;
        }

        toMesh(name, scene) {
            this.orient();
            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = this.pos.slice(0, this.nv * 3);
            vd.normals = this.nrm.slice(0, this.nv * 3);
            vd.colors = this.col.slice(0, this.nv * 4);
            vd.uvs = this.uv.slice(0, this.nv * 2);
            vd.indices = this.idx.slice(0, this.nt * 3);
            vd.applyToMesh(mesh, false);
            // 【対策】頂点カラーを stride 4 で入れると hasVertexAlpha が立ち、
            //         不透明なのに透過パスへ回される。透過パスは深度書き込みが
            //         切られるので、粒どうしが互いを正しく隠せなくなる
            mesh.hasVertexAlpha = false;
            return mesh;
        }
    }

    // --- 巻き順の自動判定・法線の溶接（ざる用）------------------------
    function finalize(positions, indices, center, refIndex) {
        let normals = new Float32Array(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        const k = refIndex * 3;
        const dot = normals[k] * (positions[k] - center.x)
            + normals[k + 1] * (positions[k + 1] - center.y)
            + normals[k + 2] * (positions[k + 2] - center.z);
        if (dot < 0) {
            for (let i = 0; i < indices.length; i += 3) {
                const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
            }
            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        }
        return normals;
    }

    function weldNormals(positions, normals) {
        const map = new Map();
        const n = positions.length / 3;
        for (let i = 0; i < n; i++) {
            const k = Math.round(positions[i * 3] * 8192) + "," +
                Math.round(positions[i * 3 + 1] * 8192) + "," +
                Math.round(positions[i * 3 + 2] * 8192);
            let a = map.get(k); if (!a) { a = []; map.set(k, a); }
            a.push(i);
        }
        for (const a of map.values()) {
            if (a.length < 2) continue;
            let nx = 0, ny = 0, nz = 0;
            for (const i of a) { nx += normals[i * 3]; ny += normals[i * 3 + 1]; nz += normals[i * 3 + 2]; }
            const l = Math.hypot(nx, ny, nz) || 1;
            for (const i of a) { normals[i * 3] = nx / l; normals[i * 3 + 1] = ny / l; normals[i * 3 + 2] = nz / l; }
        }
    }

    function makeMesh(name, positions, indices, normals, uvs, colors, scene) {
        const mesh = new BABYLON.Mesh(name, scene);
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.indices = indices; vd.normals = normals;
        if (uvs) vd.uvs = uvs;
        if (colors) vd.colors = colors;
        vd.applyToMesh(mesh, false);
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // --- 正二十面体（蕾の粒の素）--------------------------------------
    // 【対策】粒1個は画面上で数ピクセル。球で作ると面数が10倍になるだけで
    //         違いが見えない。正二十面体を「法線＝頂点方向」で貼れば、
    //         シルエットは20面でも陰影は球に見える
    const ICO = (function () {
        const g = (1 + Math.sqrt(5)) / 2;
        const raw = [
            [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0],
            [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g],
            [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]
        ];
        const V = raw.map((p) => vnorm(vec(p[0], p[1], p[2])));
        const F = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
        ];
        return { V, F };
    })();

    // --- 掃引管 -------------------------------------------------------
    // path: 中心線の点列 / radii: 各点の半径 / colFn(s, phi, p) → [r,g,b] (sRGB)
    // 【対策】フレームを毎回 basisFrom() で作り直すと、中心線が曲がった
    //         ところで基準軸が飛び、リング間で1周ぶんねじれる。
    //         前のリングの法線を投影して運ぶ（回転最小フレーム）
    function tube(buf, path, radii, sides, colFn, shapeFn, capEnd, endNormal) {
        const N = path.length;
        if (N < 2) return null;
        const T = [];
        for (let i = 0; i < N; i++) {
            const a = path[Math.max(0, i - 1)], b = path[Math.min(N - 1, i + 1)];
            T.push(vnorm(vsub(b, a)));
        }
        const NR = [], BR = [];
        let n0 = basisFrom(T[0]).e1;
        for (let i = 0; i < N; i++) {
            let n = vsub(n0, vmul(T[i], vdot(n0, T[i])));
            if (vlen(n) < 1e-4) n = basisFrom(T[i]).e1;
            n = vnorm(n);
            NR.push(n); BR.push(vcross(T[i], n));
            n0 = n;
        }
        const base = buf.nv;
        const M = sides;
        for (let i = 0; i < N; i++) {
            const c = path[i], r = radii[i], s = i / (N - 1);
            const dr = (i < N - 1 ? radii[i + 1] - radii[i] : radii[i] - radii[i - 1]);
            const ds = (i < N - 1 ? vlen(vsub(path[i + 1], path[i])) : vlen(vsub(path[i], path[i - 1]))) || 1e-4;
            const slope = dr / ds;
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * TAU;
                const cs = Math.cos(phi), sn = Math.sin(phi);
                const k = shapeFn ? shapeFn(s, phi) : 1;
                const rr = r * k;
                const px = c.x + (NR[i].x * cs + BR[i].x * sn) * rr;
                const py = c.y + (NR[i].y * cs + BR[i].y * sn) * rr;
                const pz = c.z + (NR[i].z * cs + BR[i].z * sn) * rr;
                // 半径変化ぶん軸方向へ倒した法線
                const rx = NR[i].x * cs + BR[i].x * sn;
                const ry = NR[i].y * cs + BR[i].y * sn;
                const rz = NR[i].z * cs + BR[i].z * sn;
                const nx = rx - T[i].x * slope, ny = ry - T[i].y * slope, nz = rz - T[i].z * slope;
                const l = Math.hypot(nx, ny, nz) || 1;
                const col = colFn(s, phi, px, py, pz);
                buf.vert(px, py, pz, nx / l, ny / l, nz / l, col[0], col[1], col[2]);
            }
        }
        const W = M + 1;
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
            const A = base + i * W + j, B = A + 1, C = A + W, D = C + 1;
            buf.quad(A, B, C, D);
        }
        if (capEnd) {
            const c = path[N - 1], en = endNormal || T[N - 1];
            const col = colFn(1, 0, c.x, c.y, c.z);
            const ci = buf.vert(c.x, c.y, c.z, en.x, en.y, en.z, col[0], col[1], col[2]);
            const o = base + (N - 1) * W;
            for (let j = 0; j < M; j++) buf.tri(ci, o + j, o + j + 1);
        }
        return base;
    }


    // =================================================================
    // 4. Cone （円錐面の幾何）
    // =================================================================
    // 円錐は「底面中心 base ・軸 axis ・底面半径 rho ・高さ H」で持つ。
    // 母線は直線ではなく r(t) = rho * (1-t)^pow の曲線。
    // 【対策】pow = 1 の素の円錐にすると、パーティ帽を積み上げたようになる。
    //         実物の小塔は根元がふくらんで先が細く伸びる尖塔形（pow > 1）、
    //         頭全体だけは逆に外へ張り出した釣鐘形（pow < 1）
    // 母線 r(t)。pow で反り、tuck で「底だけ内側へ絞る」
    // 【対策】頭全体を素の円錐にすると、底面が最大径のまま平らな円盤として
    //         残る。実物のロマネスコは、いちばん外へ張り出すのが底から
    //         2割ほど上がった所で、底はそこから茎へ向かって絞れている。
    //         絞らないと、下端の小塔が円盤の縁からぶら下がって
    //         その下に真っ黒な空洞ができる
    function coneR(rho, pow, tuck, t) {
        const u = Math.max(0, 1 - t);
        let r = rho * Math.pow(u, pow);
        if (tuck > 0) r *= 1 - tuck * Math.pow(1 - smooth(0, 0.22, t), 2.0);
        return r;
    }

    function conePoint(base, axis, e1, e2, rho, H, pow, tuck, t, th) {
        const r = coneR(rho, pow, tuck, t);
        const c = Math.cos(th), s = Math.sin(th);
        return vec(
            base.x + axis.x * H * t + (e1.x * c + e2.x * s) * r,
            base.y + axis.y * H * t + (e1.y * c + e2.y * s) * r,
            base.z + axis.z * H * t + (e1.z * c + e2.z * s) * r
        );
    }

    // 回転面の法線。tuck を入れると解析形が汚くなるので差分で取る
    function coneNormal(axis, e1, e2, rho, H, pow, tuck, t, th) {
        const c = Math.cos(th), s = Math.sin(th);
        const ux = e1.x * c + e2.x * s, uy = e1.y * c + e2.y * s, uz = e1.z * c + e2.z * s;
        const e = 4e-3;
        const drdt = (coneR(rho, pow, tuck, Math.min(1, t + e))
            - coneR(rho, pow, tuck, Math.max(0, t - e))) / (2 * e);
        const k = -drdt / Math.max(1e-4, H);
        return vnorm(vec(ux + axis.x * k, uy + axis.y * k, uz + axis.z * k));
    }

    // =================================================================
    // 5. Fractal （黄金角の対数螺旋で小塔を再帰配置）
    // =================================================================
    // 【対策】ロマネスコを「ブロッコリーの房を尖らせたもの」と考えると
    //         絶対に似ない。この野菜の正体は次の2つに尽きる。
    //
    //         (a) 親の円錐面の上に、子を「頂点からの距離が等比数列
    //             s_i = S·λ^i、方位が黄金角 137.5°ずつ」で置く
    //         (b) 子の大きさを s_i に比例させる
    //
    //         この2つが揃って初めて自己相似になり、見る向きによって
    //         8本・13本・21本と数の変わる螺旋（斜列）が勝手に現れる。
    //         螺旋を線として描こうとしたり、子を等間隔に並べたりすると、
    //         ただのイガグリで終わる
    //
    // 【対策】子の軸は「親の面の法線」ではなく、そこから親の軸へ寄せた向き。
    //         法線のままだと小塔が放射状に開いてウニになる。実物は
    //         どの小塔も頭のてっぺんを向いて寝ている
    function growFractal(cfg, rng, out, base, axis, rho, H, level) {
        const L = cfg.levels[Math.min(level, cfg.levels.length - 1)];
        // 【対策】「何階層まで潜るか」を固定にしてはいけない。頭の下側の
        //         大きな小塔は、同じ3階層では末端が 1cm 近くになり、
        //         つるつるの大きな瘤にしか見えない。逆に頂上付近の小さな
        //         小塔は3階層目がもう見えない大きさになっている。
        //         写真の実物は、大きい小塔ほど深く分岐して、末端の粒の
        //         「絶対的な大きさ」がどこでも 1〜2mm に揃っている。
        //         打ち切りは階層数ではなく minChild（cm）で決める
        const leaf = (level >= cfg.maxLevel)
            || (L.coneK * rho * L.startFrac < cfg.minChild);
        const fr = basisFrom(axis);
        const e1 = fr.e1, e2 = fr.e2;
        // 螺旋の位相。面の模様と子の配置で同じ値を使う
        const th0 = rng.range(0, TAU);

        // 【対策】余弦波を足す方式は、山が「うねった尾根」になってしまい、
        //         粒には見えなかった。実物の面は、粒が1個ずつ独立している。
        //         対数極座標 (x, y) = (θ/2π, ln f / ln λ) の上では、
        //         葉序の節点は (i·0.382 mod 1, i) という単純な格子になる。
        //         最寄りの節点までの距離を測って丸い山を立てれば、
        //         そのまま「螺旋に並んだ粒」になる。
        // 【対策】x と y は物理的な尺度が違う。1周 2πr に対して y の1目盛は
        //         |ln λ|·S なので、その比 AR を距離に掛けないと、粒が
        //         周方向へ引き伸ばされて縞になる。r も S も f に比例するので
        //         AR は場所によらず一定になる
        const lnLam = Math.log(L.lambda);
        const GA = 0.3819660113;                     // 黄金角 / 2π
        const AR = TAU / (-lnLam * Math.sqrt(1 + L.aspect * L.aspect));
        // 最近接の節点までの距離。粒の半径はこれを基準にする
        let DMIN = 1e9;
        for (let F = 1; F <= 89; F++) {
            let dxf = F * GA; dxf -= Math.round(dxf);
            const dd = Math.sqrt((dxf * AR) * (dxf * AR) + F * F);
            if (dd < DMIN) DMIN = dd;
        }
        const nodeBump = (x, y, scl) => {
            const i0n = Math.round(y);
            let best = 1e9;
            for (let d = -8; d <= 8; d++) {
                const i = i0n + d;
                const xi = i * GA - Math.floor(i * GA);
                let dx = x - xi; dx -= Math.round(dx);
                const dy = y - i;
                const dd = (dx * AR * scl) * (dx * AR * scl) + dy * dy;
                if (dd < best) best = dd;
            }
            return 1 - smooth(0, DMIN * cfg.budRadius, Math.sqrt(best));
        };
        const spiral = (t, th) => {
            const f = Math.max(1e-4, 1 - t);
            const y = Math.log(f / L.startFrac) / lnLam;
            const x = (th - th0) / TAU;
            // 粗い粒と、その上に乗る細かい粒（もう1階層ぶん）
            const b1 = nodeBump(x, y, 1);
            const b2 = nodeBump(x * 4.236, y * 4.236, 1);
            return b1 + b2 * cfg.spiralFine - 0.30;
        };

        // ---- 面を張る --------------------------------------------------
        // 大きな親の面（頭と一次小塔）は別メッシュにしておく。
        // ここが見えている＝素体が透けている、という検証がしやすい
        const buf = leaf ? out.tip : (level <= 1 ? out.shell : out.core);
        const SEG = leaf ? L.segTip : L.seg;
        const RING = leaf ? L.ringTip : L.ring;
        const start = buf.nv;
        // 【対策】凹凸は末端だけでなく「全部の円錐」に入れる。親の面は
        //         子の隙間から必ず少し見えるので、そこが滑らかな面のままだと
        //         「つるつるの素体が透けている」ように見える。
        // 【対策】振幅を rho に比例させてはいけない。頭全体の円錐（rho = 6cm）
        //         に比例した凹凸を入れると数cmの大波になる。粒の凹凸は
        //         どこでも 1mm 程度なので、絶対値（cm）で与える
        const bump = Math.min(cfg.bumpAbs, rho * 0.22);
        // 【対策】末端の円錐は、計算量の都合でどうしても実物より一段大きい。
        //         そこに子を置く余裕はないので、面そのものに葉序の模様を
        //         彫り込む。対数極座標 (θ, ln f / ln λ) の上では、黄金角の
        //         螺旋格子は単なる斜めの格子になるので、フィボナッチ数の
        //         組 (8,-3) (13,-5) (21,-8) の3つの波を足すだけで、
        //         8本・13本・21本の斜列が同時に現れる。
        //         しかも波の山は子を置く位置とちょうど一致するので、
        //         親の面が覗いてもそこだけ盛り上がって溝が入る

        for (let i = 0; i <= RING; i++) {
            const t = i / RING;
            for (let j = 0; j <= SEG; j++) {
                const th = (j % SEG) / SEG * TAU;
                const p = conePoint(base, axis, e1, e2, rho, H, L.pow, L.tuck, t, th);
                const n = coneNormal(axis, e1, e2, rho, H, L.pow, L.tuck, t, th);
                let d = 0;
                if (bump > 0) {
                    const f2 = cfg.bumpFreq;
                    d += (Noise.fbm3(p.x * f2, p.y * f2, p.z * f2, 4242, 2) - 0.5)
                        * bump * (1 - t * 0.4);
                }
                if (cfg.spiralAmp > 0) {
                    const lr = coneR(rho, L.pow, L.tuck, t);
                    d += spiral(t, th) * cfg.spiralAmp * lr
                        * smooth(0.0, 0.10, t) * (1 - smooth(0.86, 1.0, t));
                }
                if (d !== 0) { p.x += n.x * d; p.y += n.y * d; p.z += n.z * d; }
                // 【対策】葉序の細部は頂点変位ではなく法線マップで出す。
                //         対数極座標 (x, y) = (θ/2π, ln f / ln λ) の上では
                //         葉序格子はどの階層でも同じ形なので、
                //         この UV を張れば 1 枚のテクスチャを全部の円錐に
                //         貼り回せる。分割数の壁から抜けられるのはここだけ
                const yy = Math.log(Math.max(1e-4, 1 - t) / L.startFrac) / lnLam;
                out.emit(buf, p, n, t, level, leaf,
                    (th - th0) / TAU, yy / cfg.budTexRows);
            }
        }
        const W = SEG + 1;
        for (let i = 0; i < RING; i++) for (let j = 0; j < SEG; j++) {
            const A = start + i * W + j;
            buf.quad(A, A + 1, A + W, A + W + 1);
        }
        // 底面のふた。親の面に埋まって見えないが、閉じておかないと
        // 影マップの裏面描画で穴があく
        const ci = buf.nv;
        out.emit(buf, base, vmul(axis, -1), 0, level, leaf, 0, 0);
        for (let j = 0; j < SEG; j++) buf.tri(ci, start + j + 1, start + j);

        out.count[Math.min(level, out.count.length - 1)]++;
        if (leaf) { out.leaves++; return; }

        // ---- 子を置く --------------------------------------------------
        const lam = L.lambda;
        // 【対策】螺旋を「頂点側の何割か」で打ち切ると、その割合ぶんの
        //         先端が裸のまま残る。大きな小塔ではそこが長い滑らかな
        //         角になる。ここも minChild で止めれば、どの大きさの
        //         小塔でも先端まで同じ細かさの子で埋まる
        const iMax = Math.max(1, Math.floor(
            Math.log(cfg.minChild / (L.coneK * rho * L.startFrac)) / Math.log(lam)));
        for (let i = 0; i <= Math.min(iMax, 400); i++) {
            // 【対策】i=0 の子を底面ちょうど（f=1）に置くと、いちばん大きな
            //         子が縁から真横へ張り出し、頭の下に洞窟ができる。
            //         起点をわずかに内側へずらす
            const f = L.startFrac * Math.pow(lam, i);
            const th = th0 + i * 2.3999632 + rng.gauss(0, L.jitterA);
            const tt = clamp(1 - f + rng.gauss(0, L.jitterT) * f, 0, 0.985);
            const p = conePoint(base, axis, e1, e2, rho, H, L.pow, L.tuck, tt, th);
            const n = coneNormal(axis, e1, e2, rho, H, L.pow, L.tuck, tt, th);
            // 【対策】傾きを一律にすると、いちばん下の列も上を向いてしまい、
            //         頭の縁の下に空洞ができて底面の円盤と茎が見えてしまう。
            //         実物のいちばん外側の小塔は、外へやや下向きに反って
            //         縁を包んでいる。底に近い子だけ法線より外へ倒す
            const tl = mix(L.tiltBase, L.tilt, smooth(0.0, 0.34, tt));
            const ax = vnorm(vec(
                mix(n.x, axis.x, tl), mix(n.y, axis.y, tl), mix(n.z, axis.z, tl)));
            // 【対策】子の大きさを「親の公称半径 × f」で決めると、tuck で
            //         絞った底のところだけ、細い胴に巨大な小塔が数本刺さった
            //         ヒトデになる。実物は、その場所の半径に見合った大きさ。
            //         局所半径を基準にすれば、いちばん外へ張り出す列が
            //         最大径のあたりに来て、底の列は小さく収まる
            const localR = coneR(rho, L.pow, L.tuck, tt);
            let cr = L.coneK * localR * rng.range(0.88, 1.14);
            if (cr < cfg.minChild) continue;
            // 【対策】子の縦横比は「子の階層」の値を使う。親の L.aspect を
            //         そのまま使うと、頭（aspect 2.43 の細長い円錐）の子である
            //         一次小塔まで 2.43 になり、痩せた角が林立して親の面が
            //         埋まらない。ここが素体の露出のいちばんの原因だった
            const CL = cfg.levels[Math.min(level + 1, cfg.levels.length - 1)];
            const ch = cr * CL.aspect * rng.range(0.88, 1.16);
            // 少し面へ埋める。浮かせると根元に隙間ができる
            const cb = vsub(p, vmul(ax, cr * L.sink));
            if (level === 0) out.hull.push(vadd(cb, vmul(ax, ch * 0.9)));
            growFractal(cfg, rng, out, cb, ax, cr, ch, level + 1);
        }
    }


    // =================================================================
    // 6. Broccoli
    // =================================================================
    class Romanesco {
        constructor(scene, cfg, seed, mats) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng; this.mats = mats;
            this.parts = [];
            this.root = new BABYLON.TransformNode("romanesco", scene);

            // 個体差。長さ・太さ・傾き
            this.H = cfg.stemH * rng.range(0.90, 1.10);
            this.R0 = cfg.stemR * rng.range(0.93, 1.07);
            this.R1 = cfg.stemTopR * rng.range(0.93, 1.07);
            this.lean = rng.gauss(0, 0.055);
            this.leanPhi = rng.range(0, TAU);
            this.nseed = rng.int(80000) + 1000;
            this.topK = cfg.stemTopR / cfg.stemR;
            this.lobePh = rng.range(0, TAU);

            const c2 = Object.assign({}, cfg, {
                stemTopR: this.stemRadius(BRANCH_ROOT_S),
                seed: (seed ^ 0x9e3779b9) >>> 0
            });
            this.c2 = c2;

            // 【対策】枝を茎の先端ちょうどから生やすと、太い茎の上に細い枝が
            //         3本立つ「首」ができる。実物は茎がそのまま冠状に広がって
            //         枝へ移り、境目が分からない。枝の起点を茎の中へ潜らせ、
            //         付け根を親の太さ寄りに膨らませて連続させる
            // 頭は円錐そのもの。茎の中へ少し潜らせて据える
            this.headBase = vec(0, this.stemCenter(BRANCH_ROOT_S).y - cfg.headSink, 0);
            this.headRho = cfg.headRho * rng.range(0.92, 1.08);
            this.headH = cfg.headH * rng.range(0.90, 1.12);

            this.buildStem([]);
            this.buildFractal();
            this.buildLeaves();

            for (const m of this.parts) m.parent = this.root;
        }

        // --- 主茎の中心線 ---------------------------------------------
        stemCenter(s) {
            const b = this.lean * this.H * s * s;
            return vec(Math.cos(this.leanPhi) * b, this.H * s, Math.sin(this.leanPhi) * b);
        }

        // --- 主茎の半径 -----------------------------------------------
        // 【対策】まっすぐな円柱にすると、きのこの柄か大根の切れ端になる。
        //         実物の茎は切り口がいちばん太く（葉を落とした株元が
        //         ラッパ状に開いている）、そこから 1/3 ほど上がった所が
        //         最も細く、分岐へ向かってまた太る。つまり鼓型。
        //         「切り口が太い」ことがブロッコリーの茎の第一印象なので、
        //         ここを平行にすると何の野菜か分からなくなる
        stemRadius(s) {
            const B = STEM_PROFILE;
            const n = B.length - 1;
            const x = clamp(s, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
            const k = mix(B[i], B[i + 1], f * f * (3 - 2 * f));
            // 先端が preset の stemTopR に着地するよう、上半分だけ伸縮させる
            const tail = 1 + (this.topK / B[n] - 1) * smooth(0.22, 1.0, s);
            // 【対策】茎の上端を太いまま切ると、そこに平らなふたが残り、
            //         枝の隙間から「円盤の縁」として見える。実物の茎は
            //         そのまま枝へ分かれていくので上端は存在しない。
            //         分岐の起点より上を絞って、枝束の中へ埋める
            const crown = 1 - 0.66 * smooth(BRANCH_ROOT_S - 0.02, 1.0, s);
            return this.R0 * k * tail * this.bell(s) * crown;
        }

        // 鐘の開き。株元だけ効かせる
        bell(s) {
            return 1 + this.cfg.stemBell * Math.pow(1 - smooth(0, 0.30, s), 2.2);
        }

        // 断面は真円ではない。浅い縦の稜があり、株元ほど大きく波打つ
        // 【対策】株元の断面はきれいな円ではなく、葉柄の跡で数か所へこんだ
        //         多角形に近い。ここを真円にすると切り口が定規で切ったように
        //         なり、いちばん目立つ場所で作り物だとばれる
        stemShape(s, phi) {
            const F = this.cfg.stemFlutes;
            const low = 1 + 2.4 * (1 - smooth(0, 0.34, s));
            const g = 0.5 - 0.5 * Math.cos(F * phi + 1.35 * s);
            const w = 0.5 - 0.5 * Math.cos(3 * phi + this.lobePh);
            const n = Noise.fbm3(Math.cos(phi) * 1.7, s * 2.6, Math.sin(phi) * 1.7, this.nseed, 2);
            return 1 - this.cfg.fluteAmp * g * low * 0.55
                - this.cfg.stemLobe * w * (1 - smooth(0, 0.42, s))
                + (n - 0.5) * 0.045 * low;
        }

        // --- 茎 + 葉痕 + 切り口 + 枝（1枚のメッシュ）-------------------
        buildStem(branches) {
            const cfg = this.cfg, rng = this.rng;
            const HI = cfg.stemHi, LO = cfg.stemLo;
            const BH = cfg.branchHi, BL = cfg.branchLo;

            let bv = 4000, bt = 8000;
            for (const b of branches) { bv += (b.path.length) * (cfg.branchSides + 1) + 2; bt += b.path.length * cfg.branchSides * 2 + cfg.branchSides; }
            const buf = new MeshBuf(bv, bt);

            // ---- 主茎 ----
            const NR = cfg.stemRings, MS = cfg.stemSides;
            const path = [], radii = [];
            for (let i = 0; i <= NR; i++) {
                const s = i / NR;
                path.push(this.stemCenter(s));
                radii.push(this.stemRadius(s));
            }
            const stemCol = (s, phi, x, y, z) => {
                // 縦に走る繊維の筋。ごく淡い
                const fib = 0.955 + 0.090 * Noise.fbm3(Math.cos(phi) * 26, s * 3.2, Math.sin(phi) * 26, this.nseed + 5, 2);
                // 溝は沈む
                const g = 0.5 - 0.5 * Math.cos(cfg.stemFlutes * phi + 1.35 * s);
                // 上へ行くほど緑が乗る（枝へつながる）
                const up = smooth(0.55, 1.0, s);
                // 低周波のむら
                const mo = 0.94 + 0.12 * Noise.fbm3(Math.cos(phi) * 2.1, s * 3.4, Math.sin(phi) * 2.1, this.nseed + 11, 3);
                const k = fib * mo * (1 - 0.26 * g);
                return [
                    srgb(mix(mix(HI[0], LO[0], up * 0.55), BH[0], up * 0.30) * k),
                    srgb(mix(mix(HI[1], LO[1], up * 0.55), BH[1], up * 0.30) * k),
                    srgb(mix(mix(HI[2], LO[2], up * 0.55), BH[2], up * 0.30) * k)
                ];
            };
            // 【対策】上端を開けたままにすると、筒の縁が枝の隙間から
            //         黒いリングとして見え、そこで別部品が始まったように見える
            tube(buf, path, radii, MS, stemCol, (s, phi) => this.stemShape(s, phi), true, vec(0, 1, 0));

            // ---- 切り口 ----
            this.buildCutFace(buf);

            // ---- 葉痕 ----
            // 【対策】写真の茎でいちばん目を引くのは、葉を切り落とした跡の
            //         小さなヒレ。これが無いとただの緑の円柱になる。
            //         葉序に従って 137.5°ずつ回しながら螺旋に並べる
            for (let i = 0; i < cfg.scarCount; i++) {
                const s = mix(0.16, 0.94, (i + 0.30) / cfg.scarCount) + rng.gauss(0, 0.022);
                const phi = i * 2.3999632 + rng.gauss(0, 0.16);
                this.buildLeafScar(buf, s, phi, cfg.scarSize * rng.range(0.78, 1.22));
            }

            // ---- 枝 ----
            let maxD = 1;
            for (const b of branches) maxD = Math.max(maxD, b.depth);
            for (const b of branches) {
                const d0 = b.depth;
                const colFn = (s, phi, x, y, z) => {
                    const t = clamp((d0 + s) / (maxD + 1.0), 0, 1);
                    const n = 0.93 + 0.14 * Noise.fbm3(x * 1.9, y * 1.9, z * 1.9, this.nseed + 23, 2);
                    const fib = 0.965 + 0.070 * Noise.fbm3(Math.cos(phi) * 18, s * 6, Math.sin(phi) * 18, this.nseed + 31, 2);
                    const k = n * fib;
                    // 【対策】深さに比例して緑を濃くすると、末端の小枝まで
                    //         濃緑になる。写真では小枝は花蕾の直前まで
                    //         淡い黄緑のままで、濃くなるのは花蕾を受ける
                    //         ラッパの内側だけ
                    const a = smooth(0.00, 0.58, t), b2 = smooth(0.76, 1.00, t);
                    return [
                        srgb(mix(mix(HI[0], BH[0], a), BL[0], b2) * k),
                        srgb(mix(mix(HI[1], BH[1], a), BL[1], b2) * k),
                        srgb(mix(mix(HI[2], BH[2], a), BL[2], b2) * k)
                    ];
                };
                // 【対策】小枝の断面は真円ではなく、平たいリボンに近い。
                //         真円のままだと太さの変わらない配管になる。
                //         向きは解剖学的に決められないので、枝ごとに位相を振る
                const ph = b.ph;
                const shp = (s2, phi) => 1 + cfg.branchFlat * Math.cos(2 * (phi - ph)) * smooth(0.10, 0.55, s2);
                tube(buf, b.path, b.radii, cfg.branchSides, colFn, shp, true);
            }

            // ---- 頭部からの遮蔽を焼く ----
            this.applyAO(buf);

            const mesh = buf.toMesh("romanescoStem", this.scene);
            mesh.material = this.mats.stem;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
            this.stemMesh = mesh;
        }

        // --- 切り口 ---------------------------------------------------
        // 【対策】外側の濃い皮 → 淡い皮層 → 白い髄、の同心構造と、
        //         その境目に並ぶ維管束の点。ここを一色で塗ると
        //         「棒を切っただけ」に見えて、野菜の断面にならない
        buildCutFace(buf) {
            const cfg = this.cfg, M = cfg.stemSides, Q = 9;
            const r0 = this.stemRadius(0);
            const RIND = cfg.cutRind, FLESH = cfg.cutFlesh, CORE = cfg.cutCore, VEIN = cfg.cutVein;
            const base = buf.nv;
            for (let q = 0; q <= Q; q++) {
                const t = q / Q;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const rr = r0 * this.stemShape(0, phi) * t;
                    // 切り口はわずかに凹む（乾いて縮む）
                    const dip = 0.09 * (1 - t * t);
                    const x = Math.cos(phi) * rr, z = Math.sin(phi) * rr;
                    const n = vnorm(vec(Math.cos(phi) * 0.16 * t, -1, Math.sin(phi) * 0.16 * t));
                    // 色：外周の皮 → 皮層 → 髄
                    const rind = smooth(0.90, 1.00, t);
                    const cort = smooth(0.62, 0.90, t) * (1 - rind);
                    let cr = mix(CORE[0], FLESH[0], smooth(0.10, 0.55, t));
                    let cg = mix(CORE[1], FLESH[1], smooth(0.10, 0.55, t));
                    let cb = mix(CORE[2], FLESH[2], smooth(0.10, 0.55, t));
                    cr = mix(cr, VEIN[0], cort * 0.55); cg = mix(cg, VEIN[1], cort * 0.55); cb = mix(cb, VEIN[2], cort * 0.55);
                    cr = mix(cr, RIND[0], rind); cg = mix(cg, RIND[1], rind); cb = mix(cb, RIND[2], rind);
                    // 維管束の点。t≒0.72 のリング上に並ぶ
                    // 【対策】維管束の点は「リング上の位相ノイズ」で作ると
                    //         放射状の縞になり、切り株の年輪のように見える。
                    //         2次元位置で引いて、リング付近だけ出す
                    const dot = smooth(0.62, 0.86, Noise.fbm3(Math.cos(phi) * rr * 5.5, Math.sin(phi) * rr * 5.5, 4.0, this.nseed + 41, 2))
                        * smooth(0.13, 0.04, Math.abs(t - 0.74));
                    cr = mix(cr, VEIN[0] * 0.80, dot * 0.45);
                    cg = mix(cg, VEIN[1] * 0.80, dot * 0.45);
                    cb = mix(cb, VEIN[2] * 0.80, dot * 0.45);
                    const g = 0.95 + 0.10 * Noise.fbm3(x * 3.4, 1.7, z * 3.4, this.nseed + 47, 2);
                    buf.vert(x, dip, z, n.x, n.y, n.z, srgb(cr * g), srgb(cg * g), srgb(cb * g));
                }
            }
            const W = M + 1;
            for (let q = 0; q < Q; q++) for (let j = 0; j < M; j++) {
                const A = base + q * W + j, B = A + 1, C = A + W, D = C + 1;
                buf.quad(A, B, C, D);
            }
        }

        // --- 葉痕（葉を切り落とした跡のヒレ）--------------------------
        buildLeafScar(buf, s, phi, size) {
            const c = this.stemCenter(s);
            const t = vnorm(vsub(this.stemCenter(Math.min(1, s + 0.02)), this.stemCenter(Math.max(0, s - 0.02))));
            const bs = basisFrom(t);
            const o = vnorm(vec(
                bs.e1.x * Math.cos(phi) + bs.e2.x * Math.sin(phi),
                bs.e1.y * Math.cos(phi) + bs.e2.y * Math.sin(phi),
                bs.e1.z * Math.cos(phi) + bs.e2.z * Math.sin(phi)));
            const side = vcross(t, o);
            const r = this.stemRadius(s) * this.stemShape(s, phi);
            const P = vadd(c, vmul(o, r * 0.94));
            const h = size * 1.02;
            // 【対策】葉痕は真横へ突き出すのではなく、上向きに寝ている。
            //         外向きを強くすると耳のように見えて別の生き物になる
            const apex = vadd(vadd(P, vmul(o, h * 0.52)), vmul(t, h * 0.86));

            const M = 14, base = buf.nv;
            const A0 = size * 1.00, B0 = size * 0.46;   // 付け根の楕円（横長）
            const A1 = size * 0.44, B1 = size * 0.09;   // 先端はほぼ線。薄く尖った角になる
            const SC = this.cfg.stemScar, HI = this.cfg.stemHi, LO = this.cfg.stemLo;
            for (let ring = 0; ring < 2; ring++) {
                const CC = ring === 0 ? P : apex;
                const a = ring === 0 ? A0 : A1, b = ring === 0 ? B0 : B1;
                for (let j = 0; j <= M; j++) {
                    const th = (j % M) / M * TAU;
                    const cs = Math.cos(th), sn = Math.sin(th);
                    const px = CC.x + side.x * cs * a + t.x * sn * b;
                    const py = CC.y + side.y * cs * a + t.y * sn * b;
                    const pz = CC.z + side.z * cs * a + t.z * sn * b;
                    const n = vnorm(vec(
                        o.x * 0.75 + side.x * cs * 0.65 + t.x * sn * 0.35,
                        o.y * 0.75 + side.y * cs * 0.65 + t.y * sn * 0.35,
                        o.z * 0.75 + side.z * cs * 0.65 + t.z * sn * 0.35));
                    const k = ring === 0 ? 0 : 0.72;
                    const g = 0.94 + 0.12 * Noise.fbm3(px * 4, py * 4, pz * 4, this.nseed + 53, 2);
                    // 【対策】ヒレ全体を淡色にすると、茎に白いシールを貼ったように
                    //         見える。写真ではヒレの面は茎と同じ緑で、
                    //         淡いのは切り落とした先端の断面だけ
                    const cr = mix(mix(HI[0], LO[0], 0.30), SC[0], k) * g;
                    const cg = mix(mix(HI[1], LO[1], 0.30), SC[1], k) * g;
                    const cb = mix(mix(HI[2], LO[2], 0.30), SC[2], k) * g;
                    buf.vert(px, py, pz, n.x, n.y, n.z, srgb(cr), srgb(cg), srgb(cb));
                }
            }
            const W = M + 1;
            for (let j = 0; j < M; j++) {
                const A = base + j, B = A + 1, C = A + W, D = C + 1;
                buf.quad(A, B, C, D);
            }
            // 先端。切り落とした断面（淡）か、葉の付け根の残り（濃緑）
            // 【対策】写真の茎では、ヒレの先が全部同じ色ではない。
            //         葉を切った断面は白っぽく、葉柄が残っている所は
            //         濃い緑の小さな突起になっている。この2種類が
            //         混ざっていることが、茎を「切られた植物」に見せる
            const leafy = this.rng.next() < 0.45;
            const LF = this.cfg.branchLo;
            const nap = vnorm(vadd(vmul(o, 0.62), vmul(t, 0.78)));
            const ci = buf.vert(apex.x, apex.y, apex.z, nap.x, nap.y, nap.z,
                srgb(leafy ? LF[0] * 0.85 : SC[0]),
                srgb(leafy ? LF[1] * 0.85 : SC[1]),
                srgb(leafy ? LF[2] * 0.85 : SC[2]));
            const off = base + W;
            for (let j = 0; j < M; j++) buf.tri(ci, off + j, off + j + 1);
        }

        // --- 花蕾（ドームの下地 + 蕾の粒）------------------------------
        // ---- フラクタルの頭 -------------------------------------------
        buildFractal() {
            const cfg = this.cfg, rng = this.rng;
            const TIP = cfg.tipCol, SIDE = cfg.sideCol, DEEP = cfg.deepCol;
            const YEL = cfg.yellowCol;
            const base = this.headBase, rho = this.headRho, H = this.headH;
            const seedC = rng.int(70000);

            // 【対策】小塔の谷は 1〜3mm しかなく SSAO では届かない。
            //         かといって全部の円錐を総当たりで遮蔽計算すると
            //         数千個 × 数十万頂点になる。頭全体の円錐面からの
            //         「深さ」だけで代用する。実際、この野菜の暗さは
            //         ほぼ「頭の輪郭からどれだけ引っ込んでいるか」で決まる
            const headR = (y) => {
                const t = clamp((y - base.y) / Math.max(1e-4, H), 0, 1);
                return coneR(rho, cfg.levels[0].pow, cfg.levels[0].tuck, t);
            };

            const out = {
                core: new MeshBuf(60000, 110000),
                shell: new MeshBuf(20000, 36000),
                tip: new MeshBuf(240000, 440000),
                hull: [],
                count: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], leaves: 0
            };
            out.emit = (buf, p, n, t, level, leaf, uu, vv) => {
                const depth = Math.hypot(p.x, p.z) - headR(p.y);
                const ao = clamp(smooth(-cfg.aoDepth, cfg.aoDepth * 0.30, depth), cfg.aoFloor, 1);
                // 小塔の中でも、根元は暗く先端は明るい
                const up = clamp(0.42 + 0.42 * n.y + 0.34 * (t - 0.35), 0, 1);
                let k = smooth(0.10, 0.92, up * 0.55 + t * 0.55);
                // 【対策】階層ごとに色を変えてはいけない。前の版では親の面を
                //         一律の暗い緑（coreCol）で塗っていたため、
                //         「つるつるの暗い円錐の上に明るい粒が点在する」絵に
                //         なっていた。実物は、どの階層の面も同じ材質で、
                //         明るさを決めているのは階層ではなく「先端に近いか、
                //         谷に落ちているか」だけ。全階層に同じ規則を掛ける
                let cr = mix(SIDE[0], TIP[0], k);
                let cg = mix(SIDE[1], TIP[1], k);
                let cb = mix(SIDE[2], TIP[2], k);
                // 【対策】一様な黄緑にすると樹脂の模型になる。実物は
                //         小塔ごとに黄色寄り・青緑寄りのばらつきがある
                const yv = smooth(0.54, 0.80, Noise.fbm3(p.x * 0.42, p.y * 0.42, p.z * 0.42, seedC, 3))
                    * cfg.yellowAmt;
                cr = mix(cr, YEL[0], yv); cg = mix(cg, YEL[1], yv); cb = mix(cb, YEL[2], yv);
                // 親の面は子に覆われて光が届きにくい。ごくわずかだけ沈める
                if (!leaf) {
                    const dk = mix(1.0, cfg.coreDim, 1 - t * 0.55);
                    cr *= dk; cg *= dk; cb *= dk;
                }
                // 【対策】頭全体の円錐そのものは、隙間や真下からわずかに
                //         覗くことがある。ここだけは深い影の色まで落として、
                //         見えても「奥の暗がり」として読めるようにする
                if (level <= 1) {
                    const dk = cfg.headDim;
                    cr = mix(DEEP[0], cr * dk, 0.80);
                    cg = mix(DEEP[1], cg * dk, 0.80);
                    cb = mix(DEEP[2], cb * dk, 0.80);
                }
                const g = 0.93 + 0.14 * Noise.fbm3(p.x * 5.5, p.y * 5.5, p.z * 5.5, seedC + 17, 2);
                cr *= g; cg *= g; cb *= g;
                buf.vert(p.x, p.y, p.z, n.x, n.y, n.z,
                    srgb(mix(DEEP[0], cr, ao)), srgb(mix(DEEP[1], cg, ao)), srgb(mix(DEEP[2], cb, ao)),
                    uu, vv);
            };

            growFractal(cfg, rng, out, base, vec(0, 1, 0), rho, H, 0);

            this.hullPts = out.hull;
            this.coneCount = out.count.slice();
            this.tipCount = out.leaves;

            const shellMesh = out.shell.toMesh("romanescoShell", this.scene);
            shellMesh.material = this.mats.curd;
            shellMesh.receiveShadows = true;
            this.parts.push(shellMesh);

            const coreMesh = out.core.toMesh("romanescoCore", this.scene);
            coreMesh.material = this.mats.curd;
            coreMesh.receiveShadows = true;
            this.parts.push(coreMesh);

            const tipMesh = out.tip.toMesh("romanescoTips", this.scene);
            tipMesh.material = this.mats.curd;
            tipMesh.receiveShadows = true;
            this.parts.push(tipMesh);
            this.budMesh = tipMesh;
            this.budCount = this.tipCount;
        }

        // ---- 葉 -------------------------------------------------------
        // 【対策】これが無いと「白いブロッコリー」で終わる。写真のカリフラワーで
        //         いちばん目を引くのは、太い葉柄を切った跡が輪になって
        //         外へ張り出しているところ。
        // 【対策】葉柄（中肋）と葉身を1枚のシートで作ると、切った跡が
        //         紙を切った断面になる。葉柄は断面を持った実体、葉身は
        //         両面表示のシート、と作り分ける
        buildLeaves() {
            const cfg = this.cfg, rng = this.rng;
            if (!cfg.leafCount) return;

            const ribBuf = new MeshBuf(cfg.leafCount * 700, cfg.leafCount * 1300);
            const bladeBuf = new MeshBuf(cfg.leafCount * 1400, cfg.leafCount * 2600);
            const RB = cfg.ribCol, RC = cfg.ribCut;
            const BT = cfg.bladeTop, BV = cfg.bladeVein;
            const ph0 = rng.range(0, TAU);
            this.ribPts = [];

            for (let i = 0; i < cfg.leafCount; i++) {
                // 葉序。137.5°ずつ回しながら、下の葉ほど長く外へ張り出す
                const az = ph0 + i * 2.3999632 + rng.gauss(0, 0.10);
                const sBase = mix(0.22, 0.72, (i + 0.4) / cfg.leafCount) + rng.gauss(0, 0.03);
                const cut = rng.next() < cfg.leafCutRatio;
                const L = (cut ? cfg.ribLenCut : cfg.ribLenFull) * rng.range(0.78, 1.24);
                // 立ち上がりの角度。切られた葉柄は寝ており、残った葉は立つ
                // 【対策】切った葉柄はほぼ水平に外へ張り出し、残った葉は
                //         頭を抱えるように立ち上がる。同じ角度で出すと、
                //         全部が頭の陰に隠れて葉が無いのと同じになる
                // 【対策】切った葉柄を水平に長く出すと、蜘蛛の脚が生えたように見える。
                //         実物は斜め上へ短く突き出し、頭のふちに隠れる程度
                const e0 = cut ? rng.range(0.22, 0.62) : rng.range(0.22, 0.55);
                const e1 = cut ? e0 + rng.range(0.05, 0.28) : rng.range(1.32, 1.62);
                const twist = rng.gauss(0, 0.16);

                const c0 = this.stemCenter(clamp(sBase, 0, 1));
                const t0 = vnorm(vsub(this.stemCenter(Math.min(1, sBase + 0.02)),
                    this.stemCenter(Math.max(0, sBase - 0.02))));
                const bs = basisFrom(t0);
                const out = vnorm(vec(
                    bs.e1.x * Math.cos(az) + bs.e2.x * Math.sin(az),
                    bs.e1.y * Math.cos(az) + bs.e2.y * Math.sin(az),
                    bs.e1.z * Math.cos(az) + bs.e2.z * Math.sin(az)));
                const side = vnorm(vcross(t0, out));
                const r0 = this.stemRadius(clamp(sBase, 0, 1)) * this.stemShape(sBase, az);
                const base = vadd(c0, vmul(out, r0 * 0.86));

                // 芯線
                let K = 18;
                const path = [], frames = [];
                let cur = base;
                for (let k = 0; k <= K; k++) {
                    const t = k / K;
                    // 【対策】立ち上がりを遅らせると葉が横へ広がって観葉植物になる。
                    //         実物は付け根からすぐ起き上がり、頭を抱え込む
                    const e = e0 + (e1 - e0) * Math.pow(t, 0.80);
                    const yaw = twist * t * t;
                    const dx = Math.cos(e) * (out.x * Math.cos(yaw) + side.x * Math.sin(yaw)) + t0.x * Math.sin(e);
                    const dy = Math.cos(e) * (out.y * Math.cos(yaw) + side.y * Math.sin(yaw)) + t0.y * Math.sin(e);
                    const dz = Math.cos(e) * (out.z * Math.cos(yaw) + side.z * Math.sin(yaw)) + t0.z * Math.sin(e);
                    const d = vnorm(vec(dx, dy, dz));
                    if (k > 0) cur = vadd(cur, vmul(d, L / K));
                    path.push(cur);
                    const S = vnorm(vcross(d, out.y > 0.99 ? vec(1, 0, 0) : vec(0, 1, 0)));
                    frames.push({ d, S, N: vnorm(vcross(S, d)) });
                }
                // 【対策】物理の凸包へ入れるのは、外へ張り出した「低い」点だけ。
                //         立ち上がった葉の先まで入れると凸包が背の高い円錐になり、
                //         据わり方が実物と変わってしまう
                // 【対策】葉は茎から生えるが、頭部は茎の上に覆いかぶさっている。
                //         付け根の高さと立ち上がり角によっては、葉が花蕾の中を
                //         下から突き破って生えてくる。包絡面の内側に入った
                //         時点で芯線を打ち切り、根元から入っている個体は捨てる
                {
                    const B = this.headBase, RH = this.headRho, HH = this.headH;
                    const pw = cfg.levels[0].pow;
                    const inside = (p) => {
                        const t = (p.y - B.y) / HH;
                        if (t < -0.05 || t > 1) return false;
                        const r = coneR(RH, pw, cfg.levels[0].tuck, clamp(t, 0, 1)) * 1.06;
                        return Math.hypot(p.x, p.z) < r;
                    };
                    let kMax = K;
                    for (let k = 0; k <= K; k++) if (inside(path[k])) { kMax = k - 1; break; }
                    if (kMax < 4) continue;
                    if (kMax < K) { K = kMax; path.length = K + 1; frames.length = K + 1; }
                }

                this.ribPts.push(path[0]);
                if (cut) this.ribPts.push(path[(K * 0.5) | 0], path[K]);

                // ---- 葉柄（扁平な断面の実体）----
                const M = 12, bstart = ribBuf.nv;
                for (let k = 0; k <= K; k++) {
                    const t = k / K;
                    const C = path[k], F = frames[k];
                    const a = cfg.ribW * (1 - 0.52 * t) * (cut ? 1.0 : 1 - 0.72 * smooth(0.25, 1.0, t));
                    const b = cfg.ribT * (1 - 0.58 * t) * (cut ? 1.0 : 1 - 0.76 * smooth(0.25, 1.0, t));
                    const g = 0.93 + 0.14 * Noise.fbm3(C.x * 2.2, C.y * 2.2, C.z * 2.2, this.nseed + 61, 2);
                    for (let j = 0; j <= M; j++) {
                        const psi = (j % M) / M * TAU;
                        const cs = Math.cos(psi), sn = Math.sin(psi);
                        const px = C.x + F.S.x * a * cs + F.N.x * b * sn;
                        const py = C.y + F.S.y * a * cs + F.N.y * b * sn;
                        const pz = C.z + F.S.z * a * cs + F.N.z * b * sn;
                        const nx = F.S.x * cs / a + F.N.x * sn / b;
                        const ny = F.S.y * cs / a + F.N.y * sn / b;
                        const nz = F.S.z * cs / a + F.N.z * sn / b;
                        const nl = Math.hypot(nx, ny, nz) || 1;
                        // 葉柄の背側はわずかに緑が乗る
                        const k2 = g * (0.94 + 0.10 * (sn * 0.5 + 0.5));
                        ribBuf.vert(px, py, pz, nx / nl, ny / nl, nz / nl,
                            srgb(RB[0] * k2), srgb(RB[1] * k2), srgb(RB[2] * k2));
                    }
                }
                const W = M + 1;
                for (let k = 0; k < K; k++) for (let j = 0; j < M; j++) {
                    const A = bstart + k * W + j;
                    ribBuf.quad(A, A + 1, A + W, A + W + 1);
                }
                if (cut) {
                    // 切り口。淡い楕円のふた
                    const C = path[K], F = frames[K];
                    const ci = ribBuf.vert(C.x, C.y, C.z, F.d.x, F.d.y, F.d.z,
                        srgb(RC[0]), srgb(RC[1]), srgb(RC[2]));
                    const o = bstart + K * W;
                    for (let j = 0; j < M; j++) ribBuf.tri(ci, o + j, o + j + 1);
                }

                if (cut) continue;

                // ---- 葉身（両面表示のシート）----
                const t0s = 0.30, NU = 22, NV = 13;
                const P = [], Nn = [];
                const wave = cfg.bladeWave * rng.range(0.6, 1.5);
                const wph = rng.range(0, TAU);
                const bw = cfg.bladeW * rng.range(0.8, 1.25);
                // 【対策】幅の山を中央に置くときれいな楕円になり、観葉植物の
                //         葉になる。実物は付け根寄りがいちばん広く、先へ尖る。
                //         さらに、ふちは大きく波打って裂けている
                const halfW = (u) => bw * Math.pow(u, 0.38) * Math.pow(1 - u, 0.58) * 2.35
                    * (1 + 0.09 * Math.sin(4.2 * Math.PI * u + wph));
                const pt = (u, w) => {
                    const t = mix(t0s, 1.0, u);
                    const k = clamp(t * K, 0, K);
                    const k0 = Math.floor(k), k1 = Math.min(K, k0 + 1), fk = k - k0;
                    const C = vec(mix(path[k0].x, path[k1].x, fk),
                        mix(path[k0].y, path[k1].y, fk),
                        mix(path[k0].z, path[k1].z, fk));
                    const F = frames[k0];
                    const hw = halfW(u);
                    // 【対策】平らな板にすると造花になる。実物の葉は中肋に沿って
                    //         谷折りに窪み、ふちは大きく波打っている
                    const cup = cfg.bladeCup * hw * w * w;
                    const wv = wave * hw * 0.42 * Math.sin(4.3 * u + 2.1 * w + wph) * Math.abs(w);
                    const lat = hw * w * (1 + 0.10 * Math.sin(6.0 * u + wph));
                    return vec(
                        C.x + F.S.x * lat + F.N.x * (cup + wv),
                        C.y + F.S.y * lat + F.N.y * (cup + wv),
                        C.z + F.S.z * lat + F.N.z * (cup + wv));
                };
                for (let iu = 0; iu <= NU; iu++) {
                    const u = iu / NU;
                    for (let iv = 0; iv <= NV; iv++) {
                        const w = iv / NV * 2 - 1;
                        P.push(pt(u, w));
                    }
                }
                const IDX = (iu, iv) => iu * (NV + 1) + iv;
                for (let iu = 0; iu <= NU; iu++) for (let iv = 0; iv <= NV; iv++) {
                    const a = P[IDX(Math.min(NU, iu + 1), iv)], b = P[IDX(Math.max(0, iu - 1), iv)];
                    const c = P[IDX(iu, Math.min(NV, iv + 1))], d = P[IDX(iu, Math.max(0, iv - 1))];
                    let n = vcross(vsub(a, b), vsub(c, d));
                    if (vlen(n) < 1e-9) n = vec(0, 1, 0);
                    Nn.push(vnorm(n));
                }
                const sstart = bladeBuf.nv;
                for (let iu = 0; iu <= NU; iu++) {
                    const u = iu / NU;
                    for (let iv = 0; iv <= NV; iv++) {
                        const w = iv / NV * 2 - 1, id = IDX(iu, iv);
                        const p = P[id], n = Nn[id];
                        // 葉脈。中肋から左右へ斜めに走る
                        const vn = Math.pow(0.5 + 0.5 * Math.cos(TAU * (w * cfg.leafVeins + u * 1.6)), 7.0);
                        const mid = Math.pow(1 - Math.min(1, Math.abs(w) / 0.13), 2.0);
                        const g = 0.90 + 0.18 * Noise.fbm3(p.x * 1.7, p.y * 1.7, p.z * 1.7, this.nseed + 71, 2);
                        let cr = BT[0], cg = BT[1], cb = BT[2];
                        const vk = clamp(vn * 0.45 * (1 - Math.abs(w) * 0.4) + mid * 0.95, 0, 1);
                        cr = mix(cr, BV[0], vk); cg = mix(cg, BV[1], vk); cb = mix(cb, BV[2], vk);
                        // 付け根は葉柄の色へ、ふちはやや明るく
                        const rootk = 1 - smooth(0.0, 0.28, u);
                        cr = mix(cr, RB[0], rootk * 0.85); cg = mix(cg, RB[1], rootk * 0.85); cb = mix(cb, RB[2], rootk * 0.85);
                        const edge = Math.pow(Math.abs(w), 8.0) * 0.30;
                        cr = mix(cr, BV[0], edge); cg = mix(cg, BV[1], edge); cb = mix(cb, BV[2], edge);
                        bladeBuf.vert(p.x, p.y, p.z, n.x, n.y, n.z,
                            srgb(cr * g), srgb(cg * g), srgb(cb * g));
                    }
                }
                for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
                    const A = sstart + IDX(iu, iv);
                    bladeBuf.quad(A, A + 1, A + (NV + 1), A + (NV + 1) + 1);
                }
            }

            if (ribBuf.nt) {
                const m = ribBuf.toMesh("romanescoRibs", this.scene);
                m.material = this.mats.stem;
                m.receiveShadows = true;
                this.parts.push(m);
            }
            if (bladeBuf.nt) {
                const m = bladeBuf.toMesh("romanescoLeaves", this.scene);
                m.material = this.mats.leaf;
                m.receiveShadows = true;
                this.parts.push(m);
            }
        }

        // 頂点色に球状遮蔽を掛ける（茎と枝用の後処理）
        // 頂点色に遮蔽を掛ける（茎と葉柄用の後処理）
        // 【対策】茎の上には頭が張り出しているので、そのままだと茎の
        //         上端まで同じ明るさで、頭が浮いて見える
        applyAO(buf) {
            const cfg = this.cfg;
            const P = buf.pos, C = buf.col;
            const topY = this.headBase.y;
            for (let i = 0; i < buf.nv; i++) {
                const p = i * 3, q = i * 4;
                const ao = clamp(0.42 + 0.58 * smooth(0.0, 3.0, topY - P[p + 1]), 0.42, 1);
                C[q] *= ao; C[q + 1] *= ao; C[q + 2] *= ao;
            }
        }

        worldBounds() {
            let mnx = Infinity, mny = Infinity, mnz = Infinity;
            let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
            for (const m of this.parts) {
                m.computeWorldMatrix(true);
                const bb = m.getBoundingInfo().boundingBox;
                mnx = Math.min(mnx, bb.minimumWorld.x); mxx = Math.max(mxx, bb.maximumWorld.x);
                mny = Math.min(mny, bb.minimumWorld.y); mxy = Math.max(mxy, bb.maximumWorld.y);
                mnz = Math.min(mnz, bb.minimumWorld.z); mxz = Math.max(mxz, bb.maximumWorld.z);
            }
            return { mnx, mny, mnz, mxx, mxy, mxz };
        }

        // 置き方。0 = 立てる（切り口を下に） / 1 = 寝かせる（写真のざる）
        setPose(pose, floorY) {
            if (pose === 0) {
                this.root.rotationQuaternion = BABYLON.Quaternion.Identity();
            } else {
                // 【対策】寝かせる向きをオイラー角で持つと、カメラの初期方位を
                //         変えるたびに合わせ直すことになり、意味も読めない。
                //         「茎の先が world のどちらを向くか」というベクトルで
                //         持ち、ローカル +Y（切り口→頭）をその逆へ向ける
                //         回転として作る。POSE_LIE は既定カメラで画面の
                //         右やや下に茎が来るよう逆算した値
                const d = POSE_LIE.clone();
                d.normalize();
                const up = BABYLON.Vector3.Up();
                const ax = BABYLON.Vector3.Cross(up, d);
                const an = Math.acos(clamp(BABYLON.Vector3.Dot(up, d), -1, 1));
                this.root.rotationQuaternion = (ax.length() < 1e-5)
                    ? BABYLON.Quaternion.Identity()
                    : BABYLON.Quaternion.RotationAxis(ax.normalize(), an);
            }
            this.root.position.set(0, 0, 0);
            this.root.computeWorldMatrix(true);
            const b = this.worldBounds();
            this.root.position.y += floorY - b.mny;
            // 頭の中心が画の真ん中に来るように水平方向も戻す
            this.root.computeWorldMatrix(true);
            const b2 = this.worldBounds();
            this.root.position.x -= (b2.mnx + b2.mxx) * 0.5;
            this.root.position.z -= (b2.mnz + b2.mxz) * 0.5;
            this.root.computeWorldMatrix(true);
            // 落下開始位置を作るため、静止する姿勢と位置を覚えておく
            this.poseQ = this.root.rotationQuaternion.clone();
            this.poseP = this.root.position.clone();
        }

        dispose() {
            for (const m of this.parts) m.dispose();
            this.root.dispose();
            this.parts.length = 0;
        }
    }

    // =================================================================
    //  マテリアル
    // =================================================================
    class Mats {
        constructor(scene, cfg) {
            this.scene = scene;
            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const curd = new BABYLON.PBRMaterial("curdMat", scene);
            curd.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            curd.metallic = 0.0;
            curd.roughness = cfg.budRough;
            curd.transparencyMode = OPAQUE;
            // 【対策】蕾の表面はブルーム（果粉）で覆われていて、艶は出ない。
            //         クリアコートを入れると「濡れたコケ」になる。代わりに
            //         シーンを弱く効かせると、斜めから見たときだけ白っぽく
            //         かすむ粉っぽさが出る
            curd.sheen.isEnabled = true;
            curd.sheen.intensity = 0.16;
            curd.sheen.roughness = 0.85;
            curd.sheen.color = new BABYLON.Color3(0.62, 0.70, 0.66);
            curd.sheen.linkSheenWithAlbedo = false;
            // 葉序の粒は法線マップで出す（対数極座標の UV に貼る）
            const bt = TextureLab.budNormal(scene, cfg.budTexSize, cfg.budTexRows,
                cfg.budTexAR, cfg.budRadius, cfg.spiralFine, cfg.budTexStrength);
            bt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
            bt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
            bt.gammaSpace = false;
            bt.anisotropicFilteringLevel = 8;
            curd.bumpTexture = bt;
            curd.bumpTexture.level = cfg.budBumpLevel;
            this.budTex = bt;
            this.curd = curd;

            const stem = new BABYLON.PBRMaterial("stemMat", scene);
            stem.albedoColor = new BABYLON.Color3(1, 1, 1);
            stem.metallic = 0.0;
            stem.roughness = cfg.stemRough;
            stem.transparencyMode = OPAQUE;
            stem.clearCoat.isEnabled = true;
            stem.clearCoat.intensity = cfg.stemCoat;
            stem.clearCoat.roughness = 0.24;
            // 【対策】食品の表面を覆っているのは水（1.33）で、樹脂（1.5）ではない。
            //         1.5 にするとプラスチックの人形になる
            stem.clearCoat.indexOfRefraction = 1.33;
            stem.subSurface.isTranslucencyEnabled = true;
            stem.subSurface.tintColor = new BABYLON.Color3(0.55, 0.72, 0.32);
            // 【対策】Babylon 8 で translucencyIntensity は拡散と透過の
            //         配合比に変わった。1.0 を超えると拡散が消えて発光する
            stem.subSurface.translucencyIntensity = 0.22;
            stem.subSurface.minimumThickness = 0.8;
            stem.subSurface.maximumThickness = 3.6;
            this.stem = stem;

            // --- 葉身
            const leaf = new BABYLON.PBRMaterial("leafMat", scene);
            leaf.albedoColor = new BABYLON.Color3(1, 1, 1);
            leaf.metallic = 0.0;
            leaf.roughness = 0.56;
            leaf.transparencyMode = OPAQUE;
            // 【対策】葉身は厚さ 0.3mm 程度のシートで作ってあるので、
            //         両面を点灯させないと裏から見た葉が真っ黒に抜ける
            leaf.backFaceCulling = false;
            leaf.twoSidedLighting = true;
            // 【対策】アブラナ科の葉は蝋質のブルームで覆われていて、
            //         斜めから見ると白く粉を吹く。これが無いと造花の葉になる
            leaf.sheen.isEnabled = true;
            leaf.sheen.intensity = 0.34;
            leaf.sheen.roughness = 0.70;
            leaf.sheen.color = new BABYLON.Color3(0.70, 0.76, 0.72);
            leaf.subSurface.isTranslucencyEnabled = true;
            leaf.subSurface.tintColor = new BABYLON.Color3(0.42, 0.62, 0.22);
            leaf.subSurface.translucencyIntensity = 0.42;
            leaf.subSurface.minimumThickness = 0.01;
            leaf.subSurface.maximumThickness = 0.14;
            this.leaf = leaf;
        }

        // 0 = 通常 / 1 = 白クレイ（形だけ）/ 2 = 粒を外す
        // 0 = 通常 / 1 = 白クレイ / 2 = 末端を外す / 3 = 断面
        setDebug(mode, meshes) {
            const white = (mode === 1);
            const cut = (mode === 3);
            this.curd.albedoColor = new BABYLON.Color3(white ? 0.72 : 1, white ? 0.72 : 1, white ? 0.72 : 1);
            this.stem.albedoColor = new BABYLON.Color3(white ? 0.78 : 1, white ? 0.78 : 1, white ? 0.78 : 1);
            this.curd.sheen.isEnabled = !white;
            this.leaf.sheen.isEnabled = !white;
            this.leaf.subSurface.isTranslucencyEnabled = !white;
            this.stem.clearCoat.isEnabled = !white;
            this.stem.subSurface.isTranslucencyEnabled = !white;
            // 【対策】断面表示のときは背面カリングを切る。この模型は
            //         「閉じた円錐の殻」を入れ子にしたものなので、
            //         切っただけでは内側の面が描かれず、空洞が真っ黒に見える
            for (const m of [this.curd, this.stem, this.leaf]) {
                m.backFaceCulling = !cut && (m !== this.leaf);
                m.twoSidedLighting = cut || (m === this.leaf);
            }
            this.scene.clipPlane = cut ? new BABYLON.Plane(0, 0, 1, 0) : null;
            for (const m of meshes) {
                m.useVertexColors = !white;
                if (m.name === "romanescoTips") m.setEnabled(mode !== 2);
            }
        }

        dispose() {
            if (this.budTex) this.budTex.dispose();
            this.curd.dispose(true, false);
            this.stem.dispose(true, false);
            this.leaf.dispose(true, false);
        }
    }


    // =================================================================
    //  TextureLab （ざるの網代だけ。野菜側は全部頂点カラー）
    // =================================================================
    const TextureLab = {
        _tex(name, size, fill, scene) {
            size = Math.max(8, Math.round(size) || 512);
            const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(size, size);
            fill(img.data, size);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            dt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },
        // 葉序の粒の法線マップ
        // 【対策】写真計測のロマネスコを調べると、ジオメトリは驚くほど粗く、
        //         螺旋の細部はすべて法線マップに入っている。頂点変位で
        //         出そうとすると、斜列 21 本を解像するのに周方向 60 分割以上が
        //         要り、末端が数千個あるので破綻する。
        // 【対策】この野菜には都合のよい性質がある。対数極座標
        //         (x, y) = (θ/2π, ln f / ln λ) の上では、葉序の格子は
        //         どの階層でも まったく同じ形になる。つまり
        //         1 枚のテクスチャを全部の円錐に貼り回せる
        budNormal(scene, size, rows, ar, radiusFrac, fine, strength) {
            const GA = 0.3819660113;
            // 【対策】粒の半径は「格子の目盛」ではなく「隣の節点までの距離」で
            //         決める。黄金角の格子では最近接は 1 つ隣ではなく
            //         フィボナッチ数だけ離れた節点で、その距離は AR に依存して
            //         5〜6 目盛にもなる。目盛で 0.6 などと決めていたため、
            //         粒がぽつぽつ散った点描になっていた
            let dmin = 1e9;
            for (let F = 1; F <= 89; F++) {
                let dx = F * GA; dx -= Math.round(dx);
                const dd = Math.sqrt((dx * ar) * (dx * ar) + F * F);
                if (dd < dmin) dmin = dd;
            }
            const radius = dmin * radiusFrac;
            const H = new Float32Array(size * size);
            for (let py = 0; py < size; py++) {
                const y = py / size * rows;
                const i0 = Math.round(y);
                for (let px = 0; px < size; px++) {
                    const x = px / size;
                    // 【対策】最近接がフィボナッチ数だけ離れた節点なので、
                    //         候補を ±2 しか見ないとセルが切れて横縞が出る
                    let best = 1e9, best2 = 1e9;
                    for (let d = -8; d <= 8; d++) {
                        const i = i0 + d;
                        const xi = i * GA - Math.floor(i * GA);
                        let dx = x - xi; dx -= Math.round(dx);
                        const dy = y - i;
                        const dd = (dx * ar) * (dx * ar) + dy * dy;
                        if (dd < best) best = dd;
                    }
                    // もう1階層細かい粒。同じ格子を φ³ 倍細かくしたもの
                    // （y も AR も同率で縮めないと葉序の形が崩れる）
                    const SC = 4.236;
                    const y2 = y * SC, ar2 = ar * SC;
                    const j0 = Math.round(y2);
                    for (let d = -8; d <= 8; d++) {
                        const j = j0 + d;
                        const xj = j * GA - Math.floor(j * GA);
                        let dx = x - xj; dx -= Math.round(dx);
                        const dy = y2 - j;
                        const dd = (dx * ar2) * (dx * ar2) + dy * dy;
                        if (dd < best2) best2 = dd;
                    }
                    const b1 = 1 - smooth(0, radius, Math.sqrt(best));
                    const b2 = 1 - smooth(0, radius, Math.sqrt(best2));
                    H[py * size + px] = b1 + b2 * fine;
                }
            }
            return this._tex("romanescoBud", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    for (let x = 0; x < N; x++) {
                        const xl = H[y * N + ((x - 1 + N) % N)], xr = H[y * N + ((x + 1) % N)];
                        const yu = H[((y - 1 + N) % N) * N + x], yd = H[((y + 1) % N) * N + x];
                        let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * N + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // 竹ひごの網代（あじろ）。u が周方向、v が中心→縁
        // 【対策】明暗差を付けすぎると将棋盤になる。竹ひごの上下は
        //         色ではなく陰影の差でしかない
        bamboo(scene, size, seed) {
            // 【対策】ざるのアルベドは他の野菜（トマト・シイタケ）と同じ値だが、
            //         こちらは花蕾を出すために露出と環境光を上げてある。
            //         同じ 0.87 を入れると白く飛んで、竹ではなく紙皿になる。
            //         明るさを上げたぶんだけアルベドを落として釣り合わせる
            const K = 0.80;
            const OVER = [0.870 * K, 0.795 * K, 0.625 * K];
            const UNDER = [0.795 * K, 0.710 * K, 0.535 * K];
            const GAP = [0.560 * K, 0.475 * K, 0.335 * K];
            return this._tex("basketAlbedo", size, (d, N) => {
                const SPOKE = 152, RING = 42;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * SPOKE, sv = v * RING;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.88 + 0.16 * bv) : (0.74 + 0.13 * bu);
                        const gap = smooth(0, 0.10, Math.min(fu, 1 - fu))
                            * smooth(0, 0.10, Math.min(fv, 1 - fv));
                        const fib = 0.90 + 0.20 * Noise.fbm2u(u * 260, v * 14, 260, seed, 2);
                        const age = 0.88 + 0.24 * Noise.fbm2u(u * 6, v * 5, 6, seed + 9, 3);
                        const C = over ? OVER : UNDER;
                        let r = C[0] * shade * fib * age;
                        let g = C[1] * shade * fib * age;
                        let b = C[2] * shade * fib * age;
                        r = mix(GAP[0], r, gap); g = mix(GAP[1], g, gap); b = mix(GAP[2], b, gap);
                        d[i] = clamp(r, 0, 1) * 255;
                        d[i + 1] = clamp(g, 0, 1) * 255;
                        d[i + 2] = clamp(b, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        }
    };

    // =================================================================
    // 7. Basket （ざる）
    // =================================================================
    // 【対策】物理の当たり判定に薄い一枚板を使うと、落下速度によっては
    //         すり抜ける。内面と外面を張って縁で閉じた「厚みのある器」に
    //         しておけば、静的トライメッシュでも安定して受け止められる
    function buildBasket(scene, cfg) {
        const M = cfg.basketSegments, K = cfg.basketRings;
        const TH = cfg.basketThick, RIM = cfg.basketRim, DEP = cfg.basketDepth;

        const prof = (s) => {
            const r = RIM * s;
            const y = DEP * Math.pow(clamp((s - 0.50) / 0.50, 0, 1), 1.55);
            return [r, y];
        };
        const pn = (s) => {
            const e = 2e-3;
            const a = prof(Math.max(0, s - e)), b = prof(Math.min(1, s + e));
            const dr = b[0] - a[0], dy = b[1] - a[1];
            const l = Math.hypot(dr, dy) || 1;
            return [-dy / l, dr / l];
        };

        const W = M + 1, LAY = (K + 1) * W, total = LAY * 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i <= K; i++) {
            const s2 = i / K, pr = prof(s2), nn = pn(s2);
            const r = pr[0], y = pr[1], nr = nn[0], ny = nn[1];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * TAU;
                const cs = Math.cos(phi), sn = Math.sin(phi);
                const a = i * W + j, b = LAY + a;
                positions[a * 3] = r * cs; positions[a * 3 + 1] = y; positions[a * 3 + 2] = r * sn;
                const ro = r - nr * TH, yo = y - ny * TH;
                positions[b * 3] = ro * cs; positions[b * 3 + 1] = yo; positions[b * 3 + 2] = ro * sn;
                uvs[a * 2] = j / M; uvs[a * 2 + 1] = s2;
                uvs[b * 2] = j / M; uvs[b * 2 + 1] = s2;
            }
        }
        const indices = [];
        for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
            indices.push(LAY + A, LAY + B, LAY + C, LAY + B, LAY + D, LAY + C);
        }
        for (let j = 0; j < M; j++) {
            const o0 = K * W + j, o1 = o0 + 1;
            indices.push(o0, LAY + o0, o1, o1, LAY + o0, LAY + o1);
        }
        const refI = Math.round(K * 0.85);
        const normals = finalize(positions, indices, new V3(0, DEP * 0.35, 0), LAY + refI * W);
        weldNormals(positions, normals);
        const mesh = makeMesh("basket", positions, indices, normals, uvs, null, scene);
        // 【対策】この器は「内面 y=0 から下へ厚み TH」で作ってあるので、
        //         そのまま置くと内面が地面（y=0）と同一平面になり、底一面が
        //         Z ファイティングを起こす。外面が地面に接するまで持ち上げる
        mesh.position.y = TH;

        const m = new BABYLON.PBRMaterial("basketMat", scene);
        m.albedoTexture = TextureLab.bamboo(scene, 1024, 4242);
        m.albedoTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        m.albedoTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
        // 【対策】細かい市松は縮小時にモアレを起こす。異方性フィルタで抑える
        m.albedoTexture.anisotropicFilteringLevel = 8;
        m.metallic = 0.0;
        m.roughness = 0.74;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        m.backFaceCulling = false;
        m.twoSidedLighting = true;
        mesh.material = m;
        mesh.receiveShadows = true;
        return mesh;
    }

    // =================================================================
    // 8. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.945, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    // 【対策】花蕾は「暗い緑の下地に、明るい粒が無数に載っている」構造で、
    //         平均アルベドが低いうえ、粒どうしが互いを遮蔽して
    //         さらに落ちる。他の野菜と同じ露出だと真っ黒な塊になる。
    //         環境光・露出を上げ、コントラストは逆に下げて暗部を潰さない
    scene.environmentIntensity = 0.80;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.05, 0.98, 46, new V3(0, 6.0, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.60;
    camera.wheelPrecision = 10;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を小さくすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 5;
    camera.maxZ = 260;
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 140;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.56;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.42, -0.90, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.96);
    key.specular = new BABYLON.Color3(0.55, 0.55, 0.52);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.88, -0.30, -0.60).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.95, 1.0, 0.95);
    fillL.specular = new BABYLON.Color3(0.24, 0.26, 0.22);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.58;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.76, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    // 【対策】粒は1個ずつが閉じた立体なので、裏面だけ影マップへ描けば
    //         自己遮蔽（シャドウアクネ）が原理的に起きない。
    //         数万個の粒に通常のバイアスで対処するのは無理
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0004;
    sg.normalBias = 0.012;
    sg.darkness = 0.28;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.02;
    ip.contrast = 1.14;
    ip.vignetteEnabled = false;

    // =================================================================
    //  物理（ざるへ落として据わらせる）
    // =================================================================
    let physicsOn = false;
    try {
        const havok = await HavokPhysics();
        // 【対策】HavokPlugin の第1引数は _useDeltaForWorldStep。
        //         true（既定）だとフレームのデルタ時間でそのまま積分するため、
        //         フレーム落ちのたびにステップ幅が変わり、接触が解けたり
        //         深く食い込んだりを繰り返して震える。false で固定ステップにする
        const hk = new BABYLON.HavokPlugin(false, havok);
        // 【対策】1単位 = 1cm なので重力も cm/s² で与える。ただし実重力 981 は
        //         入れない。Havok の接触許容量やスリープ閾値は絶対値で、
        //         メートル系を前提に決まっている。cm 単位のシーンでは実質
        //         1/100 の厳しさになり、1ステップのめり込みが許容量を超えて
        //         押し戻され続ける。重力を数百に落とすのがいちばん安い解
        scene.enablePhysics(new V3(0, -GLOBAL.gravity, 0), hk);
        if (hk.setTimeStep) hk.setTimeStep(1 / GLOBAL.physicsHz);
        physicsOn = true;
    } catch (err) {
        console.warn("[Romanesco] Havok を初期化できませんでした。静置します。", err);
        physicsOn = false;
    }

    let ground = null;
    if (GLOBAL.showGround) {
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 220, height: 2, depth: 220 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.90, 0.905).toLinearSpace();
        gm.metallic = 0.0; gm.roughness = 0.88;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        ground.material = gm;
        ground.receiveShadows = true;
        ground.position.y = -1.06;
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        if (physicsOn) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    let basket = buildBasket(scene, GLOBAL);

    let dropBody = null, dropShape = null, dropProxy = null;
    let settleT = 0, stillT = 0, frozen = false;
    let basketBody = null, basketShape = null;

    // 【対策】ざるは内面と外面を張って縁で閉じた「厚みのある器」なので、
    //         静的トライメッシュのまま安定して受け止められる。
    //         円盤などで代用すると器の壁で受け止められない
    function setBasketPhysics(on) {
        if (basketBody) { basketBody.dispose(); basketBody = null; }
        if (basketShape) { try { basketShape.dispose(); } catch (e) { } basketShape = null; }
        if (!physicsOn || !on) return;
        basketShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        basketShape.material = { friction: 0.85, restitution: 0.0 };
        basketBody = new BABYLON.PhysicsBody(basket, BABYLON.PhysicsMotionType.STATIC, false, scene);
        basketBody.shape = basketShape;
    }

    function clearDrop() {
        if (dropBody) { dropBody.dispose(); dropBody = null; }
        if (dropShape) { try { dropShape.dispose(); } catch (e) { } dropShape = null; }
        // 【対策】代理を先に捨てると本体の親が消えた節点を指したままになる
        if (item && item.root) item.root.parent = null;
        if (dropProxy) { dropProxy.dispose(); dropProxy = null; }
        settleT = 0; stillT = 0; frozen = false;
    }

    // 衝突用の低ポリ代理。
    // 【対策】60万頂点の花蕾から凸包を作ると生成で固まるし、粒1個ずつの
    //         接触を解いても意味がない。かといって扁球＋円柱で近似すると、
    //         実際の房の張り出しぶん小さくなり、見た目が器へめり込む。
    //         房の中心を半径ぶん外へ押した点と茎の輪郭点、つまり
    //         「本体そのものの外殻」から凸包を作る
    function proxyPoints() {
        const pts = [];
        // 【対策】数千個の円錐から凸包を作ると生成で固まる。頭の輪郭を
        //         決めているのは一次の小塔の先端だけなので、そこと
        //         茎の輪郭、葉柄の付け根だけを渡す
        if (item.hullPts) for (const p of item.hullPts) pts.push([p.x, p.y, p.z]);
        pts.push([0, item.headBase.y + item.headH, 0]);
        for (let ring = 0; ring <= 3; ring++) {
            const sv = ring / 3;
            const y = item.H * sv, r = item.stemRadius(sv);
            for (let j = 0; j < 12; j++) {
                const a = j / 12 * TAU;
                pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
            }
        }
        // 【対策】ロマネスコも切り口の小さな円では立たない。外へ張り出した
        //         葉柄の輪を凸包へ入れて、実物と同じ据わり方にする
        if (item.ribPts) for (const p of item.ribPts) pts.push([p.x, p.y, p.z]);
        return pts;
    }

    function makeProxy(pts) {
        const mesh = new BABYLON.Mesh("romanescoProxy", scene);
        const pos = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
            pos[i * 3] = pts[i][0]; pos[i * 3 + 1] = pts[i][1]; pos[i * 3 + 2] = pts[i][2];
        }
        const idx = [];
        for (let i = 0; i + 2 < pts.length; i++) idx.push(i, i + 1, i + 2);
        const nrm = new Float32Array(pts.length * 3);
        BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
        const mm = makeMesh("romanescoProxy", pos, idx, nrm, null, null, scene);
        mesh.dispose();
        mm.isVisible = false;
        return mm;
    }

    function dropItem() {
        clearDrop();
        if (!item) return;
        item.setPose(GLOBAL.pose, floorY());
        // カメラの注視点は据わったあとの位置で決めたいので、
        // 落下前の静止姿勢での範囲をここで控えておく
        item.restBounds = item.worldBounds();
        if (!physicsOn) return;

        const pts = proxyPoints();
        dropProxy = makeProxy(pts);
        dropProxy.rotationQuaternion = item.poseQ.clone();

        // 【対策】代理の外形は本体と完全には一致しない。本体の静止位置を
        //         そのまま使うと、代理のほうが下へはみ出していた場合に
        //         器へ食い込んだ状態で生成され、ソルバが押し返して
        //         「下から浮き上がってきて震える」動きになる。
        //         代理を回した状態での最下点を測り、そこを基準に持ち上げる
        const m = new BABYLON.Matrix();
        BABYLON.Matrix.FromQuaternionToRef(dropProxy.rotationQuaternion, m);
        let lo = Infinity, cx = 0, cz = 0, n = 0;
        const tmp = new V3();
        for (const p of pts) {
            BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(p[0], p[1], p[2], m, tmp);
            if (tmp.y < lo) lo = tmp.y;
            cx += tmp.x; cz += tmp.z; n++;
        }
        dropProxy.position.set(
            -cx / n + (Math.random() - 0.5) * 0.9,
            floorY() + GLOBAL.dropHeight - lo,
            -cz / n + (Math.random() - 0.5) * 0.9);

        item.root.parent = dropProxy;
        item.root.rotationQuaternion = BABYLON.Quaternion.Identity();
        item.root.position.set(0, 0, 0);

        dropShape = new BABYLON.PhysicsShapeConvexHull(dropProxy, scene);
        dropShape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
        dropBody = new BABYLON.PhysicsBody(dropProxy, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        dropBody.shape = dropShape;
        dropBody.setMassProperties({ mass: GLOBAL.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションに書いても効かない
        dropBody.setLinearDamping(GLOBAL.linearDamping);
        dropBody.setAngularDamping(GLOBAL.angularDamping);
        // 【対策】毎フレーム「ノードの姿勢 → 物理ボディ」へ書き戻すと、
        //         物理が出した結果を読み直して押し込む往復が起き、
        //         接触したまま延々と震える。落とす前に姿勢は決めてあるので
        //         書き戻しは要らない
        dropBody.disablePreStep = true;
    }

    scene.onBeforeRenderObservable.add(() => {
        if (!physicsOn || !dropBody || frozen) return;
        const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
        settleT += dt;
        // 【対策】静止後もソルバの残差で微振動が続く。速度がしきい値を
        //         下回った状態が続いたら STATIC に固定して完全に止める
        let moving = true;
        try {
            moving = dropBody.getLinearVelocity().length() > GLOBAL.settleSpeed
                || dropBody.getAngularVelocity().length() > GLOBAL.settleSpin;
        } catch (e) { moving = false; }
        stillT = moving ? 0 : stillT + dt;
        if (stillT > GLOBAL.settleHold || settleT > GLOBAL.settleTimeout) {
            dropBody.setMotionType(BABYLON.PhysicsMotionType.STATIC);
            frozen = true;
        }
    });

    setBasketPhysics(GLOBAL.showBasket);

    // =================================================================
    //  生成
    // =================================================================
    let item = null, mats = null, curVariety = START_VARIETY, curSeed = START_SEED, curCfg = null;
    let dbgIdx = 0, onRebuilt = null;
    const DEBUGS = ["通常", "白クレイ", "末端を外す", "断面"];

    function floorY() {
        return GLOBAL.showBasket ? GLOBAL.basketThick : 0;
    }

    function build(varietyKey, seed) {
        clearDrop();
        if (item) item.dispose();
        if (mats) mats.dispose();
        const cfg = buildConfig(varietyKey, seed);
        curCfg = cfg;
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        mats = new Mats(scene, cfg);
        item = new Romanesco(scene, cfg, seed, mats);
        dropItem();

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const m of item.parts) sg.addShadowCaster(m, true);
        if (basket) sg.addShadowCaster(basket, true);

        const b = item.restBounds || item.worldBounds();
        camera.target.set(0, (b.mny + b.mxy) * 0.5, 0);
        camera.radius = Math.max(26, (b.mxx - b.mnx) * 2.6);

        mats.setDebug(dbgIdx, item.parts);
        const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        console.log("[Romanesco]", BUILD, "/", cfg.label, "/ seed =", cfg.seed,
            "/ 小塔", item.coneCount.filter(v => v > 0).join("/"), "/ 末端", item.tipCount, "個 /",
            Math.round(t1 - t0), "ms");
        if (typeof globalThis.__DBG !== "undefined") {
            console.log("  円錐:", item.coneCount.join(" / "),
                "（レベル別）  末端", item.tipCount,
                "  頭 φ" + (cfg.headRho * 2).toFixed(1) + "cm 高" + cfg.headH.toFixed(1) + "cm");
        }
        if (onRebuilt) onRebuilt();
    }

    build(START_VARIETY, START_SEED);

    if (GLOBAL.useSSAO) {
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        // 【対策】房と房のあいだの谷は 5〜10mm。半径を大きく取ると
        //         野菜と床の隙間しか拾わず、頭部が一枚の平面に見える。
        //         1〜2mm の粒の谷は SSAO では届かないので頂点色に焼いてある
        ssao.radius = 0.62;
        ssao.totalStrength = 0.85;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 180;
        ssao.minZAspect = 0.3;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.98;
    dp.bloomWeight = 0.06;
    dp.bloomKernel = 36;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    // 【対策】粒が細かいのでシャープンを強くすると、粒のふちに白い縁取りが
    //         出て一気に CG くさくなる。他の野菜より弱めにする
    dp.sharpen.edgeAmount = 0.14;
    dp.depthOfFieldEnabled = GLOBAL.useDOF;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.High;
    dp.depthOfField.lensSize = 50;
    dp.depthOfField.fStop = GLOBAL.dofFStop;
    scene.onBeforeRenderObservable.add(() => {
        if (!dp.depthOfFieldEnabled) return;
        const focus = camera.radius * 1000;
        dp.depthOfField.focusDistance = focus;
        dp.depthOfField.focalLength = focus * GLOBAL.dofRatio;
    });

    // =================================================================
    // 9. GUI
    // =================================================================
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#1d2410", active: "#5c7a1e", edge: "#3a4526",
        text: "#f1f6e2", sub: "#b9c99a", accent: "#c8e26a"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "238px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(16,18,12,0.84)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "206px"; panel.isVertical = true;
    panel.paddingTop = "14px"; panel.paddingBottom = "14px";
    card.addControl(panel);

    function addLabel(text, size, color, height) {
        const t = new BABYLON.GUI.TextBlock();
        t.text = text; t.height = height || "22px";
        t.color = color || COL.text; t.fontSize = size || 13;
        t.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        t.textWrapping = true;
        panel.addControl(t);
        return t;
    }
    function addButton(name, text, onClick) {
        const b = BABYLON.GUI.Button.CreateSimpleButton(name, text);
        b.height = "34px"; b.paddingBottom = "6px";
        b.color = COL.text; b.background = COL.idle;
        b.cornerRadius = 6; b.thickness = 0; b.fontSize = 14;
        b.onPointerUpObservable.add(onClick);
        panel.addControl(b);
        return b;
    }

    addLabel("ROMANESCO", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    const varietyBtns = {}, qualBtns = {};
    function highlight() {
        for (const k in varietyBtns) varietyBtns[k].background = (k === curVariety) ? COL.active : COL.idle;
        for (const k in qualBtns) qualBtns[k].background = (+k === GLOBAL.quality) ? COL.active : COL.idle;
    }
    for (const k of Object.keys(PRESETS)) {
        varietyBtns[k] = addButton("v_" + k, PRESETS[k].label, () => {
            curVariety = k; build(curVariety, curSeed); highlight();
        });
    }

    addLabel("粒の細かさ", 13, COL.accent, "26px");
    for (let q = 0; q < QUALITY.length; q++) {
        qualBtns[q] = addButton("q" + q, QUALITY[q].label, () => {
            GLOBAL.quality = q; build(curVariety, curSeed); highlight();
        });
    }

    const sp = new BABYLON.GUI.Rectangle();
    sp.height = "8px"; sp.thickness = 0; sp.background = "";
    panel.addControl(sp);

    const poseBtn = addButton("pose", "置き方: 立てる", () => {
        GLOBAL.pose = GLOBAL.pose === 0 ? 1 : 0;
        dropItem();
        const b = item.restBounds || item.worldBounds();
        camera.target.set(0, (b.mny + b.mxy) * 0.5, 0);
        poseBtn.textBlock.text = "置き方: " + (GLOBAL.pose === 0 ? "立てる" : "寝かせる");
        if (onRebuilt) onRebuilt();
    });
    const basketBtn = addButton("basket", "ざる: ON", () => {
        GLOBAL.showBasket = !GLOBAL.showBasket;
        basket.setEnabled(GLOBAL.showBasket);
        setBasketPhysics(GLOBAL.showBasket);
        dropItem();
        basketBtn.background = GLOBAL.showBasket ? COL.active : COL.idle;
        basketBtn.textBlock.text = "ざる: " + (GLOBAL.showBasket ? "ON" : "OFF");
    });
    basketBtn.background = COL.active;
    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed); highlight();
    });
    const dbgBtn = addButton("dbg", "表示: 通常", () => {
        dbgIdx = (dbgIdx + 1) % DEBUGS.length;
        mats.setDebug(dbgIdx, item.parts);
        dbgBtn.background = dbgIdx ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "表示: " + DEBUGS[dbgIdx];
    });
    let shadowOn = true;
    const shadowBtn = addButton("shadow", "影: ON", () => {
        shadowOn = !shadowOn;
        key.shadowEnabled = shadowOn;
        shadowBtn.background = shadowOn ? COL.active : COL.idle;
        shadowBtn.textBlock.text = "影: " + (shadowOn ? "ON" : "OFF");
    });
    shadowBtn.background = COL.active;
    const dofBtn = addButton("dof", "被写界深度: ON", () => {
        GLOBAL.useDOF = !GLOBAL.useDOF;
        dp.depthOfFieldEnabled = GLOBAL.useDOF;
        dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
        dofBtn.textBlock.text = "被写界深度: " + (GLOBAL.useDOF ? "ON" : "OFF");
    });
    dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
    const rotateBtn = addButton("rotate", "自動回転: OFF", () => {
        camera.useAutoRotationBehavior = !camera.useAutoRotationBehavior;
        if (camera.autoRotationBehavior) camera.autoRotationBehavior.idleRotationSpeed = 0.08;
        rotateBtn.textBlock.text = "自動回転: " + (camera.useAutoRotationBehavior ? "ON" : "OFF");
        rotateBtn.background = camera.useAutoRotationBehavior ? COL.active : COL.idle;
    });

    const info = addLabel("", 12, COL.sub, "58px");
    onRebuilt = () => {
        if (!info || !item) return;
        const b = item.worldBounds();
        info.text = "小塔 " + item.coneCount.filter(v => v > 0).join("/") + " / 末端 " + item.tipCount
            + "\n高さ " + (b.mxy - b.mny).toFixed(1) + "cm  幅 " + (b.mxx - b.mnx).toFixed(1) + "cm"
            + "\nseed: " + curSeed + "  [" + BUILD + "]";
    };
    onRebuilt();

    // ---- GUI の開閉（スマホでは初期状態で畳む）-----------------------
    function viewportCss() {
        const c = engine.getRenderingCanvas();
        return {
            w: (c && c.clientWidth) || window.innerWidth || 1024,
            h: (c && c.clientHeight) || window.innerHeight || 768
        };
    }
    function isCompact() {
        const v = viewportCss();
        return v.w < GLOBAL.compactWidth || Math.min(v.w, v.h) < GLOBAL.compactMinSide;
    }

    const toggleBtn = BABYLON.GUI.Button.CreateSimpleButton("guiToggle", "\u2261");
    toggleBtn.width = "38px"; toggleBtn.height = "38px";
    toggleBtn.cornerRadius = 10; toggleBtn.thickness = 1;
    toggleBtn.color = COL.edge;
    toggleBtn.background = "rgba(16,18,12,0.84)";
    toggleBtn.fontSize = 20;
    if (toggleBtn.textBlock) toggleBtn.textBlock.color = COL.text;
    toggleBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    toggleBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    toggleBtn.left = "16px"; toggleBtn.top = "16px";
    ui.addControl(toggleBtn);

    let panelOpen = !isCompact();
    function applyGuiLayout() {
        const scale = isCompact()
            ? clamp(engine.getRenderWidth() / Math.max(1, viewportCss().w), 1, GLOBAL.guiMaxScale)
            : 1;
        for (const c of [toggleBtn, card]) {
            c.transformCenterX = 0; c.transformCenterY = 0;
            c.scaleX = scale; c.scaleY = scale;
        }
        card.top = (16 + 38 * scale + 8) + "px";
        card.isVisible = panelOpen;
        if (toggleBtn.textBlock) toggleBtn.textBlock.text = panelOpen ? "\u00d7" : "\u2261";
        toggleBtn.background = panelOpen ? COL.active : "rgba(16,18,12,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;