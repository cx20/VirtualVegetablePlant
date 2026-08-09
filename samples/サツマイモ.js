// =====================================================================
//  Photoreal Sweet Potato  /  写実的なサツマイモ      BUILD: imo-C
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  imo-B からの変更点（ジャガイモ版で判明した不具合の水平展開）:
//    ・影を PCF に変えた。指数シャドウマップ（ESM）は深度を指数関数で
//      近似するので、ぼかすと影がキャスター自身の明るい面へにじむ。
//      丸みのある物体では曲線で縁取られた楕円の暗い領域になり、皮の痣と
//      見分けがつかない。ここは blurKernel が 40 とさらに大きかった
//    ・forceBackFacesOnly を有効にした。閉じたメッシュなら裏面だけを
//      シャドウマップへ描けば自己遮蔽が原理的に起きない
//    ・肌のテクスチャに異方性フィルタを設定。先端では u 方向が極端に
//      圧縮されるので、無いと GPU が高い LOD を選んでぼやける
//    ・影の ON/OFF を GUI に出した。この種の切り分けに要る
//
//  imo-A からの変更点（実物の写真と見比べての手直し）:
//    ・根跡が「ケシの実を貼り付けた黒い点」になっていたのを、褐色に乾いた
//      浅い傷へ。色・AO・法線の3つとも弱め、粒ごとの強さを大きくばらけさせた
//    ・肌の色ムラが油絵のように大きく滲んでいたのを、細かい粒状＋縦の繊維へ。
//      濃淡の低周波はコントラストを落とし、代わりに淡褐色の擦れ跡を足した
//    ・「太いソーセージ」に見えていた形を、首（ヘタ寄りのくびれ）と肩を
//      持つ紡錘形へ。先端をより細く長く引き、個体差の幅も広げた
//    ・クリアコートを外して完全な艶消しに（実物はコルク質で粉を吹いている）
//    ・ざるを淡い竹色に戻し、被写界深度を弱めた
//
//  構成:
//    0. CONFIG      … 品種プリセット（紅あずま / 安納芋 / シルクスイート）
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Fields      … 半径プロファイル / 浅い稜 / 根跡 / かさぶた / 粉
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Imo         … 塊根
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  実物の要点（ここを外すと「紫のラグビーボール」になる）:
//    ・完全な紡錘形は工業製品。実物はくびれと膨らみが不規則に入り、
//      断面も真円ではない。まずここで「野菜かどうか」が決まる
//    ・根の跡（芽や細根が出ていた小さな窪み）が縦の列をなして並ぶ。
//      粒がランダムに散る茄子やゴーヤーとは違い、列が読めることが大事
//    ・色は一様な紅ではない。縦に伸びた淡い条、白っぽく粉を吹いた斑、
//      褐色のかさぶたが同じ1本の上に混在する
//    ・表面は艶消し。きゅうりのようなクリアコートを乗せると「洗って
//      濡れた芋」になる。艶は粗さの分布だけで作る
//    ・ヘタ側は切り口で淡いベージュ、先端は細く褐色に枯れる
//    ・中身が詰まっているので、縁の透過（サブサーフェス）はほぼ効かない
//
//  法線マップについて（きゅうり版・ゴーヤー版と同じ落とし穴）:
//    ・高さ場から法線を焼くとき、v 方向は (yd - yu) にすること。
//      (yu - yd) は「V が上を向く」OpenGL 系の規約で、Babylon の接空間は
//      V が下向き。混ぜると u方向は正・v方向は逆というねじれた法線になり、
//      窪みが膨らんで見えたりその逆になったりする
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        beniazuma: {
            label: "紅あずま",
            length: 18.0, radius: 2.30,
            fullness: 1.00,
            headBlunt: 0.30,                    // 0=ヘタ側も尖る / 1=丸い
            bendA: 0.042, bendB: 0.016,
            // くびれと膨らみ
            // 【対策】ここが 0 だと、どれだけ肌を作り込んでも紡錘形の
            //         プラスチックにしか見えない。太さのうねりが最優先
            lumpAmp: 0.135, lumpFreq: 2.6,
            neckChance: 0.55, neckDepth: 0.115,
            asymmetry: 0.070, flatten: 0.060,
            // 浅い縦の稜
            ridgeCount: 7, ridgeAmp: 0.022, ridgeMeander: 0.020, twist: 0.5,
            // 根跡（芽の窪み）。縦の列をなす
            // 【対策】jitU を大きくすると列が崩れて「泥のはねた芋」になる。
            //         周方向のばらつきは小さく、軸方向は大きく散らす
            eyeCell: { nu: 8, nv: 15, ku: 1.14, jitU: 0.30, jitV: 0.88, r0: 0.09, r1: 0.17, seed: 131 },
            eyeDensity: 0.52, eyeDepth: 0.46, eyeRim: 0.18,
            // かさぶた（コルク化した傷）と粉
            corkAmount: 0.34, corkScale: 10,
            powderAmount: 0.38, powderScale: 9,
            // 色（sRGB）
            skinDeep: [0.470, 0.115, 0.215],    // 陰になる濃い紅
            skinMid: [0.660, 0.205, 0.315],
            skinLight: [0.790, 0.400, 0.470],   // 縦の淡い条
            skinPale: [0.830, 0.640, 0.615],    // 粉を吹いた斑（黄みのある白）
            eyeDark: [0.300, 0.150, 0.120],     // 根跡の底。黒ではない
            eyeHalo: [0.430, 0.215, 0.205],
            eyeLip: [0.680, 0.545, 0.430],      // 根跡の縁のコルク質
            cork: [0.560, 0.415, 0.300],
            cut: [0.800, 0.745, 0.585],         // ヘタ側の切り口
            tailTip: [0.360, 0.215, 0.170],
            skinRoughness: 0.70, waxIntensity: 0.0
        },
        anno: {
            label: "安納芋",
            // 短くずんぐり。両端が丸く、色は赤褐色寄りで粉が少ない
            length: 13.5, radius: 2.88,
            fullness: 1.00,
            headBlunt: 0.70,
            bendA: 0.028, bendB: 0.011,
            lumpAmp: 0.150, lumpFreq: 3.1,
            neckChance: 0.45, neckDepth: 0.095,
            asymmetry: 0.080, flatten: 0.072,
            ridgeCount: 6, ridgeAmp: 0.026, ridgeMeander: 0.026, twist: 0.4,
            eyeCell: { nu: 8, nv: 11, ku: 1.45, jitU: 0.32, jitV: 0.88, r0: 0.10, r1: 0.19, seed: 131 },
            eyeDensity: 0.58, eyeDepth: 0.54, eyeRim: 0.22,
            corkAmount: 0.44, corkScale: 9,
            powderAmount: 0.30, powderScale: 8,
            skinDeep: [0.480, 0.185, 0.170],
            skinMid: [0.665, 0.315, 0.270],
            skinLight: [0.790, 0.520, 0.445],
            skinPale: [0.840, 0.700, 0.615],
            eyeDark: [0.320, 0.175, 0.130],
            eyeHalo: [0.450, 0.255, 0.185],
            eyeLip: [0.700, 0.570, 0.440],
            cork: [0.580, 0.430, 0.305],
            cut: [0.805, 0.750, 0.590],
            tailTip: [0.375, 0.235, 0.175],
            skinRoughness: 0.74, waxIntensity: 0.0
        },
        silk: {
            label: "シルクスイート",
            // 細長くなめらか。根跡が浅く、色が明るい紅
            length: 20.0, radius: 2.10,
            fullness: 1.00,
            headBlunt: 0.22,
            bendA: 0.046, bendB: 0.018,
            lumpAmp: 0.100, lumpFreq: 2.2,
            neckChance: 0.60, neckDepth: 0.100,
            asymmetry: 0.055, flatten: 0.044,
            ridgeCount: 8, ridgeAmp: 0.016, ridgeMeander: 0.016, twist: 0.6,
            eyeCell: { nu: 9, nv: 18, ku: 1.00, jitU: 0.28, jitV: 0.88, r0: 0.08, r1: 0.15, seed: 131 },
            eyeDensity: 0.44, eyeDepth: 0.38, eyeRim: 0.14,
            corkAmount: 0.22, corkScale: 12,
            powderAmount: 0.22, powderScale: 10,
            skinDeep: [0.520, 0.100, 0.230],
            skinMid: [0.740, 0.185, 0.340],
            skinLight: [0.855, 0.380, 0.480],
            skinPale: [0.880, 0.655, 0.665],
            eyeDark: [0.320, 0.140, 0.135],
            eyeHalo: [0.460, 0.200, 0.215],
            eyeLip: [0.700, 0.540, 0.455],
            cork: [0.560, 0.400, 0.300],
            cut: [0.810, 0.750, 0.585],
            tailTip: [0.365, 0.200, 0.180],
            skinRoughness: 0.60, waxIntensity: 0.18
        }
    };

    const GLOBAL = {
        count: 5,                  // 本数

        // 籠（ざる）
        basketRim: 17.0,           // 縁の半径 cm
        basketDepth: 6.0,          // 深さ cm
        basketThick: 0.50,         // 竹ひごの厚み cm
        basketSegments: 96,
        basketRings: 34,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。ここに実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 620,
        physicsHz: 120,
        pieceMass: 1.0,
        // 【対策】芋は丸くて重い。摩擦が低いと籠の斜面をいつまでも転がって
        //         静止しない。きゅうりより高めに取る
        friction: 0.88,
        restitution: 0.02,
        linearDamping: 0.18,
        angularDamping: 0.92,
        dropInterval: 0.26,
        dropClearance: 1.8,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 5.5,

        segmentsAxis: 200,
        segmentsRound: 128,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.055,
        dofFStop: 2.8,

        // GUI
        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "beniazuma";
    const START_SEED = 20260801;
    const BUILD = "imo-C";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】肌のテクスチャは品種単位でキャッシュするので、模様の種は
        //         品種名から決めて個体乱数から切り離す。個体差は
        //         「長さ・太さ・くびれ・曲がり・断面の非対称・模様の回転」で出す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.skinSeed = (h >>> 0) % 100000;
        if (cfg.count > 3) { cfg.segmentsAxis = 168; cfg.segmentsRound = 112; }
        if (cfg.count > 5) { cfg.segmentsAxis = 136; cfg.segmentsRound = 88; }
        return cfg;
    }

    const V3 = BABYLON.Vector3;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

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
            return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
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
        // u 方向だけ折り返す（肌のUVは u が周方向、v が軸方向で継ぎ目が無い）
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
    function finalize(positions, indices, center, summed, refIndex) {
        let normals = new Float32Array(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        let dot = 0;
        if (summed) {
            for (let i = 0, n = positions.length / 3; i < n; i++) {
                dot += normals[i * 3] * (positions[i * 3] - center.x)
                    + normals[i * 3 + 1] * (positions[i * 3 + 1] - center.y)
                    + normals[i * 3 + 2] * (positions[i * 3 + 2] - center.z);
            }
        } else {
            const k = refIndex * 3;
            dot = normals[k] * (positions[k] - center.x)
                + normals[k + 1] * (positions[k + 1] - center.y)
                + normals[k + 2] * (positions[k + 2] - center.z);
        }
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
        // 【対策】頂点カラーを stride 4 で入れると hasVertexAlpha が立ち、
        //         不透明なのに透過パスへ回される。透過パスは深度書き込みが
        //         切られるので、部品どうしが互いを正しく隠せなくなる
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // リング列の掃引。両端はキャップで閉じる
    // uOff: UV の u をずらす量。模様を個体ごとに回すのに使う
    function sweep(name, rings, centers, colsFn, scene, uOff) {
        uOff = uOff || 0;
        const N = rings.length, M = rings[0].length;
        const total = N * M + 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const colors = colsFn ? new Float32Array(total * 4) : null;
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                const k = i * M + j, p = rings[i][j];
                positions[k * 3] = p.x; positions[k * 3 + 1] = p.y; positions[k * 3 + 2] = p.z;
                uvs[k * 2] = j / (M - 1) + uOff; uvs[k * 2 + 1] = i / (N - 1);
                if (colors) {
                    const c = colsFn(i / (N - 1), j / (M - 1));
                    colors[k * 4] = c[0]; colors[k * 4 + 1] = c[1]; colors[k * 4 + 2] = c[2]; colors[k * 4 + 3] = 1;
                }
            }
        }
        const capA = N * M, capB = N * M + 1;
        positions[capA * 3] = centers[0].x; positions[capA * 3 + 1] = centers[0].y; positions[capA * 3 + 2] = centers[0].z;
        positions[capB * 3] = centers[N - 1].x; positions[capB * 3 + 1] = centers[N - 1].y; positions[capB * 3 + 2] = centers[N - 1].z;
        uvs[capA * 2] = 0.5 + uOff; uvs[capA * 2 + 1] = 0;
        uvs[capB * 2] = 0.5 + uOff; uvs[capB * 2 + 1] = 1;
        if (colors) {
            const a = colsFn(0, 0.5), b = colsFn(1, 0.5);
            colors[capA * 4] = a[0]; colors[capA * 4 + 1] = a[1]; colors[capA * 4 + 2] = a[2]; colors[capA * 4 + 3] = 1;
            colors[capB * 4] = b[0]; colors[capB * 4 + 1] = b[1]; colors[capB * 4 + 2] = b[2]; colors[capB * 4 + 3] = 1;
        }
        const indices = [];
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < M - 1; j++) {
            const A = i * M + j, B = A + 1, C = A + M, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        // 【対策】両端のキャップは側面と巻き順を揃える。逆だと ComputeNormals が
        //         端のリングで外向きと内向きの面法線を足し合わせてしまい、
        //         頂点法線が裏返る
        for (let j = 0; j < M - 1; j++) indices.push(capA, j, j + 1);
        const o = (N - 1) * M;
        for (let j = 0; j < M - 1; j++) indices.push(capB, o + j + 1, o + j);

        // 【対策】判定の基準は端ではなく胴の中央。半径が最大で法線が素直に
        //         外を向いており、個体によらず安定する
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], false, refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Fields
    // =================================================================
    // [軸方向 t, 半径比]。t=0 がヘタ側（切り口）、t=1 が細い先端
    // 【対策】サツマイモは左右対称ではない。いちばん太いところが中央より
    //         ヘタ寄りにあり、先端側が長く尾を引く。ここを対称にすると
    //         ラグビーボールになる
    // 【対策】imo-A では 0.33〜0.63 がほぼ最大径のまま平らで、これが
    //         「太いソーセージ」の正体だった。頂点をひとつに絞り、
    //         そこから両端へ絶えず細っていく形にする
    const PROF_SHARP = [
        [0.000, 0.050], [0.020, 0.230], [0.050, 0.400], [0.095, 0.570],
        [0.160, 0.745], [0.240, 0.875], [0.330, 0.955], [0.430, 1.000],
        [0.520, 0.988], [0.620, 0.940], [0.710, 0.862], [0.800, 0.752],
        [0.875, 0.606], [0.935, 0.418], [0.975, 0.208], [1.000, 0.028]
    ];
    // ヘタ側が丸い版（安納芋など）
    const PROF_BLUNT = [
        [0.000, 0.170], [0.020, 0.410], [0.050, 0.590], [0.095, 0.742],
        [0.160, 0.868], [0.240, 0.940], [0.330, 0.982], [0.430, 1.000],
        [0.520, 0.992], [0.620, 0.960], [0.710, 0.900], [0.800, 0.808],
        [0.875, 0.672], [0.935, 0.478], [0.975, 0.248], [1.000, 0.042]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 【対策】制御点の1列目に t を書きながら添字を等間隔とみなして補間すると、
    //         書いた位置と実際の形が食い違う。t で区間を引いてから補間する
    function profileAt(t, blunt) {
        const A = PROF_SHARP, B = PROF_BLUNT, n = A.length;
        t = clamp(t, 0, 1);
        let i = 1;
        while (i < n - 1 && A[i][0] < t) i++;
        const t0 = A[i - 1][0], t1 = A[i][0];
        const u = (t1 > t0) ? (t - t0) / (t1 - t0) : 0;
        const i0 = Math.max(0, i - 2), i1 = i - 1, i2 = i, i3 = Math.min(n - 1, i + 1);
        const a = catmull(A[i0][1], A[i1][1], A[i2][1], A[i3][1], u);
        const b = catmull(B[i0][1], B[i1][1], B[i2][1], B[i3][1], u);
        return Math.max(0, mix(a, b, clamp(blunt, 0, 1)));
    }

    // ---- ごく浅い縦の稜 ------------------------------------------------
    // 【対策】サツマイモの稜はゴーヤーのようなリブではない。皮の下の
    //         繊維に沿ったごく浅いうねりで、ハイライトをわずかに切るだけ。
    //         振幅を上げるとカボチャになる
    function ridgeAt(u, t, cfg) {
        const wander = cfg.ridgeMeander * (Noise.fbm2u(u * 3, t * 2.2, 3, cfg.skinSeed + 61, 3) - 0.5);
        const a = 2 * Math.PI * (cfg.ridgeCount * (u + wander) + cfg.twist * t);
        const crest = 0.5 + 0.5 * Math.cos(a);
        const fade = smooth(0.0, 0.16, t) * (1 - smooth(0.82, 1.0, t));
        return crest * fade;
    }

    // ---- 根跡（芽の窪み）----------------------------------------------
    // 【対策】ジオメトリには入れない。実物の根跡は直径2〜4mm しかなく、
    //         周方向128分割（1周でも2mm弱）では角が立つだけで丸い窪みに
    //         ならない。法線マップ・AO・色の3枚で立体感を作る。
    //         こうしておくと、個体ごとに UV を回すだけで模様を変えられる
    function eyeAt(u, t, cfg) {
        const P = cfg.eyeCell, seed = cfg.skinSeed + P.seed;
        const NU = P.nu, NV = P.nv;
        const gu = u * NU, gv = t * NV;
        const cu = Math.floor(gu), cv = Math.floor(gv);
        let best = 1e9, bh = 0, bOn = 0, bR = 1, bS = 1;
        for (let dv = -1; dv <= 1; dv++) {
            for (let du = -1; du <= 1; du++) {
                const iu = cu + du, iv = cv + dv;
                let wu = iu % NU; if (wu < 0) wu += NU;
                const a1 = Noise._h2(wu, iv, seed);
                const a2 = Noise._h2(wu, iv, seed + 7717);
                const a3 = Noise._h2(wu, iv, seed + 3313);
                const px = iu + 0.5 + P.jitU * (a1 - 0.5);
                const py = iv + 0.5 + P.jitV * (a2 - 0.5);
                // 【対策】ku は「セル座標での u 方向の縮尺」。セルは周方向のほうが
                //         物理的に広い（紅あずまで u=2.0cm / v=1.17cm）ので、
                //         ku=1 のままだと横に1.7倍伸びた楕円になる。セルの縦横比より
                //         わずかに小さい値を入れると、実物と同じ「少し横長の
                //         短い裂け目」に落ち着く。0.6 のような値を入れると
                //         ミミズ腫れが並んだ芋になる
                const dx = (gu - px) * P.ku, dy = gv - py;
                const d = Math.hypot(dx, dy);
                if (d < best) {
                    best = d; bh = a3;
                    bOn = Noise._h2(wu, iv, seed + 5591);
                    bR = P.r0 + (P.r1 - P.r0) * a3;
                    // 【対策】全部の根跡を同じ濃さで出すと、規則正しい
                    //         水玉模様になる。実物は「言われないと気づかない
                    //         もの」が大半で、はっきり見えるのは数個だけ。
                    //         2乗して弱いほうへ大きく寄せる
                    bS = Noise._h2(wu, iv, seed + 4111);
                    bS = 0.30 + 0.70 * Math.pow(bS, 1.5);
                }
            }
        }
        if (bOn > cfg.eyeDensity) return { d: 0, r: 0, tip: 0 };
        // 両端では根跡が消える（切り口と枯れた先端）
        const ends = smooth(0.015, 0.065, t) * (1 - smooth(0.930, 0.985, t));
        // 中心が窪み、そのすぐ外側がわずかに盛り上がる
        const core = smooth(bR, bR * 0.15, best) * ends * bS;
        const rim = smooth(bR * 1.40, bR * 0.98, best)
            * (1 - smooth(bR * 0.98, bR * 0.58, best)) * ends * bS;
        return { d: core, r: rim, tip: bh };
    }

    // ---- かさぶた（コルク化した傷）--------------------------------------
    // 【対策】これが無いと「洗って選別済みの見本」になる。実物には必ず
    //         擦れた跡や褐色の斑がある。ただし広げすぎると腐りかけに見える
    function corkAt(u, t, cfg) {
        const n = Noise.fbm2u(u * cfg.corkScale, t * cfg.corkScale * 1.6, cfg.corkScale | 0, cfg.skinSeed + 97, 4);
        return smooth(0.62, 0.86, n) * cfg.corkAmount;
    }

    // ---- 粉（土や澱粉の白っぽい斑）--------------------------------------
    function powderAt(u, t, cfg) {
        const n = Noise.fbm2u(u * cfg.powderScale, t * cfg.powderScale * 1.4, cfg.powderScale | 0, cfg.skinSeed + 149, 4);
        return smooth(0.42, 0.78, n) * cfg.powderAmount;
    }

    // =================================================================
    // 5. TextureLab
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
            // 【対策】先端に近づくほど u 方向が圧縮される（v=0.03 では
            //         周長 4cm に 1024 テクセルで、v 方向の5倍の密度）。
            //         等方フィルタだと GPU が u 側の縮小率に合わせて高い
            //         LOD を選び、先端一帯がまとめてぼやける
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },

        // 肌の場をいちど計算して 3 枚のテクスチャで共有する
        // 【対策】アルベド・ORM・法線を別々に評価すると、書き間違いひとつで
        //         根跡の位置がずれ、「窪みの横に汚れが浮いている」絵になる
        field(size, cfg) {
            const N = size, n2 = N * N;
            const F = {
                eyeD: new Float32Array(n2),    // 根跡の窪み 0..1
                eyeR: new Float32Array(n2),    // 根跡の縁の盛り上がり
                eyeT: new Float32Array(n2),    // 根跡の個体値
                cork: new Float32Array(n2),    // かさぶた
                powder: new Float32Array(n2),  // 粉
                ridge: new Float32Array(n2),   // 浅い縦の稜（色にだけ使う）
                h: new Float32Array(n2)        // 法線マップ用の合成高さ
            };
            for (let y = 0; y < N; y++) {
                const v = y / N;
                for (let x = 0; x < N; x++) {
                    const u = x / N, i = y * N + x;
                    const E = eyeAt(u, v, cfg);
                    const ck = corkAt(u, v, cfg);
                    const pw = powderAt(u, v, cfg);
                    // 縦に伸びた繊維のしわ + 数mmのざらつき
                    // 【対策】imo-A は v 方向の周波数のほうが高く、実際には
                    //         「横縞」を作っていた。縦に流すには u を細かく、
                    //         v を粗くする。ここを取り違えると輪切りのように見える
                    const fib = Noise.fbm2u(u * 36, v * 14, 36, cfg.skinSeed + 11, 3);
                    const micro = Noise.fbm2u(u * 140, v * 140, 140, cfg.skinSeed + 23, 2);
                    F.eyeD[i] = E.d; F.eyeR[i] = E.r; F.eyeT[i] = E.tip;
                    F.cork[i] = ck; F.powder[i] = pw;
                    F.ridge[i] = ridgeAt(u, v, cfg);
                    // 【対策】稜は法線マップに入れない。ジオメトリ側で出しているので、
                    //         両方に入れると陰影が二重にかかって塗り絵になる
                    F.h[i] = clamp(
                        0.52
                        - cfg.eyeDepth * E.d
                        + cfg.eyeRim * E.r
                        + 0.20 * (fib - 0.5)
                        + 0.09 * (micro - 0.5)
                        + 0.08 * ck, 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const DP = cfg.skinDeep, MD = cfg.skinMid, LT = cfg.skinLight, PL = cfg.skinPale;
            const ED = cfg.eyeDark, EH = cfg.eyeHalo, EL = cfg.eyeLip, CK = cfg.cork;
            const CUT = cfg.cut, TIP = cfg.tailTip;
            return this._tex("imoAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i0 = y * N + x, i = i0 * 4;
                        // 【対策】一様な紅にすると紫のプラスチックになる。
                        //         濃淡は「縦に伸びた条」で入れるのが要点。
                        //         横縞や斑点で入れるとメロンや卵に見える
                        // 【対策】imo-A はこの低周波が大きすぎて、水彩で滲ませた
                        //         ような濃淡の塊になっていた。実物の紅は思ったより
                        //         均一で、変化は細かい粒と縦の筋のほうに出る
                        const band = Noise.fbm2u(u * 7, v * 3, 7, cfg.skinSeed + 31, 3);
                        let cr = mix(DP[0], MD[0], smooth(0.22, 0.78, band));
                        let cg = mix(DP[1], MD[1], smooth(0.22, 0.78, band));
                        let cb = mix(DP[2], MD[2], smooth(0.22, 0.78, band));
                        // 稜の上はわずかに明るい
                        const rib = smooth(0.55, 1.0, F.ridge[i0]) * 0.30;
                        cr = mix(cr, LT[0], rib); cg = mix(cg, LT[1], rib); cb = mix(cb, LT[2], rib);
                        // 細い縦の条
                        const streak = smooth(0.60, 0.92, Noise.fbm2u(u * 26, v * 4, 26, cfg.skinSeed + 43, 3));
                        cr = mix(cr, LT[0], streak * 0.34);
                        cg = mix(cg, LT[1], streak * 0.34);
                        cb = mix(cb, LT[2], streak * 0.34);
                        // 濃淡のムラ
                        const mott = 0.94 + 0.12 * Noise.fbm2u(u * 16, v * 7, 16, cfg.skinSeed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 粉を吹いた白っぽい斑
                        // 【対策】全面に均一にかけると色あせた作り物になる。
                        //         斑にして、しかも縁をぼかさず少し急に立ち上げる
                        const pw = F.powder[i0];
                        cr = mix(cr, PL[0], pw); cg = mix(cg, PL[1], pw); cb = mix(cb, PL[2], pw);
                        // かさぶた
                        const ck = F.cork[i0];
                        cr = mix(cr, CK[0], ck); cg = mix(cg, CK[1], ck); cb = mix(cb, CK[2], ck);
                        // 【対策】収穫して運ばれた芋には、必ず淡褐色の擦れ跡が
                        //         縦に走っている。これが無いと洗って選別した
                        //         見本写真になり、かえって嘘くさい
                        const scuff = smooth(0.70, 0.94,
                            Noise.fbm2u(u * 18, v * 3.2, 18, cfg.skinSeed + 89, 2)) * 0.28;
                        cr = mix(cr, CK[0], scuff); cg = mix(cg, CK[1], scuff); cb = mix(cb, CK[2], scuff);
                        // 根跡：黒い穴ではない。乾いた褐色の浅い傷で、
                        // 縁にコルク質の淡い輪が付く
                        // 【対策】imo-A はここを濃くしすぎて、ケシの実を貼り付けた
                        //         ように見えていた。底の暗さは控えめにして、
                        //         代わりに縁の淡い輪で「窪んでいること」を語らせる
                        const halo = smooth(0.02, 0.55, F.eyeD[i0] + F.eyeR[i0] * 0.7) * 0.26;
                        cr = mix(cr, EH[0], halo); cg = mix(cg, EH[1], halo); cb = mix(cb, EH[2], halo);
                        const core = Math.pow(smooth(0.30, 0.95, F.eyeD[i0]), 1.3)
                            * (0.36 + 0.34 * F.eyeT[i0]);
                        cr = mix(cr, ED[0], core); cg = mix(cg, ED[1], core); cb = mix(cb, ED[2], core);
                        const lip = smooth(0.22, 0.80, F.eyeR[i0]) * 0.30;
                        cr = mix(cr, EL[0], lip); cg = mix(cg, EL[1], lip); cb = mix(cb, EL[2], lip);
                        // ヘタ側の切り口と、枯れた先端
                        const cut = smooth(0.030, 0.0, v);
                        cr = mix(cr, CUT[0], cut); cg = mix(cg, CUT[1], cut); cb = mix(cb, CUT[2], cut);
                        const tail = smooth(0.955, 1.0, v);
                        cr = mix(cr, TIP[0], tail); cg = mix(cg, TIP[1], tail); cb = mix(cb, TIP[2], tail);
                        // 【対策】最後にごく細かい粒を全面へ。これが無いと、
                        //         どれだけ模様を足しても「塗った面」に見える。
                        //         振幅は数%で十分で、上げるとノイズが浮く
                        const sp = (Noise.v2u(u * 320, v * 320, 320, cfg.skinSeed + 173) - 0.5) * 0.055;
                        cr += sp; cg += sp; cb += sp;
                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // R=AO / G=roughness
        orm(scene, size, cfg, F) {
            return this._tex("imoORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i0 = y * N + x, i = i0 * 4;
                        // 【対策】サツマイモは基本的に艶消し。ここを 0.3 台まで
                        //         下げると、洗って濡れた芋か、陶器の置物になる
                        let rough = cfg.skinRoughness * (0.94 + 0.14 * Noise.fbm2u(u * 12, v * 26, 12, cfg.skinSeed + 53, 2));
                        // 粉を吹いたところは完全に艶が死ぬ
                        rough = mix(rough, 0.94, F.powder[i0] * 0.85);
                        // かさぶたは乾いて粗い
                        rough = mix(rough, 0.88, F.cork[i0] * 0.9);
                        // 【対策】逆に、擦れて磨かれた面はわずかに光る。
                        //         これが無いと全面が同じ粗さののっぺりした肌になる
                        const wipe = smooth(0.55, 0.92, Noise.fbm2u(u * 5, v * 3, 5, cfg.skinSeed + 67, 3));
                        rough = mix(rough, cfg.skinRoughness * 0.72, wipe * (1 - F.powder[i0]) * 0.7);
                        rough = mix(rough, 0.90, smooth(0.965, 1.0, v));
                        rough = mix(rough, 0.90, smooth(0.030, 0.0, v));
                        // 【対策】根跡の立体感の大半はこの陰。法線マップだけだと
                        //         正面から見たときに窪みが消えて点描になる
                        // 【対策】imo-A はここを 0.42 まで落としていて、色の濃さと
                        //         二重にかかって根跡が真っ黒な点になっていた
                        let ao = 1.0;
                        ao = mix(ao, 0.62, smooth(0.15, 0.90, F.eyeD[i0]));
                        ao = mix(ao, 0.86, F.cork[i0] * 0.5);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, F, strength) {
            const hf = F.h;
            return this._tex("imoNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 極ではUが潰れて放射状の筋になるので端を減衰させる
                    const vv = y / N;
                    const k = strength * smooth(0, 0.05, vv) * (1 - smooth(0.95, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        // 【対策】v 方向は (yd - yu)。(yu - yd) は「V が上を向く」
                        //         OpenGL 系の規約で、Babylon の接空間は V が下向き。
                        //         混ぜると u方向は正・v方向は逆というねじれた法線になり、
                        //         根跡が窪んで見えたり膨らんで見えたりが場所ごとに入れ替わる
                        let nx = (xl - xr) * k, ny = (yd - yu) * k, nz = 1;
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
        bamboo(scene, size, seed) {
            const OVER = [0.90, 0.84, 0.68], UNDER = [0.80, 0.72, 0.55], GAP = [0.52, 0.44, 0.32];
            return this._tex("basketAlbedo", size, (d, N) => {
                const SPOKE = 72, RING = 24;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * SPOKE, sv = v * RING;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.74 + 0.34 * bv) : (0.52 + 0.24 * bu);
                        const gap = smooth(0, 0.10, Math.min(fu, 1 - fu))
                            * smooth(0, 0.10, Math.min(fv, 1 - fv));
                        const fib = 0.90 + 0.20 * Noise.fbm2u(u * 260, v * 14, 260, seed, 2);
                        const age = 0.90 + 0.20 * Noise.fbm2u(u * 6, v * 5, 6, seed + 9, 3);
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
    //  マテリアル（品種ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const F = TextureLab.field(S, cfg);
            this.albedoTex = TextureLab.albedo(scene, S, cfg, F);
            this.ormTex = TextureLab.orm(scene, S, cfg, F);
            this.normalTex = TextureLab.normal(scene, S, F, 2.8);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("imoSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 1.00;
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】クリアメートを乗せるとサツマイモに見えなくなる。
            //         皮はコルク層で、光沢はごく弱い反射だけ。ここは
            //         「ほんの少し」に留め、艶の変化は ORM の粗さで作る
            this.hasClearCoat = cfg.waxIntensity > 0.01;
            m.clearCoat.isEnabled = this.hasClearCoat;
            m.clearCoat.intensity = 0.16 * cfg.waxIntensity;
            m.clearCoat.roughness = 0.55;
            m.clearCoat.indexOfRefraction = 1.42;
            // 【対策】塊根は中身が詰まっている。きゅうりのように透過させると
            //         縁が光って飴細工になる。切らずに使う
            this.hasTranslucency = false;
            m.subSurface.isTranslucencyEnabled = false;
            this.skin = m;
        }

        // 表示モード 0=通常 / 1=白クレイ（法線のみ）/ 2=法線マップそのもの
        // 【対策】法線の向きが正しいかは、アルベドと AO を外して陰影だけに
        //         するのがいちばん確実。根跡は色でも AO でも暗くしてあるので、
        //         通常表示のままでは「窪んで見える」のが法線のおかげなのか
        //         色のおかげなのか区別できない
        setDebug(mode) {
            const m = this.skin;
            const C3 = BABYLON.Color3;
            if (mode === 2) {
                m.unlit = true;
                m.disableLighting = true;
                m.albedoTexture = null;
                m.albedoColor = new C3(0, 0, 0);
                m.emissiveTexture = this.normalTex;
                m.emissiveColor = new C3(1, 1, 1);
                m.metallicTexture = null;
                m.bumpTexture = null;
                m.clearCoat.isEnabled = false;
                return;
            }
            m.unlit = false;
            m.disableLighting = false;
            m.emissiveTexture = null;
            m.emissiveColor = new C3(0, 0, 0);
            m.bumpTexture = this.normalTex;
            if (mode === 1) {
                m.albedoTexture = null;
                m.albedoColor = new C3(0.78, 0.78, 0.78);
                m.metallicTexture = null;
                m.roughness = 0.62;
                m.clearCoat.isEnabled = false;
            } else {
                m.albedoTexture = this.albedoTex;
                m.albedoColor = new C3(1, 1, 1);
                m.metallicTexture = this.ormTex;
                m.roughness = 1.0;              // 実値は ORM の G
                m.clearCoat.isEnabled = this.hasClearCoat;
            }
        }

        dispose() {
            this.skin.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Imo
    // =================================================================
    class Imo {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.86, 1.16);
            this.R = cfg.radius * rng.range(0.82, 1.10) * cfg.fullness;
            this.blunt = clamp(cfg.headBlunt + rng.gauss(0, 0.12), 0, 1);
            this.nseed = rng.int(900000) + 1000;
            this.bendA = cfg.bendA * rng.range(0.4, 1.8) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.3, 1.3);
            this.bendRoll = rng.range(0, Math.PI * 2);
            // くびれと膨らみ。個体差の主役
            this.lumpAmp = cfg.lumpAmp * rng.range(0.55, 1.55);
            this.lumpFreq = cfg.lumpFreq * rng.range(0.75, 1.35);
            this.lumpPhase = rng.range(0, 100);
            // 首：ヘタ寄りにできるくびれ。実物の半分くらいに入っていて、
            // これがあると一気に「掘ってきた芋」になる
            // 【対策】全個体に入れると今度は全部ひょうたんになる。
            //         有る／無いを個体ごとに振り、深さもばらけさせる
            this.neckDepth = (rng.next() < cfg.neckChance) ? cfg.neckDepth * rng.range(0.35, 1.0) : 0;
            this.neckAt = rng.range(0.13, 0.32);
            this.neckW = rng.range(0.055, 0.115);
            // 断面の非対称と扁平
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.3, 0.8);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            this.flat = cfg.flatten * rng.range(0.5, 1.5);
            this.flatA = rng.range(0, Math.PI * 2);
            // 【対策】模様はテクスチャ側で固定なので、個体差は UV を回して出す。
            //         wrapU が WRAP なので端数でも継ぎ目は出ない
            this.uOff = rng.next();

            this.parts = [];
            this._buildBody(skin);
            this.root = new BABYLON.TransformNode("imo", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 軸は X。曲がりは bendRoll の向きの平面内
        spineAt(t) {
            const off = this.bendA * Math.sin(Math.PI * t) + this.bendB * Math.sin(Math.PI * 2 * t);
            const d = off * this.L;
            return new V3((t - 0.5) * this.L,
                Math.cos(this.bendRoll) * d,
                Math.sin(this.bendRoll) * d);
        }
        frameAt(t) {
            const e = 1e-3;
            const a = this.spineAt(Math.max(0, t - e)), b = this.spineAt(Math.min(1, t + e));
            const T = b.subtract(a); T.normalize();
            let up = new V3(0, 0, 1);
            if (Math.abs(V3.Dot(T, up)) > 0.9) up = new V3(0, 1, 0);
            const Nv = V3.Cross(up, T); Nv.normalize();
            const B = V3.Cross(T, Nv); B.normalize();
            return { T, N: Nv, B };
        }
        // 太さのうねり。これが形のいちばん外側の個性
        // 【対策】正弦波1本だと規則的な数珠になる。ノイズを主にして、
        //         ゆっくりした波を少しだけ混ぜる
        lumpAt(t) {
            const n = Noise.fbm3(t * this.lumpFreq + this.lumpPhase, 0.37, 0.61, this.nseed + 13, 3) - 0.5;
            // 【対策】1オクターブだけだと、ゆるい紡錘形の焼き直しにしかならない。
            //         短い周期をもう1本足すと「肩」ができて、輪郭に折れが出る
            const n2 = Noise.fbm3(t * this.lumpFreq * 2.7 + this.lumpPhase, 0.83, 0.29, this.nseed + 29, 2) - 0.5;
            const w = 0.30 * Math.sin(Math.PI * 2 * this.lumpFreq * 0.6 * t + this.lumpPhase);
            // 両端では効かせない（先細りの形を壊さないため）
            const fade = smooth(0.0, 0.12, t) * (1 - smooth(0.84, 1.0, t));
            const neck = this.neckDepth * Math.exp(-Math.pow((t - this.neckAt) / this.neckW, 2));
            return (1 + this.lumpAmp * (1.55 * n + 0.75 * n2 + w) * fade) * (1 - neck);
        }
        // 断面半径の倍率。u はテクスチャと同じ座標系（phi/2π + uOff）
        sectionAt(t, uTex) {
            const cfg = this.cfg;
            const phi = uTex * Math.PI * 2;
            const ridge = cfg.ridgeAmp * (ridgeAt(uTex, t, cfg) - 0.5);
            // 低周波の非対称。これが無いと完全な回転体になり、
            // ハイライトが直線になって樹脂に見える
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            // 【対策】土の中で押されているので断面は真円ではない。
            //         わずかな扁平を入れるだけで「回転体らしさ」が抜ける
            const flat = -this.flat * Math.cos(2 * (phi - this.flatA));
            const wob = 0.020 * (Noise.fbm3(Math.cos(phi) * 2.2, Math.sin(phi) * 2.2, t * 4.5, this.nseed, 3) - 0.5);
            return 1 + ridge + asym + flat + wob;
        }
        radiusAt(t, uTex) {
            return Math.max(0.004,
                this.R * profileAt(t, this.blunt) * this.lumpAt(t) * this.sectionAt(t, uTex));
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const w = (j % M) / M;
                    const phi = w * Math.PI * 2;
                    const r = this.radiusAt(t, w + this.uOff);
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r
                    ));
                }
                rings.push(ring); centers.push(c);
            }
            const mesh = sweep("imoBody", rings, centers, null, this.scene, this.uOff);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュから凸包を取ると生成が重いので、
        // 同じ関数を粗く評価した代理メッシュから凸包を起こす
        // 【対策】でこぼこの点群をそのまま凸包にすると、ほぼ同一平面の面が
        //         大量に生まれる。積み重なった状態では接触マニフォールドが
        //         毎ステップ別の面へ飛び移り、これが震えの主因になる。
        //         稜と高周波は落とし、低周波（くびれ・非対称・扁平）だけ残す
        hullShape() {
            const N = 24, M = 18;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                        + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
                    const flat = -this.flat * Math.cos(2 * (phi - this.flatA));
                    const r = Math.max(0.004,
                        this.R * profileAt(t, this.blunt) * this.lumpAt(t) * (1 + asym + flat)) * 0.97;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("imoProxy", rings, centers, null, this.scene, 0);
            proxy.isVisible = false;
            const shape = new BABYLON.PhysicsShapeConvexHull(proxy, this.scene);
            proxy.dispose();
            return shape;
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

        dispose() {
            for (const m of this.parts) m.dispose();
            if (this.root) this.root.dispose();
            this.parts.length = 0;
        }
    }

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
            const s = i / K, pr = prof(s), nn = pn(s);
            const r = pr[0], y = pr[1], nr = nn[0], ny = nn[1];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * Math.PI * 2;
                const cs = Math.cos(phi), sn = Math.sin(phi);
                const a = i * W + j, b = LAY + a;
                positions[a * 3] = r * cs; positions[a * 3 + 1] = y; positions[a * 3 + 2] = r * sn;
                const ro = r - nr * TH, yo = y - ny * TH;
                positions[b * 3] = ro * cs; positions[b * 3 + 1] = yo; positions[b * 3 + 2] = ro * sn;
                uvs[a * 2] = j / M; uvs[a * 2 + 1] = s;
                uvs[b * 2] = j / M; uvs[b * 2 + 1] = s;
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
        const normals = finalize(positions, indices, new V3(0, DEP * 0.35, 0), false, LAY + refI * W);
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
    scene.clearColor = new BABYLON.Color4(0.93, 0.93, 0.935, 1);

    let physics = false;
    try {
        const havok = await HavokPhysics();
        // 【対策】HavokPlugin の第1引数は _useDeltaForWorldStep。
        //         true（既定）だとフレームのデルタ時間でそのまま積分するため、
        //         フレーム落ちのたびにステップ幅が変わり、接触が解けたり
        //         深く食い込んだりを繰り返して震える。false で固定ステップにする
        const hk = new BABYLON.HavokPlugin(false, havok);
        scene.enablePhysics(new V3(0, -GLOBAL.gravity, 0), hk);
        if (hk.setTimeStep) hk.setTimeStep(1 / GLOBAL.physicsHz);
        physics = true;
    } catch (err) {
        console.warn("[Imo] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.58;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.22, 58, new V3(0, 2.2, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 6;
    camera.maxZ = 300;
    camera.lowerRadiusLimit = 16;
    camera.upperRadiusLimit = 160;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.98, 0.95);
    key.specular = new BABYLON.Color3(0.42, 0.40, 0.38);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.98, 0.97, 1.0);
    fillL.specular = new BABYLON.Color3(0.16, 0.16, 0.16);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.58;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.72, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】useBlurExponentialShadowMap は深度を指数関数で近似するため、
    //         ぼかすと影がキャスター自身の明るい面へにじみ出す。丸みのある
    //         物体だと曲線で縁取られた楕円の暗い領域になり、皮の痣と
    //         見分けがつかない。PCF なら深度比較そのものなので起きない
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    // 【対策】閉じたメッシュなら裏面だけをシャドウマップへ描けばよい。
    //         こうすると自己遮蔽（シャドウアクネ）が原理的に起きず、
    //         隣の個体へ落ちる影はそのまま残る
    sg.forceBackFacesOnly = true;
    // 【対策】バイアスは正規化深度なので、シーンのスケールではなく
    //         autoCalcShadowZBounds が決めた深度域に対して効く。
    //         大きすぎると接地部の影が浮く（ピーターパン）
    sg.bias = 0.0006;
    sg.normalBias = 0.02;
    sg.darkness = 0.44;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.06;
    ip.contrast = 1.12;
    ip.vignetteEnabled = false;

    let ground = null;
    if (GLOBAL.showGround) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 240, height: 2, depth: 240 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.90, 0.905).toLinearSpace();
        gm.metallic = 0.0; gm.roughness = 0.88;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        ground.material = gm;
        ground.receiveShadows = true;
        // 器の外面とのあいだに 0.8mm のすき間を作る（深度分解能の10倍）
        ground.position.y = -1.08;
        if (physics) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    const basket = buildBasket(scene, GLOBAL);
    if (physics) {
        const bShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        bShape.material = { friction: 0.74, restitution: 0.0 };
        const bBody = new BABYLON.PhysicsBody(basket, BABYLON.PhysicsMotionType.STATIC, false, scene);
        bBody.shape = bShape;
    }

    // =================================================================
    //  生成と投入
    // =================================================================
    let items = [], curVariety = START_VARIETY, curSeed = START_SEED, curCfg = null;
    const skinCache = {};
    let onRebuilt = null;
    let queue = [], dropIndex = 0, dropTimer = 0, settleTimer = 0, postDropTimer = 0, frozen = false;

    // 表面の凹凸の強さと法線の向き。実機で見ながら合わせられるようにする
    const BUMPS = [
        { label: "弱", level: 0.55 },
        { label: "中", level: 1.00 },
        { label: "強", level: 1.50 },
        { label: "最強", level: 2.20 }
    ];
    let bumpIdx = 1, invY = false;
    function applyRelief() {
        for (const k in skinCache) {
            const m = skinCache[k].skin;
            if (m.bumpTexture) m.bumpTexture.level = BUMPS[bumpIdx].level;
            m.invertNormalMapY = invY;
        }
    }
    const DEBUGS = ["通常", "白クレイ", "法線マップ"];
    let dbgIdx = 0;
    function applyDebug() {
        for (const k in skinCache) skinCache[k].setDebug(dbgIdx);
    }

    // ---- 法線の向きを目で判定するための診断ライト --------------------
    // 【対策】既定の照明は key もヘミスフェリックも環境マップも全部「上から」で、
    //         芋はざるの中で寝ている。接空間で光を (Lu, Lv, Ln) と書くと
    //         法線の v 成分を反転したときの陰影の変化は 2*nv*Lv、つまり
    //         「光の v 成分」＝長軸方向の成分に比例する。長軸が水平なら
    //         Lv ≒ 0 で、invertNormalMapY を切り替えても絵が動かない。
    //         ほぼ真横から、長軸に沿った向きの光を当てて初めて差が見える
    const DIAGS = ["OFF", "X方向", "Z方向"];
    let diagIdx = 0;
    const LIGHT0 = {
        dir: key.direction.clone(), keyI: key.intensity,
        fillI: fillL.intensity, ambI: amb.intensity, envI: scene.environmentIntensity
    };
    function applyDiag() {
        if (diagIdx === 0) {
            key.direction = LIGHT0.dir.clone();
            key.intensity = LIGHT0.keyI;
            fillL.intensity = LIGHT0.fillI;
            amb.intensity = LIGHT0.ambI;
            scene.environmentIntensity = LIGHT0.envI;
            return;
        }
        // 水平から 12° だけ持ち上げる。真横だと上面がまったく光らない
        const a = (diagIdx === 1) ? 0 : Math.PI / 2;
        key.direction = new V3(-Math.cos(a) * 0.98, -0.21, -Math.sin(a) * 0.98).normalize();
        key.intensity = 3.2;
        // 【対策】環境光を残したまま横から当てても、上からの成分が陰影を
        //         埋めてしまって判定できない。診断中は思い切って落とす
        fillL.intensity = 0.0;
        amb.intensity = 0.10;
        scene.environmentIntensity = 0.06;
    }

    function basketInnerY(r) {
        const s = clamp(r / GLOBAL.basketRim, 0, 1);
        return GLOBAL.basketThick + GLOBAL.basketDepth * Math.pow(clamp((s - 0.50) / 0.50, 0, 1), 1.55);
    }

    // 【対策】山全体の頂点を基準にすると、外側へ置く物まで山の高さぶん
    //         持ち上げられ、籠の縁の上から落ちてくることになる。
    //         水平方向に重なっている物だけを見る
    function localTopY(x, z, rh) {
        let top = basketInnerY(Math.hypot(x, z));
        for (let i = 0; i < dropIndex; i++) {
            const b = queue[i].e.worldBounds();
            const cx = (b.mnx + b.mxx) * 0.5, cz = (b.mnz + b.mxz) * 0.5;
            const ex = (b.mxx - b.mnx) * 0.5, ez = (b.mxz - b.mnz) * 0.5;
            if (Math.hypot(x - cx, z - cz) < rh + Math.max(ex, ez)) top = Math.max(top, b.mxy);
        }
        return top;
    }

    function clearBodies() {
        for (const it of queue) {
            if (it.body) it.body.dispose();
            if (it.shape) it.shape.dispose();
        }
        queue = []; dropIndex = 0; dropTimer = 0;
        settleTimer = 0; postDropTimer = 0; frozen = false;
    }

    // 【対策】全部を同時に生成すると、初期状態で互いにめり込んでいるぶんの
    //         反発が一気に解放されて弾け飛ぶ。1本ずつ、山の頂点のすぐ上から放す
    function spawnNext() {
        const it = queue[dropIndex], e = it.e;
        e.root.setEnabled(true);
        e.root.position.set(it.x, 0, it.z);
        e.root.computeWorldMatrix(true);
        const b = e.worldBounds();
        const bottomOffset = b.mny;
        const rh = Math.max(b.mxx - b.mnx, b.mxz - b.mnz) * 0.5;
        e.root.position.y = localTopY(it.x, it.z, rh) + GLOBAL.dropClearance - bottomOffset;
        e.root.computeWorldMatrix(true);

        const shape = e.hullShape();
        shape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
        const body = new BABYLON.PhysicsBody(e.root, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        body.shape = shape;
        body.setMassProperties({ mass: GLOBAL.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションに書いても効かない
        body.setLinearDamping(GLOBAL.linearDamping);
        body.setAngularDamping(GLOBAL.angularDamping);
        // 【対策】毎フレーム「ノードの姿勢 → 物理ボディ」へ書き戻すと、
        //         物理が出した結果を読み直して押し込む往復が起きる
        body.disablePreStep = true;
        it.shape = shape; it.body = body;
        dropIndex++;
    }

    function resetDrop(seed) {
        clearBodies();
        const rng = new Rng(seed >>> 0);
        const a0 = rng.range(0, Math.PI * 2);
        for (let i = 0; i < items.length; i++) {
            const e = items[i];
            // 【対策】物理で動かすノードは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                rng.gauss(0, 0.40), rng.range(0, Math.PI * 2), rng.gauss(0, 0.40));
            const r = GLOBAL.basketRim * 0.40 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            for (let i = 0; i < items.length; i++) {
                items[i].root.position.set(
                    0, GLOBAL.basketThick + items[i].R,
                    (i - (items.length - 1) / 2) * items[i].R * 2.6);
            }
        }
        if (onRebuilt) onRebuilt();
    }

    function build(varietyKey, seed) {
        clearBodies();
        for (const it of items) it.dispose();
        items = [];
        const cfg = buildConfig(varietyKey, seed);
        curCfg = cfg;

        // テクスチャは品種だけで決まる。個体差で焼き直すと GUI 操作のたびに固まる
        let skin = skinCache[varietyKey];
        if (!skin) { skin = new Skin(scene, cfg); skinCache[varietyKey] = skin; }

        for (let i = 0; i < cfg.count; i++) {
            items.push(new Imo(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.35, 0);
        camera.radius = cfg.basketRim * 3.4;

        applyDebug();
        applyRelief();
        resetDrop(seed);
        console.log("[Imo]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "本");
    }

    build(START_VARIETY, START_SEED);

    scene.onBeforeRenderObservable.add(() => {
        if (!physics || frozen || queue.length === 0) return;
        const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
        if (dropIndex < queue.length) {
            dropTimer += dt;
            if (dropTimer >= GLOBAL.dropInterval) {
                dropTimer = 0; spawnNext();
                if (onRebuilt) onRebuilt();
            }
            return;
        }
        if (!GLOBAL.freezeWhenSettled) return;
        postDropTimer += dt;
        // 【対策】静止後もソルバの残差で微振動が続く。速度がしきい値を
        //         下回った状態が続いたら STATIC に固定して止める
        let moving = false;
        for (const it of queue) {
            if (!it.body) continue;
            if (it.body.getLinearVelocity().length() > GLOBAL.settleSpeed ||
                it.body.getAngularVelocity().length() > GLOBAL.settleSpin) { moving = true; break; }
        }
        settleTimer = moving ? 0 : settleTimer + dt;
        if (settleTimer > GLOBAL.settleHold || postDropTimer > GLOBAL.settleTimeout) {
            for (const it of queue) if (it.body) it.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
            frozen = true;
            if (onRebuilt) onRebuilt();
        }
    });

    if (GLOBAL.useSSAO) {
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        ssao.radius = 1.1;
        ssao.totalStrength = 0.90;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 200;
        ssao.minZAspect = 0.3;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.98;
    dp.bloomWeight = 0.06;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.18;
    // 【対策】Babylon の錯乱円は「シーン単位 × 1000 = mm」で計算される。
    //         focalLength を focusDistance の一定比率 K にすると focus が
    //         約分され、cocPre = (lensSize / fStop) * K / (1 - K) となって
    //         カメラを寄せても引いてもボケ量が変わらない
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
    // 【対策】フルスクリーンGUIは既定でシーンと同じカメラで合成されるため、
    //         Bloom / 被写界深度 / シャープンがUIにも乗ってボケる。
    //         GUI専用カメラを layerMask で分離する
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#2a121d", active: "#7a2647", edge: "#4a2432",
        text: "#f6e9ee", sub: "#c2a1ad", accent: "#e58aa8"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "238px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(20,8,13,0.84)";
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

    addLabel("SATSUMAIMO", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    const varietyBtns = {}, countBtns = {};
    function highlight() {
        for (const k in varietyBtns) varietyBtns[k].background = (k === curVariety) ? COL.active : COL.idle;
        for (const k in countBtns) countBtns[k].background = (+k === GLOBAL.count) ? COL.active : COL.idle;
    }
    for (const k of Object.keys(PRESETS)) {
        varietyBtns[k] = addButton("v_" + k, PRESETS[k].label, () => {
            curVariety = k; build(curVariety, curSeed); highlight();
        });
    }

    addLabel("本数", 13, COL.accent, "26px");
    for (const c of [3, 5, 8]) {
        countBtns[c] = addButton("c" + c, c + " 本", () => {
            GLOBAL.count = c; build(curVariety, curSeed); highlight();
        });
    }

    const sp = new BABYLON.GUI.Rectangle();
    sp.height = "8px"; sp.thickness = 0; sp.background = "";
    panel.addControl(sp);

    addButton("drop", "落とし直す", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        resetDrop(curSeed);
    });
    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed); highlight();
    });
    const dbgBtn = addButton("dbg", "表示: 通常", () => {
        dbgIdx = (dbgIdx + 1) % DEBUGS.length;
        applyDebug(); applyRelief();
        dbgBtn.background = dbgIdx ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "表示: " + DEBUGS[dbgIdx];
    });
    const bumpBtn = addButton("bump", "表面の凹凸: 中", () => {
        bumpIdx = (bumpIdx + 1) % BUMPS.length;
        applyRelief();
        bumpBtn.textBlock.text = "表面の凹凸: " + BUMPS[bumpIdx].label;
    });
    const invBtn = addButton("inv", "凹凸の向き: 標準", () => {
        invY = !invY;
        applyRelief();
        invBtn.background = invY ? COL.active : COL.idle;
        invBtn.textBlock.text = "凹凸の向き: " + (invY ? "反転" : "標準");
    });
    // 【対策】影が原因かどうかは、影だけ切って確かめるのがいちばん速い。
    //         key ライトごと消すと拡散光まで変わって判断がつかない
    let shadowOn = true;
    const shadowBtn = addButton("shadow", "影: ON", () => {
        shadowOn = !shadowOn;
        key.shadowEnabled = shadowOn;
        shadowBtn.background = shadowOn ? COL.active : COL.idle;
        shadowBtn.textBlock.text = "影: " + (shadowOn ? "ON" : "OFF");
    });
    shadowBtn.background = COL.active;
    const diagBtn = addButton("diag", "診断ライト: OFF", () => {
        diagIdx = (diagIdx + 1) % DIAGS.length;
        applyDiag();
        diagBtn.background = diagIdx ? COL.active : COL.idle;
        diagBtn.textBlock.text = "診断ライト: " + DIAGS[diagIdx];
    });
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

    const info = addLabel("", 12, COL.sub, "44px");
    onRebuilt = () => {
        if (!info) return;
        const e = items[0];
        if (!e) { info.text = ""; return; }
        const state = !physics ? "物理なし"
            : (dropIndex < queue.length ? "投入中 " + dropIndex + "/" + queue.length
                : (frozen ? "静止" : "落下中"));
        info.text = state + " / " + items.length + "本 / 全長 " + e.L.toFixed(1)
            + "cm 径 " + (e.R * 2).toFixed(1) + "cm\nseed: " + curSeed + "  [" + BUILD + "]";
    };
    onRebuilt();

    // ---- GUI の開閉（スマホでは初期状態で畳む）-----------------------
    // 【対策】Babylon.GUI のサイズ指定はレンダー解像度基準（≒ CSS px × DPR）。
    //         DPR 3 の端末では 34px のボタンが実質 11 CSS px になる。
    //         畳むだけでなく、開いたときは実効DPRぶん拡大して押せる大きさに戻す
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
    toggleBtn.background = "rgba(20,8,13,0.84)";
    toggleBtn.fontSize = 20;
    if (toggleBtn.textBlock) toggleBtn.textBlock.color = COL.text;
    toggleBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    toggleBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    toggleBtn.left = "16px"; toggleBtn.top = "16px";
    ui.addControl(toggleBtn);

    let panelOpen = !isCompact();
    function applyGuiLayout() {
        // scaleX/Y は既定で中心基準。transformCenter を左上にしないと画面外へずれる
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(20,8,13,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;