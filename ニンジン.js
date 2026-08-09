// =====================================================================
//  Photoreal Carrot  /  写実的な人参
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（五寸 / 金時 / ミニ）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 円錐プロファイル / 輪紋 / 側根痕
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Carrot      … 根 + 肩の切り口（断面）
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  きゅうり版からの主な違い:
//    ・形が円錐。肩がいちばん太く、そこから先端までひたすら細る
//    ・縦の稜ではなく「輪紋」。軸に直交する浅い溝が全長に並ぶ
//    ・イボではなく「側根痕」。細い根が出ていた小さな窪みが、
//      ゆるい螺旋を描く4本前後の縦列に並ぶ
//    ・ヘタではなく「切り口」。肩が平らに切られ、外側の橙（皮層）と
//      内側の淡黄（芯・木部）が同心円に見える
//    ・艶は控えめ。洗った直後でもきゅうりほどは光らない
//    ・白っぽい横向きの擦り傷が目立つ。これが無いとゴム製に見える
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        gosun: {
            label: "五寸人参",
            length: 18.0, radius: 2.05,
            fullness: 1.00,
            taperPow: 1.00,                  // 大きいほど早く細る
            bendA: 0.016, bendB: 0.008,
            asymmetry: 0.026,

            // 輪紋（りんもん）
            // 【対策】輪紋は法線マップで出す。頂点でも刻もうとすると、
            //         軸方向の分割数（176〜120）に対して周期が細かすぎて
            //         エイリアスが起き、太さの違う縞が周期的に現れる
            ringCount: 46, ringSharp: 5.2, ringDepth: 0.55, ringBreak: 0.55,

            // 側根痕（そっこんこん）
            // 【対策】実物の痕は直径 1〜2mm。大きく作るとゴーヤになる。
            //         また「列」をなしていることが人参らしさの要なので、
            //         セル状にばら撒くのではなく縦列 + 螺旋で置く
            rootRows: 4, rootPerRow: 15, rootSpiral: 0.22,
            rootSize: 0.013, rootDensity: 0.56,
            rootAmp: 0.014, rootRidge: 0.013,
            uvAspect: 2.30,                  // 全長 : 平均円周

            // 色（sRGB）
            skinShoulder: [0.880, 0.400, 0.115],  // 肩側の濃い橙
            skinMid: [0.945, 0.485, 0.150],
            skinTip: [0.960, 0.650, 0.360],       // 先端は淡く抜ける
            ringDark: [0.690, 0.300, 0.080],      // 溝の底（下地よりわずかに暗い程度）
            scratch: [0.990, 0.845, 0.665],       // 白っぽい擦り傷
            rootDot: [0.605, 0.290, 0.100],       // 側根痕の芯
            crownEdge: [0.560, 0.300, 0.110],     // 切り口のふち（皮の断面）
            crownFlesh: [0.885, 0.845, 0.560],    // 切り口の地色
            crownCore: [0.795, 0.800, 0.500],     // 中心のくぼみ
            crownLeaf: [0.560, 0.610, 0.290],     // 葉柄の跡
            crownGreen: [0.420, 0.480, 0.210],    // 日に当たった肩の緑

            crownLen: 0.010, crownRadius: 0.360,
            skinRoughness: 0.46, waxIntensity: 0.35, dryness: 0.14
        },
        kintoki: {
            label: "金時人参",
            length: 29.0, radius: 1.72,
            fullness: 0.98,
            taperPow: 0.78,                  // 胴が長く保たれ、先で一気に細る
            bendA: 0.026, bendB: 0.012,
            asymmetry: 0.022,
            ringCount: 64, ringSharp: 5.6, ringDepth: 0.60, ringBreak: 0.50,
            rootRows: 4, rootPerRow: 22, rootSpiral: 0.30,
            rootSize: 0.012, rootDensity: 0.50,
            rootAmp: 0.015, rootRidge: 0.011,
            uvAspect: 3.10,
            // 金時はカロテンではなくリコピン。橙ではなく深い紅
            skinShoulder: [0.700, 0.145, 0.100],
            skinMid: [0.815, 0.200, 0.130],
            skinTip: [0.890, 0.420, 0.320],
            ringDark: [0.570, 0.110, 0.085],
            scratch: [0.960, 0.705, 0.620],
            rootDot: [0.475, 0.145, 0.090],
            crownEdge: [0.470, 0.150, 0.090],
            crownFlesh: [0.870, 0.820, 0.560],
            crownCore: [0.785, 0.770, 0.500],
            crownLeaf: [0.520, 0.575, 0.275],
            crownGreen: [0.380, 0.430, 0.185],
            crownLen: 0.008, crownRadius: 0.330,
            skinRoughness: 0.42, waxIntensity: 0.42, dryness: 0.10
        },
        mini: {
            label: "ミニキャロット",
            length: 10.5, radius: 1.20,
            fullness: 1.04,
            taperPow: 0.86,                  // ずんぐりして先が丸い
            bendA: 0.012, bendB: 0.006,
            asymmetry: 0.020,
            ringCount: 27, ringSharp: 4.6, ringDepth: 0.50, ringBreak: 0.60,
            rootRows: 4, rootPerRow: 10, rootSpiral: 0.18,
            rootSize: 0.015, rootDensity: 0.58,
            rootAmp: 0.013, rootRidge: 0.012,
            uvAspect: 1.55,
            skinShoulder: [0.915, 0.455, 0.135],
            skinMid: [0.965, 0.545, 0.185],
            skinTip: [0.975, 0.700, 0.420],
            ringDark: [0.745, 0.350, 0.095],
            scratch: [0.992, 0.870, 0.700],
            rootDot: [0.645, 0.330, 0.115],
            crownEdge: [0.590, 0.330, 0.125],
            crownFlesh: [0.900, 0.860, 0.580],
            crownCore: [0.815, 0.820, 0.520],
            crownLeaf: [0.585, 0.635, 0.310],
            crownGreen: [0.440, 0.500, 0.225],
            crownLen: 0.014, crownRadius: 0.400,
            skinRoughness: 0.44, waxIntensity: 0.40, dryness: 0.12
        }
    };

    const GLOBAL = {
        count: 5,                  // 本数

        // 籠（ざる）
        basketRim: 18.0,           // 縁の半径 cm
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
        gravity: 620,              // cm/s^2（実寸どおりなら 981）
        physicsHz: 120,            // 固定タイムステップ
        pieceMass: 1.0,
        friction: 0.88,            // 人参は表面が粗く、転がりにくい
        restitution: 0.02,
        linearDamping: 0.15,
        angularDamping: 0.90,
        dropInterval: 0.26,
        dropClearance: 1.6,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 5.0,

        segmentsAxis: 176,
        segmentsRound: 96,
        crownSegments: 22,
        crownSides: 40,

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

    const START_VARIETY = "gosun";
    const START_SEED = 20260726;
    const BUILD = "ninjin-A";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】輪紋と側根痕の位置は、ジオメトリの変位とテクスチャの両方が
        //         同じものを見ていなければならない。テクスチャは品種単位で
        //         キャッシュされるので、種も品種名から決めて個体乱数から切り離す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.rootSeed = (h >>> 0) % 100000;
        if (cfg.count > 3) { cfg.segmentsAxis = 120; cfg.segmentsRound = 64; }
        return cfg;
    }

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
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
    function sweep(name, rings, centers, colsFn, scene) {
        const N = rings.length, M = rings[0].length;
        const total = N * M + 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const colors = colsFn ? new Float32Array(total * 4) : null;
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                const k = i * M + j, p = rings[i][j];
                positions[k * 3] = p.x; positions[k * 3 + 1] = p.y; positions[k * 3 + 2] = p.z;
                uvs[k * 2] = j / (M - 1); uvs[k * 2 + 1] = i / (N - 1);
                if (colors) {
                    const c = colsFn(i / (N - 1), j / (M - 1));
                    colors[k * 4] = c[0]; colors[k * 4 + 1] = c[1]; colors[k * 4 + 2] = c[2]; colors[k * 4 + 3] = 1;
                }
            }
        }
        const capA = N * M, capB = N * M + 1;
        positions[capA * 3] = centers[0].x; positions[capA * 3 + 1] = centers[0].y; positions[capA * 3 + 2] = centers[0].z;
        positions[capB * 3] = centers[N - 1].x; positions[capB * 3 + 1] = centers[N - 1].y; positions[capB * 3 + 2] = centers[N - 1].z;
        uvs[capA * 2] = 0.5; uvs[capA * 2 + 1] = 0;
        uvs[capB * 2] = 0.5; uvs[capB * 2 + 1] = 1;
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
        //         頂点法線が裏返る。そこを基準に巻き順を判定すると、
        //         個体によってメッシュ全体が反転し、backFaceCulling で
        //         手前の面が消えて「中が見える」状態になる
        for (let j = 0; j < M - 1; j++) indices.push(capA, j, j + 1);
        const o = (N - 1) * M;
        for (let j = 0; j < M - 1; j++) indices.push(capB, o + j + 1, o + j);

        // 【対策】判定の基準は端ではなく胴の中央。半径が大きく法線が素直に
        //         外を向いており、個体によらず安定する
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], false, refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Profile / 輪紋 / 側根痕
    // =================================================================
    // [軸方向 t, 半径比]。t=0 が肩の中心（切り口）、t=1 が先端
    // 【対策1】人参は円錐。胴を平行にすると大根になり、中央を膨らませると
    //          サツマイモになる。最大径は肩のすぐ下（t≈0.17）
    // 【対策2】肩を平らに切り落とすと断面が肩と同径になり、サラミの輪切りに
    //          見える。実物の肩は丸いドームで、葉を落とした切り口は
    //          肩の直径の1/3ほどしかない。t=0 の半径を小さく取り、
    //          そこから急に立ち上げてドームを作る
    // 【対策3】先端を 0 まで細らせると針になって刺さって見える。
    //          実物は丸みを残して終わる
    const PROFILE = [
        [0.000, 0.340], [0.008, 0.575], [0.020, 0.760], [0.040, 0.890],
        [0.070, 0.962], [0.115, 0.994], [0.170, 1.000], [0.250, 0.987],
        [0.350, 0.952], [0.460, 0.900], [0.570, 0.832], [0.670, 0.752],
        [0.760, 0.662], [0.835, 0.562], [0.897, 0.452], [0.945, 0.338],
        [0.978, 0.222], [1.000, 0.090]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 【対策】制御点の1列目に t を書きながら添字を等間隔とみなして補間すると、
    //         書いた位置と実際の形が食い違う。t で区間を引いてから補間する
    function profileAt(t) {
        const P = PROFILE, n = P.length;
        t = clamp(t, 0, 1);
        let i = 1;
        while (i < n - 1 && P[i][0] < t) i++;
        const t0 = P[i - 1][0], t1 = P[i][0];
        const u = (t1 > t0) ? (t - t0) / (t1 - t0) : 0;
        return Math.max(0, catmull(
            P[Math.max(0, i - 2)][1], P[i - 1][1], P[i][1], P[Math.min(n - 1, i + 1)][1], u));
    }

    // 輪紋。軸にほぼ直交する浅い溝。戻り値は溝の深さ 0..1
    // 【対策1】溝が全周でつながっていると蛇腹ホースかネジ山になる。
    //          実物の輪紋は「短い弧が途切れながら並ぶ」もので、一周ぐるりと
    //          回っている溝はほとんど無い。周方向のマスクで切って弧にする
    // 【対策2】間隔が一定だと旋盤で挽いた木工品になる。位相を大きく歪ませて
    //          間隔をばらつかせ、さらに溝ごとに濃さを変える。
    //          歪ませる量が周期の 1/3 に満たないと規則性が残る
    // 【対策3】溝は「細い線」。pow の指数が小さいと帯になり、縞模様の
    //          チューブに見える。指数は 5 前後まで上げて線に近づける
    function ringAt(t, phi, cfg) {
        const warp = 1.15 * (Noise.fbm3(Math.cos(phi) * 0.9, Math.sin(phi) * 0.9,
            t * 2.6, cfg.rootSeed + 51, 2) - 0.5);
        const s = t * cfg.ringCount + warp;
        const c = 0.5 + 0.5 * Math.cos(TAU * s);
        let g = Math.pow(c, cfg.ringSharp);
        // 何本目の溝か。弧の切れ方と濃さは溝ごとに独立させる
        const k = Math.floor(s + 0.5);
        const arc = Noise.fbm2u(phi / TAU * 5, k * 3.1, 5, cfg.rootSeed + 77, 2);
        g *= smooth(0.62 - cfg.ringBreak * 0.35, 0.62 + cfg.ringBreak * 0.35, arc);
        g *= 0.30 + 0.90 * Noise._h2(k, 3, cfg.rootSeed + 91);
        // 肩と先端では消える
        const w = smooth(0.015, 0.10, t) * (1 - smooth(0.86, 0.985, t));
        return g * w * cfg.ringDepth;
    }

    // 側根痕。u は周方向（0..1、周期的）、v は軸方向（0..1）
    // 【対策】ボロノイでばら撒くと苺の種になる。人参の痕は必ず
    //         数本の縦列をなし、その列が根の伸長でゆるく螺旋を描く。
    //         列の存在を先に決めてから、列に沿って痕を置く
    function rootletAt(u, v, cfg) {
        const ends = smooth(0.05, 0.15, v) * (1 - smooth(0.88, 0.98, v));
        if (ends <= 0.001) return { pit: 0, dot: 0 };
        const seed = cfg.rootSeed, rows = cfg.rootRows, per = cfg.rootPerRow;
        const gv = v * per, cv = Math.floor(gv);
        let bestD = 1e9, bestE = 1e9, bestS = 1;
        for (let k = 0; k < rows; k++) {
            const base = k / rows + Noise._h2(k, 7, seed) * (0.7 / rows);
            for (let dv = -1; dv <= 1; dv++) {
                const iv = cv + dv;
                const on = Noise._h2(k, iv, seed + 2411);
                if (on < cfg.rootDensity) continue;      // 抜けているところ
                const h1 = Noise._h2(k, iv, seed + 811);
                const h2 = Noise._h2(k, iv, seed + 1607);
                const pv = (iv + 0.18 + 0.64 * h1) / per;
                let pu = base + cfg.rootSpiral * pv + (h2 - 0.5) * 0.055;  // 列の蛇行
                pu -= Math.floor(pu);
                let du = Math.abs(u - pu); if (du > 0.5) du = 1 - du;
                // 【対策】u は円周1周、v は全長。人参は細長いので1単位あたりの
                //         実長が数倍違う。この比を掛けないと痕が縦に潰れた楕円になる
                const dw = (v - pv) * cfg.uvAspect;
                const d = Math.hypot(du, dw);
                // 【対策】痕の芯は真円ではなく、横向きの短いひび割れとして残る。
                //         真円の点にすると苺の種か虫食い穴に見える
                const e = Math.hypot(du / 2.4, dw);
                if (d < bestD) { bestD = d; bestS = cfg.rootSize * (0.60 + 0.85 * on); }
                if (e < bestE) bestE = e;
            }
        }
        if (bestD > bestS) return { pit: 0, dot: 0 };
        const pit = smooth(bestS, bestS * 0.22, bestD) * ends;
        const dot = smooth(bestS * 0.60, bestS * 0.12, bestE) * ends;
        return { pit, dot };
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

        // 果皮の場をまとめて1回で焼く
        // 【対策】アルベド・ORM・法線を別々に計算すると、輪紋や側根痕を
        //         3回評価することになって生成が数秒かかるうえ、実装がずれると
        //         「粒の上にぼんやりした汚れが乗った」ように見える。
        //         場は一度だけ作って3枚で共有する
        fields(size, cfg) {
            const n = size * size;
            const F = {
                h: new Float32Array(n),      // 高さ（法線用）
                ring: new Float32Array(n),   // 輪紋の溝
                pit: new Float32Array(n),    // 側根痕の窪み
                dot: new Float32Array(n),    // 側根痕の芯
                scr: new Float32Array(n)     // 白っぽい擦り傷
            };
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    const phi = u * TAU;
                    const g = ringAt(v, phi, cfg);
                    const R = rootletAt(u, v, cfg);
                    // 縦に走る細い繊維と、細かい肌理
                    const fib = Noise.fbm2u(u * 44, v * 240, 44, cfg.rootSeed + 11, 2);
                    const cell = Noise.fbm2u(u * 90, v * 96, 90, cfg.rootSeed + 23, 2);
                    // 擦り傷：横に長く、縦に細い
                    // 【対策】洗い場やコンテナで擦れた白い筋こそが人参の顔。
                    //         輪紋より目立って初めて実物に見える。1層だと
                    //         太さが揃ってしまうので、長い筋と細い筋を重ねる
                    // 【対策】u の周期を 2〜6 にすると、1本の筋が円周の半分近くを
                    //         占めて「白い輪」になる。実物の傷は 1〜3cm、円周の
                    //         1/6 程度しかない。u の周波数を上げて短く切る。
                    //         また x に v の一次項を足すと（u の周期性は保たれる）
                    //         筋が斜めに走り、真横に揃った不自然さが消える
                    const sc1 = Noise.fbm2u(u * 8 + v * 3.4, v * 150, 8, cfg.rootSeed + 61, 2);
                    const sc2 = Noise.fbm2u(u * 16 - v * 5.0, v * 400, 16, cfg.rootSeed + 83, 2);
                    const scEnds = smooth(0.05, 0.18, v) * (1 - smooth(0.86, 0.99, v));
                    F.ring[i] = g;
                    F.pit[i] = R.pit;
                    F.dot[i] = R.dot;
                    F.scr[i] = clamp(smooth(0.68, 0.88, sc1) * 0.85
                        + smooth(0.74, 0.94, sc2) * 0.60, 0, 1) * scEnds;
                    // 【対策】高さ場に輪紋を強く入れると法線マップが波板になる。
                    //         溝は「浅い線」なので寄与は控えめでよい
                    F.h[i] = clamp(0.62 - 0.26 * g - 0.34 * R.pit
                        + 0.05 * F.scr[i] + 0.10 * (fib - 0.5) + 0.07 * (cell - 0.5), 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const SH = cfg.skinShoulder, MD = cfg.skinMid, TP = cfg.skinTip;
            const RD = cfg.ringDark, SC = cfg.scratch, DT = cfg.rootDot;
            return this._tex("ninjinAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = y * N + x, o = i * 4;
                        // 【対策】一様な橙にすると玩具になる。肩が濃く、
                        //         先端へ向かって淡く白っぽく抜けていく
                        let cr = mix(SH[0], MD[0], smooth(0.02, 0.28, v));
                        let cg = mix(SH[1], MD[1], smooth(0.02, 0.28, v));
                        let cb = mix(SH[2], MD[2], smooth(0.02, 0.28, v));
                        const tip = smooth(0.58, 1.0, v);
                        cr = mix(cr, TP[0], tip * 0.90);
                        cg = mix(cg, TP[1], tip * 0.90);
                        cb = mix(cb, TP[2], tip * 0.90);
                        // 濃淡のムラ（横に引き伸ばす）
                        const mott = 0.90 + 0.20 * Noise.fbm2u(u * 4, v * 16, 4, cfg.rootSeed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 縦に走る繊維のごく淡い筋
                        const grain = 0.965 + 0.070 * Noise.fbm2u(u * 60, v * 8, 60, cfg.rootSeed + 5, 2);
                        cr *= grain; cg *= grain; cb *= grain;
                        // 輪紋の溝はわずかに沈む
                        // 【対策】溝を濃い色でしっかり塗ると、それだけで
                        //         縞模様のチューブになる。実物の溝は陰影で
                        //         見えているだけで、色そのものはほとんど変わらない。
                        //         色差は最小限にして、立体感は法線と AO に任せる
                        const g = F.ring[i];
                        const gk = smooth(0.03, 0.26, g);
                        cr = mix(cr, RD[0], gk * 0.10);
                        cg = mix(cg, RD[1], gk * 0.10);
                        cb = mix(cb, RD[2], gk * 0.10);
                        // 側根痕：窪みが暗く、中心に濃い芯が残る
                        const pit = F.pit[i], dot = F.dot[i];
                        if (pit > 0.001) {
                            const b = smooth(0.08, 0.55, pit) * 0.18;
                            cr = mix(cr, RD[0], b); cg = mix(cg, RD[1], b); cb = mix(cb, RD[2], b);
                            const c = smooth(0.20, 0.85, dot) * 0.30;
                            cr = mix(cr, DT[0], c); cg = mix(cg, DT[1], c); cb = mix(cb, DT[2], c);
                        }
                        // 擦り傷
                        // 【対策】傷は溝の中には入らない。峰の上だけを走らせないと
                        //         白い網目に見えてカビのようになる
                        const s = F.scr[i] * (1 - gk * 0.75);
                        cr = mix(cr, SC[0], s * 0.80);
                        cg = mix(cg, SC[1], s * 0.80);
                        cb = mix(cb, SC[2], s * 0.80);
                        // 先端の乾いた白ちゃけ
                        const dry = smooth(0.955, 1.0, v);
                        cr = mix(cr, 0.90, dry * 0.55);
                        cg = mix(cg, 0.76, dry * 0.55);
                        cb = mix(cb, 0.60, dry * 0.55);
                        // 肌理による微小な明暗
                        const k = 0.94 + 0.12 * F.h[i];
                        d[o] = clamp(cr * k, 0, 1) * 255;
                        d[o + 1] = clamp(cg * k, 0, 1) * 255;
                        d[o + 2] = clamp(cb * k, 0, 1) * 255;
                        d[o + 3] = 255;
                    }
                }
            }, scene);
        },

        // R=AO / G=roughness
        orm(scene, size, cfg, F) {
            return this._tex("ninjinORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = y * N + x, o = i * 4;
                        let rough = cfg.skinRoughness * (0.90 + 0.28 * (1 - F.h[i]));
                        // 【対策】人参はきゅうりのように光らない。艶を上げると
                        //         プラスチックの模型になる。逆に一様に粗くすると
                        //         乾いた木片になるので、湿った部分だけ滑らかにする
                        const wet = Noise.fbm2u(u * 5, v * 11, 5, cfg.rootSeed + 41, 3);
                        rough = mix(rough, cfg.skinRoughness * 0.66, smooth(0.52, 0.90, wet));
                        // 擦り傷は乾いていて明らかに粗い
                        rough = mix(rough, 0.78, F.scr[i] * (0.55 + cfg.dryness));
                        // 溝の底と側根痕は粗い
                        rough = mix(rough, 0.72, smooth(0.04, 0.26, F.ring[i]) * 0.40);
                        rough = mix(rough, 0.76, smooth(0.10, 0.60, F.pit[i]));
                        // 先端は乾く
                        rough = mix(rough, 0.80, smooth(0.94, 1.0, v));
                        let ao = 1.0;
                        ao = mix(ao, 0.91, smooth(0.03, 0.24, F.ring[i]));
                        ao = mix(ao, 0.62, smooth(0.06, 0.45, F.pit[i]));
                        d[o] = clamp(ao, 0, 1) * 255;
                        d[o + 1] = clamp(rough, 0.03, 1) * 255;
                        d[o + 2] = 0; d[o + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, hf, strength) {
            return this._tex("ninjinNormal", size, (d, N) => {
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
            // 【対策】明暗差を付けすぎると将棋盤になる。竹ひごの上下は
        //         色ではなく陰影の差でしかない。目も実物はもっと細かい
        const OVER = [0.870, 0.795, 0.625], UNDER = [0.795, 0.710, 0.535], GAP = [0.560, 0.475, 0.335];
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
    //  マテリアル（品種ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const F = TextureLab.fields(S, cfg);
            this.albedoTex = TextureLab.albedo(scene, S, cfg, F);
            this.ormTex = TextureLab.orm(scene, S, cfg, F);
            this.normalTex = TextureLab.normal(scene, S, F.h, 1.35);
            // 【対策】細い溝と擦り傷は縮小時にモアレを起こす。
            //         籠に盛ると1本あたりが小さく写るので効きが大きい
            for (const t of [this.albedoTex, this.ormTex, this.normalTex]) {
                t.anisotropicFilteringLevel = 8;
            }

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("ninjinSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.70;          // 輪紋はここで立たせる
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】人参の艶はきゅうりよりずっと弱い。クリアコートを
            //         きゅうりと同じ強さで乗せると、洗って濡れたどころか
            //         ニスを塗った木彫りになる
            m.clearCoat.isEnabled = true;
            m.clearCoat.intensity = 0.22 * cfg.waxIntensity;
            m.clearCoat.roughness = 0.42;
            m.clearCoat.indexOfRefraction = 1.42;
            // 果肉の透け。細い先端がわずかに明るく抜ける
            // 【対策】人参は不透明に見えて先端はよく光を通す。
            //         ただし全体に効かせると飴細工になるので厚み下限を大きく取る
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.95, 0.42, 0.12);
            m.subSurface.translucencyIntensity = 0.16;
            m.subSurface.minimumThickness = 0.8;
            m.subSurface.maximumThickness = 3.2;
            this.skin = m;

            const ct = new BABYLON.PBRMaterial("ninjinCrown", scene);
            ct.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            ct.metallic = 0.0;
            ct.roughness = 0.62;                            // 切り口は乾いて艶が無い
            ct.transparencyMode = OPAQUE;
            ct.zOffset = -2;
            ct.zOffsetUnits = -16;
            this.crown = ct;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.crown.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Carrot
    // =================================================================
    class Carrot {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.90, 1.10);
            this.R = cfg.radius * rng.range(0.92, 1.08) * cfg.fullness;
            this.nseed = rng.int(900000) + 1000;
            // 曲がりの向きと量。真っ直ぐな人参は樹脂成型品に見える
            this.bendA = cfg.bendA * rng.range(0.5, 1.8) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.2, 1.2);
            this.bendRoll = rng.range(0, TAU);
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, TAU);
            this.p2 = rng.range(0, TAU);
            this.rowPhase = rng.range(0, TAU);
            // 日に当たって肩が緑がかっている個体は半分くらい
            this.crownGreenAmt = rng.next() < 0.55 ? rng.range(0.15, 0.55) : 0.0;
            this.crownTilt = rng.range(-0.10, 0.10);
            this.crownPhase = rng.range(0, TAU);
            this.crownLobes = 5 + rng.int(4);        // 葉柄の跡の数

            this.parts = [];
            this.crownAxis = [];
            this._buildBody(skin);
            this._buildCrown(skin);
            this.root = new BABYLON.TransformNode("ninjin", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 軸は X。曲がりは bendRoll の向きの平面内
        spineAt(t) {
            const off = this.bendA * Math.sin(Math.PI * t) + this.bendB * Math.sin(TAU * t);
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
        // 断面半径の倍率
        // 【対策】輪紋そのものはここでは刻まない。ringCount は 26〜62 あり、
        //         軸方向の分割数（176、多本数時は 120）では2〜4サンプルしか
        //         取れず、確実にモアレになる。細かい溝は法線マップの仕事。
        //         ここで扱うのは、分割数で確実に表現できる低周波だけ
        sectionAt(t, phi) {
            const cfg = this.cfg;
            // 側根痕の列に沿った、ごく浅い縦の稜。人参の断面がわずかに
            // 角張って見えるのはこれのせい
            const rows = cfg.rootRows;
            const ridge = cfg.rootRidge
                * Math.cos(rows * (phi - TAU * cfg.rootSpiral * t) + this.rowPhase)
                * (0.45 + 0.55 * Math.sin(Math.PI * t));
            // 低周波の非対称。これが無いと完全な回転体になり、
            // ハイライトが直線になって樹脂に見える
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            const wob = 0.016 * (Noise.fbm3(Math.cos(phi) * 2.2, Math.sin(phi) * 2.2, t * 4.5, this.nseed, 3) - 0.5);
            // 側根痕の窪み。テクスチャと同じ場を使うので法線マップと位置が揃う
            const u = ((phi / TAU) % 1 + 1) % 1;
            const pit = rootletAt(u, t, cfg).pit;
            return 1 + ridge + asym + wob - cfg.rootAmp * pit;
        }
        radiusAt(t, phi) {
            const base = Math.pow(profileAt(t), this.cfg.taperPow);
            return Math.max(0.004, this.R * base * this.sectionAt(t, phi));
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const r = this.radiusAt(t, phi);
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r
                    ));
                }
                rings.push(ring); centers.push(c);
            }
            const mesh = sweep("ninjinBody", rings, centers, null, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // 肩の切り口。葉を落とした断面が平らに露出している
        // 【対策】この断面を1枚のディスクで作ると色が一様になり、シールを
        //         貼ったように見える。sweep の v が「側面 → 断面の外周 →
        //         中心」と連続するようにリングを並べれば、v だけの関数で
        //         皮 / 皮層 / 芯の同心円が自然に描ける
        _buildCrown(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.crownSegments, M = cfg.crownSides;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);                       // 根から離れる向き
            const H = cfg.crownLen * this.L * rng.range(0.85, 1.15);
            const tiltA = rng.range(0, TAU);
            const side = f0.N.scale(Math.cos(tiltA)).add(f0.B.scale(Math.sin(tiltA)));
            const R0 = cfg.crownRadius * this.R;

            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                let rr, yy;
                if (s <= 0.62) {
                    // 側面。s=0 は本体の内側に潜らせる
                    // 【対策】切り口の底面キャップは本体の肩のキャップと同一平面に
                    //         なりやすく、そのままだと Z ファイティングで
                    //         ちらつく。始点を本体の中へ埋めれば底面は永久に見えない
                    const q = s / 0.62;
                    rr = R0 - 0.030 * this.R * smooth(0, 1, q);
                    yy = H * (1.25 * s - 0.25);
                } else {
                    // 平らな断面。外周を細かく、中心を粗く刻む
                    // 【対策】切り口は平らではなく、中心がわずかに凹んで
                    //         そのふちに葉柄の跡が輪を作る。真っ平らにすると
                    //         シールを貼ったように見える
                    const q = (s - 0.62) / 0.38;
                    rr = Math.max(0.010 * this.R, (R0 - 0.030 * this.R) * Math.pow(1 - q, 0.60));
                    yy = H * (0.60 + 0.34 * Math.sin(Math.PI * 1.25 * q) - 0.30 * q);
                }
                const lean = Math.tan(this.crownTilt) * H * s;
                const c = base.add(dir.scale(yy)).add(side.scale(lean));
                if (i % 5 === 0 || i === K) this.crownAxis.push({ c: c, r: rr * 1.04 });
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    // 切った跡なので真円ではない
                    const wob = 1 + 0.030 * Math.cos(3 * phi + 1.1) + 0.018 * Math.cos(7 * phi + this.rowPhase);
                    const r = rr * (s <= 0.62 ? wob : mix(1, wob, 1 - (s - 0.62) / 0.38));
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f0.N.x * cs + f0.B.x * sn) * r,
                        c.y + (f0.N.y * cs + f0.B.y * sn) * r,
                        c.z + (f0.N.z * cs + f0.B.z * sn) * r
                    ));
                }
                rings.push(ring); centers.push(c);
            }

            const SK = cfg.skinShoulder, ED = cfg.crownEdge;
            const FL = cfg.crownFlesh, CO = cfg.crownCore;
            const LF = cfg.crownLeaf, GR = cfg.crownGreen;
            const greenAmt = this.crownGreenAmt, lobes = this.crownLobes;
            const phase = this.crownPhase;
            const colsFn = (v, u) => {
                const grain = 0.90 + 0.20 * Noise.fbm3(
                    Math.cos(u * TAU) * 7, Math.sin(u * TAU) * 7, v * 11, this.nseed + 7, 2);
                let r = SK[0], g = SK[1], b = SK[2];
                // 肩の緑（日に当たった個体）
                const gr = (1 - smooth(0.20, 0.60, v)) * greenAmt;
                r = mix(r, GR[0], gr); g = mix(g, GR[1], gr); b = mix(b, GR[2], gr);
                // 皮の断面（暗いふち）
                const e = smooth(0.40, 0.64, v);
                r = mix(r, ED[0], e); g = mix(g, ED[1], e); b = mix(b, ED[2], e);
                // 切り口の地色（淡いクリーム黄）
                const f = smooth(0.65, 0.74, v);
                r = mix(r, FL[0], f); g = mix(g, FL[1], f); b = mix(b, FL[2], f);
                // 【対策】切り口を一色で塗ると絆創膏になる。実物は葉柄を
                //         落とした跡が放射状の束になって残っており、
                //         これが人参の頭であることを一目で決めている
                const lobe = Math.pow(0.5 + 0.5 * Math.cos(u * TAU * lobes + phase + v * 2.0), 2.4);
                const band = smooth(0.70, 0.79, v) * (1 - smooth(0.88, 0.97, v));
                const lk = lobe * band * 0.75;
                r = mix(r, LF[0], lk); g = mix(g, LF[1], lk); b = mix(b, LF[2], lk);
                // 中心のくぼみ
                const c = smooth(0.90, 1.0, v) * 0.85;
                r = mix(r, CO[0], c); g = mix(g, CO[1], c); b = mix(b, CO[2], c);
                return [srgb(r * grain), srgb(g * grain), srgb(b * grain)];
            };

            const mesh = sweep("ninjinCrown", rings, centers, colsFn, this.scene);
            mesh.material = skin.crown;
            mesh.receiveShadows = true;
            this.crown = mesh;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュから凸包を取ると生成が重いので、
        // 同じ関数を粗く評価した代理メッシュから凸包を起こす
        // 【対策】でこぼこの点群をそのまま凸包にすると、ほぼ同一平面の面が
        //         大量に生まれる。積み重なった状態では接触マニフォールドが
        //         毎ステップ別の面へ飛び移り、これが震えの主因になる。
        //         輪紋と側根痕と高周波は落とし、低周波の非対称だけ残す。
        //         また切り口を含めないと、肩だけ籠を突き抜けて見える
        hullShape() {
            const N = 22, M = 16;
            const rings = [], centers = [];
            const f0 = this.frameAt(0);
            for (let k = this.crownAxis.length - 1; k >= 0; k--) {
                const sa = this.crownAxis[k], ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        sa.c.x + (f0.N.x * cs + f0.B.x * sn) * sa.r,
                        sa.c.y + (f0.N.y * cs + f0.B.y * sn) * sa.r,
                        sa.c.z + (f0.N.z * cs + f0.B.z * sn) * sa.r));
                }
                rings.push(ring); centers.push(sa.c);
            }
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                        + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
                    const r = Math.max(0.004,
                        this.R * Math.pow(profileAt(t), this.cfg.taperPow) * (1 + asym)) * 0.97;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("ninjinProxy", rings, centers, null, this.scene);
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
                const phi = (j % M) / M * TAU;
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
        console.warn("[Ninjin] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.66;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.24, 60, new V3(0, 2.2, 0), scene);
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
    key.intensity = 2.6;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.66, 0.64, 0.60);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.0;
    fillL.diffuse = new BABYLON.Color3(1.0, 0.98, 0.94);
    fillL.specular = new BABYLON.Color3(0.22, 0.20, 0.18);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.55;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.72, 0.70);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 40;
    sg.depthScale = 40;
    sg.darkness = 0.50;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.12;
    ip.contrast = 1.05;
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
        bShape.material = { friction: 0.68, restitution: 0.0 };
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
        const a0 = rng.range(0, TAU);
        for (let i = 0; i < items.length; i++) {
            const e = items[i];
            // 【対策】物理で動かすノードは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            // 【対策】人参は長い円錐で重心が肩寄りにある。完全にランダムな
            //         姿勢で落とすと立ったまま刺さって籠から生える。
            //         X 軸（長手）を水平に近づけてから落とす
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                rng.gauss(0, 0.30), rng.range(0, TAU), rng.gauss(0, 0.22));
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
            items.push(new Carrot(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.35, 0);
        camera.radius = cfg.basketRim * 3.4;

        resetDrop(seed);
        console.log("[Ninjin]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "本");
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
        ssao.radius = 1.3;
        ssao.totalStrength = 0.85;
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
    //         カメラを寄せても引いてもボケ量が変わらない。
    //         K=0.076 / fStop=2.8 で cocPre ≒ 1.47。籠の手前の縁で coc ≒ 0.6
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
        idle: "#2a1a10", active: "#8a4413", edge: "#4a3428",
        text: "#f7ece2", sub: "#c6a68d", accent: "#f0a15c"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(22,12,6,0.82)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

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

    addLabel("NINJIN", 11, COL.sub, "18px");
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
            + "cm 肩径 " + (e.R * 2).toFixed(1) + "cm\nseed: " + curSeed + "  [" + BUILD + "]";
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
    toggleBtn.background = "rgba(22,12,6,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(22,12,6,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;
