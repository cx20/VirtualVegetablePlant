// =====================================================================
//  Photoreal Shiitake  /  写実的なシイタケ
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（花どんこ / どんこ / こうしん）
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ / 2D値ノイズ / セルノイズ（亀裂用）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 傘の断面（r, y の2列テーブル）を厚肉／薄肉で補間
//    5. TextureLab  … 傘のアルベド・ORM・法線、柄、竹の網代
//    6. Shiitake    … 傘（上面〜縁〜下面を1枚の閉じた回転体）+ ひだ + 柄
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1本ずつ落とす）
//    9. GUI
//
//  これまでの野菜との違い:
//    ・「表と裏の両方が主役」。トマトの萼のような添え物ではなく、
//      ざるに盛れば必ず何本かは裏返って、ひだが正面に来る
//    ・傘は単純なドームではない。最大径のところから縁が下へ落ち、
//      さらに内側へ巻き込む（内巻き）。この巻きが無いと椀を伏せた
//      だけの形になり、キノコに見えない
//    ・ひだ（ラメラ）は実体で立てる。テクスチャの縞で済ませると
//      裏返った個体が「線を描いた円盤」になって一発で嘘だとわかる
//    ・傘表面の白い亀裂（花どんこの「花」）はセルノイズの境界で描く。
//      これは色ではなく「割れて中の白い肉が出ている」ので、
//      法線でも凹ませないと絵に描いた模様になる
//    ・柄は傘の中心から少し傾いて生え、途中で曲がり、根元は切り口。
//      まっすぐな円柱にすると玩具のキノコになる
//    ・キノコの皮は濡れていない。艶を足すと途端に樹脂の置物になる
//
//  shiitake-A2 での修正:
//    ・薄肉品種（こうしん）で柄が傘の上面を突き抜けていた問題を修正。
//      埋め込み量を R の定数比ではなく実際の肉厚から決め、さらに
//      付け根付近のリング頂点を傘の上面で頭打ちにした
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        hanadonko: {
            label: "花どんこ",
            radius: 2.45,          // 傘の半径
            capH: 0.66,            // 傘の高さ / 半径。厚肉ほど大きい
            fleshy: 1.00,          // 1 = 厚肉プロファイル、0 = 薄肉
            countScale: 1.5,

            // 傘の輪郭のゆがみ
            outline1: 0.045, outline2: 0.022, outlineN: 0.030,
            margWave: 0.030,       // 縁の波打ち（半径比）
            margLobes: 3,

            // 亀裂（花どんこの「花」）
            crackCells: 5.2,       // 傘全体に何個ぶんのセルを敷くか
            crackWidth: 0.115,     // 割れ目の幅
            crackAmt: 1.00,        // 白い肉の見え方の強さ
            crackDepth: 1.00,
            fleckAmt: 0.55,        // 細かい白い鱗片

            // ひだ
            gills: 26, gillTiers: 2, gillFill: 1.00, gillWave: 0.20,

            // 柄
            // 【対策】柄は「傘の半径に対する比」で持つ。実物は切って出荷される
            //         ので短い。1.0 倍などにすると足の長いキノコの絵文字になる
            stemLen: 0.75, stemRad: 0.30, stemTilt: 0.13, stemBend: 0.16,
            stemFlare: 0.50, woodyBase: 0.35,

            // 色（sRGB）
            capCenter: [0.255, 0.150, 0.088],   // 傘の中心（いちばん濃い）
            capMid: [0.430, 0.268, 0.152],
            capOuter: [0.360, 0.212, 0.120],
            capRim: [0.245, 0.140, 0.082],      // 縁の下端
            capWarm: [0.520, 0.300, 0.140],     // 赤みの差し色
            crackCol: [0.880, 0.828, 0.720],    // 割れ目から見える肉
            fleckCol: [0.905, 0.860, 0.775],
            veil: [0.855, 0.800, 0.700],        // 縁に残る内被膜
            gillCol: [0.930, 0.905, 0.845],
            gillEdge: [0.975, 0.960, 0.925],
            gillDeep: [0.560, 0.505, 0.440],    // ひだの奥（天井側）
            underCol: [0.900, 0.868, 0.800],
            stemCol: [0.878, 0.840, 0.760],
            stemLow: [0.700, 0.620, 0.500],
            stemCut: [0.812, 0.770, 0.680],

            capRoughness: 0.72, sss: 0.55
        },
        donko: {
            label: "どんこ（冬菇）",
            radius: 2.25, capH: 0.72, fleshy: 1.00, countScale: 1.6,
            outline1: 0.038, outline2: 0.018, outlineN: 0.026,
            margWave: 0.022, margLobes: 3,
            // どんこは亀裂が細かい。太くすると花どんこになってしまう
            crackCells: 9.0, crackWidth: 0.052, crackAmt: 0.55, crackDepth: 0.70,
            fleckAmt: 0.85,
            gills: 26, gillTiers: 2, gillFill: 1.00, gillWave: 0.18,
            stemLen: 0.68, stemRad: 0.32, stemTilt: 0.11, stemBend: 0.13,
            stemFlare: 0.55, woodyBase: 0.62,
            capCenter: [0.205, 0.118, 0.070],
            capMid: [0.375, 0.222, 0.126],
            capOuter: [0.315, 0.180, 0.100],
            capRim: [0.205, 0.115, 0.068],
            capWarm: [0.470, 0.262, 0.118],
            crackCol: [0.855, 0.800, 0.690],
            fleckCol: [0.885, 0.838, 0.752],
            veil: [0.830, 0.772, 0.672],
            gillCol: [0.918, 0.892, 0.828],
            gillEdge: [0.968, 0.950, 0.912],
            gillDeep: [0.530, 0.478, 0.412],
            underCol: [0.885, 0.850, 0.780],
            stemCol: [0.862, 0.822, 0.740],
            stemLow: [0.650, 0.560, 0.435],
            stemCut: [0.795, 0.750, 0.658],
            capRoughness: 0.75, sss: 0.50
        },
        koushin: {
            label: "こうしん（香信）",
            radius: 3.30, capH: 0.34, fleshy: 0.00, countScale: 1.1,
            // 薄肉の開いた傘は輪郭がゆがみやすく、縁も波打つ
            outline1: 0.060, outline2: 0.032, outlineN: 0.040,
            margWave: 0.048, margLobes: 4,
            crackCells: 11.0, crackWidth: 0.040, crackAmt: 0.30, crackDepth: 0.45,
            fleckAmt: 0.70,
            gills: 30, gillTiers: 2, gillFill: 0.92, gillWave: 0.26,
            // 【対策】薄肉の傘は中心の肉厚が 0.40H しかない。付け根の張り出しを
            //         厚肉と同じにすると、傘に埋める余地が無くなって上面へ抜ける。
            //         幾何側でも頭打ちにしているが、ここでも控えめにしておく
            stemLen: 0.85, stemRad: 0.24, stemTilt: 0.16, stemBend: 0.22,
            stemFlare: 0.30, woodyBase: 0.45,
            capCenter: [0.300, 0.185, 0.108],
            capMid: [0.470, 0.310, 0.180],
            capOuter: [0.405, 0.252, 0.142],
            capRim: [0.300, 0.180, 0.104],
            capWarm: [0.560, 0.345, 0.170],
            crackCol: [0.880, 0.832, 0.730],
            fleckCol: [0.900, 0.858, 0.780],
            veil: [0.868, 0.815, 0.720],
            gillCol: [0.935, 0.912, 0.855],
            gillEdge: [0.978, 0.965, 0.932],
            gillDeep: [0.575, 0.522, 0.455],
            underCol: [0.905, 0.875, 0.812],
            stemCol: [0.885, 0.850, 0.775],
            stemLow: [0.712, 0.635, 0.515],
            stemCut: [0.822, 0.782, 0.695],
            capRoughness: 0.78, sss: 0.62
        }
    };

    const GLOBAL = {
        count: 5,                  // 個数（品種の countScale 倍される）

        // 籠（ざる）
        basketRim: 15.0,
        basketDepth: 5.0,
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
        pieceMass: 0.45,
        // 【対策】シイタケは軽くて表面がざらつく。摩擦を高くしないと
        //         傘が滑って全部ざるの壁際に寄り、中央が空く
        friction: 0.95,
        restitution: 0.01,
        linearDamping: 0.22,
        angularDamping: 0.94,
        dropInterval: 0.30,
        dropClearance: 1.6,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.0, settleHold: 0.40,
        settleTimeout: 7.0,

        capSegmentsAxis: 96,       // 傘の断面方向の分割
        capSegmentsRound: 112,     // 傘の周方向の分割
        gillSegments: 14,
        stemSegments: 26,
        stemSides: 20,

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

    const START_VARIETY = "hanadonko";
    const START_SEED = 20260731;
    const BUILD = "shiitake-A2";

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    // 断面パラメータ u の意味づけ（テクスチャの v と一致する）
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
        // セルノイズ。f1 = 最近点までの距離、f2 = 2番目
        // 【対策】亀裂は「点の集まり」ではなく「面の境界」。f1 のしきい値で
        //         作ると水玉になる。f2 - f1 が小さいところ＝2つの領域が
        //         せめぎ合う線を割れ目にする
        cell2(x, y, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            let f1 = 1e9, f2 = 1e9;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const gx = xi + dx, gy = yi + dy;
                    const jx = gx + this._h2(gx, gy, seed);
                    const jy = gy + this._h2(gx, gy, seed + 7717);
                    const ex = jx - x, ey = jy - y;
                    const d = Math.sqrt(ex * ex + ey * ey);
                    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
                }
            }
            return [f1, f2];
        },
        // u 方向だけ折り返す（柄のUVは u が周方向で継ぎ目が無い）
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
    // [u, r/R, y/H]。u=0 が傘の頂点、u=1 が下面の中心（柄の付け根）
    //
    // 【対策】キノコの傘は「ドーム」ではなく「折り返しのある閉曲面」。
    //         上面を降りて最大径に達したあと、縁が下へ落ち、さらに内側へ
    //         巻き込んで下面（ひだの天井）に繋がる。1本のテーブルで
    //         この往復まで書いてしまえば、傘は継ぎ目の無い1メッシュで済む
    //
    // 【対策】厚肉（どんこ）と薄肉（こうしん）を1本のテーブルで賄おうとすると、
    //         どちらかが必ず嘘になる。u を揃えた2本を用意して cfg.fleshy で
    //         線形補間する。u が揃っているので補間しても折り返しが崩れない
    const PROFILE_THICK = [
        [0.000, 0.022, 1.000], [0.030, 0.098, 0.997], [0.070, 0.192, 0.988],
        [0.120, 0.310, 0.968], [0.180, 0.440, 0.934], [0.245, 0.570, 0.884],
        [0.310, 0.688, 0.820], [0.375, 0.788, 0.744], [0.440, 0.870, 0.656],
        [0.500, 0.930, 0.566], [0.555, 0.972, 0.478], [0.605, 0.995, 0.392],
        [0.650, 1.000, 0.300], [0.690, 0.988, 0.208], [0.725, 0.962, 0.128],
        [0.758, 0.928, 0.066], [0.790, 0.892, 0.030], [0.820, 0.862, 0.040],
        [0.855, 0.812, 0.076], [0.895, 0.712, 0.132], [0.930, 0.580, 0.190],
        [0.960, 0.430, 0.242], [0.985, 0.270, 0.280], [1.000, 0.130, 0.296]
    ];
    const PROFILE_THIN = [
        [0.000, 0.022, 1.000], [0.030, 0.110, 0.995], [0.070, 0.220, 0.982],
        [0.120, 0.350, 0.956], [0.180, 0.490, 0.916], [0.245, 0.620, 0.866],
        [0.310, 0.730, 0.808], [0.375, 0.820, 0.742], [0.440, 0.888, 0.668],
        [0.500, 0.936, 0.588], [0.555, 0.970, 0.506], [0.605, 0.990, 0.418],
        [0.650, 1.000, 0.322], [0.690, 0.996, 0.228], [0.725, 0.986, 0.146],
        [0.758, 0.972, 0.078], [0.790, 0.958, 0.036], [0.820, 0.944, 0.050],
        [0.855, 0.906, 0.110], [0.895, 0.812, 0.222], [0.930, 0.676, 0.352],
        [0.960, 0.508, 0.470], [0.985, 0.322, 0.560], [1.000, 0.150, 0.600]
    ];

    function blendProfile(t) {
        const out = [];
        for (let i = 0; i < PROFILE_THICK.length; i++) {
            const a = PROFILE_THICK[i], b = PROFILE_THIN[i];
            out.push([a[0], mix(b[1], a[1], t), mix(b[2], a[2], t)]);
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

    // 輪郭のゆがみを効かせる重み。頂点では効かせず、縁でいちばん強い
    // 【対策】全長で一様にすると傘の頭が卵形にひしゃげる。ゆがみは
    //         「縁が伸び縮みして波打つ」現象なので、外周だけに効かせる
    function outlineWeightAt(u) {
        return smooth(0.12, 0.60, u) * (1 - 0.45 * smooth(0.86, 1.0, u));
    }
    function margWeightAt(u) {
        return Math.pow(smooth(0.30, 0.79, u), 1.3) * (1 - 0.55 * smooth(0.88, 1.0, u));
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
            //         にすると粗さ 0.72 が線形 0.49 として渡り、狙いより
            //         つやつやになる。色以外のテクスチャは必ず線形で渡す
            if (linear) dt.gammaSpace = false;
            return dt;
        },

        // 傘の場をまとめて1回で焼く
        // 【対策】アルベド・ORM・法線を別々に計算すると、亀裂の位置がずれて
        //         「模様の上にぼんやりした汚れが乗った」ように見える
        //
        // 【対策】この傘のUVは v が断面パラメータなので、頂点（v=0）付近で
        //         u 方向が極端に潰れる。UV空間でノイズを引くと中心から
        //         放射状の筋が出る。断面の半径 r(v) を使って (x,z) 平面へ
        //         射影した座標でノイズを引けば、模様の大きさが場所によらず
        //         一定になり、しかも継ぎ目もできない
        fields(size, cfg) {
            const n = size * size;
            const P = cfg.profile;
            const F = {
                h: new Float32Array(n),      // 高さ（法線用）
                crack: new Float32Array(n),  // 亀裂
                fleck: new Float32Array(n),  // 細かい白い鱗片
                mott: new Float32Array(n),   // 濃淡のムラ
                fib: new Float32Array(n)     // 下面（ひだ）の筋
            };
            const CC = cfg.crackCells, CW = cfg.crackWidth;
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const pr = profileAt(P, v)[0];         // 0..1
                const top = 1 - smooth(U_RIM - 0.06, U_EDGE, v);   // 上面らしさ
                const und = smooth(U_EDGE, U_UNDER + 0.02, v);     // 下面らしさ
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    const phi = u * TAU;
                    const px = Math.cos(phi) * pr, pz = Math.sin(phi) * pr;

                    // --- 亀裂（セル境界）
                    // 低周波で座標をゆがめておかないと、セルが規則正しく並んで
                    // 蜂の巣に見える
                    const wx = px + 0.22 * (Noise.fbm2(px * 2.4, pz * 2.4, cfg.texSeed + 3, 2) - 0.5);
                    const wz = pz + 0.22 * (Noise.fbm2(px * 2.4 + 9, pz * 2.4 + 9, cfg.texSeed + 3, 2) - 0.5);
                    const c = Noise.cell2(wx * CC, wz * CC, cfg.texSeed + 11);
                    let crack = 1 - smooth(0, CW, c[1] - c[0]);
                    // 割れ目は中心ほど大きく開く。縁では閉じている
                    crack *= top * (0.35 + 0.75 * (1 - smooth(0.05, 0.62, v)));
                    // 全面が割れているわけではない。低周波で「割れる区画」を作る
                    crack *= smooth(0.34, 0.66, Noise.fbm2(px * 1.7, pz * 1.7, cfg.texSeed + 23, 3));

                    // --- 細かい白い鱗片（毛羽立ち）
                    const fl = smooth(0.70, 0.90,
                        Noise.fbm2(px * 46, pz * 46, cfg.texSeed + 41, 2)) * top;

                    // --- 濃淡のムラ
                    const mo = Noise.fbm2(px * 2.1, pz * 2.1, cfg.texSeed + 57, 3);

                    // --- 下面の放射状の筋（ひだの実体を補助する）
                    const gl = 0.5 + 0.5 * Math.cos(cfg.gills * cfg.gillTiers * 2 * phi);

                    F.crack[i] = crack;
                    F.fleck[i] = fl;
                    F.mott[i] = mo;
                    F.fib[i] = gl * und;
                    // 亀裂は凹み、鱗片は膨らむ
                    F.h[i] = clamp(0.55
                        - 0.42 * crack * cfg.crackDepth
                        + 0.16 * fl
                        + 0.10 * (mo - 0.5)
                        + 0.05 * (Noise.fbm2(px * 120, pz * 120, cfg.texSeed + 71, 1) - 0.5)
                        - 0.18 * gl * und, 0, 1);
                }
            }
            return F;
        },

        capAlbedo(scene, size, cfg, F) {
            const CN = cfg.capCenter, CM = cfg.capMid, CO = cfg.capOuter, CR = cfg.capRim;
            const CW = cfg.capWarm, CK = cfg.crackCol, FC = cfg.fleckCol;
            const VE = cfg.veil, UN = cfg.underCol, GD = cfg.gillDeep;
            return this._tex("shiitakeCapAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        let cr, cg, cb;
                        if (v < U_EDGE) {
                            // --- 上面〜縁
                            // 【対策】一様な茶色にすると板チョコになる。実物は
                            //         中心がいちばん濃く、中ほどが明るく、
                            //         外周でまた沈み、縁の下端で最も暗い
                            let t = smooth(0.00, 0.34, v);
                            cr = mix(CN[0], CM[0], t); cg = mix(CN[1], CM[1], t); cb = mix(CN[2], CM[2], t);
                            t = smooth(0.34, 0.62, v);
                            cr = mix(cr, CO[0], t); cg = mix(cg, CO[1], t); cb = mix(cb, CO[2], t);
                            t = smooth(0.66, 0.788, v);
                            cr = mix(cr, CR[0], t); cg = mix(cg, CR[1], t); cb = mix(cb, CR[2], t);
                            // 赤みの差し色（日の当たった側が橙に寄る個体がある）
                            const wm = smooth(0.58, 0.86, F.mott[i]) * (1 - smooth(0.62, 0.80, v));
                            cr = mix(cr, CW[0], wm * 0.55); cg = mix(cg, CW[1], wm * 0.55); cb = mix(cb, CW[2], wm * 0.55);
                            // 濃淡
                            const mk = 0.88 + 0.26 * F.mott[i];
                            cr *= mk; cg *= mk; cb *= mk;
                            // 亀裂＝割れて中の白い肉が出ている
                            const ck = clamp(F.crack[i] * cfg.crackAmt, 0, 1);
                            cr = mix(cr, CK[0], ck); cg = mix(cg, CK[1], ck); cb = mix(cb, CK[2], ck);
                            // 【対策】割れ目のふちは影になる。ここを描かないと
                            //         白い線を引いただけの絵になる
                            const lp = smooth(0.10, 0.30, F.crack[i])
                                * (1 - smooth(0.30, 0.58, F.crack[i])) * 0.55;
                            cr *= (1 - lp * 0.55); cg *= (1 - lp * 0.55); cb *= (1 - lp * 0.55);
                            // 細かい鱗片
                            const fk = F.fleck[i] * cfg.fleckAmt * (0.45 + 0.55 * smooth(0.15, 0.70, v));
                            cr = mix(cr, FC[0], fk * 0.75); cg = mix(cg, FC[1], fk * 0.75); cb = mix(cb, FC[2], fk * 0.75);
                            // 縁に残る内被膜の白いささくれ
                            const vl = smooth(0.735, 0.792, v) * (0.35 + 0.65 * F.fleck[i]);
                            cr = mix(cr, VE[0], vl * 0.65); cg = mix(cg, VE[1], vl * 0.65); cb = mix(cb, VE[2], vl * 0.65);
                        } else {
                            // --- 下面（ひだの天井）
                            const t = smooth(U_EDGE, U_EDGE + 0.05, v);
                            cr = mix(CR[0], UN[0], t); cg = mix(CR[1], UN[1], t); cb = mix(CR[2], UN[2], t);
                            // 【対策】天井をそのまま明るいクリーム色にすると、
                            //         ひだの隙間から白い床が見えて空洞に見える。
                            //         ひだの根元は光が届かないので暗く沈ませる
                            const dk = 0.45 + 0.35 * F.fib[i];
                            cr = mix(cr, GD[0], dk); cg = mix(cg, GD[1], dk); cb = mix(cb, GD[2], dk);
                            const mk = 0.92 + 0.16 * F.mott[i];
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
            return this._tex("shiitakeCapORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        // 【対策】キノコの傘は乾いている。粗さを下げると
                        //         とたんに樹脂の置物になる。ただし完全に一様だと
                        //         フェルトなので、ムラで拡散反射の強弱を作る
                        let rough = cfg.capRoughness * (0.92 + 0.16 * (1 - F.h[i]));
                        // 割れて出た肉は毛羽立っていていちばん粗い
                        rough = mix(rough, 0.94, F.crack[i] * 0.85);
                        rough = mix(rough, 0.90, F.fleck[i] * 0.55);
                        if (v > U_EDGE) rough = 0.90;                 // ひだ側
                        let ao = 1.0;
                        ao = mix(ao, 0.55, F.crack[i] * 0.85);        // 割れ目の底
                        ao = mix(ao, 0.62, smooth(U_EDGE, 1.0, v) * 0.9);
                        ao = mix(ao, 0.88, smooth(0.70, 0.80, v) * 0.6);
                        d[o] = clamp(ao, 0, 1) * 255;
                        d[o + 1] = clamp(rough, 0.03, 1) * 255;
                        d[o + 2] = 0; d[o + 3] = 255;
                    }
                }
            }, scene, true, true);
        },

        normal(scene, size, hf, strength, name) {
            return this._tex(name || "shiitakeNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 極ではUが潰れて放射状の筋になるので端を減衰させる
                    const vv = y / N;
                    const k = strength * smooth(0, 0.05, vv) * (1 - smooth(0.96, 1.0, vv));
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
            }, scene, true, true);
        },

        // 柄。v=0 が傘との付け根、v=1 が石づきの切り口
        // 【対策】柄を頂点カラーだけで塗ると、周 20 分割では繊維が出ない。
        //         繊維は必ず縦に走るので、u 方向に高周波・v 方向に低周波の
        //         ノイズを引く
        stemFields(size, cfg) {
            const n = size * size;
            const F = { h: new Float32Array(n), fib: new Float32Array(n), rot: new Float32Array(n) };
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    const fib = Noise.fbm2u(u * 190, v * 7, 190, cfg.texSeed + 101, 2);
                    const fine = Noise.fbm2u(u * 520, v * 26, 520, cfg.texSeed + 113, 1);
                    const rot = Noise.fbm2u(u * 9, v * 12, 9, cfg.texSeed + 127, 3);
                    F.fib[i] = fib; F.rot[i] = rot;
                    F.h[i] = clamp(0.5 + 0.36 * (fib - 0.5) + 0.16 * (fine - 0.5), 0, 1);
                }
            }
            return F;
        },

        stemAlbedo(scene, size, cfg, F) {
            const SC = cfg.stemCol, SL = cfg.stemLow, CU = cfg.stemCut;
            return this._tex("shiitakeStemAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        // 側面（v < 0.86）と切り口（v >= 0.86）
                        const cut = smooth(0.855, 0.885, v);
                        // 根元へ行くほど木質化して褐色になる
                        const low = smooth(0.30, 0.86, v) * cfg.woodyBase;
                        let cr = mix(SC[0], SL[0], low);
                        let cg = mix(SC[1], SL[1], low);
                        let cb = mix(SC[2], SL[2], low);
                        // 縦の繊維
                        const fk = 0.84 + 0.30 * F.fib[i];
                        cr *= fk; cg *= fk; cb *= fk;
                        // まだらな汚れ
                        const rk = 1 - 0.22 * smooth(0.62, 0.95, F.rot[i]) * (0.3 + 0.7 * low);
                        cr *= rk; cg *= rk; cb *= rk;
                        // 傘との境目はうっすら暗い
                        const nk = 1 - 0.16 * (1 - smooth(0.0, 0.07, v));
                        cr *= nk; cg *= nk; cb *= nk;
                        // 切り口：中心が白く、外周に褐色の輪
                        if (cut > 0) {
                            const rr = clamp((1 - v) / 0.14, 0, 1);   // 0 = 中心, 1 = 外周
                            let kr = CU[0], kg = CU[1], kb = CU[2];
                            const edge = smooth(0.55, 1.0, rr);
                            kr = mix(kr * 1.04, SL[0], edge * 0.75);
                            kg = mix(kg * 1.04, SL[1], edge * 0.75);
                            kb = mix(kb * 1.04, SL[2], edge * 0.75);
                            const g = 0.86 + 0.28 * F.rot[i];
                            cr = mix(cr, kr * g, cut); cg = mix(cg, kg * g, cut); cb = mix(cb, kb * g, cut);
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
            return this._tex("shiitakeStemORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i = y * N + x, o = i * 4;
                        let rough = 0.86 + 0.10 * (1 - F.h[i]);
                        rough = mix(rough, 0.96, smooth(0.86, 1.0, v));   // 切り口は毛羽立つ
                        let ao = 1 - 0.22 * (1 - F.h[i]);
                        ao = mix(ao, 0.70, 1 - smooth(0.0, 0.10, v));     // 傘の陰に入る
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
            }, scene, false, false);
        }
    };

    // =================================================================
    //  マテリアル（品種ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const F = TextureLab.fields(S, cfg);
            this.capAlbedoTex = TextureLab.capAlbedo(scene, S, cfg, F);
            this.capOrmTex = TextureLab.capOrm(scene, S, cfg, F);
            this.capNormalTex = TextureLab.normal(scene, S, F.h, 2.4, "shiitakeCapNormal");

            const SF = TextureLab.stemFields(Math.min(512, S), cfg);
            this.stemAlbedoTex = TextureLab.stemAlbedo(scene, Math.min(512, S), cfg, SF);
            this.stemOrmTex = TextureLab.stemOrm(scene, Math.min(512, S), cfg, SF);
            this.stemNormalTex = TextureLab.normal(scene, Math.min(512, S), SF.h, 1.6, "shiitakeStemNormal");

            this.texs = [this.capAlbedoTex, this.capOrmTex, this.capNormalTex,
            this.stemAlbedoTex, this.stemOrmTex, this.stemNormalTex];
            for (const t of this.texs) t.anisotropicFilteringLevel = 8;

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            // --- 傘
            const m = new BABYLON.PBRMaterial("shiitakeCap", scene);
            m.albedoTexture = this.capAlbedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.capOrmTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.capNormalTex;
            m.bumpTexture.level = 0.85;          // 亀裂ははっきり凹ませる
            m.transparencyMode = OPAQUE;
            // 【対策】クリアコートは付けない。キノコは濡れていないので、
            //         わずかでも艶を足すと樹脂で成型した食品サンプルになる。
            //         代わりに sheen をごく弱く入れて、乾いた繊維質の面が
            //         斜めから見たときにだけ白く立つのを拾う
            m.sheen.isEnabled = true;
            m.sheen.intensity = 0.16;
            m.sheen.roughness = 0.60;
            m.sheen.color = new BABYLON.Color3(0.72, 0.66, 0.56);
            // 【対策】肉が厚いので光はほとんど透けない。ただし縁だけは薄く、
            //         逆光でうっすら明るくなる。厚みの下限を大きめに取る
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.86, 0.70, 0.52);
            m.subSurface.translucencyIntensity = 0.12 * cfg.sss;
            m.subSurface.minimumThickness = 1.2;
            m.subSurface.maximumThickness = 5.0;
            this.cap = m;

            // --- ひだ
            const g = new BABYLON.PBRMaterial("shiitakeGill", scene);
            g.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            g.metallic = 0.0;
            g.roughness = 0.88;
            g.transparencyMode = OPAQUE;
            // 【対策】ひだは厚さ 0.3mm 程度の薄板なので、板ポリで作って
            //         両面を点灯させる。ここで backFaceCulling を切らないと、
            //         裏返った個体のひだが片面だけ抜けて櫛の歯になる
            g.backFaceCulling = false;
            g.twoSidedLighting = true;
            // 薄いので必ず光が透ける。これが無いと石膏の板になる
            g.subSurface.isTranslucencyEnabled = true;
            g.subSurface.tintColor = new BABYLON.Color3(0.94, 0.88, 0.76);
            g.subSurface.translucencyIntensity = 0.32;
            g.subSurface.minimumThickness = 0.01;
            g.subSurface.maximumThickness = 0.12;
            this.gill = g;

            // --- 柄
            const s = new BABYLON.PBRMaterial("shiitakeStem", scene);
            s.albedoTexture = this.stemAlbedoTex;
            s.metallic = 0.0;
            s.roughness = 1.0;
            s.metallicTexture = this.stemOrmTex;
            s.useAmbientOcclusionFromMetallicTextureRed = true;
            s.useRoughnessFromMetallicTextureGreen = true;
            s.useMetallnessFromMetallicTextureBlue = true;
            s.bumpTexture = this.stemNormalTex;
            s.bumpTexture.level = 0.55;
            s.transparencyMode = OPAQUE;
            s.subSurface.isTranslucencyEnabled = true;
            s.subSurface.tintColor = new BABYLON.Color3(0.92, 0.84, 0.68);
            s.subSurface.translucencyIntensity = 0.16;
            s.subSurface.minimumThickness = 0.4;
            s.subSurface.maximumThickness = 1.6;
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
    // 6. Shiitake
    // =================================================================
    class Shiitake {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.P = cfg.profile;
            this.R = cfg.radius * rng.range(0.82, 1.18);
            this.H = this.R * cfg.capH * rng.range(0.90, 1.12);
            this.seed = seed >>> 0;
            this.nseed = rng.int(900000) + 1000;

            // 輪郭のゆがみ
            this.o1 = cfg.outline1 * rng.range(0.6, 1.5);
            this.o2 = cfg.outline2 * rng.range(0.5, 1.6);
            this.on = cfg.outlineN * rng.range(0.7, 1.4);
            this.p1 = rng.range(0, TAU);
            this.p2 = rng.range(0, TAU);
            // 縁の波打ち
            this.mw = cfg.margWave * rng.range(0.6, 1.5);
            this.ml = Math.max(2, cfg.margLobes + rng.int(3) - 1);
            this.mp = rng.range(0, TAU);
            // 柄
            this.stemAz = rng.range(0, TAU);
            this.stemTilt = cfg.stemTilt * rng.range(0.3, 1.7);
            this.stemBend = cfg.stemBend * rng.range(-0.6, 1.6);
            this.stemL = cfg.stemLen * this.R * rng.range(0.72, 1.30);
            this.stemR = cfg.stemRad * this.R * rng.range(0.85, 1.15);
            this.gillPhase = rng.range(0, TAU);

            this.parts = [];
            this._buildCap(skin);
            this._buildStemPath();
            this._buildGills(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("shiitake", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 傘表面の1点。u=0 が頂点、u=1 が下面の中心
        capSurfaceAt(u, phi) {
            const p = profileAt(this.P, u);
            const ow = outlineWeightAt(u);
            const k = 1
                + (this.o1 * Math.cos(phi - this.p1)
                    + this.o2 * Math.cos(2 * phi - this.p2)) * ow
                + this.on * (Noise.fbm3(Math.cos(phi) * 1.7, Math.sin(phi) * 1.7,
                    u * 2.0, this.nseed, 3) - 0.5) * 2 * ow;
            const r = this.R * p[0] * k;
            // 【対策】縁の波打ちは半径ではなく高さを揺らす。半径で作ると
            //         輪郭が花びらになってしまい、キノコではなく菊になる
            const wave = this.mw * this.R
                * Math.cos(this.ml * phi + this.mp)
                * margWeightAt(u);
            const y = this.H * p[1] + wave;
            return { r, y };
        }

        // その角度における縁のいちばん低い点（ひだの下限に使う）
        rimBottomAt(phi) {
            let m = Infinity;
            for (let i = 0; i <= 10; i++) {
                const u = mix(U_RIM, U_UNDER, i / 10);
                const s = this.capSurfaceAt(u, phi);
                if (s.y < m) m = s.y;
            }
            return m;
        }

        // 傘の上面が、その方位・水平半径のところでどの高さにあるか
        // 【対策】u ∈ [0, U_RIM] では半径が u について単調増加なので二分法で引ける。
        //         柄の埋め込みをこの高さから決めれば、品種の肉厚に関係なく
        //         突き抜けない。rq が最大径を超えたときは縁の高さ（最も低い値）が
        //         返るので、安全側に倒れる
        capTopYAt(rq, phi) {
            let lo = 0, hi = U_RIM;
            for (let i = 0; i < 14; i++) {
                const mid = (lo + hi) * 0.5;
                if (this.capSurfaceAt(mid, phi).r < rq) lo = mid; else hi = mid;
            }
            return this.capSurfaceAt(hi, phi).y;
        }

        // ---- 傘 -------------------------------------------------------
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
            const mesh = sweep("shiitakeCap", rings, centers, null, this.scene);
            mesh.material = skin.cap;
            mesh.receiveShadows = true;
            this.cap = mesh;
            this.parts.push(mesh);
        }

        // ---- 柄の芯線 -------------------------------------------------
        // 傘の下面中心から少し傾いて生え、途中で曲がる
        _buildStemPath() {
            const under = this.capSurfaceAt(1.0, 0);
            // 【対策】埋め込み量を R の定数比（0.12R）にすると、薄肉の品種
            //         （こうしん）では中心の肉厚 0.40H を超えてしまい、柄の頭が
            //         傘の上面から生えて見える。付け根の張り出しを含んだ半径の
            //         ところで「下面から上面までの肉厚」を測り、その一定割合に
            //         抑える。厚肉のどんこは肉厚が 0.70H あるので従来どおり
            //         0.12R が採用される
            const rFlare = this.stemRadiusAt(0);
            const ceilY = this.capTopYAt(rFlare, this.stemAz);
            const thick = Math.max(0, ceilY - under.y);
            const embed = Math.min(this.R * 0.12, thick * 0.45);
            this.stemTop = new V3(0, under.y + embed, 0);
            this.stemDir = { az: this.stemAz, tilt: this.stemTilt, bend: this.stemBend };
        }
        stemCenterAt(s) {
            const az = this.stemAz, t = this.stemTilt, L = this.stemL;
            const lat = L * (Math.sin(t) * s + this.stemBend * s * s);
            const y = this.stemTop.y - L * Math.cos(t) * s;
            return new V3(Math.cos(az) * lat, y, Math.sin(az) * lat);
        }
        stemRadiusAt(s) {
            const cfg = this.cfg;
            // 付け根の張り出し + 中ほどのくびれ + 石づき側の膨らみ
            return this.stemR
                * (1 + cfg.stemFlare * Math.pow(1 - smooth(0, 0.26, s), 1.7))
                * (1 - 0.14 * smooth(0.10, 0.55, s))
                * (1 + 0.10 * smooth(0.55, 0.92, s));
        }

        // ---- ひだ（ラメラ）--------------------------------------------
        // 【対策】ひだをテクスチャの縞で済ませると、裏返った個体が
        //         「線を描いた円盤」になる。実体の薄板を立てる。
        //         板は厚みゼロのシートで、材質側で両面点灯にする
        //
        // 【対策】長さの違う段（ラメラ）を混ぜないと、外周に行くほど
        //         間隔が開いて扇の骨になる。半径の増加に合わせて
        //         途中から生える短いひだを足し、密度を一定に保つ
        _buildGills(skin) {
            const cfg = this.cfg, rng = this.rng, K = cfg.gillSegments;
            const G = cfg.gills;
            const CG = cfg.gillCol, CE = cfg.gillEdge, CD = cfg.gillDeep;

            // 生やす板の一覧を作る（角度, 生え始めの s）
            const blades = [];
            for (let i = 0; i < G; i++) blades.push({ az: (i / G) * TAU, s0: 0.0 });
            let step = 1 / G, count = G;
            for (let t = 0; t < cfg.gillTiers; t++) {
                const s0 = [0.42, 0.70, 0.85][t] !== undefined ? [0.42, 0.70, 0.85][t] : 0.9;
                const half = step * 0.5;
                for (let i = 0; i < count; i++) blades.push({ az: (i / count) * TAU + half, s0 });
                count *= 2; step *= 0.5;
            }

            const nb = blades.length;
            const vertsPerBlade = (K + 1) * 2;
            const total = nb * vertsPerBlade;
            const positions = new Float32Array(total * 3);
            const colors = new Float32Array(total * 4);
            const indices = [];

            for (let b = 0; b < nb; b++) {
                const bl = blades[b];
                const az = bl.az + this.gillPhase + rng.gauss(0, 0.006);
                const floorY = this.rimBottomAt(az) + this.R * 0.030;
                const base = b * vertsPerBlade;
                // 板ごとの個体差
                const fillK = cfg.gillFill * rng.range(0.92, 1.06);
                const wav = cfg.gillWave * rng.range(0.5, 1.5);
                const wph = rng.range(0, TAU);
                const tint = rng.range(0, 1) < 0.16 ? rng.range(0.06, 0.22) : 0;   // 傷んだ褐色の縁

                for (let i = 0; i <= K; i++) {
                    const t = i / K;
                    const s = mix(bl.s0, 1.0, t);              // 0 = 柄側, 1 = 縁側
                    const u = mix(1.0, U_UNDER + 0.004, s);    // 断面パラメータ
                    const c = this.capSurfaceAt(u, az);

                    // 【対策】ひだの下端を「天井から一定量下げる」で決めると、
                    //         縁のほうで傘の外へ突き抜ける。天井と縁の下端の
                    //         あいだを一定の割合で埋める、と決めれば絶対に
                    //         はみ出さず、しかも自然に外へ行くほど浅くなる
                    let fill = fillK * (0.80 - 0.26 * s);
                    fill *= smooth(0.0, 0.08, s);                       // 柄際は消える
                    fill *= 1 - 0.45 * smooth(0.92, 1.0, s);            // 縁でも消える
                    if (bl.s0 > 0) fill *= smooth(bl.s0, bl.s0 + 0.12, s);
                    const freeY = mix(c.y, floorY, clamp(fill, 0, 1));

                    // 板をわずかにうねらせる（完全な平面だと櫛になる）
                    const off = wav * this.R * 0.06 * Math.sin(3.1 * s + wph) * smooth(0.05, 0.5, s);
                    const ax = -Math.sin(az), az2 = Math.cos(az);
                    const cx = Math.cos(az) * c.r + ax * off;
                    const cz = Math.sin(az) * c.r + az2 * off;

                    const kTop = base + i * 2, kBot = kTop + 1;
                    positions[kTop * 3] = cx; positions[kTop * 3 + 1] = c.y; positions[kTop * 3 + 2] = cz;
                    positions[kBot * 3] = cx; positions[kBot * 3 + 1] = freeY; positions[kBot * 3 + 2] = cz;

                    // 【対策】ひだの奥は光が届かない。この明暗を頂点カラーで
                    //         焼いておかないと、SSAO では拾いきれず、
                    //         白い板が等間隔に並んだ扇風機になる
                    const gr = 0.90 + 0.20 * Noise.fbm3(Math.cos(az) * 5, Math.sin(az) * 5,
                        s * 7, this.nseed + 13, 2);
                    const deep = 1 - clamp(fill, 0, 1) * 0.35;
                    const tp = [
                        mix(CD[0], CG[0], 0.30) * gr * deep,
                        mix(CD[1], CG[1], 0.30) * gr * deep,
                        mix(CD[2], CG[2], 0.30) * gr * deep
                    ];
                    let er = CE[0] * gr, eg = CE[1] * gr, eb = CE[2] * gr;
                    if (tint > 0) {
                        const tk = tint * smooth(0.25, 0.9, s);
                        er = mix(er, 0.58, tk); eg = mix(eg, 0.42, tk); eb = mix(eb, 0.30, tk);
                    }
                    colors[kTop * 4] = srgb(tp[0]); colors[kTop * 4 + 1] = srgb(tp[1]);
                    colors[kTop * 4 + 2] = srgb(tp[2]); colors[kTop * 4 + 3] = 1;
                    colors[kBot * 4] = srgb(er); colors[kBot * 4 + 1] = srgb(eg);
                    colors[kBot * 4 + 2] = srgb(eb); colors[kBot * 4 + 3] = 1;

                    if (i < K) {
                        const A = kTop, B = kBot, C = kTop + 2, D = kBot + 2;
                        indices.push(A, B, C, C, B, D);
                    }
                }
            }
            const normals = new Float32Array(total * 3);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            const mesh = makeMesh("shiitakeGills", positions, indices, normals, null, colors, this.scene);
            mesh.material = skin.gill;
            mesh.receiveShadows = true;
            this.gills = mesh;
            this.parts.push(mesh);
        }

        // ---- 柄 -------------------------------------------------------
        _buildStem(skin) {
            const cfg = this.cfg, K = cfg.stemSegments, M = cfg.stemSides;
            const rings = [], centers = [];
            const CUT = 0.865;   // ここから先は切り口の円盤
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
                    C = new V3(c0.x, c0.y + this.stemR * 0.10 * smooth(0, 1, q), c0.z);
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
                let al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
                const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;

                const ring = [];
                const clampTop = (t < 0.40);
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    // 柄は真円ではなく、縦の繊維ぶんだけ多角形にゆがむ
                    const rr = r * (1 + 0.045 * Math.cos(5 * phi + 0.7)
                        + 0.030 * Math.cos(9 * phi + 2.1)
                        + 0.05 * (Noise.fbm3(Math.cos(phi) * 3, Math.sin(phi) * 3,
                            s * 4, this.nseed + 3, 2) - 0.5));
                    const cs = Math.cos(phi) * rr, sn = Math.sin(phi) * rr;
                    let vx = C.x + ax * cs + bx * sn;
                    let vy = C.y + ay * cs + by * sn;
                    let vz = C.z + az * cs + bz * sn;
                    // 【対策】柄は傾いて生えるので、付け根の断面は片側が持ち上がる。
                    //         芯線の高さを合わせるだけでは、その持ち上がった側が
                    //         傘の上面を突き抜ける。頂点ごとに天井で頭打ちにすれば、
                    //         傾き・張り出し・肉厚のどれが変わっても破綻しない。
                    //         潰れた部分は傘の肉の中に埋まるので外からは見えない
                    if (clampTop) {
                        const rq = Math.hypot(vx, vz);
                        const lim = this.capTopYAt(rq, Math.atan2(vz, vx)) - this.R * 0.04;
                        if (vy > lim) vy = lim;
                    }
                    ring.push(new V3(vx, vy, vz));
                }
                rings.push(ring); centers.push(C);
            }
            const mesh = sweep("shiitakeStem", rings, centers, null, this.scene);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.parts.push(mesh);
        }

        // ---- 当たり判定 -----------------------------------------------
        // 【対策】キノコは凸ではない。全体を1つの凸包にすると傘の下の
        //         空洞まで詰まってしまい、他の個体の柄が傘の下に潜り込めず
        //         「盛った」感じが出ない。傘と柄の2つに分けた複合形状にする
        hullShape() {
            const capHull = this._capHull();
            let shape = null;
            try {
                const box = new BABYLON.PhysicsShapeContainer(this.scene);
                box.addChild(capHull);
                const a = this.stemCenterAt(0.02), b = this.stemCenterAt(0.98);
                const cyl = new BABYLON.PhysicsShapeCylinder(a, b, this.stemR * 1.05, this.scene);
                box.addChild(cyl);
                // 【対策】コンテナを dispose しても子シェイプは解放されない。
                //         作り直しのたびにネイティブ側へ積み上がるので持っておく
                box._childShapes = [capHull, cyl];
                shape = box;
            } catch (err) {
                // PhysicsShapeContainer が使えない環境では傘だけで代用する
                console.warn("[Shiitake] 複合形状を作れませんでした。傘のみの凸包にします。", err);
                shape = capHull;
            }
            return shape;
        }
        _capHull() {
            const N = 16, M = 24;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                // 【対策】下面まで含めると凸包が「傘の下も詰まった円盤」に
                //         なるのは同じだが、縁の巻き込みまでで打ち切れば
                //         少なくとも高さは実物どおりになる
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
            const proxy = sweep("shiitakeProxy", rings, centers, null, this.scene);
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
        cfg.profile = blendProfile(cfg.fleshy);
        cfg.total = Math.max(1, Math.round(cfg.count * cfg.countScale));
        if (cfg.total > 6) { cfg.capSegmentsAxis = 72; cfg.capSegmentsRound = 88; }
        if (cfg.total > 10) { cfg.capSegmentsAxis = 56; cfg.capSegmentsRound = 72; cfg.gillSegments = 11; }
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
        console.warn("[Shiitake] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.70;
    scene.environmentIntensity = 0.78;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.10, 50, new V3(0, 2.4, 0), scene);
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
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.985, 0.955);
    key.specular = new BABYLON.Color3(0.55, 0.53, 0.50);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.30, -0.55).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(1.0, 0.97, 0.94);
    fillL.specular = new BABYLON.Color3(0.16, 0.15, 0.14);

    // 【対策】ひだは傘の下の暗がりに入る。下からの弱い返しが無いと
    //         裏返った個体のひだが真っ黒に潰れて、ただの黒い穴になる
    const bounce = new BABYLON.DirectionalLight("bounce", new V3(0.1, 1.0, 0.2).normalize(), scene);
    bounce.intensity = 0.40;
    bounce.diffuse = new BABYLON.Color3(0.98, 0.95, 0.90);
    bounce.specular = new BABYLON.Color3(0, 0, 0);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.46;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.78, 0.74, 0.70);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 36;
    sg.depthScale = 40;
    sg.darkness = 0.44;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.12;
    ip.contrast = 1.08;
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
            // 【対策】物理で動かすノードは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            // 【対策】キノコは扁平なので、伏せるか仰向けるかの2択に落ち着く。
            //         全部を正立で放すと傘が上ばかり向いて、ひだが見えない
            //         盛り付けになる。3本に1本は最初から仰向けで放す
            const flip = (i % 3 === 1) ? Math.PI : 0;
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                flip + rng.gauss(0, 0.55), rng.range(0, TAU), rng.gauss(0, 0.55));
            const r = GLOBAL.basketRim * 0.42 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            const cols = Math.ceil(Math.sqrt(items.length));
            for (let i = 0; i < items.length; i++) {
                const e = items[i], d = e.R * 2.30;
                e.root.rotationQuaternion = BABYLON.Quaternion.Identity();
                e.root.position.set(
                    ((i % cols) - (cols - 1) / 2) * d,
                    GLOBAL.basketThick + e.stemL * 0.5,
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
            items.push(new Shiitake(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.45, 0);
        camera.radius = cfg.basketRim * 3.2;

        resetDrop(seed);
        console.log("[Shiitake]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.total, "個");
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
        // 【対策】ひだの隙間と、傘どうしの重なりに影が入らないと
        //         全部が同じ平面に貼りついて見える
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 0.75;
        ssao.totalStrength = 1.05;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 200;
        ssao.minZAspect = 0.24;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.95;
    dp.bloomWeight = 0.05;
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
        idle: "#2a1d12", active: "#8a5a2b", edge: "#4a382a",
        text: "#f6ece0", sub: "#c3a887", accent: "#e0a866"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "252px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(20,13,8,0.82)";
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

    addLabel("SHIITAKE", 11, COL.sub, "18px");
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
        const gillTotal = curCfg.gills * Math.pow(2, curCfg.gillTiers);
        info.text = state + " / " + items.length + "個 / 傘径 " + (e.R * 2).toFixed(1)
            + "cm 高 " + (e.H).toFixed(1) + "cm\n"
            + "ひだ" + gillTotal + "枚  seed: " + curSeed;
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
    toggleBtn.background = "rgba(20,13,8,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(20,13,8,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;