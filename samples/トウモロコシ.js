// =====================================================================
//  Photoreal Corn  /  写実的なとうもろこし（茹で・皮なし）
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（ゴールドラッシュ / ピュアホワイト /
//                     ピーターコーン）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ / 2D周期ノイズ
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 芯のプロファイル / 粒の配列（格子）
//    5. TextureLab  … 粒の微細ディテール（4x4アトラス）、竹の網代
//    6. Corn        … 芯 + 粒（結合メッシュ）+ 切り口の茎
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  人参版との決定的な違い:
//    ・表面が「模様」ではなく「粒」。円柱に変位をかけるとゴルフボールに
//      なるので、粒を実体のメッシュとして作り、芯に植えて1つに結合する
//    ・粒は縦の列をなし、隣の列とは半ピッチずれて噛み合う
//    ・粒どうしはわずかに押し合ってつぶれている。すき間を空けると
//      生のスイートコーンではなく作り物のビーズになる
//    ・茹でた粒は濡れて光り、かつよく光を透かす。ここを外すと
//      プラスチックの飾りになる
//    ・両端で粒が小さくなる。根元は白い切り口、先端は細く色が抜ける
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        goldrush: {
            label: "ゴールドラッシュ",
            length: 19.5, radius: 2.55,
            bendA: 0.010, bendB: 0.005,
            asymmetry: 0.018,

            // 粒の配列
            // 【対策】列数は必ず偶数。奇数にすると噛み合わせの半ピッチずらしが
            //         一周したところで食い違い、そこだけ縦の切れ目が走る
            rows: 16,
            pitch: 0.80,          // 軸方向の粒ピッチ cm
            kernelH: 0.42,        // 粒の張り出し cm
            // 【対策】fill は「隣の粒とどれだけ食い込ませるか」。
            //         谷の高さは hp(1/fill) で決まるので、fill を上げるほど
            //         溝が浅く細くなる。1.18 では溝が 0.95mm あって
            //         すき間に見えた。実物は 0.5mm 前後
            fillW: 1.24, fillH: 1.26,
            spiral: 0.9,          // 全長で列が何粒ぶんねじれるか
            // 【対策】粒の断面。plumpness を上げ flatness を下げると
            //         「天面は丸いまま裾だけ立つ」形になる。ここが緩いと、
            //         粒どうしは接しているのに谷が芯まで届いて歯抜けに見える
            plumpness: 5.2, flatness: 0.38, roundness: 3.20,
            jitterT: 0.10, jitterP: 0.08, jitterS: 0.16,

            whiteRatio: 0.00,
            // 色（sRGB）
            kTop: [0.985, 0.790, 0.115],   // 粒の天面
            kDeep: [0.760, 0.470, 0.045],  // 粒の裾（すき間へ向かって沈む）
            kPale: [0.985, 0.905, 0.560],  // 両端の淡い粒
            kWhite: [0.965, 0.945, 0.815],
            cob: [0.635, 0.425, 0.150],    // すき間から覗く芯
            cut: [0.945, 0.925, 0.815],    // 切り口
            tipCob: [0.870, 0.800, 0.520],
            stalk: [0.855, 0.875, 0.600],  // 折り取った茎

            roughness: 0.28, wet: 1.00, sss: 0.55
        },
        white: {
            label: "ピュアホワイト",
            length: 20.5, radius: 2.62,
            bendA: 0.009, bendB: 0.004,
            asymmetry: 0.016,
            rows: 16,
            pitch: 0.78, kernelH: 0.44,
            fillW: 1.25, fillH: 1.27,
            spiral: 0.7,
            plumpness: 5.0, flatness: 0.38, roundness: 3.10,
            jitterT: 0.09, jitterP: 0.07, jitterS: 0.14,
            whiteRatio: 1.00,
            kTop: [0.975, 0.960, 0.855],
            kDeep: [0.820, 0.780, 0.620],
            kPale: [0.985, 0.975, 0.905],
            kWhite: [0.975, 0.960, 0.855],
            cob: [0.680, 0.560, 0.310],
            cut: [0.950, 0.935, 0.850],
            tipCob: [0.890, 0.845, 0.640],
            stalk: [0.865, 0.885, 0.630],
            roughness: 0.26, wet: 1.05, sss: 0.70
        },
        peter: {
            label: "ピーターコーン",
            length: 18.5, radius: 2.48,
            bendA: 0.013, bendB: 0.006,
            asymmetry: 0.020,
            rows: 18,
            pitch: 0.74, kernelH: 0.40,
            fillW: 1.23, fillH: 1.26,
            spiral: 1.3,
            plumpness: 5.4, flatness: 0.37, roundness: 3.30,
            jitterT: 0.11, jitterP: 0.09, jitterS: 0.17,
            // バイカラー。白粒が1/4ほど混ざる
            whiteRatio: 0.25,
            kTop: [0.985, 0.770, 0.130],
            kDeep: [0.745, 0.455, 0.055],
            kPale: [0.985, 0.900, 0.575],
            kWhite: [0.970, 0.950, 0.830],
            cob: [0.630, 0.420, 0.148],
            cut: [0.940, 0.920, 0.810],
            tipCob: [0.865, 0.795, 0.515],
            stalk: [0.850, 0.870, 0.595],
            roughness: 0.29, wet: 0.95, sss: 0.55
        }
    };

    const GLOBAL = {
        count: 3,                  // 本数

        // 籠（ざる）
        basketRim: 18.5,
        basketDepth: 5.6,
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
        // 【対策】とうもろこしはほぼ円柱で、放っておくと籠の中をいつまでも
        //         転がり続ける。摩擦と角減衰を人参より強めに取る
        friction: 0.92,
        restitution: 0.01,
        linearDamping: 0.18,
        angularDamping: 0.94,
        dropInterval: 0.30,
        dropClearance: 1.8,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.0, settleHold: 0.40,
        settleTimeout: 6.0,

        segmentsAxis: 96,          // 芯の分割（粒に隠れるので粗くてよい）
        segmentsRound: 64,
        kernelRings: 4,            // 粒1個の分割
        kernelSides: 12,
        stalkSegments: 12,
        stalkSides: 20,

        textureSize: 512,          // 粒ディテールの 4x4 アトラス
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.076,
        dofFStop: 2.8,

        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "goldrush";
    const START_SEED = 20260726;
    const BUILD = "corn-A";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        // 【対策】粒は1本あたり400個前後ある。本数を増やすときは
        //         粒1個の分割を落とさないと頂点数が跳ね上がる
        if (cfg.count > 3) { cfg.kernelRings = 3; cfg.kernelSides = 10; cfg.segmentsAxis = 72; }
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

        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Profile / 粒の場
    // =================================================================
    // [軸方向 t, 半径比]。t=0 が根元（切り口）、t=1 が先端
    // 【対策】とうもろこしはほぼ円柱。人参のように細らせると芋になる。
    //         太さが変わるのは切り口のすぐ手前と、先端の1/4だけ
    // 【対策】根元を太いまま平らに切ると、白い切り口が大きな円盤になって
    //         マシュマロを刺したように見える。実物のもぎ口は細く、粒は
    //         茎の際までカーブして回り込んでいる。t=0 の半径を茎とほぼ
    //         同じまで絞り、そこから一気に立ち上げる
    const PROFILE = [
        [0.000, 0.340], [0.007, 0.560], [0.016, 0.760], [0.030, 0.890],
        [0.055, 0.955], [0.110, 0.990], [0.290, 1.000], [0.430, 0.998],
        [0.550, 0.990], [0.660, 0.972], [0.760, 0.942], [0.840, 0.896],
        [0.900, 0.826], [0.945, 0.720], [0.975, 0.560], [0.992, 0.380],
        [1.000, 0.160]
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

    const KERN_T0 = 0.003, KERN_T1 = 0.974;

    // 粒の大きさ（0..1）。両端で小さくなる
    // 【対策】先端まで同じ大きさの粒を敷き詰めると、機械で削り出した
    //         円柱になる。実物は先端の1/4で急に小粒になり、色も抜ける
    function kernelSizeAt(t) {
        // 【対策】根元の粒を小さくすると、そこだけ目が粗くなって
        //         白い芯が透ける。実物の根元の粒は小さいのではなく
        //         「もぎ口で切れている」だけなので、ほぼ原寸のまま置く
        // 大きさの縦横比は axialW が受け持つので、ここは張り出しの高さ担当
        const a = 0.88 + 0.12 * smooth(0.004, 0.045, t);
        const b = 1 - 0.38 * smooth(0.760, 0.970, t);
        return clamp(a * b, 0, 1);
    }
    // 粒が生えている範囲のマスク（芯の太さを決めるのに使う）
    // 【対策】根元でこのマスクを緩く立ち上げると、芯が太いまま残って
    //         もぎ口のまわりに白い輪ができる。ほぼ即座に 1 にする
    function kernelMaskAt(t) {
        return smooth(0.000, 0.006, t) * (1 - smooth(0.952, 0.996, t));
    }

    // =================================================================
    // 5. TextureLab
    // =================================================================
    const TextureLab = {
        _tex(name, size, fill, scene, clamped) {
            size = Math.max(8, Math.round(size) || 512);
            const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(size, size);
            fill(img.data, size);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            const mode = clamped ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.wrapU = mode; dt.wrapV = mode;
            return dt;
        },

        // 粒の微細ディテール。4x4 のアトラスにして 16 種類作る
        // 【対策】400個の粒すべてが同じディテールだと、寄ったときに
        //         同じシワが規則的に並んでいるのが見えてしまう。
        //         セルごとに種を変え、粒側でどのセルを引くかを散らす
        kernelFields(size, cfg) {
            const h = new Float32Array(size * size);
            const cell = size >> 2;
            for (let cy = 0; cy < 4; cy++) {
                for (let cx = 0; cx < 4; cx++) {
                    const sd = cfg.texSeed + (cy * 4 + cx) * 977;
                    for (let y = 0; y < cell; y++) {
                        for (let x = 0; x < cell; x++) {
                            const u = x / cell, v = y / cell;
                            // 中心から外へ向かう、ごく浅い放射状のしわ
                            const dx = u - 0.5, dy = v - 0.5;
                            const ang = Math.atan2(dy, dx) / TAU + 0.5;
                            const rad = Math.hypot(dx, dy) * 2;
                            const wrink = Noise.fbm2u(ang * 26, rad * 5, 26, sd, 2);
                            const fine = Noise.fbm2u(u * 40, v * 40, 40, sd + 31, 2);
                            h[(cy * cell + y) * size + (cx * cell + x)] =
                                clamp(0.55 + 0.26 * (wrink - 0.5) * smooth(0.25, 0.95, rad)
                                    + 0.14 * (fine - 0.5), 0, 1);
                        }
                    }
                }
            }
            return h;
        },

        // R=AO / G=roughness
        kernelOrm(scene, size, cfg, hf) {
            return this._tex("cornKernelORM", size, (d, N) => {
                for (let i = 0; i < N * N; i++) {
                    const o = i * 4;
                    // 【対策】茹でた粒は濡れて均一に光る。粗さを一様にすると
                    //         射出成形のビーズになるので、微妙にムラを付ける
                    const rough = clamp(cfg.roughness * (0.86 + 0.32 * (1 - hf[i])), 0.04, 1);
                    d[o] = 255;
                    d[o + 1] = rough * 255;
                    d[o + 2] = 0; d[o + 3] = 255;
                }
            }, scene, true);
        },

        normal(scene, size, hf, strength, clamped) {
            return this._tex("cornKernelNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + Math.max(0, x - 1)], xr = hf[y * N + Math.min(N - 1, x + 1)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * N + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, clamped);
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
            const hf = TextureLab.kernelFields(S, cfg);
            this.ormTex = TextureLab.kernelOrm(scene, S, cfg, hf);
            this.normalTex = TextureLab.normal(scene, S, hf, 0.9, true);
            for (const t of [this.ormTex, this.normalTex]) t.anisotropicFilteringLevel = 8;

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const k = new BABYLON.PBRMaterial("cornKernel", scene);
            k.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            k.metallic = 0.0;
            k.roughness = 1.0;                              // 実値は ORM の G
            k.metallicTexture = this.ormTex;
            k.useRoughnessFromMetallicTextureGreen = true;
            k.useMetallnessFromMetallicTextureBlue = true;
            k.bumpTexture = this.normalTex;
            k.bumpTexture.level = 0.45;
            k.transparencyMode = OPAQUE;
            // 【対策】茹でた粒の表面には必ず水の膜が乗っている。
            //         クリアコートを切ると、途端に乾いた模型の粒になる
            k.clearCoat.isEnabled = true;
            k.clearCoat.intensity = 0.62 * cfg.wet;
            k.clearCoat.roughness = 0.10;
            k.clearCoat.indexOfRefraction = 1.44;
            // 【対策】とうもろこしの粒は光をよく透かす。これが無いと
            //         同じ黄色でもプラスチックのビーズにしか見えない。
            //         粒は小さいので厚みの上限も小さく取る
            k.subSurface.isTranslucencyEnabled = true;
            k.subSurface.tintColor = new BABYLON.Color3(1.0, 0.72, 0.22);
            k.subSurface.translucencyIntensity = 0.30 * cfg.sss;
            k.subSurface.minimumThickness = 0.05;
            k.subSurface.maximumThickness = 0.55;
            this.kernel = k;

            const c = new BABYLON.PBRMaterial("cornCob", scene);
            c.albedoColor = new BABYLON.Color3(1, 1, 1);
            c.metallic = 0.0;
            c.roughness = 0.72;
            c.transparencyMode = OPAQUE;
            this.cob = c;

            const s = new BABYLON.PBRMaterial("cornStalk", scene);
            s.albedoColor = new BABYLON.Color3(1, 1, 1);
            s.metallic = 0.0;
            s.roughness = 0.66;
            s.transparencyMode = OPAQUE;
            s.backFaceCulling = false;
            s.twoSidedLighting = true;
            this.stalk = s;
        }
        dispose() {
            this.kernel.dispose(true, false);
            this.cob.dispose(true, false);
            this.stalk.dispose(true, false);
            this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Corn
    // =================================================================
    class Corn {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.93, 1.07);
            this.R = cfg.radius * rng.range(0.94, 1.06);
            this.seed = seed >>> 0;
            this.nseed = rng.int(900000) + 1000;
            this.bendA = cfg.bendA * rng.range(0.4, 1.8) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.2, 1.2);
            this.bendRoll = rng.range(0, TAU);
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, TAU);
            this.p2 = rng.range(0, TAU);
            this.rowPhase = rng.range(0, TAU);

            this._buildLut();
            this._buildKernelAxis();
            this.parts = [];
            this._buildCob(skin);
            this._buildKernels(skin);
            this._buildStalk(skin);
            this.root = new BABYLON.TransformNode("corn", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 軸は X
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

        // 【対策】粒1個につき数十頂点、1本あたり2万頂点を超える。
        //         頂点ごとに spineAt / frameAt を呼ぶと Vector3 の生成だけで
        //         生成が数秒かかる。軸の情報は先に表に焼いて引く
        _buildLut() {
            const N = 512;
            this._lutN = N;
            this._lc = new Float32Array((N + 1) * 3);
            this._ln = new Float32Array((N + 1) * 3);
            this._lb = new Float32Array((N + 1) * 3);
            for (let i = 0; i <= N; i++) {
                const t = i / N, c = this.spineAt(t), f = this.frameAt(t);
                this._lc[i * 3] = c.x; this._lc[i * 3 + 1] = c.y; this._lc[i * 3 + 2] = c.z;
                this._ln[i * 3] = f.N.x; this._ln[i * 3 + 1] = f.N.y; this._ln[i * 3 + 2] = f.N.z;
                this._lb[i * 3] = f.B.x; this._lb[i * 3 + 1] = f.B.y; this._lb[i * 3 + 2] = f.B.z;
            }
            this._fr = { cx: 0, cy: 0, cz: 0, nx: 0, ny: 0, nz: 0, bx: 0, by: 0, bz: 0 };
        }
        lut(t) {
            const N = this._lutN, o = this._fr;
            const x = clamp(t, 0, 1) * N;
            const i = Math.min(N - 1, Math.floor(x)), u = x - i;
            const a = i * 3, b = a + 3;
            const C = this._lc, Nn = this._ln, Bb = this._lb;
            o.cx = C[a] + (C[b] - C[a]) * u;
            o.cy = C[a + 1] + (C[b + 1] - C[a + 1]) * u;
            o.cz = C[a + 2] + (C[b + 2] - C[a + 2]) * u;
            o.nx = Nn[a]; o.ny = Nn[a + 1]; o.nz = Nn[a + 2];
            o.bx = Bb[a]; o.by = Bb[a + 1]; o.bz = Bb[a + 2];
            return o;
        }

        // 粒の軸方向の大きさ・間隔の倍率。芯が細るところでは粒も詰まる
        // 【対策】周方向の幅は芯の半径に比例して細るのに、軸方向の長さを
        //         一定にすると、細い根元で粒が細長いカプセルになり、
        //         もぎ口から放射状に伸びた花のように見える。
        //         軸方向も同じ倍率で縮めて縦横比を保つ
        axialW(t) {
            return Math.max(0.42, profileAt(t));
        }
        // 粒の座標 q（= ∫ dt / axialW）と t の対応表。
        // q 上で等間隔に置けば、実長では細いところほど詰まって並ぶ
        _buildKernelAxis() {
            const N = 512;
            this._qN = N;
            this._q = new Float32Array(N + 1);
            let acc = 0;
            for (let i = 1; i <= N; i++) {
                const w0 = this.axialW((i - 1) / N), w1 = this.axialW(i / N);
                acc += (0.5 / N) * (1 / w0 + 1 / w1);
                this._q[i] = acc;
            }
            this._qMax = acc;
        }
        tOfQ(q) {
            const N = this._qN, Q = this._q;
            if (q <= 0) return 0;
            if (q >= Q[N]) return 1;
            let lo = 0, hi = N;
            while (hi - lo > 1) {
                const m = (lo + hi) >> 1;
                if (Q[m] <= q) lo = m; else hi = m;
            }
            const a = Q[lo], b = Q[hi];
            return (lo + ((b > a) ? (q - a) / (b - a) : 0)) / N;
        }

        // 低周波の非対称。これが無いと完全な回転体になり、ハイライトが
        // 直線になって樹脂の棒に見える
        asymAt(t, phi) {
            return this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
        }
        outerR(t, phi) {
            return Math.max(0.02, this.R * profileAt(t) * (1 + this.asymAt(t, phi)));
        }
        coreR(t, phi) {
            const o = this.outerR(t, phi);
            return Math.max(0.02, o - this.cfg.kernelH * kernelSizeAt(t) * 0.94 * kernelMaskAt(t));
        }

        // ---- 芯（粒のすき間から覗く。両端は露出する）-------------------
        _buildCob(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const r = this.coreR(t, phi);
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const CUT = cfg.cut, COB = cfg.cob, TIP = cfg.tipCob;
            const colsFn = (v, u) => {
                const g = 0.90 + 0.20 * Noise.fbm3(
                    Math.cos(u * TAU) * 8, Math.sin(u * TAU) * 8, v * 26, this.nseed + 3, 2);
                // 【対策】すき間から覗く芯を明るくすると、粒の輪郭が消えて
                //         全体が黄色い塊になる。芯は思い切って沈ませる
                let r = mix(CUT[0], COB[0], smooth(0.020, 0.075, v));
                let gg = mix(CUT[1], COB[1], smooth(0.020, 0.075, v));
                let b = mix(CUT[2], COB[2], smooth(0.020, 0.075, v));
                const tp = smooth(0.930, 0.995, v);
                r = mix(r, TIP[0], tp); gg = mix(gg, TIP[1], tp); b = mix(b, TIP[2], tp);
                return [srgb(r * g), srgb(gg * g), srgb(b * g)];
            };
            const mesh = sweep("cornCob", rings, centers, colsFn, this.scene);
            mesh.material = skin.cob;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
        }

        // ---- 粒（1本ぶんを1メッシュに結合）-----------------------------
        // 【対策】粒を個別のメッシュにするとドローコールが400を超える。
        //         かといってサムインスタンスにすると1粒ずつ色を変えるのが
        //         面倒になる。頂点カラー付きで1枚に結合するのがいちばん素直
        _buildKernels(skin) {
            const cfg = this.cfg;
            const K = cfg.kernelRings, M = cfg.kernelSides;
            const rows = cfg.rows;
            const dt = cfg.pitch / this.L;
            const perRow = Math.ceil(this._qMax / dt) + 2;
            const vPer = 1 + K * (M + 1);
            const tPer = M + (K - 1) * M * 2;

            // 先に個数を数えて配列を一度で確保する
            const cells = [];
            for (let r = 0; r < rows; r++) {
                for (let k = 0; k < perRow; k++) {
                    // 【対策】完全な格子に並べるとビーズカーテンになる。
                    //         実物の粒は押し合ってわずかにずれ、大きさも揃わない。
                    //         fill に余裕があるので、ずらしてもすき間は開かない
                    const jt = (Noise._h2(r, k, this.seed + 4441) - 0.5) * cfg.jitterT;
                    const q = (k + 0.5 * (r & 1) + 0.20 + jt) * dt;
                    const t = this.tOfQ(q);
                    if (t < KERN_T0 || t > KERN_T1) continue;
                    const sz = kernelSizeAt(t);
                    if (sz < 0.10) continue;
                    cells.push({ r, k, t, sz, w: this.axialW(t) });
                }
            }
            const nK = cells.length;
            const positions = new Float32Array(nK * vPer * 3);
            const uvs = new Float32Array(nK * vPer * 2);
            const colors = new Float32Array(nK * vPer * 4);
            const indices = new Uint32Array(nK * tPer * 3);

            // 超楕円の足あと（角の丸い四角）
            const P = cfg.roundness;
            const rho = new Float32Array(M + 1);
            for (let j = 0; j <= M; j++) {
                const th = (j % M) / M * TAU;
                const ca = Math.abs(Math.cos(th)), sa = Math.abs(Math.sin(th));
                rho[j] = 1 / Math.pow(Math.pow(ca, P) + Math.pow(sa, P), 1 / P);
            }

            const KT = cfg.kTop, KD = cfg.kDeep, KP = cfg.kPale, KW = cfg.kWhite;
            let vo = 0, io = 0, refRad = null;

            for (let ci = 0; ci < nK; ci++) {
                const { r, k, t, sz, w } = cells[ci];
                const jp = (Noise._h2(r, k, this.seed + 5557) - 0.5) * cfg.jitterP;
                const jh = Noise._h2(r, k, this.seed + 6673) - 0.5;      // -0.5..0.5
                const js = 1 + cfg.jitterS * jh;                          // 足あとの大小
                const phi0 = ((r + cfg.spiral * t + jp) / rows) * TAU + this.rowPhase;
                const cr0 = this.coreR(t, phi0);
                // 【対策】張り出しだけ小さくして足あとをそのまま残すと、
                //         先端で粒どうしのすき間が開いて芯が丸見えになる。
                //         足あとは控えめに、高さはしっかり縮める
                const fs = (0.74 + 0.26 * sz) * js;
                const halfW = (TAU * cr0 / rows) * 0.5 * cfg.fillW * fs;
                const halfH = dt * this.L * 0.5 * cfg.fillH * fs * w;
                const hK = cfg.kernelH * sz * (1 + 0.16 * jh);         // 張り出しの高低

                // 粒ごとの個性
                const h1 = Noise._h2(r, k, this.seed + 11);
                const h2 = Noise._h2(r, k, this.seed + 907);
                const isWhite = Noise._h2(r, k, this.seed + 2311) < cfg.whiteRatio;
                const base = isWhite ? KW : KT;
                const tone = 0.92 + 0.16 * h1;
                // 両端の粒は色が抜ける
                const pale = clamp(smooth(0.68, 0.985, t) * 0.85
                    + (1 - smooth(0.055, 0.235, t)) * 0.65, 0, 1);
                const topR = mix(base[0], KP[0], pale) * tone;
                const topG = mix(base[1], KP[1], pale) * tone;
                const topB = mix(base[2], KP[2], pale) * tone;
                const atlas = ((r * 7 + k * 3) & 3) + 4 * ((r * 5 + k * 11) & 3);
                const ax = atlas & 3, ay = (atlas >> 2) & 3;
                // 粒の傾き（先端側へわずかに倒れる）
                const lean = 0.10 + 0.06 * h2;

                const vBase = vo;
                for (let i = 0; i <= K; i++) {
                    const s = i / K;
                    const jn = (i === 0) ? 1 : (M + 1);
                    for (let j = 0; j < jn; j++) {
                        const th = (j % M) / M * TAU;
                        const rr = (i === 0) ? 0 : rho[j] * s;
                        const cth = Math.cos(th), sth = Math.sin(th);
                        // 実物の粒は裾より天面のほうが先端寄りに張り出す
                        const du = cth * rr * halfW * (1 + 0.05 * sth);
                        const dw = sth * rr * halfH + lean * halfH * (1 - s) * 0.5;
                        // 天面は丸みを残し、裾は立てたまま芯の中へ潜らせる
                        // 【対策】隣と接する位置（s = 1/fill ≒ 0.85）での高さが
                        //         天面の 7 割を下回ると、そこが暗い谷として
                        //         見えてしまい粒が歯抜けになる
                        const hp = Math.pow(Math.max(0, 1 - Math.pow(s, cfg.plumpness)), cfg.flatness)
                            - 0.55 * smooth(0.86, 1.0, s);
                        // 天面に走る浅い縦の溝
                        const crease = 1 - 0.075 * Math.exp(-Math.pow(du / (halfW * 0.36), 2))
                            * (1 - smooth(0.45, 1.0, s));
                        const hh = hK * hp * crease;

                        const t2 = clamp(t + dw / this.L, 0, 1);
                        const f = this.lut(t2);
                        const cr = this.coreR(t2, phi0);
                        const ph = phi0 + du / Math.max(0.08, cr);
                        const rad = cr + hh;
                        const cs = Math.cos(ph), sn = Math.sin(ph);
                        const nx = f.nx * cs + f.bx * sn;
                        const ny = f.ny * cs + f.by * sn;
                        const nz = f.nz * cs + f.bz * sn;

                        const p3 = vo * 3;
                        positions[p3] = f.cx + nx * rad;
                        positions[p3 + 1] = f.cy + ny * rad;
                        positions[p3 + 2] = f.cz + nz * rad;
                        if (refRad === null) refRad = { x: nx, y: ny, z: nz, i: vo };

                        const p2 = vo * 2;
                        uvs[p2] = (ax + (cth * rr * 0.5 + 0.5)) * 0.25;
                        uvs[p2 + 1] = (ay + (sth * rr * 0.5 + 0.5)) * 0.25;

                        // 裾へ向かって沈め、いちばん外はすき間の影として暗く
                        // 【対策】沈み始めが早いと粒全体がくすむ。実際に谷になる
                        //         s≒0.85 から先だけを暗くして溝の線を出す
                        const dk = Math.pow(s, 2.2);
                        const cre = smooth(0.80, 1.0, s) * 0.60;
                        const p4 = vo * 4;
                        colors[p4] = srgb(mix(mix(topR, KD[0], dk), KD[0] * 0.55, cre));
                        colors[p4 + 1] = srgb(mix(mix(topG, KD[1], dk), KD[1] * 0.55, cre));
                        colors[p4 + 2] = srgb(mix(mix(topB, KD[2], dk), KD[2] * 0.55, cre));
                        colors[p4 + 3] = 1;
                        vo++;
                    }
                }
                // 中心の扇
                for (let j = 0; j < M; j++) {
                    indices[io++] = vBase;
                    indices[io++] = vBase + 1 + j;
                    indices[io++] = vBase + 1 + j + 1;
                }
                // リング間
                for (let i = 1; i < K; i++) {
                    const a0 = vBase + 1 + (i - 1) * (M + 1);
                    const b0 = a0 + (M + 1);
                    for (let j = 0; j < M; j++) {
                        indices[io++] = a0 + j; indices[io++] = b0 + j; indices[io++] = a0 + j + 1;
                        indices[io++] = a0 + j + 1; indices[io++] = b0 + j; indices[io++] = b0 + j + 1;
                    }
                }
            }

            let normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            // 【対策】粒どうしは頂点を共有しないので ComputeNormals をかけると
            //         1粒ずつ独立してスムーズシェーディングされる（これは望みどおり）。
            //         ただし巻き順を間違えると全部が裏返るので、1粒目の天面法線が
            //         外を向いているかだけ確認して、必要なら反転する
            const ri = refRad.i * 3;
            if (normals[ri] * refRad.x + normals[ri + 1] * refRad.y + normals[ri + 2] * refRad.z < 0) {
                for (let i = 0; i < indices.length; i += 3) {
                    const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
                }
                normals = new Float32Array(positions.length);
                BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            }

            const mesh = makeMesh("cornKernels", positions, indices, normals, uvs, colors, this.scene);
            mesh.material = skin.kernel;
            mesh.receiveShadows = true;
            this.kernelCount = nK;
            this.parts.push(mesh);
        }

        // ---- 根元の折り取った茎 ---------------------------------------
        _buildStalk(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stalkSegments, M = cfg.stalkSides;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);
            // 【対策】茎が細く短いと、白い切り口に爪楊枝を刺したように見える。
            //         実物のもぎ口は太くて短い塊で、芯の切り口をほぼ覆い隠す
            const H = this.L * rng.range(0.060, 0.095);
            const R0 = this.R * 0.42;
            const rings = [], centers = [];
            // 【対策】折り取った茎の先を平らに切ると、木のダボを刺したように
            //         見える。角度ごとに長さを変えてちぎれた縁を作る
            const tear = [];
            for (let j = 0; j <= M; j++) {
                tear.push(0.38 + 0.92 * Noise._h2(j % M, 5, this.seed + 71));
            }
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const ring = [];
                let sumY = 0;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    // 【対策】始点を芯の中へ埋めないと、茎の底面と芯の切り口が
                    //         同一平面になって Z ファイティングを起こす
                    const y = H * s * mix(1, tear[j], smooth(0.40, 1.0, s)) - 0.15 * H;
                    // 先細りではなく、ちぎれて少し開いた樽形にする
                    const r = R0 * (1 - 0.06 * s + 0.14 * Math.sin(Math.PI * s))
                        * (1 + 0.11 * Math.cos(3 * phi + 0.7) + 0.06 * Math.cos(7 * phi + 2.1));
                    const c = base.add(dir.scale(y));
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f0.N.x * cs + f0.B.x * sn) * r,
                        c.y + (f0.N.y * cs + f0.B.y * sn) * r,
                        c.z + (f0.N.z * cs + f0.B.z * sn) * r));
                    sumY += y;
                }
                rings.push(ring);
                centers.push(base.add(dir.scale(sumY / (M + 1))));
            }
            const ST = cfg.stalk, CUT = cfg.cut;
            const colsFn = (v, u) => {
                const g = 0.86 + 0.28 * Noise.fbm3(
                    Math.cos(u * TAU) * 11, Math.sin(u * TAU) * 11, v * 10, this.nseed + 17, 2);
                // 縦に走る繊維の陰影
                const fib = 0.92 + 0.14 * Math.pow(0.5 + 0.5 * Math.cos(u * TAU * 9 + 1.3), 1.6);
                const w = smooth(0.20, 0.85, v);
                return [
                    srgb(mix(CUT[0], ST[0], w) * g * fib),
                    srgb(mix(CUT[1], ST[1], w) * g * fib),
                    srgb(mix(CUT[2], ST[2], w) * g * fib)
                ];
            };
            const mesh = sweep("cornStalk", rings, centers, colsFn, this.scene);
            mesh.material = skin.stalk;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
        }

        // 当たり判定：粒を含んだ点群から凸包を取ると面が数千枚になり、
        // 接触マニフォールドが毎ステップ飛び移って震える。
        // 【対策】粒の凹凸は捨て、外径をなぞった滑らかな代理から凸包を起こす
        hullShape() {
            const N = 20, M = 16;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const r = this.outerR(t, phi) * 0.985;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("cornProxy", rings, centers, null, this.scene);
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
        console.warn("[Corn] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.62;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.20, 60, new V3(0, 2.4, 0), scene);
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
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.96);
    key.specular = new BABYLON.Color3(0.80, 0.78, 0.72);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.0;
    fillL.diffuse = new BABYLON.Color3(1.0, 0.98, 0.92);
    fillL.specular = new BABYLON.Color3(0.26, 0.24, 0.20);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.52;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.72, 0.68);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 40;
    sg.depthScale = 40;
    sg.darkness = 0.48;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.10;
    ip.contrast = 1.06;
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
        bShape.material = { friction: 0.72, restitution: 0.0 };
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
            // 【対策】とうもろこしは太い円柱なので、傾けて落とすと籠の中で
            //         立ってしまう。長手をほぼ水平にしてから放す
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                rng.gauss(0, 0.14), rng.range(0, TAU), rng.gauss(0, 0.10));
            const r = GLOBAL.basketRim * 0.26 * Math.sqrt(rng.next());
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
                    (i - (items.length - 1) / 2) * items[i].R * 2.3);
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

        let skin = skinCache[varietyKey];
        if (!skin) { skin = new Skin(scene, cfg); skinCache[varietyKey] = skin; }

        for (let i = 0; i < cfg.count; i++) {
            items.push(new Corn(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.40, 0);
        camera.radius = cfg.basketRim * 3.2;

        resetDrop(seed);
        console.log("[Corn]", BUILD, "/", cfg.label, "/ seed =", cfg.seed,
            "/", cfg.count, "本 / 粒", items[0] ? items[0].kernelCount : 0, "個");
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
        // 【対策】粒どうしのすき間は SSAO がいちばん効くところ。
        //         半径を粒の大きさ（数mm）に合わせて小さく取らないと、
        //         粒の集合がのっぺりした円柱に戻る
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.85, blurRatio: 1.0 }, [camera]);
        ssao.radius = 0.55;
        ssao.totalStrength = 1.10;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 200;
        ssao.minZAspect = 0.25;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.96;
    dp.bloomWeight = 0.09;
    dp.bloomKernel = 40;
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
        idle: "#2b2408", active: "#9a7410", edge: "#4b4227",
        text: "#faf3df", sub: "#cbb886", accent: "#f4cf62"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "248px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(20,16,4,0.82)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "216px"; panel.isVertical = true;
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

    addLabel("TOUMOROKOSHI", 11, COL.sub, "18px");
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
    for (const c of [2, 3, 5]) {
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
            + "cm 径 " + (e.R * 2).toFixed(1) + "cm\n"
            + curCfg.rows + "列 " + e.kernelCount + "粒  seed: " + curSeed;
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
    toggleBtn.background = "rgba(20,16,4,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(20,16,4,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;