// =====================================================================
//  Photoreal Mikan  /  写実的なミカン（調整版 v12 : 三ヶ日みかん）
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  v12 の変更点: 品種「三ヶ日みかん」（青島温州）を追加し、起動時の品種にした。
//
//  v12.1 : 「リンゴの形に見える」の修正
//    原因: 共通の子午線 MERIDIAN が
//      ・天面中央に深い梗あ、その外周に肩の盛り上がり
//      ・最大径が中央より上（y≒0.56）で、下へすぼまる
//    という形で、扁平にしてもリンゴの特徴がそのまま残っていた。
//    対策: 新キー superN / superNTop / topDimple。superN > 0 の品種は
//      超楕円 |x|^n + |y|^n = 1 で断面を作る（天面 n=2.6、底面 n=2.25）。
//      天面も底面も広く平らで、最大径はほぼ中央。へたは浅い窪みに座る。
//    参考写真に合わせた見直し:
//      ・扁平率 0.80（径 7.3cm / 高さ 5.8cm）
//      ・色は黄みに寄せた明るい橙（地色 [1.00, 0.57, 0.10]）
//      ・油胞は細かく浅く（glandCols 270、glandDepth 0.70、bumpLevel 0.60）
//        v12 では粒が大きく深く、ネーブルオレンジの肌に見えていた
//      ・がくは小さく（径 約 7mm）くすんだ緑。果梗は短い切り株
//      ・個体差の凹み（asymmetry）としわは控えめに
//    既存4品種は superN = 0 で、従来の MERIDIAN のまま。
//
//  v12.2 : 表面の質感を写真に寄せる
//    v12.1 の肌は艶が弱くマットで、油胞は大小ばらばらに散って
//    スポンジのように見えていた。写真では
//      ・ワックスの強い艶。広いハイライトが油胞の凹みで点々と割れる
//      ・油胞は粒がそろい、蜂の巣状に密に並ぶ。縁はなだらか
//    対策:
//      ・クリアコートを強く・滑らかに（waxIntensity 2.0 → 0.84、coatRoughness 0.30）
//      ・新キー glandVar / glandJitter : 粒径と位置のばらつきを絞る
//      ・新キー glandBowl : 油胞の断面を円錐から丸い椀へ
//      ・新キー skinNoise : 油胞と同じ大きさの不規則ノイズを弱める
//      ・油胞 300 列。粒が 3px では潰れるので textureSize を 2048 に
//        （焼き込みは約4倍の時間がかかる）。法線の強さは解像度で補正
//    既存4品種は旧版と同じ値（glandVar 1.05 / glandJitter 0.46 / skinNoise 1 / glandBowl 0）。
//
//  v12.3 : 「油胞が水玉模様の印刷に見える」の修正
//    油胞を色（glandInk・AO）で塗っていたため、拡散光の下でも濃い点が
//    くっきり並び、印刷した網点のように見えていた。実物の油胞は色の差が
//    ほとんどなく、ハイライトの中で凹みとして見えるだけ。
//      ・glandInk 0.42 → 0.12、新キー pitAO（凹みの AO の効き）0.30
//      ・粒を小さく浅く密に（320 列、glandSize 0.27、glandDepth 0.60）
//      ・ハイライトが点光源の小さな光点になっていたので、艶は保ったまま
//        少し粗くして広い艶に（coatRoughness 0.48、skinRoughness 0.46）
//      ・大きめのうねり（lumpAmount 0.30）でハイライトの縁を揺らす
//
//  v12.4 : 農家の「おいしいみかんの見分け方」に合わせる
//    参考: 三ヶ日みかん農家のブログ「甘くて美味しいみかんを見分ける6つのポイント」
//      ・色は緑が抜けた濃い橙。黄色っぽいのは日照不足の目安
//          → v12.1 で黄みへ寄せたのを戻す
//      ・皮のキメ（半透明の粒＝油胞）が細かい
//          → 新キー glandGloss : 油胞を「艶の抜けた凹み」から
//            「艶のある半透明の粒」へ。凹みは浅く（glandDepth 0.35）
//      ・軸は太く、ヘタは緑より黄色に近い
//          → 軸の直径 1.9mm → 2.8mm。新キー calyxYellow でヘタを黄みへ。
//            星の切れ込みは浅く（calyxStar 0.20）
//      ・横長の扁平形で、上から見て左右対称
//          → 扁平率 0.80 → 0.75 前後、asymmetry 0.016 → 0.010
//      ・皮が実に密着している（浮皮でない）
//          → 表面のうねり lumpAmount 0.30 → 0.18
//
//  （以下は v11 までの経緯）
//  v11 : 影が直線で切れて かまぼこ型に見える問題を、shadowFrustumSize の
//        固定と Z 範囲の明示で修正。
//  v10 : デコポンが真っ黒になる原因（プリセットのキー欠落 → NaN）を修正し、
//        buildConfig() でキー欠落・非有限値を検出するようにした。
//  v7〜v9 : 巻き順の判定を全頂点平均に、キャップの巻き順は側面から導出、
//        法線の長さ 0／NaN を (0,1,0) で置換。
// =====================================================================

var createScene = function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const PRESETS = {
        // 三ヶ日みかん（青島温州）: 扁平で肩は丸い。濃い橙一色で艶が強い
        mikkabi: {
            label: "三ヶ日みかん",
            radius: 3.50, height: 5.65,
            lobeAmp: 0.012, asymmetry: 0.010,
            neckAmount: 0.00, neckWidth: 0.30, neckWrinkle: 0.00, topTaper: 0.00,
            decoAmount: 0.00, decoLobeCount: 0, decoTaper: 0.00,
            shoulder: 0.00, superN: 2.25, superNTop: 2.60, topDimple: 0.030,
            wellDepth: 0.000, creaseCount: 6, creaseAmount: 0.008,
            ground: [0.98, 0.48, 0.05],
            deep: [0.95, 0.40, 0.03],
            green: [0.80, 0.58, 0.12],
            pitInk: [0.93, 0.43, 0.03],
            pitRim: [1.00, 0.62, 0.14],
            sunAmount: 0.20, sunFloor: 0.85, sunSpread: 1.0,
            greenAmount: 0.04,
            glandCols: 320, glandSize: 0.29, glandDepth: 0.35, glandInk: 0.14,
            glandVar: 0.40, glandJitter: 0.30, skinNoise: 0.35, glandBowl: 1.0, pitAO: 0.15, glandGloss: 1.0,
            lumpAmount: 0.18, blemishAmount: 0.05,
            skinRoughness: 0.46, waxIntensity: 2.00,
            coatRoughness: 0.48, bumpLevel: 0.80,
            textureSize: 2048,
            calyxRadius: 0.088, calyxLobes: 5, calyxLift: 0.020,
            calyxStar: 0.20, calyxFresh: 0.00, calyxYellow: 0.70,
            stemLength: 0.12, stemRadius: 0.140
        },
        // 温州みかん: 扁平で皮が薄い。頭部の窪みは浅く、しわもごく弱い
        unshu: {
            label: "温州みかん",
            radius: 3.45, height: 6.10,
            lobeAmp: 0.010, asymmetry: 0.024,
            neckAmount: 0.00, neckWidth: 0.30, neckWrinkle: 0.00, topTaper: 0.03,
            decoAmount: 0.00, decoLobeCount: 0, decoTaper: 0.00,
            shoulder: 0.00, superN: 0, superNTop: 0, topDimple: 0.000,
            wellDepth: 0.012, creaseCount: 5, creaseAmount: 0.010,
            ground: [0.97, 0.52, 0.11],       // 地色（sRGB相当）
            deep: [0.93, 0.37, 0.06],       // 日向側
            green: [0.66, 0.64, 0.20],       // へた周りの色抜け
            pitInk: [0.82, 0.40, 0.09],       // 油胞の底
            pitRim: [1.00, 0.63, 0.20],       // 油胞の縁
            sunAmount: 0.50, sunFloor: 0.66, sunSpread: 1.0,
            greenAmount: 0.16,
            glandCols: 190, glandSize: 0.40, glandDepth: 0.75, glandInk: 0.50,
            glandVar: 1.05, glandJitter: 0.46, skinNoise: 1.00, glandBowl: 0.0, pitAO: 1.00, glandGloss: 0.0,
            lumpAmount: 0.30, blemishAmount: 0.14,
            skinRoughness: 0.50, waxIntensity: 0.80,
            coatRoughness: 0.78, bumpLevel: 0.72,
            calyxRadius: 0.135, calyxLobes: 6, calyxLift: 0.016,
            calyxStar: 0.26, calyxFresh: 0.00, calyxYellow: 0.00,
            stemLength: 0.20, stemRadius: 0.095
        },
        // 早生の青みかん: ほぼ球形。頭部は浅く、しわは目立たない
        aoshu: {
            label: "青みかん",
            radius: 3.20, height: 6.05,
            lobeAmp: 0.012, asymmetry: 0.026,
            neckAmount: 0.00, neckWidth: 0.30, neckWrinkle: 0.00, topTaper: 0.02,
            decoAmount: 0.00, decoLobeCount: 0, decoTaper: 0.00,
            shoulder: 0.00, superN: 0, superNTop: 0, topDimple: 0.000,
            wellDepth: 0.016, creaseCount: 5, creaseAmount: 0.012,
            ground: [0.43, 0.59, 0.13],
            deep: [0.54, 0.65, 0.15],
            green: [0.33, 0.50, 0.10],
            pitInk: [0.36, 0.50, 0.11],
            pitRim: [0.56, 0.70, 0.22],
            sunAmount: 0.42, sunFloor: 0.55, sunSpread: 1.2,
            greenAmount: 0.45,
            glandCols: 155, glandSize: 0.44, glandDepth: 0.95, glandInk: 0.45,
            glandVar: 1.05, glandJitter: 0.46, skinNoise: 1.00, glandBowl: 0.0, pitAO: 1.00, glandGloss: 0.0,
            lumpAmount: 0.40, blemishAmount: 0.10,
            skinRoughness: 0.58, waxIntensity: 0.50,
            coatRoughness: 0.78, bumpLevel: 0.72,
            calyxRadius: 0.150, calyxLobes: 5, calyxLift: 0.020,
            calyxStar: 0.26, calyxFresh: 0.00, calyxYellow: 0.00,
            stemLength: 0.30, stemRadius: 0.105
        },
        // ポンカン: 頭部が窪み、へたへ収束する深いしわ＋中央の小さな突起
        ponkan: {
            label: "ポンカン",
            radius: 3.45, height: 6.45,
            lobeAmp: 0.014, asymmetry: 0.028,
            neckAmount: 0.11, neckWidth: 0.13, neckWrinkle: 0.05, topTaper: 0.08,
            decoAmount: 0.00, decoLobeCount: 0, decoTaper: 0.00,
            shoulder: 0.00, superN: 0, superNTop: 0, topDimple: 0.000,
            wellDepth: 0.050, creaseCount: 5, creaseAmount: 0.034,
            ground: [0.97, 0.45, 0.07],
            deep: [0.90, 0.30, 0.04],
            green: [0.70, 0.60, 0.18],
            pitInk: [0.80, 0.33, 0.05],
            pitRim: [1.00, 0.58, 0.16],
            sunAmount: 0.56, sunFloor: 0.66, sunSpread: 1.1,
            greenAmount: 0.10,
            glandCols: 162, glandSize: 0.44, glandDepth: 1.05, glandInk: 0.55,
            glandVar: 1.05, glandJitter: 0.46, skinNoise: 1.00, glandBowl: 0.0, pitAO: 1.00, glandGloss: 0.0,
            lumpAmount: 0.55, blemishAmount: 0.24,
            skinRoughness: 0.56, waxIntensity: 0.60,
            coatRoughness: 0.78, bumpLevel: 0.72,
            calyxRadius: 0.140, calyxLobes: 5, calyxLift: 0.018,
            calyxStar: 0.26, calyxFresh: 0.00, calyxYellow: 0.00,
            stemLength: 0.24, stemRadius: 0.100
        },
        // デコポン: 盛り上がった台＋裂片の環＋中央の浅い窪み。胴はドーム
        dekopon: {
            label: "デコポン",
            radius: 4.10, height: 7.60,
            lobeAmp: 0.018, asymmetry: 0.034,
            neckAmount: 0.00, neckWidth: 0.34, neckWrinkle: 0.045, topTaper: 0.08,
            decoAmount: 1.00, decoLobeCount: 7, decoTaper: 0.22,
            shoulder: 0.00, superN: 0, superNTop: 0, topDimple: 0.000,
            wellDepth: 0.000, creaseCount: 7, creaseAmount: 0.030,
            ground: [0.99, 0.50, 0.08],
            deep: [0.93, 0.34, 0.04],
            green: [0.72, 0.60, 0.18],
            pitInk: [0.82, 0.37, 0.06],
            pitRim: [1.00, 0.62, 0.18],
            sunAmount: 0.52, sunFloor: 0.64, sunSpread: 1.2,
            greenAmount: 0.09,
            glandCols: 152, glandSize: 0.46, glandDepth: 1.25, glandInk: 0.58,
            glandVar: 1.05, glandJitter: 0.46, skinNoise: 1.00, glandBowl: 0.0, pitAO: 1.00, glandGloss: 0.0,
            lumpAmount: 0.80, blemishAmount: 0.28,
            skinRoughness: 0.60, waxIntensity: 0.50,
            coatRoughness: 0.78, bumpLevel: 0.72,
            calyxRadius: 0.085, calyxLobes: 5, calyxLift: 0.016,
            calyxStar: 0.26, calyxFresh: 0.00, calyxYellow: 0.00,
            stemLength: 0.36, stemRadius: 0.085
        }
    };

    const GLOBAL = {
        // --- 分割
        segmentsMeridian: 150,
        segmentsRound: 144,             // 裂片の切れ込みを刻むので多めに
        lobeCount: 10,                  // じょうのう（房）は10前後
        // --- 果梗
        stemTiltDeg: 8,
        stemSegments: 12,
        stemSides: 14,
        // --- がく
        calyxRings: 14,
        calyxSides: 96,
        // --- テクスチャ
        textureSize: 1024,
        skinDetail: 1.0,
        // --- 描画
        useSSAO: true,
        showGround: true
    };

    const START_VARIETY = "mikkabi";
    const START_SEED = 20260726;

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        // 【対策】プリセットのキーが1つ欠けると値は undefined になり、
        //         計算結果が NaN になって伝播する。ところが
        //           ・Uint8ClampedArray は NaN を 0 に丸める
        //             → 焼いたテクスチャを見ても NaN だったと分からない
        //           ・NaN uniform はエラーも警告も出さず、黒として描かれる
        //           ・キー欠落自体は構文エラーにならない
        //         ため、症状（真っ黒）から原因に辿り着きにくい。
        //         unshu をスキーマとみなして、ここで検出して潰す。
        const SCHEMA = PRESETS.unshu;
        for (const k in SCHEMA) {
            if (!(k in cfg)) {
                console.error("[Config] preset '" + varietyKey + "' にキー '" + k
                    + "' がありません。unshu の値で補完します:", SCHEMA[k]);
                cfg[k] = SCHEMA[k];
            } else if (typeof SCHEMA[k] === "number" && !isFinite(cfg[k])) {
                console.error("[Config] preset '" + varietyKey + "' のキー '" + k
                    + "' が数値ではありません:", cfg[k], "-> unshu の値で補完します:", SCHEMA[k]);
                cfg[k] = SCHEMA[k];
            }
        }
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        return cfg;
    }

    const V3 = BABYLON.Vector3;

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
        gauss(mean, sd) {
            const u = Math.max(1e-9, this.next()), v = this.next();
            return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        }
        int(n) { return Math.floor(this.next() * n) % n; }
    }

    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const gauss1 = (x, c, s) => Math.exp(-((x - c) * (x - c)) / (2 * s * s));

    // =================================================================
    // 2. Geo : リング列から掃引メッシュを作る
    // =================================================================
    const Geo = {
        build(name, rings, centers, capStart, capEnd, scene) {
            const N = rings.length, M = rings[0].length;
            const positions = new Float32Array(N * M * 3 + 6);
            const uvs = new Float32Array(N * M * 2 + 4);
            let p = 0, q = 0;
            for (let i = 0; i < N; i++) {
                const ring = rings[i], v = i / (N - 1);
                for (let j = 0; j < M; j++) {
                    positions[p++] = ring[j].x; positions[p++] = ring[j].y; positions[p++] = ring[j].z;
                    uvs[q++] = j / (M - 1); uvs[q++] = v;
                }
            }
            const capA = N * M, capB = N * M + 1;
            positions[p++] = centers[0].x; positions[p++] = centers[0].y; positions[p++] = centers[0].z;
            positions[p++] = centers[N - 1].x; positions[p++] = centers[N - 1].y; positions[p++] = centers[N - 1].z;
            uvs[q++] = 0.5; uvs[q++] = 0.0;
            uvs[q++] = 0.5; uvs[q++] = 1.0;

            const sideIndices = (flip) => {
                const idx = [];
                for (let i = 0; i < N - 1; i++) {
                    for (let j = 0; j < M - 1; j++) {
                        const a = i * M + j, b = a + 1, c = a + M, d = c + 1;
                        if (flip) idx.push(a, b, c, b, d, c);
                        else idx.push(a, c, b, b, c, d);
                    }
                }
                return idx;
            };

            // --- 側面の向きは「全頂点平均」で判定 -----------------------
            // 【対策1】旧版は代表頂点1つの法線で判定していた。頂点の選び方が
            //          形状に依存するため、でこのように上部が大きく変わると
            //          誤判定してメッシュ全体が裏返る（＝真っ黒になる）。
            // 【対策2】符号付き体積 V=(1/6)Σa·(b×c) は右手系の公式で、
            //          Babylon は既定で左手系なので符号が反転する。座標系の
            //          左右手系に依存しない判定にする必要がある。
            //          Babylon 自身が計算した法線が重心から外を向いているかを
            //          全頂点で積算すれば、規約は Babylon 側に合わせられる。
            let indices = sideIndices(false);
            let normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);

            const nv = N * M;
            let gx = 0, gy = 0, gz = 0;
            for (let i = 0; i < nv; i++) { gx += positions[i * 3]; gy += positions[i * 3 + 1]; gz += positions[i * 3 + 2]; }
            gx /= nv; gy /= nv; gz /= nv;
            let score = 0;
            for (let i = 0; i < nv; i++) {
                score += (positions[i * 3] - gx) * normals[i * 3]
                    + (positions[i * 3 + 1] - gy) * normals[i * 3 + 1]
                    + (positions[i * 3 + 2] - gz) * normals[i * 3 + 2];
            }
            const flipped = score < 0;
            if (flipped) indices = sideIndices(true);

            // --- キャップは側面から一意に決まる（判定不要）-------------
            // 【対策】隣り合う三角形は共有辺を「逆向きに」辿るときだけ向きが
            //         揃う。側面の巻き順が決まればキャップの巻き順も決まるので、
            //         旧版の facesToward() のような個別判定は不要。
            //         中央に窪みを入れると centers[0].y < centers[1].y になり、
            //         「上キャップは上を向くはず」という前提が崩れて誤判定した
            if (capStart) {
                for (let j = 0; j < M - 1; j++) {
                    if (flipped) indices.push(capA, j + 1, j); else indices.push(capA, j, j + 1);
                }
            }
            if (capEnd) {
                const o = (N - 1) * M;
                for (let j = 0; j < M - 1; j++) {
                    if (flipped) indices.push(capB, o + j, o + j + 1); else indices.push(capB, o + j + 1, o + j);
                }
            }

            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            // 【対策】退化三角形があると法線の長さが 0 になり、正規化で NaN が
            //         生まれる。NaN はシェーダ内を伝播してその範囲が黒く抜ける
            let bad = 0;
            for (let i = 0; i < N * M * 3 + 6; i += 3) {
                const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
                if (!(l > 1e-6)) {
                    normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0; bad++;
                }
            }
            if (flipped || bad) {
                console.log("[Geo]", name, "winding flipped =", flipped, "/ degenerate normals =", bad);
            }

            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = positions; vd.indices = indices;
            vd.normals = normals; vd.uvs = uvs;
            vd.applyToMesh(mesh, false);
            return mesh;
        },

        // yOffsetOf(phi) : リング上で高さを phi ごとに変える。
        // 放射状のしわと裂片をジオメトリで作るために必要
        ring(center, outer, side, M, radiusOf, yOffsetOf) {
            const pts = [];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * Math.PI * 2;
                const rr = radiusOf(phi);
                const dy = yOffsetOf ? yOffsetOf(phi) : 0;
                const a = j / M * Math.PI * 2;
                const ca = Math.cos(a), sa = Math.sin(a);
                pts.push(new V3(
                    center.x + (outer.x * ca + side.x * sa) * rr,
                    center.y + (outer.y * ca + side.y * sa) * rr + dy,
                    center.z + (outer.z * ca + side.z * sa) * rr
                ));
            }
            return pts;
        }
    };

    // =================================================================
    // 3. Profile : 子午線と断面
    // =================================================================
    const MERIDIAN = [
        [0.000, 0.860], [0.070, 0.864], [0.145, 0.876], [0.225, 0.894],
        [0.310, 0.912], [0.400, 0.926], [0.500, 0.930], [0.610, 0.918],
        [0.715, 0.892], [0.808, 0.852], [0.886, 0.798], [0.945, 0.730],
        [0.983, 0.650], [1.000, 0.558], [0.997, 0.462], [0.976, 0.366],
        [0.938, 0.276], [0.882, 0.196], [0.806, 0.128], [0.706, 0.076],
        [0.584, 0.042], [0.450, 0.024], [0.316, 0.018], [0.190, 0.022],
        [0.082, 0.032], [0.000, 0.038]
    ];

    // でこ（デコポン）の形状定数。decoAmount でまとめてスケールする
    //   mound  : 中央から立ち上がる台の高さ
    //   rise   : 台の上に乗る裂片の環の高さ
    //   dimple : 台の中心の浅い窪み（へたが座る）
    //   wide   : 環の張り出し（正規化半径）
    //   pinch  : 環の下のくびれ
    //   fMean  : 裂片分布 f(phi) の平均値。軸対称成分の計算に使う
    const DECO = { mound: 0.140, rise: 0.100, dimple: 0.022, wide: 0.16, pinch: 0.05, fMean: 0.56 };

    function decoAt(v) {
        return {
            mound: gauss1(v, 0.00, 0.16),       // 中央から立ち上がる台
            crownY: gauss1(v, 0.135, 0.070),      // 裂片の環（高さ）
            crownR: gauss1(v, 0.195, 0.085),      // 裂片の環（半径）
            dimple: smooth(0.058, 0.0, v),        // 中央の浅い窪み
            neck: gauss1(v, 0.360, 0.075),      // 環の下のくびれ
            dome: smooth(0.52, 0.05, v)         // 上部を細めてドーム化
        };
    }

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }

    function meridianAt(v, cfg) {
        const P = MERIDIAN, n = P.length;
        const f = clamp(v, 0, 1) * (n - 1);
        const i = Math.min(n - 2, Math.floor(f));
        const t = f - i;
        const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(n - 1, i + 2)];
        let r = catmull(a[0], b[0], c[0], d[0], t);
        let y = catmull(a[1], b[1], c[1], d[1], t);

        // 超楕円の子午線（三ヶ日みかん）
        // 【対策】MERIDIAN は「天面に深い梗あ＋その外周の肩の盛り上がり」と
        //         「最大径が中央より上（y≒0.56）で下すぼまり」という形で、
        //         扁平にしてもリンゴにしか見えなかった。実物の温州みかんは
        //         天面も底面も広く平らで、中央がわずかに窪むだけ。最大径は
        //         ほぼ中央。superN > 0 のときは MERIDIAN を使わず
        //         超楕円 |x|^n + |y|^n = 1 で断面を作る（n=2 で楕円、大きいほど平ら）
        if (cfg && cfg.superN > 0) {
            const th = clamp(v, 0, 1) * Math.PI;           // 0 = へた側, π = 花落ち側
            const ct = Math.cos(th), st = Math.sin(th);
            const n = ct > 0 ? cfg.superNTop : cfg.superN;
            r = Math.pow(st, 2 / n);
            y = 0.5 + 0.5 * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n);
            // へたの座る浅い窪みと、花落ち（へそ）の小さな窪み
            y -= cfg.topDimple * Math.exp(-(r * r) / (2 * 0.11 * 0.11)) * smooth(0.45, 0.6, y);
            y += 0.010 * Math.exp(-(r * r) / (2 * 0.07 * 0.07)) * smooth(0.55, 0.4, y);
        }

        // 肩と裾の張り（正で角張る / 負で丸まる）
        // 【対策】MERIDIAN は肩と裾が張った断面なので、高さを詰めて扁平にすると
        //         側面が垂直に立った「大福」形になる（扁平率 0.71 で確認）。
        //         扁平率を 0.82 に戻したうえで、肩（y≒0.80）と裾（y≒0.15）だけ
        //         半径を絞って丸める。赤道は動かさないので径は変わらない。
        //         -0.08 まで絞ると σ が狭いぶん肩に段がつくので -0.04 程度まで
        if (cfg && cfg.shoulder) {
            r *= 1 + cfg.shoulder * (gauss1(y, 0.80, 0.075) + 0.6 * gauss1(y, 0.15, 0.065));
        }

        // 上細り（ドーム形）。最大径も自然に下がる
        if (cfg && cfg.topTaper) r *= 1 - cfg.topTaper * smooth(0.30, 0.96, y);

        // 梗あ（へた周りの窪み）
        if (cfg && cfg.wellDepth) y -= cfg.wellDepth * smooth(0.40, 0.03, v);

        // でこ（軸対称成分）
        // 【対策】裂片の変調は f(phi) の平均値 fMean を掛けた形でここに入れる。
        //         こうすると seatAt() が参照する子午線が「平均断面」になり、
        //         がくの座面計算が裂片ごとにブレない
        if (cfg && cfg.decoAmount > 0) {
            const k = decoAt(v), A = cfg.decoAmount;
            r *= 1 - cfg.decoTaper * k.dome;
            r += A * (DECO.wide * k.crownR * DECO.fMean - DECO.pinch * k.neck);
            y += A * (DECO.mound * k.mound
                + DECO.rise * k.crownY * DECO.fMean
                - DECO.dimple * k.dimple);
        }

        // 首（ポンカンの小さな突起）。でこを使う品種では 0
        const nk = cfg && cfg.neckAmount ? cfg.neckAmount : 0;
        if (nk > 0) {
            const nw = (cfg && cfg.neckWidth) ? cfg.neckWidth : 0.32;
            const k = smooth(nw, 0.0, v);
            y += nk * 0.24 * k;
            const waist = Math.pow(Math.max(0, 4 * k * (1 - k)), 0.7);
            r *= 1 - nk * 0.32 * waist;
        }
        return { r, y };
    }

    function lobeAt(phi, yn, cfg) {
        const amp = cfg.lobeAmp * (0.25
            + 0.75 * smooth(0.58, 0.92, yn)      // へた側
            + 0.55 * smooth(0.30, 0.05, yn));    // 花落ち側
        return 1 + amp * Math.cos(cfg.lobeCount * phi);
    }

    // =================================================================
    // 4. TextureLab
    // =================================================================
    const TextureLab = {
        _hash(x, y, seed) {
            let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
        },
        _value(x, y, period, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const p = period | 0;
            let x0 = xi % p; if (x0 < 0) x0 += p;
            let x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
            const a = this._hash(x0, yi, seed), b = this._hash(x1, yi, seed);
            const c = this._hash(x0, yi + 1, seed), d = this._hash(x1, yi + 1, seed);
            return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
        },
        fbm(x, y, basePeriod, seed, octaves) {
            let sum = 0, amp = 0.5, f = 1;
            for (let o = 0; o < octaves; o++) {
                sum += amp * this._value(x * f, y * f, basePeriod * f, seed + o * 131);
                f *= 2; amp *= 0.5;
            }
            return sum;
        },
        _canvasTexture(name, size, fill, scene) {
            const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(size, size);
            fill(img.data, size);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            return dt;
        },

        // ---- 油胞（オイルセル）-------------------------------------------
        // 【対策1】完全ランダム配置は塊と空白を作る。格子＋ジッタで置く
        // 【対策2】u は円周（2πR）、v は子午線（πR）を張るので
        //          rx = ry / (2·sin(πv)) にしないと横に潰れた楕円になる
        // 【対策3】極では u が縮むので、行あたりの個数を sin(πv) で減らす
        // 【対策4】行の位相が揃っていると横縞として読める。行ごとに位相をずらす
        // 【対策5】粒径が一様だと網点になる。二乗分布で小さめに偏らせる
        oilGlands(size, seed, cfg) {
            const pit = new Float32Array(size * size);
            const rim = new Float32Array(size * size);
            const r = new Rng(seed);
            const cols = cfg.glandCols;
            const rows = Math.max(8, Math.round(cols * 0.5));
            const cellV = size / rows;
            let count = 0;
            for (let iy = 0; iy < rows; iy++) {
                const vRow = (iy + 0.5) / rows;
                const s = Math.sin(Math.PI * vRow);
                const n = Math.max(3, Math.round(cols * s));
                const stretch = 1 / (2 * Math.max(0.20, s));
                const rowPhase = r.next();
                const poleFine = 0.74 + 0.26 * s;
                for (let ix = 0; ix < n; ix++) {
                    if (r.next() < 0.05) continue;
                    // 【対策】三ヶ日みかんの油胞は粒がそろって密に並ぶ（写真では蜂の巣状）。
                    //         ジッタと粒径のばらつきが大きいと、塊と隙間ができて
                    //         スポンジ状の肌に見える。glandJitter / glandVar で絞る
                    const jt = cfg.glandJitter;
                    const u = (ix + 0.5 + rowPhase + r.range(-jt, jt)) / n;
                    const v = clamp(vRow + r.range(-jt, jt) / rows, 0.003, 0.997);
                    const roll = r.next();
                    const sizeVar = 1.6 - cfg.glandVar + cfg.glandVar * roll * roll;
                    const wave = 0.90 + 0.20 * this.fbm(u * 5, v * 4, 5, seed + 3, 2);
                    const base = cellV * cfg.glandSize * sizeVar * wave * poleFine;
                    const ry = Math.max(0.85, base);
                    const rx = Math.max(0.85, base * stretch * r.range(0.90, 1.12));
                    const cx = u * size, cy = v * size;
                    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
                    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(size - 1, Math.ceil(cy + ry));
                    count++;
                    for (let y = y0; y <= y1; y++) {
                        const dy = (y - cy) / ry;
                        for (let x = x0; x <= x1; x++) {
                            const dx = (x - cx) / rx;
                            const d = Math.hypot(dx, dy);
                            if (d >= 1) continue;
                            const xw = ((x % size) + size) % size;
                            const i = y * size + xw;
                            // glandBowl = 0 : 円錐（旧版）/ 1 : 丸い椀。三ヶ日の油胞は縁がなだらかな椀形
                            const core = mix(Math.pow(1 - d, 1.05), Math.pow(1 - d * d, 1.6), cfg.glandBowl);
                            const ring = Math.pow(Math.max(0, 1 - Math.abs(d - 0.88) / 0.26), 2.0);
                            if (core > pit[i]) pit[i] = core;
                            if (ring > rim[i]) rim[i] = ring;
                        }
                    }
                }
            }
            return { pit, rim, count };
        },

        sunAt(u, v, cfg, seed) {
            let du = Math.abs(u - 0.5);
            du = Math.min(du, 1 - du) * 2;                       // 0(正面)..1(裏)
            const angular = cfg.sunFloor + (1 - cfg.sunFloor) * Math.pow(1 - du, cfg.sunSpread);
            const cloud = this.fbm(u * 5, v * 4, 5, seed, 3);
            const grain = this.fbm(u * 17, v * 12, 17, seed + 5, 2);
            return clamp(cfg.sunAmount * angular
                * (0.60 + 0.75 * cloud) * (0.88 + 0.24 * grain), 0, 1);
        },

        albedo(scene, size, cfg, gl, seed) {
            const G = cfg.ground, D = cfg.deep, GR = cfg.green;
            const PIT = cfg.pitInk, RIM = cfg.pitRim;
            const SEAT = [0.80, 0.75, 0.44];
            const NAVEL = [0.92, 0.70, 0.34];
            const SCAR = [0.52, 0.32, 0.15];
            return this._canvasTexture("mikanAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const seatK = smooth(0.040, 0.0, v);
                    const navelK = smooth(0.962, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let cr = G[0], cg = G[1], cb = G[2];

                        const mott = 0.955 + 0.09 * this.fbm(u * 8, v * 6, 8, seed + 3, 2);
                        cr *= mott; cg *= mott; cb *= mott;

                        const sn = this.sunAt(u, v, cfg, seed + 11);
                        cr = mix(cr, D[0], sn); cg = mix(cg, D[1], sn); cb = mix(cb, D[2], sn);

                        const gw = clamp(smooth(0.20, 0.01, v) * cfg.greenAmount
                            * (0.45 + 0.75 * this.fbm(u * 11, v * 9, 11, seed + 19, 2)), 0, 1);
                        cr = mix(cr, GR[0], gw); cg = mix(cg, GR[1], gw); cb = mix(cb, GR[2], gw);

                        // 油胞：実物の明度差は1割程度
                        const pw = smooth(0.04, 0.72, gl.pit[y * N + x]);
                        const rw = smooth(0.20, 0.95, gl.rim[y * N + x]) * (1 - pw * 0.8);
                        const ink = cfg.glandInk;
                        cr = mix(cr, RIM[0], rw * ink * 0.45); cg = mix(cg, RIM[1], rw * ink * 0.45); cb = mix(cb, RIM[2], rw * ink * 0.45);
                        cr = mix(cr, PIT[0], pw * ink); cg = mix(cg, PIT[1], pw * ink); cb = mix(cb, PIT[2], pw * ink);

                        const sc = smooth(0.80, 0.94, this.fbm(u * 30, v * 26, 30, seed + 41, 3))
                            * cfg.blemishAmount;
                        cr = mix(cr, SCAR[0], sc); cg = mix(cg, SCAR[1], sc); cb = mix(cb, SCAR[2], sc);

                        if (seatK > 0) {
                            cr = mix(cr, SEAT[0], seatK * 0.75);
                            cg = mix(cg, SEAT[1], seatK * 0.75);
                            cb = mix(cb, SEAT[2], seatK * 0.75);
                        }
                        if (navelK > 0) {
                            const star = smooth(-0.2, 0.7, Math.cos(cfg.lobeCount * u * Math.PI * 2));
                            const w = navelK * (0.45 + 0.55 * star);
                            cr = mix(cr, NAVEL[0], w); cg = mix(cg, NAVEL[1], w); cb = mix(cb, NAVEL[2], w);
                        }

                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        wax(scene, size, cfg, gl, seed) {
            return this._canvasTexture("mikanWax", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const dull = Math.max(smooth(0.12, 0.01, v), smooth(0.95, 1.0, v));
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const smudge = this.fbm(u * 6, v * 5, 6, seed, 3);
                        const fine = this.fbm(u * 20, v * 16, 20, seed + 9, 2);
                        const pw = smooth(0.10, 0.75, gl.pit[y * N + x]);
                        const rw = smooth(0.25, 0.95, gl.rim[y * N + x]);
                        // glandGloss = 0 : 油胞は艶の抜けた凹み（旧版）
                        //            1 : 油胞は艶のある半透明の粒、まわりの表皮が少し粗い
                        const gg = cfg.glandGloss;
                        let inten = (0.60 + 0.30 * smudge) * (1 - 0.70 * dull)
                            * (1 + mix(-0.40, 0.30, gg) * pw) * (1 + 0.26 * rw);
                        let rough = 0.48 + 0.18 * (1 - smudge) + 0.12 * fine
                            + 0.30 * dull + mix(0.16, -0.20, gg) * pw - 0.10 * rw
                            + 0.08 * gg * (1 - pw);
                        d[i] = clamp(inten, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.10, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        orm(scene, size, cfg, gl, seed) {
            return this._canvasTexture("mikanORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const seatK = smooth(0.05, 0.0, v);
                    const navelK = smooth(0.95, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let rough = cfg.skinRoughness * (0.92 + 0.20 * this.fbm(u * 12, v * 9, 12, seed + 5, 2));
                        let ao = 1.0;
                        const pw = smooth(0.04, 0.72, gl.pit[y * N + x]);
                        const rw = smooth(0.25, 0.95, gl.rim[y * N + x]) * (1 - pw);
                        // 粒はアルベドではなく「粗さの差」で見せる
                        rough = mix(rough, clamp(rough + mix(0.24, -0.12, cfg.glandGloss), 0.05, 1), pw);
                        rough = mix(rough, clamp(rough - 0.12, 0.05, 1), rw);
                        ao = mix(ao, 0.88, pw * cfg.pitAO);
                        const sc = smooth(0.80, 0.94, this.fbm(u * 30, v * 26, 30, seed + 41, 3))
                            * cfg.blemishAmount;
                        rough = mix(rough, 0.88, sc);
                        rough = mix(rough, 0.90, seatK);
                        rough = mix(rough, 0.86, navelK);
                        ao = mix(ao, 0.50, seatK);
                        ao = mix(ao, 0.60, navelK);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, cfg, gl, seed, detail) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                // 大きな放射状のしわ・裂片はジオメトリ側。ここは間を埋める細かい皺だけ
                const radialK = smooth(0.24, 0.02, v);
                for (let x = 0; x < size; x++) {
                    const u = x / size;
                    const lump = this.fbm(u * 9, v * 7, 9, seed + 3, 3) * 0.50 * cfg.lumpAmount;
                    const skin = this.fbm(u * 66, v * 52, 66, seed, 2) * 0.30 * cfg.skinNoise;
                    const micro = this.fbm(u * 150, v * 118, 150, seed + 61, 2) * 0.16;
                    const radial = radialK * 0.28
                        * Math.cos(u * Math.PI * 2 * 34 + 3.0 * this.fbm(u * 6, v * 4, 6, seed + 71, 2));
                    const i = y * size + x;
                    h[i] = lump + skin + micro + radial
                        - gl.pit[i] * 0.85 * cfg.glandDepth     // 凹
                        + gl.rim[i] * 0.26 * cfg.glandDepth;    // 縁の張り
                }
            }
            return this._canvasTexture("mikanNormal", size, (d, N) => {
                // 【対策】高さ場は画素単位の差分で傾きにするので、解像度を倍にすると
                //         同じ凹みでも傾きが半分になる。1024 基準で補正する
                const strength = 1.05 * (detail === undefined ? 1 : detail) * (N / 1024);
                for (let y = 0; y < N; y++) {
                    const vv = y / N;
                    const poleFade = smooth(0, 0.06, vv) * (1 - smooth(0.94, 1.0, vv));
                    const k = strength * poleFade;
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
                        // u は世界座標で v の2倍の距離を張る
                        let nx = (xl - xr) * k * 0.5, ny = (yu - yd) * k, nz = 1;
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

        fiberNormal(scene, size, seed) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    h[y * size + x] = this.fbm(u * 34, v * 7, 34, seed, 3) * 0.8
                        + this.fbm(u * 80, v * 54, 80, seed + 17, 2) * 0.25;
                }
            }
            return this._canvasTexture("fiberNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * 2.2, ny = (yu - yd) * 2.2, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * N + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        }
    };

    // =================================================================
    //  SkinFactory : 品種ごとのマテリアル（キャッシュ対象）
    // =================================================================
    class SkinFactory {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const t0 = performance.now();
            const gl = TextureLab.oilGlands(S, 3301, cfg);
            this.glandCount = gl.count;

            this.albedoTex = TextureLab.albedo(scene, S, cfg, gl, 77);
            this.ormTex = TextureLab.orm(scene, S, cfg, gl, 77);
            this.normalTex = TextureLab.normal(scene, S, cfg, gl, 909, cfg.skinDetail);
            this.waxTex = TextureLab.wax(scene, S, cfg, gl, 512);
            this.fiberTex = TextureLab.fiberNormal(scene, 256, 4242);
            this.bakeMs = performance.now() - t0;

            const pbr = new BABYLON.PBRMaterial("mikanSkin", scene);
            pbr.albedoTexture = this.albedoTex;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;                    // 実値はORMのGチャンネル
            pbr.metallicTexture = this.ormTex;
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            // 三ヶ日みかんは油胞の凹みがハイライトの中ではっきり見えるので強め
            pbr.bumpTexture.level = cfg.bumpLevel;
            pbr.clearCoat.isEnabled = true;
            // NaN が入ると警告なしで最終色が NaN になり真っ黒になる。念のため確認
            pbr.clearCoat.intensity = 0.42 * cfg.waxIntensity;
            if (!isFinite(pbr.clearCoat.intensity)) {
                console.error("[Mat] clearCoat.intensity が非有限です。waxIntensity =", cfg.waxIntensity);
                pbr.clearCoat.intensity = 0.3;
            }
            // 【対策】useRoughnessFromMainTexture のとき、実効粗さは
            //         テクスチャ G × clearCoat.roughness。テクスチャ側は油胞の
            //         凹凸パターンを持つので、艶の強さはこちらの係数で品種ごとに変える
            pbr.clearCoat.roughness = cfg.coatRoughness;
            pbr.clearCoat.texture = this.waxTex;      // R=強度 / G=粗さ
            pbr.clearCoat.useRoughnessFromMainTexture = true;
            pbr.clearCoat.indexOfRefraction = 1.34;
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(0.92, 0.42, 0.12);
            pbr.subSurface.translucencyIntensity = 0.09;
            pbr.subSurface.minimumThickness = 1.0;
            pbr.subSurface.maximumThickness = 4.5;
            this.skin = pbr;

            const stem = new BABYLON.PBRMaterial("mikanStem", scene);
            stem.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            stem.metallic = 0.0;
            stem.roughness = 0.86;
            stem.bumpTexture = this.fiberTex;
            stem.bumpTexture.level = 0.5;
            this.stem = stem;

            const calyx = new BABYLON.PBRMaterial("mikanCalyx", scene);
            calyx.albedoColor = new BABYLON.Color3(1, 1, 1);
            calyx.metallic = 0.0;
            calyx.roughness = 0.72 - 0.20 * cfg.calyxFresh;   // 新鮮ながくは艶がある
            calyx.bumpTexture = this.fiberTex;
            calyx.bumpTexture.level = 0.45;
            calyx.backFaceCulling = false;
            calyx.twoSidedLighting = true;
            this.calyx = calyx;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.stem.dispose(true, false);
            this.calyx.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose();
            this.normalTex.dispose(); this.waxTex.dispose();
            this.fiberTex.dispose();
        }
    }

    // 旧色 a と鮮やかな緑 b を calyxFresh で補間して linear 化する
    // さらに y（calyxYellow）で黄みがかった熟したヘタの色 c へ寄せる
    function freshColor(a, b, fr, c, y) {
        let r = mix(a[0], b[0], fr), g = mix(a[1], b[1], fr), bl = mix(a[2], b[2], fr);
        if (c && y) { r = mix(r, c[0], y); g = mix(g, c[1], y); bl = mix(bl, c[2], y); }
        return new BABYLON.Color3(r, g, bl).toLinearSpace();
    }

    // =================================================================
    // 5. Mikan
    // =================================================================
    class Mikan {
        constructor(scene, cfg, seed, skin) {
            this.scene = scene; this.cfg = cfg;
            const rng = new Rng(seed);
            this.rng = rng;
            this.R = cfg.radius * rng.range(0.94, 1.06);
            this.H = cfg.height * rng.range(0.93, 1.07);
            this.asymPhase = rng.range(0, Math.PI * 2);
            this.asym = cfg.asymmetry * rng.range(0.6, 1.4);
            this.d2 = cfg.asymmetry * rng.range(0.35, 0.70);
            this.d3 = cfg.asymmetry * rng.range(0.20, 0.45);
            this.p2 = rng.range(0, Math.PI * 2);
            this.p3 = rng.range(0, Math.PI * 2);
            this.neckPhase = rng.range(0, Math.PI * 2);
            this.tilt = rng.gauss(0, 0.026);
            this.tiltDir = rng.range(0, Math.PI * 2);

            // でこの裂片
            // 【対策】σ を広く取ると隣と融合して、切れ込みの無い「波打った縁」に
            //         なる。裂片間隔 2π/7 ≒ 0.90 rad に対して σ は 0.14〜0.21
            this.decoLobes = [];
            if (cfg.decoAmount > 0) {
                const nD = Math.max(4, cfg.decoLobeCount | 0);
                const base = rng.range(0, Math.PI * 2);
                for (let i = 0; i < nD; i++) {
                    this.decoLobes.push({
                        a: base + (i / nD) * Math.PI * 2 + rng.range(-0.20, 0.20),
                        w: rng.range(0.14, 0.21),
                        d: rng.range(0.85, 1.20)
                    });
                }
            }

            // 放射状のしわ
            this.creases = [];
            if (cfg.creaseAmount > 0) {
                if (this.decoLobes.length) {
                    // 【対策】でこがある品種では、しわを裂片の「谷」に合わせる。
                    //         無関係な角度に置くと切れ込みと互い違いになって乱れる
                    const nD = this.decoLobes.length;
                    for (let i = 0; i < nD; i++) {
                        const a0 = this.decoLobes[i].a, a1 = this.decoLobes[(i + 1) % nD].a;
                        let dd = a1 - a0;
                        dd = Math.atan2(Math.sin(dd), Math.cos(dd));
                        this.creases.push({
                            a: a0 + dd * 0.5,
                            w: rng.range(0.13, 0.24),
                            d: rng.range(0.60, 1.20)
                        });
                    }
                } else {
                    const nC = Math.max(3, cfg.creaseCount | 0);
                    const base = rng.range(0, Math.PI * 2);
                    for (let i = 0; i < nC; i++) {
                        this.creases.push({
                            a: base + (i / nC) * Math.PI * 2 + rng.range(-0.42, 0.42),
                            w: rng.range(0.15, 0.32),
                            d: rng.range(0.50, 1.35)
                        });
                    }
                }
            }

            this.parts = [];
            this._buildBody(skin);
            this._buildCalyx(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("mikan", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        centerAt(yn) {
            const k = this.tilt * this.H * (yn - 0.5);
            return new V3(Math.cos(this.tiltDir) * k, yn * this.H, Math.sin(this.tiltDir) * k);
        }

        // でこの裂片分布 0..1（谷で 0 付近、山で 1）
        decoLobeAt(phi) {
            let sum = 0;
            for (let i = 0; i < this.decoLobes.length; i++) {
                const c = this.decoLobes[i];
                let dp = phi - c.a;
                dp = Math.atan2(Math.sin(dp), Math.cos(dp));
                sum += c.d * Math.exp(-(dp * dp) / (2 * c.w * c.w));
            }
            return clamp(sum / 1.02, 0, 1);
        }
        // 軸対称成分は fMean で相殺済みなので、ここでは平均からのズレを返す
        decoDelta(phi) {
            return (0.15 + 0.85 * this.decoLobeAt(phi)) - DECO.fMean;
        }

        // しわの角度分布
        creaseProfile(phi) {
            let sum = 0;
            for (let i = 0; i < this.creases.length; i++) {
                const c = this.creases[i];
                let dp = phi - c.a;
                dp = Math.atan2(Math.sin(dp), Math.cos(dp));
                sum += c.d * Math.exp(-(dp * dp) / (2 * c.w * c.w));
            }
            return Math.min(1.6, sum);
        }

        // しわの縦方向の効き。でこがある品種では環の外壁へ移す
        // 【対策】立ち上がりが急だと、v 方向のリング間隔より速く y が動いて
        //         リング同士が交差し、裏返った三角形が生まれる。緩やかにする
        creaseBand(v) {
            if (this.decoLobes.length) return smooth(0.14, 0.30, v) * smooth(0.62, 0.34, v);
            return smooth(0.0, 0.06, v) * smooth(0.46, 0.15, v);
        }

        creaseY(v, phi) {
            let dy = 0;
            if (this.creases.length) {
                dy -= this.cfg.creaseAmount * this.H * this.creaseBand(v) * this.creaseProfile(phi);
            }
            if (this.decoLobes.length) {
                const k = decoAt(v);
                dy += this.cfg.decoAmount * DECO.rise * k.crownY * this.decoDelta(phi) * this.H;
            }
            return dy;
        }

        radiusAt(v, phi) {
            const cfg = this.cfg;
            const m = meridianAt(v, cfg);
            let r = m.r * this.R * lobeAt(phi, m.y, cfg);
            const dent =
                this.asym * Math.cos(phi - this.asymPhase) * (0.30 + 0.70 * Math.sin(Math.PI * m.y))
                + this.d2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * m.y * 1.3)
                + this.d3 * Math.cos(3 * phi - this.p3) * Math.sin(Math.PI * m.y * 0.8);
            r *= 1 + dent;
            if (this.creases.length) {
                r *= 1 - 0.05 * this.creaseBand(v) * this.creaseProfile(phi);
            }
            // でこの裂片（半径側）
            if (this.decoLobes.length) {
                const k = decoAt(v);
                r += cfg.decoAmount * DECO.wide * k.crownR * this.decoDelta(phi) * this.R;
            }
            // 皮のしわ（環の表面のゴツゴツ）
            if (cfg.neckWrinkle > 0) {
                const nk = smooth(0.32, 0.01, v);
                const w = Math.cos(4 * phi + this.neckPhase) * 0.55
                    + Math.cos(7 * phi + this.neckPhase * 1.7) * 0.30
                    + Math.cos(11 * phi + 2.1) * 0.15;
                r *= 1 + cfg.neckWrinkle * nk * w * (0.55 + 0.45 * Math.sin(v * 42 + this.neckPhase));
            }
            return Math.max(0.004, r);
        }

        seatAt(rho) {
            const P = this.meridian;
            for (let i = 1; i < P.length; i++) {
                if (P[i].r >= rho || i === P.length - 1) {
                    const t = clamp((rho - P[i - 1].r) / Math.max(1e-6, P[i].r - P[i - 1].r), 0, 1);
                    const y = mix(P[i - 1].y, P[i].y, t);
                    const yn = mix(P[i - 1].yn, P[i].yn, t);
                    const vv = mix(P[i - 1].v, P[i].v, t);
                    const dr = P[i].r - P[i - 1].r, dy = P[i].y - P[i - 1].y;
                    const L = Math.hypot(dr, dy) || 1;
                    return { y, yn, v: vv, nr: -dy / L, ny: dr / L };   // 上向きの外法線
                }
            }
            return { y: P[0].y, yn: P[0].yn, v: 0, nr: 0, ny: 1 };
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsMeridian, M = cfg.segmentsRound;
            const rings = [], centers = [];
            this.meridian = [];
            for (let i = 0; i <= N; i++) {
                const v = i / N;
                const m = meridianAt(v, cfg);
                const c = this.centerAt(m.y);
                rings.push(Geo.ring(c, new V3(1, 0, 0), new V3(0, 0, 1), M,
                    (phi) => this.radiusAt(v, phi),
                    (phi) => this.creaseY(v, phi)));
                centers.push(c);
                this.meridian.push({ v, rn: m.r, yn: m.y, r: m.r * this.R, y: m.y * this.H, c });
            }
            const mesh = Geo.build("mikanBody", rings, centers, true, true, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
            this.rings = rings;
            this.centers = centers;
        }

        // がく（へた）。seatAt() が平均断面を返すので、台が上がれば一緒に上がる
        _buildCalyx(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.calyxRings, M = cfg.calyxSides;
            const lobes = cfg.calyxLobes;
            const R0 = this.R * cfg.calyxRadius * rng.range(0.92, 1.12);
            const phase = rng.range(0, Math.PI * 2);
            const nv = (K + 1) * (M + 1);
            const positions = new Float32Array(nv * 3);
            const uvs = new Float32Array(nv * 2);
            const colors = new Float32Array(nv * 4);
            const indices = [];

            // 三ヶ日みかんのがくは鮮やかな黄緑。calyxFresh = 0 で旧版と同じ色
            const fr = cfg.calyxFresh;
            // 【対策】よく熟した実のヘタは緑より黄色に近い（農家の見分け方）。
            //         鮮やかな緑の星形は未熟な印象になるので calyxYellow で黄みへ寄せる
            const yl = cfg.calyxYellow;
            const cCore = freshColor([0.30, 0.34, 0.15], [0.20, 0.33, 0.07], fr, [0.42, 0.40, 0.14], yl);
            const cMid = freshColor([0.40, 0.45, 0.19], [0.33, 0.50, 0.11], fr, [0.56, 0.52, 0.20], yl);
            const cTip = freshColor([0.47, 0.47, 0.24], [0.50, 0.58, 0.19], fr, [0.66, 0.58, 0.26], yl);

            // 【対策】星の切れ込み（calyxStar）を深くするだけだと裂片が丸いまま
            //         「花びら」に見える。深くするほど指数を上げて先を尖らせる。
            //         calyxStar = 0.26 で旧版（0.74 + 0.26·t^0.7）と一致する
            const sk = cfg.calyxStar;
            const starPow = 0.7 + 2.0 * Math.max(0, sk - 0.26);

            let p = 0, q = 0, c = 0;
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                for (let j = 0; j <= M; j++) {
                    const phi = j / M * Math.PI * 2;
                    const t = 0.5 + 0.5 * Math.cos(lobes * phi + phase);
                    const star = (1 - sk) + sk * Math.pow(t, starPow);
                    const rho = R0 * s * star * (1 + 0.03 * Math.sin(3 * phi + phase));
                    const seat = this.seatAt(rho);
                    const lift = this.R * (cfg.calyxLift * (0.15 + 0.85 * Math.pow(1 - s, 2.0)) + 0.0035);
                    const rib = this.R * 0.006 * Math.pow(t, 3) * smooth(0.15, 0.95, s);
                    const yy = seat.y + seat.ny * lift + rib + this.creaseY(seat.v, phi) * 0.6;
                    const rr = rho + seat.nr * lift;
                    const ctr = this.centerAt(seat.yn);
                    positions[p++] = ctr.x + Math.cos(phi) * rr;
                    positions[p++] = yy;
                    positions[p++] = ctr.z + Math.sin(phi) * rr;
                    uvs[q++] = j / M * 3.0; uvs[q++] = s;

                    const w1 = smooth(0.10, 0.70, s);
                    const w2 = smooth(0.74, 1.0, s) * (0.35 + 0.65 * (1 - t));
                    const g = 0.88 + 0.24 * TextureLab.fbm(phi * 2.2, s * 5, 14, 613, 2);
                    colors[c] = mix(mix(cCore.r, cMid.r, w1), cTip.r, w2) * g;
                    colors[c + 1] = mix(mix(cCore.g, cMid.g, w1), cTip.g, w2) * g;
                    colors[c + 2] = mix(mix(cCore.b, cMid.b, w1), cTip.b, w2) * g;
                    colors[c + 3] = 1; c += 4;
                }
            }
            for (let i = 0; i < K; i++) {
                for (let j = 0; j < M; j++) {
                    const a = i * (M + 1) + j, b = a + 1, cc = a + (M + 1), dd = cc + 1;
                    indices.push(a, cc, b, b, cc, dd);
                }
            }
            const mesh = new BABYLON.Mesh("mikanCalyx", this.scene);
            const normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            for (let i = 0; i < normals.length; i += 3) {
                const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
                if (!(l > 1e-6)) { normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0; }
            }
            const vd = new BABYLON.VertexData();
            vd.positions = positions; vd.indices = indices;
            vd.normals = normals; vd.uvs = uvs; vd.colors = colors;
            vd.applyToMesh(mesh, false);
            mesh.material = skin.calyx;
            mesh.receiveShadows = true;
            this.calyx = mesh;
            this.calyxTopY = this.seatAt(0).y + this.R * (cfg.calyxLift + 0.0035);
            this.calyxTopYn = this.seatAt(0).yn;
            this.parts.push(mesh);
        }

        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const ctr = this.centerAt(this.calyxTopYn);
            const sink = cfg.stemRadius * 1.4;
            const y0 = this.calyxTopY - sink;
            const L = cfg.stemLength * rng.range(0.8, 1.2) + sink;

            const tiltA = rng.range(0, Math.PI * 2);
            const tilt = cfg.stemTiltDeg * Math.PI / 180 * rng.range(0.3, 1.4);

            const rings = [], centers = [];
            for (let k = 0; k <= K; k++) {
                const s = k / K;
                const y = y0 + L * s;
                const lean = Math.tan(tilt) * L * 0.9 * s * s;
                const cpos = new V3(
                    ctr.x + Math.cos(tiltA) * lean,
                    y,
                    ctr.z + Math.sin(tiltA) * lean
                );
                let rr = cfg.stemRadius * (0.86 + 0.34 * Math.pow(1 - s, 2.0));
                rr *= 1 - 0.10 * smooth(0.88, 1.0, s);
                rings.push(Geo.ring(cpos, new V3(1, 0, 0), new V3(0, 0, 1), M, (phi) =>
                    Math.max(0.008, rr * (1
                        + 0.05 * Math.cos(3 * phi + s * 1.4)
                        + 0.025 * Math.cos(7 * phi + 1.1)))));
                centers.push(cpos);
            }

            const mesh = Geo.build("mikanStem", rings, centers, false, true, this.scene);
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const uv = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            const col = new Float32Array((pos.length / 3) * 4);
            const fr = cfg.calyxFresh;
            const root = freshColor([0.33, 0.38, 0.16], [0.24, 0.38, 0.09], fr, [0.46, 0.44, 0.17], cfg.calyxYellow);
            const mid = freshColor([0.44, 0.44, 0.22], [0.38, 0.48, 0.15], fr, [0.58, 0.54, 0.24], cfg.calyxYellow);
            const cut = new BABYLON.Color3(0.66, 0.60, 0.42).toLinearSpace();   // 切り口
            for (let i = 0, c = 0; i < pos.length / 3; i++, c += 4) {
                const t = uv ? uv[i * 2 + 1] : 0;
                const u = uv ? uv[i * 2] : 0;
                const w1 = smooth(0.05, 0.70, t);
                const w2 = smooth(0.88, 1.0, t);
                const g = 0.92 + 0.16 * TextureLab.fbm(u * 12, t * 4, 12, 771, 2);
                col[c] = mix(mix(root.r, mid.r, w1), cut.r, w2) * g;
                col[c + 1] = mix(mix(root.g, mid.g, w1), cut.g, w2) * g;
                col[c + 2] = mix(mix(root.b, mid.b, w1), cut.b, w2) * g;
                col[c + 3] = 1;
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
            mesh.hasVertexAlpha = false;
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.parts.push(mesh);
        }

        bounds() {
            let o = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
            for (const m of this.parts) {
                const p = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                for (let i = 0; i < p.length; i += 3) {
                    o.minX = Math.min(o.minX, p[i]); o.maxX = Math.max(o.maxX, p[i]);
                    o.minY = Math.min(o.minY, p[i + 1]); o.maxY = Math.max(o.maxY, p[i + 1]);
                    o.minZ = Math.min(o.minZ, p[i + 2]); o.maxZ = Math.max(o.maxZ, p[i + 2]);
                }
            }
            return o;
        }

        dispose() {
            for (const m of this.parts) m.dispose();
            if (this.root) this.root.dispose();
            this.parts.length = 0;
        }
    }

    // =================================================================
    // 6. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.06, 0.06, 0.07, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.60;
    scene.environmentIntensity = 0.92;
    scene.createDefaultSkybox(env, true, 1000, 0.72, false);

    const camera = new BABYLON.ArcRotateCamera("cam", -1.05, 1.15, 22, new V3(0, 0, 0), scene);
    camera.attachControl(true);
    camera.wheelPrecision = 12;
    camera.minZ = 0.05;
    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 120;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.55, -0.95, 0.45).normalize(), scene);
    key.position = new V3(14, 24, -12);
    key.intensity = 2.2;
    key.diffuse = new BABYLON.Color3(1.0, 0.97, 0.93);
    key.specular = new BABYLON.Color3(0.42, 0.41, 0.39);
    // 【対策】影用フラスタムを固定サイズにする。
    //         自動計算（autoUpdateExtends）は影を落とすメッシュ＝果実だけに
    //         合わせるため、地面の大半がシャドウマップの外に出る。
    //         Babylon の PCF は UV の xy 範囲外を判定していないので、
    //         クランプされた端のテクセルが引き伸ばされて直線状の影になる。
    //         サイズは build() で果実の大きさに合わせて更新する。
    key.autoCalcShadowZBounds = false;
    key.shadowFrustumSize = 26;
    key.shadowMinZ = 14;
    key.shadowMaxZ = 50;

    const rim = new BABYLON.DirectionalLight("rim", new V3(0.5, -0.3, -1.0).normalize(), scene);
    rim.intensity = 1.3;
    rim.diffuse = new BABYLON.Color3(1.0, 0.93, 0.86);
    rim.specular = new BABYLON.Color3(0.20, 0.19, 0.18);

    const fill = new BABYLON.HemisphericLight("fill", new V3(0, 1, 0), scene);
    fill.intensity = 0.32;
    fill.diffuse = new BABYLON.Color3(0.96, 0.96, 1.0);
    fill.groundColor = new BABYLON.Color3(0.30, 0.26, 0.22);
    fill.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);   // 固定フラスタム化でテクセルが粗くなるぶん増やす
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.bias = 0.003;
    sg.normalBias = 0.02;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.10;
    ip.contrast = 1.08;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 0.9;
    ip.vignetteCameraFov = 0.7;
    ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    let ground = null;
    function ensureGround(y) {
        if (!GLOBAL.showGround) return;
        if (!ground) {
            ground = BABYLON.MeshBuilder.CreateDisc("ground", { radius: 60, tessellation: 64 }, scene);
            ground.rotation.x = Math.PI / 2;
            const gm = new BABYLON.PBRMaterial("groundMat", scene);
            gm.albedoColor = new BABYLON.Color3(0.46, 0.45, 0.44).toLinearSpace();
            gm.metallic = 0.0; gm.roughness = 0.90;
            ground.material = gm;
            ground.receiveShadows = true;
        }
        ground.position.y = y;
    }

    // =================================================================
    //  生成 / 差し替え
    // =================================================================
    let state = null;
    const skinCache = {};
    let ssao = null;
    let onRebuilt = null;

    function build(varietyKey, seed) {
        if (state) { state.mikan.dispose(); state = null; }
        const cfg = buildConfig(varietyKey, seed);

        let skin = skinCache[varietyKey];
        if (!skin) { skin = new SkinFactory(scene, cfg); skinCache[varietyKey] = skin; }

        const mikan = new Mikan(scene, cfg, cfg.seed, skin);
        state = { cfg, skin, mikan };

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const m of mikan.parts) sg.addShadowCaster(m, true);

        const bb = mikan.bounds();
        mikan.root.position.y = -(bb.minY);          // 接地させる
        mikan.root.position.x = -(bb.minX + bb.maxX) * 0.5;
        mikan.root.position.z = -(bb.minZ + bb.maxZ) * 0.5;
        state.bounds = bb;

        ensureGround(-0.01);
        // 果実本体＋地面に落ちる影の範囲を覆う。狭いと影が直線で切れ、
        // 広すぎるとシャドウマップの解像度を無駄に使う
        key.shadowFrustumSize = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 3.2;
        camera.target.set(0, (bb.maxY - bb.minY) * 0.46, 0);
        camera.radius = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 2.9;
        if (ssao) ssao.radius = cfg.radius * 0.40;
        if (onRebuilt) onRebuilt(state);

        console.log("[Mikan]", cfg.label, "/ seed =", cfg.seed,
            "/ oil glands =", skin.glandCount,
            "/ deco lobes =", mikan.decoLobes.length,
            "/ creases =", mikan.creases.length,
            "/ bake =", skin.bakeMs.toFixed(0) + "ms");
        return state;
    }

    build(START_VARIETY, START_SEED);

    if (GLOBAL.useSSAO) {
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        ssao.radius = state.cfg.radius * 0.40;
        ssao.totalStrength = 0.70;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 120;
        ssao.minZAspect = 0.25;
    }
    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.94;
    dp.bloomWeight = 0.08;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.10;
    dp.depthOfFieldEnabled = true;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
    dp.depthOfField.fStop = 5.0;
    dp.depthOfField.focalLength = 70;
    dp.depthOfField.focusDistance = camera.radius * 1000;
    scene.onBeforeRenderObservable.add(() => {
        if (dp.depthOfFieldEnabled) dp.depthOfField.focusDistance = camera.radius * 1000;
    });

    // =================================================================
    // 7. GUI
    // =================================================================
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const isNarrow = (typeof window !== "undefined") && window.innerWidth < 700;
    if (isNarrow) ui.rootContainer.scaleX = ui.rootContainer.scaleY = 1.5;

    const COL = {
        idle: "#2b2620", active: "#c06a1a", edge: "#4a4036",
        text: "#f6efe6", sub: "#bdae9c", accent: "#f0a95c"
    };

    const toggle = BABYLON.GUI.Button.CreateSimpleButton("toggle", "≡");
    toggle.width = "40px"; toggle.height = "40px";
    toggle.color = COL.text; toggle.background = "rgba(18,14,10,0.82)";
    toggle.cornerRadius = 8; toggle.thickness = 1; toggle.fontSize = 20;
    toggle.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    toggle.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    toggle.left = "16px"; toggle.top = "16px";
    ui.addControl(toggle);

    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(18,14,10,0.82)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "64px";
    card.isVisible = !isNarrow;
    ui.addControl(card);
    toggle.onPointerUpObservable.add(() => { card.isVisible = !card.isVisible; });

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "200px"; panel.isVertical = true;
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

    addLabel("MIKAN", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    let curVariety = START_VARIETY, curSeed = START_SEED;
    const varietyButtons = {};
    function highlight() {
        for (const k in varietyButtons) varietyButtons[k].background = (k === curVariety) ? COL.active : COL.idle;
    }
    for (const key of Object.keys(PRESETS)) {
        varietyButtons[key] = addButton("v_" + key, PRESETS[key].label, () => {
            curVariety = key; build(curVariety, curSeed); highlight();
        });
    }

    const sp = new BABYLON.GUI.Rectangle();
    sp.height = "8px"; sp.thickness = 0; sp.background = "";
    panel.addControl(sp);

    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed); highlight();
    });
    const rotateBtn = addButton("rotate", "自動回転: OFF", () => {
        camera.useAutoRotationBehavior = !camera.useAutoRotationBehavior;
        if (camera.autoRotationBehavior) camera.autoRotationBehavior.idleRotationSpeed = 0.1;
        rotateBtn.textBlock.text = "自動回転: " + (camera.useAutoRotationBehavior ? "ON" : "OFF");
        rotateBtn.background = camera.useAutoRotationBehavior ? COL.active : COL.idle;
    });

    const info = addLabel("", 12, COL.sub, "52px");
    onRebuilt = (st) => {
        if (!info) return;
        const bb = st.bounds;
        const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
        info.text = "径 " + w.toFixed(1) + "cm / 高さ " + h.toFixed(1) + "cm\n扁平率 "
            + (h / w).toFixed(2) + " / 油胞 " + st.skin.glandCount + "個\nseed: " + st.cfg.seed;
    };
    onRebuilt(state);
    highlight();

    return scene;
};

export default createScene;