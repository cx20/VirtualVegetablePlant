// =====================================================================
//  Photoreal Cauliflower (whole head)  /  写実的なカリフラワー（株丸ごと）
//  BUILD: cauliflower-A
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  ブロッコリー版の骨格（散房花序の再帰 → 花蕾ドーム → 粒）を流用して
//  いますが、カリフラワーは同じ設定のまま色を白くしても絶対に似ません。
//  実物を見比べて変えたのは次の5点です。
//
//  1. 頭が「房の集まり」ではなく「ひと塊」
//     ブロッコリーは房と房のあいだが枝まで裂けているが、カリフラワーの
//     花蕾は互いに押し合って固まっており、境目は浅い溝でしかない。
//     縄張りを削らず（areaKeep = 1.0）、房を大きく重ねる（domeSwell 1.22）
//
//  2. 粒が「独立した蕾」ではなく「融合した粒々」
//     ブロッコリーは球状の蕾が1個ずつ立っているが、カリフラワーの表面は
//     粒が潰れて繋がっている。粒を法線方向へ潰し（budAspect 0.52）、
//     間隔より大きい半径で並べて互いにめり込ませる
//
//  3. 谷が暗くない
//     白いので、谷に落ちても光が回り込む。ブロッコリーと同じ遮蔽を
//     掛けると、白い塊に黒い墨を流したようになる。
//     遮蔽を半分以下にし、下限も 0.20 → 0.56 まで上げる
//
//  4. 葉柄の切り跡
//     太い葉柄を切った跡が、頭のふちの下に短く突き出している。
//     葉柄（中肋）は断面を持った扁平な実体で、先端に淡い切り口が付く。
//     立ち上がった葉身も作れる（leafCutRatio を下げる）が、頭部との
//     干渉を詰め切れていないので、既定では切り跡だけにしてある。
//     【対策】葉は茎から生えるのに対し、頭部は茎の上に覆いかぶさっている。
//     付け根の高さと立ち上がり角によっては葉が花蕾を下から突き破る。
//     包絡面の内側へ入った時点で芯線を打ち切り、根元から入る個体は捨てる
//
//  5. 立てて置く
//     カリフラワーは葉が輪になって外へ張り出しているので、その上に座る。
//     物理の凸包にも葉柄の芯線を入れて、実物と同じ据わり方にする
// =====================================================================

var createScene = async function () {

    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        snow: {
            label: "スノークラウン（白）",

            // --- 主茎（ほとんど葉に隠れる）
            stemH: 4.20,
            stemR: 2.35,
            stemTopR: 2.30,
            stemFlutes: 7,
            fluteAmp: 0.050,
            stemBell: 0.14,
            stemLobe: 0.050,
            scarCount: 0,          // 葉柄そのものを立てるので葉痕は使わない
            scarSize: 0.0,

            // --- 頭部の包絡
            headRx: 6.60,
            headFlat: 0.86,        // ブロッコリーより丸い
            headCy: 4.20,
            elevMin: -0.78,        // 葉の中へ深く潜り込む
            envTuck: 0.62,

            // --- 花序の再帰
            rootSplitMin: 5, rootSplitMax: 7,
            splitMin: 3, splitMax: 4,
            // 【対策】カリフラワーの花蕾は互いに押し合って固まっている。
            //         ブロッコリーのように縄張りを削ると裂け目が枝まで
            //         抜けてしまう。削らず、房を大きく重ねる
            areaKeep: 1.00,
            areaTerm: 6.20,        // 房は大きい（径 2.5〜3cm の瘤）
            spreadK: 0.94,
            insetPow: 1.70, insetMax: 0.92, insetCap: 0.760,
            branchPow: 0.86, branchScale: 1.00,
            wobble: 0.038,
            liftBias: 0.20,
            cupFlare: 0.80, forkFlare: 0.24, branchFlat: 0.18,

            // --- 花蕾ドーム
            domeSwell: 1.22,
            domeSink: 0.26,
            domeSquash: 0.90,
            lumpAmp: 0.155, lumpFreq: 1.70, lumpOct: 2,
            domeSegU: 24, domeSegV: 14,

            // --- 粒（融合した粒々）
            budR: 0.105,
            budSpacing: 0.90,
            // 【対策】法線方向へ潰す。1.0 を超えると独立した蕾が林立して
            //         ブロッコリーに戻る
            budAspect: 0.52,
            budJitter: 0.26,
            budCullDot: 0.72,
            budScatter: 0.40,      // 粒の位置を散らす量（螺旋つぶし）

            // --- 葉
            leafCount: 12,
            // 【対策】1.00 = 葉身を付けず、葉柄を切った跡だけにする。
            //         下げると立ち上がった葉身が生えるが、頭部との
            //         干渉が難しく、今は「白いブロッコリー」の姿に寄せている
            leafCutRatio: 1.00,
            ribW: 0.86, ribT: 0.38,
            ribLenCut: 3.2, ribLenFull: 13.0,
            bladeW: 1.95, bladeCup: 0.40, bladeWave: 0.42, leafVeins: 3.2,

            // --- 色（sRGB）
            budTop: [0.930, 0.912, 0.845],
            budSide: [0.822, 0.798, 0.718],
            budDeep: [0.560, 0.536, 0.462],
            budYellow: [0.880, 0.840, 0.640],
            budPurple: [0.640, 0.582, 0.545],
            curdSkin: [0.665, 0.640, 0.565],
            branchHi: [0.700, 0.790, 0.470],
            branchLo: [0.560, 0.660, 0.390],
            stemHi: [0.760, 0.845, 0.520],
            stemLo: [0.560, 0.665, 0.340],
            stemScar: [0.860, 0.895, 0.660],
            cutRind: [0.360, 0.500, 0.200],
            cutFlesh: [0.895, 0.905, 0.735],
            cutCore: [0.815, 0.860, 0.660],
            cutVein: [0.640, 0.720, 0.470],
            bladeTop: [0.225, 0.360, 0.175],
            bladeVein: [0.585, 0.680, 0.395],
            ribCol: [0.712, 0.808, 0.455],
            ribCut: [0.880, 0.905, 0.735],

            yellowAmt: 0.20, purpleAmt: 0.10,
            budRough: 0.84, stemRough: 0.42, stemCoat: 0.26
        },

        bisei: {
            label: "美星（きめ細かい）",
            stemH: 3.90, stemR: 2.20, stemTopR: 2.16,
            stemFlutes: 7, fluteAmp: 0.046, stemBell: 0.13, stemLobe: 0.046,
            scarCount: 0, scarSize: 0.0,
            headRx: 6.10, headFlat: 0.90, headCy: 3.95, elevMin: -0.74, envTuck: 0.60,
            rootSplitMin: 5, rootSplitMax: 7,
            splitMin: 3, splitMax: 4,
            areaKeep: 1.00, areaTerm: 4.40, spreadK: 0.94,
            insetPow: 1.72, insetMax: 0.92, insetCap: 0.770,
            branchPow: 0.86, branchScale: 1.00,
            wobble: 0.034, liftBias: 0.22,
            cupFlare: 0.78, forkFlare: 0.22, branchFlat: 0.17,
            domeSwell: 1.24, domeSink: 0.22, domeSquash: 0.92,
            lumpAmp: 0.135, lumpFreq: 2.10, lumpOct: 2,
            domeSegU: 24, domeSegV: 14,
            budR: 0.082, budSpacing: 0.88, budAspect: 0.50,
            budJitter: 0.24, budCullDot: 0.70, budScatter: 0.42,
            leafCount: 11, leafCutRatio: 1.00,
            ribW: 0.80, ribT: 0.36, ribLenCut: 3.0, ribLenFull: 12.0,
            bladeW: 1.80, bladeCup: 0.38, bladeWave: 0.40, leafVeins: 3.4,
            budTop: [0.948, 0.932, 0.878],
            budSide: [0.848, 0.828, 0.756],
            budDeep: [0.592, 0.570, 0.500],
            budYellow: [0.895, 0.858, 0.665],
            budPurple: [0.650, 0.596, 0.560],
            curdSkin: [0.695, 0.672, 0.600],
            branchHi: [0.715, 0.800, 0.482],
            branchLo: [0.575, 0.672, 0.400],
            stemHi: [0.775, 0.855, 0.535],
            stemLo: [0.575, 0.678, 0.352],
            stemScar: [0.868, 0.900, 0.672],
            cutRind: [0.365, 0.505, 0.205],
            cutFlesh: [0.902, 0.910, 0.745],
            cutCore: [0.822, 0.866, 0.668],
            cutVein: [0.648, 0.726, 0.478],
            bladeTop: [0.240, 0.375, 0.185],
            bladeVein: [0.600, 0.692, 0.408],
            ribCol: [0.725, 0.818, 0.468],
            ribCut: [0.888, 0.910, 0.745],
            yellowAmt: 0.14, purpleAmt: 0.07,
            budRough: 0.83, stemRough: 0.42, stemCoat: 0.26
        },

        orange: {
            label: "オレンジブーケ（橙）",
            stemH: 4.10, stemR: 2.25, stemTopR: 2.20,
            stemFlutes: 7, fluteAmp: 0.050, stemBell: 0.14, stemLobe: 0.050,
            scarCount: 0, scarSize: 0.0,
            headRx: 6.10, headFlat: 0.84, headCy: 4.05, elevMin: -0.76, envTuck: 0.60,
            rootSplitMin: 5, rootSplitMax: 6,
            splitMin: 3, splitMax: 4,
            areaKeep: 1.00, areaTerm: 5.60, spreadK: 0.94,
            insetPow: 1.68, insetMax: 0.92, insetCap: 0.760,
            branchPow: 0.86, branchScale: 1.00,
            wobble: 0.040, liftBias: 0.20,
            cupFlare: 0.80, forkFlare: 0.24, branchFlat: 0.18,
            domeSwell: 1.21, domeSink: 0.28, domeSquash: 0.90,
            lumpAmp: 0.165, lumpFreq: 1.80, lumpOct: 2,
            domeSegU: 24, domeSegV: 14,
            budR: 0.100, budSpacing: 0.90, budAspect: 0.54,
            budJitter: 0.28, budCullDot: 0.72, budScatter: 0.40,
            leafCount: 11, leafCutRatio: 1.00,
            ribW: 0.82, ribT: 0.37, ribLenCut: 3.1, ribLenFull: 12.4,
            bladeW: 1.88, bladeCup: 0.40, bladeWave: 0.44, leafVeins: 3.2,
            budTop: [0.945, 0.690, 0.310],
            budSide: [0.830, 0.545, 0.215],
            budDeep: [0.545, 0.330, 0.135],
            budYellow: [0.955, 0.790, 0.375],
            budPurple: [0.640, 0.430, 0.280],
            curdSkin: [0.665, 0.420, 0.170],
            branchHi: [0.700, 0.780, 0.460],
            branchLo: [0.560, 0.650, 0.380],
            stemHi: [0.760, 0.840, 0.515],
            stemLo: [0.560, 0.660, 0.335],
            stemScar: [0.860, 0.890, 0.655],
            cutRind: [0.360, 0.495, 0.198],
            cutFlesh: [0.895, 0.900, 0.730],
            cutCore: [0.815, 0.855, 0.655],
            cutVein: [0.640, 0.715, 0.465],
            bladeTop: [0.230, 0.360, 0.175],
            bladeVein: [0.590, 0.680, 0.395],
            ribCol: [0.715, 0.808, 0.458],
            ribCut: [0.882, 0.902, 0.732],
            yellowAmt: 0.30, purpleAmt: 0.06,
            budRough: 0.84, stemRough: 0.42, stemCoat: 0.26
        }
    };

    const GLOBAL = {
        pose: 0,                   // 0 = 立てる（写真の向き） / 1 = 寝かせる
        quality: 1,                // 0 = 粗い / 1 = 標準 / 2 = 細かい

        // ざる
        showBasket: true,
        basketRim: 15.0,
        basketDepth: 5.0,
        basketThick: 0.50,
        basketSegments: 96,
        basketRings: 34,

        // 物理（ざるへ落として据わらせる）
        // 【対策】1単位 = 1cm なので重力も cm/s² で与える。9.8 のままだと
        //         100 倍ゆっくり沈み、水中を漂っているように見える
        gravity: 600,
        physicsHz: 120,
        dropHeight: 2.6,
        pieceMass: 0.45,
        friction: 0.95,
        restitution: 0.01,
        linearDamping: 0.22,
        angularDamping: 0.94,
        settleSpeed: 3.0, settleSpin: 3.0, settleHold: 0.40,
        settleTimeout: 7.0,

        // 遮蔽（頂点に焼く AO）
        // 【対策】ここが弱いと、粒が何万個あっても平板な緑の塊に見える。
        //         逆に強すぎると房の谷が真っ黒に潰れて炭になる
        // 【対策】白いので谷まで光が回り込む。ブロッコリーと同じ遮蔽を
        //         掛けると、白い塊に墨を流したようになる
        aoStrength: 0.48,
        aoFloor: 0.56,
        aoRange: 3.0,
        skinShrink: 0.95,          // 下地を粒より奥へ引っ込める割合              // 何倍の半径まで隣のドームを見るか

        stemSides: 72,
        stemRings: 46,
        branchSides: 12,
        branchRings: 9,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.072,
        dofFStop: 2.6,

        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    // 粒の細かさ。間隔と半径を同時に動かす
    // 【対策】間隔だけ変えると密度が変わって「まばらな粒」「団子」になる。
    //         見た目を保ったまま数だけ増減させるには半径も同率で動かす
    const QUALITY = [
        { label: "粗い", k: 1.34 },
        { label: "標準", k: 1.00 },
        { label: "細かい", k: 0.82 }
    ];

    const START_VARIETY = "snow";
    const START_SEED = 20260808;
    const BUILD = "cauliflower-B";

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        const q = QUALITY[clamp(cfg.quality, 0, 2)].k;
        cfg.budR = cfg.budR * q;
        // 包絡面の面積。上半球 + 赤道下の張り出しぶんを 0.78 で見積もる
        cfg.headArea = TAU * cfg.headRx * cfg.headRx * 0.95;
        cfg.headRy = cfg.headRx * cfg.headFlat;
        return cfg;
    }

    // 主茎の半径プロファイル（切り口 → 分岐）。相対値
    // 【対策】切り口 1.00 に対し、1/3 上がった所が 0.75 まで細る。
    //         この「くびれ」が無いと円柱になり、ブロッコリーに見えない
    // 枝の起点を茎のどこに潜らせるか
    // 寝かせたとき、茎の先（切り口）が向く world 方向。
    // 既定カメラ（α = -1.05 / β = 1.16）で画面の右やや下になるよう逆算した値
    const POSE_LIE = new BABYLON.Vector3(-0.890, 0.180, -0.421);

    const BRANCH_ROOT_S = 0.84;

    const STEM_PROFILE = [1.000, 0.862, 0.792, 0.760, 0.774, 0.828, 0.906, 0.990];

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
    // --- 素のベクトル演算。Vector3 を何十万回も作ると GC で固まる ------
    const vec = (x, y, z) => ({ x, y, z });
    const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
    const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const vmul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
    const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const vcross = (a, b) => ({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    });
    const vlen = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    function vnorm(a) { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }

    // n に直交する2軸。n が上向きに近いときだけ基準軸を切り替える
    function basisFrom(n) {
        const a = Math.abs(n.y) < 0.90 ? vec(0, 1, 0) : vec(1, 0, 0);
        const e1 = vnorm(vcross(a, n));
        const e2 = vcross(n, e1);
        return { e1, e2 };
    }

    // t を軸に、開き角 ang・方位 phi の方向を作る
    function coneDir(t, ang, phi, e1, e2) {
        const s = Math.sin(ang), c = Math.cos(ang);
        return vnorm(vec(
            t.x * c + (e1.x * Math.cos(phi) + e2.x * Math.sin(phi)) * s,
            t.y * c + (e1.y * Math.cos(phi) + e2.y * Math.sin(phi)) * s,
            t.z * c + (e1.z * Math.cos(phi) + e2.z * Math.sin(phi)) * s
        ));
    }

    // --- 頂点バッファ -------------------------------------------------
    // 【対策】枝も蕾も1枚のメッシュにまとめる。粒だけで数十万頂点になるので
    //         配列 push ではなく型付き配列に直接書く。容量は足りなくなったら倍にする
    class MeshBuf {
        constructor(maxV, maxT) {
            maxV = Math.max(64, maxV | 0); maxT = Math.max(64, maxT | 0);
            this.pos = new Float32Array(maxV * 3);
            this.nrm = new Float32Array(maxV * 3);
            this.col = new Float32Array(maxV * 4);
            this.idx = new Uint32Array(maxT * 3);
            this.nv = 0; this.nt = 0;
        }
        _growV() {
            const m = (this.pos.length / 3) * 2;
            const p = new Float32Array(m * 3); p.set(this.pos); this.pos = p;
            const n = new Float32Array(m * 3); n.set(this.nrm); this.nrm = n;
            const c = new Float32Array(m * 4); c.set(this.col); this.col = c;
        }
        _growT() {
            const m = (this.idx.length / 3) * 2;
            const a = new Uint32Array(m * 3); a.set(this.idx); this.idx = a;
        }
        vert(x, y, z, nx, ny, nz, r, g, b) {
            if ((this.nv + 1) * 3 > this.pos.length) this._growV();
            const i = this.nv++, p = i * 3, q = i * 4;
            this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
            this.nrm[p] = nx; this.nrm[p + 1] = ny; this.nrm[p + 2] = nz;
            this.col[q] = r; this.col[q + 1] = g; this.col[q + 2] = b; this.col[q + 3] = 1;
            return i;
        }
        tri(a, b, c) {
            if ((this.nt + 1) * 3 > this.idx.length) this._growT();
            const t = this.nt++ * 3;
            this.idx[t] = a; this.idx[t + 1] = b; this.idx[t + 2] = c;
        }
        quad(a, b, c, d) { this.tri(a, c, b); this.tri(b, c, d); }

        // 【対策】巻き順を手で合わせようとすると、掃引・ドーム・粒・葉痕で
        //         必ずどれか裏返る。法線は全部こちらで解析的に持っているので、
        //         「面法線と頂点法線が同じ側を向いているか」で判定して
        //         合わない側へ倒す。Babylon の ComputeNormals は
        //         (P1-P2)×(P3-P2) を面法線とするので、その式に揃える
        orient() {
            const P = this.pos, N = this.nrm, I = this.idx;
            let flipped = 0;
            for (let t = 0; t < this.nt; t++) {
                const i0 = I[t * 3] * 3, i1 = I[t * 3 + 1] * 3, i2 = I[t * 3 + 2] * 3;
                const ax = P[i0] - P[i1], ay = P[i0 + 1] - P[i1 + 1], az = P[i0 + 2] - P[i1 + 2];
                const bx = P[i2] - P[i1], by = P[i2 + 1] - P[i1 + 1], bz = P[i2 + 2] - P[i1 + 2];
                const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
                const nx = N[i0] + N[i1] + N[i2], ny = N[i0 + 1] + N[i1 + 1] + N[i2 + 1];
                const nz = N[i0 + 2] + N[i1 + 2] + N[i2 + 2];
                if (fx * nx + fy * ny + fz * nz < 0) {
                    const a = I[t * 3 + 1]; I[t * 3 + 1] = I[t * 3 + 2]; I[t * 3 + 2] = a;
                    flipped++;
                }
            }
            return flipped;
        }

        toMesh(name, scene) {
            this.orient();
            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = this.pos.slice(0, this.nv * 3);
            vd.normals = this.nrm.slice(0, this.nv * 3);
            vd.colors = this.col.slice(0, this.nv * 4);
            vd.indices = this.idx.slice(0, this.nt * 3);
            vd.applyToMesh(mesh, false);
            // 【対策】頂点カラーを stride 4 で入れると hasVertexAlpha が立ち、
            //         不透明なのに透過パスへ回される。透過パスは深度書き込みが
            //         切られるので、粒どうしが互いを正しく隠せなくなる
            mesh.hasVertexAlpha = false;
            return mesh;
        }
    }

    // --- 巻き順の自動判定・法線の溶接（ざる用）------------------------
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
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // --- 正二十面体（蕾の粒の素）--------------------------------------
    // 【対策】粒1個は画面上で数ピクセル。球で作ると面数が10倍になるだけで
    //         違いが見えない。正二十面体を「法線＝頂点方向」で貼れば、
    //         シルエットは20面でも陰影は球に見える
    const ICO = (function () {
        const g = (1 + Math.sqrt(5)) / 2;
        const raw = [
            [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0],
            [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g],
            [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]
        ];
        const V = raw.map((p) => vnorm(vec(p[0], p[1], p[2])));
        const F = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
        ];
        return { V, F };
    })();

    // --- 掃引管 -------------------------------------------------------
    // path: 中心線の点列 / radii: 各点の半径 / colFn(s, phi, p) → [r,g,b] (sRGB)
    // 【対策】フレームを毎回 basisFrom() で作り直すと、中心線が曲がった
    //         ところで基準軸が飛び、リング間で1周ぶんねじれる。
    //         前のリングの法線を投影して運ぶ（回転最小フレーム）
    function tube(buf, path, radii, sides, colFn, shapeFn, capEnd, endNormal) {
        const N = path.length;
        if (N < 2) return null;
        const T = [];
        for (let i = 0; i < N; i++) {
            const a = path[Math.max(0, i - 1)], b = path[Math.min(N - 1, i + 1)];
            T.push(vnorm(vsub(b, a)));
        }
        const NR = [], BR = [];
        let n0 = basisFrom(T[0]).e1;
        for (let i = 0; i < N; i++) {
            let n = vsub(n0, vmul(T[i], vdot(n0, T[i])));
            if (vlen(n) < 1e-4) n = basisFrom(T[i]).e1;
            n = vnorm(n);
            NR.push(n); BR.push(vcross(T[i], n));
            n0 = n;
        }
        const base = buf.nv;
        const M = sides;
        for (let i = 0; i < N; i++) {
            const c = path[i], r = radii[i], s = i / (N - 1);
            const dr = (i < N - 1 ? radii[i + 1] - radii[i] : radii[i] - radii[i - 1]);
            const ds = (i < N - 1 ? vlen(vsub(path[i + 1], path[i])) : vlen(vsub(path[i], path[i - 1]))) || 1e-4;
            const slope = dr / ds;
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * TAU;
                const cs = Math.cos(phi), sn = Math.sin(phi);
                const k = shapeFn ? shapeFn(s, phi) : 1;
                const rr = r * k;
                const px = c.x + (NR[i].x * cs + BR[i].x * sn) * rr;
                const py = c.y + (NR[i].y * cs + BR[i].y * sn) * rr;
                const pz = c.z + (NR[i].z * cs + BR[i].z * sn) * rr;
                // 半径変化ぶん軸方向へ倒した法線
                const rx = NR[i].x * cs + BR[i].x * sn;
                const ry = NR[i].y * cs + BR[i].y * sn;
                const rz = NR[i].z * cs + BR[i].z * sn;
                const nx = rx - T[i].x * slope, ny = ry - T[i].y * slope, nz = rz - T[i].z * slope;
                const l = Math.hypot(nx, ny, nz) || 1;
                const col = colFn(s, phi, px, py, pz);
                buf.vert(px, py, pz, nx / l, ny / l, nz / l, col[0], col[1], col[2]);
            }
        }
        const W = M + 1;
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
            const A = base + i * W + j, B = A + 1, C = A + W, D = C + 1;
            buf.quad(A, B, C, D);
        }
        if (capEnd) {
            const c = path[N - 1], en = endNormal || T[N - 1];
            const col = colFn(1, 0, c.x, c.y, c.z);
            const ci = buf.vert(c.x, c.y, c.z, en.x, en.y, en.z, col[0], col[1], col[2]);
            const o = base + (N - 1) * W;
            for (let j = 0; j < M; j++) buf.tri(ci, o + j, o + j + 1);
        }
        return base;
    }


    // =================================================================
    // 4. Fields （包絡面 / 瘤の場 / 遮蔽）
    // =================================================================
    // --- 頭部の包絡面（扁球）------------------------------------------
    // 【対策】ブロッコリーの頭は球ではなく、上から押しつぶした扁球。
    //         真球にすると「濃緑のマリモ」になる。横半径に対して
    //         縦半径は 0.66〜0.76 しかない
    function makeEnvelope(cfg, cy) {
        const C = vec(0, cy, 0);
        const Rx = cfg.headRx, Ry = cfg.headRy;
        const tuck = cfg.envTuck, em = cfg.elevMin;
        return {
            C, Rx, Ry,
            // 中心から方向 d（単位）へ伸ばして包絡面と交わる点
            // 【対策】素の楕円体だときのこの傘になる。実物の頭は、赤道より
            //         下では外周が茎のほうへ巻き込んでいて、いちばん外へ
            //         張り出すのは赤道のすぐ上。ここを絞らないと、
            //         広いつばの下に空洞が見える「傘」の形から抜けられない
            point(d) {
                const s = 1 / Math.sqrt((d.x * d.x + d.z * d.z) / (Rx * Rx) + (d.y * d.y) / (Ry * Ry));
                let px = d.x * s, py = d.y * s, pz = d.z * s;
                if (d.y < 0) {
                    const u = clamp(Math.asin(clamp(d.y, -1, 1)) / em, 0, 1);
                    const f = 1 - tuck * Math.pow(u, 1.45);
                    px *= f; pz *= f;
                    py -= Ry * 0.12 * u;
                }
                return vec(C.x + px, C.y + py, C.z + pz);
            },
            // 面の外向き法線（楕円体の勾配）
            normal(d) {
                const p = this.point(d);
                return vnorm(vec((p.x - C.x) / (Rx * Rx), (p.y - C.y) / (Ry * Ry), (p.z - C.z) / (Rx * Rx)));
            }
        };
    }

    // 仰角の下限で方向を持ち上げる（これより下には房を置かない）
    function clampElev(d, elevMin) {
        if (d.y >= Math.sin(elevMin)) return d;
        const h = Math.hypot(d.x, d.z);
        if (h < 1e-6) return vec(1, Math.sin(elevMin), 0);
        const y = Math.sin(elevMin), hh = Math.cos(elevMin);
        return vec(d.x / h * hh, y, d.z / h * hh);
    }

    // --- 花蕾ドームの瘤の場 -------------------------------------------
    // 【対策】UV球の (u,v) でノイズを引くと極に模様が集まってヒトデになる。
    //         引数は「球面上の3次元方向」そのものにする。
    // 【対策】fBm の平均は 0.5、標準偏差は 2 オクターブで 0.16 前後しかない。
    //         (n-0.5) をそのまま振幅に掛けると、瘤が ±3% しか動かず
    //         「表面がわずかにざらついた球」で終わる。2.8 倍に伸ばして
    //         ようやく実物の小花蕾のぼこぼこになる
    const LUMP_GAIN = 2.8;
    function lumpAt(cfg, dome, d) {
        const f = cfg.lumpFreq;
        const n = Noise.fbm3(d.x * f + dome.ox, d.y * f + dome.oy, d.z * f + dome.oz,
            dome.nseed, cfg.lumpOct);
        return 1 + cfg.lumpAmp * (n - 0.5) * LUMP_GAIN;
    }

    // ドーム局所方向 d（単位）→ ワールド座標の表面点
    function domeSurface(cfg, dome, d) {
        const k = lumpAt(cfg, dome, d);
        const a = dome.R * k, b = dome.R * cfg.domeSquash * k;
        const lx = d.x * a, ly = d.y * a, lz = d.z * b;
        return vec(
            dome.c.x + dome.e1.x * lx + dome.e2.x * ly + dome.ax.x * lz,
            dome.c.y + dome.e1.y * lx + dome.e2.y * ly + dome.ax.y * lz,
            dome.c.z + dome.e1.z * lx + dome.e2.z * ly + dome.ax.z * lz
        );
    }

    // 表面点と法線を同時に返す。法線は瘤の傾きを含める必要があるので
    // 有限差分で取る（楕円体の解析法線だけだと瘤が平らに見える）
    const DEPS = 0.055;
    function domePoint(cfg, dome, d) {
        const p = domeSurface(cfg, dome, d);
        const t = basisFrom(d);
        const pa = domeSurface(cfg, dome, vnorm(vadd(d, vmul(t.e1, DEPS))));
        const pb = domeSurface(cfg, dome, vnorm(vadd(d, vmul(t.e2, DEPS))));
        let n = vcross(vsub(pa, p), vsub(pb, p));
        const l = vlen(n);
        if (l < 1e-9) {
            n = vnorm(vsub(p, dome.c));
        } else {
            n = vmul(n, 1 / l);
            // 外向きに揃える
            if (vdot(n, vsub(p, dome.c)) < 0) n = vmul(n, -1);
        }
        return { p, n };
    }

    // --- 遮蔽（球状 AO）-----------------------------------------------
    // 【対策】質感を作るのは粒そのものではなく「粒と粒のあいだの谷の暗さ」。
    //         隣の房が半球としてどれだけ空を覆っているかを解析的に足す。
    //         SSAO は1〜2mm の谷を解像できないので、ここで頂点に焼く
    function sphereAO(px, py, pz, nx, ny, nz, list, self, strength, floor) {
        let occ = 0;
        for (let i = 0; i < list.length; i++) {
            const d = list[i];
            if (d === self) continue;
            const vx = d.c.x - px, vy = d.c.y - py, vz = d.c.z - pz;
            const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (dist < 1e-4) continue;
            const nd = (vx * nx + vy * ny + vz * nz) / dist;
            if (nd <= 0) continue;
            const rr = d.R / Math.max(dist, d.R * 1.0001);
            // 半径 R の球が距離 dist から張る立体角の半球比
            const sa = 0.5 * (1 - Math.sqrt(Math.max(0, 1 - rr * rr)));
            occ += sa * nd;
        }
        return clamp(1 - occ * strength, floor, 1);
    }

    // =================================================================
    // 5. Corymb （散房花序の再帰）
    // =================================================================
    // 【対策】縄張りを「角度」で持つと、極の近くで実際より広く見積もられて
    //         てっぺんだけ房が混み合う。包絡面上の「面積」で持ち、
    //         分割するたびに面積を k で割る。房の半径は √(A/π) で決まる
    // 【対策】分割のたびに面積をわずかに削る（areaKeep）。この削りしろが
    //         そのまま房と房のあいだの谷になる。1.0 のままだと隙間なく
    //         敷き詰められ、深い裂け目が消えて一枚のドームに戻る
    function growCorymb(cfg, rng, stemTop, stemDir) {
        const env = makeEnvelope(cfg, stemTop.y + cfg.headCy);
        const branches = [];
        const domes = [];

        // ---- 終端（房）の方向をさきに全部決める ----
        // 【対策】「縄張りを再帰的に k 分割する」だけでは頭が均等に覆えない。
        //         角半径 w の縄張りを k 個の子で覆おうとすると、子の中心を
        //         どこに置いても、方位をランダムにした瞬間に子と子のあいだへ
        //         穴が空く（k=3 のとき隣り合う子の中心は 100°以上離れる）。
        //         そこで順番を逆にする。まず房の位置をフィボナッチ格子で
        //         均等に置き、それを上から k-means でまとめ直して枝を作る。
        //         これなら被覆は定義から保証される
        const sMin = Math.sin(cfg.elevMin);
        const capOmega = TAU * (1 - sMin);
        const N = Math.max(8, Math.round(cfg.headArea / cfg.areaTerm));
        const wTerm = Math.sqrt(capOmega / (N * Math.PI));   // 房1個の角半径
        const spin = rng.range(0, TAU);
        const targets = [];
        for (let i = 0; i < N; i++) {
            const y = sMin + (1 - sMin) * ((i + 0.5) / N);
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const th = i * 2.3999632 + spin;
            let d = vec(r * Math.cos(th), y, r * Math.sin(th));
            // 【対策】格子のまま使うと螺旋が見える。角半径の3割ほど散らす
            const b = basisFrom(d);
            const a = rng.range(0, TAU), m = wTerm * 0.34 * Math.sqrt(rng.next());
            d = vnorm(vec(
                d.x + (b.e1.x * Math.cos(a) + b.e2.x * Math.sin(a)) * m,
                d.y + (b.e1.y * Math.cos(a) + b.e2.y * Math.sin(a)) * m,
                d.z + (b.e1.z * Math.cos(a) + b.e2.z * Math.sin(a)) * m));
            targets.push(clampElev(d, cfg.elevMin));
        }

        // 【対策】枝が包絡面へ寄っていく速さ。ここを線形に近くすると、
        //         分岐のたびに同じ長さの棒が伸びる「珊瑚」になる。
        //         写真の実物は、太い一次分枝が頭の 7 割まで一気に伸び、
        //         残りの分岐は表面のすぐ下 2〜3cm に押し込められている。
        //         指数を上げて、深い階層ほど短い枝になるようにする
        // 【対策】上限を 1.0 近くまで許すと、末端ひとつ手前の枝の終点が
        //         包絡面の 94% まで来る。房の中心は 90% 前後なので、枝が
        //         房と同じ深さに並び、房と房の裂け目から黄緑の枝が
        //         真上から丸見えになる。枝は必ず房の層より内側で止める
        const inset = (n) => {
            const g = Math.sqrt(n / N);
            return clamp(1 - cfg.insetMax * Math.pow(g, cfg.insetPow), 0.06, cfg.insetCap);
        };
        const radiusOf = (n) => cfg.stemTopR * cfg.branchScale * Math.pow(n / N, cfg.branchPow * 0.5);

        // 球面上の k-means。少数の点しか扱わないので素朴な実装で足りる
        function kmeans(list, k) {
            const cent = [];
            cent.push(list[rng.int(list.length)]);
            while (cent.length < k) {
                // いちばん遠い点を次の中心にする（k-means++ の簡易版）
                let best = null, bd = 2;
                for (const p of list) {
                    let m = -2;
                    for (const c of cent) m = Math.max(m, vdot(p, c));
                    if (m < bd) { bd = m; best = p; }
                }
                cent.push(best || list[0]);
            }
            let groups = [];
            for (let it = 0; it < 8; it++) {
                groups = cent.map(() => []);
                for (const p of list) {
                    let bi = 0, bv = -2;
                    for (let c = 0; c < cent.length; c++) {
                        const d = vdot(p, cent[c]);
                        if (d > bv) { bv = d; bi = c; }
                    }
                    groups[bi].push(p);
                }
                for (let c = 0; c < cent.length; c++) {
                    if (!groups[c].length) { cent[c] = list[rng.int(list.length)]; continue; }
                    let x = 0, y = 0, z = 0;
                    for (const p of groups[c]) { x += p.x; y += p.y; z += p.z; }
                    cent[c] = vnorm(vec(x, y, z));
                }
            }
            const out = [];
            for (let c = 0; c < groups.length; c++) if (groups[c].length) out.push({ pts: groups[c], t: cent[c] });
            return out;
        }

        let sd = cfg.seed ^ 0x5bf03635;
        const nextSeed = () => (sd = (sd * 1103515245 + 12345) >>> 0) % 90000;

        function expand(P0, dir0, rParent, list, depth) {
            if (list.length <= 1 || depth >= 6) {
                for (const t of list) {
                    const R = cfg.headRx * wTerm * cfg.domeSwell * rng.range(0.86, 1.16);
                    const e = env.point(t);
                    const nn = env.normal(t);
                    // 【対策】全部の房を包絡面ちょうどに置くと、頭が「厚さ1房ぶんの
                    //         殻」になり、隙間から中の空洞と枝が透けて見える。
                    //         沈み込みをばらつかせて殻に厚みを持たせる
                    const c = vsub(e, vmul(nn, R * (0.40 + rng.next() * cfg.domeSink)));
                    const rEnd = radiusOf(1);
                    const seg = makePath(P0, dir0, c, nn, mix(rEnd, rParent, 0.62), rEnd,
                        cfg.wobble, nextSeed(), cfg.cupFlare);
                    branches.push({ path: seg.path, radii: seg.radii, depth, ph: rng.range(0, TAU) });
                    // 【対策】房の軸に「枝の先端の向き」を使ってはいけない。
                    //         枝が短くなると先端は横から差し込む形になり、
                    //         軸が寝る。粒を刈る「付け根側」もつられて
                    //         横を向き、房と房の谷に粒の無い滑らかな面が
                    //         露出する（黒い素体が見える正体）。
                    //         軸は常に包絡面の法線にする。房が頭の半径方向に
                    //         つぶれた笠になるという点でも、こちらが正しい
                    const ax = nn;
                    const b = basisFrom(ax);
                    domes.push({
                        c, R, ax, e1: b.e1, e2: b.e2, nseed: nextSeed(),
                        ox: rng.range(0, 40), oy: rng.range(0, 40), oz: rng.range(0, 40), depth
                    });
                }
                return;
            }
            // 【対策】一次分枝の本数がこの野菜の見た目を決める。写真では
            //         4〜6本の「太い柄」が茎から出ていて、その先で初めて
            //         細かく分かれる。ここを深い階層と同じ 3〜4 にすると、
            //         同じ太さの枝が何十本も並ぶ珊瑚になる
            const kmin = depth === 0 ? cfg.rootSplitMin : cfg.splitMin;
            const kmax = depth === 0 ? cfg.rootSplitMax : cfg.splitMax;
            let k = kmin + rng.int(kmax - kmin + 1);
            k = Math.min(k, list.length);
            const groups = kmeans(list, k);
            for (const g of groups) {
                const tc = clampElev(g.t, cfg.elevMin);
                const f = inset(g.pts.length);
                const e = env.point(tc);
                const P3 = vadd(env.C, vmul(vsub(e, env.C), f));
                // 終端の接線は「外向き ＋ 少し上」。ブロッコリーの枝は
                // 分岐のたびに上を向き直すので、これが無いと傘が垂れる
                let d3 = vnorm(vsub(e, env.C));
                d3 = vnorm(vec(d3.x, d3.y + cfg.liftBias, d3.z));
                const rEnd = radiusOf(g.pts.length);
                const seg = makePath(P0, dir0, P3, d3, mix(rEnd, rParent, 0.62), rEnd,
                    cfg.wobble, nextSeed(), cfg.forkFlare);
                branches.push({ path: seg.path, radii: seg.radii, depth, ph: rng.range(0, TAU) });
                const L = seg.path.length - 1;
                const dirEnd = vnorm(vsub(seg.path[L], seg.path[L - 1]));
                expand(P3, dirEnd, rEnd, g.pts, depth + 1);
            }
        }

        // 3次ベジエで枝を1本引く。始点の接線は親から受け継ぐ
        // 【対策】親の終端接線を長く効かせると、子が親と逆側へ向かうときに
        //         S字の肘ができ、関節のある骨が生えたように見える。
        //         目標方向と混ぜたうえで制御点の腕を短くする
        function makePath(P0, dir0, P3, dir3, rStart, rEnd, wob, nseed, endFlare) {
            const L = vlen(vsub(P3, P0));
            const dirA = vnorm(vsub(P3, P0));
            const d0 = vnorm(vadd(vmul(dir0, 0.55), vmul(dirA, 0.45)));
            const P1 = vadd(P0, vmul(d0, L * 0.34));
            const P2 = vsub(P3, vmul(dir3, L * 0.34));
            const K = cfg.branchRings, path = [], radii = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K, u = 1 - s;
                let x = u * u * u * P0.x + 3 * u * u * s * P1.x + 3 * u * s * s * P2.x + s * s * s * P3.x;
                let y = u * u * u * P0.y + 3 * u * u * s * P1.y + 3 * u * s * s * P2.y + s * s * s * P3.y;
                let z = u * u * u * P0.z + 3 * u * u * s * P1.z + 3 * u * s * s * P2.z + s * s * s * P3.z;
                // 【対策】定規で引いたようにまっすぐだと造花になる。
                //         両端は動かさず、途中だけ低周波ノイズでずらす
                const w = Math.sin(Math.PI * s) * wob * L;
                x += (Noise.v3(s * 2.3, 0.5, 0.5, nseed) - 0.5) * w;
                y += (Noise.v3(s * 2.3, 3.5, 0.5, nseed + 7) - 0.5) * w * 0.5;
                z += (Noise.v3(s * 2.3, 7.5, 0.5, nseed + 13) - 0.5) * w;
                path.push(vec(x, y, z));
                // 【対策】付け根だけ太らせて途中から一定にすると、太さの変わらない
                //         ソーセージが肘で折れた形になる。実物の小枝は先へ細り、
                //         花蕾の直前でラッパ状に開いて花蕾を受ける台になる。
                //         この終端の開きが無いと、枝の先に球が刺さって見える
                radii.push(mix(rStart, rEnd, smooth(0, 0.42, s))
                    * (1 + endFlare * Math.pow(smooth(0.58, 1.0, s), 1.6)));
            }
            return { path, radii };
        }

        expand(stemTop, stemDir, cfg.stemTopR * cfg.branchScale, targets, 0);

        // 近傍リスト。粒の刈り取りと AO で「全ドーム総当たり」を避ける
        for (let i = 0; i < domes.length; i++) {
            const a = domes[i], near = [];
            for (let j = 0; j < domes.length; j++) {
                if (i === j) continue;
                const b = domes[j];
                const d = Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y, a.c.z - b.c.z);
                if (d < (a.R + b.R) * cfg.aoRange) near.push(b);
            }
            a.near = near;
        }
        return { env, branches, domes };
    }


    // =================================================================
    // 6. Broccoli
    // =================================================================
    class Cauliflower {
        constructor(scene, cfg, seed, mats) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng; this.mats = mats;
            this.parts = [];
            this.root = new BABYLON.TransformNode("cauliflower", scene);

            // 個体差。長さ・太さ・傾き
            this.H = cfg.stemH * rng.range(0.90, 1.10);
            this.R0 = cfg.stemR * rng.range(0.93, 1.07);
            this.R1 = cfg.stemTopR * rng.range(0.93, 1.07);
            this.lean = rng.gauss(0, 0.055);
            this.leanPhi = rng.range(0, TAU);
            this.nseed = rng.int(80000) + 1000;
            this.topK = cfg.stemTopR / cfg.stemR;
            this.lobePh = rng.range(0, TAU);

            const c2 = Object.assign({}, cfg, {
                stemTopR: this.stemRadius(BRANCH_ROOT_S),
                seed: (seed ^ 0x9e3779b9) >>> 0
            });
            this.c2 = c2;

            // 【対策】枝を茎の先端ちょうどから生やすと、太い茎の上に細い枝が
            //         3本立つ「首」ができる。実物は茎がそのまま冠状に広がって
            //         枝へ移り、境目が分からない。枝の起点を茎の中へ潜らせ、
            //         付け根を親の太さ寄りに膨らませて連続させる
            const stemTop = this.stemCenter(BRANCH_ROOT_S);
            const stemDir = vnorm(vsub(this.stemCenter(BRANCH_ROOT_S), this.stemCenter(BRANCH_ROOT_S - 0.10)));
            const corymb = growCorymb(c2, rng, stemTop, stemDir);
            this.domes = corymb.domes;
            this.env = corymb.env;

            this.buildStem(corymb.branches);
            this.buildCurd();
            this.buildLeaves();

            for (const m of this.parts) m.parent = this.root;
        }

        // --- 主茎の中心線 ---------------------------------------------
        stemCenter(s) {
            const b = this.lean * this.H * s * s;
            return vec(Math.cos(this.leanPhi) * b, this.H * s, Math.sin(this.leanPhi) * b);
        }

        // --- 主茎の半径 -----------------------------------------------
        // 【対策】まっすぐな円柱にすると、きのこの柄か大根の切れ端になる。
        //         実物の茎は切り口がいちばん太く（葉を落とした株元が
        //         ラッパ状に開いている）、そこから 1/3 ほど上がった所が
        //         最も細く、分岐へ向かってまた太る。つまり鼓型。
        //         「切り口が太い」ことがブロッコリーの茎の第一印象なので、
        //         ここを平行にすると何の野菜か分からなくなる
        stemRadius(s) {
            const B = STEM_PROFILE;
            const n = B.length - 1;
            const x = clamp(s, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
            const k = mix(B[i], B[i + 1], f * f * (3 - 2 * f));
            // 先端が preset の stemTopR に着地するよう、上半分だけ伸縮させる
            const tail = 1 + (this.topK / B[n] - 1) * smooth(0.22, 1.0, s);
            // 【対策】茎の上端を太いまま切ると、そこに平らなふたが残り、
            //         枝の隙間から「円盤の縁」として見える。実物の茎は
            //         そのまま枝へ分かれていくので上端は存在しない。
            //         分岐の起点より上を絞って、枝束の中へ埋める
            const crown = 1 - 0.66 * smooth(BRANCH_ROOT_S - 0.02, 1.0, s);
            return this.R0 * k * tail * this.bell(s) * crown;
        }

        // 鐘の開き。株元だけ効かせる
        bell(s) {
            return 1 + this.cfg.stemBell * Math.pow(1 - smooth(0, 0.30, s), 2.2);
        }

        // 断面は真円ではない。浅い縦の稜があり、株元ほど大きく波打つ
        // 【対策】株元の断面はきれいな円ではなく、葉柄の跡で数か所へこんだ
        //         多角形に近い。ここを真円にすると切り口が定規で切ったように
        //         なり、いちばん目立つ場所で作り物だとばれる
        stemShape(s, phi) {
            const F = this.cfg.stemFlutes;
            const low = 1 + 2.4 * (1 - smooth(0, 0.34, s));
            const g = 0.5 - 0.5 * Math.cos(F * phi + 1.35 * s);
            const w = 0.5 - 0.5 * Math.cos(3 * phi + this.lobePh);
            const n = Noise.fbm3(Math.cos(phi) * 1.7, s * 2.6, Math.sin(phi) * 1.7, this.nseed, 2);
            return 1 - this.cfg.fluteAmp * g * low * 0.55
                - this.cfg.stemLobe * w * (1 - smooth(0, 0.42, s))
                + (n - 0.5) * 0.045 * low;
        }

        // --- 茎 + 葉痕 + 切り口 + 枝（1枚のメッシュ）-------------------
        buildStem(branches) {
            const cfg = this.cfg, rng = this.rng;
            const HI = cfg.stemHi, LO = cfg.stemLo;
            const BH = cfg.branchHi, BL = cfg.branchLo;

            let bv = 4000, bt = 8000;
            for (const b of branches) { bv += (b.path.length) * (cfg.branchSides + 1) + 2; bt += b.path.length * cfg.branchSides * 2 + cfg.branchSides; }
            const buf = new MeshBuf(bv, bt);

            // ---- 主茎 ----
            const NR = cfg.stemRings, MS = cfg.stemSides;
            const path = [], radii = [];
            for (let i = 0; i <= NR; i++) {
                const s = i / NR;
                path.push(this.stemCenter(s));
                radii.push(this.stemRadius(s));
            }
            const stemCol = (s, phi, x, y, z) => {
                // 縦に走る繊維の筋。ごく淡い
                const fib = 0.955 + 0.090 * Noise.fbm3(Math.cos(phi) * 26, s * 3.2, Math.sin(phi) * 26, this.nseed + 5, 2);
                // 溝は沈む
                const g = 0.5 - 0.5 * Math.cos(cfg.stemFlutes * phi + 1.35 * s);
                // 上へ行くほど緑が乗る（枝へつながる）
                const up = smooth(0.55, 1.0, s);
                // 低周波のむら
                const mo = 0.94 + 0.12 * Noise.fbm3(Math.cos(phi) * 2.1, s * 3.4, Math.sin(phi) * 2.1, this.nseed + 11, 3);
                const k = fib * mo * (1 - 0.26 * g);
                return [
                    srgb(mix(mix(HI[0], LO[0], up * 0.55), BH[0], up * 0.30) * k),
                    srgb(mix(mix(HI[1], LO[1], up * 0.55), BH[1], up * 0.30) * k),
                    srgb(mix(mix(HI[2], LO[2], up * 0.55), BH[2], up * 0.30) * k)
                ];
            };
            // 【対策】上端を開けたままにすると、筒の縁が枝の隙間から
            //         黒いリングとして見え、そこで別部品が始まったように見える
            tube(buf, path, radii, MS, stemCol, (s, phi) => this.stemShape(s, phi), true, vec(0, 1, 0));

            // ---- 切り口 ----
            this.buildCutFace(buf);

            // ---- 葉痕 ----
            // 【対策】写真の茎でいちばん目を引くのは、葉を切り落とした跡の
            //         小さなヒレ。これが無いとただの緑の円柱になる。
            //         葉序に従って 137.5°ずつ回しながら螺旋に並べる
            for (let i = 0; i < cfg.scarCount; i++) {
                const s = mix(0.16, 0.94, (i + 0.30) / cfg.scarCount) + rng.gauss(0, 0.022);
                const phi = i * 2.3999632 + rng.gauss(0, 0.16);
                this.buildLeafScar(buf, s, phi, cfg.scarSize * rng.range(0.78, 1.22));
            }

            // ---- 枝 ----
            let maxD = 1;
            for (const b of branches) maxD = Math.max(maxD, b.depth);
            for (const b of branches) {
                const d0 = b.depth;
                const colFn = (s, phi, x, y, z) => {
                    const t = clamp((d0 + s) / (maxD + 1.0), 0, 1);
                    const n = 0.93 + 0.14 * Noise.fbm3(x * 1.9, y * 1.9, z * 1.9, this.nseed + 23, 2);
                    const fib = 0.965 + 0.070 * Noise.fbm3(Math.cos(phi) * 18, s * 6, Math.sin(phi) * 18, this.nseed + 31, 2);
                    const k = n * fib;
                    // 【対策】深さに比例して緑を濃くすると、末端の小枝まで
                    //         濃緑になる。写真では小枝は花蕾の直前まで
                    //         淡い黄緑のままで、濃くなるのは花蕾を受ける
                    //         ラッパの内側だけ
                    const a = smooth(0.00, 0.58, t), b2 = smooth(0.76, 1.00, t);
                    return [
                        srgb(mix(mix(HI[0], BH[0], a), BL[0], b2) * k),
                        srgb(mix(mix(HI[1], BH[1], a), BL[1], b2) * k),
                        srgb(mix(mix(HI[2], BH[2], a), BL[2], b2) * k)
                    ];
                };
                // 【対策】小枝の断面は真円ではなく、平たいリボンに近い。
                //         真円のままだと太さの変わらない配管になる。
                //         向きは解剖学的に決められないので、枝ごとに位相を振る
                const ph = b.ph;
                const shp = (s2, phi) => 1 + cfg.branchFlat * Math.cos(2 * (phi - ph)) * smooth(0.10, 0.55, s2);
                tube(buf, b.path, b.radii, cfg.branchSides, colFn, shp, true);
            }

            // ---- 頭部からの遮蔽を焼く ----
            this.applyAO(buf, null);

            const mesh = buf.toMesh("cauliflowerStem", this.scene);
            mesh.material = this.mats.stem;
            mesh.receiveShadows = true;
            this.parts.push(mesh);
            this.stemMesh = mesh;
        }

        // --- 切り口 ---------------------------------------------------
        // 【対策】外側の濃い皮 → 淡い皮層 → 白い髄、の同心構造と、
        //         その境目に並ぶ維管束の点。ここを一色で塗ると
        //         「棒を切っただけ」に見えて、野菜の断面にならない
        buildCutFace(buf) {
            const cfg = this.cfg, M = cfg.stemSides, Q = 9;
            const r0 = this.stemRadius(0);
            const RIND = cfg.cutRind, FLESH = cfg.cutFlesh, CORE = cfg.cutCore, VEIN = cfg.cutVein;
            const base = buf.nv;
            for (let q = 0; q <= Q; q++) {
                const t = q / Q;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * TAU;
                    const rr = r0 * this.stemShape(0, phi) * t;
                    // 切り口はわずかに凹む（乾いて縮む）
                    const dip = 0.09 * (1 - t * t);
                    const x = Math.cos(phi) * rr, z = Math.sin(phi) * rr;
                    const n = vnorm(vec(Math.cos(phi) * 0.16 * t, -1, Math.sin(phi) * 0.16 * t));
                    // 色：外周の皮 → 皮層 → 髄
                    const rind = smooth(0.90, 1.00, t);
                    const cort = smooth(0.62, 0.90, t) * (1 - rind);
                    let cr = mix(CORE[0], FLESH[0], smooth(0.10, 0.55, t));
                    let cg = mix(CORE[1], FLESH[1], smooth(0.10, 0.55, t));
                    let cb = mix(CORE[2], FLESH[2], smooth(0.10, 0.55, t));
                    cr = mix(cr, VEIN[0], cort * 0.55); cg = mix(cg, VEIN[1], cort * 0.55); cb = mix(cb, VEIN[2], cort * 0.55);
                    cr = mix(cr, RIND[0], rind); cg = mix(cg, RIND[1], rind); cb = mix(cb, RIND[2], rind);
                    // 維管束の点。t≒0.72 のリング上に並ぶ
                    // 【対策】維管束の点は「リング上の位相ノイズ」で作ると
                    //         放射状の縞になり、切り株の年輪のように見える。
                    //         2次元位置で引いて、リング付近だけ出す
                    const dot = smooth(0.62, 0.86, Noise.fbm3(Math.cos(phi) * rr * 5.5, Math.sin(phi) * rr * 5.5, 4.0, this.nseed + 41, 2))
                        * smooth(0.13, 0.04, Math.abs(t - 0.74));
                    cr = mix(cr, VEIN[0] * 0.80, dot * 0.45);
                    cg = mix(cg, VEIN[1] * 0.80, dot * 0.45);
                    cb = mix(cb, VEIN[2] * 0.80, dot * 0.45);
                    const g = 0.95 + 0.10 * Noise.fbm3(x * 3.4, 1.7, z * 3.4, this.nseed + 47, 2);
                    buf.vert(x, dip, z, n.x, n.y, n.z, srgb(cr * g), srgb(cg * g), srgb(cb * g));
                }
            }
            const W = M + 1;
            for (let q = 0; q < Q; q++) for (let j = 0; j < M; j++) {
                const A = base + q * W + j, B = A + 1, C = A + W, D = C + 1;
                buf.quad(A, B, C, D);
            }
        }

        // --- 葉痕（葉を切り落とした跡のヒレ）--------------------------
        buildLeafScar(buf, s, phi, size) {
            const c = this.stemCenter(s);
            const t = vnorm(vsub(this.stemCenter(Math.min(1, s + 0.02)), this.stemCenter(Math.max(0, s - 0.02))));
            const bs = basisFrom(t);
            const o = vnorm(vec(
                bs.e1.x * Math.cos(phi) + bs.e2.x * Math.sin(phi),
                bs.e1.y * Math.cos(phi) + bs.e2.y * Math.sin(phi),
                bs.e1.z * Math.cos(phi) + bs.e2.z * Math.sin(phi)));
            const side = vcross(t, o);
            const r = this.stemRadius(s) * this.stemShape(s, phi);
            const P = vadd(c, vmul(o, r * 0.94));
            const h = size * 1.02;
            // 【対策】葉痕は真横へ突き出すのではなく、上向きに寝ている。
            //         外向きを強くすると耳のように見えて別の生き物になる
            const apex = vadd(vadd(P, vmul(o, h * 0.52)), vmul(t, h * 0.86));

            const M = 14, base = buf.nv;
            const A0 = size * 1.00, B0 = size * 0.46;   // 付け根の楕円（横長）
            const A1 = size * 0.44, B1 = size * 0.09;   // 先端はほぼ線。薄く尖った角になる
            const SC = this.cfg.stemScar, HI = this.cfg.stemHi, LO = this.cfg.stemLo;
            for (let ring = 0; ring < 2; ring++) {
                const CC = ring === 0 ? P : apex;
                const a = ring === 0 ? A0 : A1, b = ring === 0 ? B0 : B1;
                for (let j = 0; j <= M; j++) {
                    const th = (j % M) / M * TAU;
                    const cs = Math.cos(th), sn = Math.sin(th);
                    const px = CC.x + side.x * cs * a + t.x * sn * b;
                    const py = CC.y + side.y * cs * a + t.y * sn * b;
                    const pz = CC.z + side.z * cs * a + t.z * sn * b;
                    const n = vnorm(vec(
                        o.x * 0.75 + side.x * cs * 0.65 + t.x * sn * 0.35,
                        o.y * 0.75 + side.y * cs * 0.65 + t.y * sn * 0.35,
                        o.z * 0.75 + side.z * cs * 0.65 + t.z * sn * 0.35));
                    const k = ring === 0 ? 0 : 0.72;
                    const g = 0.94 + 0.12 * Noise.fbm3(px * 4, py * 4, pz * 4, this.nseed + 53, 2);
                    // 【対策】ヒレ全体を淡色にすると、茎に白いシールを貼ったように
                    //         見える。写真ではヒレの面は茎と同じ緑で、
                    //         淡いのは切り落とした先端の断面だけ
                    const cr = mix(mix(HI[0], LO[0], 0.30), SC[0], k) * g;
                    const cg = mix(mix(HI[1], LO[1], 0.30), SC[1], k) * g;
                    const cb = mix(mix(HI[2], LO[2], 0.30), SC[2], k) * g;
                    buf.vert(px, py, pz, n.x, n.y, n.z, srgb(cr), srgb(cg), srgb(cb));
                }
            }
            const W = M + 1;
            for (let j = 0; j < M; j++) {
                const A = base + j, B = A + 1, C = A + W, D = C + 1;
                buf.quad(A, B, C, D);
            }
            // 先端。切り落とした断面（淡）か、葉の付け根の残り（濃緑）
            // 【対策】写真の茎では、ヒレの先が全部同じ色ではない。
            //         葉を切った断面は白っぽく、葉柄が残っている所は
            //         濃い緑の小さな突起になっている。この2種類が
            //         混ざっていることが、茎を「切られた植物」に見せる
            const leafy = this.rng.next() < 0.45;
            const LF = this.cfg.branchLo;
            const nap = vnorm(vadd(vmul(o, 0.62), vmul(t, 0.78)));
            const ci = buf.vert(apex.x, apex.y, apex.z, nap.x, nap.y, nap.z,
                srgb(leafy ? LF[0] * 0.85 : SC[0]),
                srgb(leafy ? LF[1] * 0.85 : SC[1]),
                srgb(leafy ? LF[2] * 0.85 : SC[2]));
            const off = base + W;
            for (let j = 0; j < M; j++) buf.tri(ci, off + j, off + j + 1);
        }

        // --- 花蕾（ドームの下地 + 蕾の粒）------------------------------
        buildCurd() {
            const cfg = this.cfg, rng = this.rng, domes = this.domes;

            // ---- 下地（隙間から見える暗い面）----
            const su = cfg.domeSegU, sv = cfg.domeSegV;
            const skin = new MeshBuf(domes.length * (su + 1) * (sv + 1) + 8, domes.length * su * sv * 2 + 8);
            const CS = cfg.curdSkin;
            for (const dm of domes) {
                const base = skin.nv;
                for (let i = 0; i <= sv; i++) {
                    const th = i / sv * Math.PI;
                    const st = Math.sin(th), ct = Math.cos(th);
                    for (let j = 0; j <= su; j++) {
                        const ph = (j % su) / su * TAU;
                        const d = vec(st * Math.cos(ph), st * Math.sin(ph), ct);
                        const pn = domePoint(cfg, dm, d);
                        // 【対策】下地を粒と同じ面に置くと、粒の隙間から
                        //         下地が「出っ張って」見える。粒の半径ぶん
                        //         内側へ引っ込めて、常に粒より奥にする
                        const sk = cfg.skinShrink;
                        pn.p = vec(dm.c.x + (pn.p.x - dm.c.x) * sk,
                            dm.c.y + (pn.p.y - dm.c.y) * sk,
                            dm.c.z + (pn.p.z - dm.c.z) * sk);
                        const ao = sphereAO(pn.p.x, pn.p.y, pn.p.z, pn.n.x, pn.n.y, pn.n.z,
                            dm.near, dm, cfg.aoStrength, cfg.aoFloor);
                        // 【対策】下地まで粒と同じ明るさにすると、隙間が
                        //         「明るい地」になって粒が浮いて見える。
                        //         下地は常に粒より一段暗い
                        const k = ao * 0.94;
                        skin.vert(pn.p.x, pn.p.y, pn.p.z, pn.n.x, pn.n.y, pn.n.z,
                            srgb(CS[0] * k), srgb(CS[1] * k), srgb(CS[2] * k));
                    }
                }
                const W = su + 1;
                for (let i = 0; i < sv; i++) for (let j = 0; j < su; j++) {
                    const A = base + i * W + j, B = A + 1, C = A + W, D = C + 1;
                    skin.quad(A, B, C, D);
                }
            }
            const skinMesh = skin.toMesh("curdSkin", this.scene);
            skinMesh.material = this.mats.curd;
            skinMesh.receiveShadows = true;
            this.parts.push(skinMesh);

            // ---- 蕾の粒 ----
            const rb = cfg.budR;
            const spacing = rb * 2 * cfg.budSpacing;
            const cellA = 0.866 * spacing * spacing;
            let est = 0;
            for (const dm of domes) {
                est += Math.round(4 * Math.PI * dm.R * dm.R * (1 + 2 * cfg.domeSquash) / 3 / cellA);
            }
            const keep = Math.max(2000, Math.round(est * 0.62));
            const buds = new MeshBuf(keep * 12, keep * 20);

            const TOP = cfg.budTop, SIDE = cfg.budSide, DEEP = cfg.budDeep;
            const YEL = cfg.budYellow, PUR = cfg.budPurple;
            const asp = cfg.budAspect;
            const seedY = rng.int(70000), seedP = rng.int(70000);
            let n = 0;

            for (const dm of domes) {
                const M = Math.max(24, Math.round(4 * Math.PI * dm.R * dm.R * (1 + 2 * cfg.domeSquash) / 3 / cellA));
                const spin = rng.range(0, TAU);
                for (let k = 0; k < M; k++) {
                    // フィボナッチ球。等面積で並ぶので密度が極でも崩れない
                    const lz = 1 - 2 * (k + 0.5) / M;
                    const lr = Math.sqrt(Math.max(0, 1 - lz * lz));
                    const th = k * 2.3999632 + spin;
                    let d = vec(lr * Math.cos(th), lr * Math.sin(th), lz);
                    // 枝の付け根側は刈る
                    if (d.z < -cfg.budCullDot) continue;
                    // 【対策】フィボナッチ球は等面積で並ぶかわりに、粒が
                    //         きれいな螺旋に乗る。ブロッコリーは色が濃くて
                    //         気づかないが、白いカリフラワーでは渦巻き模様として
                    //         はっきり見えてしまう。1セルぶんだけ位置を散らす
                    {
                        const bj = basisFrom(d);
                        const ja = rng.range(0, TAU);
                        const jm = cfg.budScatter * spacing / dm.R * Math.sqrt(rng.next());
                        d = vnorm(vec(
                            d.x + (bj.e1.x * Math.cos(ja) + bj.e2.x * Math.sin(ja)) * jm,
                            d.y + (bj.e1.y * Math.cos(ja) + bj.e2.y * Math.sin(ja)) * jm,
                            d.z + (bj.e1.z * Math.cos(ja) + bj.e2.z * Math.sin(ja)) * jm));
                    }

                    const pn = domePoint(cfg, dm, d);
                    const p = pn.p;
                    // 隣の房の内側に入ってしまう粒は捨てる
                    if (insideNeighbor(cfg, p, dm.near)) continue;

                    let nv = pn.n;
                    // 向きのばらつき
                    const b0 = basisFrom(nv);
                    nv = vnorm(vec(
                        nv.x + (b0.e1.x * (rng.next() - 0.5) + b0.e2.x * (rng.next() - 0.5)) * cfg.budJitter,
                        nv.y + (b0.e1.y * (rng.next() - 0.5) + b0.e2.y * (rng.next() - 0.5)) * cfg.budJitter,
                        nv.z + (b0.e1.z * (rng.next() - 0.5) + b0.e2.z * (rng.next() - 0.5)) * cfg.budJitter));
                    const bb = basisFrom(nv);

                    const ao = sphereAO(p.x, p.y, p.z, nv.x, nv.y, nv.z,
                        dm.near, dm, cfg.aoStrength, cfg.aoFloor);

                    // 瘤の頂かどうか
                    const lv = lumpAt(cfg, dm, d);
                    const kk = clamp((lv - 1) / (cfg.lumpAmp * LUMP_GAIN * 0.5), -1, 1);
                    const expo = clamp(0.46 + 0.38 * nv.y + 0.30 * kk, 0, 1);
                    const e = smooth(0.16, 0.86, expo);
                    let cr = mix(SIDE[0], TOP[0], e);
                    let cg = mix(SIDE[1], TOP[1], e);
                    let cb = mix(SIDE[2], TOP[2], e);

                    // 黄緑に抜ける斑。下側・内側ほど出やすい
                    const yp = Noise.fbm3(p.x * 0.34, p.y * 0.34, p.z * 0.34, seedY, 3);
                    const yv = smooth(0.55, 0.80, yp) * cfg.yellowAmt * (1 - smooth(0.05, 0.65, nv.y));
                    cr = mix(cr, YEL[0], yv); cg = mix(cg, YEL[1], yv); cb = mix(cb, YEL[2], yv);

                    // 上面のアントシアニン
                    const pp = Noise.fbm3(p.x * 0.26 + 40, p.y * 0.26, p.z * 0.26, seedP, 3);
                    const pv = smooth(0.56, 0.82, pp) * cfg.purpleAmt * smooth(0.20, 0.95, nv.y);
                    cr = mix(cr, PUR[0], pv); cg = mix(cg, PUR[1], pv); cb = mix(cb, PUR[2], pv);

                    // 粒ごとの明度ゆらぎ。均一だとフェルトになる
                    const jit = 0.90 + 0.20 * rng.next();
                    cr *= jit; cg *= jit; cb *= jit;

                    // 遮蔽は「黒く掛ける」のではなく谷の色へ寄せる
                    const dr = mix(DEEP[0], cr, ao), dg = mix(DEEP[1], cg, ao), db = mix(DEEP[2], cb, ao);

                    // 【対策】粒はフィボナッチ球（単位球）で等間隔に並べているが、
                    //         実際に置かれるのは瘤で ±25% 伸縮した面。瘤の頂では
                    //         面積が lv² 倍に広がるので、粒の大きさを直さないと
                    //         そこだけ間隔が空いて下地が覗く。
                    // 【対策】さらに、六方最密でも円は 9% の隙間を残す。粒の径を
                    //         間隔の半分ちょうどにすると必ず下地が見えるので、
                    //         2 割ほど重なるまで大きくする（実物の蕾も互いに
                    //         押し合ってつぶれている）
                    const rr = rb * lv * (1.00 + 0.36 * rng.next());
                    const cxp = p.x + nv.x * rr * asp * 0.52;
                    const cyp = p.y + nv.y * rr * asp * 0.52;
                    const czp = p.z + nv.z * rr * asp * 0.52;

                    const off = buds.nv;
                    for (let vi = 0; vi < 12; vi++) {
                        const V = ICO.V[vi];
                        const px = cxp + (bb.e1.x * V.x + bb.e2.x * V.y) * rr + nv.x * V.z * rr * asp;
                        const py = cyp + (bb.e1.y * V.x + bb.e2.y * V.y) * rr + nv.y * V.z * rr * asp;
                        const pz = czp + (bb.e1.z * V.x + bb.e2.z * V.y) * rr + nv.z * V.z * rr * asp;
                        const gx = (bb.e1.x * V.x + bb.e2.x * V.y) * asp + nv.x * V.z;
                        const gy = (bb.e1.y * V.x + bb.e2.y * V.y) * asp + nv.y * V.z;
                        const gz = (bb.e1.z * V.x + bb.e2.z * V.y) * asp + nv.z * V.z;
                        const gl = Math.hypot(gx, gy, gz) || 1;
                        // 【対策】ここがこの野菜の質感のほぼ全部。粒の外を向いた面は
                        //         明るく、谷を向いた面は谷の色まで落とす。この頂点内の
                        //         濃淡が無いと、粒が何万個あっても平らな緑の面に見える
                        const sh = 0.44 + 0.56 * smooth(-0.55, 0.90, V.z);
                        buds.vert(px, py, pz, gx / gl, gy / gl, gz / gl,
                            srgb(mix(DEEP[0] * ao, dr, sh)),
                            srgb(mix(DEEP[1] * ao, dg, sh)),
                            srgb(mix(DEEP[2] * ao, db, sh)));
                    }
                    for (let fi = 0; fi < 20; fi++) {
                        const F = ICO.F[fi];
                        buds.tri(off + F[0], off + F[1], off + F[2]);
                    }
                    n++;
                }
            }
            this.budCount = n;
            const budMesh = buds.toMesh("curdBuds", this.scene);
            budMesh.material = this.mats.curd;
            budMesh.receiveShadows = true;
            this.parts.push(budMesh);
            this.budMesh = budMesh;
        }

        // ---- 葉 -------------------------------------------------------
        // 【対策】これが無いと「白いブロッコリー」で終わる。写真のカリフラワーで
        //         いちばん目を引くのは、太い葉柄を切った跡が輪になって
        //         外へ張り出しているところ。
        // 【対策】葉柄（中肋）と葉身を1枚のシートで作ると、切った跡が
        //         紙を切った断面になる。葉柄は断面を持った実体、葉身は
        //         両面表示のシート、と作り分ける
        buildLeaves() {
            const cfg = this.cfg, rng = this.rng;
            if (!cfg.leafCount) return;

            const ribBuf = new MeshBuf(cfg.leafCount * 700, cfg.leafCount * 1300);
            const bladeBuf = new MeshBuf(cfg.leafCount * 1400, cfg.leafCount * 2600);
            const RB = cfg.ribCol, RC = cfg.ribCut;
            const BT = cfg.bladeTop, BV = cfg.bladeVein;
            const ph0 = rng.range(0, TAU);
            this.ribPts = [];

            for (let i = 0; i < cfg.leafCount; i++) {
                // 葉序。137.5°ずつ回しながら、下の葉ほど長く外へ張り出す
                const az = ph0 + i * 2.3999632 + rng.gauss(0, 0.10);
                const sBase = mix(0.22, 0.72, (i + 0.4) / cfg.leafCount) + rng.gauss(0, 0.03);
                const cut = rng.next() < cfg.leafCutRatio;
                const L = (cut ? cfg.ribLenCut : cfg.ribLenFull) * rng.range(0.78, 1.24);
                // 立ち上がりの角度。切られた葉柄は寝ており、残った葉は立つ
                // 【対策】切った葉柄はほぼ水平に外へ張り出し、残った葉は
                //         頭を抱えるように立ち上がる。同じ角度で出すと、
                //         全部が頭の陰に隠れて葉が無いのと同じになる
                // 【対策】切った葉柄を水平に長く出すと、蜘蛛の脚が生えたように見える。
                //         実物は斜め上へ短く突き出し、頭のふちに隠れる程度
                const e0 = cut ? rng.range(0.22, 0.62) : rng.range(0.22, 0.55);
                const e1 = cut ? e0 + rng.range(0.05, 0.28) : rng.range(1.32, 1.62);
                const twist = rng.gauss(0, 0.16);

                const c0 = this.stemCenter(clamp(sBase, 0, 1));
                const t0 = vnorm(vsub(this.stemCenter(Math.min(1, sBase + 0.02)),
                    this.stemCenter(Math.max(0, sBase - 0.02))));
                const bs = basisFrom(t0);
                const out = vnorm(vec(
                    bs.e1.x * Math.cos(az) + bs.e2.x * Math.sin(az),
                    bs.e1.y * Math.cos(az) + bs.e2.y * Math.sin(az),
                    bs.e1.z * Math.cos(az) + bs.e2.z * Math.sin(az)));
                const side = vnorm(vcross(t0, out));
                const r0 = this.stemRadius(clamp(sBase, 0, 1)) * this.stemShape(sBase, az);
                const base = vadd(c0, vmul(out, r0 * 0.86));

                // 芯線
                let K = 18;
                const path = [], frames = [];
                let cur = base;
                for (let k = 0; k <= K; k++) {
                    const t = k / K;
                    // 【対策】立ち上がりを遅らせると葉が横へ広がって観葉植物になる。
                    //         実物は付け根からすぐ起き上がり、頭を抱え込む
                    const e = e0 + (e1 - e0) * Math.pow(t, 0.80);
                    const yaw = twist * t * t;
                    const dx = Math.cos(e) * (out.x * Math.cos(yaw) + side.x * Math.sin(yaw)) + t0.x * Math.sin(e);
                    const dy = Math.cos(e) * (out.y * Math.cos(yaw) + side.y * Math.sin(yaw)) + t0.y * Math.sin(e);
                    const dz = Math.cos(e) * (out.z * Math.cos(yaw) + side.z * Math.sin(yaw)) + t0.z * Math.sin(e);
                    const d = vnorm(vec(dx, dy, dz));
                    if (k > 0) cur = vadd(cur, vmul(d, L / K));
                    path.push(cur);
                    const S = vnorm(vcross(d, out.y > 0.99 ? vec(1, 0, 0) : vec(0, 1, 0)));
                    frames.push({ d, S, N: vnorm(vcross(S, d)) });
                }
                // 【対策】物理の凸包へ入れるのは、外へ張り出した「低い」点だけ。
                //         立ち上がった葉の先まで入れると凸包が背の高い円錐になり、
                //         据わり方が実物と変わってしまう
                // 【対策】葉は茎から生えるが、頭部は茎の上に覆いかぶさっている。
                //         付け根の高さと立ち上がり角によっては、葉が花蕾の中を
                //         下から突き破って生えてくる。包絡面の内側に入った
                //         時点で芯線を打ち切り、根元から入っている個体は捨てる
                {
                    const C = this.env.C, Rx = this.env.Rx, Ry = this.env.Ry;
                    const inside = (p) => {
                        const dx = p.x - C.x, dy = p.y - C.y, dz = p.z - C.z;
                        return (dx * dx + dz * dz) / (Rx * Rx) + (dy * dy) / (Ry * Ry) < 1.04;
                    };
                    let kMax = K;
                    for (let k = 0; k <= K; k++) if (inside(path[k])) { kMax = k - 1; break; }
                    if (kMax < 4) continue;
                    if (kMax < K) { K = kMax; path.length = K + 1; frames.length = K + 1; }
                }

                this.ribPts.push(path[0]);
                if (cut) this.ribPts.push(path[(K * 0.5) | 0], path[K]);

                // ---- 葉柄（扁平な断面の実体）----
                const M = 12, bstart = ribBuf.nv;
                for (let k = 0; k <= K; k++) {
                    const t = k / K;
                    const C = path[k], F = frames[k];
                    const a = cfg.ribW * (1 - 0.52 * t) * (cut ? 1.0 : 1 - 0.72 * smooth(0.25, 1.0, t));
                    const b = cfg.ribT * (1 - 0.58 * t) * (cut ? 1.0 : 1 - 0.76 * smooth(0.25, 1.0, t));
                    const g = 0.93 + 0.14 * Noise.fbm3(C.x * 2.2, C.y * 2.2, C.z * 2.2, this.nseed + 61, 2);
                    for (let j = 0; j <= M; j++) {
                        const psi = (j % M) / M * TAU;
                        const cs = Math.cos(psi), sn = Math.sin(psi);
                        const px = C.x + F.S.x * a * cs + F.N.x * b * sn;
                        const py = C.y + F.S.y * a * cs + F.N.y * b * sn;
                        const pz = C.z + F.S.z * a * cs + F.N.z * b * sn;
                        const nx = F.S.x * cs / a + F.N.x * sn / b;
                        const ny = F.S.y * cs / a + F.N.y * sn / b;
                        const nz = F.S.z * cs / a + F.N.z * sn / b;
                        const nl = Math.hypot(nx, ny, nz) || 1;
                        // 葉柄の背側はわずかに緑が乗る
                        const k2 = g * (0.94 + 0.10 * (sn * 0.5 + 0.5));
                        ribBuf.vert(px, py, pz, nx / nl, ny / nl, nz / nl,
                            srgb(RB[0] * k2), srgb(RB[1] * k2), srgb(RB[2] * k2));
                    }
                }
                const W = M + 1;
                for (let k = 0; k < K; k++) for (let j = 0; j < M; j++) {
                    const A = bstart + k * W + j;
                    ribBuf.quad(A, A + 1, A + W, A + W + 1);
                }
                if (cut) {
                    // 切り口。淡い楕円のふた
                    const C = path[K], F = frames[K];
                    const ci = ribBuf.vert(C.x, C.y, C.z, F.d.x, F.d.y, F.d.z,
                        srgb(RC[0]), srgb(RC[1]), srgb(RC[2]));
                    const o = bstart + K * W;
                    for (let j = 0; j < M; j++) ribBuf.tri(ci, o + j, o + j + 1);
                }

                if (cut) continue;

                // ---- 葉身（両面表示のシート）----
                const t0s = 0.30, NU = 22, NV = 13;
                const P = [], Nn = [];
                const wave = cfg.bladeWave * rng.range(0.6, 1.5);
                const wph = rng.range(0, TAU);
                const bw = cfg.bladeW * rng.range(0.8, 1.25);
                // 【対策】幅の山を中央に置くときれいな楕円になり、観葉植物の
                //         葉になる。実物は付け根寄りがいちばん広く、先へ尖る。
                //         さらに、ふちは大きく波打って裂けている
                const halfW = (u) => bw * Math.pow(u, 0.38) * Math.pow(1 - u, 0.58) * 2.35
                    * (1 + 0.09 * Math.sin(4.2 * Math.PI * u + wph));
                const pt = (u, w) => {
                    const t = mix(t0s, 1.0, u);
                    const k = clamp(t * K, 0, K);
                    const k0 = Math.floor(k), k1 = Math.min(K, k0 + 1), fk = k - k0;
                    const C = vec(mix(path[k0].x, path[k1].x, fk),
                        mix(path[k0].y, path[k1].y, fk),
                        mix(path[k0].z, path[k1].z, fk));
                    const F = frames[k0];
                    const hw = halfW(u);
                    // 【対策】平らな板にすると造花になる。実物の葉は中肋に沿って
                    //         谷折りに窪み、ふちは大きく波打っている
                    const cup = cfg.bladeCup * hw * w * w;
                    const wv = wave * hw * 0.42 * Math.sin(4.3 * u + 2.1 * w + wph) * Math.abs(w);
                    const lat = hw * w * (1 + 0.10 * Math.sin(6.0 * u + wph));
                    return vec(
                        C.x + F.S.x * lat + F.N.x * (cup + wv),
                        C.y + F.S.y * lat + F.N.y * (cup + wv),
                        C.z + F.S.z * lat + F.N.z * (cup + wv));
                };
                for (let iu = 0; iu <= NU; iu++) {
                    const u = iu / NU;
                    for (let iv = 0; iv <= NV; iv++) {
                        const w = iv / NV * 2 - 1;
                        P.push(pt(u, w));
                    }
                }
                const IDX = (iu, iv) => iu * (NV + 1) + iv;
                for (let iu = 0; iu <= NU; iu++) for (let iv = 0; iv <= NV; iv++) {
                    const a = P[IDX(Math.min(NU, iu + 1), iv)], b = P[IDX(Math.max(0, iu - 1), iv)];
                    const c = P[IDX(iu, Math.min(NV, iv + 1))], d = P[IDX(iu, Math.max(0, iv - 1))];
                    let n = vcross(vsub(a, b), vsub(c, d));
                    if (vlen(n) < 1e-9) n = vec(0, 1, 0);
                    Nn.push(vnorm(n));
                }
                const sstart = bladeBuf.nv;
                for (let iu = 0; iu <= NU; iu++) {
                    const u = iu / NU;
                    for (let iv = 0; iv <= NV; iv++) {
                        const w = iv / NV * 2 - 1, id = IDX(iu, iv);
                        const p = P[id], n = Nn[id];
                        // 葉脈。中肋から左右へ斜めに走る
                        const vn = Math.pow(0.5 + 0.5 * Math.cos(TAU * (w * cfg.leafVeins + u * 1.6)), 7.0);
                        const mid = Math.pow(1 - Math.min(1, Math.abs(w) / 0.13), 2.0);
                        const g = 0.90 + 0.18 * Noise.fbm3(p.x * 1.7, p.y * 1.7, p.z * 1.7, this.nseed + 71, 2);
                        let cr = BT[0], cg = BT[1], cb = BT[2];
                        const vk = clamp(vn * 0.45 * (1 - Math.abs(w) * 0.4) + mid * 0.95, 0, 1);
                        cr = mix(cr, BV[0], vk); cg = mix(cg, BV[1], vk); cb = mix(cb, BV[2], vk);
                        // 付け根は葉柄の色へ、ふちはやや明るく
                        const rootk = 1 - smooth(0.0, 0.28, u);
                        cr = mix(cr, RB[0], rootk * 0.85); cg = mix(cg, RB[1], rootk * 0.85); cb = mix(cb, RB[2], rootk * 0.85);
                        const edge = Math.pow(Math.abs(w), 8.0) * 0.30;
                        cr = mix(cr, BV[0], edge); cg = mix(cg, BV[1], edge); cb = mix(cb, BV[2], edge);
                        bladeBuf.vert(p.x, p.y, p.z, n.x, n.y, n.z,
                            srgb(cr * g), srgb(cg * g), srgb(cb * g));
                    }
                }
                for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
                    const A = sstart + IDX(iu, iv);
                    bladeBuf.quad(A, A + 1, A + (NV + 1), A + (NV + 1) + 1);
                }
            }

            if (ribBuf.nt) {
                const m = ribBuf.toMesh("cauliflowerRibs", this.scene);
                m.material = this.mats.stem;
                m.receiveShadows = true;
                this.parts.push(m);
            }
            if (bladeBuf.nt) {
                const m = bladeBuf.toMesh("cauliflowerLeaves", this.scene);
                m.material = this.mats.leaf;
                m.receiveShadows = true;
                this.parts.push(m);
            }
        }

        // 頂点色に球状遮蔽を掛ける（茎と枝用の後処理）
        applyAO(buf, self) {
            const cfg = this.cfg, domes = this.domes;
            const P = buf.pos, N = buf.nrm, C = buf.col;
            for (let i = 0; i < buf.nv; i++) {
                const p = i * 3, q = i * 4;
                const ao = sphereAO(P[p], P[p + 1], P[p + 2], N[p], N[p + 1], N[p + 2],
                    domes, self, cfg.aoStrength * 0.85, cfg.aoFloor + 0.06);
                C[q] *= ao; C[q + 1] *= ao; C[q + 2] *= ao;
            }
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

        // 置き方。0 = 立てる（切り口を下に） / 1 = 寝かせる（写真のざる）
        setPose(pose, floorY) {
            if (pose === 0) {
                this.root.rotationQuaternion = BABYLON.Quaternion.Identity();
            } else {
                // 【対策】寝かせる向きをオイラー角で持つと、カメラの初期方位を
                //         変えるたびに合わせ直すことになり、意味も読めない。
                //         「茎の先が world のどちらを向くか」というベクトルで
                //         持ち、ローカル +Y（切り口→頭）をその逆へ向ける
                //         回転として作る。POSE_LIE は既定カメラで画面の
                //         右やや下に茎が来るよう逆算した値
                const d = POSE_LIE.clone();
                d.normalize();
                const up = BABYLON.Vector3.Up();
                const ax = BABYLON.Vector3.Cross(up, d);
                const an = Math.acos(clamp(BABYLON.Vector3.Dot(up, d), -1, 1));
                this.root.rotationQuaternion = (ax.length() < 1e-5)
                    ? BABYLON.Quaternion.Identity()
                    : BABYLON.Quaternion.RotationAxis(ax.normalize(), an);
            }
            this.root.position.set(0, 0, 0);
            this.root.computeWorldMatrix(true);
            const b = this.worldBounds();
            this.root.position.y += floorY - b.mny;
            // 頭の中心が画の真ん中に来るように水平方向も戻す
            this.root.computeWorldMatrix(true);
            const b2 = this.worldBounds();
            this.root.position.x -= (b2.mnx + b2.mxx) * 0.5;
            this.root.position.z -= (b2.mnz + b2.mxz) * 0.5;
            this.root.computeWorldMatrix(true);
            // 落下開始位置を作るため、静止する姿勢と位置を覚えておく
            this.poseQ = this.root.rotationQuaternion.clone();
            this.poseP = this.root.position.clone();
        }

        dispose() {
            for (const m of this.parts) m.dispose();
            this.root.dispose();
            this.parts.length = 0;
        }
    }

    // 隣の房の内側に入っているか（楕円体で判定）
    function insideNeighbor(cfg, p, near) {
        for (let i = 0; i < near.length; i++) {
            const b = near[i];
            const vx = p.x - b.c.x, vy = p.y - b.c.y, vz = p.z - b.c.z;
            const lx = vx * b.e1.x + vy * b.e1.y + vz * b.e1.z;
            const ly = vx * b.e2.x + vy * b.e2.y + vz * b.e2.z;
            const lz = vx * b.ax.x + vy * b.ax.y + vz * b.ax.z;
            const a = b.R, c = b.R * cfg.domeSquash;
            const q = Math.sqrt((lx * lx + ly * ly) / (a * a) + (lz * lz) / (c * c));
            if (q > 1.20) continue;
            const d = vnorm(vec(lx, ly, lz));
            if (q < lumpAt(cfg, b, d) * 0.985) return true;
        }
        return false;
    }

    // =================================================================
    //  マテリアル
    // =================================================================
    class Mats {
        constructor(scene, cfg) {
            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const curd = new BABYLON.PBRMaterial("curdMat", scene);
            curd.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            curd.metallic = 0.0;
            curd.roughness = cfg.budRough;
            curd.transparencyMode = OPAQUE;
            // 【対策】蕾の表面はブルーム（果粉）で覆われていて、艶は出ない。
            //         クリアコートを入れると「濡れたコケ」になる。代わりに
            //         シーンを弱く効かせると、斜めから見たときだけ白っぽく
            //         かすむ粉っぽさが出る
            curd.sheen.isEnabled = true;
            curd.sheen.intensity = 0.16;
            curd.sheen.roughness = 0.85;
            curd.sheen.color = new BABYLON.Color3(0.62, 0.70, 0.66);
            curd.sheen.linkSheenWithAlbedo = false;
            this.curd = curd;

            const stem = new BABYLON.PBRMaterial("stemMat", scene);
            stem.albedoColor = new BABYLON.Color3(1, 1, 1);
            stem.metallic = 0.0;
            stem.roughness = cfg.stemRough;
            stem.transparencyMode = OPAQUE;
            stem.clearCoat.isEnabled = true;
            stem.clearCoat.intensity = cfg.stemCoat;
            stem.clearCoat.roughness = 0.24;
            // 【対策】食品の表面を覆っているのは水（1.33）で、樹脂（1.5）ではない。
            //         1.5 にするとプラスチックの人形になる
            stem.clearCoat.indexOfRefraction = 1.33;
            stem.subSurface.isTranslucencyEnabled = true;
            stem.subSurface.tintColor = new BABYLON.Color3(0.55, 0.72, 0.32);
            // 【対策】Babylon 8 で translucencyIntensity は拡散と透過の
            //         配合比に変わった。1.0 を超えると拡散が消えて発光する
            stem.subSurface.translucencyIntensity = 0.22;
            stem.subSurface.minimumThickness = 0.8;
            stem.subSurface.maximumThickness = 3.6;
            this.stem = stem;

            // --- 葉身
            const leaf = new BABYLON.PBRMaterial("leafMat", scene);
            leaf.albedoColor = new BABYLON.Color3(1, 1, 1);
            leaf.metallic = 0.0;
            leaf.roughness = 0.56;
            leaf.transparencyMode = OPAQUE;
            // 【対策】葉身は厚さ 0.3mm 程度のシートで作ってあるので、
            //         両面を点灯させないと裏から見た葉が真っ黒に抜ける
            leaf.backFaceCulling = false;
            leaf.twoSidedLighting = true;
            // 【対策】アブラナ科の葉は蝋質のブルームで覆われていて、
            //         斜めから見ると白く粉を吹く。これが無いと造花の葉になる
            leaf.sheen.isEnabled = true;
            leaf.sheen.intensity = 0.34;
            leaf.sheen.roughness = 0.70;
            leaf.sheen.color = new BABYLON.Color3(0.70, 0.76, 0.72);
            leaf.subSurface.isTranslucencyEnabled = true;
            leaf.subSurface.tintColor = new BABYLON.Color3(0.42, 0.62, 0.22);
            leaf.subSurface.translucencyIntensity = 0.42;
            leaf.subSurface.minimumThickness = 0.01;
            leaf.subSurface.maximumThickness = 0.14;
            this.leaf = leaf;
        }

        // 0 = 通常 / 1 = 白クレイ（形だけ）/ 2 = 粒を外す
        setDebug(mode, meshes) {
            const white = (mode === 1);
            this.curd.albedoColor = new BABYLON.Color3(white ? 0.72 : 1, white ? 0.72 : 1, white ? 0.72 : 1);
            this.stem.albedoColor = new BABYLON.Color3(white ? 0.78 : 1, white ? 0.78 : 1, white ? 0.78 : 1);
            this.curd.sheen.isEnabled = !white;
            this.leaf.sheen.isEnabled = !white;
            this.leaf.subSurface.isTranslucencyEnabled = !white;
            this.stem.clearCoat.isEnabled = !white;
            this.stem.subSurface.isTranslucencyEnabled = !white;
            for (const m of meshes) {
                m.useVertexColors = !white;
                if (m.name === "curdBuds") m.setEnabled(mode !== 2);
            }
        }

        dispose() {
            this.curd.dispose(true, false);
            this.stem.dispose(true, false);
            this.leaf.dispose(true, false);
        }
    }


    // =================================================================
    //  TextureLab （ざるの網代だけ。野菜側は全部頂点カラー）
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
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },
        // 竹ひごの網代（あじろ）。u が周方向、v が中心→縁
        // 【対策】明暗差を付けすぎると将棋盤になる。竹ひごの上下は
        //         色ではなく陰影の差でしかない
        bamboo(scene, size, seed) {
            // 【対策】ざるのアルベドは他の野菜（トマト・シイタケ）と同じ値だが、
            //         こちらは花蕾を出すために露出と環境光を上げてある。
            //         同じ 0.87 を入れると白く飛んで、竹ではなく紙皿になる。
            //         明るさを上げたぶんだけアルベドを落として釣り合わせる
            const K = 0.92;
            const OVER = [0.870 * K, 0.795 * K, 0.625 * K];
            const UNDER = [0.795 * K, 0.710 * K, 0.535 * K];
            const GAP = [0.560 * K, 0.475 * K, 0.335 * K];
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
            const s2 = i / K, pr = prof(s2), nn = pn(s2);
            const r = pr[0], y = pr[1], nr = nn[0], ny = nn[1];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * TAU;
                const cs = Math.cos(phi), sn = Math.sin(phi);
                const a = i * W + j, b = LAY + a;
                positions[a * 3] = r * cs; positions[a * 3 + 1] = y; positions[a * 3 + 2] = r * sn;
                const ro = r - nr * TH, yo = y - ny * TH;
                positions[b * 3] = ro * cs; positions[b * 3 + 1] = yo; positions[b * 3 + 2] = ro * sn;
                uvs[a * 2] = j / M; uvs[a * 2 + 1] = s2;
                uvs[b * 2] = j / M; uvs[b * 2 + 1] = s2;
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
    scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.945, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    // 【対策】花蕾は「暗い緑の下地に、明るい粒が無数に載っている」構造で、
    //         平均アルベドが低いうえ、粒どうしが互いを遮蔽して
    //         さらに落ちる。他の野菜と同じ露出だと真っ黒な塊になる。
    //         環境光・露出を上げ、コントラストは逆に下げて暗部を潰さない
    scene.environmentIntensity = 0.76;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.05, 0.98, 46, new V3(0, 6.0, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.60;
    camera.wheelPrecision = 10;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を小さくすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 5;
    camera.maxZ = 260;
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 140;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.56;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.42, -0.90, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.96);
    key.specular = new BABYLON.Color3(0.55, 0.55, 0.52);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.88, -0.30, -0.60).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.95, 1.0, 0.95);
    fillL.specular = new BABYLON.Color3(0.24, 0.26, 0.22);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.58;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.76, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    // 【対策】粒は1個ずつが閉じた立体なので、裏面だけ影マップへ描けば
    //         自己遮蔽（シャドウアクネ）が原理的に起きない。
    //         数万個の粒に通常のバイアスで対処するのは無理
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0004;
    sg.normalBias = 0.012;
    sg.darkness = 0.28;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.04;
    ip.contrast = 1.09;
    ip.vignetteEnabled = false;

    // =================================================================
    //  物理（ざるへ落として据わらせる）
    // =================================================================
    let physicsOn = false;
    try {
        const havok = await HavokPhysics();
        // 【対策】HavokPlugin の第1引数は _useDeltaForWorldStep。
        //         true（既定）だとフレームのデルタ時間でそのまま積分するため、
        //         フレーム落ちのたびにステップ幅が変わり、接触が解けたり
        //         深く食い込んだりを繰り返して震える。false で固定ステップにする
        const hk = new BABYLON.HavokPlugin(false, havok);
        // 【対策】1単位 = 1cm なので重力も cm/s² で与える。ただし実重力 981 は
        //         入れない。Havok の接触許容量やスリープ閾値は絶対値で、
        //         メートル系を前提に決まっている。cm 単位のシーンでは実質
        //         1/100 の厳しさになり、1ステップのめり込みが許容量を超えて
        //         押し戻され続ける。重力を数百に落とすのがいちばん安い解
        scene.enablePhysics(new V3(0, -GLOBAL.gravity, 0), hk);
        if (hk.setTimeStep) hk.setTimeStep(1 / GLOBAL.physicsHz);
        physicsOn = true;
    } catch (err) {
        console.warn("[Cauliflower] Havok を初期化できませんでした。静置します。", err);
        physicsOn = false;
    }

    let ground = null;
    if (GLOBAL.showGround) {
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 220, height: 2, depth: 220 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.90, 0.905).toLinearSpace();
        gm.metallic = 0.0; gm.roughness = 0.88;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        ground.material = gm;
        ground.receiveShadows = true;
        ground.position.y = -1.06;
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        if (physicsOn) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    let basket = buildBasket(scene, GLOBAL);

    let dropBody = null, dropShape = null, dropProxy = null;
    let settleT = 0, stillT = 0, frozen = false;
    let basketBody = null, basketShape = null;

    // 【対策】ざるは内面と外面を張って縁で閉じた「厚みのある器」なので、
    //         静的トライメッシュのまま安定して受け止められる。
    //         円盤などで代用すると器の壁で受け止められない
    function setBasketPhysics(on) {
        if (basketBody) { basketBody.dispose(); basketBody = null; }
        if (basketShape) { try { basketShape.dispose(); } catch (e) { } basketShape = null; }
        if (!physicsOn || !on) return;
        basketShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        basketShape.material = { friction: 0.85, restitution: 0.0 };
        basketBody = new BABYLON.PhysicsBody(basket, BABYLON.PhysicsMotionType.STATIC, false, scene);
        basketBody.shape = basketShape;
    }

    function clearDrop() {
        if (dropBody) { dropBody.dispose(); dropBody = null; }
        if (dropShape) { try { dropShape.dispose(); } catch (e) { } dropShape = null; }
        // 【対策】代理を先に捨てると本体の親が消えた節点を指したままになる
        if (item && item.root) item.root.parent = null;
        if (dropProxy) { dropProxy.dispose(); dropProxy = null; }
        settleT = 0; stillT = 0; frozen = false;
    }

    // 衝突用の低ポリ代理。
    // 【対策】60万頂点の花蕾から凸包を作ると生成で固まるし、粒1個ずつの
    //         接触を解いても意味がない。かといって扁球＋円柱で近似すると、
    //         実際の房の張り出しぶん小さくなり、見た目が器へめり込む。
    //         房の中心を半径ぶん外へ押した点と茎の輪郭点、つまり
    //         「本体そのものの外殻」から凸包を作る
    function proxyPoints() {
        const pts = [];
        const C = item.env.C;
        for (const d of item.domes) {
            const vx = d.c.x - C.x, vy = d.c.y - C.y, vz = d.c.z - C.z;
            const l = Math.hypot(vx, vy, vz) || 1;
            pts.push([d.c.x + vx / l * d.R * 0.94,
                      d.c.y + vy / l * d.R * 0.94,
                      d.c.z + vz / l * d.R * 0.94]);
        }
        for (let ring = 0; ring <= 3; ring++) {
            const sv = ring / 3;
            const y = item.H * sv, r = item.stemRadius(sv);
            for (let j = 0; j < 12; j++) {
                const a = j / 12 * TAU;
                pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
            }
        }
        // 【対策】カリフラワーは切り口の小さな円で立っているのではなく、
        //         外へ張り出した葉柄の輪の上に座っている。ここを凸包へ
        //         入れないと、頭の球だけで判定されて必ず横倒しになる
        if (item.ribPts) for (const p of item.ribPts) pts.push([p.x, p.y, p.z]);
        return pts;
    }

    function makeProxy(pts) {
        const mesh = new BABYLON.Mesh("cauliflowerProxy", scene);
        const pos = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
            pos[i * 3] = pts[i][0]; pos[i * 3 + 1] = pts[i][1]; pos[i * 3 + 2] = pts[i][2];
        }
        const idx = [];
        for (let i = 0; i + 2 < pts.length; i++) idx.push(i, i + 1, i + 2);
        const nrm = new Float32Array(pts.length * 3);
        BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
        const mm = makeMesh("cauliflowerProxy", pos, idx, nrm, null, null, scene);
        mesh.dispose();
        mm.isVisible = false;
        return mm;
    }

    function dropItem() {
        clearDrop();
        if (!item) return;
        item.setPose(GLOBAL.pose, floorY());
        // カメラの注視点は据わったあとの位置で決めたいので、
        // 落下前の静止姿勢での範囲をここで控えておく
        item.restBounds = item.worldBounds();
        if (!physicsOn) return;

        const pts = proxyPoints();
        dropProxy = makeProxy(pts);
        dropProxy.rotationQuaternion = item.poseQ.clone();

        // 【対策】代理の外形は本体と完全には一致しない。本体の静止位置を
        //         そのまま使うと、代理のほうが下へはみ出していた場合に
        //         器へ食い込んだ状態で生成され、ソルバが押し返して
        //         「下から浮き上がってきて震える」動きになる。
        //         代理を回した状態での最下点を測り、そこを基準に持ち上げる
        const m = new BABYLON.Matrix();
        BABYLON.Matrix.FromQuaternionToRef(dropProxy.rotationQuaternion, m);
        let lo = Infinity, cx = 0, cz = 0, n = 0;
        const tmp = new V3();
        for (const p of pts) {
            BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(p[0], p[1], p[2], m, tmp);
            if (tmp.y < lo) lo = tmp.y;
            cx += tmp.x; cz += tmp.z; n++;
        }
        dropProxy.position.set(
            -cx / n + (Math.random() - 0.5) * 0.9,
            floorY() + GLOBAL.dropHeight - lo,
            -cz / n + (Math.random() - 0.5) * 0.9);

        item.root.parent = dropProxy;
        item.root.rotationQuaternion = BABYLON.Quaternion.Identity();
        item.root.position.set(0, 0, 0);

        dropShape = new BABYLON.PhysicsShapeConvexHull(dropProxy, scene);
        dropShape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
        dropBody = new BABYLON.PhysicsBody(dropProxy, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        dropBody.shape = dropShape;
        dropBody.setMassProperties({ mass: GLOBAL.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションに書いても効かない
        dropBody.setLinearDamping(GLOBAL.linearDamping);
        dropBody.setAngularDamping(GLOBAL.angularDamping);
        // 【対策】毎フレーム「ノードの姿勢 → 物理ボディ」へ書き戻すと、
        //         物理が出した結果を読み直して押し込む往復が起き、
        //         接触したまま延々と震える。落とす前に姿勢は決めてあるので
        //         書き戻しは要らない
        dropBody.disablePreStep = true;
    }

    scene.onBeforeRenderObservable.add(() => {
        if (!physicsOn || !dropBody || frozen) return;
        const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
        settleT += dt;
        // 【対策】静止後もソルバの残差で微振動が続く。速度がしきい値を
        //         下回った状態が続いたら STATIC に固定して完全に止める
        let moving = true;
        try {
            moving = dropBody.getLinearVelocity().length() > GLOBAL.settleSpeed
                || dropBody.getAngularVelocity().length() > GLOBAL.settleSpin;
        } catch (e) { moving = false; }
        stillT = moving ? 0 : stillT + dt;
        if (stillT > GLOBAL.settleHold || settleT > GLOBAL.settleTimeout) {
            dropBody.setMotionType(BABYLON.PhysicsMotionType.STATIC);
            frozen = true;
        }
    });

    setBasketPhysics(GLOBAL.showBasket);

    // =================================================================
    //  生成
    // =================================================================
    let item = null, mats = null, curVariety = START_VARIETY, curSeed = START_SEED, curCfg = null;
    let dbgIdx = 0, onRebuilt = null;
    const DEBUGS = ["通常", "白クレイ", "粒を外す"];

    function floorY() {
        return GLOBAL.showBasket ? GLOBAL.basketThick : 0;
    }

    function build(varietyKey, seed) {
        clearDrop();
        if (item) item.dispose();
        if (mats) mats.dispose();
        const cfg = buildConfig(varietyKey, seed);
        curCfg = cfg;
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        mats = new Mats(scene, cfg);
        item = new Cauliflower(scene, cfg, seed, mats);
        dropItem();

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const m of item.parts) sg.addShadowCaster(m, true);
        if (basket) sg.addShadowCaster(basket, true);

        const b = item.restBounds || item.worldBounds();
        camera.target.set(0, (b.mny + b.mxy) * 0.5, 0);
        camera.radius = Math.max(26, (b.mxx - b.mnx) * 2.6);

        mats.setDebug(dbgIdx, item.parts);
        const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        console.log("[Cauliflower]", BUILD, "/", cfg.label, "/ seed =", cfg.seed,
            "/ 房", item.domes.length, "個 / 蕾", item.budCount, "個 /",
            Math.round(t1 - t0), "ms");
        if (typeof globalThis.__DBG !== "undefined") {
            const ys = item.domes.map(d => d.c.y).sort((a, b) => a - b);
            const rs = item.domes.map(d => d.R).sort((a, b) => a - b);
            console.log("  dome y:", ys[0].toFixed(2), ys[(ys.length / 2) | 0].toFixed(2), ys[ys.length - 1].toFixed(2),
                "R:", rs[0].toFixed(2), rs[(rs.length / 2) | 0].toFixed(2), rs[rs.length - 1].toFixed(2),
                "env C.y", item.env.C.y.toFixed(2), "Rx", item.env.Rx.toFixed(2), "Ry", item.env.Ry.toFixed(2));
            const elev = item.domes.map(d => Math.asin((d.c.y - item.env.C.y) / Math.max(1e-6, Math.hypot(d.c.x, d.c.y - item.env.C.y, d.c.z))));
            const buckets = [0, 0, 0, 0, 0, 0];
            for (const e of elev) buckets[Math.min(5, Math.max(0, Math.floor((e + 0.6) / (2.2 / 6))))]++;
            console.log("  elev buckets(-0.6..1.6):", buckets.join("/"));
            // 包絡面のどれだけが房で覆われているかをモンテカルロで測る
            let hit = 0, tot = 0;
            const C0 = item.env.C, sMin = Math.sin(cfg.elevMin);
            for (let i = 0; i < 4000; i++) {
                const y = sMin + (1 - sMin) * ((i + 0.5) / 4000);
                const rr = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.3999632;
                const dx = rr * Math.cos(th), dy = y, dz = rr * Math.sin(th);
                tot++;
                let ok = false;
                for (const d of item.domes) {
                    const vx = d.c.x - C0.x, vy = d.c.y - C0.y, vz = d.c.z - C0.z;
                    const L = Math.hypot(vx, vy, vz);
                    if (L < d.R) { ok = true; break; }
                    const cosang = (vx * dx + vy * dy + vz * dz) / L;
                    if (cosang <= 0) continue;
                    if (Math.acos(Math.min(1, cosang)) < Math.asin(Math.min(1, d.R / L))) { ok = true; break; }
                }
                if (ok) hit++;
            }
            console.log("  頭部の被覆率:", (hit / tot * 100).toFixed(1) + "%");
        }
        if (onRebuilt) onRebuilt();
    }

    build(START_VARIETY, START_SEED);

    if (GLOBAL.useSSAO) {
        const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        // 【対策】房と房のあいだの谷は 5〜10mm。半径を大きく取ると
        //         野菜と床の隙間しか拾わず、頭部が一枚の平面に見える。
        //         1〜2mm の粒の谷は SSAO では届かないので頂点色に焼いてある
        ssao.radius = 0.62;
        ssao.totalStrength = 0.85;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 180;
        ssao.minZAspect = 0.3;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.98;
    dp.bloomWeight = 0.06;
    dp.bloomKernel = 36;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    // 【対策】粒が細かいのでシャープンを強くすると、粒のふちに白い縁取りが
    //         出て一気に CG くさくなる。他の野菜より弱めにする
    dp.sharpen.edgeAmount = 0.14;
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
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#22261c", active: "#6d7a4f", edge: "#3d4433",
        text: "#f6f3e6", sub: "#c2c3a8", accent: "#dbe0a8"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "238px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(16,18,12,0.84)";
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

    addLabel("CAULIFLOWER", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    const varietyBtns = {}, qualBtns = {};
    function highlight() {
        for (const k in varietyBtns) varietyBtns[k].background = (k === curVariety) ? COL.active : COL.idle;
        for (const k in qualBtns) qualBtns[k].background = (+k === GLOBAL.quality) ? COL.active : COL.idle;
    }
    for (const k of Object.keys(PRESETS)) {
        varietyBtns[k] = addButton("v_" + k, PRESETS[k].label, () => {
            curVariety = k; build(curVariety, curSeed); highlight();
        });
    }

    addLabel("粒の細かさ", 13, COL.accent, "26px");
    for (let q = 0; q < QUALITY.length; q++) {
        qualBtns[q] = addButton("q" + q, QUALITY[q].label, () => {
            GLOBAL.quality = q; build(curVariety, curSeed); highlight();
        });
    }

    const sp = new BABYLON.GUI.Rectangle();
    sp.height = "8px"; sp.thickness = 0; sp.background = "";
    panel.addControl(sp);

    const poseBtn = addButton("pose", "置き方: 立てる", () => {
        GLOBAL.pose = GLOBAL.pose === 0 ? 1 : 0;
        dropItem();
        const b = item.restBounds || item.worldBounds();
        camera.target.set(0, (b.mny + b.mxy) * 0.5, 0);
        poseBtn.textBlock.text = "置き方: " + (GLOBAL.pose === 0 ? "立てる" : "寝かせる");
        if (onRebuilt) onRebuilt();
    });
    const basketBtn = addButton("basket", "ざる: ON", () => {
        GLOBAL.showBasket = !GLOBAL.showBasket;
        basket.setEnabled(GLOBAL.showBasket);
        setBasketPhysics(GLOBAL.showBasket);
        dropItem();
        basketBtn.background = GLOBAL.showBasket ? COL.active : COL.idle;
        basketBtn.textBlock.text = "ざる: " + (GLOBAL.showBasket ? "ON" : "OFF");
    });
    basketBtn.background = COL.active;
    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed); highlight();
    });
    const dbgBtn = addButton("dbg", "表示: 通常", () => {
        dbgIdx = (dbgIdx + 1) % DEBUGS.length;
        mats.setDebug(dbgIdx, item.parts);
        dbgBtn.background = dbgIdx ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "表示: " + DEBUGS[dbgIdx];
    });
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

    const info = addLabel("", 12, COL.sub, "58px");
    onRebuilt = () => {
        if (!info || !item) return;
        const b = item.worldBounds();
        info.text = "房 " + item.domes.length + " / 粒 " + item.budCount
            + "\n高さ " + (b.mxy - b.mny).toFixed(1) + "cm  幅 " + (b.mxx - b.mnx).toFixed(1) + "cm"
            + "\nseed: " + curSeed + "  [" + BUILD + "]";
    };
    onRebuilt();

    // ---- GUI の開閉（スマホでは初期状態で畳む）-----------------------
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
    toggleBtn.background = "rgba(16,18,12,0.84)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(16,18,12,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;