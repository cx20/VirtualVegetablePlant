// =====================================================================
//  Photoreal Cucumber  /  写実的なきゅうり      BUILD: kyuri-E
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  kyuri-B からの変更点:
//    ・法線マップの v 方向の符号を修正（(yu - yd) → (yd - yu)）
//    ・表示モード（通常 / 白クレイ / 法線マップ）を追加
//    ・イボの凹凸の強さ・凹凸の向きのトグルを追加
//  kyuri-C からの変更点:
//    ・診断ライト（ほぼ真横から長軸に沿って当てる）を追加。
//      既定の照明は全部「上から」で果実は寝ているため、法線の v 成分が
//      ほとんど陰影に出ず、「凹凸の向き」を切り替えても絵が変わらない
//
//  構成:
//    0. CONFIG      … 品種プリセット（白いぼ / 四葉 / ミニ）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 半径プロファイル / 曲がった軸 / 断面 / イボの場
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Cucumber    … 果実 + ヘタ（短い果柄）
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  実物の要点（ここを外すと「緑の棒」になる）:
//    ・胴のほとんどが平行。太さの変化はヘタ寄りとお尻だけ
//    ・縦に10本前後の浅い稜がある。ハイライトがこの稜に沿って途切れる
//    ・イボ（疣）は等間隔ではなく、疎らに散る。根元が濃緑で先端だけ白い
//    ・色は一様な緑ではない。ヘタ側が濃く、お尻へ向かって黄緑へ抜ける
//    ・現代の白いぼきゅうりはブルームレスでよく光る。ただし鏡ではない
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        shiroibo: {
            label: "白いぼ",
            length: 21.5, radius: 1.42,
            fullness: 1.00,
            bendA: 0.030, bendB: 0.012,
            ridgeCount: 10, ridgeAmp: 0.028, twist: 1.1,
            asymmetry: 0.022,
            // イボ
            // 【対策】実物のイボは直径 1〜3mm しかない。大きく作ると
            //         水玉模様のビニール人形になる。格子を細かくして
            //         1個あたりを小さくし、数で密度を出す
            wartU: 16, wartV: 38, wartSize: 0.17, wartDensity: 0.45,
            wartAmp: 0.030, wartTip: 0.35,      // wartTip: 先端が白くなる割合
            // 色（sRGB）
            skinDark: [0.130, 0.300, 0.075],    // ヘタ側の濃い緑
            skinMid: [0.235, 0.455, 0.115],
            skinLight: [0.430, 0.640, 0.180],   // 縦の淡い条
            skinTip: [0.560, 0.700, 0.230],     // お尻寄りの黄緑
            wartBase: [0.105, 0.235, 0.060],
            wartPeak: [0.790, 0.800, 0.545],
            fleck: [0.860, 0.870, 0.560],       // 細かい淡点
            stem: [0.300, 0.420, 0.150], stemCut: [0.760, 0.740, 0.520],
            stemLen: 0.045, stemRadius: 0.34,
            skinRoughness: 0.24, waxIntensity: 1.00, bloom: 0.10
        },
        suyo: {
            label: "四葉（すうよう）",
            length: 26.0, radius: 1.34,
            fullness: 0.96,
            bendA: 0.052, bendB: 0.020,
            ridgeCount: 10, ridgeAmp: 0.040, twist: 1.7,
            asymmetry: 0.028,
            // 四葉はイボが多くて大きく、しわも強い
            wartU: 15, wartV: 42, wartSize: 0.26, wartDensity: 0.38,
            wartAmp: 0.060, wartTip: 0.55,
            skinDark: [0.115, 0.275, 0.065],
            skinMid: [0.205, 0.410, 0.100],
            skinLight: [0.390, 0.600, 0.165],
            skinTip: [0.520, 0.665, 0.210],
            wartBase: [0.090, 0.215, 0.050],
            wartPeak: [0.815, 0.820, 0.580],
            fleck: [0.870, 0.875, 0.580],
            stem: [0.285, 0.400, 0.140], stemCut: [0.750, 0.730, 0.510],
            stemLen: 0.050, stemRadius: 0.33,
            // ブルームが残るので白っぽく曇る
            skinRoughness: 0.34, waxIntensity: 0.62, bloom: 0.30
        },
        mini: {
            label: "ミニきゅうり",
            length: 12.0, radius: 1.32,
            fullness: 1.06,
            bendA: 0.022, bendB: 0.008,
            ridgeCount: 9, ridgeAmp: 0.022, twist: 0.7,
            asymmetry: 0.020,
            wartU: 15, wartV: 22, wartSize: 0.18, wartDensity: 0.50,
            wartAmp: 0.028, wartTip: 0.30,
            skinDark: [0.140, 0.320, 0.080],
            skinMid: [0.250, 0.480, 0.125],
            skinLight: [0.450, 0.665, 0.195],
            skinTip: [0.585, 0.720, 0.250],
            wartBase: [0.110, 0.245, 0.062],
            wartPeak: [0.780, 0.795, 0.535],
            fleck: [0.850, 0.865, 0.550],
            stem: [0.310, 0.430, 0.160], stemCut: [0.765, 0.745, 0.525],
            stemLen: 0.060, stemRadius: 0.36,
            skinRoughness: 0.22, waxIntensity: 1.05, bloom: 0.08
        }
    };

    const GLOBAL = {
        count: 5,                  // 本数

        // 籠（ざる）
        basketRim: 17.5,           // 縁の半径 cm
        basketDepth: 6.2,          // 深さ cm
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
        pieceMass: 1.0,            // 全body一律なら比だけが効く。極小値は数値的に不利
        friction: 0.85,
        restitution: 0.02,
        linearDamping: 0.15,
        angularDamping: 0.90,
        dropInterval: 0.24,
        dropClearance: 1.6,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 5.0,

        segmentsAxis: 176,
        segmentsRound: 96,
        stemSegments: 12,
        stemSides: 12,

        textureSize: 1024,         // イボを解像するので茄子より大きめ
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

    const START_VARIETY = "shiroibo";
    const START_SEED = 20260726;
    const BUILD = "kyuri-E";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】イボの位置は、ジオメトリの変位とテクスチャの両方が同じものを
        //         見ていなければならない。テクスチャは品種単位でキャッシュされる
        //         ので、イボの種も品種名から決めて個体乱数から切り離す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.wartSeed = (h >>> 0) % 100000;
        // 本数が多いときは分割を落とす
        if (cfg.count > 3) { cfg.segmentsAxis = 120; cfg.segmentsRound = 64; }
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
    function sweep(name, rings, centers, colsFn, scene) {
        const N = rings.length, M = rings[0].length;
        const total = N * M + 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const colors = colsFn ? new Float32Array(total * 4) : null;
        const mid = centers[Math.floor(N / 2)];
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

        // 【対策】判定の基準は端ではなく胴の中央。半径が最大で法線が素直に
        //         外を向いており、個体によらず安定する
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], false, refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Profile / イボの場
    // =================================================================
    // [軸方向 t, 半径比]。t=0 がヘタ側、t=1 がお尻
    // 【対策】きゅうりは胴のほとんどが平行。中央を膨らませるとズッキーニになる
    const PROFILE = [
        [0.000, 0.100], [0.020, 0.420], [0.045, 0.660], [0.080, 0.820],
        [0.130, 0.910], [0.200, 0.960], [0.300, 0.985], [0.420, 1.000],
        [0.550, 1.000], [0.680, 0.992], [0.790, 0.975], [0.870, 0.945],
        [0.930, 0.885], [0.968, 0.760], [0.990, 0.500], [1.000, 0.060]
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

    // イボ（疣）の場。u は周方向（0..1、周期的）、v は軸方向（0..1）
    // 【対策】格子に等間隔で並べると「ゴルフボール」になる。セル内で位置を
    //         散らし、さらに一部のセルだけを実際のイボにして疎らにする。
    //         セルの縦横比を実寸（円周 : 全長）に合わせないと楕円のイボになる
    function wartAt(u, v, cfg) {
        const seed = cfg.wartSeed;
        const NU = cfg.wartU, NV = cfg.wartV;
        const gu = u * NU, gv = v * NV;
        const cu = Math.floor(gu), cv = Math.floor(gv);
        let best = 1e9, bh = 0, bOn = 0;
        for (let dv = -1; dv <= 1; dv++) {
            for (let du = -1; du <= 1; du++) {
                const iu = cu + du, iv = cv + dv;
                let wu = iu % NU; if (wu < 0) wu += NU;
                const h1 = Noise._h2(wu, iv, seed);
                const h2 = Noise._h2(wu, iv, seed + 7717);
                const px = iu + 0.16 + 0.68 * h1;
                const py = iv + 0.16 + 0.68 * h2;
                const d = Math.hypot(gu - px, gv - py);
                if (d < best) {
                    best = d;
                    bh = Noise._h2(wu, iv, seed + 3313);
                    bOn = Noise._h2(wu, iv, seed + 5591);
                }
            }
        }
        if (bOn < cfg.wartDensity) return { h: 0, tip: 0, size: 0 };
        const size = cfg.wartSize * (0.55 + 0.90 * bh);
        // 両端では消える（ヘタとお尻にはイボが立たない）
        const ends = smooth(0.02, 0.09, v) * (1 - smooth(0.92, 0.985, v));
        const h = smooth(size, size * 0.22, best) * ends;
        return { h, tip: bh, size };
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
            // 【対策】両端に近づくほど u 方向が圧縮される。等方フィルタだと
            //         GPU が u 側の縮小率に合わせて高い LOD を選び、
            //         端の一帯がまとめてぼやける
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },

        // 果皮の高さ場。アルベド / ORM / 法線で共有する
        // 【対策】3枚を別々のノイズで作ると、イボの位置がずれて
        //         「粒の上にぼんやりした汚れが乗った」ように見える
        skinHeight(size, cfg) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    const u = x / size;
                    const w = wartAt(u, v, cfg).h;
                    // 縦に伸びた細かいしわ + ごく浅いうねり
                    const wrinkle = Noise.fbm2u(u * 26, v * 110, 26, cfg.wartSeed + 11, 3);
                    const dent = Noise.fbm2u(u * 9, v * 18, 9, cfg.wartSeed + 23, 3);
                    h[y * size + x] = clamp(0.50 * w + 0.32 * wrinkle + 0.18 * dent, 0, 1);
                }
            }
            return h;
        },

        albedo(scene, size, cfg, hf) {
            const D = cfg.skinDark, M = cfg.skinMid, L = cfg.skinLight, T = cfg.skinTip;
            const WB = cfg.wartBase, WP = cfg.wartPeak, FL = cfg.fleck;
            return this._tex("kyuriAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const phi = u * Math.PI * 2;
                        // 【対策】一様な緑にすると塩ビのホースになる。
                        //         ヘタ側が濃く、お尻へ向かって黄緑へ抜ける
                        const grade = smooth(0.05, 0.90, v);
                        let cr = mix(D[0], M[0], smooth(0.02, 0.30, v));
                        let cg = mix(D[1], M[1], smooth(0.02, 0.30, v));
                        let cb = mix(D[2], M[2], smooth(0.02, 0.30, v));
                        cr = mix(cr, T[0], smooth(0.55, 1.0, v) * 0.85);
                        cg = mix(cg, T[1], smooth(0.55, 1.0, v) * 0.85);
                        cb = mix(cb, T[2], smooth(0.55, 1.0, v) * 0.85);
                        // 縦の淡い条。稜の上が明るい
                        const rib = 0.5 + 0.5 * Math.cos(cfg.ridgeCount * phi + cfg.twist * v);
                        const streak = Math.pow(rib, 2.2)
                            * smooth(0.35, 0.75, Noise.fbm2u(u * 5, v * 3, 5, cfg.wartSeed + 31, 2));
                        cr = mix(cr, L[0], streak * 0.55);
                        cg = mix(cg, L[1], streak * 0.55);
                        cb = mix(cb, L[2], streak * 0.55);
                        // 濃淡のムラ（縦に引き伸ばす）
                        const mott = 0.88 + 0.24 * Noise.fbm2u(u * 7, v * 22, 7, cfg.wartSeed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // イボ：根元が濃緑、先端だけ白っぽい
                        // 【対策】濃緑の暈を広く取り、白い先端を大きく乗せると
                        //         ダルメシアンになる。暈は内側だけ、白い先端は
                        //         てっぺんのごく一部、しかも一部のイボにだけ
                        const W = wartAt(u, v, cfg);
                        if (W.h > 0.001) {
                            const base = smooth(0.10, 0.60, W.h);
                            cr = mix(cr, WB[0], base * 0.70);
                            cg = mix(cg, WB[1], base * 0.70);
                            cb = mix(cb, WB[2], base * 0.70);
                            const peak = smooth(0.80, 0.99, W.h)
                                * (W.tip > (1 - cfg.wartTip) ? 0.85 : 0.08);
                            cr = mix(cr, WP[0], peak);
                            cg = mix(cg, WP[1], peak);
                            cb = mix(cb, WP[2], peak);
                        }
                        // 細かい淡点（実物にある黄白色の粒）
                        const fl = smooth(0.965, 0.995, Noise.fbm2u(u * 120, v * 300, 120, cfg.wartSeed + 47, 1));
                        cr = mix(cr, FL[0], fl * 0.75); cg = mix(cg, FL[1], fl * 0.75); cb = mix(cb, FL[2], fl * 0.75);
                        // お尻の花落ち跡
                        const scar = smooth(0.985, 1.0, v);
                        cr = mix(cr, 0.42, scar); cg = mix(cg, 0.44, scar); cb = mix(cb, 0.26, scar);
                        // 肌理による微小な明暗
                        const k = 0.94 + 0.12 * hf[y * N + x];
                        d[i] = clamp(cr * k, 0, 1) * 255;
                        d[i + 1] = clamp(cg * k, 0, 1) * 255;
                        d[i + 2] = clamp(cb * k, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // R=AO / G=roughness
        orm(scene, size, cfg, hf) {
            return this._tex("kyuriORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const h = hf[y * N + x];
                        let rough = cfg.skinRoughness * (0.85 + 0.35 * h);
                        // 【対策】艶を一様にすると射出成形のプラスチックになる。
                        //         実物はブルームや擦れで局所的に曇る
                        const bl = Noise.fbm2u(u * 4, v * 9, 4, cfg.wartSeed + 41, 3);
                        rough = mix(rough, 0.55, smooth(0.50, 0.88, bl) * cfg.bloom * 2.4);
                        // イボの頂点は乾いていて明らかに粗い
                        const W = wartAt(u, v, cfg);
                        rough = mix(rough, 0.66, smooth(0.55, 0.95, W.h));
                        // 両端は艶が落ちる
                        rough = mix(rough, 0.52, smooth(0.965, 1.0, v));
                        rough = mix(rough, 0.52, smooth(0.035, 0.0, v));
                        let ao = 1.0;
                        ao = mix(ao, 0.80, smooth(0.10, 0.0, W.h) * 0.0 + smooth(0.0, 0.25, W.h) * 0.0);
                        // イボの根元にわずかな陰
                        ao = mix(ao, 0.82, smooth(0.05, 0.30, W.h) * (1 - smooth(0.45, 0.85, W.h)));
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.03, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, hf, strength) {
            return this._tex("kyuriNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 極ではUが潰れて放射状の筋になるので端を減衰させる
                    const vv = y / N;
                    const k = strength * smooth(0, 0.05, vv) * (1 - smooth(0.95, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        // 【対策】(yu - yd) = -dh/dv は「V が上を向く」OpenGL 系の規約。
                        //         Babylon の接空間は V が下向きなので、そのままだと法線が
                        //         u方向は正・v方向は逆というねじれた状態になり、
                        //         イボがジオメトリでは膨らんでいるのに陰影は凹んで見える
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
            const OVER = [0.82, 0.72, 0.50], UNDER = [0.66, 0.55, 0.36], GAP = [0.30, 0.23, 0.13];
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
                        const shade = over ? (0.70 + 0.42 * bv) : (0.44 + 0.26 * bu);
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
            const hf = TextureLab.skinHeight(S, cfg);
            this.albedoTex = TextureLab.albedo(scene, S, cfg, hf);
            this.ormTex = TextureLab.orm(scene, S, cfg, hf);
            this.normalTex = TextureLab.normal(scene, S, hf, 1.6);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("kyuriSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.85;          // イボはここで立たせる
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】ブルームレスのきゅうりはよく光るが鏡ではない。
            //         クリアコートを一様に強く・滑らかにすると樹脂になるので、
            //         曇りは ORM 側のブルームで作り、クリアコートは素直に効かせる
            m.clearCoat.isEnabled = true;
            m.clearCoat.intensity = 0.45 * cfg.waxIntensity;
            m.clearCoat.roughness = 0.24;
            m.clearCoat.indexOfRefraction = 1.45;
            // 果肉の透け。縁がわずかに明るくなる
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.55, 0.78, 0.35);
            m.subSurface.translucencyIntensity = 0.14;
            m.subSurface.minimumThickness = 0.4;
            m.subSurface.maximumThickness = 2.4;
            this.skin = m;

            const st = new BABYLON.PBRMaterial("kyuriStem", scene);
            st.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            st.metallic = 0.0;
            st.roughness = 0.70;
            st.transparencyMode = OPAQUE;
            st.zOffset = -2;
            st.zOffsetUnits = -16;
            this.stem = st;
        }

        // 表示モード 0=通常 / 1=白クレイ（法線のみ）/ 2=法線マップそのもの
        // 【対策】法線の向きが正しいかは、アルベドを外して陰影だけにするのが
        //         いちばん確実。緑と白のイボの色差に紛れて判定できない
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
                m.subSurface.isTranslucencyEnabled = false;
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
                m.subSurface.isTranslucencyEnabled = false;
            } else {
                m.albedoTexture = this.albedoTex;
                m.albedoColor = new C3(1, 1, 1);
                m.metallicTexture = this.ormTex;
                m.roughness = 1.0;              // 実値は ORM の G
                m.clearCoat.isEnabled = true;
                m.subSurface.isTranslucencyEnabled = true;
            }
        }

        dispose() {
            this.skin.dispose(true, false);
            this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Cucumber
    // =================================================================
    class Cucumber {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.90, 1.10);
            this.R = cfg.radius * rng.range(0.92, 1.08) * cfg.fullness;
            this.nseed = rng.int(900000) + 1000;
            // 曲がりの向きと量。真っ直ぐなきゅうりは工業製品に見える
            this.bendA = cfg.bendA * rng.range(0.5, 1.7) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.2, 1.2);
            this.bendRoll = rng.range(0, Math.PI * 2);
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            this.ridgePhase = rng.range(0, Math.PI * 2);

            this.parts = [];
            this.stemAxis = [];
            this._buildBody(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("kyuri", scene);
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
        // 断面半径の倍率
        sectionAt(t, phi) {
            const cfg = this.cfg;
            // 縦の稜。両端で強く、胴の中央でやや弱まる
            const ridge = cfg.ridgeAmp * Math.cos(cfg.ridgeCount * phi + cfg.twist * t + this.ridgePhase)
                * (0.55 + 0.45 * (1 - Math.sin(Math.PI * t)));
            // 低周波の非対称。これが無いと完全な回転体になり、
            // ハイライトが直線になって樹脂に見える
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            const wob = 0.012 * (Noise.fbm3(Math.cos(phi) * 2.4, Math.sin(phi) * 2.4, t * 5.5, this.nseed, 3) - 0.5);
            // イボ。テクスチャと同じ場を使うので、法線マップと位置が揃う
            const w = wartAt(((phi / (Math.PI * 2)) % 1 + 1) % 1, t, cfg).h;
            return 1 + ridge + asym + wob + cfg.wartAmp * w;
        }
        radiusAt(t, phi) {
            return Math.max(0.004, this.R * profileAt(t) * this.sectionAt(t, phi));
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
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
            const mesh = sweep("kyuriBody", rings, centers, null, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // ヘタ：茄子と違って短い切り株。切り口だけ淡い
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);                       // 果実から離れる向き
            const L = cfg.stemLen * this.L * rng.range(0.85, 1.15);
            const tilt = rng.range(0.05, 0.20), tiltA = rng.range(0, Math.PI * 2);
            const side = f0.N.scale(Math.cos(tiltA)).add(f0.B.scale(Math.sin(tiltA)));
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const lean = Math.tan(tilt) * L * 0.55 * s * s;
                const c = base.add(dir.scale(L * s)).add(side.scale(lean));
                const taper = 0.90 + 0.30 * Math.pow(1 - s, 1.4) - 0.16 * smooth(0.75, 1.0, s);
                const rr = cfg.stemRadius * this.R * taper;
                // 当たり判定にもヘタを含めるので、軸を粗く控えておく
                if (i % 4 === 0 || i === K) this.stemAxis.push({ c: c, r: rr * 1.10 });
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const facet = 1 + 0.075 * Math.cos(5 * phi + s * 1.1) + 0.03 * Math.cos(9 * phi);
                    const r = rr * facet;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f0.N.x * cs + f0.B.x * sn) * r,
                        c.y + (f0.N.y * cs + f0.B.y * sn) * r,
                        c.z + (f0.N.z * cs + f0.B.z * sn) * r
                    ));
                }
                rings.push(ring); centers.push(c);
            }
            const LOW = cfg.stem, HI = [cfg.stem[0] * 1.35, cfg.stem[1] * 1.25, cfg.stem[2] * 1.4];
            const CUT = cfg.stemCut;
            const colsFn = (v, u) => {
                const w = smooth(0.05, 0.8, v);
                const cut = smooth(0.955, 1.0, v);
                const g = 0.88 + 0.24 * Noise.fbm3(Math.cos(u * 6.28) * 5, Math.sin(u * 6.28) * 5, v * 9, this.nseed + 7, 2);
                return [
                    srgb(mix(mix(LOW[0], HI[0], w), CUT[0], cut) * g),
                    srgb(mix(mix(LOW[1], HI[1], w), CUT[1], cut) * g),
                    srgb(mix(mix(LOW[2], HI[2], w), CUT[2], cut) * g)
                ];
            };
            const mesh = sweep("kyuriStem", rings, centers, colsFn, this.scene);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュから凸包を取ると生成が重いので、
        // 同じ関数を粗く評価した代理メッシュから凸包を起こす
        // 【対策】でこぼこの点群をそのまま凸包にすると、ほぼ同一平面の面が
        //         大量に生まれる。積み重なった状態では接触マニフォールドが
        //         毎ステップ別の面へ飛び移り、これが震えの主因になる。
        //         稜とイボと高周波は落とし、低周波の非対称だけ残す。
        //         またヘタを含めないと、ヘタだけ籠を突き抜けて見える
        hullShape() {
            const N = 20, M = 16;
            const rings = [], centers = [];
            const f0 = this.frameAt(0);
            for (let k = this.stemAxis.length - 1; k >= 0; k--) {
                const sa = this.stemAxis[k], ring = [];
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
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t), f = this.frameAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                        + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
                    const r = Math.max(0.004, this.R * profileAt(t) * (1 + asym)) * 0.97;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("kyuriProxy", rings, centers, null, this.scene);
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
        console.warn("[Kyuri] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.55;

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
    key.specular = new BABYLON.Color3(0.72, 0.72, 0.68);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.0;
    fillL.diffuse = new BABYLON.Color3(0.96, 1.0, 0.96);
    fillL.specular = new BABYLON.Color3(0.26, 0.28, 0.24);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.55;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.72, 0.74, 0.70);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】useBlurExponentialShadowMap は深度を指数関数で近似するため、
    //         ぼかすと影がキャスター自身の明るい面へにじみ出す。丸みのある
    //         物体だと曲線で縁取られた楕円の暗い領域になり、皮の痣や汚れと
    //         見分けがつかない。PCF なら深度比較そのものなので起きない
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    // 【対策】閉じたメッシュなら裏面だけをシャドウマップへ描けばよい。
    //         こうすると自己遮蔽（シャドウアクネ）が原理的に起きず、
    //         隣の個体へ落ちる影はそのまま残る
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0006;
    sg.normalBias = 0.02;
    sg.darkness = 0.44;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.06;
    ip.contrast = 1.14;
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

    // イボの凹凸の強さと法線の向き。実機で見ながら合わせられるようにする
    const BUMPS = [
        { label: "弱", level: 0.45 },
        { label: "中", level: 0.85 },
        { label: "強", level: 1.35 },
        { label: "最強", level: 2.00 }
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
    //         キュウリはざるの中で寝ている。接空間で光を (Lu, Lv, Ln) と書くと
    //         法線の v 成分を反転したときの陰影の変化は 2*nv*Lv、つまり
    //         「光の v 成分」＝長軸方向の成分に比例する。長軸が水平なら
    //         Lv ≒ 0 で、invertNormalMapY を切り替えても絵が動かない。
    //         ヘミスフェリックと IBL は上下の勾配が主成分なのでさらに打ち消す。
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
                rng.gauss(0, 0.45), rng.range(0, Math.PI * 2), rng.gauss(0, 0.45));
            const r = GLOBAL.basketRim * 0.42 * Math.sqrt(rng.next());
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
            items.push(new Cucumber(scene, cfg, (seed + i * 7919) >>> 0, skin));
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
        console.log("[Kyuri]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "本");
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
    dp.bloomWeight = 0.07;
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
        idle: "#1f2a1c", active: "#3f6b2c", edge: "#3a4a35",
        text: "#eef5e9", sub: "#a9bda0", accent: "#a8d47f"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(12,18,10,0.82)";
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

    addLabel("KYURI", 11, COL.sub, "18px");
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
    const bumpBtn = addButton("bump", "イボの凹凸: 中", () => {
        bumpIdx = (bumpIdx + 1) % BUMPS.length;
        applyRelief();
        bumpBtn.textBlock.text = "イボの凹凸: " + BUMPS[bumpIdx].label;
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
    toggleBtn.background = "rgba(12,18,10,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(12,18,10,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;