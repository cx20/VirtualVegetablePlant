// =====================================================================
//  Photoreal Piman (Bell Pepper)  /  写実的なピーマン
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（ピーマン / 肉厚 / 赤パプリカ）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Fields      … (r, y) 2列プロファイル / 片と溝 / しわ / 斑点
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Pepper      … 果実 + 星形のがく + 太い果柄
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1個ずつ落とす）
//    9. GUI
//
//  オクラ版からの主な変更点（ここを外すと「緑の卵」になる）:
//    ・軸に沿って掃引する筒ではない。縦軸まわりの回転体なので、
//      プロファイルは半径だけでなく (r, y) の2列で持つ。
//      これが無いと肩が折り返せず、ヘタのくぼみが作れない
//    ・縦に3〜4本の深い溝があり、そのあいだが丸くふくらんだ「片」になる。
//      溝は肩では浅く、尻へ向かって深くなり、尻でいちばん強く窄まる
//    ・肩は平らではなく、片ごとにこぶ状に盛り上がる
//    ・ヘタは円錐ではなく、くぼみに収まる星形のがく + 太く曲がった果柄
//    ・表面はほぼ鏡。クリアコートを強く効かせないと別の野菜になる
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        piman: {
            label: "ピーマン",
            height: 6.6, width: 5.0,
            blocky: 0.38,                       // 0=先細り / 1=角ばって寸胴
            lean: 0.030,                        // 軸の傾き
            // 片（かた）と溝
            lobeCount: 3,
            lobeDepth: 0.098,
            lobePower: 2.00,                    // 小さいほど片の面が平らになる
            creaseW: 0.30, creaseDepth: 0.048, crownNotch: 0.038,  // 角の折れ目の幅と深さ
            dentAmt: 0.20,                      // 面に散る浅いへこみ
            tipPucker: 2.10,                    // 尻の窄まりの強さ
            shoulderBulge: 0.048,               // 肩のこぶ
            twist: 0.04,
            asymmetry: 0.045,
            lobeVary: 0.090, lobeFatVary: 0.080, shoulderSkew: 0.030,                   // 片の大小のばらつき
            // がくと果柄
            calyxR: 0.57, calyxHub: 0.13, calyxThick: 0.038,
            calyxLift: 0.022, calyxCurl: 0.075, starDepth: 0.46,
            stalkR: 0.130, stalkLen: 0.36, stalkBend: 0.22, stalkFlute: 7,
            // 表面
            wrinkleAmt: 0.75, blemish: 0.45, waxPatch: 0.55,
            // 色（sRGB）
            skinDark: [0.062, 0.205, 0.048],    // 溝の底
            skinMid: [0.170, 0.435, 0.108],
            skinLight: [0.330, 0.610, 0.205],   // 淡い条・肩
            skinTip: [0.215, 0.490, 0.135],     // 尻寄り
            blot: [0.115, 0.320, 0.080],
            scar: [0.330, 0.300, 0.150],
            calyx: [0.180, 0.365, 0.100], calyxBack: [0.130, 0.270, 0.075],
            stalk: [0.235, 0.400, 0.135], stalkCut: [0.700, 0.680, 0.495],
            skinRoughness: 0.27, coatAmt: 0.50
        },
        atsuniku: {
            label: "肉厚ピーマン",
            height: 7.4, width: 6.2,
            blocky: 0.72,
            lean: 0.022,
            lobeCount: 4,
            lobeDepth: 0.092,
            lobePower: 1.90,
            creaseW: 0.28, creaseDepth: 0.054, crownNotch: 0.040,
            dentAmt: 0.19,
            tipPucker: 1.85,
            shoulderBulge: 0.050,
            twist: 0.03,
            asymmetry: 0.042,
            lobeVary: 0.085, lobeFatVary: 0.072, shoulderSkew: 0.028,
            calyxR: 0.58, calyxHub: 0.12, calyxThick: 0.035,
            calyxLift: 0.020, calyxCurl: 0.070, starDepth: 0.44,
            stalkR: 0.122, stalkLen: 0.34, stalkBend: 0.18, stalkFlute: 7,
            wrinkleAmt: 0.65, blemish: 0.40, waxPatch: 0.52,
            skinDark: [0.048, 0.170, 0.040],
            skinMid: [0.138, 0.375, 0.090],
            skinLight: [0.285, 0.545, 0.175],
            skinTip: [0.180, 0.425, 0.115],
            blot: [0.092, 0.270, 0.065],
            scar: [0.320, 0.290, 0.145],
            calyx: [0.165, 0.340, 0.092], calyxBack: [0.118, 0.248, 0.068],
            stalk: [0.215, 0.375, 0.125], stalkCut: [0.690, 0.670, 0.485],
            skinRoughness: 0.25, coatAmt: 0.55
        },
        paprika: {
            label: "赤パプリカ",
            height: 8.4, width: 7.2,
            blocky: 0.95,
            lean: 0.016,
            lobeCount: 4,
            lobeDepth: 0.088,
            lobePower: 1.80,
            creaseW: 0.26, creaseDepth: 0.062, crownNotch: 0.034,
            dentAmt: 0.16,
            tipPucker: 1.60,
            shoulderBulge: 0.052,
            twist: 0.02,
            asymmetry: 0.038,
            lobeVary: 0.070, lobeFatVary: 0.062, shoulderSkew: 0.024,
            calyxR: 0.54, calyxHub: 0.11, calyxThick: 0.033,
            calyxLift: 0.018, calyxCurl: 0.062, starDepth: 0.42,
            stalkR: 0.112, stalkLen: 0.30, stalkBend: 0.15, stalkFlute: 7,
            wrinkleAmt: 0.50, blemish: 0.34, waxPatch: 0.50,
            // 【対策】赤はアルベドが低く、緑と同じ露出だと黒い塊になる。
            //         地の色を思い切って上げ、溝との差で形を読ませる
            skinDark: [0.215, 0.022, 0.028],
            skinMid: [0.545, 0.062, 0.048],
            skinLight: [0.790, 0.185, 0.105],
            skinTip: [0.640, 0.095, 0.062],
            blot: [0.395, 0.040, 0.038],
            scar: [0.340, 0.230, 0.130],
            calyx: [0.190, 0.360, 0.105], calyxBack: [0.135, 0.262, 0.075],
            stalk: [0.245, 0.395, 0.140], stalkCut: [0.705, 0.685, 0.500],
            skinRoughness: 0.24, coatAmt: 0.60
        }
    };

    const GLOBAL = {
        count: 5,                  // 個数

        // 籠（ざる）
        basketRim: 13.5,           // 縁の半径 cm
        basketDepth: 4.6,          // 深さ cm
        basketThick: 0.45,         // 竹ひごの厚み cm
        basketSegments: 96,
        basketRings: 32,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。ここに実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 520,
        physicsHz: 120,
        pieceMass: 1.0,
        // 【対策】ピーマンはほぼ球なので、摩擦が低いと籠の斜面を延々と転がる
        friction: 0.90,
        restitution: 0.03,
        linearDamping: 0.18,
        angularDamping: 0.90,
        dropInterval: 0.24,
        dropClearance: 1.4,
        freezeWhenSettled: true,
        settleSpeed: 2.5, settleSpin: 3.0, settleHold: 0.35,
        settleTimeout: 6.0,

        segmentsAxis: 132,
        segmentsRound: 144,
        calyxRings: 10,
        calyxSides: 96,
        stalkSegments: 14,
        stalkSides: 14,

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

    const START_VARIETY = "piman";
    const START_SEED = 20260726;
    const BUILD = "piman-A";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】溝としわの位置は、ジオメトリとテクスチャの両方が同じものを
        //         見ていなければならない。テクスチャは品種単位でキャッシュ
        //         されるので、種も品種名から決めて個体乱数から切り離す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        if (cfg.count > 3) { cfg.segmentsAxis = 116; cfg.segmentsRound = 120; }
        if (cfg.count > 5) { cfg.segmentsAxis = 96; cfg.segmentsRound = 96; }
        // 【対策】溝の底に必ず頂点を置く。segmentsRound を lobeCount の倍数に
        //         丸めないと、3本の溝が頂点の谷間に落ちて浅くなり、
        //         せっかくの片が消えてただの卵になる
        const n = cfg.lobeCount;
        cfg.segmentsRound = Math.max(n * 24, Math.round(cfg.segmentsRound / n) * n);
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
    // 【対策】細長い野菜のように「半径だけ」のプロファイルにすると、
    //         肩を折り返せないのでヘタのくぼみが作れない。r と y の2列で持つ。
    //         t=0 がくぼみの底、t=1 が尻の先端。y は上向き
    // 【対策】最大径を中央に置くと卵になる。実物のピーマンは肩がいちばん
    //         太く、そこから尻まで一方向に細る。さらに上面は丸いドームでは
    //         なく、中央がくぼんだ「平たい皿」で、その外周に角がある
    const PROF_CONE = [
        [0.020, 0.822], [0.115, 0.836], [0.235, 0.878], [0.360, 0.938],
        [0.470, 0.982], [0.560, 1.000], [0.680, 0.999], [0.800, 0.992],
        [0.900, 0.976], [0.965, 0.946], [1.000, 0.888], [0.985, 0.782],
        [0.962, 0.668], [0.930, 0.548], [0.890, 0.428], [0.842, 0.312],
        [0.783, 0.204], [0.700, 0.111], [0.580, 0.037], [0.310, -0.035],
        [0.055, -0.016]
    ];
    const PROF_BLOCK = [
        [0.020, 0.822], [0.125, 0.838], [0.255, 0.884], [0.385, 0.944],
        [0.505, 0.986], [0.600, 1.000], [0.720, 1.000], [0.840, 0.995],
        [0.930, 0.982], [0.980, 0.956], [1.000, 0.902], [1.000, 0.800],
        [0.998, 0.688], [0.992, 0.572], [0.980, 0.455], [0.960, 0.338],
        [0.928, 0.226], [0.872, 0.126], [0.762, 0.045], [0.480, -0.035],
        [0.060, -0.014]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 2列プロファイルは添字で等間隔に刻む（1列目が単調でないので t 検索は使えない）
    function profileAt(t, blocky) {
        const A = PROF_CONE, B = PROF_BLOCK, n = A.length;
        const x = clamp(t, 0, 1) * (n - 1);
        const i = Math.min(n - 2, Math.floor(x)), u = x - i;
        const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
        const bl = clamp(blocky, 0, 1);
        const rr = mix(catmull(A[i0][0], A[i][0], A[i + 1][0], A[i3][0], u),
            catmull(B[i0][0], B[i][0], B[i + 1][0], B[i3][0], u), bl);
        const yy = mix(catmull(A[i0][1], A[i][1], A[i + 1][1], A[i3][1], u),
            catmull(B[i0][1], B[i][1], B[i + 1][1], B[i3][1], u), bl);
        return { r: Math.max(0, rr), y: yy };
    }
    // くぼみの内側で、半径 rn の位置の高さを返す（がくを肩の面に載せるため）
    // 【対策】がくの高さを定数で決めると、品種によって浮いたり埋まったりする。
    //         果実の面そのものを引いて載せる
    function wellFind(rn, blocky) {
        let lo = 0, hi = 0.42;
        for (let k = 0; k < 22; k++) {
            const m = (lo + hi) * 0.5;
            if (profileAt(m, blocky).r < rn) lo = m; else hi = m;
        }
        const t = (lo + hi) * 0.5;
        return { y: profileAt(t, blocky).y, t: t };
    }
    function wellY(rn, blocky) { return wellFind(rn, blocky).y; }
    // 肩の傾きの効き具合（がくも同じ関数で持ち上げないと片側が浮く）
    function skewMask(t) { return 1 - smooth(0.06, 0.52, t); }

    // ---- 片（かた）と溝 ------------------------------------------------
    // u は周方向（周期1）、t は軸方向。groove は 0=片の中央 / 1=溝の底
    //
    // 【対策】pow の指数を 3 以上にすると「円に細い切れ込みを入れただけ」に
    //         なり、磨いたガラス玉に見える。実物の片は平らな面で、断面は
    //         角の丸い三角形〜四角形。指数を 2 前後まで下げて面全体を寝かせ、
    //         角の折れ目は別の項として細く足すのが要点
    // 【対策】溝の深さを一定にすると寸胴のカボチャになる。肩では浅く、
    //         尻へ向かって深くなり、尻の先で最も窄まる
    function lobeAt(u, t, cfg) {
        const n = cfg.lobeCount;
        const w = u * n + cfg.twist * t;
        const fr = w - Math.floor(w);
        const e = Math.abs(fr - 0.5) * 2;          // 0=片の中央 1=角
        const panel = Math.pow(e, cfg.lobePower);  // 面を平らに寝かせる
        const crease = smooth(1 - cfg.creaseW, 1.0, e);   // 角の細い折れ目
        // 【対策】肩の折れ目が浅いと上面が滑らかな蓋になる。実物は
        //         がくのまわりが歯車のように深く切れ込んでいる
        const crown = cfg.crownNotch * smooth(0.03, 0.14, t) * (1 - smooth(0.32, 0.56, t));
        // 【対策】肩で溝を浅くしすぎると上面がのっぺりした皿になる。
        //         実物の折れ目はがくの際まで通っている
        const tz = 0.80 + 0.20 * smooth(0.06, 0.60, t);
        const depth = cfg.lobeDepth * tz * (1 + cfg.tipPucker * smooth(0.70, 0.97, t));
        const cd = cfg.creaseDepth * (0.35 + 0.65 * smooth(0.05, 0.55, t));
        return {
            r: 1 - depth * panel - (cd + crown) * crease,
            groove: clamp(0.35 * panel + 0.65 * crease, 0, 1),
            e: e,
            idx: ((Math.floor(w) % n) + n) % n      // 片の通し番号
        };
    }

    // ---- 肩のこぶ -----------------------------------------------------
    // 【対策】上面を平らにしただけだと皿になる。実物の肩は片ごとに
    //         こぶ状に盛り上がり、溝のところがはっきり凹んでいる
    function shoulderAt(t, groove, cfg) {
        const mask = smooth(0.03, 0.16, t) * (1 - smooth(0.40, 0.64, t));
        return cfg.shoulderBulge * (1 - groove) * mask;
    }

    // ---- 表面のしわ（肩寄りに強い縦じわ）-------------------------------
    function wrinkleAt(u, t, cfg) {
        const a = Noise.fbm2u(u * 16, t * 5, 16, cfg.texSeed + 21, 3);
        return (a - 0.5) * (0.35 + 0.65 * (1 - smooth(0.10, 0.55, t)));
    }

    // ---- 斑点・擦り傷 -------------------------------------------------
    function scarAt(u, t, cfg) {
        const a = Noise.fbm2u(u * 11, t * 17, 11, cfg.texSeed + 37, 3);
        const b = Noise.fbm2u(u * 4, t * 4, 4, cfg.texSeed + 53, 2);
        return smooth(0.83, 0.97, a) * smooth(0.50, 0.82, b) * cfg.blemish;
    }

    // ---- 蝋の曇り（つやのムラ）----------------------------------------
    function waxAt(u, t, cfg) {
        return Noise.fbm2u(u * 3, t * 4, 3, cfg.texSeed + 67, 3);
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
        field(size, cfg) {
            const N = size, n2 = N * N;
            const F = {
                groove: new Float32Array(n2),
                wrinkle: new Float32Array(n2),
                scar: new Float32Array(n2),
                wax: new Float32Array(n2),
                mottle: new Float32Array(n2),
                h: new Float32Array(n2)
            };
            for (let y = 0; y < N; y++) {
                const v = y / N;
                for (let x = 0; x < N; x++) {
                    const u = x / N, i = y * N + x;
                    F.groove[i] = lobeAt(u, v, cfg).groove;
                    F.wrinkle[i] = wrinkleAt(u, v, cfg);
                    F.scar[i] = scarAt(u, v, cfg);
                    F.wax[i] = waxAt(u, v, cfg);
                    F.mottle[i] = Noise.fbm2u(u * 5, v * 7, 5, cfg.texSeed + 3, 3);
                    // 【対策】溝は法線マップに入れない。ジオメトリ側で出しているので、
                    //         両方に入れると溝が二重に陰って墨で描いた線に見える
                    F.h[i] = clamp(0.5 + cfg.wrinkleAmt * F.wrinkle[i] - 0.30 * F.scar[i], 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const D = cfg.skinDark, M = cfg.skinMid, L = cfg.skinLight, T = cfg.skinTip;
            const BL = cfg.blot, SC = cfg.scar;
            return this._tex("pimanAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const gr = F.groove[i0], wr = F.wrinkle[i0];
                        const sc = F.scar[i0], mo = F.mottle[i0];
                        // 軸方向：肩がやや淡く、尻へ向かって濃くなる
                        let cr = mix(L[0], M[0], smooth(0.04, 0.42, v));
                        let cg = mix(L[1], M[1], smooth(0.04, 0.42, v));
                        let cb = mix(L[2], M[2], smooth(0.04, 0.42, v));
                        cr = mix(cr, T[0], smooth(0.62, 1.0, v) * 0.70);
                        cg = mix(cg, T[1], smooth(0.62, 1.0, v) * 0.70);
                        cb = mix(cb, T[2], smooth(0.62, 1.0, v) * 0.70);
                        // 【対策】溝を細い黒線で描くと輪郭線を入れた漫画になる。
                        //         実物の溝は「暗いというより彩度が落ちて沈む」ので、
                        //         幅を持たせて浅く落とす
                        const gs = Math.pow(gr, 1.3);
                        cr = mix(cr, D[0], gs * 0.62);
                        cg = mix(cg, D[1], gs * 0.62);
                        cb = mix(cb, D[2], gs * 0.62);
                        // 【対策】単色の緑だとハイライト以外に情報が無く、
                        //         塗装した球に見える。低周波の濃淡を強めに入れる
                        const lowf = Noise.fbm2u((x / N) * 2, v * 3, 2, cfg.texSeed + 89, 2);
                        const mm = (0.84 + 0.32 * mo) * (0.93 + 0.14 * lowf);
                        cr *= mm; cg *= mm; cb *= mm;
                        // 濃い斑（実物にある緑の濃淡）
                        const bt = smooth(0.62, 0.92, mo) * 0.35;
                        cr = mix(cr, BL[0], bt); cg = mix(cg, BL[1], bt); cb = mix(cb, BL[2], bt);
                        // しわの山はわずかに明るい
                        const wl = clamp(wr, 0, 1) * 0.30;
                        cr = mix(cr, L[0], wl); cg = mix(cg, L[1], wl); cb = mix(cb, L[2], wl);
                        // 擦り傷・かさぶた
                        cr = mix(cr, SC[0], sc * 0.80);
                        cg = mix(cg, SC[1], sc * 0.80);
                        cb = mix(cb, SC[2], sc * 0.80);
                        // 尻の窄まりの中心は乾いて淡い
                        const tipc = smooth(0.972, 1.0, v);
                        cr = mix(cr, 0.42, tipc * 0.55); cg = mix(cg, 0.44, tipc * 0.55); cb = mix(cb, 0.26, tipc * 0.55);
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
            return this._tex("pimanORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const gr = F.groove[i0], sc = F.scar[i0], wx = F.wax[i0];
                        // 【対策】ピーマンはほぼ鏡。ここを 0.4 などにすると
                        //         塗装したプラスチックの玩具になる
                        // 【対策】粗さを一様にすると、面全体が同じ強さで光って
                        //         成形品になる。実物は蝋のムラで場所ごとに艶が違う
                        let rough = cfg.skinRoughness;
                        rough = mix(rough, cfg.skinRoughness + 0.34,
                            smooth(0.38, 0.86, wx) * cfg.waxPatch);
                        rough = mix(rough, cfg.skinRoughness - 0.09,
                            smooth(0.62, 0.20, wx) * cfg.waxPatch * 0.8);
                        rough = mix(rough, 0.72, sc * 0.85);
                        rough = mix(rough, cfg.skinRoughness + 0.12, Math.pow(gr, 2.0) * 0.5);
                        rough = mix(rough, 0.55, smooth(0.965, 1.0, v));
                        let ao = 1.0;
                        // 溝とヘタのくぼみに陰
                        ao = mix(ao, 0.58, Math.pow(gr, 1.6) * 0.85);
                        ao = mix(ao, 0.62, smooth(0.10, 0.0, v));
                        ao = mix(ao, 0.72, smooth(0.972, 1.0, v));
                        ao = mix(ao, 0.86, sc * 0.5);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.04, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, F, strength) {
            const hf = F.h;
            return this._tex("pimanNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
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
            this.normalTex = TextureLab.normal(scene, S, F, 1.4);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("pimanSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.75;
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】クリアコートを 0.85 / 粗さ 0.055 まで上げると、
            //         果皮ではなく吹きガラスの表面になる。実物のピーマンは
            //         「よく光るが、映り込みの輪郭はぼやけている」ので、
            //         強度を半分に、コートの粗さを一桁上げる
            m.clearCoat.isEnabled = true;
            m.clearCoat.intensity = cfg.coatAmt;
            m.clearCoat.roughness = 0.13;
            m.clearCoat.indexOfRefraction = 1.44;
            // 果肉は厚いので透けはごく弱く
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.42, 0.68, 0.24);
            m.subSurface.translucencyIntensity = 0.06;
            m.subSurface.minimumThickness = 0.6;
            m.subSurface.maximumThickness = 3.0;
            this.skin = m;

            const st = new BABYLON.PBRMaterial("pimanCalyx", scene);
            st.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            st.metallic = 0.0;
            st.roughness = 0.52;
            st.transparencyMode = OPAQUE;
            st.clearCoat.isEnabled = true;
            st.clearCoat.intensity = 0.22;
            st.clearCoat.roughness = 0.28;
            st.backFaceCulling = true;
            this.calyx = st;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.calyx.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Pepper
    // =================================================================
    class Pepper {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.H = cfg.height / 1.035 * rng.range(0.87, 1.13);
            this.R = cfg.width * 0.5 * rng.range(0.89, 1.11);
            this.blocky = clamp(cfg.blocky + rng.gauss(0, 0.10), 0, 1);
            this.nseed = rng.int(900000) + 1000;
            // 軸のわずかな傾き。真っ直ぐだと工業製品に見える
            this.leanA = cfg.lean * rng.range(0.4, 1.7);
            this.leanRoll = rng.range(0, Math.PI * 2);
            // 片の大小のばらつき。ここが弱いと金型で抜いたように見える
            this.a1 = cfg.asymmetry * rng.range(0.7, 1.3);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            // 【対策】ここが無いと、どの個体も同じ形の石鹸に見える。
            //         実物のピーマンは片ごとに大きさが違い、しかも
            //         いちばん太る高さも片ごとにずれている
            this.lobeScale = []; this.lobeFat = []; this.lobePh = [];
            for (let k = 0; k < cfg.lobeCount; k++) {
                this.lobeScale.push(rng.range(1 - cfg.lobeVary, 1 + cfg.lobeVary));
                this.lobeFat.push(rng.gauss(0, cfg.lobeFatVary));
                this.lobePh.push(rng.range(0.22, 0.70));
            }
            // 肩の傾き。実物は真上から見ると必ずどこかへ寄っている
            this.skewAmt = rng.range(0.35, 1.65);
            this.skewA = rng.range(0, Math.PI * 2);
            // 【対策】模様と溝をずらさないため、個体差は「UVを回す量」で出す。
            //         ただし溝の底に頂点を置きたいので、回す量は 1/n の整数倍に
            this.uOff = rng.int(cfg.lobeCount) / cfg.lobeCount;

            this.parts = [];
            this.hullPts = [];
            this._buildBody(skin);
            this._buildCalyx(skin);
            this._buildStalk(skin);
            this.root = new BABYLON.TransformNode("piman", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 軸の傾き。y の高さに応じて横へずれる
        axisOffset(yn) {
            const d = this.leanA * this.H * (1 - yn) * (1 - yn);
            return { x: Math.cos(this.leanRoll) * d, z: Math.sin(this.leanRoll) * d };
        }

        // 断面半径の倍率
        // 【対策】面が数学的に滑らかだと、ハイライトが途切れずに一本の
        //         帯として流れ、ガラス玉にしか見えない。実物のピーマンは
        //         数mmの浅いへこみが全面に散っていて、それがハイライトを
        //         いくつにも割っている。ここが「野菜に見えるか」の分かれ目
        radialAt(t, uTex) {
            const cfg = this.cfg;
            const phi = uTex * Math.PI * 2;
            const cs = Math.cos(phi), sn = Math.sin(phi);
            const L = lobeAt(uTex, t, cfg);
            // 【対策】片ごとの倍率は溝で 1 に戻すこと。戻さないと隣の片との
            //         境目で半径が飛び、割れ目のような段差が出る
            const k = L.idx;
            const fat = 1 + this.lobeFat[k]
                * Math.exp(-Math.pow((t - this.lobePh[k]) / 0.20, 2));
            const lsc = 1 + (this.lobeScale[k] * fat - 1) * (1 - L.e);
            const asym = this.a1 * Math.cos(phi - this.p1)
                + this.a2 * Math.cos(2 * phi - this.p2);
            // 広いへこみ + それより細かいうねりの2帯域
            const d1 = Noise.fbm3(cs * 1.7, sn * 1.7, t * 2.8, this.nseed, 3) - 0.5;
            const d2 = Noise.fbm3(cs * 4.4, sn * 4.4, t * 7.2, this.nseed + 91, 2) - 0.5;
            const dent = cfg.dentAmt * (d1 + 0.42 * d2) * (0.35 + 0.65 * smooth(0.04, 0.30, t));
            return {
                r: L.r * lsc * (1 + asym * (0.35 + 0.65 * smooth(0.05, 0.5, t))) + dent,
                groove: L.groove
            };
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const P = profileAt(t, this.blocky);
                const yn = P.y;
                const off = this.axisOffset(yn);
                const ring = [];
                let ySum = 0;
                for (let j = 0; j <= M; j++) {
                    const w = (j % M) / M;
                    const phi = w * Math.PI * 2;
                    const S = this.radialAt(t, w + this.uOff);
                    const r = Math.max(0.002, this.R * P.r * S.r);
                    // 肩は片ごとにこぶ状に盛り上がり、さらに全体が片側へ傾く
                    const skew = cfg.shoulderSkew * this.skewAmt
                        * Math.cos(phi - this.skewA) * skewMask(t);
                    const y = this.H * (yn + shoulderAt(t, S.groove, cfg) + skew);
                    ring.push(new V3(off.x + Math.cos(phi) * r, y, off.z + Math.sin(phi) * r));
                    ySum += y;
                }
                rings.push(ring); centers.push(new V3(off.x, ySum / (M + 1), off.z));
            }
            const mesh = sweep("pimanBody", rings, centers, null, this.scene, this.uOff);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
            // 当たり判定用の粗い点群（凸包はここから起こす）
            for (let i = 0; i <= 16; i++) {
                const t = i / 16, P = profileAt(t, this.blocky), off = this.axisOffset(P.y);
                for (let j = 0; j < 14; j++) {
                    const w = j / 14, phi = w * Math.PI * 2;
                    const S = this.radialAt(t, w + this.uOff);
                    // 【対策】溝をそのまま凸包に入れても凸包は溝を埋めるだけで
                    //         無駄な面が増える。平均半径で丸めて面数を抑える
                    const r = this.R * P.r * (1 - this.cfg.lobeDepth * 0.35) * 0.99;
                    this.hullPts.push(new V3(off.x + Math.cos(phi) * r, this.H * P.y, off.z + Math.sin(phi) * r));
                }
            }
        }

        // がく：くぼみに収まる星形の板。厚みを持たせて閉じる
        // 【対策】1枚のシートで作ると裏側が見え、しかも透過パスに回ると
        //         果実を突き抜けて見える。上面・下面・縁の3枚で閉じた殻にする
        _buildCalyx(skin) {
            const cfg = this.cfg, K = cfg.calyxRings, M = cfg.calyxSides;
            const hubR = cfg.calyxHub * this.R;
            const outR = cfg.calyxR * this.R;
            const TH = cfg.calyxThick * this.R;
            const W = M + 1, LAY = (K + 1) * W, total = LAY * 2;
            const positions = new Float32Array(total * 3);
            const colors = new Float32Array(total * 4);
            const CA = cfg.calyx, CB = cfg.calyxBack;
            const star = (phi) => {
                const w = phi / (Math.PI * 2) * 5 + 0.5;
                const fr = w - Math.floor(w);
                const e = Math.abs(fr - 0.5) * 2;     // 0=とがり 1=切れ込み
                return 1 - cfg.starDepth * Math.pow(e, 1.25);
            };
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const st = star(phi);
                    const r = hubR + (outR * st - hubR) * Math.pow(s, 0.85);
                    const rn = clamp(r / this.R, 0.02, 0.62);
                    // 果実の肩の面に載せ、とがりの先だけわずかに反らせる。
                    // 肩の傾きは本体と同じ式で持ち上げる（片側が浮くのを防ぐ）
                    const wf = wellFind(rn, this.blocky);
                    let y = this.H * (wf.y + cfg.shoulderSkew * this.skewAmt
                        * Math.cos(phi - this.skewA) * skewMask(wf.t))
                        + cfg.calyxLift * this.R
                        + cfg.calyxCurl * this.R * smooth(0.72, 1.0, s) * st;
                    const off = this.axisOffset(y / this.H);
                    const a = i * W + j, b = LAY + a;
                    positions[a * 3] = off.x + Math.cos(phi) * r;
                    positions[a * 3 + 1] = y;
                    positions[a * 3 + 2] = off.z + Math.sin(phi) * r;
                    positions[b * 3] = off.x + Math.cos(phi) * r * 0.988;
                    positions[b * 3 + 1] = y - TH;
                    positions[b * 3 + 2] = off.z + Math.sin(phi) * r * 0.988;
                    const g = 0.90 + 0.20 * Noise.fbm3(Math.cos(phi) * 6, Math.sin(phi) * 6, s * 7, this.nseed + 5, 2);
                    const tipd = smooth(0.70, 1.0, s) * 0.35;
                    for (let c = 0; c < 3; c++) {
                        colors[a * 4 + c] = srgb(mix(CA[c], CA[c] * 0.72, tipd) * g);
                        colors[b * 4 + c] = srgb(CB[c] * g);
                    }
                    colors[a * 4 + 3] = 1; colors[b * 4 + 3] = 1;
                }
            }
            const indices = [];
            for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
                const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
                indices.push(A, C, B, B, C, D);
                indices.push(LAY + A, LAY + B, LAY + C, LAY + B, LAY + D, LAY + C);
            }
            for (let j = 0; j < M; j++) {          // 外縁
                const o0 = K * W + j, o1 = o0 + 1;
                indices.push(o0, LAY + o0, o1, o1, LAY + o0, LAY + o1);
            }
            for (let j = 0; j < M; j++) {          // 内縁（果柄が覆う）
                indices.push(j, j + 1, LAY + j, j + 1, LAY + j + 1, LAY + j);
            }
            const refI = Math.round(K * 0.5);
            const normals = finalize(positions, indices,
                new V3(0, this.H * wellY(0.30, this.blocky) - TH * 2, 0), false, refI * W);
            weldNormals(positions, normals);
            const mesh = makeMesh("pimanCalyx", positions, indices, normals, null, colors, this.scene);
            mesh.material = skin.calyx;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
        }

        // 果柄：太くて短く、少し曲がる。切り口は乾いて淡い
        _buildStalk(skin) {
            const cfg = this.cfg, rng = this.rng, K = cfg.stalkSegments, M = cfg.stalkSides;
            const baseY = this.H * wellY(0.10, this.blocky);
            const L = cfg.stalkLen * this.H * rng.range(0.85, 1.15);
            const bend = cfg.stalkBend * rng.range(0.4, 1.5), bendA = rng.range(0, Math.PI * 2);
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const y = baseY + L * s;
                const off = this.axisOffset(y / this.H);
                const dx = Math.cos(bendA) * bend * L * s * s;
                const dz = Math.sin(bendA) * bend * L * s * s;
                const cx = off.x + dx, cz = off.z + dz;
                // 根元は太く広がり、上へ向けて緩く絞る
                const taper = 1 + 0.35 * Math.pow(1 - s, 2.4) - 0.22 * smooth(0.55, 1.0, s);
                const rr = cfg.stalkR * this.R * taper;
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    // 果柄は縦に稜がある
                    const flute = 1 + 0.075 * Math.cos(cfg.stalkFlute * phi + s * 0.8);
                    const r = rr * flute;
                    ring.push(new V3(cx + Math.cos(phi) * r, y, cz + Math.sin(phi) * r));
                }
                rings.push(ring); centers.push(new V3(cx, y, cz));
                if (i % 4 === 0 || i === K) this.hullPts.push(new V3(cx, y, cz));
            }
            const LOW = cfg.stalk, HI = [cfg.stalk[0] * 1.25, cfg.stalk[1] * 1.15, cfg.stalk[2] * 1.3];
            const CUT = cfg.stalkCut;
            const colsFn = (v, u) => {
                const w = smooth(0.08, 0.80, v);
                const cut = smooth(0.93, 1.0, v);
                const g = 0.90 + 0.20 * Noise.fbm3(Math.cos(u * 6.28) * 5, Math.sin(u * 6.28) * 5, v * 9, this.nseed + 7, 2);
                return [
                    srgb(mix(mix(LOW[0], HI[0], w), CUT[0], cut) * g),
                    srgb(mix(mix(LOW[1], HI[1], w), CUT[1], cut) * g),
                    srgb(mix(mix(LOW[2], HI[2], w), CUT[2], cut) * g)
                ];
            };
            const mesh = sweep("pimanStalk", rings, centers, colsFn, this.scene, 0);
            mesh.material = skin.calyx;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュから凸包を取ると生成が重いので、
        // 粗い点群から起こす。果柄まで含めないと果柄だけ籠を突き抜ける
        hullShape() {
            const pos = [];
            for (const p of this.hullPts) pos.push(p.x, p.y, p.z);
            const proxy = new BABYLON.Mesh("pimanProxy", this.scene);
            const vd = new BABYLON.VertexData();
            vd.positions = pos;
            const idx = [];
            for (let i = 0; i + 2 < this.hullPts.length; i++) idx.push(i, i + 1, i + 2);
            vd.indices = idx;
            vd.applyToMesh(proxy, false);
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
        console.warn("[Piman] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    // 【対策】つやのある果実は、映り込む環境そのものが見た目を決める。
    //         lodGenerationOffset を上げてぼかすと、ハイライトが
    //         のっぺりした白い面になって安っぽくなる
    // 【対策】映り込みを鮮明にしすぎると、周囲が果皮に「写って」しまい
    //         ガラス玉に見える。少しぼかして照りだけ残す
    env.lodGenerationOffset = 0.45;
    scene.environmentIntensity = 0.68;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.20, 46, new V3(0, 2.0, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 12;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 4;
    camera.maxZ = 220;
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 120;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = new V3(16, 28, -18);
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.68, 0.68, 0.64);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.0;
    fillL.diffuse = new BABYLON.Color3(0.96, 1.0, 0.96);
    fillL.specular = new BABYLON.Color3(0.32, 0.34, 0.30);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.55;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.76, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 32;
    sg.depthScale = 30;
    sg.darkness = 0.48;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 1.10;
    ip.vignetteEnabled = false;

    let ground = null;
    if (GLOBAL.showGround) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 180, height: 2, depth: 180 }, scene);
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
        bShape.material = { friction: 0.78, restitution: 0.0 };
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
    //         反発が一気に解放されて弾け飛ぶ。1個ずつ、山の頂点のすぐ上から放す
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
                rng.gauss(0, 0.9), rng.range(0, Math.PI * 2), rng.gauss(0, 0.9));
            const r = GLOBAL.basketRim * 0.34 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            for (let i = 0; i < items.length; i++) {
                items[i].root.position.set(
                    (i - (items.length - 1) / 2) * items[i].R * 2.4,
                    GLOBAL.basketThick + items[i].H * 0.5, 0);
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
            items.push(new Pepper(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.35, 0);
        camera.radius = cfg.basketRim * 3.4;

        resetDrop(seed);
        console.log("[Piman]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "個",
            "/ 断面分割", cfg.segmentsRound, "(片", cfg.lobeCount, "枚の倍数)");
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
        ssao.radius = 0.9;
        ssao.totalStrength = 0.85;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 160;
        ssao.minZAspect = 0.3;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    // 【対策】つやのある果実はハイライトが飽和しやすい。閾値を下げすぎると
    //         果実全体がにじんで発光しているように見える
    dp.bloomThreshold = 0.99;
    dp.bloomWeight = 0.05;
    dp.bloomKernel = 32;
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
        idle: "#16240f", active: "#3a6a1f", edge: "#324427",
        text: "#eef5e9", sub: "#a8bd99", accent: "#a6d46f"
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

    addLabel("PIMAN", 11, COL.sub, "18px");
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

    addLabel("個数", 13, COL.accent, "26px");
    for (const c of [3, 5, 8]) {
        countBtns[c] = addButton("c" + c, c + " 個", () => {
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
        info.text = state + " / " + items.length + "個 / 高さ " + (e.H * 1.035).toFixed(1)
            + "cm 幅 " + (e.R * 2).toFixed(1) + "cm\nseed: " + curSeed + "  [" + BUILD + "]";
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