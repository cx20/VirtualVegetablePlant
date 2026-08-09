// =====================================================================
//  Photoreal Onion  /  写実的な玉ねぎ（v1）
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  ミカン版 v11 の構造をそのまま流用し、対象を玉ねぎに置き換えたもの。
//  Rng / Geo / TextureLab / SkinFactory / GUI の骨格と、v7〜v11 で入れた
//  【対策】コメント（巻き順の全頂点平均判定、キャップの巻き順を側面から
//  導く、退化法線の置換、プリセットのキー欠落検出、影用フラスタムの固定）
//  は玉ねぎでも同じ罠を踏むのでそのまま残してある。
//
//  ---------------------------------------------------------------------
//  ミカン → 玉ねぎ で「作り替えた」ところ
//  ---------------------------------------------------------------------
//  (1) 表面の主役が「油胞（点）」から「繊維（縦線）」に変わる
//      ミカンの油胞は格子＋ジッタで置いた楕円の点だった。玉ねぎは
//      外皮の維管束が首から根盤へ「縦に」走る。UV球の u は円周・v は
//      子午線なので、繊維は UV 空間では「ほぼ u 一定の縦線」になり、
//      極（首と根盤）で自然に収束する。点の散布ではなく線の描画に変更。
//      【対策】線を1本ずつ splat する。fbm だけで縦縞を作ろうとすると
//              「縞の密度が揃った布」になり、繊維の太さのばらつきと
//              途中で消える／合流する感じが出ない。
//
//  (2) ワックス（クリアコート）主体から「絹目＋紙質」主体へ
//      ミカンは蝋層が主役なので clearCoat.intensity を強めに振っていた。
//      玉ねぎの外皮は乾いた薄紙で、
//        ・繊維に沿った異方性の照り  → PBRMaterial.anisotropy
//        ・薄い紙の縁が光る retro-reflective な照り → PBRMaterial.sheen
//        ・薄皮ごしの透け             → subSurface.translucency
//      の3つで出す。clearCoat は「新玉ねぎのしっとりした艶」ぶんだけ
//      弱く残す（品種プリセットの glossIntensity で調整）。
//      【対策】anisotropy.direction は接空間の Vector2。UV の v が子午線
//              方向なので (0,1) を指定する。bumpTexture があれば接線は
//              Babylon 側が UV から作るので tangents を自前で焼く必要はない。
//
//  (3) 上下の端が「へた／花落ち」から「首／根盤」になる
//      ミカンは上にがくシート＋短い果梗が乗っていた。玉ねぎは
//        ・上 = 乾いてねじれた首（潰れた断面＋ねじれ＋先端の裂け）
//        ・下 = 少しくぼんだ根盤＋外へ這う細い根
//      首は別メッシュの掃引、根は1本ずつの細い管を1メッシュにまとめて焼く。
//      【対策】根は下向きにするとメッシュが地面を突き抜ける。実物も
//              外へ這って潰れているので、下向き成分を len の 0.18 倍に
//              抑えて横へ広げる。接地は根盤ではなく その少し外の
//              リング（v≒0.96）で取るので、根盤は浮いたままでよい。
//
//  (4) 剥がれかけた薄皮（フレーク）
//      実物の肩〜首には必ず破れた外皮がめくれている。これはテクスチャ
//      だけでは出ないので、肩に張り付いた薄い1枚板を数枚生やす。
//      【対策】両面マテリアル（backFaceCulling=false / twoSidedLighting）
//              にして巻き順の判定を回避する。厚みゼロの板で巻き順を
//              当てにいくと、裏から見たときだけ真っ黒になる。
//
//  (5) 輪郭
//      ミカンは扁平（径 > 高さ）だった。玉ねぎは球に近く、最大径は
//      中央よりやや下（全高の 37〜42% 付近）。上は首へ絞られ、下は
//      小さな平板で終わる。MERIDIAN はこの形に合わせて引き直した。
// =====================================================================

var createScene = function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const PRESETS = {
        // 黄玉ねぎ: 標準的な貯蔵玉ねぎ。飴色の外皮に濃い繊維、そこそこの艶
        yellow: {
            label: "黄玉ねぎ",
            radius: 3.70, height: 6.95,
            shoulder: 0.030, hip: 0.018, neckPinch: 0.16, basalDepth: 0.020,
            lobeAmp: 0.013, asymmetry: 0.030,
            fluteCount: 6, fluteAmount: 0.014,
            // --- 首（乾いてねじれた茎）
            neckRadius: 0.115, neckLength: 0.34, neckTaper: 1.30,
            neckTwist: 2.0, neckFlat: 0.26, neckRagged: 0.55, neckTiltDeg: 12,
            // --- 根盤と根
            basalRadius: 0.105, rootCount: 34,
            rootLength: 0.160, rootRadius: 0.0070, rootCurl: 1.2,
            // --- めくれた薄皮
            flakeCount: 3, flakeSize: 0.30, flakeLift: 0.055,
            // --- 色（sRGB 相当 0..1）
            ground: [0.87, 0.60, 0.33],       // 地色
            deep: [0.74, 0.42, 0.21],       // 陰／赤みの強い側
            pale: [0.96, 0.83, 0.62],       // 絹目の明るい帯
            fiber: [0.55, 0.31, 0.15],       // 縦の繊維
            flakeCol: [0.94, 0.86, 0.71],       // 剥けて露出した内側
            blotch: [0.47, 0.30, 0.16],       // 擦れ・汚れ
            neckCol: [0.64, 0.56, 0.38],       // 首の付け根
            neckTip: [0.86, 0.80, 0.66],       // 首の先（脱色して白っぽい）
            basalCol: [0.70, 0.61, 0.46],       // 根盤
            rootCol: [0.78, 0.72, 0.58],       // 根
            // --- 陰影
            sunAmount: 0.42, sunFloor: 0.62, sunSpread: 1.1,
            paleAmount: 0.42,
            // --- テクスチャ量
            fiberCount: 470, fiberWidth: 1.30, fiberInk: 0.55,
            fiberWander: 0.010, fiberDepth: 0.85,
            flakeAmount: 0.50, blotchAmount: 0.16, lumpAmount: 0.35,
            // --- 質感
            skinRoughness: 0.42, glossIntensity: 0.55, sheenIntensity: 0.55,
            anisoIntensity: 0.45, translucency: 0.10
        },
        // 新玉ねぎ: 扁平で淡い。首がまだ緑、外皮が薄くしっとり、擦れ跡が多い
        shin: {
            label: "新玉ねぎ",
            radius: 3.95, height: 6.35,
            shoulder: 0.040, hip: 0.026, neckPinch: 0.12, basalDepth: 0.018,
            lobeAmp: 0.016, asymmetry: 0.034,
            fluteCount: 5, fluteAmount: 0.018,
            neckRadius: 0.135, neckLength: 0.30, neckTaper: 1.15,
            neckTwist: 1.2, neckFlat: 0.20, neckRagged: 0.35, neckTiltDeg: 10,
            basalRadius: 0.115, rootCount: 40,
            rootLength: 0.185, rootRadius: 0.0075, rootCurl: 1.4,
            flakeCount: 4, flakeSize: 0.34, flakeLift: 0.048,
            ground: [0.93, 0.90, 0.72],
            deep: [0.86, 0.79, 0.55],
            pale: [0.99, 0.98, 0.90],
            fiber: [0.74, 0.68, 0.45],
            flakeCol: [0.97, 0.95, 0.85],
            blotch: [0.60, 0.48, 0.25],
            neckCol: [0.40, 0.51, 0.21],       // まだ青い首
            neckTip: [0.62, 0.66, 0.36],
            basalCol: [0.80, 0.75, 0.58],
            rootCol: [0.86, 0.82, 0.70],
            sunAmount: 0.26, sunFloor: 0.70, sunSpread: 1.3,
            paleAmount: 0.30,
            fiberCount: 380, fiberWidth: 1.10, fiberInk: 0.38,
            fiberWander: 0.012, fiberDepth: 0.60,
            flakeAmount: 0.34, blotchAmount: 0.36, lumpAmount: 0.28,
            skinRoughness: 0.34, glossIntensity: 0.85, sheenIntensity: 0.42,
            anisoIntensity: 0.34, translucency: 0.18
        },
        // 赤玉ねぎ: 扁平で濃い赤紫。繊維は地色より暗く、絹目は白っぽく浮く
        red: {
            label: "赤玉ねぎ",
            radius: 3.90, height: 6.45,
            shoulder: 0.036, hip: 0.024, neckPinch: 0.18, basalDepth: 0.022,
            lobeAmp: 0.015, asymmetry: 0.032,
            fluteCount: 7, fluteAmount: 0.016,
            neckRadius: 0.110, neckLength: 0.32, neckTaper: 1.35,
            neckTwist: 2.2, neckFlat: 0.28, neckRagged: 0.60, neckTiltDeg: 14,
            basalRadius: 0.100, rootCount: 32,
            rootLength: 0.150, rootRadius: 0.0070, rootCurl: 1.1,
            flakeCount: 3, flakeSize: 0.28, flakeLift: 0.052,
            ground: [0.47, 0.20, 0.29],
            deep: [0.33, 0.12, 0.21],
            pale: [0.75, 0.52, 0.60],
            fiber: [0.29, 0.10, 0.18],
            flakeCol: [0.83, 0.66, 0.70],
            blotch: [0.31, 0.17, 0.19],
            neckCol: [0.48, 0.38, 0.34],
            neckTip: [0.80, 0.72, 0.66],
            basalCol: [0.66, 0.55, 0.52],
            rootCol: [0.76, 0.70, 0.62],
            sunAmount: 0.44, sunFloor: 0.58, sunSpread: 1.0,
            paleAmount: 0.46,
            fiberCount: 430, fiberWidth: 1.25, fiberInk: 0.52,
            fiberWander: 0.010, fiberDepth: 0.80,
            flakeAmount: 0.44, blotchAmount: 0.14, lumpAmount: 0.32,
            skinRoughness: 0.38, glossIntensity: 0.65, sheenIntensity: 0.62,
            anisoIntensity: 0.50, translucency: 0.08
        },
        // ペコロス: 小玉。球に近く首も根も短い
        pecoros: {
            label: "ペコロス",
            radius: 2.05, height: 3.95,
            shoulder: 0.022, hip: 0.014, neckPinch: 0.20, basalDepth: 0.024,
            lobeAmp: 0.011, asymmetry: 0.026,
            fluteCount: 5, fluteAmount: 0.012,
            neckRadius: 0.125, neckLength: 0.34, neckTaper: 1.25,
            neckTwist: 1.7, neckFlat: 0.24, neckRagged: 0.50, neckTiltDeg: 16,
            basalRadius: 0.115, rootCount: 24,
            rootLength: 0.150, rootRadius: 0.0090, rootCurl: 1.3,
            flakeCount: 2, flakeSize: 0.32, flakeLift: 0.060,
            ground: [0.90, 0.68, 0.40],
            deep: [0.79, 0.50, 0.26],
            pale: [0.97, 0.87, 0.68],
            fiber: [0.60, 0.36, 0.18],
            flakeCol: [0.95, 0.88, 0.74],
            blotch: [0.50, 0.33, 0.18],
            neckCol: [0.62, 0.55, 0.38],
            neckTip: [0.87, 0.82, 0.68],
            basalCol: [0.72, 0.63, 0.48],
            rootCol: [0.80, 0.74, 0.60],
            sunAmount: 0.36, sunFloor: 0.66, sunSpread: 1.2,
            paleAmount: 0.38,
            fiberCount: 300, fiberWidth: 1.55, fiberInk: 0.50,
            fiberWander: 0.012, fiberDepth: 0.90,
            flakeAmount: 0.46, blotchAmount: 0.18, lumpAmount: 0.40,
            skinRoughness: 0.44, glossIntensity: 0.50, sheenIntensity: 0.58,
            anisoIntensity: 0.42, translucency: 0.12
        }
    };

    const GLOBAL = {
        // --- 分割
        segmentsMeridian: 156,
        segmentsRound: 132,
        lobeCount: 7,                   // 鱗片由来の緩い縦の稜
        // --- 首
        neckSegments: 22,
        neckSides: 26,
        // --- 根
        rootSegments: 6,
        rootSides: 5,
        // --- 薄皮
        flakeCols: 14,
        flakeRows: 8,
        // --- テクスチャ
        textureSize: 1024,
        skinDetail: 1.0,
        // --- 描画
        useSSAO: true,
        showGround: true,
        showRoots: true,
        showFlakes: true
    };

    const START_VARIETY = "yellow";
    const START_SEED = 20260727;

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        // 【対策】プリセットのキーが1つ欠けると値は undefined になり、計算結果が
        //         NaN になって伝播する。しかも
        //           ・Uint8ClampedArray は NaN を 0 に丸める
        //             → 焼いたテクスチャを覗いても NaN だったと分からない
        //           ・NaN uniform はエラーも警告も出さず、黒として描かれる
        //           ・キー欠落自体は構文エラーにならない
        //         ため、症状（真っ黒）から原因に辿り着きにくい。
        //         yellow をスキーマとみなして、ここで検出して潰す。
        const SCHEMA = PRESETS.yellow;
        for (const k in SCHEMA) {
            if (!(k in cfg)) {
                console.error("[Config] preset '" + varietyKey + "' にキー '" + k
                    + "' がありません。yellow の値で補完します:", SCHEMA[k]);
                cfg[k] = SCHEMA[k];
            } else if (typeof SCHEMA[k] === "number" && !isFinite(cfg[k])) {
                console.error("[Config] preset '" + varietyKey + "' のキー '" + k
                    + "' が数値ではありません:", cfg[k], "-> yellow の値で補完します:", SCHEMA[k]);
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
    // 2. Geo : リング列から掃引メッシュを作る（ミカン版と同一）
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
            // 【対策1】代表頂点1つの法線で判定すると、上部形状が大きく変わる
            //          品種でメッシュ全体が裏返る（＝真っ黒になる）。
            // 【対策2】符号付き体積 V=(1/6)Σa·(b×c) は右手系の公式で、Babylon は
            //          既定で左手系なので符号が反転する。Babylon 自身が計算した
            //          法線が重心から外を向いているかを全頂点で積算すれば、
            //          規約は Babylon 側に合わせられる。
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
            // 【対策】隣り合う三角形は共有辺を「逆向きに」辿るときだけ向きが揃う。
            //         側面の巻き順が決まればキャップの巻き順も決まる。
            //         根盤にくぼみを入れると centers[N-1].y が隣のリングより
            //         高くなり、「下キャップは下を向くはず」という前提が崩れる。
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
            //         生まれる。NaN はシェーダ内を伝播してその範囲が黒く抜ける。
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
    // 3. Profile : 子午線
    // =================================================================
    //  v = 0 が首側、v = 1 が根盤側。r は正規化半径、y は正規化高さ。
    //  球 r(y)=2√(y(1-y)) を出発点に
    //    ・(1 + 0.26(0.5 - y)) を掛けて最大径を中央よりやや下（全高 37〜42%）へ
    //    ・上端を smooth で絞って首の肩を作る
    //    ・下端を r=0.12 で打ち切って根盤の平板にする
    //  という手順で引いた表。手で滑らかに整えてある。
    const MERIDIAN = [
        [0.038, 1.000], [0.082, 0.996], [0.150, 0.984], [0.232, 0.965],
        [0.325, 0.938], [0.428, 0.905], [0.535, 0.865], [0.640, 0.819],
        [0.735, 0.768], [0.816, 0.713], [0.881, 0.655], [0.930, 0.594],
        [0.966, 0.531], [0.988, 0.469], [0.999, 0.406], [0.999, 0.346],
        [0.986, 0.287], [0.958, 0.232], [0.914, 0.181], [0.852, 0.136],
        [0.770, 0.096], [0.664, 0.062], [0.535, 0.035], [0.392, 0.016],
        [0.248, 0.004], [0.120, 0.000]
    ];

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

        // 肩の張り（上半身のふくらみ）／尻の張り
        if (cfg && cfg.shoulder) r *= 1 + cfg.shoulder * gauss1(v, 0.34, 0.16);
        if (cfg && cfg.hip) r *= 1 + cfg.hip * gauss1(v, 0.72, 0.16);

        // 首の付け根の絞り
        if (cfg && cfg.neckPinch) r *= 1 - cfg.neckPinch * smooth(0.20, 0.0, v);

        // 根盤のくぼみ。
        // 【対策】ここを smooth(0.86,1.0,v) のような広い区間にすると、最下点が
        //         中心に来て「下に膨らんだ底」になり、接地が点になって影が
        //         にじむ。狭い区間で中心だけ持ち上げると、実物どおり
        //         「少し外のリングで接地して中心はくぼむ」形になる。
        if (cfg && cfg.basalDepth) y += cfg.basalDepth * smooth(0.94, 1.0, v);

        return { r, y };
    }

    function lobeAt(phi, yn, cfg) {
        // 鱗片の重なりに由来する、ごく緩い縦の稜。上下の端では消す
        const amp = cfg.lobeAmp * (0.30 + 0.70 * Math.sin(Math.PI * clamp(yn, 0, 1)));
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

        // ---- 縦の繊維（維管束）-------------------------------------------
        //  玉ねぎの外皮の主役。UV球の u は円周、v は子午線なので、繊維は
        //  「ほぼ u 一定の縦線」として描けば極で自然に収束する。
        // 【対策1】fbm だけで縦縞を作ると「縞の密度が揃った布」になる。
        //          1本ずつ splat して、太さ・濃さ・長さを個別にばらつかせる。
        // 【対策2】極では u 方向の実距離が sin(πv) 倍に縮む。線幅もそれに
        //          比例させないと、首と根盤で線が太くなって塊に見える。
        // 【対策3】全部の線を極から極まで通すと放射状の完璧な模様になる。
        //          v0/v1 で途中から始まり途中で終わる線を混ぜる。
        // 【対策4】完全な直線だと CG くさい。v に対して緩い正弦で横に流す。
        fibers(size, seed, cfg) {
            const fib = new Float32Array(size * size);
            const r = new Rng(seed);
            const n = cfg.fiberCount | 0;
            const px = size / 1024;
            let count = 0;
            for (let f = 0; f < n; f++) {
                const u0 = r.next();
                const dark = r.range(0.30, 1.00);
                const wob = cfg.fiberWander * r.range(0.35, 1.70);
                const ph = r.range(0, Math.PI * 2);
                const kw = r.range(1.2, 3.2);
                const wid = cfg.fiberWidth * px * r.range(0.50, 1.65);
                const v0 = r.range(-0.20, 0.30);
                const v1 = r.range(0.72, 1.20);
                if (v1 - v0 < 0.12) continue;
                count++;
                for (let y = 0; y < size; y++) {
                    const v = (y + 0.5) / size;
                    if (v < v0 || v > v1) continue;
                    const s = Math.sin(Math.PI * clamp(v, 0, 1));
                    const conv = Math.max(0.14, s);
                    const edge = smooth(v0, v0 + 0.10, v) * smooth(v1, v1 - 0.12, v);
                    if (edge <= 0.001) continue;
                    const du = wob * Math.sin(v * kw * Math.PI * 2 + ph);
                    const cx = (((u0 + du) % 1) + 1) % 1 * size;
                    const half = Math.max(0.65, wid * conv);
                    const x0 = Math.floor(cx - half), x1 = Math.ceil(cx + half);
                    for (let x = x0; x <= x1; x++) {
                        const d = Math.abs(x + 0.5 - cx) / half;
                        if (d >= 1) continue;
                        const w = Math.pow(1 - d, 1.35) * dark * edge * (0.45 + 0.55 * conv);
                        const xw = ((x % size) + size) % size;
                        const i = y * size + xw;
                        if (w > fib[i]) fib[i] = w;
                    }
                }
            }
            return { fib, count };
        },

        // ---- 剥けかけた外皮（テクスチャ側）--------------------------------
        //  body = 剥けて露出した明るい面 / edge = めくれた縁（影と隆起）
        //  albedo / orm / normal の3枚で同じ値を使うため、関数にしてある。
        flakeAt(u, v, cfg, seed) {
            const n = this.fbm(u * 7, v * 5, 7, seed, 3);
            const body = smooth(0.53, 0.63, n) * cfg.flakeAmount;
            const edge = smooth(0.46, 0.53, n) * smooth(0.62, 0.55, n) * cfg.flakeAmount;
            return { body, edge };
        },

        // ---- 絹目の明るい縦帯 ---------------------------------------------
        //  u 方向に中周波、v 方向にごく低周波にすると、実物の「縦に流れる
        //  つややかな帯」になる。等方の fbm にすると水玉の斑になる。
        paleAt(u, v, cfg, seed) {
            const b = this.fbm(u * 5, v * 1.6, 5, seed, 3);
            return clamp(cfg.paleAmount * smooth(0.42, 0.78, b)
                * (0.50 + 0.50 * Math.sin(Math.PI * clamp(v, 0, 1))), 0, 1);
        },

        blotchAt(u, v, cfg, seed) {
            return smooth(0.60, 0.80, this.fbm(u * 14, v * 9, 14, seed, 3)) * cfg.blotchAmount;
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

        albedo(scene, size, cfg, fb, seed) {
            const G = cfg.ground, D = cfg.deep, PL = cfg.pale;
            const FB = cfg.fiber, FK = cfg.flakeCol, BL = cfg.blotch;
            const NK = cfg.neckCol, BA = cfg.basalCol;
            return this._canvasTexture("onionAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const neckK = smooth(0.060, 0.0, v);
                    const basalK = smooth(0.950, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let cr = G[0], cg = G[1], cb = G[2];

                        // 地色のむら
                        const mott = 0.955 + 0.09 * this.fbm(u * 8, v * 6, 8, seed + 3, 2);
                        cr *= mott; cg *= mott; cb *= mott;

                        // 日向／日陰の色差
                        const sn = this.sunAt(u, v, cfg, seed + 11);
                        cr = mix(cr, D[0], sn); cg = mix(cg, D[1], sn); cb = mix(cb, D[2], sn);

                        // 絹目の明るい縦帯
                        const pl = this.paleAt(u, v, cfg, seed + 23);
                        cr = mix(cr, PL[0], pl); cg = mix(cg, PL[1], pl); cb = mix(cb, PL[2], pl);

                        // 縦の繊維。実物は「細い線がはっきり出る」ので少し強めに
                        const fv = fb.fib[y * N + x];
                        const fw = smooth(0.06, 0.85, fv) * cfg.fiberInk;
                        cr = mix(cr, FB[0], fw); cg = mix(cg, FB[1], fw); cb = mix(cb, FB[2], fw);

                        // 擦れ・汚れ
                        const bw = this.blotchAt(u, v, cfg, seed + 41);
                        cr = mix(cr, BL[0], bw); cg = mix(cg, BL[1], bw); cb = mix(cb, BL[2], bw);

                        // 剥けた外皮（明るい面＋暗い縁）
                        const fk = this.flakeAt(u, v, cfg, seed + 7);
                        cr = mix(cr, FK[0], fk.body); cg = mix(cg, FK[1], fk.body); cb = mix(cb, FK[2], fk.body);
                        cr = mix(cr, BL[0], fk.edge * 0.75); cg = mix(cg, BL[1], fk.edge * 0.75); cb = mix(cb, BL[2], fk.edge * 0.75);

                        // 首の付け根：繊維が寄り集まって色が濁る
                        if (neckK > 0) {
                            const w = neckK * 0.80;
                            cr = mix(cr, NK[0], w); cg = mix(cg, NK[1], w); cb = mix(cb, NK[2], w);
                        }
                        // 根盤：放射状に繊維が収束した淡褐色の座
                        if (basalK > 0) {
                            const star = smooth(-0.3, 0.8, Math.cos(18 * u * Math.PI * 2));
                            const w = basalK * (0.55 + 0.45 * star);
                            cr = mix(cr, BA[0], w); cg = mix(cg, BA[1], w); cb = mix(cb, BA[2], w);
                        }

                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        orm(scene, size, cfg, fb, seed) {
            return this._canvasTexture("onionORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const neckK = smooth(0.07, 0.0, v);
                    const basalK = smooth(0.94, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let rough = cfg.skinRoughness * (0.92 + 0.20 * this.fbm(u * 10, v * 8, 10, seed + 5, 2));
                        let ao = 1.0;

                        // 絹目はつるつる、繊維はざらざら
                        rough -= 0.14 * this.paleAt(u, v, cfg, seed + 23);
                        const fw = smooth(0.12, 0.85, fb.fib[y * N + x]);
                        rough = mix(rough, clamp(rough + 0.20, 0, 1), fw);
                        ao = mix(ao, 0.86, fw);

                        const fk = this.flakeAt(u, v, cfg, seed + 7);
                        rough = mix(rough, 0.88, fk.body);
                        rough = mix(rough, 0.92, fk.edge);
                        ao = mix(ao, 0.78, fk.edge);

                        rough = mix(rough, 0.90, this.blotchAt(u, v, cfg, seed + 41));
                        rough = mix(rough, 0.93, neckK);
                        rough = mix(rough, 0.95, basalK);
                        ao = mix(ao, 0.52, neckK);
                        ao = mix(ao, 0.46, basalK);

                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, cfg, fb, seed, detail) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const poleK = Math.sin(Math.PI * clamp(v, 0, 1));
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    // 大きなうねり（鱗片の重なり）
                    const lump = this.fbm(u * 7, v * 5, 7, seed + 3, 3) * 0.55 * cfg.lumpAmount;
                    // 縦に引き伸ばした微細目（繊維の間を埋める）
                    // 【対策】等方ノイズだと砂目になって玉ねぎに見えない。
                    //         u を高周波・v を低周波にして縦方向に伸ばす。
                    const grain = this.fbm(u * 130, v * 12, 130, seed + 21, 2) * 0.22;
                    const micro = this.fbm(u * 60, v * 46, 60, seed + 61, 2) * 0.10;
                    const fk = this.flakeAt(u, v, cfg, seed + 7);
                    h[i] = lump + grain * poleK + micro
                        - fb.fib[i] * 0.85 * cfg.fiberDepth      // 繊維は溝
                        - fk.body * 0.18                          // 剥けた面は一段低い
                        + fk.edge * 1.10;                         // めくれた縁は立つ
                }
            }
            return this._canvasTexture("onionNormal", size, (d, N) => {
                const strength = 1.05 * (detail === undefined ? 1 : detail);
                for (let y = 0; y < N; y++) {
                    const vv = y / N;
                    const poleFade = smooth(0, 0.05, vv) * (1 - smooth(0.95, 1.0, vv));
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

        // 首・根・薄皮に使う、縦に走る繊維の法線
        fiberNormal(scene, size, seed) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    h[y * size + x] = this.fbm(u * 40, v * 6, 40, seed, 3) * 0.85
                        + this.fbm(u * 90, v * 52, 90, seed + 17, 2) * 0.22;
                }
            }
            return this._canvasTexture("onionFiber", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * 2.4, ny = (yu - yd) * 2.4, nz = 1;
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
            const fb = TextureLab.fibers(S, 5501, cfg);
            this.fiberCount = fb.count;

            this.albedoTex = TextureLab.albedo(scene, S, cfg, fb, 77);
            this.ormTex = TextureLab.orm(scene, S, cfg, fb, 77);
            this.normalTex = TextureLab.normal(scene, S, cfg, fb, 909, cfg.skinDetail);
            this.fiberTex = TextureLab.fiberNormal(scene, 256, 4242);
            this.bakeMs = performance.now() - t0;

            const pbr = new BABYLON.PBRMaterial("onionSkin", scene);
            pbr.albedoTexture = this.albedoTex;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;                    // 実値は ORM の G チャンネル
            pbr.metallicTexture = this.ormTex;
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            pbr.bumpTexture.level = 0.85;

            // --- 異方性：繊維は v 方向（子午線＝縦）に走る -----------------
            // 【対策】direction は「接空間」の Vector2。UV の v が縦なので (0,1)。
            //         (1,0) にするとハイライトが縦に伸びて、樽のタガのような
            //         横縞の照りになる。
            pbr.anisotropy.isEnabled = true;
            pbr.anisotropy.intensity = clamp(cfg.anisoIntensity, 0, 1);
            pbr.anisotropy.direction = new BABYLON.Vector2(0, 1);

            // --- シーン：乾いた薄紙の縁が光る retro-reflective な照り -------
            pbr.sheen.isEnabled = true;
            pbr.sheen.intensity = clamp(cfg.sheenIntensity, 0, 1);
            pbr.sheen.roughness = 0.34;
            pbr.sheen.linkSheenWithAlbedo = false;
            pbr.sheen.color = new BABYLON.Color3(
                cfg.pale[0], cfg.pale[1], cfg.pale[2]).toLinearSpace();

            // --- 薄い光沢層（ミカンの蝋より弱い）---------------------------
            pbr.clearCoat.isEnabled = true;
            pbr.clearCoat.intensity = 0.30 * cfg.glossIntensity;
            // NaN が入ると警告なしで最終色が NaN になり真っ黒になる。念のため確認
            if (!isFinite(pbr.clearCoat.intensity)) {
                console.error("[Mat] clearCoat.intensity が非有限です。glossIntensity =", cfg.glossIntensity);
                pbr.clearCoat.intensity = 0.2;
            }
            pbr.clearCoat.roughness = 0.30;
            pbr.clearCoat.indexOfRefraction = 1.42;

            // --- 外皮ごしの透け -------------------------------------------
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(
                cfg.ground[0], cfg.ground[1] * 0.85, cfg.ground[2] * 0.7).toLinearSpace();
            pbr.subSurface.translucencyIntensity = cfg.translucency;
            pbr.subSurface.minimumThickness = 1.2;
            pbr.subSurface.maximumThickness = 5.0;
            this.skin = pbr;

            const neck = new BABYLON.PBRMaterial("onionNeck", scene);
            neck.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            neck.metallic = 0.0;
            neck.roughness = 0.82;
            neck.bumpTexture = this.fiberTex;
            neck.bumpTexture.level = 0.60;
            neck.sheen.isEnabled = true;
            neck.sheen.intensity = 0.45;
            neck.sheen.roughness = 0.4;
            neck.backFaceCulling = false;
            neck.twoSidedLighting = true;
            this.neck = neck;

            const root = new BABYLON.PBRMaterial("onionRoot", scene);
            root.albedoColor = new BABYLON.Color3(1, 1, 1);
            root.metallic = 0.0;
            root.roughness = 0.92;
            root.backFaceCulling = false;
            root.twoSidedLighting = true;
            this.root = root;

            // 【対策】厚みゼロの薄皮で巻き順を当てにいくと、裏から見たときだけ
            //         真っ黒になる。両面ライティングで判定そのものを回避する。
            const flake = new BABYLON.PBRMaterial("onionFlake", scene);
            flake.albedoColor = new BABYLON.Color3(1, 1, 1);
            flake.metallic = 0.0;
            flake.roughness = 0.66;
            flake.bumpTexture = this.fiberTex;
            flake.bumpTexture.level = 0.45;
            flake.backFaceCulling = false;
            flake.twoSidedLighting = true;
            flake.subSurface.isTranslucencyEnabled = true;
            flake.subSurface.translucencyIntensity = 0.35;   // 薄紙なのでよく透ける
            flake.subSurface.minimumThickness = 0.1;
            flake.subSurface.maximumThickness = 0.6;
            flake.subSurface.tintColor = new BABYLON.Color3(
                cfg.flakeCol[0], cfg.flakeCol[1], cfg.flakeCol[2]).toLinearSpace();
            this.flake = flake;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.neck.dispose(true, false);
            this.root.dispose(true, false);
            this.flake.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose();
            this.normalTex.dispose(); this.fiberTex.dispose();
        }
    }

    // =================================================================
    // 5. Onion
    // =================================================================
    class Onion {
        constructor(scene, cfg, seed, skin) {
            this.scene = scene; this.cfg = cfg;
            const rng = new Rng(seed);
            this.rng = rng;
            this.R = cfg.radius * rng.range(0.93, 1.07);
            this.H = cfg.height * rng.range(0.92, 1.08);
            this.lobePhase = rng.range(0, Math.PI * 2);
            this.asymPhase = rng.range(0, Math.PI * 2);
            this.asym = cfg.asymmetry * rng.range(0.6, 1.4);
            this.d2 = cfg.asymmetry * rng.range(0.35, 0.70);
            this.d3 = cfg.asymmetry * rng.range(0.20, 0.45);
            this.p2 = rng.range(0, Math.PI * 2);
            this.p3 = rng.range(0, Math.PI * 2);
            this.tilt = rng.gauss(0, 0.024);
            this.tiltDir = rng.range(0, Math.PI * 2);

            // 緩い縦の溝（フルート）。鱗片の合わせ目に相当する
            this.flutes = [];
            if (cfg.fluteAmount > 0) {
                const nF = Math.max(3, cfg.fluteCount | 0);
                const base = rng.range(0, Math.PI * 2);
                for (let i = 0; i < nF; i++) {
                    this.flutes.push({
                        a: base + (i / nF) * Math.PI * 2 + rng.range(-0.40, 0.40),
                        w: rng.range(0.18, 0.40),
                        d: rng.range(0.45, 1.30)
                    });
                }
            }

            this.parts = [];        // 親子付け用（全部）
            this.boundParts = [];   // 接地判定用（根は除く）
            this._buildBody(skin);
            this._buildNeck(skin);
            this._buildRoots(skin);
            this._buildFlakes(skin);
            this.root = new BABYLON.TransformNode("onion", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        centerAt(yn) {
            const k = this.tilt * this.H * (yn - 0.5);
            return new V3(Math.cos(this.tiltDir) * k, yn * this.H, Math.sin(this.tiltDir) * k);
        }

        fluteProfile(phi) {
            let sum = 0;
            for (let i = 0; i < this.flutes.length; i++) {
                const c = this.flutes[i];
                let dp = phi - c.a;
                dp = Math.atan2(Math.sin(dp), Math.cos(dp));
                sum += c.d * Math.exp(-(dp * dp) / (2 * c.w * c.w));
            }
            return Math.min(1.5, sum);
        }

        radiusAt(v, phi) {
            const cfg = this.cfg;
            const m = meridianAt(v, cfg);
            let r = m.r * this.R * lobeAt(phi + this.lobePhase, m.y, cfg);
            // 個体差（軽い歪み）
            const dent =
                this.asym * Math.cos(phi - this.asymPhase) * (0.30 + 0.70 * Math.sin(Math.PI * clamp(m.y, 0, 1)))
                + this.d2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * clamp(m.y, 0, 1) * 1.3)
                + this.d3 * Math.cos(3 * phi - this.p3) * Math.sin(Math.PI * clamp(m.y, 0, 1) * 0.8);
            r *= 1 + dent;
            // 縦の溝。首と根盤では消す（実物も端では合わせ目が見えない）
            if (this.flutes.length) {
                const band = smooth(0.08, 0.26, v) * smooth(0.96, 0.72, v);
                r *= 1 - cfg.fluteAmount * band * this.fluteProfile(phi);
            }
            return Math.max(0.004, r);
        }

        // 正規化半径が target を超える最初の v（首の付け根を探すのに使う）
        vAtRadius(target) {
            for (let i = 1; i <= 240; i++) {
                const v = i / 240;
                if (meridianAt(v, this.cfg).r >= target) return v;
            }
            return 0.20;
        }

        // 根盤（底キャップ）の位置。Geo.build は centers[N-1] を頂点に使うので
        // 底は平面になる。根はここから少し内側（上）に生やす。
        basalPlate() {
            const m = meridianAt(1, this.cfg);
            return { y: m.y * this.H, r: m.r * this.R, c: this.centerAt(m.y) };
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsMeridian, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const v = i / N;
                const m = meridianAt(v, cfg);
                const c = this.centerAt(m.y);
                rings.push(Geo.ring(c, new V3(1, 0, 0), new V3(0, 0, 1), M,
                    (phi) => this.radiusAt(v, phi)));
                centers.push(c);
            }
            const mesh = Geo.build("onionBody", rings, centers, true, true, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
            this.boundParts.push(mesh);
        }

        // ---- 首（乾いてねじれた茎）-------------------------------------
        //  断面を扁平にして s とともにねじり、先端へ向けて裂けさせる。
        // 【対策】首の根元は「本体の半径が neckRadius になる高さ」から
        //         始めて、さらに少し下に埋める。固定の高さから生やすと
        //         品種で肩の形が変わったときに継ぎ目が浮く。
        _buildNeck(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.neckSegments, M = cfg.neckSides;
            const vB = this.vAtRadius(cfg.neckRadius);
            const mB = meridianAt(vB, cfg);
            const ctr = this.centerAt(mB.y);
            const base = mB.r * this.R;
            const y0 = mB.y * this.H - this.R * 0.06;      // 少し本体に埋める
            const L = this.R * cfg.neckLength * rng.range(0.80, 1.30) + this.R * 0.06;

            const tiltA = rng.range(0, Math.PI * 2);
            const tilt = cfg.neckTiltDeg * Math.PI / 180 * rng.range(0.3, 1.6);
            const twist = cfg.neckTwist * rng.range(0.6, 1.5) * (rng.next() < 0.5 ? -1 : 1);
            const flat = cfg.neckFlat * rng.range(0.7, 1.35);
            const tearPh = rng.range(0, Math.PI * 2);

            const rings = [], centers = [];
            for (let k = 0; k <= K; k++) {
                const s = k / K;
                const y = y0 + L * s;
                const lean = Math.tan(tilt) * L * 0.95 * s * s;
                const cpos = new V3(
                    ctr.x + Math.cos(tiltA) * lean,
                    y,
                    ctr.z + Math.sin(tiltA) * lean
                );
                const rr = Math.max(base * 0.05, base * Math.pow(Math.max(0, 1 - s), cfg.neckTaper));
                const tear = Math.pow(s, 2.3) * cfg.neckRagged;
                rings.push(Geo.ring(cpos, new V3(1, 0, 0), new V3(0, 0, 1), M, (phi) => {
                    const a = phi + twist * s;
                    let k2 = 1 + flat * Math.cos(2 * a)
                        + 0.13 * Math.cos(3 * a + 1.2)
                        + 0.07 * Math.cos(5 * a + 2.5);
                    // 先端の裂け（乾いた首がほつれて割れる）
                    k2 *= 1 - tear * (0.55 + 0.45 * Math.cos(3 * a + tearPh));
                    return Math.max(0.003, rr * k2);
                }));
                centers.push(cpos);
            }

            const mesh = Geo.build("onionNeck", rings, centers, false, true, this.scene);
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const uv = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            const col = new Float32Array((pos.length / 3) * 4);
            const cA = new BABYLON.Color3(cfg.neckCol[0], cfg.neckCol[1], cfg.neckCol[2]).toLinearSpace();
            const cB = new BABYLON.Color3(cfg.neckTip[0], cfg.neckTip[1], cfg.neckTip[2]).toLinearSpace();
            for (let i = 0, c = 0; i < pos.length / 3; i++, c += 4) {
                const t = uv ? uv[i * 2 + 1] : 0;
                const u = uv ? uv[i * 2] : 0;
                const w = smooth(0.05, 0.85, t);
                const g = 0.90 + 0.18 * TextureLab.fbm(u * 14, t * 5, 14, 771, 2);
                col[c] = mix(cA.r, cB.r, w) * g;
                col[c + 1] = mix(cA.g, cB.g, w) * g;
                col[c + 2] = mix(cA.b, cB.b, w) * g;
                col[c + 3] = 1;
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
            mesh.hasVertexAlpha = false;
            mesh.material = skin.neck;
            mesh.receiveShadows = true;
            this.neck = mesh;
            this.parts.push(mesh);
            this.boundParts.push(mesh);
        }

        // ---- 根 -------------------------------------------------------
        //  細い管を rootCount 本ぶん、1枚のメッシュに直接焼く。
        // 【対策1】1本1メッシュにして MergeMeshes すると、品種切り替えの
        //          たびに数十メッシュの生成→破棄が走って引っかかる。
        // 【対策2】真下に伸ばすと地面を突き抜ける。実物も外へ這って潰れて
        //          いるので、下向き成分を len の 0.18 倍に抑えて横へ広げる。
        _buildRoots(skin) {
            const cfg = this.cfg, rng = this.rng;
            const n = (cfg.showRoots ? (cfg.rootCount | 0) : 0);
            if (!n) return;
            const K = cfg.rootSegments, M = cfg.rootSides;
            const per = (K + 1) * (M + 1);
            const nv = n * per;
            const positions = new Float32Array(nv * 3);
            const uvs = new Float32Array(nv * 2);
            const colors = new Float32Array(nv * 4);
            const indices = [];
            const plate = this.basalPlate();
            const cA = new BABYLON.Color3(cfg.basalCol[0], cfg.basalCol[1], cfg.basalCol[2]).toLinearSpace();
            const cB = new BABYLON.Color3(cfg.rootCol[0], cfg.rootCol[1], cfg.rootCol[2]).toLinearSpace();

            let p = 0, q = 0, c = 0;
            for (let s = 0; s < n; s++) {
                const ang0 = (s / n) * Math.PI * 2 + rng.range(-0.38, 0.38);
                const rho0 = this.R * cfg.basalRadius * Math.sqrt(rng.next()) * 0.92;
                const len = this.R * cfg.rootLength * rng.range(0.45, 1.55);
                const spread = rng.range(0.55, 1.20);
                const curl = cfg.rootCurl * rng.range(-1, 1);
                const thick = rng.range(0.65, 1.45);
                const y0 = plate.y + this.R * 0.020;      // 根盤より内側（上）から

                const pts = [];
                for (let k = 0; k <= K; k++) {
                    const t = k / K;
                    const rad = rho0 + len * spread * Math.pow(t, 0.8);
                    const yy = y0 - len * 0.18 * Math.pow(t, 1.3);
                    const ang = ang0 + curl * t * t;
                    pts.push(new V3(
                        plate.c.x + Math.cos(ang) * rad,
                        yy,
                        plate.c.z + Math.sin(ang) * rad));
                }

                const o = s * per;
                for (let k = 0; k <= K; k++) {
                    const t = k / K;
                    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(K, k + 1)];
                    let T = b.subtract(a);
                    const tl = T.length() || 1; T = T.scale(1 / tl);
                    const ref = Math.abs(T.y) > 0.92 ? new V3(1, 0, 0) : new V3(0, 1, 0);
                    let Nv = V3.Cross(T, ref);
                    const nl = Nv.length() || 1; Nv = Nv.scale(1 / nl);
                    const Bv = V3.Cross(T, Nv);
                    const rr = Math.max(0.0008,
                        cfg.rootRadius * this.R * thick * Math.pow(Math.max(0, 1 - t), 0.65));
                    for (let j = 0; j <= M; j++) {
                        const ph = j / M * Math.PI * 2;
                        const ca = Math.cos(ph), sa = Math.sin(ph);
                        positions[p++] = pts[k].x + (Nv.x * ca + Bv.x * sa) * rr;
                        positions[p++] = pts[k].y + (Nv.y * ca + Bv.y * sa) * rr;
                        positions[p++] = pts[k].z + (Nv.z * ca + Bv.z * sa) * rr;
                        uvs[q++] = j / M; uvs[q++] = t;
                        const g = 0.85 + 0.28 * TextureLab.fbm(s * 3.1, t * 6, 8, 313, 2);
                        colors[c] = mix(cA.r, cB.r, t) * g;
                        colors[c + 1] = mix(cA.g, cB.g, t) * g;
                        colors[c + 2] = mix(cA.b, cB.b, t) * g;
                        colors[c + 3] = 1; c += 4;
                    }
                }
                for (let k = 0; k < K; k++) {
                    for (let j = 0; j < M; j++) {
                        const i0 = o + k * (M + 1) + j, i1 = i0 + 1, i2 = i0 + (M + 1), i3 = i2 + 1;
                        indices.push(i0, i2, i1, i1, i2, i3);
                    }
                }
            }

            const mesh = new BABYLON.Mesh("onionRoots", this.scene);
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
            mesh.material = skin.root;
            mesh.receiveShadows = true;
            this.roots = mesh;
            this.parts.push(mesh);   // boundParts には入れない（接地は本体で取る）
        }

        // ---- めくれた薄皮 ----------------------------------------------
        //  肩に付け根を持ち、首の方へ伸びて先が反り返る1枚板。
        // 【対策】付け根（tb=0）は本体の表面ぴったりに置き、外向きに
        //         R*0.004 だけ浮かせる。同一面に置くと z-fighting でちらつく。
        _buildFlakes(skin) {
            const cfg = this.cfg, rng = this.rng;
            const n = (cfg.showFlakes ? (cfg.flakeCount | 0) : 0);
            if (!n) return;
            const A = cfg.flakeCols, B = cfg.flakeRows;
            const per = (A + 1) * (B + 1);
            const nv = n * per;
            const positions = new Float32Array(nv * 3);
            const uvs = new Float32Array(nv * 2);
            const colors = new Float32Array(nv * 4);
            const indices = [];
            const cA = new BABYLON.Color3(cfg.ground[0], cfg.ground[1], cfg.ground[2]).toLinearSpace();
            const cB = new BABYLON.Color3(cfg.flakeCol[0], cfg.flakeCol[1], cfg.flakeCol[2]).toLinearSpace();

            let p = 0, q = 0, c = 0;
            for (let f = 0; f < n; f++) {
                const phi0 = rng.range(0, Math.PI * 2);
                const vRoot = rng.range(0.16, 0.32);
                const vTip = Math.max(0.02, vRoot - rng.range(0.10, 0.20));
                const halfPhi = cfg.flakeSize * rng.range(0.70, 1.35);
                const lift = this.R * cfg.flakeLift * rng.range(0.6, 1.6);
                const jagPh = rng.range(0, Math.PI * 2);
                const o = f * per;

                for (let b = 0; b <= B; b++) {
                    const tb = b / B;
                    for (let a = 0; a <= A; a++) {
                        const ta = a / A;
                        // 幅の端ほど短く、さらにギザギザに（破れた縁）
                        const edgeK = Math.pow(Math.max(0, 1 - Math.abs(ta - 0.5) * 2), 0.55);
                        const jag = 0.78 + 0.22 * Math.sin(ta * 21.7 + jagPh);
                        const phi = phi0 + (ta - 0.5) * halfPhi * 2;
                        const vv = clamp(mix(vRoot, vTip, tb * edgeK * jag), 0.004, 0.98);
                        const m = meridianAt(vv, cfg);
                        const rr = this.radiusAt(vv, phi);
                        const ctr = this.centerAt(m.y);
                        const out = this.R * 0.004 + tb * tb * lift * 0.60;
                        const up = tb * tb * lift * 0.55;
                        positions[p++] = ctr.x + Math.cos(phi) * (rr + out);
                        positions[p++] = m.y * this.H + up;
                        positions[p++] = ctr.z + Math.sin(phi) * (rr + out);
                        uvs[q++] = ta * 2.0; uvs[q++] = tb;
                        const g = 0.86 + 0.26 * TextureLab.fbm(ta * 6, tb * 4, 6, 191, 2);
                        const w = smooth(0.05, 0.90, tb);
                        colors[c] = mix(cA.r, cB.r, w) * g;
                        colors[c + 1] = mix(cA.g, cB.g, w) * g;
                        colors[c + 2] = mix(cA.b, cB.b, w) * g;
                        colors[c + 3] = 1; c += 4;
                    }
                }
                for (let b = 0; b < B; b++) {
                    for (let a = 0; a < A; a++) {
                        const i0 = o + b * (A + 1) + a, i1 = i0 + 1, i2 = i0 + (A + 1), i3 = i2 + 1;
                        indices.push(i0, i2, i1, i1, i2, i3);
                    }
                }
            }

            const mesh = new BABYLON.Mesh("onionFlakes", this.scene);
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
            mesh.material = skin.flake;
            mesh.receiveShadows = true;
            this.flakes = mesh;
            this.parts.push(mesh);
            this.boundParts.push(mesh);
        }

        // 接地には根を含めない。含めると根の先で浮いて、地面との間に
        // 不自然な隙間ができる（実物の根は潰れて地面に沿う）
        bounds() {
            let o = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
            for (const m of this.boundParts) {
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
            this.boundParts.length = 0;
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
    scene.environmentIntensity = 0.95;
    scene.createDefaultSkybox(env, true, 1000, 0.72, false);

    const camera = new BABYLON.ArcRotateCamera("cam", -1.05, 1.15, 22, new V3(0, 0, 0), scene);
    camera.attachControl(true);
    camera.wheelPrecision = 12;
    camera.minZ = 0.05;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 120;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.55, -0.95, 0.45).normalize(), scene);
    key.position = new V3(14, 24, -12);
    key.intensity = 2.2;
    key.diffuse = new BABYLON.Color3(1.0, 0.97, 0.93);
    key.specular = new BABYLON.Color3(0.42, 0.41, 0.39);
    // 【対策】影用フラスタムを固定サイズにする。
    //         自動計算（autoUpdateExtends）は影を落とすメッシュ＝玉ねぎだけに
    //         合わせるため、地面の大半がシャドウマップの外に出る。Babylon の
    //         PCF は UV の xy 範囲外を判定していないので、クランプされた端の
    //         テクセルが引き伸ばされて直線状の影になる（かまぼこ型に見える）。
    //         サイズは build() で個体の大きさに合わせて更新する。
    key.autoCalcShadowZBounds = false;
    key.shadowFrustumSize = 26;
    key.shadowMinZ = 14;
    key.shadowMaxZ = 50;

    const rim = new BABYLON.DirectionalLight("rim", new V3(0.5, -0.3, -1.0).normalize(), scene);
    rim.intensity = 1.35;
    rim.diffuse = new BABYLON.Color3(1.0, 0.94, 0.88);
    rim.specular = new BABYLON.Color3(0.22, 0.21, 0.20);

    const fill = new BABYLON.HemisphericLight("fill", new V3(0, 1, 0), scene);
    fill.intensity = 0.34;
    fill.diffuse = new BABYLON.Color3(0.96, 0.96, 1.0);
    fill.groundColor = new BABYLON.Color3(0.30, 0.27, 0.23);
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
    ip.contrast = 1.06;
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
        if (state) { state.onion.dispose(); state = null; }
        const cfg = buildConfig(varietyKey, seed);

        let skin = skinCache[varietyKey];
        if (!skin) { skin = new SkinFactory(scene, cfg); skinCache[varietyKey] = skin; }

        const onion = new Onion(scene, cfg, cfg.seed, skin);
        state = { cfg, skin, onion };

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const m of onion.parts) sg.addShadowCaster(m, true);

        const bb = onion.bounds();
        onion.root.position.y = -(bb.minY);          // 接地させる
        onion.root.position.x = -(bb.minX + bb.maxX) * 0.5;
        onion.root.position.z = -(bb.minZ + bb.maxZ) * 0.5;
        state.bounds = bb;

        ensureGround(-0.01);
        // 本体＋地面に落ちる影の範囲を覆う。狭いと影が直線で切れ、
        // 広すぎるとシャドウマップの解像度を無駄に使う
        key.shadowFrustumSize = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 3.2;
        camera.target.set(0, (bb.maxY - bb.minY) * 0.44, 0);
        camera.radius = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 2.7;
        if (ssao) ssao.radius = cfg.radius * 0.40;
        if (onRebuilt) onRebuilt(state);

        console.log("[Onion]", cfg.label, "/ seed =", cfg.seed,
            "/ fibers =", skin.fiberCount,
            "/ flutes =", onion.flutes.length,
            "/ roots =", cfg.rootCount,
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
    dp.sharpen.edgeAmount = 0.12;
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
        idle: "#2b2620", active: "#b8862a", edge: "#4a4036",
        text: "#f6efe6", sub: "#bdae9c", accent: "#e8c07a"
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

    addLabel("ONION", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    let curVariety = START_VARIETY, curSeed = START_SEED;
    const varietyButtons = {};
    function highlight() {
        for (const k in varietyButtons) varietyButtons[k].background = (k === curVariety) ? COL.active : COL.idle;
    }
    for (const vkey of Object.keys(PRESETS)) {
        varietyButtons[vkey] = addButton("v_" + vkey, PRESETS[vkey].label, () => {
            curVariety = vkey; build(curVariety, curSeed); highlight();
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
        info.text = "径 " + w.toFixed(1) + "cm / 高さ " + h.toFixed(1) + "cm\n縦横比 "
            + (h / w).toFixed(2) + " / 繊維 " + st.skin.fiberCount + "本\nseed: " + st.cfg.seed;
    };
    onRebuilt(state);
    highlight();

    return scene;
};

export default createScene;