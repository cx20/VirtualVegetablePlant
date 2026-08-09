// =====================================================================
//  Photoreal Tomato  /  写実的なトマト
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（桃太郎 / フルーツトマト / ミニ）
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ / 2D周期ノイズ
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 果実の断面（r, y の2列テーブル）・房の稜・肩のくぼみ
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代
//    6. Tomato      … 果実 + がく（萼片を1枚ずつ立体で）+ 果梗
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1個ずつ落とす）
//    9. GUI
//
//  これまでの野菜との違い:
//    ・回転体だが軸が縦。半径 r と高さ y の両方をテーブルで持つ
//    ・肩に「くぼみ」があり、その底からがくが生える
//    ・房（子室）の数だけ縦の浅い稜が走る。肩で強く、赤道で消える
//    ・がくが主役。細く尖った萼片が肩に沿って垂れ、先端で反り返る。
//      1枚のシートで作ると裏が見えて紙細工になるので、厚みを持たせる
//    ・果皮はよく光り、よく透ける。艶を落とすと途端に作り物になる
//    ・白っぽい細点（皮目）が全面に散る。これが無いとゴムボールになる
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        momotaro: {
            label: "桃太郎（大玉）",
            radius: 3.75,          // 赤道半径
            flat: 0.88,            // 高さ / 直径。1 未満で扁平（くぼみのぶん実効値は下がる）
            countScale: 1,

            // 房（子室）の稜
            lobes: 6, lobeAmp: 0.018, lobeTwist: 0.55,
            dip: 0.085,            // 肩のくぼみの深さ（半径比）
            asymmetry: 0.016,

            // がく
            sepals: 7, sepalLen: 0.66, sepalWid: 0.175, sepalThick: 0.030,
            sepalRise: 0.55,       // ふちを越えるための立ち上がり
            sepalDrop: 0.72,       // 肩に沿って垂れる角
            sepalLift: 0.85,       // 先端の反り
            sepalKeel: 0.20,       // 中肋の張り
            sepalTwist: 0.10,
            stemLen: 0.13, stemRad: 0.085,

            // 色（sRGB）
            skinRim: [0.855, 0.700, 0.330],    // くぼみの内側（黄色を帯びる）
            skinShoulder: [0.930, 0.330, 0.130],
            skinBody: [0.855, 0.075, 0.055],   // 胴の深い赤
            skinBottom: [0.880, 0.115, 0.080],
            lenticel: [0.985, 0.870, 0.760],   // 皮目（白っぽい細点）
            grooveDark: [0.690, 0.045, 0.040],
            calyxTop: [0.185, 0.320, 0.100],   // 萼片の表
            calyxBack: [0.360, 0.480, 0.205],  // 萼片の裏
            calyxRib: [0.300, 0.440, 0.150],   // 中肋
            calyxTip: [0.400, 0.410, 0.190],   // 乾いた先端
            stemCol: [0.285, 0.360, 0.130], stemCut: [0.620, 0.590, 0.360],

            skinRoughness: 0.17, wax: 1.00, sss: 0.60
        },
        fruit: {
            label: "フルーツトマト",
            radius: 2.65, flat: 0.93, countScale: 2,
            // 高糖度の小玉は肩がゴツゴツして稜が深い
            lobes: 6, lobeAmp: 0.034, lobeTwist: 0.80,
            dip: 0.115,
            asymmetry: 0.024,
            sepals: 6, sepalLen: 0.76, sepalWid: 0.185, sepalThick: 0.032,
            sepalRise: 0.62, sepalDrop: 0.80, sepalLift: 1.05,
            sepalKeel: 0.22, sepalTwist: 0.14,
            stemLen: 0.15, stemRad: 0.095,
            skinRim: [0.800, 0.620, 0.270],
            skinShoulder: [0.870, 0.240, 0.100],
            skinBody: [0.735, 0.045, 0.040],
            skinBottom: [0.770, 0.070, 0.055],
            lenticel: [0.975, 0.845, 0.720],
            grooveDark: [0.560, 0.025, 0.028],
            calyxTop: [0.165, 0.295, 0.090],
            calyxBack: [0.335, 0.455, 0.190],
            calyxRib: [0.280, 0.415, 0.140],
            calyxTip: [0.375, 0.385, 0.175],
            stemCol: [0.265, 0.340, 0.120], stemCut: [0.600, 0.570, 0.345],
            skinRoughness: 0.15, wax: 1.10, sss: 0.70
        },
        mini: {
            label: "ミニトマト",
            radius: 1.38, flat: 0.99, countScale: 4,
            lobes: 5, lobeAmp: 0.010, lobeTwist: 0.35,
            dip: 0.055,
            asymmetry: 0.014,
            // ミニは果実に対してがくが相対的に長く、よく反り返る
            sepals: 5, sepalLen: 0.92, sepalWid: 0.150, sepalThick: 0.036,
            sepalRise: 0.50, sepalDrop: 0.62, sepalLift: 1.20,
            sepalKeel: 0.18, sepalTwist: 0.08,
            stemLen: 0.20, stemRad: 0.100,
            skinRim: [0.870, 0.690, 0.300],
            skinShoulder: [0.950, 0.310, 0.110],
            skinBody: [0.900, 0.085, 0.055],
            skinBottom: [0.915, 0.125, 0.075],
            lenticel: [0.990, 0.880, 0.770],
            grooveDark: [0.730, 0.050, 0.042],
            calyxTop: [0.200, 0.340, 0.110],
            calyxBack: [0.380, 0.500, 0.220],
            calyxRib: [0.315, 0.460, 0.165],
            calyxTip: [0.420, 0.430, 0.200],
            stemCol: [0.300, 0.375, 0.140], stemCut: [0.640, 0.610, 0.375],
            skinRoughness: 0.14, wax: 1.15, sss: 0.55
        }
    };

    const GLOBAL = {
        count: 4,                  // 個数（品種の countScale 倍される）

        // 籠（ざる）
        basketRim: 17.0,
        basketDepth: 5.4,
        basketThick: 0.50,
        basketSegments: 96,
        basketRings: 34,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 620,
        physicsHz: 120,
        pieceMass: 1.0,
        // 【対策】トマトはほぼ球なので、摩擦が低いと籠の中を延々と転がる
        friction: 0.86,
        restitution: 0.02,
        linearDamping: 0.16,
        angularDamping: 0.92,
        dropInterval: 0.26,
        dropClearance: 1.4,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.0, settleHold: 0.40,
        settleTimeout: 6.0,

        segmentsAxis: 128,         // 果実の縦分割
        segmentsRound: 96,         // 果実の周分割
        sepalSegments: 22,
        sepalSides: 12,
        stemSegments: 8,
        stemSides: 12,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.076,
        dofFStop: 2.8,

        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "momotaro";
    const START_SEED = 20260726;
    const BUILD = "tomato-A";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】テクスチャは品種単位でキャッシュするので、その種は
        //         個体乱数から切り離して品種名から決める
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        cfg.total = Math.max(1, Math.round(cfg.count * cfg.countScale));
        if (cfg.total > 6) { cfg.segmentsAxis = 88; cfg.segmentsRound = 64; cfg.sepalSegments = 16; }
        if (cfg.total > 12) { cfg.segmentsAxis = 64; cfg.segmentsRound = 48; cfg.sepalSides = 10; }
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
        // u 方向だけ折り返す（果皮のUVは u が周方向で継ぎ目が無い）
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
        // 【対策】頂点カラーを stride 4 で入れると hasVertexAlpha が立ち、
        //         不透明なのに透過パスへ回される。透過パスは深度書き込みが
        //         切られるので、部品どうしが互いを正しく隠せなくなる
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
        //         端のリングで外向きと内向きの面法線を足し合わせて頂点法線が
        //         裏返る。そこを基準に巻き順を判定すると、個体によって
        //         メッシュ全体が反転して「中が見える」状態になる
        for (let j = 0; j < M - 1; j++) indices.push(capA, j, j + 1);
        const o = (N - 1) * M;
        for (let j = 0; j < M - 1; j++) indices.push(capB, o + j + 1, o + j);

        // 【対策】判定の基準は端ではなく中央のリング。半径が大きく法線が
        //         素直に外を向いており、個体によらず安定する
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Profile
    // =================================================================
    // [u, r/R, y/(H/2)]。u=0 が肩のくぼみの底、u=1 がお尻（花落ち）
    // 【対策】これまでの野菜は軸が横で半径だけのテーブルで足りたが、
    //         トマトは縦軸の回転体なので r と y を別々に持たないと、
    //         肩のくぼみのような「半径が増えるのに高さも上がる」形が書けない
    // 【対策】真球にすると必ずゴムボールになる。実物は縦に潰れており、
    //         いちばん太いところは中央よりわずかに上にある
    // 【対策】かといって制御点を手で置くと、たいてい球より外へ膨らんで
    //         「角の丸い立方体」になる。r^2 + y^2 が 1.0 なら真円、
    //         1.3 まで行くと指数 3.5 の超楕円＝完全に箱である。
    //         上半分を指数 2.22、下半分を 2.08 の超楕円から起こし、
    //         上下の高さ比（0.92 : 1.08）で最大径を中央より上へ寄せる
    const PROFILE = [
        [0.000, 0.175, +0.911], [0.038, 0.289, +0.893], [0.082, 0.411, +0.860],
        [0.145, 0.569, +0.790], [0.225, 0.739, +0.667], [0.315, 0.882, +0.486],
        [0.415, 0.977, +0.239], [0.515, 0.998, -0.076], [0.600, 0.954, -0.344],
        [0.665, 0.883, -0.530], [0.735, 0.773, -0.707], [0.800, 0.643, -0.846],
        [0.858, 0.507, -0.945], [0.906, 0.382, -1.007], [0.946, 0.272, -1.045],
        [0.976, 0.186, -1.064], [1.000, 0.114, -1.074]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 【対策】制御点の1列目に u を書きながら添字を等間隔とみなして補間すると、
    //         書いた位置と実際の形が食い違う。u で区間を引いてから補間する
    function profileAt(u) {
        const P = PROFILE, n = P.length;
        u = clamp(u, 0, 1);
        let i = 1;
        while (i < n - 1 && P[i][0] < u) i++;
        const u0 = P[i - 1][0], u1 = P[i][0];
        const t = (u1 > u0) ? (u - u0) / (u1 - u0) : 0;
        const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 1);
        return [
            Math.max(0, catmull(P[a][1], P[i - 1][1], P[i][1], P[b][1], t)),
            catmull(P[a][2], P[i - 1][2], P[i][2], P[b][2], t)
        ];
    }

    // 房（子室）の稜の強さ。肩でいちばん強く、赤道でほぼ消え、
    // お尻でわずかに戻る
    // 【対策】全長で一様にすると、彫刻したカボチャになる
    function lobeWeightAt(u) {
        return clamp(0.22 + 0.78 * Math.pow(1 - smooth(0.05, 0.58, u), 1.35)
            + 0.30 * smooth(0.84, 1.0, u), 0, 1.3);
    }

    // =================================================================
    // 5. TextureLab
    // =================================================================
    const TextureLab = {
        _tex(name, size, fill, scene, clampV) {
            size = Math.max(8, Math.round(size) || 512);
            const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(size, size);
            fill(img.data, size);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            dt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.wrapV = clampV ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE;
            return dt;
        },

        // 果皮の場をまとめて1回で焼く
        // 【対策】アルベド・ORM・法線を別々に計算すると、皮目の位置がずれて
        //         「点の上にぼんやりした汚れが乗った」ように見える
        fields(size, cfg) {
            const n = size * size;
            const F = {
                h: new Float32Array(n),      // 高さ（法線用）
                lent: new Float32Array(n),   // 皮目
                mott: new Float32Array(n),   // 濃淡のムラ
                star: new Float32Array(n)    // 花落ち跡の星
            };
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    const phi = u * TAU;
                    // 皮目（レンチセル）。細かい白っぽい点
                    // 【対策】極ではUVが潰れて点が線に伸びる。両端で薄める
                    const poles = smooth(0.02, 0.10, v) * (1 - smooth(0.93, 0.99, v));
                    const lent = smooth(0.962, 0.994,
                        Noise.fbm2u(u * 170, v * 170, 170, cfg.texSeed + 5, 1)) * poles;
                    // 肩の細かいしわ
                    const wr = Noise.fbm2u(u * 34, v * 80, 34, cfg.texSeed + 17, 2);
                    const crater = 1 - smooth(0.05, 0.16, v);
                    // 花落ち跡の星（房の数だけ筋が出る）
                    const star = Math.pow(0.5 + 0.5 * Math.cos(cfg.lobes * phi), 5.0)
                        * smooth(0.955, 1.0, v);
                    F.lent[i] = lent;
                    F.mott[i] = Noise.fbm2u(u * 5, v * 7, 5, cfg.texSeed + 31, 3);
                    F.star[i] = star;
                    F.h[i] = clamp(0.55 + 0.24 * lent + 0.18 * (wr - 0.5) * crater
                        - 0.28 * star + 0.05 * (F.mott[i] - 0.5), 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const RM = cfg.skinRim, SH = cfg.skinShoulder;
            const BD = cfg.skinBody, BT = cfg.skinBottom;
            const LE = cfg.lenticel, GD = cfg.grooveDark;
            return this._tex("tomatoAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = y * N + x, o = i * 4;
                        const phi = u * TAU;
                        // 【対策】一様な赤にすると玩具のボールになる。実物は
                        //         くぼみの内側が黄色を帯び、肩が朱に寄り、
                        //         胴で深い赤に落ちる
                        let cr = mix(RM[0], SH[0], smooth(0.035, 0.155, v));
                        let cg = mix(RM[1], SH[1], smooth(0.035, 0.155, v));
                        let cb = mix(RM[2], SH[2], smooth(0.035, 0.155, v));
                        const bd = smooth(0.13, 0.46, v);
                        cr = mix(cr, BD[0], bd); cg = mix(cg, BD[1], bd); cb = mix(cb, BD[2], bd);
                        const bt = smooth(0.72, 0.97, v);
                        cr = mix(cr, BT[0], bt); cg = mix(cg, BT[1], bt); cb = mix(cb, BT[2], bt);
                        // 濃淡のムラ
                        const mo = 0.93 + 0.15 * F.mott[i];
                        cr *= mo; cg *= mo; cb *= mo;
                        // 房の稜。溝がわずかに暗く、稜の上がわずかに明るい
                        // 【対策】ここを濃く塗るとカボチャの縞になる。
                        //         立体感は形状と法線に任せ、色差は最小限にする
                        const rib = Math.cos(cfg.lobes * phi + cfg.lobeTwist * v);
                        const rw = lobeWeightAt(v) * 0.10;
                        const gk = clamp(-rib, 0, 1) * rw;
                        cr = mix(cr, GD[0], gk); cg = mix(cg, GD[1], gk); cb = mix(cb, GD[2], gk);
                        const lk = clamp(rib, 0, 1) * rw * 0.55;
                        cr = mix(cr, 1.0, lk * 0.35); cg = mix(cg, 0.45, lk * 0.25); cb = mix(cb, 0.30, lk * 0.20);
                        // 皮目（白っぽい細点）。肩寄りで目立つ
                        // 【対策】これが無いと均一すぎてゴムボールに見える
                        const le = F.lent[i] * (0.55 + 0.45 * (1 - smooth(0.18, 0.72, v)));
                        cr = mix(cr, LE[0], le * 0.60);
                        cg = mix(cg, LE[1], le * 0.60);
                        cb = mix(cb, LE[2], le * 0.60);
                        // 花落ち跡
                        const st = F.star[i] * 0.55 + smooth(0.988, 1.0, v) * 0.45;
                        cr = mix(cr, 0.880, st); cg = mix(cg, 0.720, st); cb = mix(cb, 0.560, st);
                        // 肌理による微小な明暗
                        const k = 0.95 + 0.10 * F.h[i];
                        d[o] = clamp(cr * k, 0, 1) * 255;
                        d[o + 1] = clamp(cg * k, 0, 1) * 255;
                        d[o + 2] = clamp(cb * k, 0, 1) * 255;
                        d[o + 3] = 255;
                    }
                }
            }, scene, true);
        },

        // R=AO / G=roughness
        orm(scene, size, cfg, F) {
            return this._tex("tomatoORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = y * N + x, o = i * 4;
                        // 【対策】完熟トマトの皮はよく光る。粗さを上げると
                        //         とたんに乾いた飾り物になる。ただし一様に
                        //         磨くとガラス玉なので、ムラで曇りを作る
                        let rough = cfg.skinRoughness * (0.88 + 0.30 * (1 - F.h[i]));
                        rough = mix(rough, cfg.skinRoughness * 1.9,
                            smooth(0.62, 0.92, F.mott[i]) * 0.55);
                        // 皮目のところだけ乾いている
                        rough = mix(rough, 0.52, F.lent[i] * 0.75);
                        // くぼみと花落ち跡は艶が落ちる
                        rough = mix(rough, 0.55, 1 - smooth(0.04, 0.14, v));
                        rough = mix(rough, 0.58, smooth(0.965, 1.0, v));
                        let ao = 1.0;
                        ao = mix(ao, 0.72, 1 - smooth(0.02, 0.13, v));       // くぼみの中
                        ao = mix(ao, 0.86, smooth(0.30, 0.95, F.star[i]));
                        d[o] = clamp(ao, 0, 1) * 255;
                        d[o + 1] = clamp(rough, 0.03, 1) * 255;
                        d[o + 2] = 0; d[o + 3] = 255;
                    }
                }
            }, scene, true);
        },

        normal(scene, size, hf, strength) {
            return this._tex("tomatoNormal", size, (d, N) => {
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
            }, scene, true);
        },

        // 竹ひごの網代（あじろ）。u が周方向、v が中心→縁
        // 【対策】明暗差を付けすぎると将棋盤になる。竹ひごの上下は
        //         色ではなく陰影の差でしかない
        bamboo(scene, size, seed) {
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
            }, scene, false);
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
            this.normalTex = TextureLab.normal(scene, S, F.h, 1.1);
            for (const t of [this.albedoTex, this.ormTex, this.normalTex]) {
                t.anisotropicFilteringLevel = 8;
            }

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("tomatoSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.30;          // 皮目はうっすらでよい
            m.transparencyMode = OPAQUE;
            // 【対策】完熟トマトの皮はろう質でよく光る。クリアコートを
            //         切ると布を張ったような質感になる。ただし鏡ではないので
            //         わずかに粗さを残す
            m.clearCoat.isEnabled = true;
            // 【対策】クリアコートを鏡のように磨くとハイライトが点になり、
            //         そのぶん面が平らに見えて形が角張って感じられる。
            //         実物のハイライトはもっと広くて柔らかい
            m.clearCoat.intensity = 0.70 * cfg.wax;
            m.clearCoat.roughness = 0.135;
            m.clearCoat.indexOfRefraction = 1.46;
            // 【対策】トマトは思ったより光を透かす。これが無いと
            //         同じ赤でも陶器の置物に見える。ただし強すぎると
            //         中身が空洞のゼリー玉になるので厚みの下限を大きく取る
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.95, 0.16, 0.10);
            m.subSurface.translucencyIntensity = 0.22 * cfg.sss;
            m.subSurface.minimumThickness = 0.8;
            m.subSurface.maximumThickness = 4.5;
            this.skin = m;

            const c = new BABYLON.PBRMaterial("tomatoCalyx", scene);
            c.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            c.metallic = 0.0;
            c.roughness = 0.52;
            c.transparencyMode = OPAQUE;
            // 【対策】萼片は薄いので、うっすら光を通さないとブリキの星に見える。
            //         ただし厚みを持たせた立体なので backFaceCulling は切らない
            c.subSurface.isTranslucencyEnabled = true;
            c.subSurface.tintColor = new BABYLON.Color3(0.35, 0.60, 0.18);
            c.subSurface.translucencyIntensity = 0.20;
            c.subSurface.minimumThickness = 0.02;
            c.subSurface.maximumThickness = 0.25;
            this.calyx = c;

            const s = new BABYLON.PBRMaterial("tomatoStem", scene);
            s.albedoColor = new BABYLON.Color3(1, 1, 1);
            s.metallic = 0.0;
            s.roughness = 0.62;
            s.transparencyMode = OPAQUE;
            this.stem = s;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.calyx.dispose(true, false);
            this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Tomato
    // =================================================================
    class Tomato {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.R = cfg.radius * rng.range(0.90, 1.10);
            this.H2 = this.R * cfg.flat * rng.range(0.94, 1.06);   // 高さの半分
            this.seed = seed >>> 0;
            this.nseed = rng.int(900000) + 1000;
            this.lobePhase = rng.range(0, TAU);
            this.calyxPhase = rng.range(0, TAU);
            this.dip = cfg.dip * rng.range(0.8, 1.25);
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.3, 0.8);
            this.p1 = rng.range(0, TAU);
            this.p2 = rng.range(0, TAU);
            this.sepals = Math.max(4, cfg.sepals + rng.int(3) - 1);
            // 果実の傾き（軸が完全に垂直な個体は無い）
            this.tilt = rng.gauss(0, 0.05);
            this.tiltAz = rng.range(0, TAU);

            this._buildSurfaceLut();
            this.parts = [];
            this._buildBody(skin);
            this._buildCalyx(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("tomato", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 稜と非対称をかけた倍率。位置ベクトルごと伸縮させるので、
        // 肩では上下方向の溝としても効く
        modAt(u, phi) {
            const cfg = this.cfg;
            const rib = cfg.lobeAmp * Math.cos(cfg.lobes * phi + cfg.lobeTwist * u + this.lobePhase)
                * lobeWeightAt(u);
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * u)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * u * 1.4);
            const wob = 0.014 * (Noise.fbm3(Math.cos(phi) * 2.0, Math.sin(phi) * 2.0,
                u * 3.4, this.nseed, 3) - 0.5);
            return 1 + rib + asym + wob;
        }
        // 果実表面の1点。u=0 が肩のくぼみの底、u=1 がお尻
        surfaceAt(u, phi) {
            const p = profileAt(u);
            const k = this.modAt(u, phi);
            const r = this.R * p[0] * k;
            // 【対策】くぼみは「y を下げる」ことで作る。プロファイル側で
            //         書こうとすると、稜の倍率が y にも掛かってくぼみの底が
            //         波打ってしまう
            const y = this.H2 * p[1] * k - this.dip * this.R * Math.pow(1 - smooth(0, 0.17, u), 1.6);
            return { r, y };
        }

        // 【対策】がくを果実の形と無関係に置くと、萼片が皮に沈むか、
        //         浮いて隙間から向こうが見える。果実の輪郭を表に焼いて
        //         おき、萼片の各点を「表面より外」へ押し出す
        _buildSurfaceLut() {
            const N = 128;
            this._sN = N;
            this._sr = new Float32Array(N + 1);
            this._sy = new Float32Array(N + 1);
            for (let i = 0; i <= N; i++) {
                const s = this.surfaceAt(i / N, 0);
                this._sr[i] = s.r; this._sy[i] = s.y;
            }
        }
        // (r, y) が果実の内側なら、表面 + clr の位置まで押し出して返す
        pushOut(r, y, clr) {
            const N = this._sN;
            const ang = Math.atan2(y, Math.max(1e-4, r));
            let best = 0, bd = 1e9;
            for (let i = 0; i <= N; i++) {
                const a = Math.atan2(this._sy[i], Math.max(1e-4, this._sr[i]));
                const d = Math.abs(a - ang);
                if (d < bd) { bd = d; best = i; }
            }
            const sr = this._sr[best], sy = this._sy[best];
            const sl = Math.hypot(sr, sy), pl = Math.hypot(r, y);
            const want = sl + clr;
            if (pl >= want || pl < 1e-6) return { r, y };
            const k = want / pl;
            return { r: r * k, y: y * k };
        }

        // ---- 果実 -----------------------------------------------------
        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const u = i / N;
                const ring = [];
                let sy = 0;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const s = this.surfaceAt(u, phi);
                    ring.push(new V3(Math.cos(phi) * s.r, s.y, Math.sin(phi) * s.r));
                    sy += s.y;
                }
                rings.push(ring);
                centers.push(new V3(0, sy / (M + 1), 0));
            }
            const mesh = sweep("tomatoBody", rings, centers, null, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // ---- がく（萼片を1枚ずつ、厚みのある立体で）--------------------
        // 【対策】星形の1枚シートで作ると、裏返ったときに裏面が見えて
        //         紙細工になる。断面を「幅 × 厚み」のレンズ形にして
        //         掃引すれば、そのまま閉じた立体になる
        _buildCalyx(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.sepalSegments, M = cfg.sepalSides;
            const n = this.sepals;
            for (let si = 0; si < n; si++) {
                const az = (si / n) * TAU + this.calyxPhase + rng.gauss(0, 0.07);
                const L = cfg.sepalLen * this.R * rng.range(0.82, 1.18);
                const W = cfg.sepalWid * this.R * rng.range(0.85, 1.15);
                const TH = cfg.sepalThick * this.R * rng.range(0.85, 1.15);
                const rise = cfg.sepalRise * rng.range(0.8, 1.2);
                const drop = cfg.sepalDrop * rng.range(0.8, 1.2);
                const lift = cfg.sepalLift * rng.range(0.6, 1.5);
                const tw = cfg.sepalTwist * rng.range(-1.4, 1.4);

                const RD = new V3(Math.cos(az), 0, Math.sin(az));      // 外向き
                const AX = new V3(-Math.sin(az), 0, Math.cos(az));     // 幅方向
                const UP = new V3(0, 1, 0);

                // 起点：くぼみの底、果梗のすぐ脇
                // 【対策】付け根を外へ置くと、果梗との間にくぼみの底が
                //         見えて萼片が円形に浮いて並ぶ。軸寄りに寄せて
                //         付け根の切り口は果梗の根元の膨らみで隠す
                const start = this.surfaceAt(0.020, az);
                let cr = start.r * 0.72;
                let cy = start.y - this.R * 0.020;

                const rings = [], centers = [];
                const seg = [];
                // 【対策】萼片は「ふちを越えて→肩に沿って垂れて→先端で反る」
                //         の3段。単純な円弧にすると肩から浮いて隙間が空く
                for (let i = 0; i <= K; i++) {
                    const s = i / K;
                    const a = rise * (1 - smooth(0, 0.22, s))
                        - drop * smooth(0.08, 0.52, s)
                        + lift * Math.pow(smooth(0.45, 1.0, s), 1.3);
                    if (i > 0) {
                        const ds = L / K;
                        cr += Math.cos(a) * ds;
                        cy += Math.sin(a) * ds;
                    }
                    const out = this.pushOut(cr, cy, TH * 0.62);
                    seg.push({ s, r: out.r, y: out.y, a });
                }
                for (let i = 0; i <= K; i++) {
                    const { s, r, y } = seg[i];
                    // 接線（掃引の向き）
                    const p0 = seg[Math.max(0, i - 1)], p1 = seg[Math.min(K, i + 1)];
                    const tr = p1.r - p0.r, ty = p1.y - p0.y;
                    const tl = Math.hypot(tr, ty) || 1;
                    // 中心線の位置と、断面の2軸
                    const lat = tw * L * s * s;
                    const C = new V3(RD.x * r + AX.x * lat, y, RD.z * r + AX.z * lat);
                    // 断面の「上」= 接線と幅方向の外積
                    const U = new V3(
                        -(RD.x * ty / tl), (tr / tl), -(RD.z * ty / tl));
                    const ul = Math.hypot(U.x, U.y, U.z) || 1;
                    U.x /= ul; U.y /= ul; U.z /= ul;
                    // 幅と厚み
                    const w = W * (0.60 + 0.40 * smooth(0, 0.24, s)) * Math.pow(1 - s * 0.985, 0.62);
                    const th = TH * Math.pow(1 - s * 0.98, 0.45);
                    const ring = [];
                    for (let j = 0; j <= M; j++) {
                        const psi = (j % M) / M * TAU;
                        const c = Math.cos(psi), sn = Math.sin(psi);
                        // 中肋（midrib）で表がわずかに盛り上がる
                        const keel = cfg.sepalKeel * w * (1 - c * c) * (1 - smooth(0.7, 1.0, s));
                        const off = keel + th * 0.5 * sn;
                        ring.push(new V3(
                            C.x + AX.x * (w * 0.5 * c) + U.x * off,
                            C.y + AX.y * (w * 0.5 * c) + U.y * off,
                            C.z + AX.z * (w * 0.5 * c) + U.z * off));
                    }
                    rings.push(ring); centers.push(C);
                }

                const CT = cfg.calyxTop, CB = cfg.calyxBack;
                const CR = cfg.calyxRib, CP = cfg.calyxTip;
                const nsd = this.nseed + si * 37;
                const colsFn = (v, u) => {
                    // u < 0.5 が表（上）側、u > 0.5 が裏側
                    const c = Math.cos(u * TAU);
                    const face = (u < 0.5) ? 1 : 0;
                    let r = mix(CB[0], CT[0], face);
                    let g = mix(CB[1], CT[1], face);
                    let b = mix(CB[2], CT[2], face);
                    // 中肋は明るい
                    const rib = Math.pow(1 - Math.abs(c), 3.0) * (1 - smooth(0.55, 1.0, v));
                    r = mix(r, CR[0], rib * 0.75); g = mix(g, CR[1], rib * 0.75); b = mix(b, CR[2], rib * 0.75);
                    // 先端は乾いて色が抜ける
                    const tip = smooth(0.62, 1.0, v);
                    r = mix(r, CP[0], tip * 0.80); g = mix(g, CP[1], tip * 0.80); b = mix(b, CP[2], tip * 0.80);
                    // ふちは薄くて明るい
                    const edge = Math.pow(Math.abs(c), 6.0) * 0.25;
                    r = mix(r, CB[0] * 1.25, edge); g = mix(g, CB[1] * 1.20, edge); b = mix(b, CB[2] * 1.25, edge);
                    const gr = 0.88 + 0.24 * Noise.fbm3(
                        Math.cos(u * TAU) * 6, Math.sin(u * TAU) * 6, v * 14, nsd, 2);
                    return [srgb(r * gr), srgb(g * gr), srgb(b * gr)];
                };

                const mesh = sweep("tomatoSepal" + si, rings, centers, colsFn, this.scene);
                mesh.material = skin.calyx;
                mesh.receiveShadows = true;
                this.parts.push(mesh);
            }
        }

        // ---- 果梗（くぼみの中央に残った短い軸）------------------------
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const L = cfg.stemLen * this.R * rng.range(0.8, 1.25);
            const R0 = cfg.stemRad * this.R * rng.range(0.9, 1.1);
            const base = this.surfaceAt(0, 0).y - this.R * 0.05;   // 少し埋める
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const y = base + L * s;
                // 【対策】根元を膨らませないと、萼片の付け根の切り口が
                //         くぼみの底にむき出しで並ぶ
                const r = R0 * (1 + 0.95 * Math.pow(1 - smooth(0, 0.38, s), 1.3)
                    - 0.10 * s + 0.10 * smooth(0.75, 1.0, s));
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const rr = r * (1 + 0.10 * Math.cos(5 * phi + 0.6));
                    ring.push(new V3(Math.cos(phi) * rr, y, Math.sin(phi) * rr));
                }
                rings.push(ring); centers.push(new V3(0, y, 0));
            }
            const SC = cfg.stemCol, CU = cfg.stemCut;
            const colsFn = (v, u) => {
                const g = 0.88 + 0.24 * Noise.fbm3(
                    Math.cos(u * TAU) * 8, Math.sin(u * TAU) * 8, v * 9, this.nseed + 5, 2);
                const cut = smooth(0.86, 1.0, v);
                return [
                    srgb(mix(SC[0], CU[0], cut) * g),
                    srgb(mix(SC[1], CU[1], cut) * g),
                    srgb(mix(SC[2], CU[2], cut) * g)
                ];
            };
            const mesh = sweep("tomatoStem", rings, centers, colsFn, this.scene);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
        }

        // 当たり判定
        // 【対策】がくを含めると、萼片の先で立ってしまって籠の中で浮く。
        //         実物も萼片は簡単にたわむので、当たり判定は果実だけにする
        hullShape() {
            const N = 22, M = 20;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const u = i / N;
                const ring = [];
                let sy = 0;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const p = profileAt(u);
                    const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * u);
                    const r = this.R * p[0] * (1 + asym) * 0.985;
                    const y = this.H2 * p[1] * 0.99
                        - this.dip * this.R * Math.pow(1 - smooth(0, 0.17, u), 1.6);
                    ring.push(new V3(Math.cos(phi) * r, y, Math.sin(phi) * r));
                    sy += y;
                }
                rings.push(ring); centers.push(new V3(0, sy / (M + 1), 0));
            }
            const proxy = sweep("tomatoProxy", rings, centers, null, this.scene);
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
        console.warn("[Tomato] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.70;
    scene.environmentIntensity = 0.70;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.14, 55, new V3(0, 2.6, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 5;
    camera.maxZ = 300;
    camera.lowerRadiusLimit = 14;
    camera.upperRadiusLimit = 150;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.90, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.4;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.95, 0.92, 0.88);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.30, -0.55).normalize(), scene);
    fillL.intensity = 0.95;
    fillL.diffuse = new BABYLON.Color3(1.0, 0.97, 0.95);
    fillL.specular = new BABYLON.Color3(0.30, 0.27, 0.25);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.50;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.76, 0.72, 0.70);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 36;
    sg.depthScale = 40;
    sg.darkness = 0.46;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.08;
    ip.contrast = 1.08;
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
        const a0 = rng.range(0, TAU);
        for (let i = 0; i < items.length; i++) {
            const e = items[i];
            // 【対策】物理で動かすノードは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            // 【対策】まったくランダムな姿勢で落とすと、がくを下敷きにして
            //         逆さに落ち着く個体が出る。実物は扁平なので自然に
            //         がくが上を向く。ほぼ正立から放して、あとは物理に任せる
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                rng.gauss(0, 0.16), rng.range(0, TAU), rng.gauss(0, 0.16));
            const r = GLOBAL.basketRim * 0.40 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            const cols = Math.ceil(Math.sqrt(items.length));
            for (let i = 0; i < items.length; i++) {
                const e = items[i], d = e.R * 2.15;
                e.root.position.set(
                    ((i % cols) - (cols - 1) / 2) * d,
                    GLOBAL.basketThick + e.H2,
                    (Math.floor(i / cols) - (cols - 1) / 2) * d);
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

        for (let i = 0; i < cfg.total; i++) {
            items.push(new Tomato(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.45, 0);
        camera.radius = cfg.basketRim * 3.1;

        resetDrop(seed);
        console.log("[Tomato]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.total, "個");
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
        // 【対策】がくの下と果実どうしの接点に影が入らないと、球が
        //         宙に浮いているように見える。半径は果実の大きさに合わせる
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 1.1;
        ssao.totalStrength = 0.95;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 200;
        ssao.minZAspect = 0.28;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.94;
    dp.bloomWeight = 0.075;
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
        idle: "#2c0f0c", active: "#a5241c", edge: "#4d2a26",
        text: "#fdeceb", sub: "#d3a29c", accent: "#f4837a"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "252px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(22,8,6,0.82)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "220px"; panel.isVertical = true;
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

    addLabel("TOMATO", 11, COL.sub, "18px");
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

    addLabel("盛る量", 13, COL.accent, "26px");
    for (const c of [3, 4, 6]) {
        countBtns[c] = addButton("c" + c, ["少なめ", "ふつう", "多め"][[3, 4, 6].indexOf(c)], () => {
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
        info.text = state + " / " + items.length + "個 / 径 " + (e.R * 2).toFixed(1)
            + "cm 高 " + (e.H2 * 2).toFixed(1) + "cm\n"
            + curCfg.lobes + "室 がく" + e.sepals + "枚  seed: " + curSeed;
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
    toggleBtn.background = "rgba(22,8,6,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(22,8,6,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;