// =====================================================================
//  Photoreal Watermelon  /  写実的なスイカ
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（大玉 / 小玉 / ラグビー / 黒スイカ）
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ / 2D周期ノイズ
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 果実の断面（超楕円）・稜・両極のくぼみ
//    5. TextureLab  … 果皮のアルベド/ORM/法線、木目、ござ
//    6. WaterMelon  … 果実 + 果梗
//    7. Stage       … 板の間・ござ・背景の円筒
//    8. Scene
//    9. GUI
//
//  これまでの野菜・果物との違い（＝ここを外すとスイカに見えない）:
//    ・形はほぼ球。ごまかしが効かないので、真球にした瞬間にボールになる。
//      超楕円の指数と上下の高さ比、低周波のうねりで「歪んだ球」にする
//    ・主役は完全に縞。縞は「太い帯」ではなく、濃緑の芯から細かい指が
//      伸びて明緑側へちぎれていく分数的な模様。境界を滑らかにぼかすと
//      たちまちビーチボールになる
//    ・縞は極で1点に集まる。UVの u を周方向、v を極→極にしておけば
//      これは自動的に出る（ここが円筒UVを選ぶ最大の理由）
//    ・果皮は蝋質でよく光るが、部分的に果粉（ブルーム）が乗って
//      そこだけ艶が消える。全面を均一に磨くとプラスチックになる
//    ・果肉は見えないので SSS はほぼ不要。逆に入れると中が光る風船になる
// =====================================================================

const createScene = function () {

    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        oodama: {
            label: "大玉（縞王）",
            radius: 11.4,           // 赤道半径
            elong: 1.062,           // 高さ半径 / 赤道半径
            taper: 0.035,           // 下半分をわずかに細める（卵形）
            expTop: 2.16, expBot: 2.10,   // 超楕円の指数（2 で真円）
            topScale: 1.03, botScale: 0.98,
            dipStem: 0.075, dipBlossom: 0.038,
            ribs: 17, ribAmp: 0.0075, lump: 0.028, asym: 0.019,

            // 縞
            stripes: 17,
            stripeWidth: 0.180,     // 濃緑の半幅（1.0 = 縞の間隔）→ 濃緑 約43%
            stripeWave: 0.34,       // 芯の蛇行
            jag: 0.30,              // ふちのぎざぎざ（3帯域）
            fleck: 0.32,            // ふちのちぎれ
            link: 0.50,             // 明緑を縦に割る横向きの暗線
            soft: 0.022,            // 境界のぼけ（テクセル3〜5個ぶん）

            stemLen: 0.20, stemRad: 0.040, stemBend: 0.70,

            // 色（sRGB）
            gLight: [0.545, 0.780, 0.335],   // 裂片の明るい面
            gMid: [0.350, 0.610, 0.205],   // 裂片の陰
            gDark: [0.152, 0.262, 0.128],   // 縞（黒ではなく暗く沈んだ緑）
            gDeep: [0.102, 0.182, 0.094],   // 縞の芯
            powder: [0.700, 0.760, 0.640],   // 果粉（ブルーム）
            soil: [0.720, 0.775, 0.415],   // 花落ち側の淡い地色
            scar: [0.760, 0.690, 0.520],   // 花落ち跡
            stemCol: [0.455, 0.378, 0.228], stemCut: [0.605, 0.545, 0.375],

            rindRough: 0.36, wax: 1.00, powderK: 0.30
        },
        kodama: {
            label: "小玉（ひとりじめ）",
            radius: 7.3, elong: 1.105, taper: 0.055,
            expTop: 2.10, expBot: 2.06,
            topScale: 1.02, botScale: 0.99,
            dipStem: 0.070, dipBlossom: 0.034,
            ribs: 19, ribAmp: 0.0062, lump: 0.024, asym: 0.016,
            // 小玉は縞が細くて数が多く、ふちのちぎれが細かい
            stripes: 19,
            stripeWidth: 0.168, stripeWave: 0.30, jag: 0.27, fleck: 0.35, link: 0.55, soft: 0.020,
            stemLen: 0.26, stemRad: 0.042, stemBend: 0.90,
            gLight: [0.570, 0.800, 0.355],
            gMid: [0.368, 0.632, 0.220],
            gDark: [0.160, 0.275, 0.135],
            gDeep: [0.108, 0.192, 0.100],
            powder: [0.715, 0.775, 0.655],
            soil: [0.740, 0.790, 0.430],
            scar: [0.775, 0.705, 0.535],
            stemCol: [0.470, 0.390, 0.238], stemCut: [0.615, 0.555, 0.385],
            rindRough: 0.34, wax: 1.05, powderK: 0.26
        },
        rugby: {
            label: "楕円（ラグビー型）",
            radius: 9.8, elong: 1.30, taper: 0.022,
            expTop: 2.24, expBot: 2.18,
            topScale: 1.01, botScale: 1.00,
            dipStem: 0.056, dipBlossom: 0.030,
            ribs: 16, ribAmp: 0.0068, lump: 0.025, asym: 0.017,
            stripes: 16,
            stripeWidth: 0.190, stripeWave: 0.28, jag: 0.29, fleck: 0.30, link: 0.46, soft: 0.023,
            stemLen: 0.18, stemRad: 0.038, stemBend: 0.62,
            gLight: [0.520, 0.755, 0.315],
            gMid: [0.332, 0.585, 0.192],
            gDark: [0.142, 0.248, 0.120],
            gDeep: [0.095, 0.170, 0.088],
            powder: [0.695, 0.755, 0.635],
            soil: [0.705, 0.760, 0.400],
            scar: [0.750, 0.680, 0.510],
            stemCol: [0.445, 0.368, 0.222], stemCut: [0.595, 0.535, 0.368],
            rindRough: 0.38, wax: 0.95, powderK: 0.34
        },
        densuke: {
            label: "黒スイカ（でんすけ）",
            radius: 11.0, elong: 1.035, taper: 0.030,
            expTop: 2.12, expBot: 2.08,
            topScale: 1.02, botScale: 0.99,
            dipStem: 0.072, dipBlossom: 0.036,
            ribs: 15, ribAmp: 0.0066, lump: 0.026, asym: 0.017,
            // 【対策】無地の品種のために分岐を足すと縞の処理が二重になる。
            //         明緑と濃緑をどちらも黒緑にすれば、同じ式のまま
            //         「うっすら模様の残る黒」になる
            stripes: 15,
            stripeWidth: 0.220, stripeWave: 0.34, jag: 0.36, fleck: 0.29, link: 0.32, soft: 0.030,
            stemLen: 0.19, stemRad: 0.040, stemBend: 0.70,
            gLight: [0.150, 0.212, 0.122],
            gMid: [0.108, 0.160, 0.092],
            gDark: [0.056, 0.090, 0.054],
            gDeep: [0.038, 0.062, 0.039],
            powder: [0.520, 0.560, 0.480],
            soil: [0.560, 0.570, 0.320],
            scar: [0.700, 0.640, 0.480],
            stemCol: [0.440, 0.362, 0.218], stemCut: [0.590, 0.530, 0.362],
            rindRough: 0.28, wax: 1.25, powderK: 0.42
        }
    };

    const GLOBAL = {
        count: 1,

        dipWStem: 0.055,            // 果梗側のくぼみの広がり（u の単位）
        dipWBlossom: 0.045,

        segmentsAxis: 200,          // 極→極の分割
        segmentsRound: 160,         // 周方向の分割
        stemSegments: 18,
        stemSides: 14,

        textureSize: 2048,
        matW: 46, matD: 34, matH: 1.0,
        tableW: 240, tableD: 170, tableH: 6,

        useSSAO: true,
        useDOF: true,
        dofRatio: 0.072,
        dofFStop: 2.4,

        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "oodama";
    const START_SEED = 20260731;
    const BUILD = "watermelon-H";

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
        // 【対策】テクスチャは品種単位でキャッシュするので、その種は
        //         個体乱数から切り離して品種名から決める
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.texSeed = (h >>> 0) % 100000;
        // 【対策】粒・傷・暗線の細かさは果実の大きさで決まるもので、
        //         縞の本数とは無関係。u の周波数を NS に連動させると、
        //         縞を増やしたとたんに肌理まで細かくなってしまう。
        //         赤道半径 11.4cm を基準に絶対周波数として持つ
        // 【対策】粒の細かさは「果実の大きさ」と「テクスチャ解像度」の
        //         両方に比例させる。解像度だけ下げると最上位オクターブが
        //         テクセルに追いつき、またブロックノイズが出る
        const gs = (cfg.radius / 11.4) * (cfg.textureSize / 2048);
        // 【対策】勾配ノイズの fbm は 1 オクターブごとに周波数が倍になる。
        //         最上位が 2048px のテクスチャで 4px を切ると折り返すので、
        //         基準周波数は「最上位が 5px 以上」に収まるよう低めに取り、
        //         細かさはオクターブ数で稼ぐ
        // 【対策】ブロックノイズの正体は「格子の形」ではなく、閾値を取る場の
        //         最上位オクターブがテクセルに近すぎること。2048px 幅なら
        //         220周期 = 9.3テクセルが下限で、これ以上上げると最上位
        //         オクターブ単独で閾値が反転し、数テクセル大の塊ができる
        cfg.grain = {
            clump: Math.max(6, Math.round(55 * gs)),      // 明緑の裂片 3oct → 55/110/220
            edge: Math.max(8, Math.round(80 * gs)),       // ふちのちぎれ 2oct → 80/160
            fine: Math.max(8, Math.round(90 * gs)),       // 濃緑中の明点 2oct → 90/180
            pebble: Math.max(8, Math.round(110 * gs)),    // 梨地 2oct → 110/220
            linkU: Math.max(4, Math.round(14 * gs)),      // 暗線のうねり
            linkV: Math.max(6, Math.round(26 * gs))       // 暗線の間隔 約14mm
        };
        cfg.total = Math.max(1, cfg.count);
        if (cfg.total > 1) { cfg.segmentsAxis = 144; cfg.segmentsRound = 112; }
        // 【対策】縞のちぎれは高周波なので 2048 欲しいが、狭い画面で焼くと
        //         生成に数秒かかるうえ表示サイズに見合わない
        const vw = (typeof window !== "undefined" && window.innerWidth) || 1024;
        if (vw < GLOBAL.compactWidth) cfg.textureSize = 1024;
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
    // 2. Noise
    // =================================================================
    // 【対策】勾配ノイズを角度で持つと、格子点4隅ごとに cos/sin を呼ぶ。
    //         1テクセルあたり数百回の三角関数になり、2048px のテクスチャで
    //         十数秒かかる。単位ベクトルを 256 本の表に焼いておき、
    //         ハッシュの下位8ビットで引くだけにする
    const GRAD_N = 256;
    const GRAD_X = new Float32Array(GRAD_N), GRAD_Y = new Float32Array(GRAD_N);
    for (let gi = 0; gi < GRAD_N; gi++) {
        const ga = (gi + 0.5) * (TAU / GRAD_N);
        GRAD_X[gi] = Math.cos(ga); GRAD_Y[gi] = Math.sin(ga);
    }

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
        // ---- 勾配ノイズ（Perlin）。u 方向だけ折り返す ----------------
        // 【対策】値ノイズは格子点の「値」を補間するだけなので、閾値処理
        //         すると格子の四角がそのまま輪郭に出る（ブロックノイズ）。
        //         周波数を上げても格子が細かくなるだけで解決しない。
        //         格子点に「勾配ベクトル」を置いて内積を補間する勾配ノイズは
        //         格子上で必ず 0 を通るため、二値化しても方眼が出ない
        _gi(x, y, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
                ^ Math.imul(seed | 0, 2246822519);
            h = Math.imul(h ^ (h >>> 15), 2654435761); h ^= h >>> 13;
            h = Math.imul(h, 668265263); h ^= h >>> 16;
            return h & 255;
        },
        p2u(x, y, px, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            // 【対策】補間は smoothstep ではなく quintic。smoothstep は
            //         2階微分が格子で不連続なので、法線に起こしたときに
            //         格子の筋が見える
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
        // ---- 3D 勾配ノイズ。球面上で評価するので極の歪みが原理的に無い ----
        // 【対策】円筒UVは極で u が潰れる。2Dノイズをそのまま使うと粒が
        //         放射状に伸びて溶けるので、これまでは極で振幅を 0 に
        //         落としてごまかしていた。球面上の3D座標で引けば、
        //         赤道と同じ粒が極までそのまま続く
        _gh(x, y, z, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
                ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 2246822519);
            h = Math.imul(h ^ (h >>> 15), 2654435761); h ^= h >>> 13;
            return h & 15;
        },
        _gd(h, x, y, z) {
            switch (h) {
                case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
                case 4: return x + z; case 5: return -x + z; case 6: return x - z; case 7: return -x - z;
                case 8: return y + z; case 9: return -y + z; case 10: return y - z; case 11: return -y - z;
                case 12: return y + x; case 13: return -y + z; case 14: return y - x; default: return -y - z;
            }
        },
        p3(x, y, z, seed) {
            const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
            const xf = x - xi, yf = y - yi, zf = z - zi;
            const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
            const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
            const w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
            const A = this._gh, B = this._gd;
            const n000 = B(A(xi, yi, zi, seed), xf, yf, zf);
            const n100 = B(A(xi + 1, yi, zi, seed), xf - 1, yf, zf);
            const n010 = B(A(xi, yi + 1, zi, seed), xf, yf - 1, zf);
            const n110 = B(A(xi + 1, yi + 1, zi, seed), xf - 1, yf - 1, zf);
            const n001 = B(A(xi, yi, zi + 1, seed), xf, yf, zf - 1);
            const n101 = B(A(xi + 1, yi, zi + 1, seed), xf - 1, yf, zf - 1);
            const n011 = B(A(xi, yi + 1, zi + 1, seed), xf, yf - 1, zf - 1);
            const n111 = B(A(xi + 1, yi + 1, zi + 1, seed), xf - 1, yf - 1, zf - 1);
            const x00 = n000 + (n100 - n000) * u, x10 = n010 + (n110 - n010) * u;
            const x01 = n001 + (n101 - n001) * u, x11 = n011 + (n111 - n011) * u;
            const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
            return 0.5 + (y0 + (y1 - y0) * w) * 0.52;
        },
        fbm3p(x, y, z, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * (this.p3(x * f, y * f, z * f, seed + o * 131) - 0.5);
                n += a; f *= 2; a *= 0.5;
            }
            return 0.5 + s / n * 0.95;
        },
        fbmp(x, y, period, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * (this.p2u(x * f, y * f, (period * f) | 0, seed + o * 131) - 0.5);
                n += a; f *= 2; a *= 0.5;
            }
            return 0.5 + s / n * 0.95;
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
        //         裏返る
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
    // 5. TextureLab
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
            w = Math.max(8, Math.round(w) || 512);
            h = Math.max(8, Math.round(h) || 512);
            const dt = this._make(name, w, h, scene, clampV);
            const ctx = dt.getContext();
            const img = ctx.createImageData(w, h);
            fill(img.data, w, h);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            return dt;
        },

        // -------------------------------------------------------------
        //  果皮。アルベド / ORM / 高さ を1回のループで焼く
        // 【対策】縞は「同じ場」からアルベドと粗さと法線を作らないと、
        //         色の縞と艶の縞がずれて、印刷した紙を貼ったように見える。
        //         3枚を別ループで作るとノイズの評価回数も3倍になる
        // -------------------------------------------------------------
        rind(scene, size, cfg) {
            // 【対策】正方形テクスチャは半分が無駄。円筒UVでは v は周長の
            //         半分しか回らないので、2048x1024 で u/v のテクセル密度が
            //         ちょうど揃う。焼く画素数が半分になり、品質は変わらない
            const SW = Math.max(64, size | 0);
            const SH = Math.max(32, SW >> 1);
            const sd = cfg.texSeed;
            const NS = Math.max(1, cfg.stripes | 0);
            const G = cfg.grain;
            const t0 = (typeof performance !== "undefined") ? performance.now() : Date.now();

            const texA = this._make("rindAlbedo", SW, SH, scene, true);
            const texO = this._make("rindORM", SW, SH, scene, true);
            const ctxA = texA.getContext(), ctxO = texO.getContext();
            const imgA = ctxA.createImageData(SW, SH), imgO = ctxO.createImageData(SW, SH);
            const A = imgA.data, O = imgO.data;
            const H = new Float32Array(SW * SH);

            // 【対策】3Dノイズ用の球面座標。cos/sin を毎テクセル呼ぶと
            //         それだけで数百ms 溶けるので、u 方向は列ごとに1回、
            //         v 方向は行ごとに1回に畳む
            const COSU = new Float32Array(SW), SINU = new Float32Array(SW);
            for (let x = 0; x < SW; x++) {
                const a = ((x + 0.5) / SW) * TAU;
                COSU[x] = Math.cos(a); SINU[x] = Math.sin(a);
            }
            const F3 = G.clump / TAU;   // 赤道1周で G.clump 周期になる倍率

            const L = cfg.gLight, Mc = cfg.gMid, D = cfg.gDark, DP = cfg.gDeep;
            const PW = cfg.powder, SO = cfg.soil, SC = cfg.scar;

            // 接地面（地面に触れていた側）の中心
            const soilU = (Noise._h2(1, 1, sd) * 1.0);
            const soilV = 0.845;

            for (let y = 0; y < SH; y++) {
                const v = (y + 0.5) / SH;
                // 【対策】極ではUVが極端に潰れる。ここでぎざぎざを効かせると
                //         模様が放射状の細い針になる。両端で減衰させる
                const poleFade = smooth(0.0, 0.055, v) * (1 - smooth(0.945, 1.0, v));
                const sy = Math.cos(Math.PI * v) * F3, sr = Math.sin(Math.PI * v) * F3;

                for (let x = 0; x < SW; x++) {
                    const u = (x + 0.5) / SW;
                    const i = y * SW + x, o = i * 4;

                    // ---- 縞 -------------------------------------------
                    // 【対策】ドメインワープを強く掛けると、模様が溶けて
                    //         マラカイト（孔雀石）のような液状の縞になる。
                    //         スイカの明緑は「ちぎれた帯」であって渦ではない。
                    //         距離場 ＋ 多帯域ノイズという素直な構成に戻し、
                    //         ノイズの種類だけを勾配ノイズに入れ替える
                    // 【対策】以下の低周波の場は 1 オクターブで十分。ここを
                    //         2 オクターブにすると、見た目は変わらないのに
                    //         生成時間だけが 1.3 倍になる
                    const wob = (Noise.p2u(u * 2, v * 3.0, 2, sd + 11) - 0.5) * cfg.stripeWave;
                    const t = u * NS + wob;
                    const ci = Math.floor(t);
                    const fr = t - ci;
                    const kk = ((ci % NS) + NS) % NS;
                    const j1 = Noise._h2(kk, 3, sd + 5), j2 = Noise._h2(kk, 17, sd + 5);
                    const swell = Noise.p2u(u * NS, v * 9, NS, sd + 29);
                    const half = cfg.stripeWidth * (0.74 + 0.52 * j1) * (0.80 + 0.40 * swell);
                    const cen = 0.5 + (j2 - 0.5) * 0.18;
                    const d = Math.abs(fr - cen);

                    // ふちの分数的なぎざぎざ。周波数を倍にしながら振幅を
                    // 0.58 倍していく4帯域を距離場に足す
                    let e = 0, amp = cfg.jag, F = NS * 2;
                    for (let ob = 0; ob < 2; ob++) {
                        e += amp * (Noise.p2u(u * F, v * F * 0.40, F, sd + 41 + ob * 13) - 0.5);
                        amp *= 0.62; F *= 2;
                    }
                    e *= poleFade;

                    let P = half - d + e;

                    // 明緑を縦に区切る横向きの暗線
                    // 【対策】Math.pow は指数が整数でも遅い。5乗は2乗2回＋1回の
                    //         掛け算で書けて、テクセルあたり数百ns 効く
                    const lkf = Noise.p2u(u * G.linkU, v * G.linkV, G.linkU, sd + 137);
                    const lr = 1 - Math.abs(2 * lkf - 1), lr2 = lr * lr;
                    const link = lr2 * lr2 * lr * poleFade;
                    P += link * half * cfg.link;

                    // 境界付近だけちぎる
                    // 【対策】以下は境界の近くでしか効かない。全テクセルで
                    //         評価すると生成時間の3割を捨てることになる
                    const nr = P / Math.max(1e-3, half);
                    if (nr > -1 && nr < 1) {
                        // exp(-4x^2) の代わりに (1-x^2)^3。形はほぼ同じで
                        // 超越関数を1つ減らせるうえ、外側で厳密に 0 になる
                        const w0 = 1 - nr * nr;
                        const fk = Noise.p2u(u * G.edge, v * G.edge * 0.5, G.edge, sd + 7) - 0.5;
                        P += fk * cfg.fleck * w0 * w0 * w0 * poleFade;
                    }
                    // 濃緑の中に散る孤立した明点
                    if (nr < 0.7) {
                        const spk = Noise.p2u(u * G.fine, v * G.fine * 0.5, G.fine, sd + 491);
                        P -= smooth(0.64, 0.84, spk) * half * 0.85 * poleFade;
                    }

                    const dark = smooth(-cfg.soft, cfg.soft, P);

                    // ---- 明緑の裂片（勾配ノイズの閾値）-----------------
                    // 【対策】ここが前版のブロックノイズの発生源だった。
                    //         値ノイズを 6px/周期で二値化していたので、
                    //         バイリニア補間の四角がそのまま模様になった。
                    //         勾配ノイズ 3 オクターブ（90/180/360）にすると
                    //         格子が消え、粗い塊のふちが細かくほつれる
                    // 【対策】閾値の幅も効く。狭いと最上位オクターブの微差で
                    //         塗り分けが反転し、階段状のふちになる。場の四分位
                    //         範囲（0.433〜0.567）と同じくらい広く取る
                    const gf = Noise.fbm3p(COSU[x] * sr, sy, SINU[x] * sr, sd + 83, 3);
                    const sk = smooth(0.435, 0.565, gf);
                    let cr = mix(Mc[0], L[0], sk);
                    let cg = mix(Mc[1], L[1], sk);
                    let cb = mix(Mc[2], L[2], sk);

                    // ---- 縞を乗せる -----------------------------------
                    const mo = Noise.p2u(u * 30, v * 15, 30, sd + 61);
                    cr = mix(cr, D[0], dark); cg = mix(cg, D[1], dark); cb = mix(cb, D[2], dark);
                    const ck = smooth(0.25, 0.90, nr) * dark * 0.50;
                    cr = mix(cr, DP[0], ck); cg = mix(cg, DP[1], ck); cb = mix(cb, DP[2], ck);
                    const dm = (mo - 0.5) * 0.08 * dark;
                    cr = clamp(cr + dm * 0.8, 0, 1); cg = clamp(cg + dm, 0, 1); cb = clamp(cb + dm * 0.6, 0, 1);

                    // ---- 傷（コルク化した細い線）----------------------
                    const rare = smooth(0.655, 0.745, Noise.p2u(u * 6, v * 4, 6, sd + 223));
                    let scratch = 0;
                    if (rare > 0.001) {
                        const scv = Noise.p2u(u * 30, v * 15, 30, sd + 211);
                        const sr = 1 - Math.abs(2 * scv - 1);
                        const s2 = sr * sr, s4 = s2 * s2, s8 = s4 * s4;
                        scratch = s8 * s8 * rare * poleFade;
                    }
                    cr = mix(cr, 0.470, scratch * 0.45);
                    cg = mix(cg, 0.425, scratch * 0.45);
                    cb = mix(cb, 0.290, scratch * 0.45);

                    // ---- 果粉（ブルーム）-------------------------------
                    const pwf = Noise.p2u(u * 7, v * 5, 7, sd + 97);
                    const pw = smooth(0.52, 0.68, pwf) * cfg.powderK * (0.30 + 0.70 * dark);
                    cr = mix(cr, PW[0], pw * 0.34); cg = mix(cg, PW[1], pw * 0.34); cb = mix(cb, PW[2], pw * 0.34);

                    // ---- 花落ち側の淡い地色 ---------------------------
                    let soil = 0;
                    if (v > 0.86) {
                        const soilN = Noise.p2u(u * 11, v * 7, 11, sd + 123);
                        soil = clamp(smooth(0.88, 0.975, v) * (0.75 + 1.10 * (soilN - 0.5)) * 1.35, 0, 1);
                    }
                    cr = mix(cr, SO[0], soil * 0.92); cg = mix(cg, SO[1], soil * 0.92); cb = mix(cb, SO[2], soil * 0.92);

                    // ---- 花落ち跡（お尻の小さな丸い痕）-----------------
                    const sb = smooth(0.9875, 1.0, v);
                    cr = mix(cr, SC[0], sb * 0.90); cg = mix(cg, SC[1], sb * 0.90); cb = mix(cb, SC[2], sb * 0.90);

                    // ---- 果梗の付け根の乾いた痕 -----------------------
                    const scarPad = 1 - smooth(0.009, 0.028, v);
                    const wr = (scarPad > 0.001)
                        ? Noise.p2u(u * 70, v * 90, 70, sd + 167) : 0.5;
                    cr = mix(cr, 0.545, scarPad * 0.88); cg = mix(cg, 0.485, scarPad * 0.88); cb = mix(cb, 0.345, scarPad * 0.88);
                    const wk = scarPad * (wr - 0.5) * 0.28;
                    cr = clamp(cr + wk, 0, 1); cg = clamp(cg + wk, 0, 1); cb = clamp(cb + wk, 0, 1);
                    // 【対策】実物は痕のすぐ外に、縞が集まって融け合った
                    //         淡緑の輪がある。これが無いと、痕が皮の上に
                    //         シールで貼られたように浮く
                    const halo = smooth(0.020, 0.040, v) * (1 - smooth(0.042, 0.115, v));
                    cr = mix(cr, L[0] * 1.06, halo * 0.55);
                    cg = mix(cg, L[1] * 1.04, halo * 0.55);
                    cb = mix(cb, L[2] * 1.10, halo * 0.55);

                    // ---- 高さ（法線用）--------------------------------
                    const peb = Noise.fbmp(u * G.pebble, v * G.pebble * 0.5, G.pebble, sd + 151, 2);
                    let hh = 0.5
                        + 0.30 * (peb - 0.5) * poleFade
                        + 0.14 * (sk - 0.5) * (1 - dark) * poleFade
                        + 0.06 * (dark - 0.5)
                        - 0.10 * link * poleFade
                        + 0.14 * scratch
                        + 0.24 * (wr - 0.5) * scarPad
                        - 0.30 * sb;
                    hh = clamp(hh, 0, 1);
                    H[i] = hh;

                    const kk2 = 0.95 + 0.10 * hh;
                    A[o] = clamp(cr * kk2, 0, 1) * 255;
                    A[o + 1] = clamp(cg * kk2, 0, 1) * 255;
                    A[o + 2] = clamp(cb * kk2, 0, 1) * 255;
                    A[o + 3] = 255;

                    // ---- 粗さ / AO -------------------------------------
                    let rough = cfg.rindRough * (0.90 + 0.24 * (1 - hh));
                    // 艶のむらは果粉と同じ低周波の場を裏返して使う（1枚節約）
                    rough = mix(rough, cfg.rindRough * 1.40, smooth(0.52, 0.40, pwf));
                    rough = mix(rough, cfg.rindRough * 0.84, dark * 0.50);
                    rough = mix(rough, 0.62, pw);
                    rough = mix(rough, 0.68, soil * 0.75);
                    rough = mix(rough, 0.76, sb);
                    rough = mix(rough, 0.74, scarPad * 0.85);
                    rough = mix(rough, 0.80, scratch * 0.9);
                    let ao = 1.0;
                    ao = mix(ao, 0.72, scarPad);
                    ao = mix(ao, 0.82, sb);
                    ao = mix(ao, 0.92, link * 0.6);
                    O[o] = clamp(ao, 0, 1) * 255;
                    O[o + 1] = clamp(rough, 0.03, 1) * 255;
                    O[o + 2] = 0; O[o + 3] = 255;
                }
            }
            ctxA.putImageData(imgA, 0, 0); texA.update(false);
            ctxO.putImageData(imgO, 0, 0); texO.update(false);

            const texN = this.normal(scene, SW, SH, H, 1.25);
            const t1 = (typeof performance !== "undefined") ? performance.now() : Date.now();
            console.log("[Watermelon] 果皮テクスチャ " + SW + "x" + SH
                + " を " + Math.round(t1 - t0) + "ms で生成");
            return { albedo: texA, orm: texO, normal: texN };
        },

        normal(scene, w, h, hf, strength) {
            return this._tex("rindNormal", w, h, (d, N, M) => {
                for (let y = 0; y < M; y++) {
                    const vv = y / M;
                    const k = strength * smooth(0, 0.05, vv) * (1 - smooth(0.95, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(M - 1, y + 1) * N + x];
                        // 【対策】v 方向の符号は (yu - yd) = -dh/dv、つまり
                        //         「V が上を向く」OpenGL 系の規約になる。
                        //         Babylon の接空間は V が下向きなので、そのままだと
                        //         凸と凹が入れ替わる。梨地のような対称なノイズでは
                        //         気付きにくいが、横向きの暗線・傷・花落ち跡は
                        //         はっきり逆になる。焼く側で符号を合わせておく
                        let nx = (xl - xr) * k, ny = (yd - yu) * k, nz = 1;
                        // 【対策】Math.hypot は桁溢れ対策のぶん遅い。200万回
                        //         呼ぶ場所では素直に sqrt で書く
                        const l = Math.sqrt(nx * nx + ny * ny + 1); nx /= l; ny /= l; nz /= l;
                        const i = (y * N + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, true);
        },

        // 板の間（使い込んだ濃い色の板）
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
                        // 年輪は板の長手（u）方向へ伸ばす
                        const w = Noise.fbm3(u * 2.2, v * 22 + off, 3.1, seed + 1, 4);
                        let g = 0.5 + 0.5 * Math.sin(v * 86 + off + w * 8.0);
                        g = Math.pow(g, 1.9);
                        const fib = 0.90 + 0.20 * Noise.fbm3(u * 150, v * 26 + off, 7.7, seed + 3, 2);
                        let r = mix(A[0], B[0], g), gg = mix(A[1], B[1], g), b = mix(A[2], B[2], g);
                        const hi = Math.pow(1 - g, 3.0) * 0.35;
                        r = mix(r, C[0], hi); gg = mix(gg, C[1], hi); b = mix(b, C[2], hi);
                        r *= tone * fib; gg *= tone * fib; b *= tone * fib;
                        // 板の継ぎ目
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

        // ござ（藺草の網代）
        // 【対策】明暗差を付けすぎると将棋盤になる。織りの上下は色ではなく
        //         陰影の差でしかない
        weave(scene, size, seed) {
            const OVER = [0.760, 0.700, 0.480], UNDER = [0.640, 0.575, 0.375], GAP = [0.300, 0.265, 0.180];
            return this._tex("matAlbedo", size, size, (d, N) => {
                const WARP = 120, WEFT = 78;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * WARP, sv = v * WEFT;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.86 + 0.18 * bv) : (0.70 + 0.15 * bu);
                        const gap = smooth(0, 0.11, Math.min(fu, 1 - fu)) * smooth(0, 0.11, Math.min(fv, 1 - fv));
                        const fib = 0.88 + 0.24 * Noise.fbm2u(u * 300, v * 16, 300, seed, 2);
                        const age = 0.86 + 0.28 * Noise.fbm2u(u * 5, v * 4, 5, seed + 9, 3);
                        const Cc = over ? OVER : UNDER;
                        let r = Cc[0] * shade * fib * age;
                        let g = Cc[1] * shade * fib * age;
                        let b = Cc[2] * shade * fib * age;
                        r = mix(GAP[0], r, gap); g = mix(GAP[1], g, gap); b = mix(GAP[2], b, gap);
                        d[i] = clamp(r, 0, 1) * 255;
                        d[i + 1] = clamp(g, 0, 1) * 255;
                        d[i + 2] = clamp(b, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, false);
        },

        // 背景（田んぼのぼけ）。円筒に貼るので u は周方向
        backdrop(scene, size, seed) {
            return this._tex("backdrop", size, size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        // 上：白っぽい空 / 中〜下：稲の緑
                        const sky = 1 - smooth(0.08, 0.52, v);
                        const big = Noise.fbm2u(u * 6, v * 4, 6, seed, 3);
                        const fine = Noise.fbm2u(u * 26, v * 10, 26, seed + 3, 3);
                        let g = 0.58 + 0.14 * big + 0.06 * fine;
                        let r = g * 0.74, b = g * 0.46;
                        r = mix(r, 0.92, sky); g = mix(g, 0.94, sky); b = mix(b, 0.91, sky);
                        // 手前ほど暗く
                        const dk = smooth(0.55, 1.0, v) * 0.20;
                        r *= 1 - dk; g *= 1 - dk; b *= 1 - dk;
                        d[i] = clamp(r, 0, 1) * 255;
                        d[i + 1] = clamp(g, 0, 1) * 255;
                        d[i + 2] = clamp(b, 0, 1) * 255;
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
        constructor(scene, cfg) {
            const T = TextureLab.rind(scene, cfg.textureSize, cfg);
            this.albedoTex = T.albedo; this.ormTex = T.orm; this.normalTex = T.normal;

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("watermelonRind", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                    // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.58;
            m.transparencyMode = OPAQUE;
            // 【対策】スイカの皮は蝋質。クリアコートを切ると布を張ったように
            //         見える。ただし鏡ではないので粗さは残す。ここを 0.05 まで
            //         磨くとハイライトが点になり、そのぶん面が平らに見えて
            //         球が「多面体っぽく」感じられる
            m.clearCoat.isEnabled = true;
            // 【対策】クリアコートを 0.5 / 粗さ 0.17 まで上げると、
            //         ハイライトが白い塊になって一気にビニールのボールに
            //         見える。実物の照りはもっと弱く、広く、模様が透ける
            m.clearCoat.intensity = 0.24 * cfg.wax;
            m.clearCoat.roughness = 0.30;
            m.clearCoat.indexOfRefraction = 1.44;
            // 【対策】誘電体の既定の反射率 0.04 をそのまま使うと、
            //         暗い縞の上でも白い映り込みが均一に乗ってビニールに
            //         見える。少し落とすと果皮の「乾いた蝋」に寄る
            m.metallicF0Factor = 0.72;
            // 【対策】果粉の乗った面は、真横から見たときだけ白く曇る。
            //         これは粗さでは表現できない（粗さは全方位に効く）。
            //         シーンを弱く入れると、輪郭ぎわだけが粉を吹く
            m.sheen.isEnabled = true;
            m.sheen.intensity = 0.13 * cfg.powderK / 0.30;
            m.sheen.roughness = 0.55;
            m.sheen.color = new BABYLON.Color3(0.74, 0.80, 0.64);
            // 【対策】果肉は見えないので SSS は入れない。入れると厚い皮が
            //         光を通し、中身の詰まった重量感が消える
            this.rind = m;

            const s = new BABYLON.PBRMaterial("watermelonStem", scene);
            s.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            s.metallic = 0.0;
            s.roughness = 0.66;
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
                m.sheen.isEnabled = false;
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
                m.sheen.isEnabled = false;
            } else {
                m.albedoTexture = this.albedoTex;
                m.albedoColor = new C3(1, 1, 1);
                m.metallicTexture = this.ormTex;
                m.roughness = 1.0;              // 実値は ORM の G
                m.clearCoat.isEnabled = true;
                m.sheen.isEnabled = true;
            }
        }

        dispose() {
            this.rind.dispose(true, false);
            this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. WaterMelon
    // =================================================================
    class WaterMelon {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.R = cfg.radius * rng.range(0.94, 1.06);
            this.H = this.R * cfg.elong * rng.range(0.975, 1.025);
            this.seed = seed >>> 0;
            this.nseed = rng.int(900000) + 1000;
            // 【対策】濃緑の縞の下には維管束が走っており、実物では縞の
            //         位置がわずかな稜になっている。稜の位相を乱数にすると
            //         模様と凹凸が無関係にずれ、どちらも嘘に見える。
            //         テクスチャの縞（cell 中心 ≒ 0.5）に山が来るよう固定する
            this.ribPhase = Math.PI + rng.gauss(0, 0.10);
            this.dipStem = cfg.dipStem * rng.range(0.85, 1.20);
            this.dipBlossom = cfg.dipBlossom * rng.range(0.8, 1.3);
            this.a1 = cfg.asym * rng.range(0.6, 1.4);
            this.p1 = rng.range(0, TAU);
            this.stemAz = rng.range(0, TAU);
            this.tilt = rng.gauss(0, 0.045);
            this.tiltAz = rng.range(0, TAU);

            this.parts = [];
            this._buildBody(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("watermelon", scene);
            for (const m of this.parts) m.parent = this.root;
            // 【対策】テクスチャは品種で共有なので、複数個並べると同じ面が
            //         同じ向きに並んで一目で作り物とわかる。Y 軸まわりに
            //         individually 回してから傾ける
            this.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                this.tilt * Math.cos(this.tiltAz),
                rng.range(0, TAU),
                this.tilt * Math.sin(this.tiltAz));
        }

        // 稜・低周波のうねり・非対称をまとめた倍率
        // 【対策】両極で 1 に戻すこと。戻さないと極が phi ごとに上下して
        //         キャップの円板がひしゃげ、法線が破綻する
        modAt(u, phi) {
            const cfg = this.cfg;
            const env = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.45);
            const rib = cfg.ribAmp * Math.cos(cfg.ribs * phi + this.ribPhase + 0.45 * u) * env;
            const lump = cfg.lump * (Noise.fbm3(Math.cos(phi) * 1.15, Math.sin(phi) * 1.15,
                u * 1.7, this.nseed, 3) - 0.5) * 2 * env;
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * u);
            return 1 + rib + lump + asym;
        }

        // u=0 が果梗側の極、u=1 が花落ち側の極
        // 【対策】球にすると必ずボールになる。かといって制御点を手で置くと
        //         今度は角の丸い立方体になりやすい。|r|^e + |y|^e = 1 の
        //         超楕円をパラメータ表示（r = sin^(2/e), y = cos^(2/e)）で
        //         起こせば、指数ひとつで「球より少しだけ張った」形が作れる
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
            // 【対策】上下対称の回転体は、どれだけ表面を作り込んでも
            //         ボールに見える。実物は下半分がわずかに細い卵形
            const taper = 1 - cfg.taper * smooth(0.30, 1.0, u);
            const r = this.R * r0 * k * taper;
            let y = this.H * y0 * k;
            // 果梗側のくぼみ（浅い皿）と花落ち側の小さなくぼみ
            // 【対策】極まわりの超楕円はもともとほぼ平ら。くぼみの減衰を
            //         幅 0.17 のような広い smoothstep で書くと、プロファイル
            //         自身の下がりとほぼ相殺して 1mm も凹まない。ガウス型で
            //         幅 0.05 前後に絞ると、リムのある「皿」がちゃんと出る
            y -= this.dipStem * this.R * Math.exp(-Math.pow(u / cfg.dipWStem, 2));
            y += this.dipBlossom * this.R * Math.exp(-Math.pow((1 - u) / cfg.dipWBlossom, 2));
            return { r, y };
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            // 【対策】u=0 と u=1 をそのまま使うと半径 0 のリングができ、
            //         極まわりの三角形がすべて面積 0 になる。法線が 0 のまま
            //         残って極が真っ黒になるので、リングは極からわずかに
            //         内側で切り、極そのものはキャップ頂点に任せる
            const EPS = 0.004;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const u = EPS + (1 - 2 * EPS) * (i / N);
                const ring = [];
                let sy = 0;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const sp = this.surfaceAt(u, phi);
                    ring.push(new V3(Math.cos(phi) * sp.r, sp.y, Math.sin(phi) * sp.r));
                    sy += sp.y;
                }
                rings.push(ring);
                centers.push(new V3(0, sy / (M + 1), 0));
            }
            centers[0] = new V3(0, this.surfaceAt(0, 0).y, 0);
            centers[N] = new V3(0, this.surfaceAt(1, 0).y, 0);

            const mesh = sweep("watermelonBody", rings, centers, null, this.scene);
            mesh.material = skin.rind;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // ---- 果梗（折り取られた短い軸）--------------------------------
        // 【対策】まっすぐな円柱を生やすと画鋲になる。実物は少し曲がって
        //         いて、付け根が張り出し、先端が乾いて潰れている
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const L = cfg.stemLen * this.R * rng.range(0.85, 1.25);
            const R0 = cfg.stemRad * this.R * rng.range(0.9, 1.15);
            const bend = cfg.stemBend * rng.range(0.6, 1.4);
            const az = this.stemAz;
            const dirX = Math.cos(az), dirZ = Math.sin(az);
            const base = this.surfaceAt(0, 0).y - this.R * 0.030;

            const kink = rng.range(0.7, 1.4);
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const y = base + L * s * (1 - 0.10 * s);
                // 【対策】円弧一本で曲げると針金の U 字になる。実物は
                //         途中で折れ曲がり、横にもねじれて乾いている
                const off = bend * L * (0.80 * s * s + 0.16 * Math.sin(s * 5.4));
                const lat = bend * L * 0.30 * kink * Math.sin(s * 7.2 + 1.1);
                const cx = dirX * off - dirZ * lat, cz = dirZ * off + dirX * lat;
                // 付け根の張り出しでくぼみとの継ぎ目を隠す
                const r = R0 * (1 + 2.10 * Math.pow(1 - smooth(0, 0.26, s), 1.8)
                    - 0.42 * s + 0.14 * smooth(0.82, 1.0, s));
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    // 縦に走る5本の溝（乾いて痩せるので深い）
                    const rr = r * (1 + 0.155 * Math.cos(5 * phi + 0.7)
                        + 0.05 * Math.cos(11 * phi));
                    ring.push(new V3(cx + Math.cos(phi) * rr, y, cz + Math.sin(phi) * rr));
                }
                rings.push(ring); centers.push(new V3(cx, y, cz));
            }
            const SC = cfg.stemCol, CU = cfg.stemCut;
            const nsd = this.nseed + 77;
            const colsFn = (v, u) => {
                const g = 0.86 + 0.28 * Noise.fbm3(Math.cos(u * TAU) * 8, Math.sin(u * TAU) * 8, v * 9, nsd, 2);
                // 溝の底は暗い
                const gr = Math.pow(0.5 + 0.5 * Math.cos(5 * u * TAU + 0.7), 3.0);
                const cut = smooth(0.78, 1.0, v);
                const dk = 0.70 + 0.30 * gr;
                return [
                    srgb(mix(SC[0], CU[0], cut) * g * dk),
                    srgb(mix(SC[1], CU[1], cut) * g * dk),
                    srgb(mix(SC[2], CU[2], cut) * g * dk)
                ];
            };
            const mesh = sweep("watermelonStem", rings, centers, colsFn, this.scene);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
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

        // 指定した高さに接地させる
        seat(x, z, topY) {
            this.root.position.set(x, 0, z);
            this.root.computeWorldMatrix(true);
            const b = this.worldBounds();
            this.root.position.y = topY - b.mny;
            this.root.computeWorldMatrix(true);
        }

        dispose() {
            for (const m of this.parts) m.dispose();
            if (this.root) this.root.dispose();
            this.parts.length = 0;
        }
    }

    // =================================================================
    // 7. Stage
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.90, 0.93, 0.88, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.75;
    scene.environmentIntensity = 0.62;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.32, 1.20, 62, new V3(0, 11, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.56;
    camera.wheelPrecision = 6;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 4;
    camera.maxZ = 600;
    camera.lowerRadiusLimit = 22;
    camera.upperRadiusLimit = 130;
    camera.lowerBetaLimit = 0.15;
    camera.upperBetaLimit = 1.53;
    scene.cameraToUseForPointers = camera;

    // 背景の円筒（田んぼのぼけ）
    // 【対策】Layer で背景を貼ると深度を持たないので被写界深度が効かない。
    //         遠くに置いた円筒にすれば、そのまま自然にぼけてくれる
    // 【対策】MeshBuilder の円筒は v の向き（上が 0 か 1 か）が版によって
    //         違ううえ、テクスチャ側の invertY とも掛け算になる。空が下に
    //         来る事故を避けるため、UV を自分で書ける掃引で作る
    const cyc = (function () {
        const M = 72, RAD = 172, TOP = 210, BOT = -50;
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
        const mm = new BABYLON.PBRMaterial("cycMat", scene);
        mm.unlit = true;                 // 照明の影響を受けない背景板にする
        mm.albedoTexture = TextureLab.backdrop(scene, 512, 909);
        mm.backFaceCulling = false;      // 内側から見るので両面
        m.material = mm;
        m.isPickable = false;
        return m;
    })();

    // 板の間
    const table = BABYLON.MeshBuilder.CreateBox("table", {
        width: GLOBAL.tableW, height: GLOBAL.tableH, depth: GLOBAL.tableD
    }, scene);
    table.position.y = -GLOBAL.tableH / 2;
    const tableMat = new BABYLON.PBRMaterial("tableMat", scene);
    tableMat.albedoTexture = TextureLab.wood(scene, 1024, 31);
    tableMat.albedoTexture.uScale = 1.6; tableMat.albedoTexture.vScale = 1.2;
    tableMat.metallic = 0.0;
    tableMat.roughness = 0.80;
    tableMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
    table.material = tableMat;
    table.receiveShadows = true;

    // ござ
    const mat = BABYLON.MeshBuilder.CreateBox("mat", {
        width: GLOBAL.matW, height: GLOBAL.matH, depth: GLOBAL.matD
    }, scene);
    mat.position.y = GLOBAL.matH / 2;
    const matMat = new BABYLON.PBRMaterial("matMat", scene);
    matMat.albedoTexture = TextureLab.weave(scene, 1024, 77);
    matMat.metallic = 0.0;
    matMat.roughness = 0.80;
    matMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
    mat.material = matMat;
    mat.receiveShadows = true;
    const MAT_TOP = GLOBAL.matH;

    // =================================================================
    // 8. Lighting
    // =================================================================
    const key = new BABYLON.DirectionalLight("key", new V3(-0.42, -0.88, 0.58).normalize(), scene);
    key.position = new V3(34, 56, -40);
    key.intensity = 2.2;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.96);
    // 【対策】平行光の鏡面を 1.0 近くにすると、球の上に白い豆が乗る
    key.specular = new BABYLON.Color3(0.42, 0.41, 0.39);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fill", new V3(0.90, -0.28, -0.52).normalize(), scene);
    fillL.intensity = 0.85;
    fillL.diffuse = new BABYLON.Color3(0.96, 1.0, 0.94);
    fillL.specular = new BABYLON.Color3(0.10, 0.10, 0.09);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.45;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    // 【対策】下からの照り返しに緑を混ぜると、屋外で撮った写真の空気になる
    amb.groundColor = new BABYLON.Color3(0.62, 0.70, 0.55);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 40;
    sg.depthScale = 60;
    sg.darkness = 0.42;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.04;
    ip.contrast = 1.03;
    ip.vignetteEnabled = false;

    // =================================================================
    //  生成
    // =================================================================
    let items = [], curVariety = START_VARIETY, curSeed = START_SEED, curCfg = null;
    const skinCache = {};
    let onRebuilt = null;

    // 肌理の凹凸の強さと、法線の向き。実機で見ながら合わせられるようにする
    const BUMPS = [
        { label: "弱", level: 0.32 },
        { label: "中", level: 0.58 },
        { label: "強", level: 0.95 },
        { label: "最強", level: 1.50 }
    ];
    let bumpIdx = 1, invY = false;
    function applyRelief() {
        for (const k in skinCache) {
            const m = skinCache[k].rind;
            if (m.bumpTexture) m.bumpTexture.level = BUMPS[bumpIdx].level;
            m.invertNormalMapY = invY;
        }
    }
    const DEBUGS = ["通常", "白クレイ", "法線マップ"];
    let dbgIdx = 0;
    function applyDebug() {
        for (const k in skinCache) skinCache[k].setDebug(dbgIdx);
    }

    function build(varietyKey, seed) {
        for (const it of items) it.dispose();
        items = [];
        const cfg = buildConfig(varietyKey, seed);
        curCfg = cfg;

        // テクスチャは品種だけで決まる。個体差で焼き直すと GUI 操作のたびに固まる
        let skin = skinCache[varietyKey];
        if (!skin) { skin = new Skin(scene, cfg); skinCache[varietyKey] = skin; }

        for (let i = 0; i < cfg.total; i++) {
            items.push(new WaterMelon(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        // 横に並べて接地させる
        const pitch = cfg.radius * 2.25;
        for (let i = 0; i < items.length; i++) {
            const e = items[i];
            const x = (i - (items.length - 1) / 2) * pitch;
            const z = (i % 2 === 0 ? 1 : -1) * cfg.radius * 0.12;
            e.seat(x, z, MAT_TOP);
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);

        const h = items[0].H;
        camera.target.set(0, h * 1.05, 0);
        camera.radius = cfg.radius * (items.length > 1 ? 6.4 : 5.4);

        applyDebug();
        applyRelief();
        if (onRebuilt) onRebuilt();
        console.log("[Watermelon]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.total, "個");
    }

    build(START_VARIETY, START_SEED);

    if (GLOBAL.useSSAO) {
        // 【対策】ござとの接点に影が入らないと、球が宙に浮いて見える
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 3.4;
        ssao.totalStrength = 0.95;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 300;
        ssao.minZAspect = 0.28;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.92;
    dp.bloomWeight = 0.045;
    dp.bloomKernel = 44;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.12;
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
        idle: "#12240f", active: "#2f7a1f", edge: "#2c4426",
        text: "#eefbe6", sub: "#a9c79c", accent: "#8fe06a"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "256px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(8,18,6,0.82)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "62px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "224px"; panel.isVertical = true;
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

    addLabel("WATERMELON", 11, COL.sub, "18px");
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
    const dbgBtn = addButton("dbg", "表示: 通常", () => {
        dbgIdx = (dbgIdx + 1) % DEBUGS.length;
        applyDebug(); applyRelief();
        dbgBtn.background = dbgIdx ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "表示: " + DEBUGS[dbgIdx];
    });
    const bumpBtn = addButton("bump", "肌理の凹凸: 中", () => {
        bumpIdx = (bumpIdx + 1) % BUMPS.length;
        applyRelief();
        bumpBtn.textBlock.text = "肌理の凹凸: " + BUMPS[bumpIdx].label;
    });
    // 【対策】法線マップの緑チャンネルの向きは、UVの向きや invertY との
    //         掛け算で環境依存になりうる。白クレイ表示と組み合わせて
    //         切り分けられるよう、実機で反転できるようにしておく
    const invBtn = addButton("inv", "凹凸の向き: 標準", () => {
        invY = !invY;
        applyRelief();
        invBtn.background = invY ? COL.active : COL.idle;
        invBtn.textBlock.text = "凹凸の向き: " + (invY ? "反転" : "標準");
    });
    const texBtn = addButton("tex", "テクスチャ: 2048", () => {
        GLOBAL.textureSize = (GLOBAL.textureSize >= 2048) ? 1024 : 2048;
        for (const k in skinCache) { skinCache[k].dispose(); delete skinCache[k]; }
        build(curVariety, curSeed); highlight();
        texBtn.textBlock.text = "テクスチャ: " + GLOBAL.textureSize;
    });
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

    const info = addLabel("", 12, COL.sub, "44px");
    onRebuilt = () => {
        if (!info) return;
        const e = items[0];
        if (!e) { info.text = ""; return; }
        info.text = curCfg.label + " / " + items.length + "個\n"
            + "径 " + (e.R * 2).toFixed(1) + "cm  高 " + (e.H * 2).toFixed(1) + "cm\n"
            + "縞 " + curCfg.stripes + "本  seed: " + curSeed;
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
    toggleBtn.background = "rgba(8,18,6,0.82)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(8,18,6,0.82)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;