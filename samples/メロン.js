// =====================================================================
//  Photoreal Muskmelon  /  写実的なマスクメロン
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（アールス / 夕張キング / アンデス）
//    1. Rng
//    2. Noise       … 勾配ノイズ（LUT・u方向周期）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 果実の断面（超楕円）・浅い縦溝
//    5. CrackNet    … ★ 網目の生成（逐次的な亀裂の伝播）
//    6. TextureLab  … 果皮のアルベド / ORM / 法線、板の間、背景
//    7. Melon       … 果実 + T字の果梗
//    8. Scene
//    9. GUI
//
//  ★ 網目についての最重要事項:
//    メロンの網目は「ボロノイ図」ではない。
//    ボロノイの辺は3本が 120°で集まる Y字接合になるが、実物の網目は
//    T字接合が支配的である。理由は生成過程にある。
//      果肉が果皮より速く肥大する → 皮が裂ける → 裂け目がコルク化して
//      盛り上がる → まだ肥大が続くので、その間をまた裂ける …
//    という「逐次的な亀裂」なので、後から入った亀裂は先にある亀裂に
//    ぶつかったところで止まる（直交して終わる = T字）。
//    ボロノイを多層に重ねて max() を取っても、この構造は絶対に出ない。
//    ここでは亀裂を実際に伝播させ、既存の亀裂に当たったら止める。
//
//    参考: 山梨大学「メロンの網目模様に潜む科学法則」
//          https://www.yamanashi.ac.jp/39744
// =====================================================================

const createScene = function () {

    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        earls: {
            label: "アールス（青肉）",
            radius: 7.2,            // 赤道半径 → 直径 14.4cm
            elong: 1.055,
            expTop: 2.10, expBot: 2.06,
            topScale: 1.02, botScale: 0.99,
            dipStem: 0.055, dipBlossom: 0.030,
            taper: 0.030,
            ribs: 10, ribAmp: 0.0070, lump: 0.009, asym: 0.008,

            // 網目
            // 【対策】実物のアールスメロンは「クリーム色の地に緑の溝」に
            //         見える。網の被覆率は 7割前後で、緑のほうが少数派。
            //         被覆率が4割を切ると図と地が逆転し、「緑の球に白い線を
            //         描いたもの」になってメロンに見えない
            netMinCell: 5.6,        // 亀裂どうしの最小間隔（占有格子の単位）
            netWidth: 3.20,         // 第1世代の幅 → 畝 1.4mm / 細胞 4.6mm / 被覆 52%
            netFade: 0.84,          // 世代ごとの幅の減衰（強いほど階層がはっきりする）
            netCurl: 1.30,          // 初期方向からの振れ幅（rad）
            relief: 0.011,          // メッシュを持ち上げる量（半径比）

            // 色（sRGB）
            // 【対策】実物は「淡くて低コントラストな暖色の物体」。
            //         濃い緑に白い網、では絵の具のように見える。
            //         写真から採寸: コルク 222,210,185 / 溝の緑 145,168,140
            skinLo: [0.500, 0.585, 0.478],   // 溝の緑（暗い側）
            skinHi: [0.625, 0.700, 0.585],   // 溝の緑（明るい側）
            netLo: [0.700, 0.655, 0.545],   // 網の陰
            netHi: [0.855, 0.808, 0.700],   // 網の明部（白ではなく暖かいベージュ）
            netFoot: [0.600, 0.655, 0.530],   // 網の裾に残る緑
            scar: [0.740, 0.685, 0.535],
            stemCol: [0.545, 0.640, 0.330], stemCut: [0.735, 0.715, 0.545],

            skinRough: 0.46, netRough: 0.88, wax: 1.00
        },
        yubari: {
            label: "夕張キング（赤肉）",
            radius: 7.6, elong: 1.015,
            expTop: 2.06, expBot: 2.04,
            topScale: 1.01, botScale: 1.00,
            dipStem: 0.050, dipBlossom: 0.028,
            taper: 0.018,
            ribs: 12, ribAmp: 0.0090, lump: 0.008, asym: 0.007,
            // 網はやや粗く、高く盛り上がる
            netMinCell: 6.2, netWidth: 3.80, netFade: 0.85, netCurl: 1.10,
            relief: 0.013,
            skinLo: [0.515, 0.570, 0.415],
            skinHi: [0.640, 0.690, 0.520],
            netLo: [0.715, 0.660, 0.535],
            netHi: [0.870, 0.818, 0.690],
            netFoot: [0.590, 0.590, 0.395],
            scar: [0.740, 0.670, 0.490],
            stemCol: [0.555, 0.648, 0.336], stemCut: [0.740, 0.720, 0.550],
            skinRough: 0.44, netRough: 0.90, wax: 1.05
        },
        andes: {
            label: "アンデス（青肉）",
            radius: 6.8, elong: 1.075,
            expTop: 2.14, expBot: 2.08,
            topScale: 1.03, botScale: 0.98,
            dipStem: 0.058, dipBlossom: 0.032,
            taper: 0.038,
            ribs: 10, ribAmp: 0.0060, lump: 0.010, asym: 0.009,
            // 網が細かく、線が細い
            netMinCell: 4.8, netWidth: 2.40, netFade: 0.83, netCurl: 1.45,
            relief: 0.009,
            skinLo: [0.485, 0.575, 0.470],
            skinHi: [0.610, 0.695, 0.575],
            netLo: [0.685, 0.648, 0.548],
            netHi: [0.840, 0.800, 0.700],
            netFoot: [0.520, 0.575, 0.410],
            scar: [0.705, 0.645, 0.490],
            stemCol: [0.532, 0.628, 0.322], stemCut: [0.728, 0.708, 0.538],
            skinRough: 0.48, netRough: 0.87, wax: 0.95
        }
    };

    const GLOBAL = {
        count: 1,

        // 果実メッシュ。網目の起伏をシルエットに出すので細かめ
        segmentsAxis: 288,
        segmentsRound: 384,
        stemSegments: 16, stemSides: 14,
        vineSegments: 40, vineSides: 14,

        textureSize: 2048,          // 高さは半分（円筒UVでは v は周長の半分）
        netGridW: 1024,             // 亀裂の占有格子
        reliefBlur: 3,              // シルエット用に高さ場を鈍らせる半径

        dipWStem: 0.055, dipWBlossom: 0.045,

        matW: 34, matD: 26, matH: 0.9,
        tableW: 220, tableD: 160, tableH: 6,

        useSSAO: true, useDOF: true,
        dofRatio: 0.072, dofFStop: 2.4,

        compactWidth: 700, compactMinSide: 480, guiMaxScale: 2.2
    };

    const START_VARIETY = "earls";
    const START_SEED = 20260801;
    const BUILD = "muskmelon-A";

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        cfg.total = Math.max(1, cfg.count);
        const vw = (typeof window !== "undefined" && window.innerWidth) || 1024;
        if (vw < GLOBAL.compactWidth) {
            cfg.textureSize = 1024; cfg.netGridW = 512;
            cfg.segmentsAxis = 192; cfg.segmentsRound = 256;
        }
        if (cfg.total > 1) { cfg.segmentsAxis = 208; cfg.segmentsRound = 272; }
        return cfg;
    }

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
    // 2. Noise （勾配ノイズ・u方向のみ周期）
    // =================================================================
    // 【対策】勾配を角度で持つと格子点4隅ごとに cos/sin を呼ぶ。単位ベクトルを
    //         256本の表に焼いて、ハッシュの下位8ビットで引くだけにする
    const GRAD_N = 256;
    const GRAD_X = new Float32Array(GRAD_N), GRAD_Y = new Float32Array(GRAD_N);
    for (let gi = 0; gi < GRAD_N; gi++) {
        const ga = (gi + 0.5) * (TAU / GRAD_N);
        GRAD_X[gi] = Math.cos(ga); GRAD_Y[gi] = Math.sin(ga);
    }

    const Noise = {
        _h2(x, y, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
            return (h >>> 0) / 4294967295;
        },
        _gi(x, y, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
                ^ Math.imul(seed | 0, 2246822519);
            h = Math.imul(h ^ (h >>> 15), 2654435761); h ^= h >>> 13;
            h = Math.imul(h, 668265263); h ^= h >>> 16;
            return h & 255;
        },
        // 【対策】補間は smoothstep ではなく quintic。smoothstep は2階微分が
        //         格子で不連続なので、法線に起こすと格子の筋が見える
        p2u(x, y, px, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
            const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
            const p = Math.max(1, px | 0);
            let x0 = xi % p; if (x0 < 0) x0 += p;
            let x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
            const i00 = this._gi(x0, yi, seed), i10 = this._gi(x1, yi, seed);
            const i01 = this._gi(x0, yi + 1, seed), i11 = this._gi(x1, yi + 1, seed);
            const n00 = GRAD_X[i00] * xf + GRAD_Y[i00] * yf;
            const n10 = GRAD_X[i10] * (xf - 1) + GRAD_Y[i10] * yf;
            const n01 = GRAD_X[i01] * xf + GRAD_Y[i01] * (yf - 1);
            const n11 = GRAD_X[i11] * (xf - 1) + GRAD_Y[i11] * (yf - 1);
            const a = n00 + (n10 - n00) * u, b = n01 + (n11 - n01) * u;
            return 0.5 + (a + (b - a) * v) * 0.72;
        },
        fbmp(x, y, period, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * (this.p2u(x * f, y * f, (period * f) | 0, seed + o * 131) - 0.5);
                n += a; f *= 2; a *= 0.5;
            }
            return 0.5 + s / n * 0.95;
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
        //         不透明なのに透過パスへ回されて深度書き込みが切られる
        mesh.hasVertexAlpha = false;
        return mesh;
    }

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
        for (let j = 0; j < M - 1; j++) indices.push(capA, j, j + 1);
        const o = (N - 1) * M;
        for (let j = 0; j < M - 1; j++) indices.push(capB, o + j + 1, o + j);
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 5. CrackNet ★ 網目の生成
    // =================================================================
    // 世代を追って亀裂を伸ばす。第1世代は自由に伸びる長い亀裂、第2世代
    // 以降は「既存の亀裂の上から直交方向へ」出て、別の亀裂に当たったら
    // 止まる。これで T字接合と行き止まりが自然に生まれる。
    class CrackNet {
        constructor(cfg, seed) {
            const W = this.W = cfg.netGridW;
            const H = this.H = W >> 1;
            this.cfg = cfg;
            this.rng = new Rng(seed);
            this.occ = new Int32Array(W * H).fill(-1);
            this.paths = [];
            this.nseed = (seed ^ 0x5bf03635) >>> 0;

            // 世代ごとの幅（第1世代がいちばん太く高い）
            const G = 6;
            this.G = G;
            this.width = new Float32Array(G);
            const sc = W / 1024;
            for (let g = 0; g < G; g++) this.width[g] = cfg.netWidth * sc * Math.pow(cfg.netFade, g);
            this.maxLen = [300, 150, 100, 72, 56, 46].map(v => v * sc);
            this.seeds = [150, 1600, 3200, 5000, 6500, 8000];
            this.minCell = cfg.netMinCell * sc;
            this.step = 1.1 * sc;
            this.NP = 40;
            this.NF = this.NP / W;

            this._build();
        }

        sinv(y) { return Math.max(0.17, Math.sin(Math.PI * (y + 0.5) / this.H)); }
        idx(x, y) {
            let xi = Math.round(x) % this.W; if (xi < 0) xi += this.W;
            const yi = clamp(Math.round(y), 0, this.H - 1);
            return yi * this.W + xi;
        }
        hit(x, y, id) { const o = this.occ[this.idx(x, y)]; return o !== -1 && o !== id; }

        // 【対策】占有格子は「実寸で等方」にしたい。円筒UVでは極ほど u が
        //         詰まるので、x 方向の半径を 1/sin(πv) で広げる
        mark(x, y, r, id) {
            const W = this.W, H = this.H;
            const sv = this.sinv(y);
            const rx = Math.max(1, r / sv), ry = Math.max(1, r);
            const cy = Math.round(y), cx = Math.round(x);
            const cry = Math.ceil(ry), crx = Math.ceil(rx);
            for (let dy = -cry; dy <= cry; dy++) {
                const yy = cy + dy; if (yy < 0 || yy >= H) continue;
                const ty = (dy / ry) * (dy / ry);
                for (let dx = -crx; dx <= crx; dx++) {
                    if ((dx / rx) * (dx / rx) + ty > 1) continue;
                    let xx = (cx + dx) % W; if (xx < 0) xx += W;
                    this.occ[yy * W + xx] = id;
                }
            }
        }

        grow(x, y, a0, id, maxLen, markR) {
            const path = [x, y];
            let len = 0, a = a0;
            // 【対策】第2世代以降は既存の亀裂の「上」から生やすので、1歩目で
            //         親に当たって即死する。親から抜け出すまで判定を止める
            const skip = markR * 2.5 + 1.5;
            for (let n = 0; n < 4000; n++) {
                // 【対策】角度に毎歩ノイズを「加算」すると方向がランダム
                //         ウォークして渦を巻き、毛糸玉になる。実際の亀裂は
                //         ほぼ直進する。初期方向からの「オフセット」として
                //         与えれば、ゆるく蛇行しつつ直進する
                a = a0 + (Noise.p2u(x * this.NF, y * this.NF, this.NP, this.nseed) - 0.5) * this.cfg.netCurl;
                const sv = this.sinv(y);
                const nx = x + Math.cos(a) * this.step / sv;
                const ny = y + Math.sin(a) * this.step;
                if (ny < 1 || ny > this.H - 2) break;
                if (len > skip && this.hit(nx, ny, id)) { path.push(nx, ny); break; }
                // 【対策】亀裂が既存の亀裂と並走すると二重線になり、網目が
                //         毛羽立って被覆率が跳ね上がる。真横に既存の亀裂が
                //         ある＝もう応力が解放されているので、そこで止める
                if (len > skip) {
                    const sp = this.minCell * 0.46, s2 = this.sinv(ny);
                    const px = Math.cos(a + Math.PI / 2) * sp / s2, py = Math.sin(a + Math.PI / 2) * sp;
                    if (this.hit(nx + px, ny + py, id) || this.hit(nx - px, ny - py, id)) {
                        path.push(nx, ny); break;
                    }
                }
                x = nx; y = ny; len += this.step;
                path.push(x, y);
                if (len > maxLen) break;
            }
            path.len = len;
            return path;
        }
        markPath(p, r, id) {
            for (let i = 0; i + 1 < p.length; i += 2) this.mark(p[i], p[i + 1], r, id);
        }

        _build() {
            const rng = this.rng, H = this.H, W = this.W;
            let id = 0;
            // 【対策】第2世代以降の種を「既存の亀裂から適当な1点」で選ぶと、
            //         短い亀裂では選べる点が1つしかなく、同じ場所から
            //         何十本も生えて霜の結晶のような星形になる。
            //         全亀裂の点を候補リストに積み、引いたら捨てる
            let cand = [];
            const rebuildCand = () => {
                cand.length = 0;
                for (let i = 0; i < this.paths.length; i++) {
                    const a = this.paths[i].p, n = (a.length / 2) | 0;
                    if (n < 6) continue;              // 短すぎる亀裂からは生やさない
                    for (let k = 2; k <= 2 * (n - 2); k += 4) cand.push(i, k);
                }
            };
            for (let g = 0; g < this.G; g++) {
                if (g > 0) rebuildCand();
                const mr = Math.max(1.1, this.width[g] * 0.55);
                for (let s = 0; s < this.seeds[g]; s++) {
                    if (g === 0) {
                        const x = rng.range(0, W), y = rng.range(H * 0.02, H * 0.98);
                        if (this.occ[this.idx(x, y)] !== -1) continue;
                        const a = rng.range(0, TAU), idA = id++;
                        const p1 = this.grow(x, y, a, idA, this.maxLen[g], mr);
                        const p2 = this.grow(x, y, a + Math.PI, idA, this.maxLen[g], mr);
                        // 【対策】最短長を細胞の大きさだけで決めると、畝が
                        //         太い世代では「長さ5・幅3」のような、線ではなく
                        //         塊の亀裂が残る。白い短い棒が積み重なって見える
                        //         のはこれが原因。幅にも連動させる
                        if (p1.len + p2.len < Math.max(this.minCell * 1.6, this.width[g] * 4.4)) continue;
                        this.markPath(p1, mr, idA); this.markPath(p2, mr, idA);
                        this.paths.push({ g, p: p1 }); this.paths.push({ g, p: p2 });
                    } else {
                        // 既存の亀裂の上から、直交方向へ1本だけ伸ばす → T字接合
                        if (cand.length === 0) break;
                        // 【対策】候補を完全にランダムに引くと、広く空いた領域が
                        //         埋まり残って細胞の大きさがばらつく。実物の網は
                        //         どこも均一。3本引いて「前方の空きがいちばん
                        //         大きいもの」を採ると、大きな細胞から先に割れて
                        //         大きさが揃う（＝応力の高いところから裂ける）
                        let bx = 0, by = 0, ba = 0, bci = -1, bfree = -1;
                        const tries = Math.min(3, cand.length >> 1);
                        for (let tI = 0; tI < tries; tI++) {
                            const ci2 = (rng.int(cand.length >> 1)) << 1;
                            const pi2 = cand[ci2], k2 = cand[ci2 + 1];
                            const ar2 = this.paths[pi2].p;
                            const x2 = ar2[k2], y2 = ar2[k2 + 1];
                            const ta2 = Math.atan2(ar2[k2 + 1] - ar2[k2 - 1], ar2[k2] - ar2[k2 - 2]);
                            const a2 = ta2 + (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.5, 0.5);
                            const sv2 = this.sinv(y2);
                            const ca = Math.cos(a2) / sv2, sa = Math.sin(a2);
                            let free = 0;
                            for (let d2 = this.minCell * 0.5; d2 <= this.minCell * 3.2; d2 += this.minCell * 0.5) {
                                if (this.hit(x2 + ca * d2, y2 + sa * d2, -2)) break;
                                free = d2;
                            }
                            if (free > bfree) { bfree = free; bci = ci2; bx = x2; by = y2; ba = a2; }
                        }
                        // 伸びる先に細胞1つぶんの空きも無いなら、その亀裂は発生しない
                        if (bci < 0 || bfree < this.minCell) continue;
                        cand[bci] = cand[cand.length - 2]; cand[bci + 1] = cand[cand.length - 1];
                        cand.length -= 2;
                        const x = bx, y = by, a = ba;
                        const idB = id++;
                        const pp = this.grow(x, y, a, idB, this.maxLen[g], mr);
                        // 【対策】どこにも到達できなかった亀裂は描かない。これが
                        //         無いと、幹線から直角に飛び出した数mmのトゲが
                        //         無数に残り、実物に無い毛羽立ちになる
                        if (pp.len < Math.max(this.minCell * 0.9, this.width[g] * 3.0)) continue;
                        this.markPath(pp, mr, idB);
                        this.paths.push({ g, p: pp });
                    }
                }
            }
            this.occ = null;   // 以降は使わない
        }

        // 高さ場へ焼き込む（TW x TH）
        rasterize(TW, TH) {
            const Hf = new Float32Array(TW * TH);
            const SC = TW / this.W;
            const stamp = (x, y, r, h) => {
                const sv = Math.max(0.17, Math.sin(Math.PI * (y + 0.5) / TH));
                const rx = Math.max(0.8, r / sv), ry = Math.max(0.8, r);
                const cy = Math.round(y), cx = Math.round(x);
                const cry = Math.ceil(ry), crx = Math.ceil(rx);
                for (let dy = -cry; dy <= cry; dy++) {
                    const yy = cy + dy; if (yy < 0 || yy >= TH) continue;
                    const ty = (dy / ry) * (dy / ry);
                    for (let dx = -crx; dx <= crx; dx++) {
                        const t = (dx / rx) * (dx / rx) + ty; if (t > 1) continue;
                        let xx = (cx + dx) % TW; if (xx < 0) xx += TW;
                        // 断面は半円。コルクの畝は角ではなく丸い
                        // 【対策】断面を半円にすると裾がだらだら広がって
                        //         線が太く見える。頂上を平らに、裾を急にする
                        const v = h * Math.pow(1 - t, 0.40);
                        const i = yy * TW + xx; if (v > Hf[i]) Hf[i] = v;
                    }
                }
            };
            for (const { g, p } of this.paths) {
                const r = this.width[g] * SC * 0.5;
                const h = 0.58 + 0.42 * (1 - g / (this.G - 1));
                for (let i = 0; i + 3 < p.length; i += 2) {
                    const x0 = p[i] * SC, y0 = p[i + 1] * SC;
                    let dx = p[i + 2] * SC - x0;
                    if (dx > TW / 2) dx -= TW; if (dx < -TW / 2) dx += TW;
                    const dy = p[i + 3] * SC - y0;
                    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
                    for (let k = 0; k <= n; k++) stamp(x0 + dx * k / n, y0 + dy * k / n, r, h);
                }
            }
            return Hf;
        }
    }

    // 【対策】シルエットに出す起伏には、法線マップと同じ高さ場を
    //         そのまま使ってはいけない。メッシュの分割数では畝を
    //         解像できず、ぎざぎざのノイズになる。鈍らせてから使う
    function boxBlurWrapX(src, W, H, r) {
        const tmp = new Float32Array(W * H), dst = new Float32Array(W * H);
        const inv = 1 / (2 * r + 1);
        for (let y = 0; y < H; y++) {
            const o = y * W;
            let acc = 0;
            for (let k = -r; k <= r; k++) { let xx = k % W; if (xx < 0) xx += W; acc += src[o + xx]; }
            for (let x = 0; x < W; x++) {
                tmp[o + x] = acc * inv;
                let xo = (x - r) % W; if (xo < 0) xo += W;
                let xi = (x + r + 1) % W; if (xi < 0) xi += W;
                acc += src[o + xi] - src[o + xo];
            }
        }
        for (let x = 0; x < W; x++) {
            let acc = 0;
            for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, H - 1) * W + x];
            for (let y = 0; y < H; y++) {
                dst[y * W + x] = acc * inv;
                acc += tmp[clamp(y + r + 1, 0, H - 1) * W + x] - tmp[clamp(y - r, 0, H - 1) * W + x];
            }
        }
        return dst;
    }

    // =================================================================
    // 6. TextureLab
    // =================================================================
    const TextureLab = {
        _make(name, w, h, scene, clampV) {
            const dt = new BABYLON.DynamicTexture(name, { width: w, height: h }, scene, true);
            dt.hasAlpha = false;
            dt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.wrapV = clampV ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },
        _tex(name, w, h, fill, scene, clampV) {
            const dt = this._make(name, w, h, scene, clampV);
            const ctx = dt.getContext();
            const img = ctx.createImageData(w, h);
            fill(img.data, w, h);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            return dt;
        },

        // 果皮。網目の高さ場からアルベド / ORM / 法線を焼く
        rind(scene, cfg, net) {
            const SW = cfg.textureSize, SH = SW >> 1;
            const sd = cfg.texSeed;
            const t0 = (typeof performance !== "undefined") ? performance.now() : Date.now();

            const netH = net.rasterize(SW, SH);
            // 【対策】AO を「網の無い所ぜんぶ」に掛けると、地肌が一様に
            //         沈んで網だけが白く浮き、糸を巻いた球になる。
            //         周囲に網があるのに自分は網でない＝谷、という差分を使う
            const netB = boxBlurWrapX(netH, SW, SH, Math.max(1, GLOBAL.reliefBlur));
            // 【対策】ぼかした高さ場をそのまま変位に使うと、網の密度の
            //         大きなむらがそのまま「果実のへこみ」になる。
            //         さらに広くぼかしたものを引いて、局所の畝だけ残す
            const netL = boxBlurWrapX(netB, SW, SH, 26);
            // 【対策】幅 3.6 テクセルの急峻な畝は、縮小時のミップ混合で
            //         傾きが消える。アルベドは鋭いまま、陰影用の高さだけ
            //         裾を広げてやると、なだらかな勾配がミップを生き延びる
            const netS = boxBlurWrapX(netH, SW, SH, 2);

            const texA = this._make("melonAlbedo", SW, SH, scene, true);
            const texO = this._make("melonORM", SW, SH, scene, true);
            const ctxA = texA.getContext(), ctxO = texO.getContext();
            const imgA = ctxA.createImageData(SW, SH), imgO = ctxO.createImageData(SW, SH);
            const A = imgA.data, O = imgO.data;
            const Hh = new Float32Array(SW * SH);

            const SL = cfg.skinLo, SH2 = cfg.skinHi;
            const NL = cfg.netLo, NH = cfg.netHi, NF = cfg.netFoot, SC = cfg.scar;

            for (let y = 0; y < SH; y++) {
                const v = (y + 0.5) / SH;
                const poleFade = smooth(0.0, 0.05, v) * (1 - smooth(0.95, 1.0, v));
                for (let x = 0; x < SW; x++) {
                    const u = (x + 0.5) / SW;
                    const i = y * SW + x, o = i * 4;

                    const nh = netH[i];
                    // 【対策】高さの閾値を高く取ると、細い世代の亀裂が
                    //         ほとんど色に出ず、網が「まばらな糸」になる
                    const nt = smooth(0.06, 0.26, nh);        // 網の被覆
                    const crest = smooth(0.45, 0.95, nh);     // 畝の頂上

                    // ---- 地肌 -------------------------------------
                    // 【対策】地肌を一色にすると石膏の球になる。実物は
                    //         淡い青緑で、大きなむらと細かい斑がある
                    // 【対策】地肌を一様な淡緑にすると陶器の球になる。実物は
                    //         大きなむらと細かい斑が重なって、場所ごとに
                    //         濃さが違う
                    const mo = Noise.fbmp(u * 7, v * 4, 7, sd + 61, 3);
                    const blot = Noise.fbmp(u * 22, v * 11, 22, sd + 67, 2);
                    const fine = Noise.p2u(u * 90, v * 45, 90, sd + 71);
                    let sm = clamp(smooth(0.30, 0.72, mo) * 0.58
                        + smooth(0.36, 0.66, blot) * 0.28 + fine * 0.14, 0, 1);
                    let cr = mix(SL[0], SH2[0], sm);
                    let cg = mix(SL[1], SH2[1], sm);
                    let cb = mix(SL[2], SH2[2], sm);

                    // ---- 網（コルク）------------------------------
                    // 【対策】網を単色のクリームで塗ると発泡スチロールになる。
                    //         コルク層は粒が粗く、汚れが乗り、頂上だけ白い
                    // 【対策】閾値やバンプに使う場の最上位オクターブは
                    //         10テクセル程度が下限。300周期を2オクターブ
                    //         （=600周期, 3.4テクセル）にすると折り返す
                    // 【対策】コルクのざらつきを高さに強く入れると、細い畝が
                    //         フェルトのように毛羽立つ。色には効かせ、高さは弱く
                    const cork = Noise.fbmp(u * 60, v * 30, 60, sd + 151, 3);
                    const dirt = Noise.fbmp(u * 40, v * 20, 40, sd + 173, 2);
                    let nr2 = mix(NL[0], NH[0], smooth(0.35, 0.70, cork));
                    let ng = mix(NL[1], NH[1], smooth(0.35, 0.70, cork));
                    let nb = mix(NL[2], NH[2], smooth(0.35, 0.70, cork));
                    // 【対策】コルクの汚れを 0.22 も効かせると、網が
                    //         まだらに黒ずんでコントラストが上がりすぎる
                    const dk = smooth(0.42, 0.78, dirt) * 0.13;
                    nr2 *= 1 - dk; ng *= 1 - dk * 0.95; nb *= 1 - dk * 0.85;
                    const cw = crest * 0.28;
                    nr2 = mix(nr2, NH[0] * 1.02, cw); ng = mix(ng, NH[1] * 1.02, cw); nb = mix(nb, NH[2] * 1.02, cw);

                    cr = mix(cr, nr2, nt); cg = mix(cg, ng, nt); cb = mix(cb, nb, nt);

                    // 【対策】網の裾には緑が残る。ここを塗らないと、網が
                    //         皮の上に糸を貼ったように浮いて見える
                    const foot = nt * (1 - crest) * 0.32;
                    cr = mix(cr, NF[0], foot * 0.45); cg = mix(cg, NF[1], foot * 0.45); cb = mix(cb, NF[2], foot * 0.45);

                    // ---- 果梗痕 / 花落ち痕 -------------------------
                    const scarPad = 1 - smooth(0.012, 0.036, v);
                    const sb = smooth(0.984, 1.0, v);
                    const wr = (scarPad > 0.001 || sb > 0.001)
                        ? Noise.p2u(u * 60, v * 80, 60, sd + 167) : 0.5;
                    const sk2 = Math.max(scarPad, sb);
                    cr = mix(cr, SC[0], sk2 * 0.88); cg = mix(cg, SC[1], sk2 * 0.88); cb = mix(cb, SC[2], sk2 * 0.88);
                    const wk = sk2 * (wr - 0.5) * 0.26;
                    cr = clamp(cr + wk, 0, 1); cg = clamp(cg + wk, 0, 1); cb = clamp(cb + wk, 0, 1);

                    // ---- 高さ -------------------------------------
                    const hr = Math.max(nh, Math.min(1, netS[i] * 1.45));
                    let hh = 0.10 + 0.86 * hr
                        + 0.07 * (cork - 0.5) * nt * poleFade      // コルクのざらつき
                        + 0.025 * (fine - 0.5) * (1 - nt) * poleFade // 地肌の微細な肌理
                        + 0.20 * (wr - 0.5) * sk2;
                    hh = clamp(hh, 0, 1);
                    Hh[i] = hh;

                    const shade = 0.93 + 0.12 * hh;
                    A[o] = clamp(cr * shade, 0, 1) * 255;
                    A[o + 1] = clamp(cg * shade, 0, 1) * 255;
                    A[o + 2] = clamp(cb * shade, 0, 1) * 255;
                    A[o + 3] = 255;

                    // ---- 粗さ / AO ---------------------------------
                    // 【対策】コルクの網と蝋質の地肌は、色より艶の差で
                    //         見分けている。ここを一定にすると全部が
                    //         同じ材質のレリーフに見える
                    let rough = mix(cfg.skinRough, cfg.netRough, nt);
                    rough = mix(rough, cfg.netRough * 1.05, crest * 0.4);
                    rough += (cork - 0.5) * 0.10 * nt;
                    rough = mix(rough, 0.80, sk2);
                    // 畝の脇の谷だけ影になる
                    let ao = 1 - 0.55 * clamp(netB[i] - nh, 0, 1);
                    ao = mix(ao, 0.72, scarPad);
                    O[o] = clamp(ao, 0, 1) * 255;
                    O[o + 1] = clamp(rough, 0.05, 1) * 255;
                    O[o + 2] = 0; O[o + 3] = 255;
                }
            }
            ctxA.putImageData(imgA, 0, 0); texA.update(false);
            ctxO.putImageData(imgO, 0, 0); texO.update(false);
            // 【対策】畝は幅 3.6 テクセルしかない。強度 1.35 では、縮小時の
            //         ミップ混合でほぼ平らになる。倍以上に振る必要がある
            const texN = this.normal(scene, SW, SH, Hh, 2.2);

            const relief = new Float32Array(SW * SH);
            for (let i = 0; i < relief.length; i++) relief[i] = netB[i] - netL[i];

            const t1 = (typeof performance !== "undefined") ? performance.now() : Date.now();
            console.log("[Melon] 網目 " + net.paths.length + " 本 / テクスチャ "
                + SW + "x" + SH + " を " + Math.round(t1 - t0) + "ms で生成");
            return { albedo: texA, orm: texO, normal: texN, relief, RW: SW, RH: SH };
        },

        normal(scene, w, h, hf, strength) {
            return this._tex("melonNormal", w, h, (d, N, M) => {
                for (let y = 0; y < M; y++) {
                    const vv = y / M;
                    const k = strength * smooth(0, 0.04, vv) * (1 - smooth(0.96, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(M - 1, y + 1) * N + x];
                        // 【対策】v 方向の符号は (yu - yd) = -dh/dv、つまり
                        //         「V が上を向く」OpenGL 系の規約になる。
                        //         Babylon の接空間は V が下向きなので、そのままだと
                        //         畝が溝に見える（白クレイ表示で実機確認済み）。
                        //         マテリアルの invertNormalMapY で打ち消すのではなく、
                        //         焼く側で符号を合わせておく
                        let nx = (xl - xr) * k, ny = (yd - yu) * k;
                        const l = Math.sqrt(nx * nx + ny * ny + 1);
                        const i = (y * N + x) * 4;
                        d[i] = (nx / l * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
                        d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
                        // 【対策】Babylon の視差マッピングは、法線マップの
                        //         アルファを高さとして読む（1 が手前＝畝の頂上）。
                        //         法線の傾きだけでは、縮小時にミップで鈍って
                        //         「彫り込んだ線」に見えてしまう
                        d[i + 3] = clamp(hf[y * N + x], 0, 1) * 255;
                    }
                }
            }, scene, true);
        },

        wood(scene, size, seed) {
            const A = [0.300, 0.185, 0.108], B = [0.190, 0.108, 0.060], C = [0.365, 0.240, 0.148];
            return this._tex("tableAlbedo", size, size, (d, N) => {
                const PL = 4;
                for (let y = 0; y < N; y++) {
                    const v = y / N, pv = v * PL, pi = Math.floor(pv), pf = pv - pi;
                    const off = Noise._h2(pi, 5, seed) * 60;
                    const tone = 0.90 + 0.18 * Noise._h2(pi, 9, seed);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const w = Noise.fbmp(u * 3, v * 22 + off, 3, seed + 1, 4);
                        let g = 0.5 + 0.5 * Math.sin(v * 86 + off + w * 8.0);
                        g = Math.pow(g, 1.9);
                        const fib = 0.90 + 0.20 * Noise.fbmp(u * 150, v * 26, 150, seed + 3, 2);
                        let r = mix(A[0], B[0], g), gg = mix(A[1], B[1], g), b = mix(A[2], B[2], g);
                        const hi = Math.pow(1 - g, 3.0) * 0.35;
                        r = mix(r, C[0], hi); gg = mix(gg, C[1], hi); b = mix(b, C[2], hi);
                        r *= tone * fib; gg *= tone * fib; b *= tone * fib;
                        const seam = 1 - smooth(0, 0.010, Math.min(pf, 1 - pf));
                        r = mix(r, 0.075, seam * 0.60); gg = mix(gg, 0.048, seam * 0.60); b = mix(b, 0.034, seam * 0.60);
                        d[i] = clamp(r, 0, 1) * 255;
                        d[i + 1] = clamp(gg, 0, 1) * 255;
                        d[i + 2] = clamp(b, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, false);
        },

        cloth(scene, size, seed) {
            return this._tex("matAlbedo", size, size, (d, N) => {
                const TH = 190;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * TH, sv = v * TH;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const shade = over ? (0.94 + 0.08 * Math.sin(Math.PI * fv))
                            : (0.84 + 0.08 * Math.sin(Math.PI * fu));
                        const age = 0.93 + 0.12 * Noise.fbmp(u * 6, v * 6, 6, seed, 3);
                        const c = 0.700 * shade * age;
                        d[i] = clamp(c, 0, 1) * 255;
                        d[i + 1] = clamp(c * 0.985, 0, 1) * 255;
                        d[i + 2] = clamp(c * 0.945, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, false);
        },

        backdrop(scene, size, seed) {
            return this._tex("backdrop", size, size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        // 【対策】背景に強い明暗差があると、被写体の輪郭に
                        //         白い縁が回り込んで安っぽくなる。ほぼ均一にする
                        const g = 0.82 + 0.05 * (v - 0.5)
                            + 0.04 * (Noise.fbmp(u * 5, v * 4, 5, seed, 3) - 0.5);
                        d[i] = clamp(g * 1.00, 0, 1) * 255;
                        d[i + 1] = clamp(g * 0.995, 0, 1) * 255;
                        d[i + 2] = clamp(g * 0.975, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, true);
        }
    };

    // =================================================================
    //  マテリアル（品種ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg, seed) {
            const net = new CrackNet(cfg, seed);
            const T = TextureLab.rind(scene, cfg, net);
            this.albedoTex = T.albedo; this.ormTex = T.orm; this.normalTex = T.normal;
            this.relief = T.relief; this.RW = T.RW; this.RH = T.RH;
            let sum = 0;
            for (let i = 0; i < this.relief.length; i += 7) sum += this.relief[i];
            this.reliefMean = sum / Math.ceil(this.relief.length / 7);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
            const m = new BABYLON.PBRMaterial("melonRind", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 1.25;
            // 【対策】視差遮蔽は球＋円筒UVには向かない。UV をずらす手法
            //         なので、極で u が潰れる領域では変位が発散し、
            //         テクスチャが引き伸ばされて白い芋虫の塊になる。
            //         既定は切り、GUI から試せるだけにしておく
            m.useParallax = false;
            m.useParallaxOcclusion = false;
            m.parallaxScaleBias = 0.010;
            m.transparencyMode = OPAQUE;
            // 【対策】メロンの地肌はスイカほど光らない。クリアコートを
            //         強く入れると、コルクの網まで一緒に照って
            //         プラスチックの置物になる。地肌側だけ弱く効かせる
            m.clearCoat.isEnabled = true;
            m.clearCoat.intensity = 0.16 * cfg.wax;
            m.clearCoat.roughness = 0.42;
            m.clearCoat.indexOfRefraction = 1.42;
            m.metallicF0Factor = 0.65;
            this.rind = m;

            const s = new BABYLON.PBRMaterial("melonStem", scene);
            s.albedoColor = new BABYLON.Color3(1, 1, 1);
            s.metallic = 0.0;
            s.roughness = 0.84;
            s.transparencyMode = OPAQUE;
            this.stem = s;
        }
        // 表示モード 0=通常 / 1=白クレイ（法線のみ）/ 2=法線マップそのもの
        // 【対策】法線の向きが正しいかは、アルベドを外して陰影だけにするのが
        //         いちばん確実。色の明暗に紛れて凹凸の向きが判定できない
        setDebug(mode) {
            const m = this.rind;
            const C3 = BABYLON.Color3;
            if (mode === 2) {
                // 生の法線マップを表示（RGB = xyz）。緑チャンネルの向きを直接見る
                m.unlit = true;
                m.disableLighting = true;
                m.albedoTexture = null;
                m.albedoColor = new C3(0, 0, 0);
                m.emissiveTexture = this.normalTex;
                m.emissiveColor = new C3(1, 1, 1);
                m.metallicTexture = null;
                m.bumpTexture = null;
                m.clearCoat.isEnabled = false;
                return;
            }
            m.unlit = false;
            m.disableLighting = false;
            m.emissiveTexture = null;
            m.emissiveColor = new C3(0, 0, 0);
            m.bumpTexture = this.normalTex;
            if (mode === 1) {
                // 白クレイ。アルベドとORMを外し、法線の陰影だけを見る
                m.albedoTexture = null;
                m.albedoColor = new C3(0.78, 0.78, 0.78);
                m.metallicTexture = null;
                m.roughness = 0.62;
                m.clearCoat.isEnabled = false;
            } else {
                m.albedoTexture = this.albedoTex;
                m.albedoColor = new C3(1, 1, 1);
                m.metallicTexture = this.ormTex;
                m.roughness = 1.0;              // 実値は ORM の G
                m.clearCoat.isEnabled = true;
            }
        }

        // 鈍らせた高さ場の双一次サンプル（u は折り返し）
        reliefAt(u, v) {
            const W = this.RW, H = this.RH;
            let fx = u * W - 0.5, fy = clamp(v * H - 0.5, 0, H - 1.001);
            let x0 = Math.floor(fx), y0 = Math.floor(fy);
            const tx = fx - x0, ty = fy - y0;
            let x1 = (x0 + 1) % W; x0 = ((x0 % W) + W) % W; x1 = ((x1 % W) + W) % W;
            const y1 = Math.min(H - 1, y0 + 1);
            const a = this.relief[y0 * W + x0], b = this.relief[y0 * W + x1];
            const c = this.relief[y1 * W + x0], d = this.relief[y1 * W + x1];
            return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
        }
        dispose() {
            this.rind.dispose(true, false); this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 7. Melon
    // =================================================================
    class Melon {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng; this.skin = skin;
            this.R = cfg.radius * rng.range(0.95, 1.05);
            this.H = this.R * cfg.elong * rng.range(0.98, 1.02);
            this.nseed = rng.int(900000) + 1000;
            // 【対策】浅い縦溝は、実物では網目の粗い筋と同じ位置に出る。
            //         位相を乱数にすると模様と凹凸が無関係にずれる
            this.ribPhase = rng.range(0, TAU);
            this.dipStem = cfg.dipStem * rng.range(0.9, 1.15);
            this.dipBlossom = cfg.dipBlossom * rng.range(0.85, 1.2);
            this.a1 = cfg.asym * rng.range(0.7, 1.3);
            this.p1 = rng.range(0, TAU);
            this.tilt = rng.gauss(0, 0.035);
            this.tiltAz = rng.range(0, TAU);

            this.parts = [];
            this._buildBody(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("melon", scene);
            for (const m of this.parts) m.parent = this.root;
            this.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                this.tilt * Math.cos(this.tiltAz), rng.range(0, TAU), this.tilt * Math.sin(this.tiltAz));
        }

        modAt(u, phi) {
            const cfg = this.cfg;
            const env = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.45);
            const rib = cfg.ribAmp * Math.cos(cfg.ribs * phi + this.ribPhase) * env;
            const lump = cfg.lump * (Noise.fbmp(
                (phi / TAU) * 5, u * 4, 5, this.nseed, 3) - 0.5) * 2 * env;
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * u);
            return 1 + rib + lump + asym;
        }

        surfaceAt(u, phi) {
            const cfg = this.cfg;
            const th = clamp(u, 0, 1) * Math.PI;
            const s = Math.max(0, Math.sin(th)), c = Math.cos(th);
            const e = (c >= 0) ? cfg.expTop : cfg.expBot;
            const p = 2 / e;
            const r0 = Math.pow(s, p);
            const y0 = (c >= 0 ? 1 : -1) * Math.pow(Math.abs(c), p)
                * (c >= 0 ? cfg.topScale : cfg.botScale);
            const k = this.modAt(u, phi);
            const taper = 1 - cfg.taper * smooth(0.30, 1.0, u);
            let r = this.R * r0 * k * taper;
            let y = this.H * y0 * k;
            // 【対策】極まわりの超楕円はほぼ平ら。くぼみを広い smoothstep で
            //         書くとプロファイル自身の下がりと相殺して凹まない。
            //         ガウス型で幅 0.05 前後に絞る
            y -= this.dipStem * this.R * Math.exp(-Math.pow(u / cfg.dipWStem, 2));
            y += this.dipBlossom * this.R * Math.exp(-Math.pow((1 - u) / cfg.dipWBlossom, 2));
            return { r, y };
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const EPS = 0.004;
            const rings = [], centers = [];
            // 【対策】網目の畝はシルエットにはっきり出る。法線マップだけでは
            //         輪郭が真円のままなので、鈍らせた高さ場でメッシュ自体を
            //         持ち上げる。生の高さ場を使うとメッシュの分割数では
            //         畝を解像できず、ぎざぎざのノイズになる
            const amp = cfg.relief * this.R;
            for (let i = 0; i <= N; i++) {
                const u = EPS + (1 - 2 * EPS) * (i / N);
                const ring = [];
                let sy = 0;
                for (let j = 0; j <= M; j++) {
                    const jj = j % M;
                    const phi = jj / M * TAU;
                    const sp = this.surfaceAt(u, phi);
                    const rel = skin.reliefAt(jj / M, u) - skin.reliefMean;
                    const len = Math.hypot(sp.r, sp.y) || 1;
                    const push = amp * rel;
                    const rr = sp.r + (sp.r / len) * push;
                    const yy = sp.y + (sp.y / len) * push;
                    ring.push(new V3(Math.cos(phi) * rr, yy, Math.sin(phi) * rr));
                    sy += yy;
                }
                rings.push(ring);
                centers.push(new V3(0, sy / (M + 1), 0));
            }
            centers[0] = new V3(0, this.surfaceAt(0, 0).y, 0);
            centers[N] = new V3(0, this.surfaceAt(1, 0).y, 0);

            const mesh = sweep("melonBody", rings, centers, null, this.scene);
            mesh.material = skin.rind;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // ---- T字の果梗 -------------------------------------------------
        // 【対策】高級メロンの見分けがつくのはここ。垂直の軸だけだと
        //         「へたの付いたスイカ」にしか見えない。横木（蔓）を
        //         渡して、両端を切り口にする
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const SCn = cfg.stemCol, CUn = cfg.stemCut;
            const nsd = this.nseed + 91;
            const colsFn = (v, u) => {
                const g = 0.88 + 0.24 * Noise.fbmp(u * 8, v * 12, 8, nsd, 2);
                // 縦に走る筋
                const gr = Math.pow(0.5 + 0.5 * Math.cos(7 * u * TAU), 2.0);
                const dk = 0.82 + 0.18 * gr;
                const cut = smooth(0.90, 1.0, v);
                return [
                    srgb(mix(SCn[0], CUn[0], cut) * g * dk),
                    srgb(mix(SCn[1], CUn[1], cut) * g * dk),
                    srgb(mix(SCn[2], CUn[2], cut) * g * dk)
                ];
            };

            // 垂直部
            const K = cfg.stemSegments, M = cfg.stemSides;
            const base = this.surfaceAt(0, 0).y - this.R * 0.02;
            const vlen = this.R * 0.24 * rng.range(0.9, 1.15);
            const vrad = this.R * 0.086 * rng.range(0.92, 1.1);
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const y = base + vlen * s;
                const r = vrad * (1 + 1.75 * Math.pow(1 - smooth(0, 0.34, s), 1.7) - 0.14 * s);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const rr = r * (1 + 0.085 * Math.cos(7 * phi + 0.5));
                    ring.push(new V3(Math.cos(phi) * rr, y, Math.sin(phi) * rr));
                }
                rings.push(ring); centers.push(new V3(0, y, 0));
            }
            const stem = sweep("melonStem", rings, centers, colsFn, this.scene);
            stem.material = skin.stem;
            stem.receiveShadows = true;
            this.parts.push(stem);

            // 横木（T字の蔓）
            const KV = cfg.vineSegments, MV = cfg.vineSides;
            const az = rng.range(0, TAU);
            const dirX = Math.cos(az), dirZ = Math.sin(az);
            const perX = -dirZ, perZ = dirX;
            const half = this.R * rng.range(0.62, 0.80);
            // 【対策】横木を高く反らせると、蔓が宙に浮いたストローに見える。
            //         実物はほぼ真横で、わずかに傾いているだけ
            const tilt = rng.range(0.04, 0.13) * (rng.next() < 0.5 ? 1 : -1);
            const bow = rng.range(0.015, 0.045);
            const y0 = base + vlen;
            const rMid = this.R * 0.072, rEnd = this.R * 0.048;
            const vr = [], vc = [];
            for (let i = 0; i <= KV; i++) {
                const s = i / KV, t = (s - 0.5) * 2;      // -1 .. 1
                const cx = dirX * (t * half) + perX * (0.10 * half * Math.sin(t * 2.1));
                const cz = dirZ * (t * half) + perZ * (0.10 * half * Math.sin(t * 2.1));
                const cy = y0 + tilt * half * t + bow * half * (1 - t * t);
                const r = rEnd + (rMid - rEnd) * Math.pow(1 - t * t, 0.55);
                const ring = [];
                for (let j = 0; j <= MV; j++) {
                    const psi = (j % MV) / MV * TAU;
                    // 乾いた蔓は真円ではなく、繊維の筋で角張る
                    const rr = r * (1 + 0.14 * Math.cos(6 * psi + 0.3) + 0.05 * Math.cos(13 * psi))
                        * (1 + 0.05 * (Noise.p2u(s * 12, psi * 2, 12, nsd + 5) - 0.5));
                    // 断面は蔓の走る向きに垂直
                    ring.push(new V3(
                        cx + perX * (Math.cos(psi) * rr),
                        cy + Math.sin(psi) * rr,
                        cz + perZ * (Math.cos(psi) * rr)));
                }
                vr.push(ring); vc.push(new V3(cx, cy, cz));
            }
            const vineCols = (v, u) => {
                const cut = Math.max(smooth(0.94, 1.0, v), 1 - smooth(0.0, 0.06, v));
                const g = 0.88 + 0.24 * Noise.fbmp(u * 8, v * 16, 8, nsd + 3, 2);
                const gr = Math.pow(0.5 + 0.5 * Math.cos(6 * u * TAU), 2.0);
                const dk = 0.80 + 0.20 * gr;
                return [
                    srgb(mix(SCn[0], CUn[0], cut) * g * dk),
                    srgb(mix(SCn[1], CUn[1], cut) * g * dk),
                    srgb(mix(SCn[2], CUn[2], cut) * g * dk)
                ];
            };
            const vine = sweep("melonVine", vr, vc, vineCols, this.scene);
            vine.material = skin.stem;
            vine.receiveShadows = true;
            this.parts.push(vine);
        }

        worldBounds() {
            let mny = Infinity;
            for (const m of this.parts) {
                m.computeWorldMatrix(true);
                mny = Math.min(mny, m.getBoundingInfo().boundingBox.minimumWorld.y);
            }
            return mny;
        }
        seat(x, z, topY) {
            this.root.position.set(x, 0, z);
            this.root.computeWorldMatrix(true);
            this.root.position.y = topY - this.worldBounds();
            this.root.computeWorldMatrix(true);
        }
        dispose() {
            for (const m of this.parts) m.dispose();
            if (this.root) this.root.dispose();
            this.parts.length = 0;
        }
    }

    // =================================================================
    // 8. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.93, 0.93, 0.92, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.70;
    scene.environmentIntensity = 0.86;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.30, 1.22, 42, new V3(0, 8, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.56;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセス有効時は 16bit 深度の RT に描かれる。minZ が
    //         小さすぎると接している面が互いに勝ったり負けたりする
    camera.minZ = 3;
    camera.maxZ = 500;
    camera.lowerRadiusLimit = 16;
    camera.upperRadiusLimit = 110;
    camera.lowerBetaLimit = 0.15;
    camera.upperBetaLimit = 1.53;
    scene.cameraToUseForPointers = camera;

    // 背景の円筒（Layer だと深度を持たず被写界深度が効かない）
    (function () {
        const M = 72, RAD = 150, TOP = 190, BOT = -50;
        const rings = [], centers = [];
        for (const y of [TOP, (TOP + BOT) * 0.5, BOT]) {
            const ring = [];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * TAU;
                ring.push(new V3(Math.cos(phi) * RAD, y, Math.sin(phi) * RAD));
            }
            rings.push(ring); centers.push(new V3(0, y, 0));
        }
        const m = sweep("backdrop", rings, centers, null, scene);
        // 【対策】PBRMaterial の unlit は環境やパイプラインの影響を受けて
        //         期待どおり平坦にならないことがある。背景は
        //         StandardMaterial + disableLighting + emissive が確実
        const mm = new BABYLON.StandardMaterial("cycMat", scene);
        mm.disableLighting = true;
        mm.emissiveTexture = TextureLab.backdrop(scene, 512, 909);
        mm.diffuseColor = new BABYLON.Color3(0, 0, 0);
        mm.specularColor = new BABYLON.Color3(0, 0, 0);
        mm.backFaceCulling = false;
        m.material = mm; m.isPickable = false;
    })();

    const table = BABYLON.MeshBuilder.CreateBox("table", {
        width: GLOBAL.tableW, height: GLOBAL.tableH, depth: GLOBAL.tableD
    }, scene);
    table.position.y = -GLOBAL.tableH / 2;
    const tableMat = new BABYLON.PBRMaterial("tableMat", scene);
    tableMat.albedoTexture = TextureLab.wood(scene, 1024, 31);
    tableMat.albedoTexture.uScale = 1.5; tableMat.albedoTexture.vScale = 1.1;
    tableMat.metallic = 0.0; tableMat.roughness = 0.80;
    tableMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
    table.material = tableMat;
    table.receiveShadows = true;

    const mat = BABYLON.MeshBuilder.CreateBox("mat", {
        width: GLOBAL.matW, height: GLOBAL.matH, depth: GLOBAL.matD
    }, scene);
    mat.position.y = GLOBAL.matH / 2;
    const matMat = new BABYLON.PBRMaterial("matMat", scene);
    matMat.albedoTexture = TextureLab.cloth(scene, 1024, 77);
    matMat.metallic = 0.0; matMat.roughness = 0.85;
    matMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
    mat.material = matMat;
    mat.receiveShadows = true;
    const MAT_TOP = GLOBAL.matH;

    // 【対策】真上からの光は畝の両側を同じ明るさに照らすので、凹凸が
    //         いちばん見えない。斜めから当てると畝の片側だけが陰になる
    const key = new BABYLON.DirectionalLight("key", new V3(-0.46, -0.66, 0.60).normalize(), scene);
    key.position = new V3(30, 34, -34);
    key.intensity = 2.1;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.40, 0.39, 0.37);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fill", new V3(0.90, -0.30, -0.50).normalize(), scene);
    fillL.intensity = 0.80;
    fillL.diffuse = new BABYLON.Color3(0.98, 1.0, 0.99);
    fillL.specular = new BABYLON.Color3(0.10, 0.10, 0.10);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.54;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.72, 0.72, 0.70);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 36;
    sg.depthScale = 50;
    sg.darkness = 0.44;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 0.99;
    ip.vignetteEnabled = false;

    // =================================================================
    //  生成
    // =================================================================
    let items = [], curVariety = START_VARIETY, curSeed = START_SEED, curCfg = null;
    const skinCache = {}, netBump = {};
    let onRebuilt = null;

    // 網の凹凸の強さ。実機で見ながら合わせられるよう GUI から切り替える
    const BUMPS = [
        { label: "弱", level: 0.8, plx: 0.005 },
        { label: "中", level: 1.25, plx: 0.008 },
        { label: "強", level: 1.8, plx: 0.011 },
        { label: "最強", level: 2.6, plx: 0.014 }
    ];
    // 初期値: 網の凹凸=中 / 凹凸の向き=標準 / 視差遮蔽=OFF
    // 【対策】以前は invY=true が正しかったが、法線を焼く側で v の符号を
    //         直したので「標準」が正となった。ボタンは切り分け用に残す
    let bumpIdx = 1, plxOn = false, invY = false;
    const DEBUGS = ["通常", "白クレイ", "法線マップ"];
    let dbgIdx = 0;
    function applyDebug() {
        for (const k in skinCache) skinCache[k].setDebug(dbgIdx);
    }
    function applyRelief() {
        for (const k in skinCache) {
            const m = skinCache[k].rind;
            if (m.bumpTexture) m.bumpTexture.level = BUMPS[bumpIdx].level;
            m.parallaxScaleBias = BUMPS[bumpIdx].plx;
            m.useParallax = plxOn;
            m.useParallaxOcclusion = plxOn;
            m.invertNormalMapY = invY;
        }
    }

    function build(varietyKey, seed) {
        for (const it of items) it.dispose();
        items = [];
        const cfg = buildConfig(varietyKey, seed);
        curCfg = cfg;

        // 網目もテクスチャも品種で決まる。個体差で焼き直すと操作のたびに固まる
        let skin = skinCache[varietyKey];
        if (!skin) {
            const ns = (cfg.texSeed + 17 + (netBump[varietyKey] || 0) * 104729) >>> 0;
            skin = new Skin(scene, cfg, ns); skinCache[varietyKey] = skin;
        }

        for (let i = 0; i < cfg.total; i++) {
            items.push(new Melon(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }
        const pitch = cfg.radius * 2.35;
        for (let i = 0; i < items.length; i++) {
            const x = (i - (items.length - 1) / 2) * pitch;
            items[i].seat(x, (i % 2 === 0 ? 1 : -1) * cfg.radius * 0.10, MAT_TOP);
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);

        camera.target.set(0, items[0].H * 1.05, 0);
        camera.radius = cfg.radius * (items.length > 1 ? 7.2 : 5.6);

        applyRelief();
        applyDebug();
        if (onRebuilt) onRebuilt();
        console.log("[Melon]", BUILD, "/", cfg.label, "/ seed =", cfg.seed);
    }

    build(START_VARIETY, START_SEED);

    if (GLOBAL.useSSAO) {
        // 【対策】網の溝と、ござとの接点に影が入らないと球が宙に浮く
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 1.9;
        ssao.totalStrength = 1.05;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 250;
        ssao.minZAspect = 0.25;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.93;
    dp.bloomWeight = 0.02;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.14;
    // 【対策】Babylon の錯乱円は「シーン単位 × 1000 = mm」。focalLength を
    //         focusDistance の一定比率にすると focus が約分され、カメラを
    //         寄せても引いてもボケ量が変わらない
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
    // 【対策】フルスクリーンGUIは既定でシーンと同じカメラで合成されるので、
    //         Bloom / 被写界深度 / シャープンがUIにも乗ってボケる
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#16210f", active: "#4d7a24", edge: "#33422a",
        text: "#f2f8e8", sub: "#b6c9a4", accent: "#a8dd70"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "262px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(10,16,6,0.82)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "230px"; panel.isVertical = true;
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

    addLabel("MUSKMELON", 11, COL.sub, "18px");
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
    for (const c of [1, 2, 3]) {
        countBtns[c] = addButton("c" + c, c + "個", () => {
            GLOBAL.count = c; build(curVariety, curSeed); highlight();
        });
    }

    const sp = new BABYLON.GUI.Rectangle();
    sp.height = "8px"; sp.thickness = 0; sp.background = "";
    panel.addControl(sp);

    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed); highlight();
    });
    addButton("renet", "網目を張り直す", () => {
        // 網目は品種キャッシュなので、明示的に捨ててから作り直す
        const k = curVariety;
        if (skinCache[k]) { skinCache[k].dispose(); delete skinCache[k]; }
        netBump[k] = (netBump[k] || 0) + 1;
        build(k, curSeed); highlight();
    });
    const dbgBtn = addButton("dbg", "表示: 通常", () => {
        dbgIdx = (dbgIdx + 1) % DEBUGS.length;
        applyDebug();
        dbgBtn.background = dbgIdx ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "表示: " + DEBUGS[dbgIdx];
    });
    const bumpBtn = addButton("bump", "網の凹凸: 中", () => {
        bumpIdx = (bumpIdx + 1) % BUMPS.length;
        applyRelief();
        bumpBtn.textBlock.text = "網の凹凸: " + BUMPS[bumpIdx].label;
    });
    // 【対策】視差マッピングの高さの向き（アルファの 1 が凸か凹か）は
    //         環境によって解釈が変わりうる。網が「彫った線」に見えたら
    //         これを切って、法線だけで判断できるようにしておく
    // 【対策】法線マップの緑チャンネルの向きは、UVの向きや invertY との
    //         掛け算で環境依存になりうる。網が「彫った線」に見えたら
    //         これを反転して切り分ける
    const invBtn = addButton("inv", "凹凸の向き: 標準", () => {
        invY = !invY;
        applyRelief();
        invBtn.background = invY ? COL.active : COL.idle;
        invBtn.textBlock.text = "凹凸の向き: " + (invY ? "反転" : "標準");
    });
    invBtn.background = invY ? COL.active : COL.idle;
    const plxBtn = addButton("plx", "視差遮蔽: OFF", () => {
        plxOn = !plxOn;
        applyRelief();
        plxBtn.background = plxOn ? COL.active : COL.idle;
        plxBtn.textBlock.text = "視差遮蔽: " + (plxOn ? "ON" : "OFF");
    });
    plxBtn.background = plxOn ? COL.active : COL.idle;
    const dofBtn = addButton("dof", "被写界深度: ON", () => {
        GLOBAL.useDOF = !GLOBAL.useDOF;
        dp.depthOfFieldEnabled = GLOBAL.useDOF;
        dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
        dofBtn.textBlock.text = "被写界深度: " + (GLOBAL.useDOF ? "ON" : "OFF");
    });
    // 【対策】トグル系のボタンは、生成直後の点灯状態を実際の値に合わせる。
    //         既定 ON なのに消灯していると、一度押して初めて一致する
    dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
    const rotateBtn = addButton("rotate", "自動回転: OFF", () => {
        camera.useAutoRotationBehavior = !camera.useAutoRotationBehavior;
        if (camera.autoRotationBehavior) camera.autoRotationBehavior.idleRotationSpeed = 0.07;
        rotateBtn.textBlock.text = "自動回転: " + (camera.useAutoRotationBehavior ? "ON" : "OFF");
        rotateBtn.background = camera.useAutoRotationBehavior ? COL.active : COL.idle;
    });

    const info = addLabel("", 12, COL.sub, "46px");
    onRebuilt = () => {
        if (!info) return;
        const e = items[0];
        if (!e) { info.text = ""; return; }
        info.text = curCfg.label + " / " + items.length + "個\n"
            + "径 " + (e.R * 2).toFixed(1) + "cm  高 " + (e.H * 2).toFixed(1) + "cm\n"
            + "seed: " + curSeed;
    };
    onRebuilt();

    // ---- GUI の開閉 -------------------------------------------------
    // 【対策】Babylon.GUI のサイズ指定はレンダー解像度基準（≒ CSS px × DPR）。
    //         DPR 3 の端末では 34px のボタンが実質 11 CSS px になる
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
    toggleBtn.background = "rgba(10,16,6,0.82)";
    toggleBtn.fontSize = 20;
    if (toggleBtn.textBlock) toggleBtn.textBlock.color = COL.text;
    toggleBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    toggleBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    toggleBtn.left = "16px"; toggleBtn.top = "16px";
    ui.addControl(toggleBtn);

    let panelOpen = !isCompact();
    function applyGuiLayout() {
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(10,16,6,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;