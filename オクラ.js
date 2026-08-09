// =====================================================================
//  Photoreal Okra  /  写実的なオクラ
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（五角 / 島 / 紅）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Fields      … 半径プロファイル / 角ばった断面 / 縦条 / 産毛
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Okra        … 莢 + ヘタ（円錐形のカラー）
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  ゴーヤー版からの主な変更点（ここを外すと「細いゴーヤー」になる）:
//    ・表面にイボが無い。代わりに「丸めた正五角形の断面」と「産毛」が主役
//    ・断面は面の中央が平ら〜わずかに凹み、稜だけが立つ。ここが最大の特徴
//    ・胴は紡錘形ではない。付け根が最も太く、先端へ向かって一様に細る円錐
//    ・ヘタは短い果柄ではなく、莢と同じ太さから立ち上がる円錐形のカラー。
//      先端に淡い切り口があり、根元に一段細い襟がある
//    ・産毛のせいで、艶は鏡面ではなく布のような柔らかい照り返しになる。
//      PBRMaterial の sheen がこの用途そのもの
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        gokaku: {
            label: "五角オクラ",
            length: 8.4, radius: 0.88,
            fullness: 1.00,
            tipBlunt: 0.10,                     // 0=先が尖る / 1=先が丸い
            bendA: 0.018, bendB: 0.007,
            // 断面
            // 【対策】ridgeCount と segmentsRound を約数関係にしないと、
            //         稜の稜線が頂点の谷間に落ちて丸まり、せっかくの
            //         五角形が「細いきゅうり」に見える
            ridgeCount: 5,
            facetDepth: 0.185,                  // 面の中央がどれだけ凹むか
            facetPower: 2.6,                    // 大きいほど面が平ら〜凹に
            ridgeRound: 0.30,                   // 稜の丸め幅
            twist: 0.03,
            asymmetry: 0.020,
            // 表面
            striaU: 60, striaSharp: 3.6, striaAmt: 0.13,   // 細い縦条
            fuzzU: 250, fuzzV: 400, fuzzAmt: 0.55,         // 産毛
            blemish: 0.55,
            // 色（sRGB）
            podDark: [0.205, 0.360, 0.125],     // 面の中央・陰
            podMid: [0.320, 0.520, 0.190],
            podRidge: [0.520, 0.690, 0.320],    // 稜の稜線だけ
            podTip: [0.375, 0.575, 0.225],
            stria: [0.400, 0.585, 0.235],
            fuzzCol: [0.630, 0.745, 0.480],     // 産毛の照り
            scar: [0.330, 0.290, 0.135],
            calyx: [0.185, 0.355, 0.108], calyxCut: [0.755, 0.750, 0.555],
            calyxLen: 0.185, calyxTop: 0.45, calyxFlare: 1.02,
            skinRoughness: 0.62, sheenAmt: 0.55, sheenCol: [0.72, 0.80, 0.55]
        },
        shima: {
            label: "島オクラ（丸莢）",
            // 沖縄の丸オクラ。稜がほとんど立たず、長く育てても硬くならない
            length: 12.0, radius: 1.05,
            fullness: 1.00,
            tipBlunt: 0.72,
            bendA: 0.026, bendB: 0.010,
            ridgeCount: 8,
            facetDepth: 0.062,
            facetPower: 2.0,
            ridgeRound: 0.55,
            twist: 0.05,
            asymmetry: 0.024,
            striaU: 64, striaSharp: 3.0, striaAmt: 0.11,
            fuzzU: 230, fuzzV: 430, fuzzAmt: 0.50,
            blemish: 0.50,
            podDark: [0.170, 0.315, 0.100],
            podMid: [0.278, 0.470, 0.160],
            podRidge: [0.470, 0.640, 0.280],
            podTip: [0.330, 0.525, 0.195],
            stria: [0.355, 0.535, 0.205],
            fuzzCol: [0.580, 0.700, 0.440],
            scar: [0.310, 0.270, 0.125],
            calyx: [0.160, 0.320, 0.095], calyxCut: [0.740, 0.735, 0.540],
            calyxLen: 0.150, calyxTop: 0.48, calyxFlare: 1.02,
            skinRoughness: 0.58, sheenAmt: 0.45, sheenCol: [0.68, 0.78, 0.52]
        },
        beni: {
            label: "紅オクラ",
            length: 9.2, radius: 0.92,
            fullness: 1.00,
            tipBlunt: 0.14,
            bendA: 0.020, bendB: 0.008,
            ridgeCount: 5,
            facetDepth: 0.195,
            facetPower: 2.8,
            ridgeRound: 0.26,
            twist: 0.03,
            asymmetry: 0.022,
            striaU: 60, striaSharp: 3.8, striaAmt: 0.16,
            fuzzU: 250, fuzzV: 400, fuzzAmt: 0.58,
            blemish: 0.60,
            // 【対策】紅オクラは色を赤く塗り替えるだけでは黒ずむ。
            //         赤紫はアルベドが低いので、稜と産毛の照りを緑品種より
            //         はっきり上げないと形が読めなくなる
            podDark: [0.300, 0.062, 0.105],
            podMid: [0.415, 0.098, 0.150],
            podRidge: [0.205, 0.040, 0.075],    // 稜は暗い線
            podTip: [0.370, 0.085, 0.130],
            stria: [0.470, 0.130, 0.175],
            fuzzCol: [0.720, 0.520, 0.520],
            scar: [0.260, 0.150, 0.100],
            calyx: [0.310, 0.075, 0.115], calyxCut: [0.600, 0.700, 0.430],
            calyxLen: 0.180, calyxTop: 0.45, calyxFlare: 1.02,
            skinRoughness: 0.60, sheenAmt: 0.68, sheenCol: [0.80, 0.70, 0.60]
        }
    };

    const GLOBAL = {
        count: 8,                  // 本数

        // 籠（ざる）
        // 【対策】オクラは全長8cmしかない。きゅうりやゴーヤーのざるを
        //         そのまま使うと、運動場に豆を撒いたような絵になる
        basketRim: 11.5,           // 縁の半径 cm
        basketDepth: 4.0,          // 深さ cm
        basketThick: 0.40,         // 竹ひごの厚み cm
        basketSegments: 96,
        basketRings: 32,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。ここに実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 480,
        physicsHz: 120,
        pieceMass: 1.0,
        // 【対策】オクラは稜のおかげでよく止まるが、細いので転がりやすい。
        //         摩擦を上げないとざるの斜面を滑って縁に溜まる
        friction: 0.88,
        restitution: 0.02,
        linearDamping: 0.16,
        angularDamping: 0.92,
        dropInterval: 0.16,
        dropClearance: 1.0,
        freezeWhenSettled: true,
        settleSpeed: 2.5, settleSpin: 3.0, settleHold: 0.35,
        settleTimeout: 6.0,

        segmentsAxis: 168,
        segmentsRound: 120,
        calyxSegments: 16,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.076,
        dofFStop: 2.8,

        // GUI
        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "gokaku";
    const START_SEED = 20260726;
    const BUILD = "okra-A";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】縦条と傷の位置は、ジオメトリの断面とテクスチャの両方が
        //         同じものを見ていなければならない。テクスチャは品種単位で
        //         キャッシュされるので、種も品種名から決めて個体乱数から切り離す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        if (cfg.count > 5) { cfg.segmentsAxis = 136; cfg.segmentsRound = 100; }
        if (cfg.count > 8) { cfg.segmentsAxis = 112; cfg.segmentsRound = 80; }
        // 【対策】稜の上に必ず頂点を置く。segmentsRound を ridgeCount の
        //         倍数に丸めないと、五角形の角が頂点の谷間に落ちて鈍り、
        //         せっかくの断面がただの円柱に見える
        const n = cfg.ridgeCount;
        cfg.segmentsRound = Math.max(n * 8, Math.round(cfg.segmentsRound / n) * n);
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
        // u 方向だけ折り返す（果皮のUVは u が周方向、v が軸方向で継ぎ目が無い）
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
        //         切られるので、部品どうしが互いを正しく隠せなくなる。
        //         マテリアル側でも transparencyMode = OPAQUE を宣言しておく
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
    // [軸方向 t, 半径比]。t=0 がヘタ側、t=1 が先端
    // 【対策】ゴーヤーの紡錘形を流用すると別物になる。オクラは付け根が
    //         いちばん太く、そこから先端まで一様に細る「角のある円錐」
    const PROF_SHARP = [
        [0.000, 0.885], [0.025, 0.945], [0.060, 0.980], [0.110, 0.998],
        [0.170, 1.000], [0.260, 0.988], [0.360, 0.960], [0.470, 0.920],
        [0.580, 0.866], [0.680, 0.798], [0.770, 0.716], [0.850, 0.610],
        [0.910, 0.486], [0.955, 0.346], [0.984, 0.188], [1.000, 0.028]
    ];
    const PROF_BLUNT = [
        [0.000, 0.900], [0.025, 0.955], [0.060, 0.985], [0.110, 1.000],
        [0.170, 1.000], [0.260, 0.994], [0.360, 0.980], [0.470, 0.958],
        [0.580, 0.925], [0.680, 0.880], [0.770, 0.818], [0.850, 0.730],
        [0.910, 0.612], [0.955, 0.462], [0.984, 0.272], [1.000, 0.060]
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

    // ---- 断面：丸めた正 n 角形 ----------------------------------------
    // u は周方向（周期1）、t は軸方向。edge は 0=面の中央 / 1=稜
    //
    // 【対策】単純に r = 1 + A*cos(n*phi) と書くと、面も稜も同じ曲率の
    //         波打った円になり、オクラの「平らな面が n 枚あって角で折れる」
    //         感じが出ない。面の中央から稜へ pow で立ち上げるのが要点。
    //         facetPower を上げるほど面が平ら〜わずかに凹になる
    //         （正多角形の直線的な面は指数2に相当。実物はやや凹むので 2.6 前後）
    // 【対策】pow だけだと稜が完全なカドになってハイライトが線で走り、
    //         プラスチック成型品に見える。稜の近傍だけ 1 へ寄せて丸める
    function facetAt(u, t, cfg) {
        const n = cfg.ridgeCount;
        const w = u * n + cfg.twist * t;
        const fr = w - Math.floor(w);
        const e = Math.abs(fr - 0.5) * 2;          // 0=面の中央 1=稜
        let f = Math.pow(e, cfg.facetPower);
        f = mix(f, 1, smooth(1 - cfg.ridgeRound, 1, e));
        return { r: 1 - cfg.facetDepth * (1 - f), edge: f, raw: e };
    }

    // ---- 細い縦条（稜に平行な筋）--------------------------------------
    function striaAt(u, t, cfg) {
        const wander = 0.30 * (Noise.fbm2u(u * 6, t * 4, 6, cfg.texSeed + 21, 2) - 0.5);
        const line = 0.5 + 0.5 * Math.cos(2 * Math.PI * (u * cfg.striaU + wander));
        // 先端と付け根では条が消える
        const ends = smooth(0.02, 0.10, t) * (1 - smooth(0.88, 0.99, t));
        return Math.pow(line, cfg.striaSharp) * ends;
    }

    // ---- 産毛 ---------------------------------------------------------
    // 【対策】産毛を色で描こうとすると白い粉を吹いたように見える。
    //         見えているのは毛そのものではなく、毛が光を散らした結果なので、
    //         高周波の法線 + PBR の sheen で「布のような照り」として出す
    function fuzzAt(u, t, cfg) {
        return Noise.fbm2u(u * cfg.fuzzU, t * cfg.fuzzV, cfg.fuzzU, cfg.texSeed + 71, 2);
    }

    // ---- 擦り傷・黒ずみ -----------------------------------------------
    function scarAt(u, t, cfg) {
        const a = Noise.fbm2u(u * 9, t * 26, 9, cfg.texSeed + 37, 3);
        const b = Noise.fbm2u(u * 3, t * 5, 3, cfg.texSeed + 53, 2);
        return smooth(0.80, 0.97, a) * smooth(0.45, 0.80, b) * cfg.blemish;
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
            return dt;
        },

        // 果皮の場をいちど計算して 3 枚のテクスチャで共有する
        // 【対策】アルベド・ORM・法線を別々に評価すると、書き間違いひとつで
        //         条の位置がずれ、「筋の上にぼんやりした汚れが乗った」ように
        //         見える。ここで1回だけ焼いて配る
        field(size, cfg) {
            const N = size, n2 = N * N;
            const F = {
                edge: new Float32Array(n2),    // 稜への近さ 0..1
                stria: new Float32Array(n2),   // 縦条
                fuzz: new Float32Array(n2),    // 産毛
                scar: new Float32Array(n2),    // 傷
                h: new Float32Array(n2)        // 法線マップ用の合成高さ
            };
            for (let y = 0; y < N; y++) {
                const v = y / N;
                for (let x = 0; x < N; x++) {
                    const u = x / N, i = y * N + x;
                    const A = facetAt(u, v, cfg);
                    const st = striaAt(u, v, cfg);
                    const fz = fuzzAt(u, v, cfg);
                    const sc = scarAt(u, v, cfg);
                    F.edge[i] = A.edge;
                    F.stria[i] = st;
                    F.fuzz[i] = fz;
                    F.scar[i] = sc;
                    // 【対策】断面の角ばりは法線マップに入れない。ジオメトリ側で
                    //         出しているので、両方に入れると稜が二重に陰り、
                    //         折り紙のような硬い見た目になる
                    F.h[i] = clamp(cfg.fuzzAmt * fz + 0.15 * st + 0.20 * sc, 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const D = cfg.podDark, M = cfg.podMid, R = cfg.podRidge, T = cfg.podTip;
            const ST = cfg.stria, FZ = cfg.fuzzCol, SC = cfg.scar;
            return this._tex("okraAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const edge = F.edge[i0], st = F.stria[i0];
                        const fz = F.fuzz[i0], sc = F.scar[i0];
                        // 軸方向：付け根が濃く、先端へ向かって少し淡くなる
                        let cr = mix(D[0], M[0], smooth(0.04, 0.40, v));
                        let cg = mix(D[1], M[1], smooth(0.04, 0.40, v));
                        let cb = mix(D[2], M[2], smooth(0.04, 0.40, v));
                        cr = mix(cr, T[0], smooth(0.55, 1.0, v) * 0.75);
                        cg = mix(cg, T[1], smooth(0.55, 1.0, v) * 0.75);
                        cb = mix(cb, T[2], smooth(0.55, 1.0, v) * 0.75);
                        // 【対策】稜は光の当たり方だけでは出ない。実物は稜の
                        //         線に沿って皮が薄く、明らかに色が淡い
                        const rib = Math.pow(edge, 5.5);
                        cr = mix(cr, R[0], rib * 0.60);
                        cg = mix(cg, R[1], rib * 0.60);
                        cb = mix(cb, R[2], rib * 0.60);
                        // 面の中央のわずかな濃淡（縦に引き伸ばす）
                        const mott = 0.92 + 0.16 * Noise.fbm2u((x / N) * 7, v * 16, 7, cfg.texSeed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 細い縦条
                        cr = mix(cr, ST[0], st * cfg.striaAmt);
                        cg = mix(cg, ST[1], st * cfg.striaAmt);
                        cb = mix(cb, ST[2], st * cfg.striaAmt);
                        // 産毛の照り。ごく淡く、かつ稜の上でやや強い
                        const fl = smooth(0.66, 0.98, fz) * (0.16 + 0.16 * edge);
                        cr = mix(cr, FZ[0], fl);
                        cg = mix(cg, FZ[1], fl);
                        cb = mix(cb, FZ[2], fl);
                        // 擦り傷・黒ずみ
                        cr = mix(cr, SC[0], sc * 0.75);
                        cg = mix(cg, SC[1], sc * 0.75);
                        cb = mix(cb, SC[2], sc * 0.75);
                        // 先端の乾いた尖り
                        const beak = smooth(0.975, 1.0, v);
                        cr = mix(cr, 0.34, beak * 0.7); cg = mix(cg, 0.36, beak * 0.7); cb = mix(cb, 0.20, beak * 0.7);
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
            return this._tex("okraORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const edge = F.edge[i0], fz = F.fuzz[i0], sc = F.scar[i0];
                        // 【対策】オクラは産毛のせいで全体に粗い。艶を上げると
                        //         塗装したピーマンになる。光るのは稜の線だけ
                        let rough = cfg.skinRoughness * (1.03 - 0.10 * edge);
                        rough = mix(rough, cfg.skinRoughness * 0.80, Math.pow(edge, 5.0) * 0.6);
                        rough = mix(rough, 0.80, sc * 0.6);
                        rough += 0.06 * (fz - 0.5);
                        // 面の中央がわずかに凹むので、ごく浅い陰を焼く
                        let ao = 1.0;
                        ao = mix(ao, 0.90, Math.pow(1 - edge, 2.0) * 0.35);
                        ao = mix(ao, 0.86, sc * 0.5);
                        ao = mix(ao, 0.74, smooth(0.965, 1.0, v));
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, F, strength) {
            const hf = F.h;
            return this._tex("okraNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 極ではUが潰れて放射状の筋になるので端を減衰させる
                    const vv = y / N;
                    const k = strength * smooth(0, 0.05, vv) * (1 - smooth(0.95, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * k, ny = (yu - yd) * k, nz = 1;
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
            const OVER = [0.86, 0.77, 0.55], UNDER = [0.72, 0.62, 0.42], GAP = [0.38, 0.30, 0.18];
            return this._tex("basketAlbedo", size, (d, N) => {
                const SPOKE = 72, RING = 22;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * SPOKE, sv = v * RING;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.76 + 0.32 * bv) : (0.56 + 0.22 * bu);
                        const gap = smooth(0, 0.10, Math.min(fu, 1 - fu))
                            * smooth(0, 0.10, Math.min(fv, 1 - fv));
                        const fib = 0.92 + 0.16 * Noise.fbm2u(u * 260, v * 14, 260, seed, 2);
                        const age = 0.92 + 0.16 * Noise.fbm2u(u * 6, v * 5, 6, seed + 9, 3);
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
            this.normalTex = TextureLab.normal(scene, S, F, 2.2);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("okraSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.70;
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】クリアコートは使わない。オクラは濡れて光るのではなく、
            //         表面の毛が光を散らして布のように照る。sheen がこの用途。
            //         クリアコートを足すと、生の莢ではなく茹でた莢になる
            m.sheen.isEnabled = true;
            m.sheen.intensity = cfg.sheenAmt;
            m.sheen.color = new BABYLON.Color3(cfg.sheenCol[0], cfg.sheenCol[1], cfg.sheenCol[2]);
            m.sheen.roughness = 0.55;
            m.sheen.linkSheenWithAlbedo = false;
            // 莢は薄く中が空洞。縁がわずかに明るくなる
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.50, 0.72, 0.28);
            m.subSurface.translucencyIntensity = 0.10;
            m.subSurface.minimumThickness = 0.2;
            m.subSurface.maximumThickness = 1.2;
            this.skin = m;

            const st = new BABYLON.PBRMaterial("okraCalyx", scene);
            st.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            st.metallic = 0.0;
            st.roughness = 0.66;
            st.transparencyMode = OPAQUE;
            st.sheen.isEnabled = true;
            st.sheen.intensity = cfg.sheenAmt * 0.7;
            st.sheen.roughness = 0.6;
            // 【対策】ヘタは莢と同じ面から生えるので、境界で Z ファイティングを
            //         起こしやすい。わずかに手前へ寄せる
            st.zOffset = -2;
            st.zOffsetUnits = -16;
            this.calyx = st;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.calyx.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Okra
    // =================================================================
    class Okra {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.88, 1.12);
            this.R = cfg.radius * rng.range(0.92, 1.08) * cfg.fullness;
            this.blunt = clamp(cfg.tipBlunt + rng.gauss(0, 0.07), 0, 1);
            this.nseed = rng.int(900000) + 1000;
            this.bendA = cfg.bendA * rng.range(0.4, 1.8) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.2, 1.2);
            this.bendRoll = rng.range(0, Math.PI * 2);
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            // 【対策】模様と断面をずらさないため、個体差は「UVを回す量」で出す。
            //         ただし稜の上に頂点を置きたいので、回す量は 1/n の整数倍に
            //         限る。連続値で回すと五角形の角が頂点の谷間に落ちて鈍る
            this.uOff = rng.int(cfg.ridgeCount) / cfg.ridgeCount;

            this.parts = [];
            this.calyxAxis = [];
            this._buildBody(skin);
            this._buildCalyx(skin);
            this.root = new BABYLON.TransformNode("okra", scene);
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
        // 断面半径の倍率。uTex はテクスチャと同じ座標系（phi/2π + uOff）
        sectionAt(t, uTex) {
            const cfg = this.cfg;
            const phi = uTex * Math.PI * 2;
            const A = facetAt(uTex, t, cfg);
            // 低周波の非対称。これが無いと完全な回転体になり、
            // ハイライトが直線になって押し出し成型に見える
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            const wob = 0.010 * (Noise.fbm3(Math.cos(phi) * 2.4, Math.sin(phi) * 2.4, t * 5.0, this.nseed, 3) - 0.5);
            return A.r + asym + wob;
        }
        radiusAt(t, uTex) {
            return Math.max(0.003, this.R * profileAt(t, this.blunt) * this.sectionAt(t, uTex));
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
            const mesh = sweep("okraPod", rings, centers, null, this.scene, this.uOff);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // ヘタ（カラー）：莢と同じ太さから立ち上がる円錐。先端に淡い切り口
        // 【対策】きゅうりやゴーヤーのような細い果柄を付けると、まったく
        //         別の野菜に見える。オクラのヘタは莢の延長として太く、
        //         同じ稜がそのまま続いているのが読めることが大事
        _buildCalyx(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.calyxSegments, M = cfg.segmentsRound;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);                       // 莢から離れる向き
            const L = cfg.calyxLen * this.L * rng.range(0.88, 1.12);
            const tilt = rng.range(0.02, 0.10), tiltA = rng.range(0, Math.PI * 2);
            const side = f0.N.scale(Math.cos(tiltA)).add(f0.B.scale(Math.sin(tiltA)));
            const r0 = this.R * profileAt(0, this.blunt);
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const lean = Math.tan(tilt) * L * 0.6 * s * s;
                const c = base.add(dir.scale(L * s)).add(side.scale(lean));
                // 【対策】直線的に絞ると漏斗ではなく鉛筆の先になる。実物の
                //         ヘタはわずかに反った（凹んだ）円錐で、根元で一気に、
                //         先へ行くほどゆるやかに細る
                const collar = 1 + (cfg.calyxFlare - 1) * Math.sin(Math.PI * clamp(s / 0.30, 0, 1));
                const taper = 1 - (1 - cfg.calyxTop) * Math.pow(s, 0.72);
                const rr = r0 * collar * taper;
                if (i % 4 === 0 || i === K) this.calyxAxis.push({ c: c, r: rr * 1.06 });
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const w = (j % M) / M;
                    const phi = w * Math.PI * 2;
                    // 莢の稜をそのまま延長する。ヘタのほうが角が立つ
                    const A = facetAt(w + this.uOff, 0, cfg);
                    const sharpen = 1 - (1 - A.r) * 1.35;
                    const r = rr * sharpen;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f0.N.x * cs + f0.B.x * sn) * r,
                        c.y + (f0.N.y * cs + f0.B.y * sn) * r,
                        c.z + (f0.N.z * cs + f0.B.z * sn) * r
                    ));
                }
                rings.push(ring); centers.push(c);
            }
            const LOW = cfg.calyx, HI = [cfg.calyx[0] * 1.30, cfg.calyx[1] * 1.20, cfg.calyx[2] * 1.35];
            const CUT = cfg.calyxCut;
            const colsFn = (v, u) => {
                const w = smooth(0.05, 0.75, v);
                const cut = smooth(0.90, 1.0, v);
                // 【対策】莢とヘタの境目は実物では細い褐色の輪になっている。
                //         ここが無いとヘタが莢から生えたのではなく、
                //         別の部品を挿しただけに見える
                const ring = smooth(0.10, 0.0, v) * 0.55;
                const g = 0.90 + 0.20 * Noise.fbm3(Math.cos(u * 6.28) * 5, Math.sin(u * 6.28) * 5, v * 9, this.nseed + 7, 2);
                return [
                    srgb(mix(mix(mix(LOW[0], HI[0], w), CUT[0], cut), 0.215, ring) * g),
                    srgb(mix(mix(mix(LOW[1], HI[1], w), CUT[1], cut), 0.170, ring) * g),
                    srgb(mix(mix(mix(LOW[2], HI[2], w), CUT[2], cut), 0.080, ring) * g)
                ];
            };
            const mesh = sweep("okraCalyx", rings, centers, colsFn, this.scene, 0);
            mesh.material = skin.calyx;
            mesh.receiveShadows = true;
            this.calyx = mesh;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュから凸包を取ると生成が重いので、
        // 同じ関数を粗く評価した代理メッシュから凸包を起こす
        // 【対策】稜をそのまま凸包にすると、ほぼ同一平面の面が大量に生まれ、
        //         積み重なった状態で接触マニフォールドが毎ステップ別の面へ
        //         飛び移って震える。断面は稜を均した円で近似する。
        //         またヘタを含めないと、ヘタだけざるを突き抜けて見える
        hullShape() {
            const N = 18, M = 12;
            const rings = [], centers = [];
            const f0 = this.frameAt(0);
            for (let k = this.calyxAxis.length - 1; k >= 0; k--) {
                const sa = this.calyxAxis[k], ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        sa.c.x + (f0.N.x * cs + f0.B.x * sn) * sa.r,
                        sa.c.y + (f0.N.y * cs + f0.B.y * sn) * sa.r,
                        sa.c.z + (f0.N.z * cs + f0.B.z * sn) * sa.r));
                }
                rings.push(ring); centers.push(sa.c);
            }
            const mean = 1 - this.cfg.facetDepth * 0.5;
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                        + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
                    const r = Math.max(0.003, this.R * profileAt(t, this.blunt) * (mean + asym)) * 0.98;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("okraProxy", rings, centers, null, this.scene, 0);
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
        m.roughness = 0.76;
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
        console.warn("[Okra] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.68;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.22, 38, new V3(0, 1.4, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 14;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする。ただしオクラは小さいので、
    //         きゅうり版の minZ=6 では寄ったときに手前が消える
    camera.minZ = 3;
    camera.maxZ = 200;
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 110;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = new V3(14, 24, -16);
    key.intensity = 2.7;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.55, 0.55, 0.52);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.96, 1.0, 0.96);
    fillL.specular = new BABYLON.Color3(0.22, 0.24, 0.20);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.60;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.76, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 32;
    sg.depthScale = 30;
    sg.darkness = 0.50;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.06;
    ip.contrast = 1.14;
    ip.vignetteEnabled = false;

    let ground = null;
    if (GLOBAL.showGround) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 160, height: 2, depth: 160 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.90, 0.905).toLinearSpace();
        gm.metallic = 0.0; gm.roughness = 0.88;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        ground.material = gm;
        ground.receiveShadows = true;
        ground.position.y = -1.06;
        if (physics) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    const basket = buildBasket(scene, GLOBAL);
    if (physics) {
        const bShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        bShape.material = { friction: 0.75, restitution: 0.0 };
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

    function basketInnerY(r) {
        const s = clamp(r / GLOBAL.basketRim, 0, 1);
        return GLOBAL.basketThick + GLOBAL.basketDepth * Math.pow(clamp((s - 0.50) / 0.50, 0, 1), 1.55);
    }

    // 【対策】山全体の頂点を基準にすると、外側へ置く物まで山の高さぶん
    //         持ち上げられ、ざるの縁の上から落ちてくることになる。
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
                rng.gauss(0, 0.35), rng.range(0, Math.PI * 2), rng.gauss(0, 0.35));
            const r = GLOBAL.basketRim * 0.36 * Math.sqrt(rng.next());
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
                    (i - (items.length - 1) / 2) * items[i].R * 2.4);
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
            items.push(new Okra(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.35, 0);
        camera.radius = cfg.basketRim * 3.4;

        resetDrop(seed);
        console.log("[Okra]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "本",
            "/ 断面分割", cfg.segmentsRound, "(稜", cfg.ridgeCount, "本の倍数)");
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
        // 【対策】オクラの面の凹みは数mm。半径を大きく取ると個体どうしの
        //         隙間しか拾わず、五角形の陰影が出ない
        ssao.radius = 0.45;
        ssao.totalStrength = 0.90;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 140;
        ssao.minZAspect = 0.3;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.98;
    dp.bloomWeight = 0.06;
    dp.bloomKernel = 32;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.20;
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
        idle: "#18260f", active: "#3d6b23", edge: "#334527",
        text: "#eef5e9", sub: "#a8bd99", accent: "#a7d372"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "246px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(10,17,7,0.84)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "214px"; panel.isVertical = true;
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

    addLabel("OKRA", 11, COL.sub, "18px");
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
    for (const c of [5, 8, 12]) {
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
    const dofBtn = addButton("dof", "被写界深度: ON", () => {
        GLOBAL.useDOF = !GLOBAL.useDOF;
        dp.depthOfFieldEnabled = GLOBAL.useDOF;
        dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
        dofBtn.textBlock.text = "被写界深度: " + (GLOBAL.useDOF ? "ON" : "OFF");
    });
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
            + "cm 太さ " + (e.R * 2).toFixed(1) + "cm\nseed: " + curSeed + "  [" + BUILD + "]";
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
    toggleBtn.background = "rgba(10,17,7,0.84)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(10,17,7,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;