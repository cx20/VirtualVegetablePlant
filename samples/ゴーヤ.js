// =====================================================================
//  Photoreal Goya (Bitter Melon)  /  写実的なゴーヤー（苦瓜）  BUILD: goya-C
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  goya-A からの変更点:
//    ・法線マップの v 方向の符号を修正（(yu - yd) → (yd - yu)）
//      OpenGL 系の「V が上向き」の規約のままだったので、法線が
//      u方向は正・v方向は逆というねじれた状態になっていた
//    ・表示モード（通常 / 白クレイ / 法線マップ）を追加
//    ・粒の凹凸の強さ・凹凸の向きのトグルを追加
//    ・診断ライト（ほぼ真横から長軸に沿って当てる）を追加。
//      既定の照明は全部「上から」で果実は寝ているため、法線の v 成分が
//      ほとんど陰影に出ず、「凹凸の向き」を切り替えても絵が変わらない
//
//  構成:
//    0. CONFIG      … 品種プリセット（中長 / あばし / 白）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Fields      … 半径プロファイル / 稜（リブ）の場 / イボの場 / 細粒
//    5. TextureLab  … 果皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Goya        … 果実 + 短い果柄
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  きゅうり版からの主な変更点（ここを外すと「イボだらけのきゅうり」になる）:
//    ・胴は平行ではない。中央が最も太く、両端へ紡錘形に細る。特に先端は尖る
//    ・縦に8〜10本の「太い稜（リブ）」がある。稜の上は滑らかで、
//      イボが立つのは稜と稜のあいだ（谷と斜面）。ここが最大の見分け
//    ・稜は定規で引いたようには走らない。ゆっくり蛇行し、太い稜と細い稜が交互
//    ・イボは大小2階層。粗い瘤（数mm、ジオメトリで出す）と、
//      その上に載る細かい粒（1〜2mm、法線マップで出す）
//    ・色はきゅうりよりずっと濃い。谷が暗く、瘤の頂が明るい黄緑に抜ける
//    ・艶はある（特に稜の上）が、粒の集合がハイライトを砕くので鏡にはならない
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        nakanaga: {
            label: "中長ゴーヤー",
            length: 25.0, radius: 2.48,
            fullness: 1.00,
            tipBlunt: 0.15,                     // 0=先が尖る / 1=先が丸い
            bendA: 0.026, bendB: 0.010,
            // 稜（リブ）
            // 【対策】ridgeCount は偶数にすること。太い稜と細い稜を交互に
            //         する変調が周方向に半周期ぶん入るので、奇数だと
            //         u=0 の継ぎ目で稜の太さが不連続になる
            ridgeCount: 10, ridgeAmp: 0.160, ridgeAlt: 0.34,
            ridgeMeander: 0.016, twist: 0.22,
            asymmetry: 0.030,
            // 粗い瘤（ジオメトリ + テクスチャ）
            // 【対策】主役はこの大粒。直径7mm前後で、r0/r1 を離して大小を
            //         はっきり付ける。粒径をそろえると編み物の畝になる
            wartCell: { nu: 22, nv: 42, asp: 0.62, jitU: 0.34, jitV: 0.88, r0: 0.44, r1: 0.74, vari: 0.62, dome: 0.95, seed: 101 },
            wartAmp: 0.105, wartMean: 0.40,
            // 補助の小粒。大粒の肌理を作るだけで、単独では主張させない
            medCell: { nu: 56, nv: 96, asp: 0.68, jitU: 0.40, jitV: 0.90, r0: 0.42, r1: 0.62, vari: 0.55, dome: 0.85, seed: 307 },
            medAmp: 0.26,
            wartValley: 0.62,                   // 稜の頂で粒を消す割合
            // 最細のざらつき（法線マップのみ）
            grainU: 150, grainV: 240, grainAmp: 0.10,
            // 色（sRGB）
            skinDark: [0.055, 0.135, 0.040],    // 溝の底
            skinMid: [0.165, 0.345, 0.115],
            skinLight: [0.325, 0.520, 0.215],   // 稜（滑らかで淡い）
            skinTip: [0.205, 0.400, 0.140],     // 先端寄り
            wartBase: [0.085, 0.195, 0.062],
            wartPeak: [0.440, 0.645, 0.285],    // 粒の頂の明るい黄緑
            fleck: [0.530, 0.710, 0.355],
            stem: [0.155, 0.290, 0.085], stemCut: [0.620, 0.640, 0.420],
            stemLen: 0.075, stemRadius: 0.16,
            skinRoughness: 0.36, waxIntensity: 0.60, bloom: 0.10
        },
        abashi: {
            label: "あばしゴーヤー",
            // 沖縄の在来。短く太く、先も丸い。イボが大きく、色は少し淡い
            length: 19.0, radius: 3.05,
            fullness: 1.00,
            tipBlunt: 0.85,
            bendA: 0.018, bendB: 0.007,
            ridgeCount: 8, ridgeAmp: 0.180, ridgeAlt: 0.38,
            ridgeMeander: 0.022, twist: 0.14,
            asymmetry: 0.034,
            wartCell: { nu: 18, nv: 26, asp: 0.78, jitU: 0.40, jitV: 0.88, r0: 0.46, r1: 0.78, vari: 0.60, dome: 0.88, seed: 101 },
            wartAmp: 0.115, wartMean: 0.40,
            medCell: { nu: 44, nv: 62, asp: 0.80, jitU: 0.42, jitV: 0.90, r0: 0.42, r1: 0.62, vari: 0.55, dome: 0.85, seed: 307 },
            medAmp: 0.22,
            wartValley: 0.50,
            grainU: 120, grainV: 168, grainAmp: 0.08,
            skinDark: [0.098, 0.205, 0.066],
            skinMid: [0.250, 0.470, 0.170],
            skinLight: [0.430, 0.640, 0.300],
            skinTip: [0.300, 0.520, 0.205],
            wartBase: [0.135, 0.275, 0.092],
            wartPeak: [0.545, 0.735, 0.375],
            fleck: [0.620, 0.780, 0.430],
            stem: [0.175, 0.310, 0.095], stemCut: [0.640, 0.655, 0.435],
            stemLen: 0.070, stemRadius: 0.15,
            skinRoughness: 0.40, waxIntensity: 0.50, bloom: 0.14
        },
        shiro: {
            label: "白ゴーヤー",
            // 白れいし。ほとんど葉緑素が無く、稜も瘤もやわらかい
            length: 22.0, radius: 2.70,
            fullness: 1.00,
            tipBlunt: 0.50,
            bendA: 0.022, bendB: 0.009,
            ridgeCount: 10, ridgeAmp: 0.140, ridgeAlt: 0.28,
            ridgeMeander: 0.018, twist: 0.20,
            asymmetry: 0.028,
            wartCell: { nu: 22, nv: 40, asp: 0.66, jitU: 0.34, jitV: 0.88, r0: 0.43, r1: 0.72, vari: 0.60, dome: 1.00, seed: 101 },
            wartAmp: 0.090, wartMean: 0.40,
            medCell: { nu: 54, nv: 90, asp: 0.70, jitU: 0.40, jitV: 0.90, r0: 0.42, r1: 0.62, vari: 0.55, dome: 0.85, seed: 307 },
            medAmp: 0.24,
            wartValley: 0.66,
            grainU: 144, grainV: 228, grainAmp: 0.10,
            skinDark: [0.585, 0.625, 0.465],
            skinMid: [0.730, 0.762, 0.600],
            skinLight: [0.862, 0.882, 0.742],
            skinTip: [0.788, 0.806, 0.646],
            wartBase: [0.640, 0.676, 0.512],
            wartPeak: [0.925, 0.935, 0.822],
            fleck: [0.945, 0.950, 0.860],
            stem: [0.330, 0.400, 0.190], stemCut: [0.700, 0.700, 0.500],
            stemLen: 0.075, stemRadius: 0.16,
            skinRoughness: 0.42, waxIntensity: 0.42, bloom: 0.20
        }
    };

    const GLOBAL = {
        count: 5,                  // 本数

        // 籠（ざる）
        basketRim: 18.0,           // 縁の半径 cm
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
        gravity: 620,
        physicsHz: 120,
        pieceMass: 1.0,
        friction: 0.92,            // 【対策】ゴーヤーは稜のせいで転がりにくい。
        restitution: 0.02,         //         摩擦を上げないと籠の斜面を滑り落ちる
        linearDamping: 0.15,
        angularDamping: 0.92,
        dropInterval: 0.26,
        dropClearance: 1.8,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 5.5,

        // 【対策】稜10本＋イボ28列を解像するので、きゅうりより分割が要る。
        //         周方向はイボ1個あたり4頂点を割れる程度が下限
        segmentsAxis: 256,
        segmentsRound: 176,
        stemSegments: 12,
        stemSides: 12,

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

    const START_VARIETY = "nakanaga";
    const START_SEED = 20260726;
    const BUILD = "goya-C";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】稜とイボの位置は、ジオメトリの変位とテクスチャの両方が
        //         同じものを見ていなければならない。テクスチャは品種単位で
        //         キャッシュされるので、種も品種名から決めて個体乱数から切り離す。
        //         個体差は「長さ・太さ・曲がり・低周波の非対称・模様の回転」で出す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.wartSeed = (h >>> 0) % 100000;
        // 【対策】瘤1個あたり周方向に6頂点は要る。これを割ると、法線マップの
        //         凹凸だけが残ってシルエットが棒のように滑らかになり、
        //         「濃緑の棒に水玉を描いた」絵になる
        if (cfg.count > 3) { cfg.segmentsAxis = 232; cfg.segmentsRound = 152; }
        if (cfg.count > 5) { cfg.segmentsAxis = 176; cfg.segmentsRound = 128; }
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
    // 4. Fields （プロファイル / 稜 / イボ / 細粒）
    // =================================================================
    // [軸方向 t, 半径比]。t=0 がヘタ側、t=1 が先端
    // 【対策】きゅうりのように胴を平行にするとゴーヤーに見えない。
    //         ゴーヤーは中央がいちばん太い紡錘形で、先端は尖る。
    //         2本のプロファイルを持ち、品種の tipBlunt で混ぜる
    const PROF_SHARP = [
        [0.000, 0.055], [0.018, 0.230], [0.045, 0.400], [0.085, 0.560],
        [0.150, 0.740], [0.230, 0.870], [0.330, 0.950], [0.440, 0.992],
        [0.540, 1.000], [0.640, 0.980], [0.730, 0.935], [0.810, 0.855],
        [0.880, 0.720], [0.935, 0.545], [0.975, 0.310], [1.000, 0.030]
    ];
    const PROF_BLUNT = [
        [0.000, 0.075], [0.018, 0.280], [0.045, 0.480], [0.085, 0.655],
        [0.150, 0.825], [0.230, 0.925], [0.330, 0.980], [0.440, 1.000],
        [0.540, 1.000], [0.640, 0.992], [0.730, 0.968], [0.810, 0.922],
        [0.880, 0.845], [0.935, 0.715], [0.975, 0.495], [1.000, 0.090]
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

    // ---- 稜（リブ）の場 ----------------------------------------------
    // u は周方向（周期1、整数ぶんずらしても同じ）、t は軸方向 0..1
    // 【対策】cos をそのまま使うと蒲鉾を並べたようになる。実物の稜は
    //         「頂が広く、谷が細く深い」ので指数で潰す。
    //         また稜は一直線ではない。ゆっくり蛇行させないと押し出し成形に見える
    function ridgeAt(u, t, cfg) {
        const n = cfg.ridgeCount;
        const wander = cfg.ridgeMeander * (Noise.fbm2u(u * 3, t * 2.4, 3, cfg.wartSeed + 61, 3) - 0.5);
        const a = 2 * Math.PI * (n * (u + wander) + cfg.twist * t);
        // 太い稜と細い稜が交互に並ぶ（周期は稜2本ぶん）
        const alt = 1 + cfg.ridgeAlt * Math.cos(a * 0.5);
        const crest = Math.pow(0.5 + 0.5 * Math.cos(a), 0.62);
        // 両端では稜が収束して消える
        const fade = smooth(0.0, 0.13, t) * (1 - smooth(0.86, 1.0, t));
        return { crest: crest, amp: alt * fade };
    }

    // ---- 粒（イボ）の場 -----------------------------------------------
    // 【対策】セルの境界を溝にする方式（最近傍と2番目の距離差 F2-F1）は、
    //         角ばった板を敷き詰めた「ワニ革」や「干上がった泥」になる。
    //         実物のゴーヤーの粒には角が無く、断面が丸い。
    //         そこで球冠（ドーム）の和集合として作る。セルごとに中心と半径を
    //         決め、いちばん高いドームを採用すれば、丸いまま密に重なる。
    // 【対策】jitU（周方向のばらつき）を小さくすること。実物の粒は縦の列を
    //         なして並んでおり、完全にランダムに散らすと砂利をまぶした
    //         ように見える。asp < 1 で軸方向へ伸ばすと米粒状になる
    function cellAt(u, t, cfg, P) {
        const NU = P.nu, NV = P.nv, seed = cfg.wartSeed + P.seed;
        const gu = u * NU, gv = t * NV;
        const cu = Math.floor(gu), cv = Math.floor(gv);
        let bq = 0, bh = 0;
        for (let dv = -1; dv <= 1; dv++) {
            for (let du = -1; du <= 1; du++) {
                const iu = cu + du, iv = cv + dv;
                let wu = iu % NU; if (wu < 0) wu += NU;
                const a1 = Noise._h2(wu, iv, seed);
                const a2 = Noise._h2(wu, iv, seed + 7717);
                const a3 = (a1 * 7.13 + a2 * 3.71) % 1;
                const px = iu + 0.5 + P.jitU * (a1 - 0.5);
                const py = iv + 0.5 + P.jitV * (a2 - 0.5);
                const dx = gu - px, dy = (gv - py) * P.asp;
                const r = P.r0 + (P.r1 - P.r0) * a3;
                let q = 1 - (dx * dx + dy * dy) / (r * r);
                if (q <= 0) continue;
                // 【対策】sqrt（半球）だと球を貼り付けたブロッコリーになる。
                //         実物の瘤は皮が内から押し上げられた水ぶくれで、
                //         裾が広く頂が低い。dome で断面を寝かせる
                q = Math.pow(q, P.dome) * ((1 - P.vari) + P.vari * a3);
                if (q > bq) { bq = q; bh = a3; }
            }
        }
        // ヘタ側と先端では粒が立たない。ただし切りすぎないこと
        // 【対策】ここを広く取ると端だけつるりとして、別の野菜を接いだように
        //         見える。実物は果柄の際、先端の嘴の手前まで粒がある
        const ends = smooth(0.005, 0.035, t) * (1 - smooth(0.945, 1.0, t));
        return { h: bq * ends, tip: bh };
    }
    // 粒の大きさを数cm単位でうねらせる場
    // 【対策】同じ大きさの粒を等密度で敷き詰めると、機械編みのセーターに
    //         見える。実物は粒が大きく盛り上がった一帯と控えめな一帯が
    //         うねっている。ジオメトリとテクスチャの両方から同じ関数を呼ぶ
    function lumpAt(u, t, cfg) {
        const n = Noise.fbm2u(u * 3, t * 5, 3, cfg.wartSeed + 77, 3);
        return clamp(0.42 + 1.25 * n, 0, 1.25);
    }
    // 稜の頂だけを滑らかに残す重み
    // 【対策】ここを crest^1.6 のように広く効かせると、周の半分以上で粒が
    //         潰れて「のっぺりした濃緑の棒」に戻る。頂の細い帯だけに効かせる
    function valleyAt(crest, cfg) {
        // 【対策】ここを 0 に近づけると粒が全面を覆い、縦の筋が消えて
        //         ブロッコリーの塊になる。稜に沿った平滑なレーンが要る
        return 1 - cfg.wartValley * smooth(0.62, 0.98, crest);
    }

    // ---- 細かい粒（法線と色のみ）---------------------------------------
    function grainAt(u, t, cfg) {
        const g = Noise.fbm2u(u * cfg.grainU, t * cfg.grainV, cfg.grainU, cfg.wartSeed + 211, 2);
        return smooth(0.36, 0.80, g);
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

        // 果皮の場をいちど計算して 3 枚のテクスチャで共有する
        // 【対策】アルベド・ORM・法線を別々に評価すると、同じ関数でも
        //         書き間違いひとつで瘤の位置がずれ、「粒の上にぼんやりした
        //         汚れが乗った」ように見える。ここで1回だけ焼いて配る。
        //         3回評価するより速くもある
        field(size, cfg) {
            const N = size, n2 = N * N;
            const F = {
                crest: new Float32Array(n2),   // 稜（1 = 稜の頂）
                wart: new Float32Array(n2),    // 粗い瘤の高さ 0..1
                med: new Float32Array(n2),     // 中くらいの粒
                tip: new Float32Array(n2),     // 瘤の個体値
                grain: new Float32Array(n2),   // 最細の粒
                h: new Float32Array(n2)        // 法線マップ用の合成高さ
            };
            for (let y = 0; y < N; y++) {
                const v = y / N;
                for (let x = 0; x < N; x++) {
                    const u = x / N, i = y * N + x;
                    const R = ridgeAt(u, v, cfg);
                    // 【対策】ここがゴーヤーらしさの核心。稜の上に瘤を乗せると
                    //         「イボだらけのきゅうり」になる。実物は稜が滑らかな
                    //         リブで、瘤が立つのはそのあいだ
                    const valley = valleyAt(R.crest, cfg);
                    const W = cellAt(u, v, cfg, cfg.wartCell);
                    const Mc = cellAt(u, v, cfg, cfg.medCell);
                    const lump = lumpAt(u, v, cfg);
                    const wh = clamp(W.h * valley * lump, 0, 1);
                    // 【対策】小粒を全面に均一に敷くと機械編みのセーターになる。
                    //         小粒はあくまで大粒の表面の肌理なので、大粒の
                    //         高いところで強く、溝では弱くする
                    const mh = Mc.h * valley * (0.30 + 0.70 * wh);
                    const gr = grainAt(u, v, cfg) * (0.40 + 0.60 * (1 - R.crest));
                    const wr = Noise.fbm2u(u * 14, v * 46, 14, cfg.wartSeed + 29, 3);
                    F.crest[i] = R.crest;
                    F.wart[i] = wh;
                    F.med[i] = mh;
                    F.tip[i] = W.tip;
                    F.grain[i] = gr;
                    // 【対策】稜は法線マップに入れない。ジオメトリ側で出しているので、
                    //         両方に入れると陰影が二重にかかって塗り絵になる。
                    //         逆に、ジオメトリで解像できない中粒と細粒はここが担当
                    // 【対策】粗い粒はジオメトリ側が担当するが、分割数では角が丸まる。
                    //         法線マップにも半分ほど入れて輪郭を立てる。ここを
                    //         下げて小粒を上げると、粒の階層が逆転して編み目になる
                    F.h[i] = clamp(0.58 * wh + cfg.medAmp * mh + cfg.grainAmp * gr + 0.05 * wr, 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const D = cfg.skinDark, M = cfg.skinMid, L = cfg.skinLight, T = cfg.skinTip;
            const WB = cfg.wartBase, WP = cfg.wartPeak, FL = cfg.fleck;
            return this._tex("goyaAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const crest = F.crest[i0], wh = F.wart[i0];
                        const mh = F.med[i0], gr = F.grain[i0];
                        // 軸方向のわずかな色差（ヘタ寄りが濃く、先端寄りが少し淡い）
                        let cr = mix(D[0], M[0], smooth(0.03, 0.34, v));
                        let cg = mix(D[1], M[1], smooth(0.03, 0.34, v));
                        let cb = mix(D[2], M[2], smooth(0.03, 0.34, v));
                        cr = mix(cr, T[0], smooth(0.60, 1.0, v) * 0.70);
                        cg = mix(cg, T[1], smooth(0.60, 1.0, v) * 0.70);
                        cb = mix(cb, T[2], smooth(0.60, 1.0, v) * 0.70);
                        // 稜は粒が無く滑らかなので、光を返して淡い筋に見える
                        const rib = smooth(0.70, 1.0, crest) * 0.42;
                        cr = mix(cr, L[0], rib);
                        cg = mix(cg, L[1], rib);
                        cb = mix(cb, L[2], rib);
                        // 濃淡のムラ（縦に引き伸ばす）
                        const mott = 0.90 + 0.20 * Noise.fbm2u((x / N) * 6, v * 20, 6, cfg.wartSeed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 【対策】色の明暗は大粒で決める。小粒を主役にすると
                        //         同じ大きさの明暗が一面に並び、編み物に見える
                        const top = clamp(0.90 * wh + 0.25 * mh, 0, 1);
                        const groove = Math.pow(1 - clamp(wh + 0.35 * mh, 0, 1), 1.5);
                        cr = mix(cr, WB[0], groove * 0.92);
                        cg = mix(cg, WB[1], groove * 0.92);
                        cb = mix(cb, WB[2], groove * 0.92);
                        const peak = Math.pow(top, 1.3) * (0.55 + 0.35 * F.tip[i0]);
                        cr = mix(cr, WP[0], peak);
                        cg = mix(cg, WP[1], peak);
                        cb = mix(cb, WP[2], peak);
                        const gtop = smooth(0.62, 0.98, gr) * 0.14;
                        cr = mix(cr, L[0], gtop);
                        cg = mix(cg, L[1], gtop);
                        cb = mix(cb, L[2], gtop);
                        // まれに混じる淡点
                        const fl = smooth(0.972, 0.997, Noise.fbm2u((x / N) * 140, v * 260, 140, cfg.wartSeed + 47, 1));
                        cr = mix(cr, FL[0], fl * 0.65); cg = mix(cg, FL[1], fl * 0.65); cb = mix(cb, FL[2], fl * 0.65);
                        // 先端の乾いた嘴（くちばし）と、ヘタ側の付け根
                        const beak = smooth(0.982, 1.0, v);
                        cr = mix(cr, 0.34, beak * 0.8); cg = mix(cg, 0.36, beak * 0.8); cb = mix(cb, 0.20, beak * 0.8);
                        const neck = smooth(0.020, 0.0, v);
                        cr = mix(cr, 0.36, neck * 0.6); cg = mix(cg, 0.40, neck * 0.6); cb = mix(cb, 0.22, neck * 0.6);
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
            return this._tex("goyaORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const crest = F.crest[i0], wh = F.wart[i0];
                        const mh = F.med[i0], gr = F.grain[i0];
                        // 【対策】艶を一様にすると射出成形のプラスチックになる。
                        //         ゴーヤーは稜の上と粒の頂がよく光り、粒のあいだの
                        //         溝は光が入らず粗く見える
                        const gv2 = Math.pow(1 - clamp(wh + 0.35 * mh, 0, 1), 1.5);
                        let rough = cfg.skinRoughness * (0.92 + 0.40 * (1 - crest));
                        // 稜は粒が無く滑らかなので、ここだけ艶が高い
                        rough = mix(rough, cfg.skinRoughness * 0.62, smooth(0.70, 1.0, crest) * 0.70);
                        rough = mix(rough, 0.70, gv2 * 0.55);
                        rough = mix(rough, 0.58, smooth(0.62, 0.98, gr) * 0.25);
                        const bl = Noise.fbm2u((x / N) * 4, v * 9, 4, cfg.wartSeed + 41, 3);
                        rough = mix(rough, 0.58, smooth(0.50, 0.88, bl) * cfg.bloom * 2.2);
                        rough = mix(rough, 0.55, smooth(0.960, 1.0, v));
                        rough = mix(rough, 0.55, smooth(0.035, 0.0, v));
                        // 【対策】稜と稜のあいだの溝は実物ではかなり暗い。
                        //         SSAO だけに任せると溝が浅く見えるので焼いておく
                        let ao = 1.0;
                        ao = mix(ao, 0.66, Math.pow(1 - crest, 1.4) * 0.75);
                        // 【対策】粒の立体感の大半はこの溝の陰。法線マップだけでは
                        //         正面から見たときに平らに戻ってしまう。ただし
                        //         落としすぎると溝が黒く縁取られて鱗になる
                        ao = mix(ao, 0.54, gv2 * 0.85);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.04, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, F, strength) {
            const hf = F.h;
            return this._tex("goyaNormal", size, (d, N) => {
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
                        //         粒がジオメトリでは膨らんでいるのに陰影は凹んで見える
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
            const OVER = [0.82, 0.72, 0.50], UNDER = [0.68, 0.57, 0.38], GAP = [0.34, 0.26, 0.15];
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
            this.normalTex = TextureLab.normal(scene, S, F, 3.6);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("goyaSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            // 【対策】ゴーヤーの粒はきゅうりのイボよりずっと細かく、
            //         ジオメトリでは出しきれない。法線を強めに効かせる
            m.bumpTexture.level = 1.35;
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 表面のクチクラ。稜の上でよく光るが鏡ではない
            m.clearCoat.isEnabled = true;
            // 【対策】クリアコートを強くすると、粒の上を薄い樹脂で覆ったように
            //         白いハイライトが伸びる。艶は ORM の粗さで作る
            m.clearCoat.intensity = 0.26 * cfg.waxIntensity;
            m.clearCoat.roughness = 0.36;
            m.clearCoat.indexOfRefraction = 1.45;
            // 【対策】ゴーヤーの果肉は薄く中が空洞。きゅうりと同じ強さで
            //         透過させると縁が白飛びして作り物になる。控えめに
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.38, 0.62, 0.22);
            m.subSurface.translucencyIntensity = 0.08;
            m.subSurface.minimumThickness = 0.6;
            m.subSurface.maximumThickness = 3.0;
            this.skin = m;

            const st = new BABYLON.PBRMaterial("goyaStem", scene);
            st.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            st.metallic = 0.0;
            st.roughness = 0.72;
            st.transparencyMode = OPAQUE;
            st.zOffset = -2;
            st.zOffsetUnits = -16;
            this.stem = st;
        }

        // 表示モード 0=通常 / 1=白クレイ（法線のみ）/ 2=法線マップそのもの
        // 【対策】法線の向きが正しいかは、アルベドを外して陰影だけにするのが
        //         いちばん確実。ゴーヤーは溝の暗さを ORM の AO にも焼いて
        //         あるので、色と AO を外さないと凹凸の判定ができない
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
    // 6. Goya
    // =================================================================
    class Goya {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.90, 1.10);
            this.R = cfg.radius * rng.range(0.93, 1.07) * cfg.fullness;
            this.blunt = clamp(cfg.tipBlunt + rng.gauss(0, 0.08), 0, 1);
            this.nseed = rng.int(900000) + 1000;
            this.bendA = cfg.bendA * rng.range(0.5, 1.7) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.2, 1.2);
            this.bendRoll = rng.range(0, Math.PI * 2);
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            // 【対策】稜と瘤の位置はテクスチャ側で固定されているので、
            //         個体ごとに位相をずらすと模様と凹凸がずれる。
            //         そこで「メッシュのUVを同じだけ回す」ことで、
            //         連続値の回転を許しつつ両者を一致させる。
            //         テクスチャの wrapU は WRAP なので端数でも破綻しない
            this.uOff = rng.next();

            this.parts = [];
            this.stemAxis = [];
            this._buildBody(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("goya", scene);
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
        // 断面半径の倍率。u はテクスチャと同じ座標系（phi/2π + uOff）
        sectionAt(t, uTex) {
            const cfg = this.cfg;
            const phi = uTex * Math.PI * 2;
            const R = ridgeAt(uTex, t, cfg);
            const W = cellAt(uTex, t, cfg, cfg.wartCell);
            const valley = valleyAt(R.crest, cfg);
            // 【対策】この低周波のムラをテクスチャ側だけに入れると、
            //         色の起伏と実際の凹凸がずれて厚化粧に見える
            const lump = lumpAt(uTex, t, cfg);
            // 稜。crest の平均あたりを基準にして、谷が内側・稜が外側へ動くようにする
            const ridge = cfg.ridgeAmp * (R.crest - 0.48) * R.amp;
            // 低周波の非対称。これが無いと完全な回転体になり、
            // ハイライトが直線になって樹脂に見える
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            const wob = 0.014 * (Noise.fbm3(Math.cos(phi) * 2.4, Math.sin(phi) * 2.4, t * 5.5, this.nseed, 3) - 0.5);
            // 【対策】瘤の高さは 0..1 なので、そのまま足すと果実全体が
            //         平均ぶん太る。平均を引いて「溝が食い込み、頂が出る」形にする。
            //         細かい粒は分割数では解像できないので法線マップに任せる
            return 1 + ridge + asym + wob
                + cfg.wartAmp * (clamp(W.h * lump, 0, 1) - cfg.wartMean) * valley;
        }
        radiusAt(t, uTex) {
            return Math.max(0.004, this.R * profileAt(t, this.blunt) * this.sectionAt(t, uTex));
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
            const mesh = sweep("goyaBody", rings, centers, null, this.scene, this.uOff);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // 果柄：細く短い切り株。切り口だけ淡い
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);                       // 果実から離れる向き
            const L = cfg.stemLen * this.L * rng.range(0.85, 1.15);
            const tilt = rng.range(0.05, 0.22), tiltA = rng.range(0, Math.PI * 2);
            const side = f0.N.scale(Math.cos(tiltA)).add(f0.B.scale(Math.sin(tiltA)));
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const lean = Math.tan(tilt) * L * 0.55 * s * s;
                const c = base.add(dir.scale(L * s)).add(side.scale(lean));
                const taper = 0.88 + 0.42 * Math.pow(1 - s, 1.5) - 0.14 * smooth(0.75, 1.0, s);
                const rr = cfg.stemRadius * this.R * taper;
                // 当たり判定にも果柄を含めるので、軸を粗く控えておく
                if (i % 4 === 0 || i === K) this.stemAxis.push({ c: c, r: rr * 1.10 });
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    // ウリ科の果柄は 5 稜。断面が星形になる
                    const facet = 1 + 0.105 * Math.cos(5 * phi + s * 1.1) + 0.03 * Math.cos(10 * phi);
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
            const LOW = cfg.stem, HI = [cfg.stem[0] * 1.30, cfg.stem[1] * 1.22, cfg.stem[2] * 1.35];
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
            const mesh = sweep("goyaStem", rings, centers, colsFn, this.scene, 0);
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
        //         ゴーヤーは稜が深いぶんこれが起きやすいので、稜も瘤も落として
        //         低周波の非対称だけ残す。また果柄を含めないと、果柄だけ
        //         籠を突き抜けて見える
        hullShape() {
            const N = 22, M = 16;
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
                    const r = Math.max(0.004, this.R * profileAt(t, this.blunt) * (1 + asym)) * 0.96;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f.N.x * cs + f.B.x * sn) * r,
                        c.y + (f.N.y * cs + f.B.y * sn) * r,
                        c.z + (f.N.z * cs + f.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("goyaProxy", rings, centers, null, this.scene, 0);
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
        console.warn("[Goya] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    // 【対策】ゴーヤーはアルベドがかなり暗い。きゅうりと同じ環境強度だと
    //         真っ黒な塊になる。環境光と露出をわずかに上げる
    scene.environmentIntensity = 0.60;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.24, 62, new V3(0, 2.2, 0), scene);
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
    key.intensity = 2.7;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.62, 0.62, 0.58);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.15;
    fillL.diffuse = new BABYLON.Color3(0.96, 1.0, 0.96);
    fillL.specular = new BABYLON.Color3(0.28, 0.30, 0.26);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.62;
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
    ip.exposure = 1.04;
    ip.contrast = 1.16;
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

    // 粒の凹凸の強さと法線の向き。実機で見ながら合わせられるようにする
    const BUMPS = [
        { label: "弱", level: 0.60 },
        { label: "中", level: 1.00 },
        { label: "強", level: 1.35 },
        { label: "最強", level: 2.00 }
    ];
    let bumpIdx = 2, invY = false;
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
    //         ゴーヤーはざるの中で寝ている。接空間で光を (Lu, Lv, Ln) と書くと
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
            items.push(new Goya(scene, cfg, (seed + i * 7919) >>> 0, skin));
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
        console.log("[Goya]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "本");
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
        // 【対策】ゴーヤーの稜の溝は1cmに満たない。半径をきゅうりのままにすると
        //         溝ではなく個体どうしの隙間しか拾わず、表面が平板に見える
        ssao.radius = 0.8;
        ssao.totalStrength = 1.00;
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
        idle: "#16240f", active: "#33631f", edge: "#2f4327",
        text: "#eef5e9", sub: "#a5bd97", accent: "#9fd06f"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "238px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(9,16,7,0.84)";
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

    addLabel("GOYA", 11, COL.sub, "18px");
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
    const bumpBtn = addButton("bump", "粒の凹凸: 強", () => {
        bumpIdx = (bumpIdx + 1) % BUMPS.length;
        applyRelief();
        bumpBtn.textBlock.text = "粒の凹凸: " + BUMPS[bumpIdx].label;
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
    toggleBtn.background = "rgba(9,16,7,0.84)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(9,16,7,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;