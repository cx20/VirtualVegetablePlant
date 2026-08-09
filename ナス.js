// =====================================================================
//  Photoreal Eggplant  /  写実的な茄子
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（中長 / 長なす / 米なす）
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引・格子面
//    4. Profile     … 半径プロファイル / 曲がった軸 / 断面
//    5. TextureLab  … 果皮のアルベド・ORM・法線を手続き生成
//    6. Eggplant    … 果実 + がく + 果柄
//    7. Layout      … 高さマップによる載せ方（物理なし）
//    8. Scene / GUI
//
//  実物の要点（ここを外すと「紫のカプセル」になる）:
//    ・肌がほぼ黒いので、見えているものの大半は「反射」。したがって
//      質感を作るのはテクスチャではなく“形の崩し方”になる
//    ・完全な回転体にすると、ハイライトが定規で引いた直線になり樹脂に見える
//    ・がくは円錐ではなく、5〜6枚の独立した葉片。先端は浮いて反り返る
//    ・がくに隠れていた部分は日焼けせず淡いマゼンタで残る。
//      葉片の切れ込みの形に沿ってピンクが覗く。これが「茄子」の決め手
//    ・果柄は丸棒ではなく角ばった多角形。切り口だけ淡いクリーム色
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        chunaga: {
            label: "中長なす",
            length: 13.6, radius: 2.72,
            fullness: 1.00,            // プロファイル全体の太らせ方
            bendA: 0.055, bendB: 0.018,
            ridgeCount: 6, ridgeAmp: 0.017, twist: 0.9,
            asymmetry: 0.036,
            // 【対策】黒く落としすぎると、拡散反射がほぼ0になって
            //         「見えているのは環境の映り込みだけ」になる。緑チャンネルが
            //         リニアで 0.002 しか無いと、環境の緑や黄がそのまま乗る
            skin: [0.245, 0.120, 0.220],      // 果皮（sRGB）
            skinHi: [0.360, 0.190, 0.325],    // 縦の淡い条
            blush: [0.47, 0.225, 0.355],      // がくの下の日焼けしていない部分
            // 【対策】ここをクリーム（黄緑寄り）にすると、万一がくで隠れなかった
            //         ときに「花の置物」になる。実物は白ピンク寄り
            blushPale: [0.66, 0.52, 0.57],
            blushMargin: 0.035,               // がくの縁からどれだけ下までピンクが出るか
            calyxLobes: 6, calyxMin: 0.135, calyxMax: 0.285,
            // 【対策】srgb() でリニアへ落とすので、ここに 0.1 台を書くと
            //         リニアで 1% 程度になり真っ黒に潰れる（下記 2. 参照）
            calyx: [0.30, 0.32, 0.24], calyxTip: [0.18, 0.19, 0.15],
            stemLen: 0.30, stemRadius: 0.245,
            skinRoughness: 0.24, waxIntensity: 1.00
        },
        naganasu: {
            label: "長なす",
            length: 21.5, radius: 2.30,
            fullness: 0.94,
            bendA: 0.085, bendB: 0.030,
            ridgeCount: 6, ridgeAmp: 0.014, twist: 1.4,
            asymmetry: 0.040,
            skin: [0.235, 0.115, 0.215],
            skinHi: [0.350, 0.185, 0.320],
            blush: [0.46, 0.22, 0.35],
            blushPale: [0.65, 0.51, 0.56],
            blushMargin: 0.032,
            calyxLobes: 6, calyxMin: 0.095, calyxMax: 0.205,
            calyx: [0.29, 0.31, 0.23], calyxTip: [0.17, 0.18, 0.14],
            stemLen: 0.24, stemRadius: 0.200,
            skinRoughness: 0.25, waxIntensity: 0.96
        },
        beinasu: {
            label: "米なす",
            length: 13.0, radius: 4.15,
            fullness: 1.10,
            bendA: 0.028, bendB: 0.010,
            ridgeCount: 7, ridgeAmp: 0.021, twist: 0.5,
            asymmetry: 0.030,
            skin: [0.225, 0.110, 0.205],
            skinHi: [0.335, 0.180, 0.305],
            blush: [0.45, 0.235, 0.335],
            blushPale: [0.65, 0.52, 0.55],
            blushMargin: 0.040,
            // 米なすのがくは紫ではなく緑
            calyxLobes: 6, calyxMin: 0.145, calyxMax: 0.265,
            calyx: [0.42, 0.50, 0.26], calyxTip: [0.26, 0.33, 0.16],
            stemLen: 0.26, stemRadius: 0.290,
            skinRoughness: 0.26, waxIntensity: 0.92
        }
    };

    const GLOBAL = {
        count: 5,                  // 本数

        // 籠（ざる）と落下
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
        //         プルプル震える。全体をメートル系で作り直さずに安定域へ戻す
        //         いちばん安い方法が、重力を数百まで落とすこと
        gravity: 620,              // cm/s^2（実寸どおりなら 981）
        physicsHz: 120,            // 固定タイムステップ
        pieceMass: 1.0,            // 全body一律なら比だけが効く。極小値は数値的に不利
        friction: 0.85,
        restitution: 0.02,
        linearDamping: 0.15,
        angularDamping: 0.90,      // 揺り戻し（ロッキング）を殺す
        dropInterval: 0.24,        // 1本あたりの投入間隔（秒）
        dropClearance: 1.6,        // 真下の物からどれだけ上で放すか（cm）
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 5.0,

        segmentsAxis: 168,
        segmentsRound: 96,
        calyxSegments: 30,
        stemSegments: 22,
        stemSides: 12,

        // 【対策】がくを果皮から大きく浮かせると、視線がヘタ側へ回ったときだけ
        //         葉片の下が見通せてしまう。個体ごとに軸まわりの自転と配置が
        //         乱数なので、「たまに裏側と下の淡い帯が丸見えになる」という
        //         再現性の無い症状になる。浮きは葉片の厚みぶんに留め、
        //         反りは先端（s>0.86）だけに効かせる
        // 【対策】ここは見た目ではなく深度精度で決まる。16bit 深度・視距離 41cm
        //         では深度の分解能が 0.13mm しかなく、外面の浮きが 0.6mm では
        //         余裕が 5 倍しか無くて角度によって果皮に負ける。
        //         実物のがくも 1〜2mm の厚みがあるので、そこまで持ち上げてよい
        calyxClear: 0.020,         // 果皮からの最小の浮き（半径比）＝ 約0.5mm
        calyxThick: 0.038,         // 葉片の厚み（半径比）＝ 約1.0mm
        calyxCurl: 0.030,          // 先端の反り
        calyxRib: 0.012,           // 葉片中央の稜

        textureSize: 512,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.055,
        dofFStop: 3.6,

        // GUI
        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "chunaga";
    const START_SEED = 20260726;
    // 走っているコードを特定できるようにする（コンソールとGUIに出る）
    const BUILD = "nasu-K";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】がくの切れ込みの形は、がくのジオメトリと果皮テクスチャの
        //         両方が同じものを見ていなければならない。片方に個体乱数、
        //         片方にテクスチャ用の種を渡すと、葉片とピンクが別方向を向く。
        //         テクスチャは品種単位でキャッシュされるので、種も品種単位で固定する
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.calyxSeed = (h >>> 0) % 100000;
        // 【対策】1本あたり約3.2万三角形ある。籠に何本も入れるときは
        //         分割を落とさないと生成にも描画にも時間がかかる
        if (cfg.count > 3) {
            cfg.segmentsAxis = 112; cfg.segmentsRound = 64; cfg.calyxSegments = 22;
        }
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
    // 【対策】巻き順の規約を決め打ちすると環境によって裏返る。法線を計算し、
    //         基準点から見て外向きかを確かめ、必要なら全反転する
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

    // 位置が一致する頂点の法線を平均する（継ぎ目の陰影段差を消す）
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
        //         不透明なのに透過パスへ回される。透過パスは setAlphaMode() の
        //         副作用で深度書き込みが切られるため、
        //           ・がくの表と裏がソートされず重なって見える
        //           ・がくの下に描いてある果皮の淡い模様が透けて出る
        //         という「ガラスの茄子」になる。
        //         ここで false にしても applyToMesh 側から立て直されることが
        //         あるので、マテリアル側でも transparencyMode = OPAQUE を宣言し、
        //         needAlphaBlendingForMesh() がこのフラグを見る前に打ち切らせる
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // 格子面（pts は row-major：(nu+1) 行 × (nv+1) 列）
    function gridMesh(name, pts, cols, uvsIn, nu, nv, center, scene) {
        const W = nv + 1, total = (nu + 1) * W;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const colors = cols ? new Float32Array(total * 4) : null;
        for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
            const k = i * W + j, p = pts[k];
            positions[k * 3] = p.x; positions[k * 3 + 1] = p.y; positions[k * 3 + 2] = p.z;
            if (uvsIn) { uvs[k * 2] = uvsIn[k][0]; uvs[k * 2 + 1] = uvsIn[k][1]; }
            else { uvs[k * 2] = j / nv; uvs[k * 2 + 1] = i / nu; }
            if (colors) {
                const c = cols[k];
                colors[k * 4] = c[0]; colors[k * 4 + 1] = c[1];
                colors[k * 4 + 2] = c[2]; colors[k * 4 + 3] = 1;
            }
        }
        const indices = [];
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        const normals = finalize(positions, indices, center, true, 0);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
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
        // 【対策】両端のキャップの巻き順が側面と逆だった。ComputeNormals は
        //         面法線を頂点へ足し込むので、端のリングでは外向きの側面法線と
        //         内向きのキャップ法線が打ち消し合い、法線が裏返る。
        //         そこへ「mid から最も遠い頂点」を基準にすると、曲がり具合で
        //         最遠点が肩側に来た個体だけメッシュ全体が反転してしまう。
        //         反転すると backFaceCulling によって手前の面が消え、
        //         果実の内側（＝向こう側のがくの裏）が見えるようになる。
        //         これが「たまにヘタの裏側が表示される」の正体だった
        for (let j = 0; j < M - 1; j++) indices.push(capA, j, j + 1);
        const o = (N - 1) * M;
        for (let j = 0; j < M - 1; j++) indices.push(capB, o + j + 1, o + j);

        // 【対策】基準は端ではなく胴の中央にとる。半径が最大で法線が素直に
        //         外を向いており、判定値が個体によらず安定する（+2.5 前後）
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], false, refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Profile
    // =================================================================
    // [軸方向 t, 半径比]。最大径は中央ではなく尻寄り（t≒0.72）
    // 【対策】肩から尻へなだらかに太らせるとマンゴーになる。中長なすは
    //         胴のかなりの範囲がほぼ平行で、尻だけ丸く落ちる
    const PROFILE = [
        [0.000, 0.190], [0.045, 0.315], [0.105, 0.480], [0.180, 0.640],
        [0.270, 0.785], [0.360, 0.885], [0.460, 0.948], [0.560, 0.980],
        [0.660, 0.996], [0.750, 1.000], [0.830, 0.986], [0.895, 0.942],
        [0.945, 0.848], [0.978, 0.640], [0.995, 0.330], [1.000, 0.020]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 【対策】制御点の1列目に t を書いておきながら、添字を等間隔とみなして
    //         補間すると、書いた位置と実際の形が食い違う。実際これで最大径が
    //         t=0.72 のつもりが t=0.57（中央寄り）に来ていた。
    //         t で区間を引いてから、その区間内で補間する
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

    // がくの葉片がどこまで伸びているか（t 単位）。果皮のピンクもこの形に従う
    function calyxExtent(phi, cfg, seed) {
        const n = cfg.calyxLobes;
        const k = ((phi * n / (Math.PI * 2)) % 1 + 1) % 1;      // 葉片内の位置 0..1
        const shape = Math.pow(Math.sin(Math.PI * k), 0.55);
        const jit = 0.80 + 0.40 * Noise.fbm3(Math.cos(phi) * 1.7, Math.sin(phi) * 1.7, 3.3, seed, 2);
        return cfg.calyxMin + (cfg.calyxMax - cfg.calyxMin) * shape * jit;
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

        // 果皮の高さ場。アルベド / ORM / 法線で共有する
        skinHeight(size, seed) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    const u = x / size;
                    // 縦に引き伸ばした細かい肌理と、ごく浅い凹み
                    const fine = Noise.fbm2u(u * 90, v * 26, 90, seed, 3);
                    const dent = Noise.fbm2u(u * 14, v * 7, 14, seed + 11, 3);
                    h[y * size + x] = clamp(0.35 * dent + 0.65 * fine, 0, 1);
                }
            }
            return h;
        },

        albedo(scene, size, cfg, hf, seed) {
            const S = cfg.skin, HI = cfg.skinHi, B = cfg.blush, P = cfg.blushPale;
            const SCAR = [0.34, 0.22, 0.14];
            return this._tex("nasuAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const phi = u * Math.PI * 2;
                        let cr = S[0], cg = S[1], cb = S[2];
                        // 地色のごく弱いムラ
                        const mott = 0.90 + 0.20 * Noise.fbm2u(u * 7, v * 4, 7, seed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 縦の淡い条。u に細かく v に引き伸ばす
                        const stripe = smooth(0.55, 0.80, Noise.fbm2u(u * 46, v * 3.2, 46, seed + 17, 2))
                            * smooth(0.35, 0.65, Noise.fbm2u(u * 5, v * 3, 5, seed + 23, 2));
                        cr = mix(cr, HI[0], stripe * 0.55);
                        cg = mix(cg, HI[1], stripe * 0.55);
                        cb = mix(cb, HI[2], stripe * 0.55);
                        // 【対策】「がくで隠れる前提で塗る」のをやめる。
                        //         隠蔽は深度精度・巻き順・ソートのどれが崩れても
                        //         破れ、破れた瞬間に塗ってあるものが全部露出して
                        //         「花びら模様」になる。しかも崩れ方が個体や角度に
                        //         依存するので「たまに出る」不具合になり、原因の
                        //         切り分けが難しい。
                        //         そこで v < ext（＝がくの内側）には一切塗らず、
                        //         淡い帯は縁のすぐ外側だけに置く。こうすれば
                        //         がくが仮に丸ごと消えても、見えるのは地色だけになる
                        const ext = calyxExtent(phi, cfg, cfg.calyxSeed);
                        const edge = ext + cfg.blushMargin
                            * (0.80 + 0.40 * Noise.fbm2u(u * 22, v * 6, 22, seed + 31, 2));
                        const pink = smooth(edge + 0.020, edge - 0.016, v)
                            * smooth(ext - 0.008, ext + 0.006, v);
                        if (pink > 0.001) {
                            // がくの縁ぎわが白ピンク、そこから下は紅、さらに地色へ
                            const fade = smooth(edge - 0.008, ext, v);
                            const pr = mix(B[0], P[0], fade);
                            const pg = mix(B[1], P[1], fade);
                            const pb = mix(B[2], P[2], fade);
                            cr = mix(cr, pr, pink); cg = mix(cg, pg, pink); cb = mix(cb, pb, pink);
                        }
                        // 尻の花落ち跡
                        const scar = smooth(0.988, 1.0, v) * smooth(0.35, 0.0, Math.abs(u - 0.5));
                        cr = mix(cr, SCAR[0], scar); cg = mix(cg, SCAR[1], scar); cb = mix(cb, SCAR[2], scar);
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
        orm(scene, size, cfg, hf, seed) {
            return this._tex("nasuORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const phi = u * Math.PI * 2;
                        const h = hf[y * N + x];
                        let rough = cfg.skinRoughness * (0.85 + 0.35 * h);
                        // 【対策】艶を一様にすると射出成形のプラスチックになる。
                        //         実物は果粉（ブルーム）や擦れで局所的に曇る
                        const bloom = Noise.fbm2u(u * 4, v * 2.6, 4, seed + 41, 3);
                        rough = mix(rough, 0.46, smooth(0.52, 0.86, bloom) * 0.85);
                        // がくの下はロウが乗らず、明らかに艶が無い
                        const ext = calyxExtent(phi, cfg, cfg.calyxSeed);
                        rough = mix(rough, 0.72, smooth(ext + 0.075, ext, v));
                        // 尻もわずかに粗い
                        rough = mix(rough, 0.55, smooth(0.975, 1.0, v));
                        let ao = 1.0;
                        // 【対策】AO も可視領域側だけに。がくの縁が最も暗く、
                        //         下へ向かって抜ける（接地影のイメージ）
                        ao = mix(ao, 0.78, smooth(ext + 0.055, ext, v));
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.03, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
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
                        // 交互に浮き沈みさせると編み目に見える
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        // ひごは断面がかまぼこ状。浮いている側だけ明るい
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
        },

        // 【対策】低周波を強く入れると萎びて見える。肌理だけ、ごく薄く
        normal(scene, size, hf, strength) {
            return this._tex("nasuNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 極ではUが潰れて放射状の筋になるので端を減衰させる
                    const vv = y / N;
                    const k = strength * smooth(0, 0.06, vv) * (1 - smooth(0.94, 1.0, vv));
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
        }
    };

    // =================================================================
    //  マテリアル（品種ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const hf = TextureLab.skinHeight(S, 707);
            this.albedoTex = TextureLab.albedo(scene, S, cfg, hf, 77);
            this.ormTex = TextureLab.orm(scene, S, cfg, hf, 77);
            this.normalTex = TextureLab.normal(scene, S, hf, 0.9);

            // 【対策】不透明であることをマテリアル側で宣言する。
            //         transparencyMode = OPAQUE は _disableAlphaBlending を立てるので、
            //         needAlphaBlendingForMesh() が mesh.hasVertexAlpha を見る前に
            //         false を返す。頂点カラー（stride 4）由来の誤検出を確実に殺せる
            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("nasuSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.45;          // 肌理で鏡面を割る
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】茄子はロウ質で、果物のなかでもいちばん光る部類だが、
            //         base roughness 0.16 の上に clearCoat 0.55 / 0.25 を重ねると
            //         「ほぼ鏡が2枚」になり、暗いアルベドの上では黒ガラスに見える。
            //         base を 0.24 前後まで戻し、クリアコートは弱く・少し粗くして、
            //         曇りは ORM 側のブルームで作る
            m.clearCoat.isEnabled = true;
            m.clearCoat.intensity = 0.35 * cfg.waxIntensity;
            m.clearCoat.roughness = 0.34;
            m.clearCoat.indexOfRefraction = 1.45;
            this.skin = m;

            const c = new BABYLON.PBRMaterial("nasuCalyx", scene);
            c.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            c.metallic = 0.0;
            c.roughness = 0.68;
            c.transparencyMode = OPAQUE;
            // 【対策】これが本命。薄い面が別の面の上に寝ているとき、深度値を
            //         一定量だけ手前へずらす。すき間の大きさにも視距離にも
            //         depth buffer の精度にも依存しないので、ジオメトリ側で
            //         余裕を稼ぐより確実だった。
            //         値は実測で決めた：0 でがくはほぼ消え、-4 でまだ穴が開き、
            //         -16 で完全に覆う。-64 まで振ると今度は反対側の葉片が
            //         果実を突き抜け始めるので、-16 が上限側の適正値
            c.zOffset = -2;
            c.zOffsetUnits = -16;
            // 【対策】がくは表裏を張った閉じたソリッドなので、本来は裏面が
            //         見えることは無い。ただし縁の帯だけ巻き順を誤ると真っ黒に
            //         なるため、保険として裏面カリングを切り twoSidedLighting を
            //         立てておく（切っていても見た目は変わらない）。
            //         なお不透明でないと表と裏がソートされず重なって見えるため、
            //         上の transparencyMode 指定とセットで初めて成立する
            c.backFaceCulling = false;
            c.twoSidedLighting = true;
            this.calyx = c;

            const st = new BABYLON.PBRMaterial("nasuStem", scene);
            st.albedoColor = new BABYLON.Color3(1, 1, 1);
            st.metallic = 0.0;
            st.roughness = 0.74;
            st.transparencyMode = OPAQUE;
            st.zOffset = -2;
            st.zOffsetUnits = -16;
            this.stem = st;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.calyx.dispose(true, false);
            this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Eggplant
    // =================================================================
    class Eggplant {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.90, 1.10);
            this.R = cfg.radius * rng.range(0.92, 1.08) * cfg.fullness;
            this.nseed = rng.int(900000) + 1000;
            // 曲がりの向きと量。真っ直ぐな茄子は工業製品に見える
            this.bendA = cfg.bendA * rng.range(0.5, 1.6) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.2, 1.2);
            this.bendRoll = rng.range(0, Math.PI * 2);
            // 低周波の非対称
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.25, 0.6);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            this.ridgePhase = rng.range(0, Math.PI * 2);

            this.parts = [];
            this._buildBody(skin);
            this._buildCalyx(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("nasu", scene);
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
        // 接線と、ねじれない直交フレーム
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
            // 縦の稜。がく側で強く、尻で消える
            const ridge = cfg.ridgeAmp
                * Math.cos(cfg.ridgeCount * phi + cfg.twist * t + this.ridgePhase)
                * (0.30 + 0.70 * smooth(0.80, 0.08, t));
            // 低周波の非対称。これが無いと完全な回転体になり、
            // ハイライトが直線になって樹脂に見える
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            const wob = 0.017 * (Noise.fbm3(Math.cos(phi) * 2.2, Math.sin(phi) * 2.2, t * 3.4, this.nseed, 3) - 0.5);
            return 1 + ridge + asym + wob;
        }
        radiusAt(t, phi) {
            return Math.max(0.004, this.R * profileAt(t) * this.sectionAt(t, phi));
        }
        pointAt(t, phi, offset) {
            const c = this.spineAt(t), f = this.frameAt(t);
            const r = this.radiusAt(t, phi) + (offset || 0);
            const cs = Math.cos(phi), sn = Math.sin(phi);
            return new V3(
                c.x + (f.N.x * cs + f.B.x * sn) * r,
                c.y + (f.N.y * cs + f.B.y * sn) * r,
                c.z + (f.N.z * cs + f.B.z * sn) * r
            );
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
            const mesh = sweep("nasuBody", rings, centers, null, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // がく：独立した葉片が並んだ星形。表と裏の2枚を縁で閉じたソリッド
        // 【対策】厚みゼロの1枚シートだと、視線が葉片の下に回った瞬間に
        //         「裏面がそのまま見える」。個体ごとの自転が乱数なので
        //         再現性が無く、たまにしか出ない不具合に見える。
        //         表裏を張って縁を閉じてしまえば、原理的に裏面は見えない
        _buildCalyx(skin) {
            const cfg = this.cfg;
            const M = cfg.segmentsRound, K = cfg.calyxSegments;
            const C = cfg.calyx, TIP = cfg.calyxTip;
            const W = M + 1, LAY = (K + 1) * W, total = LAY * 2;
            const positions = new Float32Array(total * 3);
            const uvs = new Float32Array(total * 2);
            const colors = new Float32Array(total * 4);

            for (let side = 0; side < 2; side++) {          // 0 = 表, 1 = 裏
                for (let i = 0; i <= K; i++) {
                    const s = i / K;
                    for (let j = 0; j <= M; j++) {
                        const phi = (j % M) / M * Math.PI * 2;
                        const ext = calyxExtent(phi, cfg, cfg.calyxSeed);
                        const t = s * ext;
                        // 葉片内の位置。中央には稜が走り、先端だけ反り返る
                        const k = ((phi * cfg.calyxLobes / (Math.PI * 2)) % 1 + 1) % 1;
                        const lobe = Math.pow(Math.sin(Math.PI * k), 0.7);
                        const curl = cfg.calyxCurl * smooth(0.86, 1.0, s) * lobe;
                        // 厚みは中央の稜で増し、先端へ向けて薄くなる
                        const thick = cfg.calyxThick * (1 - 0.70 * smooth(0.75, 1.0, s))
                            + cfg.calyxRib * Math.pow(Math.sin(Math.PI * k), 3) * s;
                        const inner = cfg.calyxClear + curl;
                        const off = (side === 0 ? inner + thick : inner) * this.R;

                        const p = this.pointAt(t, phi, off);
                        const n = side * LAY + i * W + j;
                        positions[n * 3] = p.x; positions[n * 3 + 1] = p.y; positions[n * 3 + 2] = p.z;
                        uvs[n * 2] = j / M; uvs[n * 2 + 1] = s;

                        // 付け根は明るめ、先端へ向かって黒く落ちる。裏面は日が当たらない
                        const w = smooth(0.15, 0.95, s);
                        const g = 0.86 + 0.28 * Noise.fbm3(Math.cos(phi) * 6, Math.sin(phi) * 6, s * 5, this.nseed + 3, 2);
                        const shade = (side === 0) ? 1.0 : 0.72;
                        colors[n * 4] = srgb(mix(C[0], TIP[0], w) * g * shade);
                        colors[n * 4 + 1] = srgb(mix(C[1], TIP[1], w) * g * shade);
                        colors[n * 4 + 2] = srgb(mix(C[2], TIP[2], w) * g * shade);
                        colors[n * 4 + 3] = 1;
                    }
                }
            }

            const indices = [];
            for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
                const A = i * W + j, B = A + 1, Cc = A + W, D = Cc + 1;
                indices.push(A, Cc, B, B, Cc, D);                       // 表
                const a = LAY + A, b = LAY + B, c = LAY + Cc, d = LAY + D;
                indices.push(a, b, c, b, d, c);                          // 裏（逆巻き）
            }
            // 縁（s=1）と付け根（s=0）を閉じて中身のある葉片にする
            for (let j = 0; j < M; j++) {
                const o0 = K * W + j, o1 = o0 + 1;
                indices.push(o0, LAY + o0, o1, o1, LAY + o0, LAY + o1);
                indices.push(j, j + 1, LAY + j, j + 1, LAY + j + 1, LAY + j);
            }

            // 【対策】表と裏がほぼ重なっているので、法線と外向きベクトルの内積を
            //         全頂点で足すと符号が打ち消し合い、巻き順の判定が不安定になる。
            //         表側の中腹の1点を基準にする
            const normals = finalize(positions, indices, this.spineAt(0.14), false, (K >> 1) * W);
            weldNormals(positions, normals);
            const mesh = makeMesh("nasuCalyx", positions, indices, normals, uvs, colors, this.scene);
            mesh.material = skin.calyx;
            mesh.receiveShadows = true;
            this.calyx = mesh;
            this.parts.push(mesh);
        }

        // 果柄：丸棒ではなく角ばった多角形。切り口だけ淡い
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);                       // 果実から離れる向き
            const L = cfg.stemLen * this.L * rng.range(0.85, 1.15);
            const tilt = rng.range(0.10, 0.32), tiltA = rng.range(0, Math.PI * 2);
            const side = f0.N.scale(Math.cos(tiltA)).add(f0.B.scale(Math.sin(tiltA)));
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                // 曲率を全長に配分する（途中で折れさせない）
                const lean = Math.tan(tilt) * L * 0.55 * s * s;
                const c = base.add(dir.scale(L * s)).add(side.scale(lean));
                const taper = 0.68 + 0.42 * Math.pow(1 - s, 1.6) + 0.08 * smooth(0.88, 1.0, s);
                const rr = cfg.stemRadius * this.R * taper;
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const facet = 1 + 0.085 * Math.cos(5 * phi + s * 1.3) + 0.035 * Math.cos(9 * phi);
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
            // 【対策】srgb() でリニアへ落とすので、ここに 0.1 未満を書くと
            //         リニアで 0.5% 程度になり、果柄が「穴」に見える
            const LOW = [0.20, 0.17, 0.16], HI = [0.36, 0.30, 0.23], CUT = [0.72, 0.70, 0.46];
            const colsFn = (v, u) => {
                const w = smooth(0.05, 0.7, v);
                const cut = smooth(0.965, 1.0, v);
                const g = 0.88 + 0.24 * Noise.fbm3(Math.cos(u * 6.28) * 5, Math.sin(u * 6.28) * 5, v * 9, this.nseed + 7, 2);
                return [
                    srgb(mix(mix(LOW[0], HI[0], w), CUT[0], cut) * g),
                    srgb(mix(mix(LOW[1], HI[1], w), CUT[1], cut) * g),
                    srgb(mix(mix(LOW[2], HI[2], w), CUT[2], cut) * g)
                ];
            };
            const mesh = sweep("nasuStem", rings, centers, colsFn, this.scene);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュ（3万頂点超）から凸包を取ると生成が重いので、
        // 同じ関数から粗いプロキシを作ってそこから凸包を起こす
        // 【対策】でこぼこの点群をそのまま凸包にすると、ほぼ同一平面の面が
        //         大量に生まれる。積み重なった状態では接触マニフォールドが
        //         毎ステップ別の面へ飛び移り、これがプルプルの主因になる。
        //         縦の稜（ridgeAmp）と高周波のゆらぎ（wob）は落とし、
        //         低周波の非対称だけ残した滑らかな塊にする。
        //         凸包は元の凹みをまたいで張られるので、少しだけ縮めておく
        hullShape() {
            const N = 20, M = 16;
            const rings = [], centers = [];
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
            const proxy = sweep("nasuProxy", rings, centers, null, this.scene);
            proxy.isVisible = false;
            const shape = new BABYLON.PhysicsShapeConvexHull(proxy, this.scene);
            proxy.dispose();
            return shape;
        }

        // 表示メッシュ全体のワールド AABB（投入位置の計算に使う）
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

        // 断面：中心付近は平ら、外側へ向かって立ち上がる
        const prof = (s) => {
            const r = RIM * s;
            const y = DEP * Math.pow(clamp((s - 0.50) / 0.50, 0, 1), 1.55);
            return [r, y];
        };
        const pn = (s) => {                       // 断面内の内向き法線
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
            indices.push(A, C, B, B, C, D);                       // 内面
            indices.push(LAY + A, LAY + B, LAY + C, LAY + B, LAY + D, LAY + C);   // 外面
        }
        for (let j = 0; j < M; j++) {                              // 縁
            const o0 = K * W + j, o1 = o0 + 1;
            indices.push(o0, LAY + o0, o1, o1, LAY + o0, LAY + o1);
        }
        // 【対策】基準は壁の途中の外面にとる。底だと法線がほぼ真下を向いていて
        //         判定が y 成分頼みになり、器の深さを変えたときに不安定になる
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
        m.metallic = 0.0;
        m.roughness = 0.74;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        m.backFaceCulling = false;      // 内側から見ることが多いので切っておく
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

    // 【対策】シーンの単位は cm なので、重力も cm/s^2 で与える。
    //         9.81 のまま入れると 1/100 の重力になって、綿のように落ちてくる
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
        console.warn("[Nasu] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    // 【対策】拡散反射がほぼ無い暗い肌に鮮明な環境マップを当てると、
    //         屋外HDRの空・建物・夕景がそのまま肌に描かれ、
    //         黄や緑の筋が走る「ガラス細工」になる。ここは強くぼかし、
    //         強度も落として、照りはライトの specular で作る
    env.lodGenerationOffset = 1.10;
    scene.environmentIntensity = 0.30;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.24, 52, new V3(0, 2.2, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセスを有効にすると、シーンは 16bit 深度の
    //         レンダーターゲットへ描かれる。minZ=0.1 / 視距離 40cm では
    //         深度の分解能が約 2.7mm しかなく、果皮とがくのすき間 0.18mm は
    //         完全に同じ深度値に丸められる。どちらが手前になるかは端数次第で、
    //         個体の向きや距離が少し変わるだけで裏返る。
    //         ＝「たまにヘタの裏側と下の帯が出る」の正体。
    //         minZ を上げると分解能が改善する（minZ=6 で 0.043mm）。
    //         がくの浮きを 1.5mm に増やすのと合わせて余裕 36 倍まで持ち上げる。
    //         どちらか片方だけでは 5〜15 倍にしかならず、角度によって破れる
    camera.minZ = 6;
    camera.maxZ = 300;               // 被写界深度の深度精度のため詰めておく
    camera.lowerRadiusLimit = 16;   // minZ を上げたぶん、寄れる限界も少し引く
    camera.upperRadiusLimit = 160;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    // 【対策】細長い果実に平行光源を当てると、ハイライトは点ではなく
    //         軸に沿った“筋”になる。写真の茄子の照りはこれ。
    //         ただし intensity 3.2 / specular 0.85 では帯にならず白飛びの塊になる
    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.2;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.55, 0.55, 0.53);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.1;
    fillL.diffuse = new BABYLON.Color3(0.98, 0.97, 1.0);
    fillL.specular = new BABYLON.Color3(0.28, 0.28, 0.32);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.60;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.72, 0.72, 0.74);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 40;
    sg.depthScale = 40;
    sg.darkness = 0.52;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 1.12;
    ip.vignetteEnabled = false;      // 白背景なので周辺減光は入れない

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
        // 【対策】さらに地面をわずかに下げ、器の外面との間に確実なすき間を作る。
        //         0.8mm あれば、この視距離の深度分解能（約0.09mm）に対して
        //         10倍近い余裕になる
        ground.position.y = -1.08;
        if (physics) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    // ざるを置く
    const basket = buildBasket(scene, GLOBAL);
    if (physics) {
        const bShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        bShape.material = { friction: 0.68, restitution: 0.0 };
        const bBody = new BABYLON.PhysicsBody(basket, BABYLON.PhysicsMotionType.STATIC, false, scene);
        bBody.shape = bShape;
    }

    // =================================================================
    //  生成
    // =================================================================
    let items = [], curSkin = null, curVariety = START_VARIETY, curSeed = START_SEED, curCfg = null;
    const skinCache = {};
    let onRebuilt = null;
    let queue = [], dropIndex = 0, dropTimer = 0, settleTimer = 0, postDropTimer = 0, frozen = false;

    // 籠の内面の高さ。投入位置の計算に使う（メッシュと同じ式）
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
    //         反発が一気に解放されて弾け飛ぶ。1本ずつ、山の頂点のすぐ上から放す。
    //         落下高さを稼ぐとバウンドと貫通の両方が出るので数cmに留める
    function spawnNext() {
        const it = queue[dropIndex], e = it.e;
        e.root.setEnabled(true);
        e.root.position.set(it.x, 0, it.z);
        e.root.computeWorldMatrix(true);
        const b = e.worldBounds();
        const bottomOffset = b.mny;                        // root が y=0 のときの最下点
        const rh = Math.max(b.mxx - b.mnx, b.mxz - b.mnz) * 0.5;
        e.root.position.y = localTopY(it.x, it.z, rh) + GLOBAL.dropClearance - bottomOffset;
        e.root.computeWorldMatrix(true);

        const shape = e.hullShape();
        shape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
        const body = new BABYLON.PhysicsBody(e.root, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        body.shape = shape;
        body.setMassProperties({ mass: GLOBAL.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションに書いても効かない。
        //         PhysicsBody のメソッドで設定する
        body.setLinearDamping(GLOBAL.linearDamping);
        body.setAngularDamping(GLOBAL.angularDamping);
        // 【対策】毎フレーム「ノードの姿勢 → 物理ボディ」へ書き戻すと、
        //         物理が出した結果を読み直して押し込む往復が起きる
        body.disablePreStep = true;
        it.shape = shape; it.body = body;
        dropIndex++;
    }

    // 投入をやり直す
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
            // 黄金角で回すと少ない本数でも偏らない
            const r = GLOBAL.basketRim * 0.44 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;               // 1本目はすぐ落とす
        } else {
            // 物理が使えない環境向けの保険。籠の底に並べるだけ
            for (let i = 0; i < items.length; i++) {
                const e = items[i];
                e.root.position.set((i - (items.length - 1) / 2) * e.R * 2.2,
                    GLOBAL.basketThick + e.R, 0);
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
        curSkin = skin;

        for (let i = 0; i < cfg.count; i++) {
            items.push(new Eggplant(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        // 【対策】画角を中身に合わせて毎回取り直すと、落下の途中で
        //         カメラが動いてしまう。籠に固定する
        camera.target.set(0, cfg.basketDepth * 0.35, 0);
        camera.radius = cfg.basketRim * 3.4;

        resetDrop(seed);
        console.log("[Nasu]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "本");
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
        // 【対策】微振動が残って静止判定が永久に通らないことがある。
        //         最後の投入から一定時間が過ぎたら、条件に関わらず打ち切る
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
    // 【対策】閾値を下げるとハイライトが滲んで塊になり、余計にガラスに見える
    dp.bloomThreshold = 0.98;
    dp.bloomWeight = 0.07;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.16;
    // 【対策】Babylon の錯乱円は「シーン単位 × 1000 = mm」で計算される。
    //         cm 単位のシーンで実カメラのつもりの値を入れると桁がずれる。
    //         focalLength を focusDistance の一定比率にすると focus が約分され、
    //         カメラを寄せても引いてもボケ量が変わらない
    dp.depthOfFieldEnabled = GLOBAL.useDOF;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
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
        idle: "#241f2b", active: "#5b3a72", edge: "#443a4d",
        text: "#f2ecf5", sub: "#b6a5c0", accent: "#cfa3dd"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(16,12,20,0.82)";
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

    addLabel("NASU", 11, COL.sub, "18px");
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

    // ---- 切り分け用：がくと果柄を単色で塗り、どこに描かれているかを見る ----
    // 【対策】症状が「たまに出る」ときは、まず対象が画面上のどこに
    //         描かれているかを確定させる。陰影とテクスチャを外して
    //         unlit の赤（がく）／青（果柄）にすれば、位置ズレなのか、
    //         隠蔽の失敗なのか、そもそも描かれていないのかが一目で分かる
    let dbg = false;
    function applyDebug() {
        const R = new BABYLON.Color3(1, 0.18, 0.18), Bl = new BABYLON.Color3(0.25, 0.55, 1);
        const W = new BABYLON.Color3(1, 1, 1);
        for (const k in skinCache) {
            const sk = skinCache[k];
            sk.calyx.unlit = dbg; sk.calyx.albedoColor = dbg ? R : W;
            sk.stem.unlit = dbg; sk.stem.albedoColor = dbg ? Bl : W;
        }
        for (const e of items) {
            if (e.calyx) e.calyx.useVertexColors = !dbg;
            if (e.stem) e.stem.useVertexColors = !dbg;
        }
    }
    // ---- 深度オフセットの実測用。押すたびに値が変わる ----
    // 【対策】polygonOffset の符号は環境によって直感と逆に感じることがある。
    //         0 と正負の値を巡回させて、実際に効く値をその場で決められるようにする
    const ZOFF = [-2, -16, 0];
    let zoIdx = 0;
    const zoBtn = addButton("zo", "深度オフセット: -2", () => {
        zoIdx = (zoIdx + 1) % ZOFF.length;
        const v = ZOFF[zoIdx];
        for (const k in skinCache) {
            const sk = skinCache[k];
            sk.calyx.zOffset = v; sk.calyx.zOffsetUnits = v * 8;
            sk.stem.zOffset = v; sk.stem.zOffsetUnits = v * 8;
        }
        zoBtn.textBlock.text = "深度オフセット: " + v;
        zoBtn.background = v !== 0 ? COL.active : COL.idle;
    });
    zoBtn.background = COL.active;

    const dbgBtn = addButton("dbg", "がくを可視化: OFF", () => {
        dbg = !dbg;
        applyDebug();
        dbgBtn.background = dbg ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "がくを可視化: " + (dbg ? "ON" : "OFF");
    });

    const info = addLabel("", 12, COL.sub, "44px");
    onRebuilt = () => {
        if (!info) return;
        const e = items[0];
        if (!e) { info.text = ""; return; }
        const state = !physics ? "物理なし"
            : (dropIndex < queue.length ? "投入中 " + dropIndex + "/" + queue.length
                : (frozen ? "静止" : "落下中"));
        info.text = state + " / " + items.length + "本 / 径 " + (e.R * 2).toFixed(1) + "cm\n"
            + "seed: " + curSeed + "  [" + BUILD + "]";
        applyDebug();
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
    toggleBtn.background = "rgba(16,12,20,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(16,12,20,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;