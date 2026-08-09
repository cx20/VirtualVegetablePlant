// =====================================================================
//  Photoreal King Oyster Mushroom  /  写実的なエリンギ      BUILD: eringi-C
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 規格プリセット（大株 / 標準 / 若採り）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ / 2D値ノイズ / u方向に折り返す2Dノイズ
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 傘の断面（u, r, y）を漏斗形／若採りで補間
//    5. TextureLab  … 傘のアルベド・ORM・法線、柄、竹の網代
//    6. Eringi      … 傘 + ひだ（垂生）+ 柄
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  eringi-B からの修正（形の数値は健全だったので、見え方の側を直す）:
//    ・漏斗が深すぎて「茶碗」になっていた。実測で 6.9cm の傘に 0.37cm の
//      窪み。実物のエリンギの漏斗はもっと浅い凹み
//    ・傘の下面のテクスチャに「ひだの本数×2」周期の余弦を入れていたが、
//      実体のひだも同じ本数あるので、両者が干渉して渦巻きに見えていた。
//      実体があるのだからテクスチャ側の縞は要らない
//    ・傘の上面の放射状の繊維が中心へ収束して、星形の記号のように
//      見えていた。中心では消し、コントラストも落とす
//    ・柄を降りるひだが櫛の歯に見えるので、稜をさらに浅くした
//
//  eringi-A からの修正:
//    ・傘が剃刀のように薄く、ひだの深さ（5.2mm）が縁の肉厚（2.2mm）より
//      深いという逆転が起きていた。ひだが傘の外へはみ出して櫛に見える。
//      傘を厚くし、ひだを傘の肉厚より浅くした
//    ・ひだの張り出す向きを「柄では外向き・傘の裏では下向き」の補間に
//      していたが、漏斗形の傘は下面が急に傾いているので、下向きに
//      張り出すと斜面から板がぶら下がって扇になる。面に垂直な向きへ戻し、
//      不安定になる縁だけ真下へ寄せる
//
//  シイタケ版との構造上の違い（ここを外すと「白いシイタケ」になる）:
//    ・主役は柄。体積の8〜9割が柄で、傘は先端の小さなラッパにすぎない。
//      傘に柄が刺さっているのではなく、柄が上へ広がってそのまま傘になる。
//      だから傘の下面の内端の半径は「柄の付け根の半径」そのもの
//    ・ひだが垂生（decurrent）。ヒラタケ属の決定的な特徴で、ひだが
//      傘の裏で終わらず柄を数cm下まで流れ落ちる。ここを直さないと
//      どれだけ白く塗ってもエリンギに見えない
//    ・成熟すると傘は漏斗形になり、中心が縁より低くなる。若い個体は
//      逆に丸く、縁が強く内巻きになる。1本のテーブルでは書けないので
//      2本を u を揃えて用意し、cfg.mature で補間する
//    ・亀裂も鱗片も無い。代わりに放射状の繊維の筋が薄く走る
//    ・柄は真っ白ではなく、絹のような縦の繊維が走る象牙色。
//      根元は切り口で、繊維がほつれて毛羽立つ
//    ・キノコの皮は濡れていない。艶を足すと途端に樹脂の置物になる
//
//  法線マップについて（きゅうり版・ジャガイモ版と同じ落とし穴）:
//    ・高さ場から法線を焼くとき、v 方向は (yd - yu) にすること。
//      (yu - yd) は「V が上を向く」OpenGL 系の規約で、Babylon の接空間は
//      V が下向き。混ぜると u方向は正・v方向は逆というねじれた法線になる
//
//  影について（ジャガイモ版で判明した不具合の水平展開）:
//    ・useBlurExponentialShadowMap は深度を指数関数で近似するので、
//      ぼかすと影がキャスター自身の明るい面へにじむ。丸みのある物体では
//      曲線で縁取られた楕円の暗い領域になり、傷や汚れと見分けがつかない
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        large: {
            label: "大株",
            // 【対策】傘の半径は「柄の付け根の半径 × capRatio」で決める。
            //         独立に持つと、太い柄に小さい傘が乗った不整合な形になる
            stemRad: 1.55,          // 柄のいちばん細いところの半径
            stemLen: 12.5,          // 柄の長さ
            capRatio: 1.55,         // 傘の最大半径 / 柄の付け根の半径
            capH: 0.60,             // 傘の高さ / 傘の半径
            mature: 0.70,           // 1 = 漏斗形、0 = 若採りの丸い傘
            countScale: 0.85,

            // 柄の太りかた
            // 【対策】傘へのラッパ状の広がりは傘のプロファイルが持っている。
            //         ここで張り出しを重ねると付け根が二重に太る。
            //         くびれも入れすぎると砂時計になる（実測で 30% 落ちた）
            stemFlare: 0.10,        // 付け根（傘側）のわずかな張り出し
            stemWaist: 0.03,        // 中ほどのくびれ
            stemClub: 0.15,         // 下半分の膨らみ（棍棒形）
            stemTilt: 0.05, stemBend: 0.10,
            stemFacet: 0.030,       // 断面のゆがみ
            stemGroove: 0.022,      // 縦の浅い溝

            // 傘の輪郭のゆがみ
            outline1: 0.055, outline2: 0.028, outlineN: 0.036,
            margWave: 0.042, margLobes: 3,

            // ひだ（垂生）
            gills: 52, gillTiers: 1,
            gillRun: 0.24,          // 柄をどこまで降りるか（柄の長さ比）
            gillJoin: 0.34,         // 経路のうち柄の上にある割合
            // 【対策】ひだの深さは傘の肉厚より浅くすること。深いと
            //         傘の外へはみ出して、紙の扇のように見える
            gillDeepStem: 0.020,    // 柄の上でのひだの張り出し（傘半径比）
            gillDeepCap: 0.088,     // 傘の裏でのひだの深さ
            gillWave: 0.13,

            // 色（sRGB）
            capTop: [0.545, 0.455, 0.352],     // 傘の中心（いちばん濃い）
            capMid: [0.640, 0.552, 0.442],
            capEdge: [0.735, 0.668, 0.575],    // 縁（淡い）
            capFib: [0.430, 0.345, 0.258],     // 放射状の繊維
            capUnder: [0.905, 0.885, 0.840],   // 下面
            gillCol: [0.912, 0.895, 0.850],
            gillEdge: [0.960, 0.950, 0.925],
            gillDeep: [0.640, 0.612, 0.560],   // ひだの奥（天井側）
            stemCol: [0.930, 0.918, 0.888],    // 柄（象牙色）
            stemFibC: [0.868, 0.852, 0.812],
            stemLow: [0.828, 0.802, 0.735],    // 根元寄り
            stemCut: [0.885, 0.862, 0.800],    // 切り口
            bruise: [0.720, 0.652, 0.545],     // 触れて褐変したところ

            capRoughness: 0.80, stemRoughness: 0.86, sss: 0.55
        },
        standard: {
            label: "標準",
            stemRad: 1.30, stemLen: 10.5, capRatio: 1.45, capH: 0.62,
            mature: 0.40, countScale: 1.00,
            stemFlare: 0.10, stemWaist: 0.03, stemClub: 0.14,
            stemTilt: 0.06, stemBend: 0.13,
            stemFacet: 0.032, stemGroove: 0.024,
            outline1: 0.048, outline2: 0.024, outlineN: 0.032,
            margWave: 0.034, margLobes: 3,
            gills: 46, gillTiers: 1,
            gillRun: 0.22, gillJoin: 0.32,
            gillDeepStem: 0.019, gillDeepCap: 0.085, gillWave: 0.14,
            capTop: [0.560, 0.472, 0.368],
            capMid: [0.655, 0.570, 0.462],
            capEdge: [0.748, 0.685, 0.596],
            capFib: [0.448, 0.362, 0.272],
            capUnder: [0.912, 0.894, 0.852],
            gillCol: [0.918, 0.902, 0.860],
            gillEdge: [0.965, 0.956, 0.932],
            gillDeep: [0.652, 0.625, 0.575],
            stemCol: [0.938, 0.928, 0.900],
            stemFibC: [0.878, 0.864, 0.826],
            stemLow: [0.840, 0.816, 0.752],
            stemCut: [0.892, 0.872, 0.814],
            bruise: [0.730, 0.665, 0.560],
            capRoughness: 0.80, stemRoughness: 0.86, sss: 0.58
        },
        young: {
            label: "若採り",
            // 若い個体は傘が小さく丸く、縁が強く内巻き。柄は寸胴
            stemRad: 1.18, stemLen: 9.0, capRatio: 1.20, capH: 0.72,
            mature: 0.05, countScale: 1.25,
            stemFlare: 0.08, stemWaist: 0.02, stemClub: 0.10,
            stemTilt: 0.05, stemBend: 0.09,
            stemFacet: 0.026, stemGroove: 0.020,
            outline1: 0.036, outline2: 0.018, outlineN: 0.024,
            margWave: 0.022, margLobes: 3,
            gills: 40, gillTiers: 1,
            gillRun: 0.16, gillJoin: 0.28,
            gillDeepStem: 0.018, gillDeepCap: 0.072, gillWave: 0.12,
            capTop: [0.585, 0.502, 0.402],
            capMid: [0.678, 0.600, 0.498],
            capEdge: [0.775, 0.718, 0.635],
            capFib: [0.478, 0.398, 0.308],
            capUnder: [0.918, 0.902, 0.865],
            gillCol: [0.925, 0.912, 0.875],
            gillEdge: [0.970, 0.962, 0.942],
            gillDeep: [0.668, 0.642, 0.596],
            stemCol: [0.945, 0.936, 0.912],
            stemFibC: [0.888, 0.876, 0.842],
            stemLow: [0.855, 0.834, 0.775],
            stemCut: [0.900, 0.882, 0.828],
            bruise: [0.742, 0.682, 0.582],
            capRoughness: 0.82, stemRoughness: 0.87, sss: 0.62
        }
    };

    const GLOBAL = {
        count: 5,                  // 盛る量（規格の countScale 倍される）

        // 籠（ざる）
        basketRim: 16.0,
        basketDepth: 4.6,
        basketThick: 0.50,
        basketSegments: 96,
        basketRings: 34,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 600,
        physicsHz: 120,
        pieceMass: 0.70,
        // 【対策】エリンギは細長い棒なので、摩擦が低いと転がって全部が
        //         ざるの壁際に寄り、中央が空く
        friction: 0.92,
        restitution: 0.01,
        linearDamping: 0.20,
        angularDamping: 0.92,
        dropInterval: 0.30,
        dropClearance: 1.8,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.0, settleHold: 0.40,
        settleTimeout: 7.0,

        capSegmentsAxis: 88,       // 傘の断面方向の分割
        capSegmentsRound: 128,     // 傘の周方向の分割（柄と共通にする）
        gillSegments: 16,
        stemSegments: 48,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.062,
        dofFStop: 2.8,

        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "standard";
    const START_SEED = 20260801;
    const BUILD = "eringi-C";

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    // 断面パラメータ u の意味づけ（傘テクスチャの v と一致する）
    const U_RIM = 0.650;     // 最大径
    const U_EDGE = 0.790;    // 縁のいちばん下
    const U_UNDER = 0.845;   // ここから内側がひだの天井

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
        v2(x, y, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const a = this._h2(xi, yi, seed), b = this._h2(xi + 1, yi, seed);
            const c = this._h2(xi, yi + 1, seed), d = this._h2(xi + 1, yi + 1, seed);
            const t0 = a + (b - a) * u, t1 = c + (d - c) * u;
            return t0 + (t1 - t0) * v;
        },
        fbm2(x, y, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) { s += a * this.v2(x * f, y * f, seed + o * 131); n += a; f *= 2; a *= 0.5; }
            return s / n;
        },
        // u 方向だけ折り返す。周方向に継ぎ目を作らないために要る
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
    function sweep(name, rings, centers, scene) {
        const N = rings.length, M = rings[0].length;
        const total = N * M + 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                const k = i * M + j, p = rings[i][j];
                positions[k * 3] = p.x; positions[k * 3 + 1] = p.y; positions[k * 3 + 2] = p.z;
                uvs[k * 2] = j / (M - 1); uvs[k * 2 + 1] = i / (N - 1);
            }
        }
        const capA = N * M, capB = N * M + 1;
        positions[capA * 3] = centers[0].x; positions[capA * 3 + 1] = centers[0].y; positions[capA * 3 + 2] = centers[0].z;
        positions[capB * 3] = centers[N - 1].x; positions[capB * 3 + 1] = centers[N - 1].y; positions[capB * 3 + 2] = centers[N - 1].z;
        uvs[capA * 2] = 0.5; uvs[capA * 2 + 1] = 0;
        uvs[capB * 2] = 0.5; uvs[capB * 2 + 1] = 1;
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
        return makeMesh(name, positions, indices, normals, uvs, null, scene);
    }

    // =================================================================
    // 4. Profile
    // =================================================================
    // [u, r/R, y/H]。u=0 が傘の頂点、u=1 が下面の内端（＝柄の付け根）
    //
    // 【対策】y の原点は「柄の付け根」。ここを 0 にしておけば、柄は
    //         y=0 から素直に下へ伸ばすだけで済み、シイタケ版のような
    //         「柄を傘へ埋め込む量の調整」が要らなくなる
    //
    // 【対策】u=1 での接線をほぼ軸と平行にしておくこと（実測 5〜7°）。
    //         ここが寝ていると、傘の下面と柄の側面が角度をなして
    //         継ぎ目に折れ線が出る。エリンギは傘と柄が連続したラッパ
    const PROF_U = [0.000, 0.040, 0.090, 0.150, 0.220, 0.300, 0.385, 0.470, 0.550, 0.610, 0.650,
        0.700, 0.740, 0.775, 0.790, 0.820, 0.845, 0.880, 0.910, 0.940, 0.970, 1.000];
    // 成熟した漏斗形。中心が縁より低い
    const PROF_FUNNEL_R = [0.020, 0.150, 0.300, 0.440, 0.575, 0.700, 0.805, 0.885, 0.945, 0.982, 1.000,
        0.994, 0.980, 0.962, 0.952, 0.918, 0.878, 0.815, 0.760, 0.712, 0.675, 0.650];
    // 【対策】中心と最大径の高さの差が、縁の波打ちの振幅より小さいと
    //         漏斗に見えない。実測で差 0.10H に対し波が 0.12H あり、
    //         個体によって中心が縁より高く出ていた。差を 0.26H まで開く
    // 【対策】縁の肉厚は y[U_RIM] - y[U_EDGE]。ここが薄いと傘が
    //         剃刀の刃になり、ひだのほうが深くなって櫛に見える。
    //         実測で 0.141H しかなかったので 0.218H まで開く
    const PROF_FUNNEL_Y = [0.862, 0.868, 0.892, 0.922, 0.948, 0.968, 0.984, 0.995, 1.000, 0.996, 0.980,
        0.905, 0.845, 0.790, 0.760, 0.742, 0.726, 0.700, 0.615, 0.490, 0.295, 0.000];
    // 若採り。丸くて縁が強く内巻き
    const PROF_YOUNG_R = [0.020, 0.160, 0.310, 0.450, 0.585, 0.705, 0.808, 0.888, 0.945, 0.982, 1.000,
        0.988, 0.966, 0.936, 0.920, 0.886, 0.856, 0.812, 0.768, 0.716, 0.676, 0.650];
    const PROF_YOUNG_Y = [1.000, 0.996, 0.984, 0.962, 0.930, 0.888, 0.838, 0.780, 0.718, 0.660, 0.606,
        0.505, 0.440, 0.385, 0.360, 0.372, 0.392, 0.410, 0.400, 0.340, 0.212, 0.000];

    function blendProfile(t) {
        const out = [];
        for (let i = 0; i < PROF_U.length; i++) {
            out.push([PROF_U[i],
            mix(PROF_YOUNG_R[i], PROF_FUNNEL_R[i], t),
            mix(PROF_YOUNG_Y[i], PROF_FUNNEL_Y[i], t)]);
        }
        return out;
    }

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 【対策】制御点の1列目に u を書きながら添字を等間隔とみなして補間すると、
    //         書いた位置と実際の形が食い違う。u で区間を引いてから補間する
    function profileAt(P, u) {
        const n = P.length;
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

    // 輪郭のゆがみを効かせる重み
    // 【対策】u=1 でちょうど 0 にすること。ここが 0 でないと傘の下面の
    //         内端が個体ごとにゆがみ、ゆがまない柄の上端とのあいだに
    //         隙間や食い違いが出る。u=1 は柄と共有する円周なので触らない
    function outlineWeightAt(u) {
        return smooth(0.12, 0.60, u) * (1 - smooth(0.84, 1.0, u));
    }
    function margWeightAt(u) {
        return Math.pow(smooth(0.30, 0.79, u), 1.3) * (1 - smooth(0.86, 1.0, u));
    }

    // =================================================================
    // 5. TextureLab
    // =================================================================
    const TextureLab = {
        _tex(name, size, fill, scene, clampV, linear) {
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
            // 【対策】ORM と法線は「色」ではない。既定のまま（gammaSpace = true）
            //         にすると粗さ 0.80 が線形 0.61 として渡り、狙いより
            //         つやつやになる。色以外のテクスチャは必ず線形で渡す
            if (linear) dt.gammaSpace = false;
            // 【対策】傘の頂点付近や柄の切り口の縁では u 方向が極端に圧縮される。
            //         等方フィルタだと GPU が u 側の縮小率に合わせて高い LOD を
            //         選び、その一帯がまとめてぼやける
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },

        // 傘の場をまとめて1回で焼く
        // 【対策】アルベド・ORM・法線を別々に計算すると、繊維の位置がずれて
        //         「模様の上にぼんやりした汚れが乗った」ように見える
        //
        // 【対策】この傘のUVは v が断面パラメータなので、頂点（v=0）付近で
        //         u 方向が極端に潰れる。低周波の模様は断面の半径 r(v) で
        //         (x,z) 平面へ射影した座標で引けば、模様の大きさが場所に
        //         よらず一定になり継ぎ目もできない。
        //         いっぽう放射状の繊維は「角度に細かく、半径に粗い」異方性の
        //         模様なので、こちらは u に周期を持たせた2Dノイズで引く
        capFields(size, cfg) {
            const n = size * size;
            const P = cfg.profile;
            const F = {
                h: new Float32Array(n),
                fib: new Float32Array(n),    // 放射状の繊維
                mott: new Float32Array(n),   // 濃淡のムラ
                scuff: new Float32Array(n),  // 擦れて褐変したところ
                gill: new Float32Array(n)    // 下面のひだの筋（補助）
            };
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const pr = profileAt(P, v)[0];
                const top = 1 - smooth(U_RIM - 0.04, U_EDGE, v);
                const und = smooth(U_EDGE, U_UNDER + 0.02, v);
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    const phi = u * TAU;
                    const px = Math.cos(phi) * pr, pz = Math.sin(phi) * pr;

                    // --- 放射状の繊維（角度に細かく、半径に粗い）
                    // 【対策】放射状の繊維は中心で必ず収束する。そのまま描くと
                    //         星形の記号になり、キノコではなく紋章に見える。
                    //         中心の 1/4 では消し、外へ向かって立ち上げる
                    const fib = Noise.fbm2u(u * 160, v * 5, 160, cfg.texSeed + 11, 2);
                    const fib2 = Noise.fbm2u(u * 48, v * 3, 48, cfg.texSeed + 17, 2);
                    const fibs = (0.62 * fib + 0.38 * fib2) * top * smooth(0.08, 0.34, v);

                    // --- 濃淡のムラ（等方）
                    const mo = Noise.fbm2(px * 2.6, pz * 2.6, cfg.texSeed + 57, 3);

                    // --- 擦れて褐変した斑
                    // 【対策】しきい値を狭く取らないと、ただの色ムラになる。
                    //         実物の褐変は境目がはっきりしている
                    const sc = smooth(0.72, 0.83,
                        Noise.fbm2(px * 3.4 + 5, pz * 3.4 + 9, cfg.texSeed + 41, 3)) * top;

                    // 【対策】ここに「ひだの本数×2」周期の余弦を入れていたが、
                    //         実体のひだも同じ本数あるので、両者が干渉して
                    //         渦巻き模様が浮いた。実体があるのだから縞は要らない。
                    //         下面は柄へ近づくほど暗くするだけでよい
                    const gl = smooth(1.0, U_UNDER, v);

                    F.fib[i] = fibs; F.mott[i] = mo; F.scuff[i] = sc;
                    F.gill[i] = gl * und;
                    // 【対策】繊維は「盛り上がり」ではなく「浅い溝」。逆にすると
                    //         毛が生えたように見える
                    F.h[i] = clamp(0.55
                        - 0.14 * (fibs - 0.5) * 2 * top
                        + 0.10 * (mo - 0.5)
                        - 0.06 * sc
                        + 0.04 * (Noise.fbm2(px * 140, pz * 140, cfg.texSeed + 71, 1) - 0.5)
                        - 0.14 * gl * und, 0, 1);
                }
            }
            return F;
        },

        capAlbedo(scene, size, cfg, F) {
            const CT = cfg.capTop, CM = cfg.capMid, CE = cfg.capEdge;
            const CF = cfg.capFib, CU = cfg.capUnder, GD = cfg.gillDeep, BR = cfg.bruise;
            return this._tex("eringiCapAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        let cr, cg, cb;
                        if (v < U_EDGE) {
                            // --- 上面〜縁
                            // 【対策】エリンギの傘は一様な茶色ではない。中心が
                            //         濃く、外へ行くほど淡くなり、縁はほとんど
                            //         柄と同じ色まで抜ける。ここを平坦にすると
                            //         茶色い円盤を貼っただけに見える
                            let t = smooth(0.00, 0.42, v);
                            cr = mix(CT[0], CM[0], t); cg = mix(CT[1], CM[1], t); cb = mix(CT[2], CM[2], t);
                            t = smooth(0.42, 0.786, v);
                            cr = mix(cr, CE[0], t); cg = mix(cg, CE[1], t); cb = mix(cb, CE[2], t);
                            // 放射状の繊維
                            const fk = smooth(0.55, 0.90, F.fib[i]) * 0.26;
                            cr = mix(cr, CF[0], fk); cg = mix(cg, CF[1], fk); cb = mix(cb, CF[2], fk);
                            // 濃淡
                            const mk = 0.90 + 0.20 * F.mott[i];
                            cr *= mk; cg *= mk; cb *= mk;
                            // 擦れて褐変した斑
                            const sk = F.scuff[i] * 0.55;
                            cr = mix(cr, BR[0], sk); cg = mix(cg, BR[1], sk); cb = mix(cb, BR[2], sk);
                        } else {
                            // --- 下面（ひだの天井）
                            const t = smooth(U_EDGE, U_EDGE + 0.045, v);
                            cr = mix(CE[0], CU[0], t); cg = mix(CE[1], CU[1], t); cb = mix(CE[2], CU[2], t);
                            // 【対策】天井をそのまま明るいクリーム色にすると、
                            //         ひだの隙間から白い床が見えて空洞に見える。
                            //         ひだの根元は光が届かないので暗く沈ませる
                            const dk = 0.42 + 0.34 * F.gill[i];
                            cr = mix(cr, GD[0], dk); cg = mix(cg, GD[1], dk); cb = mix(cb, GD[2], dk);
                            const mk = 0.94 + 0.12 * F.mott[i];
                            cr *= mk; cg *= mk; cb *= mk;
                        }
                        d[o] = clamp(cr, 0, 1) * 255;
                        d[o + 1] = clamp(cg, 0, 1) * 255;
                        d[o + 2] = clamp(cb, 0, 1) * 255;
                        d[o + 3] = 255;
                    }
                }
            }, scene, true, false);
        },

        // R = AO / G = roughness
        capOrm(scene, size, cfg, F) {
            return this._tex("eringiCapORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        // 【対策】キノコの傘は乾いている。粗さを下げると
                        //         とたんに樹脂の置物になる。ただし完全に一様だと
                        //         フェルトなので、繊維で拡散反射の強弱を作る
                        let rough = cfg.capRoughness * (0.94 + 0.14 * (1 - F.h[i]));
                        rough = mix(rough, 0.92, F.scuff[i] * 0.6);
                        if (v > U_EDGE) rough = 0.90;                 // ひだ側
                        let ao = 1.0;
                        ao = mix(ao, 0.62, smooth(U_EDGE, 1.0, v) * 0.9);
                        ao = mix(ao, 0.90, smooth(0.70, 0.80, v) * 0.5);
                        d[o] = clamp(ao, 0, 1) * 255;
                        d[o + 1] = clamp(rough, 0.03, 1) * 255;
                        d[o + 2] = 0; d[o + 3] = 255;
                    }
                }
            }, scene, true, true);
        },

        normal(scene, size, hf, strength, name) {
            return this._tex(name || "eringiNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 端では U が潰れて放射状の筋になるので減衰させる
                    const vv = y / N;
                    const k = strength * smooth(0, 0.04, vv) * (1 - smooth(0.97, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        // 【対策】v 方向は (yd - yu)。(yu - yd) は「V が上を向く」
                        //         OpenGL 系の規約で、Babylon の接空間は V が下向き。
                        //         混ぜると u方向は正・v方向は逆というねじれた法線に
                        //         なり、繊維の溝が場所によって溝にも畝にも見える
                        let nx = (xl - xr) * k, ny = (yd - yu) * k, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * N + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, true, true);
        },

        // 柄。v=0 が傘との付け根、v=1 が石づきの切り口
        // 【対策】エリンギは柄が主役なので、ここが手抜きだと全部が台無しになる。
        //         絹のような縦の繊維を、粗い束・細い筋・ごく細かい毛羽の
        //         3層で作る。周期を u に持たせて継ぎ目を消す
        stemFields(size, cfg) {
            const n = size * size;
            const F = {
                h: new Float32Array(n), fib: new Float32Array(n),
                bruise: new Float32Array(n), fray: new Float32Array(n)
            };
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    // 【対策】v 方向の周波数を上げすぎると横縞になる。繊維は
                    //         縦に走るので u を細かく、v を粗くする
                    const coarse = Noise.fbm2u(u * 44, v * 3, 44, cfg.texSeed + 101, 2);
                    const fine = Noise.fbm2u(u * 210, v * 8, 210, cfg.texSeed + 113, 2);
                    const micro = Noise.fbm2u(u * 620, v * 30, 620, cfg.texSeed + 131, 1);
                    const fib = 0.46 * coarse + 0.38 * fine + 0.16 * micro;
                    // 触れて褐変した斑。柄の下半分に多い
                    const br = smooth(0.74, 0.86, Noise.fbm2u(u * 7, v * 9, 7, cfg.texSeed + 149, 3))
                        * (0.35 + 0.65 * smooth(0.25, 0.85, v));
                    // 切り口の毛羽立ち
                    const fr = Noise.fbm2u(u * 90, v * 40, 90, cfg.texSeed + 167, 2);
                    F.fib[i] = fib; F.bruise[i] = br; F.fray[i] = fr;
                    F.h[i] = clamp(0.5 + 0.34 * (fib - 0.5) + 0.10 * (fr - 0.5)
                        * smooth(0.86, 1.0, v) * 3, 0, 1);
                }
            }
            return F;
        },

        stemAlbedo(scene, size, cfg, F) {
            const SC = cfg.stemCol, SF = cfg.stemFibC, SL = cfg.stemLow;
            const CU = cfg.stemCut, BR = cfg.bruise;
            return this._tex("eringiStemAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        const cut = smooth(0.878, 0.902, v);
                        // 根元へ行くほどわずかに黄ばむ
                        const low = smooth(0.35, 0.90, v);
                        let cr = mix(SC[0], SL[0], low * 0.65);
                        let cg = mix(SC[1], SL[1], low * 0.65);
                        let cb = mix(SC[2], SL[2], low * 0.65);
                        // 縦の繊維
                        const fk = smooth(0.30, 0.72, F.fib[i]);
                        cr = mix(cr, SF[0], fk * 0.55);
                        cg = mix(cg, SF[1], fk * 0.55);
                        cb = mix(cb, SF[2], fk * 0.55);
                        // 褐変
                        const bk = F.bruise[i] * 0.50;
                        cr = mix(cr, BR[0], bk); cg = mix(cg, BR[1], bk); cb = mix(cb, BR[2], bk);
                        // 傘との境目はうっすら暗い（傘の陰に入る）
                        const nk = 1 - 0.14 * (1 - smooth(0.0, 0.06, v));
                        cr *= nk; cg *= nk; cb *= nk;
                        // 切り口：繊維がほつれて毛羽立つ
                        if (cut > 0) {
                            const g = 0.80 + 0.34 * F.fray[i];
                            let kr = CU[0] * g, kg = CU[1] * g, kb = CU[2] * g;
                            // 外周にうっすら褐色の輪
                            const rr = clamp((v - 0.878) / 0.122, 0, 1);
                            const edge = 1 - smooth(0.0, 0.35, rr);
                            kr = mix(kr, SL[0], edge * 0.45);
                            kg = mix(kg, SL[1], edge * 0.45);
                            kb = mix(kb, SL[2], edge * 0.45);
                            cr = mix(cr, kr, cut); cg = mix(cg, kg, cut); cb = mix(cb, kb, cut);
                        }
                        d[o] = clamp(cr, 0, 1) * 255;
                        d[o + 1] = clamp(cg, 0, 1) * 255;
                        d[o + 2] = clamp(cb, 0, 1) * 255;
                        d[o + 3] = 255;
                    }
                }
            }, scene, true, false);
        },

        stemOrm(scene, size, cfg, F) {
            return this._tex("eringiStemORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        // 【対策】エリンギの柄は絹のような光沢がわずかにある。
                        //         ただし濡れてはいないので、下げるのは繊維の
                        //         山の部分だけ。全体を下げると蝋になる
                        let rough = cfg.stemRoughness * (0.96 + 0.10 * (1 - F.h[i]));
                        rough = mix(rough, cfg.stemRoughness * 0.86, smooth(0.55, 0.90, F.fib[i]) * 0.6);
                        rough = mix(rough, 0.96, smooth(0.878, 1.0, v));   // 切り口は毛羽立つ
                        rough = mix(rough, 0.94, F.bruise[i] * 0.7);
                        let ao = 1 - 0.18 * (1 - F.h[i]);
                        ao = mix(ao, 0.66, 1 - smooth(0.0, 0.09, v));      // 傘の陰に入る
                        ao = mix(ao, 0.86, F.bruise[i] * 0.4);
                        d[o] = clamp(ao, 0, 1) * 255;
                        d[o + 1] = clamp(rough, 0.03, 1) * 255;
                        d[o + 2] = 0; d[o + 3] = 255;
                    }
                }
            }, scene, true, true);
        },

        // 竹ひごの網代（あじろ）。u が周方向、v が中心→縁
        // 【対策】明暗差を付けすぎると将棋盤になる。竹ひごの上下は
        //         色ではなく陰影の差でしかない
        bamboo(scene, size, seed) {
            const OVER = [0.885, 0.812, 0.640], UNDER = [0.808, 0.725, 0.548], GAP = [0.575, 0.490, 0.348];
            return this._tex("basketAlbedo", size, (d, N) => {
                const SPOKE = 132, RING = 36;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * SPOKE, sv = v * RING;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.88 + 0.16 * bv) : (0.75 + 0.13 * bu);
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
            }, scene, false, false);
        }
    };

    // =================================================================
    //  マテリアル（規格ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const CF = TextureLab.capFields(S, cfg);
            this.capAlbedoTex = TextureLab.capAlbedo(scene, S, cfg, CF);
            this.capOrmTex = TextureLab.capOrm(scene, S, cfg, CF);
            this.capNormalTex = TextureLab.normal(scene, S, CF.h, 1.8, "eringiCapNormal");

            const SF = TextureLab.stemFields(S, cfg);
            this.stemAlbedoTex = TextureLab.stemAlbedo(scene, S, cfg, SF);
            this.stemOrmTex = TextureLab.stemOrm(scene, S, cfg, SF);
            this.stemNormalTex = TextureLab.normal(scene, S, SF.h, 1.5, "eringiStemNormal");

            this.texs = [this.capAlbedoTex, this.capOrmTex, this.capNormalTex,
            this.stemAlbedoTex, this.stemOrmTex, this.stemNormalTex];

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            // --- 傘
            const m = new BABYLON.PBRMaterial("eringiCap", scene);
            m.albedoTexture = this.capAlbedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.capOrmTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.capNormalTex;
            m.bumpTexture.level = 0.70;
            m.transparencyMode = OPAQUE;
            // 【対策】クリアコートは付けない。キノコは濡れていないので、
            //         わずかでも艶を足すと樹脂で成型した食品サンプルになる。
            //         代わりに sheen をごく弱く入れて、乾いた繊維質の面が
            //         斜めから見たときにだけ白く立つのを拾う
            m.sheen.isEnabled = true;
            m.sheen.intensity = 0.14;
            m.sheen.roughness = 0.62;
            m.sheen.color = new BABYLON.Color3(0.78, 0.74, 0.66);
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.90, 0.82, 0.68);
            m.subSurface.translucencyIntensity = 0.12 * cfg.sss;
            m.subSurface.minimumThickness = 0.8;
            m.subSurface.maximumThickness = 3.5;
            this.cap = m;

            // --- ひだ
            const g = new BABYLON.PBRMaterial("eringiGill", scene);
            g.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            g.metallic = 0.0;
            g.roughness = 0.90;
            g.transparencyMode = OPAQUE;
            // 【対策】ひだは厚さ 0.3mm 程度の薄板なので、板ポリで作って
            //         両面を点灯させる。ここで backFaceCulling を切らないと、
            //         横から見た個体のひだが片面だけ抜けて櫛の歯になる
            g.backFaceCulling = false;
            g.twoSidedLighting = true;
            // 薄いので必ず光が透ける。これが無いと石膏の板になる
            g.subSurface.isTranslucencyEnabled = true;
            g.subSurface.tintColor = new BABYLON.Color3(0.95, 0.92, 0.85);
            g.subSurface.translucencyIntensity = 0.34;
            g.subSurface.minimumThickness = 0.01;
            g.subSurface.maximumThickness = 0.10;
            this.gill = g;

            // --- 柄
            const s = new BABYLON.PBRMaterial("eringiStem", scene);
            s.albedoTexture = this.stemAlbedoTex;
            s.metallic = 0.0;
            s.roughness = 1.0;
            s.metallicTexture = this.stemOrmTex;
            s.useAmbientOcclusionFromMetallicTextureRed = true;
            s.useRoughnessFromMetallicTextureGreen = true;
            s.useMetallnessFromMetallicTextureBlue = true;
            s.bumpTexture = this.stemNormalTex;
            s.bumpTexture.level = 0.60;
            s.transparencyMode = OPAQUE;
            s.sheen.isEnabled = true;
            s.sheen.intensity = 0.18;
            s.sheen.roughness = 0.55;
            s.sheen.color = new BABYLON.Color3(0.86, 0.84, 0.80);
            // 【対策】柄は白くて肉が詰まっている。透過を強くすると
            //         全体が発光して見えるので、縁がわずかに立つ程度に
            s.subSurface.isTranslucencyEnabled = true;
            s.subSurface.tintColor = new BABYLON.Color3(0.94, 0.90, 0.82);
            s.subSurface.translucencyIntensity = 0.14 * cfg.sss;
            s.subSurface.minimumThickness = 1.0;
            s.subSurface.maximumThickness = 4.0;
            this.stem = s;
        }
        dispose() {
            this.cap.dispose(true, false);
            this.gill.dispose(true, false);
            this.stem.dispose(true, false);
            for (const t of this.texs) t.dispose();
        }
    }

    // =================================================================
    // 6. Eringi
    // =================================================================
    class Eringi {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.P = cfg.profile;
            this.nseed = rng.int(900000) + 1000;

            // 【対策】長さと太さを別々に振ると、大きい／小さいが打ち消し合って
            //         結局どれも同じ大きさになる。共通の係数で振ってから
            //         比率を崩す（ジャガイモ版で踏んだのと同じ罠）
            const sz = rng.range(0.80, 1.22);
            this.stemR = cfg.stemRad * sz * rng.range(0.90, 1.12);
            this.stemL = cfg.stemLen * sz * rng.range(0.86, 1.16);
            // 傘の半径は柄の付け根の半径から決める
            this.rBase = this.stemR * (1 + cfg.stemFlare);
            this.R = this.rBase * cfg.capRatio * rng.range(0.94, 1.08);
            this.H = this.R * cfg.capH * rng.range(0.88, 1.14);

            // 柄の太りかた（個体差）
            this.flare = cfg.stemFlare;
            this.waist = cfg.stemWaist * rng.range(0.3, 1.5);
            this.club = cfg.stemClub * rng.range(0.4, 1.5);
            this.stemAz = rng.range(0, TAU);
            this.stemTilt = cfg.stemTilt * rng.range(0.2, 1.8);
            this.stemBend = cfg.stemBend * rng.range(-0.5, 1.5);

            // 傘の輪郭のゆがみ
            this.o1 = cfg.outline1 * rng.range(0.6, 1.5);
            this.o2 = cfg.outline2 * rng.range(0.5, 1.6);
            this.on = cfg.outlineN * rng.range(0.7, 1.4);
            this.p1 = rng.range(0, TAU);
            this.p2 = rng.range(0, TAU);
            this.mw = cfg.margWave * rng.range(0.5, 1.6);
            this.ml = Math.max(2, cfg.margLobes + rng.int(3) - 1);
            this.mp = rng.range(0, TAU);
            this.gillPhase = rng.range(0, TAU);

            this.parts = [];
            this._buildCap(skin);
            this._buildStem(skin);
            this._buildGills(skin);
            this.root = new BABYLON.TransformNode("eringi", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // ---- 柄 -------------------------------------------------------
        // s=0 が傘との付け根（y=0）、s=1 が石づきの切り口
        // 【対策】s=0 での接線を真下にしておくこと。ここが傾いていると
        //         傘の下面の内端と角度がずれて、継ぎ目に折れ線が出る。
        //         lat を s^2 に比例させれば s=0 で横向きの成分が 0 になる
        stemCenterAt(s) {
            const lat = this.stemL * (this.stemTilt * s * s + this.stemBend * s * s * s);
            return new V3(Math.cos(this.stemAz) * lat, -this.stemL * s, Math.sin(this.stemAz) * lat);
        }
        stemRadiusAt(s) {
            // 付け根の張り出し → 中ほどのくびれ → 下半分の膨らみ → 切り口で少し絞る
            const flare = 1 + this.flare * Math.pow(1 - smooth(0, 0.24, s), 1.8);
            const waist = 1 - this.waist * smooth(0.06, 0.40, s) * (1 - smooth(0.40, 0.76, s));
            const club = 1 + this.club * smooth(0.32, 0.82, s) * (1 - 0.65 * smooth(0.88, 1.0, s));
            const tip = 1 - 0.08 * smooth(0.94, 1.0, s);
            const wob = 1 + 0.035 * (Noise.fbm3(s * 3.2, 0.4, 0.7, this.nseed + 5, 3) - 0.5) * 2;
            return this.stemR * flare * waist * club * tip * wob;
        }

        // ---- 傘 -------------------------------------------------------
        capSurfaceAt(u, phi) {
            const p = profileAt(this.P, u);
            const ow = outlineWeightAt(u);
            const k = 1
                + (this.o1 * Math.cos(phi - this.p1)
                    + this.o2 * Math.cos(2 * phi - this.p2)) * ow
                + this.on * (Noise.fbm3(Math.cos(phi) * 1.7, Math.sin(phi) * 1.7,
                    u * 2.0, this.nseed, 3) - 0.5) * 2 * ow;
            let r = this.R * p[0] * k;
            // 【対策】下面の内端は「柄の付け根の半径」そのものでなければ
            //         ならない。プロファイル表の値をそのまま使うと、柄の
            //         太さの個体差ぶんだけ食い違って継ぎ目に段差が出る
            if (u > U_UNDER) {
                const w = smooth(U_UNDER, 1.0, u);
                r = mix(r, this.stemRadiusAt(0), w);
            }
            // 【対策】縁の波打ちは半径ではなく高さを揺らす。半径で作ると
            //         輪郭が花びらになってしまい、キノコではなく菊になる
            const wave = this.mw * this.R * Math.cos(this.ml * phi + this.mp) * margWeightAt(u);
            const y = this.H * p[1] + wave;
            return { r, y };
        }

        _buildCap(skin) {
            const cfg = this.cfg, N = cfg.capSegmentsAxis, M = cfg.capSegmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const u = i / N;
                const ring = [];
                let sy = 0;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const s = this.capSurfaceAt(u, phi);
                    ring.push(new V3(Math.cos(phi) * s.r, s.y, Math.sin(phi) * s.r));
                    sy += s.y;
                }
                rings.push(ring);
                centers.push(new V3(0, sy / (M + 1), 0));
            }
            const mesh = sweep("eringiCap", rings, centers, this.scene);
            mesh.material = skin.cap;
            mesh.receiveShadows = true;
            this.cap = mesh;
            this.parts.push(mesh);
        }

        _buildStem(skin) {
            const cfg = this.cfg, K = cfg.stemSegments;
            // 【対策】柄の周分割は傘と同じにする。違うと、傘の下面の内端と
            //         柄の上端は同じ円周でも多角形の頂点位置が食い違い、
            //         継ぎ目に細い割れ目が見える
            const M = cfg.capSegmentsRound;
            const rings = [], centers = [];
            const CUT = 0.905;   // ここから先は切り口の円盤
            for (let i = 0; i <= K; i++) {
                const t = i / K;
                let s, r, C;
                if (t <= CUT) {
                    s = t / CUT;
                    C = this.stemCenterAt(s);
                    r = this.stemRadiusAt(s);
                } else {
                    // 【対策】掃引の端キャップは中心1頂点なので、切り口が
                    //         1テクセルの単色で塗られてしまう。半径を絞る
                    //         リングを何段か足して、切り口を「面」として持たせる
                    const q = (t - CUT) / (1 - CUT);
                    s = 1.0;
                    const c0 = this.stemCenterAt(1.0);
                    C = new V3(c0.x, c0.y - this.stemR * 0.05 * smooth(0, 1, q), c0.z);
                    r = this.stemRadiusAt(1.0) * (1 - smooth(0, 1, q) * 0.94);
                }
                // 芯線の接線から断面の2軸を作る
                const e = 1e-3;
                const a = this.stemCenterAt(clamp(s - e, 0, 1));
                const b = this.stemCenterAt(clamp(s + e, 0, 1));
                let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
                const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
                let ux = 1, uy = 0, uz = 0;
                if (Math.abs(tx) > 0.9) { ux = 0; uz = 1; }
                let ax = uy * tz - uz * ty, ay = uz * tx - ux * tz, az = ux * ty - uy * tx;
                const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
                const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;

                // 【対策】断面のゆがみは s=0 でちょうど 0 にする。傘と共有する
                //         円周をゆがめると、そこだけ食い違って割れ目になる
                const fade = smooth(0.0, 0.10, s);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const facet = 1
                        + cfg.stemFacet * Math.cos(4 * phi + 0.6) * fade
                        + cfg.stemFacet * 0.6 * Math.cos(7 * phi + 2.3) * fade
                        + cfg.stemGroove * (Noise.fbm3(Math.cos(phi) * 4, Math.sin(phi) * 4,
                            s * 2.2, this.nseed + 3, 2) - 0.5) * 2 * fade;
                    const rr = r * facet;
                    const cs = Math.cos(phi) * rr, sn = Math.sin(phi) * rr;
                    ring.push(new V3(
                        C.x + ax * cs + bx * sn,
                        C.y + ay * cs + by * sn,
                        C.z + az * cs + bz * sn));
                }
                rings.push(ring); centers.push(C);
            }
            const mesh = sweep("eringiStem", rings, centers, this.scene);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.parts.push(mesh);
        }

        // ---- ひだ（垂生）----------------------------------------------
        // 【対策】ヒラタケ属のひだは傘の裏で終わらず、柄を数cm下まで
        //         流れ落ちる（垂生）。シイタケのように傘の裏だけに
        //         生やすと、白いシイタケにしかならない
        //
        // 経路パラメータ s: 0 = 柄を降りきったところ、1 = 傘の縁
        gillAnchorAt(s, az) {
            const cfg = this.cfg, sj = cfg.gillJoin;
            if (s < sj) {
                // 柄の上を降りる区間
                const t = s / sj;                        // 0（下端）..1（付け根）
                const sp = cfg.gillRun * (1 - t);
                const C = this.stemCenterAt(sp);
                const r = this.stemRadiusAt(sp);
                return { x: C.x + Math.cos(az) * r, y: C.y, z: C.z + Math.sin(az) * r };
            }
            // 傘の裏を外へ向かう区間
            const t = (s - sj) / (1 - sj);
            const u = mix(1.0, U_UNDER + 0.004, t);
            const c = this.capSurfaceAt(u, az);
            return { x: Math.cos(az) * c.r, y: c.y, z: Math.sin(az) * c.r };
        }
        gillDepthAt(s) {
            const cfg = this.cfg;
            // 柄の下端で消え、傘の縁でも消える
            const up = smooth(0.0, 0.22, s);
            const dn = 1 - smooth(0.90, 1.0, s);
            const prof = mix(cfg.gillDeepStem, cfg.gillDeepCap, smooth(cfg.gillJoin - 0.05, 0.70, s));
            return this.R * prof * up * dn;
        }

        _buildGills(skin) {
            const cfg = this.cfg, rng = this.rng, K = cfg.gillSegments;
            const CG = cfg.gillCol, CE = cfg.gillEdge, CD = cfg.gillDeep;

            // 生やす板の一覧（角度, 生え始めの s）
            // 【対策】長さの違う段を混ぜないと、外周に行くほど間隔が開いて
            //         扇の骨になる。半径の増加に合わせて途中から生える
            //         短いひだを足し、密度を一定に保つ
            const blades = [];
            const G = cfg.gills;
            for (let i = 0; i < G; i++) blades.push({ az: (i / G) * TAU, s0: 0.0 });
            let count = G, step = 1 / G;
            for (let t = 0; t < cfg.gillTiers; t++) {
                const s0 = [0.62, 0.82][t] !== undefined ? [0.62, 0.82][t] : 0.88;
                const half = step * 0.5;
                for (let i = 0; i < count; i++) blades.push({ az: (i / count) * TAU + half, s0 });
                count *= 2; step *= 0.5;
            }

            const nb = blades.length;
            const vpb = (K + 1) * 2;
            const total = nb * vpb;
            const positions = new Float32Array(total * 3);
            const colors = new Float32Array(total * 4);
            const indices = [];

            for (let b = 0; b < nb; b++) {
                const bl = blades[b];
                const az = bl.az + this.gillPhase + rng.gauss(0, 0.004);
                const base = b * vpb;
                const dk = rng.range(0.90, 1.08);
                const wav = cfg.gillWave * rng.range(0.5, 1.5);
                const wph = rng.range(0, TAU);
                // まれに褐変した縁
                const tint = rng.next() < 0.10 ? rng.range(0.06, 0.20) : 0;

                for (let i = 0; i <= K; i++) {
                    const s = mix(bl.s0, 1.0, i / K);
                    const A = this.gillAnchorAt(s, az);

                    // 【対策】ひだは面に垂直に立つ。単純に「柄では外向き・
                    //         傘の裏では下向き」と補間すると、漏斗形の急に
                    //         傾いた下面から板が真下へぶら下がり、斜面に
                    //         垂れ幕を掛けたような扇になる。
                    //         経路の接線 T と半径方向 rad から
                    //         N = normalize(rad - T(rad·T)) が正しい
                    const e = 0.006;
                    const P0 = this.gillAnchorAt(Math.max(0, s - e), az);
                    const P1 = this.gillAnchorAt(Math.min(1, s + e), az);
                    let tx = P1.x - P0.x, ty = P1.y - P0.y, tz = P1.z - P0.z;
                    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
                    const rx = Math.cos(az), rz = Math.sin(az);
                    const d0 = rx * tx + rz * tz;
                    let nx = rx - tx * d0, ny = -ty * d0, nz = rz - tz * d0;
                    // 【対策】若採りの内巻きした縁では面がほぼ水平で、わずかな
                    //         傾きで N が真上（実測 ny=+1.00）を向く。板が傘の
                    //         肉へ潜るので、上を向かせない
                    if (ny > 0) ny = 0;
                    // 縁の数テクセルぶんだけ真下へ寄せて安定させる
                    const wd = smooth(0.80, 1.0, s) * 0.75;
                    nx = mix(nx, 0, wd); ny = mix(ny, -1, wd); nz = mix(nz, 0, wd);
                    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;

                    let dep = this.gillDepthAt(s) * dk;
                    if (bl.s0 > 0) dep *= smooth(bl.s0, bl.s0 + 0.10, s);

                    // 板をわずかにうねらせる（完全な平面だと櫛になる）
                    const off = wav * this.R * 0.05 * Math.sin(3.4 * s + wph) * smooth(0.08, 0.5, s);
                    const ox = -Math.sin(az) * off, oz = Math.cos(az) * off;

                    const kT = base + i * 2, kB = kT + 1;
                    positions[kT * 3] = A.x + ox; positions[kT * 3 + 1] = A.y; positions[kT * 3 + 2] = A.z + oz;
                    positions[kB * 3] = A.x + nx * dep + ox;
                    positions[kB * 3 + 1] = A.y + ny * dep;
                    positions[kB * 3 + 2] = A.z + nz * dep + oz;

                    // 【対策】ひだの奥は光が届かない。この明暗を頂点カラーで
                    //         焼いておかないと、SSAO では拾いきれず、
                    //         白い板が等間隔に並んだ扇風機になる
                    const gr = 0.92 + 0.16 * Noise.fbm3(Math.cos(az) * 5, Math.sin(az) * 5,
                        s * 7, this.nseed + 13, 2);
                    const deep = 1 - smooth(0.0, 0.35, dep / Math.max(1e-6, this.R * cfg.gillDeepCap)) * 0.30;
                    const tp = [
                        mix(CD[0], CG[0], 0.28) * gr * deep,
                        mix(CD[1], CG[1], 0.28) * gr * deep,
                        mix(CD[2], CG[2], 0.28) * gr * deep
                    ];
                    let er = CE[0] * gr, eg = CE[1] * gr, eb = CE[2] * gr;
                    if (tint > 0) {
                        const tk = tint * smooth(0.30, 0.9, s);
                        er = mix(er, 0.62, tk); eg = mix(eg, 0.50, tk); eb = mix(eb, 0.38, tk);
                    }
                    colors[kT * 4] = srgb(tp[0]); colors[kT * 4 + 1] = srgb(tp[1]);
                    colors[kT * 4 + 2] = srgb(tp[2]); colors[kT * 4 + 3] = 1;
                    colors[kB * 4] = srgb(er); colors[kB * 4 + 1] = srgb(eg);
                    colors[kB * 4 + 2] = srgb(eb); colors[kB * 4 + 3] = 1;

                    if (i < K) {
                        const A0 = kT, B0 = kB, C0 = kT + 2, D0 = kB + 2;
                        indices.push(A0, B0, C0, C0, B0, D0);
                    }
                }
            }
            const normals = new Float32Array(total * 3);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            const mesh = makeMesh("eringiGills", positions, indices, normals, null, colors, this.scene);
            mesh.material = skin.gill;
            mesh.receiveShadows = true;
            this.gills = mesh;
            this.parts.push(mesh);
        }

        // ---- 当たり判定 -----------------------------------------------
        // 【対策】エリンギは凸ではない（傘が柄より張り出す）。全体を1つの
        //         凸包にすると円錐台になり、隣の個体が傘の下に潜り込めず
        //         「盛った」感じが出ない。傘の凸包と、柄を分割した円柱の
        //         複合形状にする
        hullShape() {
            const capHull = this._capHull();
            const children = [capHull];
            try {
                const box = new BABYLON.PhysicsShapeContainer(this.scene);
                box.addChild(capHull);
                // 柄は棍棒形なので、3段の円柱で近似する
                const SEG = 3;
                for (let i = 0; i < SEG; i++) {
                    const s0 = 0.02 + (i / SEG) * 0.96;
                    const s1 = 0.02 + ((i + 1) / SEG) * 0.96;
                    const a = this.stemCenterAt(s0), b = this.stemCenterAt(s1);
                    const r = Math.max(this.stemRadiusAt(s0), this.stemRadiusAt(s1)) * 0.98;
                    const cyl = new BABYLON.PhysicsShapeCylinder(a, b, r, this.scene);
                    box.addChild(cyl); children.push(cyl);
                }
                // 【対策】コンテナを dispose しても子シェイプは解放されない。
                //         作り直しのたびにネイティブ側へ積み上がるので持っておく
                box._childShapes = children;
                return box;
            } catch (err) {
                console.warn("[Eringi] 複合形状を作れませんでした。傘のみの凸包にします。", err);
                return capHull;
            }
        }
        _capHull() {
            const N = 14, M = 22;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const u = (i / N) * U_UNDER;
                const ring = [];
                let sy = 0;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const s = this.capSurfaceAt(u, phi);
                    ring.push(new V3(Math.cos(phi) * s.r * 0.985, s.y, Math.sin(phi) * s.r * 0.985));
                    sy += s.y;
                }
                rings.push(ring); centers.push(new V3(0, sy / (M + 1), 0));
            }
            const proxy = sweep("eringiProxy", rings, centers, this.scene);
            proxy.isVisible = false;
            const hull = new BABYLON.PhysicsShapeConvexHull(proxy, this.scene);
            proxy.dispose();
            return hull;
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
        m.albedoTexture.anisotropicFilteringLevel = 16;
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
    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】テクスチャは規格単位でキャッシュするので、その種は
        //         個体乱数から切り離して規格名から決める
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        cfg.profile = blendProfile(cfg.mature);
        cfg.total = Math.max(1, Math.round(cfg.count * cfg.countScale));
        if (cfg.total > 5) { cfg.capSegmentsAxis = 68; cfg.capSegmentsRound = 96; cfg.stemSegments = 40; }
        if (cfg.total > 8) { cfg.capSegmentsAxis = 54; cfg.capSegmentsRound = 76; cfg.stemSegments = 32; cfg.gillSegments = 12; }
        return cfg;
    }

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.93, 0.925, 0.915, 1);

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
        console.warn("[Eringi] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.70;
    scene.environmentIntensity = 0.72;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.14, 52, new V3(0, 2.2, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 5;
    camera.maxZ = 300;
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 140;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.90, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.3;
    key.diffuse = new BABYLON.Color3(1.0, 0.985, 0.960);
    key.specular = new BABYLON.Color3(0.45, 0.44, 0.42);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.30, -0.55).normalize(), scene);
    fillL.intensity = 1.00;
    fillL.diffuse = new BABYLON.Color3(1.0, 0.98, 0.95);
    fillL.specular = new BABYLON.Color3(0.14, 0.13, 0.12);

    // 【対策】ひだは傘の下の暗がりに入る。下からの弱い返しが無いと
    //         横を向いた個体のひだが真っ黒に潰れて、ただの黒い溝になる
    const bounce = new BABYLON.DirectionalLight("bounce", new V3(0.1, 1.0, 0.2).normalize(), scene);
    bounce.intensity = 0.42;
    bounce.diffuse = new BABYLON.Color3(0.98, 0.96, 0.92);
    bounce.specular = new BABYLON.Color3(0, 0, 0);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.44;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.80, 0.77, 0.73);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】useBlurExponentialShadowMap は深度を指数関数で近似するため、
    //         ぼかすと影がキャスター自身の明るい面へにじみ出す。白い柄では
    //         それが「打ち身のような灰色の斑」として非常に目立つ。
    //         PCF なら深度比較そのものなので、にじみは原理的に起きない
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    // 【対策】閉じたメッシュなら裏面だけをシャドウマップへ描けばよい。
    //         こうすると自己遮蔽（シャドウアクネ）が原理的に起きず、
    //         隣の個体へ落ちる影はそのまま残る
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0006;
    sg.normalBias = 0.02;
    sg.darkness = 0.46;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    // 【対策】被写体がほぼ白なので、露出を上げると一面が飛ぶ。
    //         むしろ少し切り詰めて、コントラストで立体を出す
    ip.exposure = 1.02;
    ip.contrast = 1.14;
    ip.vignetteEnabled = false;

    let ground = null;
    if (GLOBAL.showGround) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 240, height: 2, depth: 240 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.895, 0.885).toLinearSpace();
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
        bShape.material = { friction: 0.85, restitution: 0.0 };
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
            if (it.shape) {
                const ch = it.shape._childShapes;
                it.shape.dispose();
                if (ch) for (const c of ch) { try { c.dispose(); } catch (e) { } }
            }
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
            // 【対策】エリンギは細長い棒なので、必ず横に寝る。正立で放すと
            //         全部が倒れる過程で弾き合い、ざるの外へ飛び出す。
            //         最初から横倒しで放すのがいちばん安定する。
            //         5本に1本くらいは斜めに立てかかった姿勢にする
            const lay = (i % 5 === 2)
                ? rng.range(0.55, 0.95)          // 斜めに立てかかる
                : Math.PI / 2 + rng.gauss(0, 0.30);
            e.root.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(
                rng.range(0, TAU), rng.gauss(0, 0.22), lay);
            const r = GLOBAL.basketRim * 0.34 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            const cols = Math.ceil(Math.sqrt(items.length));
            for (let i = 0; i < items.length; i++) {
                const e = items[i], d = e.R * 2.6;
                e.root.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0, 0, Math.PI / 2);
                e.root.position.set(
                    ((i % cols) - (cols - 1) / 2) * d,
                    GLOBAL.basketThick + e.stemR,
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

        // テクスチャは規格だけで決まる。個体差で焼き直すと GUI 操作のたびに固まる
        let skin = skinCache[varietyKey];
        if (!skin) { skin = new Skin(scene, cfg); skinCache[varietyKey] = skin; }

        for (let i = 0; i < cfg.total; i++) {
            items.push(new Eringi(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.45, 0);
        camera.radius = cfg.basketRim * 3.1;

        resetDrop(seed);
        console.log("[Eringi]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.total, "本");
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
        // 【対策】被写体がほぼ白なので、影が無いと個体どうしの境目が消えて
        //         のっぺりした一塊になる。ひだの隙間と重なりに影を入れる
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 0.85;
        ssao.totalStrength = 1.15;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 200;
        ssao.minZAspect = 0.24;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    // 【対策】白い被写体では bloom のしきい値を下げると全体がにじむ
    dp.bloomThreshold = 0.99;
    dp.bloomWeight = 0.04;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.22;
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
        idle: "#292418", active: "#8a7038", edge: "#4a4230",
        text: "#f7f2e6", sub: "#c8bb9c", accent: "#e3c882"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "252px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(20,17,10,0.82)";
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

    addLabel("ERINGI", 11, COL.sub, "18px");
    addLabel("規格", 13, COL.accent, "22px");

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
    for (const c of [3, 5, 8]) {
        countBtns[c] = addButton("c" + c, ["少なめ", "ふつう", "多め"][[3, 5, 8].indexOf(c)], () => {
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
        const gillTotal = curCfg.gills * Math.pow(2, curCfg.gillTiers);
        info.text = state + " / " + items.length + "本 / 全長 " + (e.stemL + e.H).toFixed(1)
            + "cm 柄径 " + (e.stemR * 2).toFixed(1) + "cm 傘径 " + (e.R * 2).toFixed(1) + "cm\n"
            + "ひだ" + gillTotal + "枚  seed: " + curSeed + "  [" + BUILD + "]";
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
    toggleBtn.background = "rgba(20,17,10,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(20,17,10,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;