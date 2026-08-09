// =====================================================================
//  Photoreal Edamame  /  写実的な枝豆
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 品種プリセット（白毛 / 茶豆 / 黒豆）と籠・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ（形状）/ 2D周期ノイズ（テクスチャ）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Fields      … 豆の膨らみ / 扁平な断面と縫合線 / エンベロープ
//    5. TextureLab  … 果皮のアルベド・ORM・法線・産毛アルファ、竹の網代
//    6. Edamame     … 莢 + 果柄 + 産毛シェル
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1莢ずつ落とす）
//    9. GUI
//
//  オクラ版からの主な変更点（ここを外すと「細いオクラ」になる）:
//    ・断面が角ばった多角形ではなく「扁平なレンズ形」。左右の縫合線
//      （seam）が稜になり、広い面は平ら。断面の指数はここで効かせる
//    ・主役は豆の膨らみ。2〜3粒がそれぞれ莢を押し出し、粒と粒の間で
//      莢がくびれる。膨らみは「厚み方向」に強く、「幅方向」には
//      ほとんど出ない。ここを一様に膨らませると芋虫になる
//    ・ヘタは太いカラーではなく、細い果柄（2mm強）と小さな襟
//    ・産毛が最大の特徴。オクラのように法線＋sheen だけだと
//      シルエットに毛が立たない。シェル（殻）を薄く重ね、
//      opacityFresnel で「輪郭付近だけ」毛を見せる
//    ・生／塩ゆで の2状態。塩ゆでは色が冴え、艶が出て、塩の粒が乗る
//
//  影の設定はジャガイモ版で判明した ESM の自己遮蔽（皮の痣）を避け、
//  最初から PCF + forceBackFacesOnly にしてあります。
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        shirage: {
            label: "白毛豆（青豆）",
            length: 4.60, width: 1.26, thick: 0.92,
            bean3: 0.55,                        // 3粒莢の出る確率
            // 豆の膨らみ
            lobeAmp: 1.00,                      // 1.0 = 厚みが valleyFloor→1 まで動く
            valleyFloor: 0.48,                  // くびれの底の厚み比
            lobeSharp: 0.95,                    // 小さいほど粒の盛りが広くなだらか
            lobeMix: 3.5,                       // p-ノルムの p。大きいほど粒が分離
            widthLobe: 0.24,                    // 幅方向にどれだけ膨らませるか
            beanSpanA: 0.17, beanSpanB: 0.885,
            // 断面
            edgeExp: 0.58,                      // <1 で縫合線が鋭く、広い面が平らに
            keelRound: 0.095,                   // 縫合線の丸め（0 だと曲率が発散）
            keel: 0.016,                        // 縫合線のわずかな出っ張り
            sectionAmp: 0.45,                   // 頂点を縫合線へ寄せる量
            // 軸方向
            headFloorA: 0.34, headFloorB: 0.40, // 付け根の幅／厚みの下限
            tipLen: 0.130, tipFlat: 0.35, tipPow: 0.85,
            bendA: 0.042, bendB: 0.012, bendC: 0.009,
            twist: 0.07, asym: 0.020,
            // 果柄
            stemLen: 0.40, stemR: 0.115, collarAmt: 0.16,
            // 産毛
            fuzzLen: 0.075, fuzzShells: 2, fuzzDensity: 300,
            fuzzAlpha: 0.30, fuzzStretch: 0.30,
            fuzzCol: [0.86, 0.87, 0.78],
            // 色（sRGB）
            podValley: [0.215, 0.360, 0.115],
            podMid: [0.345, 0.535, 0.175],
            podBean: [0.485, 0.665, 0.238],
            seamCol: [0.545, 0.660, 0.295],
            beakCol: [0.430, 0.470, 0.170],
            baseCol: [0.500, 0.560, 0.235],
            scarCol: [0.400, 0.330, 0.145],
            bloom: [0.0, 0.0, 0.0], bloomAmt: 0.0,
            stemCol: [0.600, 0.660, 0.320],
            stemCut: [0.840, 0.820, 0.620],
            collarCol: [0.420, 0.420, 0.190],
            skinRough: 0.70, sheenAmt: 0.50, sheenCol: [0.80, 0.84, 0.62]
        },
        chamame: {
            label: "茶豆（だだちゃ豆）",
            // 粒が大きくくびれが深い。毛が褐色で、莢はやや黄味の強い緑
            length: 4.20, width: 1.24, thick: 0.98,
            bean3: 0.28,
            lobeAmp: 1.00,
            valleyFloor: 0.440,
            lobeSharp: 0.92,
            lobeMix: 3.5,
            widthLobe: 0.26,
            beanSpanA: 0.18, beanSpanB: 0.875,
            edgeExp: 0.56,
            keelRound: 0.092,
            keel: 0.018,
            sectionAmp: 0.45,
            headFloorA: 0.36, headFloorB: 0.42,
            tipLen: 0.126, tipFlat: 0.36, tipPow: 0.84,
            bendA: 0.050, bendB: 0.014, bendC: 0.010,
            twist: 0.08, asym: 0.024,
            stemLen: 0.38, stemR: 0.112, collarAmt: 0.18,
            fuzzLen: 0.080, fuzzShells: 2, fuzzDensity: 280,
            fuzzAlpha: 0.34, fuzzStretch: 0.28,
            fuzzCol: [0.720, 0.600, 0.440],
            podValley: [0.230, 0.345, 0.110],
            podMid: [0.375, 0.520, 0.170],
            podBean: [0.530, 0.655, 0.248],
            seamCol: [0.565, 0.650, 0.286],
            beakCol: [0.450, 0.430, 0.160],
            baseCol: [0.520, 0.550, 0.230],
            scarCol: [0.420, 0.310, 0.130],
            bloom: [0.0, 0.0, 0.0], bloomAmt: 0.0,
            stemCol: [0.610, 0.630, 0.300],
            stemCut: [0.830, 0.800, 0.590],
            collarCol: [0.440, 0.395, 0.175],
            skinRough: 0.73, sheenAmt: 0.58, sheenCol: [0.82, 0.76, 0.56]
        },
        kuromame: {
            label: "黒豆枝豆（丹波黒）",
            // 莢も粒も大きい。2粒莢が主で、粒がはっきり浮き出る。
            // 完熟に近いものは莢に黒紫の色が差す
            length: 5.40, width: 1.52, thick: 1.12,
            bean3: 0.18,
            lobeAmp: 1.00,
            valleyFloor: 0.470,
            lobeSharp: 0.90,
            lobeMix: 3.5,
            widthLobe: 0.25,
            beanSpanA: 0.16, beanSpanB: 0.890,
            edgeExp: 0.62,
            keelRound: 0.105,
            keel: 0.014,
            sectionAmp: 0.45,
            headFloorA: 0.34, headFloorB: 0.40,
            tipLen: 0.134, tipFlat: 0.33, tipPow: 0.86,
            bendA: 0.038, bendB: 0.011, bendC: 0.008,
            twist: 0.06, asym: 0.022,
            stemLen: 0.44, stemR: 0.130, collarAmt: 0.15,
            fuzzLen: 0.078, fuzzShells: 2, fuzzDensity: 290,
            fuzzAlpha: 0.26, fuzzStretch: 0.32,
            fuzzCol: [0.760, 0.740, 0.660],
            podValley: [0.160, 0.275, 0.100],
            podMid: [0.255, 0.405, 0.150],
            podBean: [0.375, 0.545, 0.205],
            seamCol: [0.430, 0.560, 0.245],
            beakCol: [0.330, 0.360, 0.150],
            baseCol: [0.400, 0.450, 0.200],
            scarCol: [0.300, 0.235, 0.130],
            bloom: [0.230, 0.150, 0.260], bloomAmt: 0.30,
            stemCol: [0.520, 0.570, 0.280],
            stemCut: [0.800, 0.780, 0.580],
            collarCol: [0.380, 0.360, 0.175],
            skinRough: 0.72, sheenAmt: 0.46, sheenCol: [0.76, 0.80, 0.62]
        }
    };

    const GLOBAL = {
        count: 24,                 // 莢の数
        boiled: true,              // 塩ゆで（false = 生）
        fuzzOn: true,              // 産毛シェル
        shadowOn: true,

        // 籠（ざる）
        basketRim: 10.6,           // 縁の半径 cm
        basketDepth: 3.2,          // 深さ cm
        basketThick: 0.36,         // 竹ひごの厚み cm
        basketSegments: 96,
        basketRings: 30,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。ここに実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 460,
        physicsHz: 120,
        pieceMass: 1.0,
        // 【対策】枝豆は扁平で、平らな面どうしが接すると滑りやすい。
        //         摩擦を上げないと山が崩れてざるの縁へ流れていく
        friction: 0.92,
        restitution: 0.02,
        linearDamping: 0.18,
        angularDamping: 0.94,
        dropInterval: 0.10,
        dropClearance: 0.9,
        freezeWhenSettled: true,
        settleSpeed: 2.5, settleSpin: 3.0, settleHold: 0.35,
        settleTimeout: 8.0,

        segmentsAxis: 128,
        segmentsRound: 72,
        shellAxis: 40,
        shellRound: 26,
        stemSegments: 18,

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

    const START_VARIETY = "shirage";
    const START_SEED = 20260803;
    const BUILD = "edamame-B";

    const V3 = BABYLON.Vector3;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    // 茹でると葉緑素が冴えて明るい黄緑になる。艶も出る
    function boilCol(c) {
        return [clamp(c[0] * 1.04 + 0.008, 0, 1),
        clamp(c[1] * 1.12 + 0.020, 0, 1),
        clamp(c[2] * 1.02 + 0.004, 0, 1)];
    }

    function buildConfig(varietyKey, seed, boiled) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.boiled = !!boiled;
        cfg.seed = seed >>> 0;

        if (cfg.boiled) {
            for (const k of ["podValley", "podMid", "podBean", "seamCol", "beakCol", "baseCol"]) {
                cfg[k] = boilCol(cfg[k]);
            }
            cfg.bloomAmt *= 0.35;               // 茹でると白い粉（ブルーム）は落ちる
            // 【対策】edamame-A では艶を上げすぎて緑のプラスチックになった。
            //         茹でた莢は「濡れている」だけで、鏡面ではない
            cfg.skinRough *= 0.74;
            cfg.sheenAmt *= 0.62;
            cfg.fuzzAlpha *= 0.70;              // 濡れた毛は寝て束になる
            cfg.saltAmt = 0.28;
            cfg.clearcoat = 0.22;
        } else {
            cfg.saltAmt = 0.0;
            cfg.clearcoat = 0.0;
        }

        // 【対策】テクスチャは「粒がいちばん膨らんだところの色」で焼き、
        //         そこから谷へ向かって暗くする係数を頂点カラーで掛ける。
        //         粒の位置は莢ごとに違うのでテクスチャには焼けないが、
        //         色そのものは品種の設定どおりに出したい。係数を
        //         podValley / podMid ÷ podBean で作れば両立する
        const den = (x) => Math.max(1e-3, x);
        cfg.vcMid = [clamp(cfg.podMid[0] / den(cfg.podBean[0]), 0.02, 1),
        clamp(cfg.podMid[1] / den(cfg.podBean[1]), 0.02, 1),
        clamp(cfg.podMid[2] / den(cfg.podBean[2]), 0.02, 1)];
        cfg.vcValley = [clamp(cfg.podValley[0] / den(cfg.podBean[0]), 0.02, 1),
        clamp(cfg.podValley[1] / den(cfg.podBean[1]), 0.02, 1),
        clamp(cfg.podValley[2] / den(cfg.podBean[2]), 0.02, 1)];

        // 【対策】縫合線と縦の繊維は、ジオメトリとテクスチャの両方が同じ場所を
        //         見ていなければならない。テクスチャは「品種 × 生/茹で」単位で
        //         キャッシュするので、種も文字列から決めて個体乱数から切り離す
        const key = varietyKey + (cfg.boiled ? "#b" : "#r");
        let h = 2166136261;
        for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
        cfg.texSeed = (h >>> 0) % 100000;
        cfg.skinKey = key;

        if (cfg.count > 16) { cfg.segmentsAxis = 96; cfg.segmentsRound = 56; }
        if (cfg.count > 24) { cfg.segmentsAxis = 76; cfg.segmentsRound = 44; cfg.fuzzShells = 1; }
        // 【対策】断面は u=0 と u=0.5 が縫合線。ここに頂点を必ず置きたいので
        //         周分割は 4 の倍数にしておく（uOff も 0 か 0.5 しか使わない）
        cfg.segmentsRound = Math.round(cfg.segmentsRound / 4) * 4;
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

        // 【対策】判定の基準は端ではなく胴の中央。しかも j=0（縫合線）は
        //         法線が素直に外を向くので、個体によらず安定する
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], false, refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, colors, scene);
    }

    // =================================================================
    // 4. Fields
    // =================================================================
    // ---- 周方向の頂点分布 ----------------------------------------------
    // 【対策】縫合線（u=0, 0.5）は曲率が最大で、等間隔分割だとそこだけ
    //         カクつく。逆に広い面はほぼ平らで頂点が要らない。
    //         w=0, 0.25, 0.5, 0.75 を不動点にしたまま密度だけ寄せる
    function phiOf(w, cfg) {
        const g = w - (cfg.sectionAmp / (4 * Math.PI)) * Math.sin(4 * Math.PI * w);
        return g * Math.PI * 2;
    }

    // ---- 扁平な断面 -----------------------------------------------------
    // a = 半幅（縫合線どうしの距離の半分）、b = 半厚
    // 【対策】単純な楕円だと「潰した円柱」にしかならない。枝豆の断面は
    //         広い面が平らで、縫合線が刃のように立つ。厚み側の指数を
    //         1 未満にすると、φ が 0 を離れた瞬間に厚みが立ち上がり、
    //         この「レンズ形＋稜」が出る。ただし指数 <1 は φ=0 で曲率が
    //         発散するので、keelRound で丸めておかないとハイライトが割れる
    function sectionYZ(phi, a, b, cfg) {
        const c = Math.cos(phi), s = Math.sin(phi);
        const e = cfg.edgeExp * 0.5, kr2 = cfg.keelRound * cfg.keelRound;
        const base = Math.pow(kr2, e);
        const zn = Math.pow(s * s + kr2, e) - base;
        const zmax = Math.pow(1 + kr2, e) - base;
        const z = b * Math.sign(s) * (zmax > 1e-9 ? zn / zmax : 0);
        // 縫合線のわずかな出っ張り（実物は糸のような筋が走っている）
        const y = a * c * (1 + cfg.keel * Math.pow(c * c, 7));
        return [y, z];
    }

    // ---- 軸方向のエンベロープ -------------------------------------------
    // t=0 が果柄側、t=1 が先端（くちばし）
    // 【対策】edamame-A は頭も尻も長く絞りすぎて、莢がアーモンド形の紡錘に
    //         なった。実物は付け根で一気に肩が張り、胴はほぼ平行、
    //         先端の1割だけが短いくちばしに絞られる。ここを 0.19→0.13 と
    //         tipLen も、指数を 1 未満にして「胴は満杯のまま、最後の数%で
    //         一気に絞る」形にすると、紡錘ではなくくちばしになる
    function envA(t, cfg) {
        const head = mix(cfg.headFloorA, 1.0, smooth(0.0, 0.13, t));
        const tail = 1 - Math.pow(smooth(1 - cfg.tipLen, 1.0, t), cfg.tipPow);
        return Math.max(0.010, head * tail);
    }
    function envB(t, cfg) {
        const head = mix(cfg.headFloorB, 1.0, smooth(0.0, 0.13, t));
        const tail = 1 - Math.pow(smooth(1 - cfg.tipLen, 1.0, t), cfg.tipPow);
        // 【対策】先端は「尖った棒」ではなく「平たいくちばし」。
        //         厚みだけを幅より一段早く落とすと、薄い刃状の先になる
        const flat = 1 - smooth(1 - cfg.tipLen * 1.8, 1.0, t) * cfg.tipFlat;
        return Math.max(0.006, head * tail * flat);
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
            // 【対策】細かい繊維・産毛は縮小時にモアレを起こす。異方性フィルタで抑える
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },

        // 果皮の場をいちど計算して 3 枚のテクスチャで共有する
        // 【対策】アルベド・ORM・法線を別々に評価すると、書き間違いひとつで
        //         繊維の位置がずれ、「筋の上にぼんやりした汚れが乗った」ように
        //         見える。ここで1回だけ焼いて配る
        field(size, cfg) {
            const N = size, n2 = N * N;
            const F = {
                seam: new Float32Array(n2),
                fiber: new Float32Array(n2),
                fuzz: new Float32Array(n2),
                scar: new Float32Array(n2),
                salt: new Float32Array(n2),
                h: new Float32Array(n2)
            };
            for (let y = 0; y < N; y++) {
                const v = y / N;
                for (let x = 0; x < N; x++) {
                    const u = x / N, i = y * N + x;
                    // 縫合線は u=0 と u=0.5。テクスチャの u とジオメトリの w は
                    // 同じ座標なので、ここは cos(2πu) だけで正しく一致する
                    const c = Math.cos(2 * Math.PI * u);
                    F.seam[i] = Math.pow(Math.abs(c), 14);
                    // 莢を縦に走る繊維。u 方向に細かく、v 方向に長い
                    F.fiber[i] = Noise.fbm2u(u * 150, v * 11, 150, cfg.texSeed + 5, 2);
                    // 産毛。v 方向へ寝かせて毛の向きを出す
                    F.fuzz[i] = Noise.fbm2u(u * cfg.fuzzDensity,
                        v * cfg.fuzzDensity * cfg.fuzzStretch,
                        cfg.fuzzDensity, cfg.texSeed + 71, 2);
                    const a = Noise.fbm2u(u * 6, v * 9, 6, cfg.texSeed + 37, 3);
                    const b = Noise.fbm2u(u * 3, v * 4, 3, cfg.texSeed + 53, 2);
                    F.scar[i] = smooth(0.79, 0.95, a) * smooth(0.45, 0.80, b);
                    const s = Noise.fbm2u(u * 90, v * 78, 90, cfg.texSeed + 13, 1);
                    F.salt[i] = smooth(0.865, 0.945, s) * cfg.saltAmt;
                    // 【対策】断面の稜（縫合線）は法線マップに入れない。
                    //         ジオメトリ側で出しているので、両方に入れると
                    //         稜が二重に陰って折り紙のように硬くなる
                    F.h[i] = clamp(0.62 * F.fuzz[i] + 0.22 * F.fiber[i]
                        + 0.26 * F.scar[i] + 0.55 * F.salt[i], 0, 1);
                }
            }
            return F;
        },

        // 【対策】豆の膨らみによる明暗は「莢ごとに位置が違う」のでテクスチャに
        //         焼けない（テクスチャは品種単位でキャッシュしている）。
        //         ここでは軸方向のグラデーションと縫合線だけを持たせ、
        //         粒の陰影は頂点カラーの乗算で個体ごとに与える
        albedo(scene, size, cfg, F) {
            const MID = cfg.podBean, SEAM = cfg.seamCol, BEAK = cfg.beakCol;
            const BASE = cfg.baseCol, SC = cfg.scarCol, BL = cfg.bloom;
            return this._tex("edamameAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const seam = F.seam[i0], fib = F.fiber[i0];
                        const sc = F.scar[i0], sl = F.salt[i0];
                        let cr = MID[0], cg = MID[1], cb = MID[2];
                        // 果柄側は淡い黄緑
                        const head = smooth(0.10, 0.0, v);
                        cr = mix(cr, BASE[0], head * 0.85);
                        cg = mix(cg, BASE[1], head * 0.85);
                        cb = mix(cb, BASE[2], head * 0.85);
                        // 先端のくちばしは乾いて褐色を帯びる
                        const beak = smooth(0.88, 1.0, v);
                        cr = mix(cr, BEAK[0], beak * 0.85);
                        cg = mix(cg, BEAK[1], beak * 0.85);
                        cb = mix(cb, BEAK[2], beak * 0.85);
                        // 縫合線は皮が薄く、淡い筋になって走る
                        cr = mix(cr, SEAM[0], seam * 0.62);
                        cg = mix(cg, SEAM[1], seam * 0.62);
                        cb = mix(cb, SEAM[2], seam * 0.62);
                        // 縫合線のすぐ内側の浅い溝
                        const groove = smooth(0.62, 0.86, Math.pow(Math.abs(Math.cos(2 * Math.PI * (x / N))), 3))
                            * (1 - seam);
                        cr *= 1 - groove * 0.10; cg *= 1 - groove * 0.10; cb *= 1 - groove * 0.10;
                        // 縦の繊維
                        const fl = (fib - 0.5) * 0.10;
                        cr *= 1 + fl * 0.7; cg *= 1 + fl; cb *= 1 + fl * 0.5;
                        // 低周波のむら
                        const mott = 0.93 + 0.14 * Noise.fbm2u((x / N) * 5, v * 8, 5, cfg.texSeed + 3, 3);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 黒豆枝豆のブルーム（黒紫の差し色）
                        if (cfg.bloomAmt > 0) {
                            const bm = smooth(0.55, 0.90, Noise.fbm2u((x / N) * 4, v * 6, 4, cfg.texSeed + 61, 3))
                                * cfg.bloomAmt;
                            cr = mix(cr, BL[0], bm); cg = mix(cg, BL[1], bm); cb = mix(cb, BL[2], bm);
                        }
                        // 擦り傷・黒ずみ
                        cr = mix(cr, SC[0], sc * 0.80);
                        cg = mix(cg, SC[1], sc * 0.80);
                        cb = mix(cb, SC[2], sc * 0.80);
                        // 塩の粒
                        cr = mix(cr, 0.97, sl); cg = mix(cg, 0.97, sl); cb = mix(cb, 0.95, sl);
                        // 頂点カラー（粒の陰影）は 1.0 以下で掛かるので、
                        // ここは「粒の頂点」の色そのもので焼いておく
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
            return this._tex("edamameORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        const seam = F.seam[i0], fz = F.fuzz[i0];
                        const sc = F.scar[i0], sl = F.salt[i0];
                        // 【対策】生の枝豆は産毛のせいで全体に粗い。艶を上げると
                        //         塗装したさやいんげんになる。光るのは縫合線と、
                        //         茹でて濡れた広い面（clearcoat が担当）
                        let rough = cfg.skinRough * (1.02 - 0.12 * seam);
                        rough = mix(rough, 0.82, sc * 0.6);
                        rough = mix(rough, 0.92, sl);        // 塩は完全につや消し
                        rough += 0.05 * (fz - 0.5);
                        let ao = 1.0;
                        ao = mix(ao, 0.88, sc * 0.5);
                        ao = mix(ao, 0.80, smooth(0.965, 1.0, v));
                        ao = mix(ao, 0.90, smooth(0.06, 0.0, v));
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, F, strength) {
            const hf = F.h;
            return this._tex("edamameNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const vv = y / N;
                    const k = strength * smooth(0, 0.04, vv) * (1 - smooth(0.96, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        // 【対策】v の符号は (yd - yu)。逆にすると凹凸が反転して、
                        //         光を当てる向きによって毛が「くぼみ」に見える
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

        // 産毛シェル用のアルファ。毛の生えている場所だけ 1
        // 【対策】ここを滑らかなグラデーションにすると、シェルが
        //         「半透明の膜」になって莢が曇る。しきい値で切って
        //         毛の点在にすること
        fuzzAlpha(scene, size, cfg) {
            return this._tex("edamameFuzzA", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const a = Noise.v2u(u * cfg.fuzzDensity,
                            v * cfg.fuzzDensity * cfg.fuzzStretch,
                            cfg.fuzzDensity, cfg.texSeed + 91);
                        // 縫合線の上は毛が特に多い（実物も稜に沿って密）
                        const seam = Math.pow(Math.abs(Math.cos(2 * Math.PI * u)), 6);
                        let al = smooth(0.64, 0.88, a) * (0.85 + 0.25 * seam);
                        // 果柄と先端の際は毛が薄い
                        al *= smooth(0.02, 0.10, v) * (1 - smooth(0.94, 1.0, v));
                        const g = clamp(al, 0, 1) * 255;
                        d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // 竹ひごの網代（あじろ）。u が周方向、v が中心→縁
        bamboo(scene, size, seed) {
            const OVER = [0.86, 0.77, 0.55], UNDER = [0.72, 0.62, 0.42], GAP = [0.38, 0.30, 0.18];
            return this._tex("basketAlbedo", size, (d, N) => {
                const SPOKE = 72, RING = 22;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * SPOKE, sv = v * RING;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.76 + 0.32 * bv) : (0.56 + 0.22 * bu);
                        const gap = smooth(0, 0.10, Math.min(fu, 1 - fu))
                            * smooth(0, 0.10, Math.min(fv, 1 - fv));
                        const fib = 0.92 + 0.16 * Noise.fbm2u(u * 260, v * 14, 260, seed, 2);
                        const age = 0.92 + 0.16 * Noise.fbm2u(u * 6, v * 5, 6, seed + 9, 3);
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
    //  マテリアル（品種 × 生/茹で ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const F = TextureLab.field(S, cfg);
            this.texs = [];
            this.albedoTex = TextureLab.albedo(scene, S, cfg, F);
            this.ormTex = TextureLab.orm(scene, S, cfg, F);
            this.normalTex = TextureLab.normal(scene, S, F, 2.4);
            this.fuzzTex = TextureLab.fuzzAlpha(scene, Math.min(1024, S), cfg);
            this.texs.push(this.albedoTex, this.ormTex, this.normalTex, this.fuzzTex);

            const OPAQUE = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;

            const m = new BABYLON.PBRMaterial("edamameSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 0.90;
            m.transparencyMode = OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】生の枝豆は産毛が光を散らして布のように照る。sheen がその用途。
            //         茹でた枝豆は逆に水の膜で濡れて光るので、そこは clearcoat。
            //         どちらか一方で両方を賄おうとすると、生が濡れて見えるか、
            //         茹でが粉を吹いて見えるかのどちらかになる
            m.sheen.isEnabled = true;
            m.sheen.intensity = cfg.sheenAmt;
            m.sheen.color = new BABYLON.Color3(cfg.sheenCol[0], cfg.sheenCol[1], cfg.sheenCol[2]);
            m.sheen.roughness = 0.55;
            m.sheen.linkSheenWithAlbedo = false;
            if (cfg.clearcoat > 0) {
                m.clearCoat.isEnabled = true;
                m.clearCoat.intensity = cfg.clearcoat;
                m.clearCoat.roughness = 0.26;
            }
            // 莢は薄く、中の豆との間に空隙がある。縁がわずかに明るくなる
            m.subSurface.isTranslucencyEnabled = true;
            m.subSurface.tintColor = new BABYLON.Color3(0.52, 0.76, 0.28);
            m.subSurface.translucencyIntensity = 0.12;
            m.subSurface.minimumThickness = 0.2;
            m.subSurface.maximumThickness = 1.0;
            this.skin = m;

            const st = new BABYLON.PBRMaterial("edamameStem", scene);
            st.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            st.metallic = 0.0;
            st.roughness = 0.68;
            st.transparencyMode = OPAQUE;
            // 【対策】果柄は莢と同じ面から生えるので、境界で Z ファイティングを
            //         起こしやすい。わずかに手前へ寄せる
            st.zOffset = -2;
            st.zOffsetUnits = -16;
            this.stem = st;

            // ---- 産毛シェル ------------------------------------------
            // 【対策】edamame-A では opacityFresnel で「輪郭だけ毛を見せる」
            //         つもりだったが、Babylon の実装は
            //           alpha += left*(1-F) + F*right
            //         という【加算】で、しかも leftColor が「正面」側。
            //         白×黒を入れると正面の alpha に 1.0 が足されて完全不透明に
            //         なり、莢が霜をかぶったように真っ白になっていた。
            //         フレネルは使わず、素直な shell fur に戻す：毛のアルファを
            //         うんと下げ、正面は薄く点在するだけ、輪郭では2枚のシェルが
            //         重なって濃くなる、という自然な積み上がりに任せる。
            //         色も純白ではなく莢の緑を混ぜて、霜に見えないようにする
            // 【対策】シェル枚数は莢の本数で変わる（多いと1枚に落とす）。
            //         マテリアルを cfg.fuzzShells 枚しか作らないと、
            //         36莢→16莢 と戻したときにキャッシュ済みの Skin から
            //         2枚目を引けず material が undefined になる。常に3枚作る
            this.fuzzMats = [];
            for (let k = 0; k < 3; k++) {
                const f = new BABYLON.StandardMaterial("edamameFuzz" + k, scene);
                f.diffuseColor = new BABYLON.Color3(
                    srgb(mix(cfg.fuzzCol[0], cfg.podMid[0], 0.30)),
                    srgb(mix(cfg.fuzzCol[1], cfg.podMid[1], 0.30)),
                    srgb(mix(cfg.fuzzCol[2], cfg.podMid[2], 0.30)));
                f.emissiveColor = f.diffuseColor.scale(0.10);
                f.specularColor = new BABYLON.Color3(0, 0, 0);
                f.opacityTexture = this.fuzzTex;
                f.opacityTexture.getAlphaFromRGB = true;
                f.alpha = cfg.fuzzAlpha * Math.pow(0.55, k);
                f.backFaceCulling = false;
                f.twoSidedLighting = true;
                // 深度を書かないので、シェルどうし・莢どうしの前後で悩まない
                f.disableDepthWrite = true;
                f.separateCullingPass = false;
                this.fuzzMats.push(f);
            }
        }
        dispose() {
            this.skin.dispose(true, false);
            this.stem.dispose(true, false);
            for (const f of this.fuzzMats) f.dispose(true, false);
            for (const t of this.texs) t.dispose();
        }
    }

    // =================================================================
    // 6. Edamame
    // =================================================================
    class Edamame {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            this.L = cfg.length * rng.range(0.90, 1.10);
            this.W = cfg.width * rng.range(0.93, 1.07);
            this.T = cfg.thick * rng.range(0.93, 1.07);
            this.nseed = rng.int(900000) + 1000;
            this.bendA = cfg.bendA * rng.range(0.35, 1.9) * (rng.next() < 0.5 ? -1 : 1);
            this.bendB = cfg.bendB * rng.range(-1.3, 1.3);
            this.bendC = cfg.bendC * rng.range(-1.4, 1.4);
            this.twist = cfg.twist * rng.range(-1, 1);
            this.a1 = cfg.asym * rng.range(0.6, 1.4);
            this.p1 = rng.range(0, Math.PI * 2);
            // 【対策】テクスチャは縫合線が u=0 と u=0.5 に来る前提で焼いてある。
            //         個体差として UV を連続値で回すと縫合線の筋がジオメトリの
            //         稜から外れる。回すのは 0 か 0.5 だけ（裏返すのと同じ）
            this.uOff = rng.next() < 0.5 ? 0 : 0.5;

            this._placeBeans();

            this.parts = [];
            this.shells = [];
            this.stemAxis = [];
            this._buildBody(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("edamame", scene);
            for (const m of this.parts) m.parent = this.root;
            if (cfg.fuzzOn) this._buildFuzz(skin);
        }

        // ---- 豆の配置 -------------------------------------------------
        // 【対策】粒を等間隔・等サイズに並べると、機械で押した型物に見える。
        //         実物は必ず1粒どこかが小さく、間隔も揃わない
        _placeBeans() {
            const cfg = this.cfg, rng = this.rng;
            const n = (rng.next() < cfg.bean3) ? 3 : 2;
            const t0 = cfg.beanSpanA, t1 = cfg.beanSpanB;
            const span = (t1 - t0) / n;
            this.beans = [];
            for (let i = 0; i < n; i++) {
                this.beans.push({
                    c: t0 + span * (i + 0.5) + rng.gauss(0, span * 0.055),
                    w: span * rng.range(0.54, 0.62),
                    a: rng.range(0.80, 1.02)
                });
            }
            // 1粒だけ不稔ぎみにする（実物によくある）
            if (rng.next() < 0.30) this.beans[rng.int(n)].a *= rng.range(0.52, 0.78);
            this.beanCount = n;
        }

        // 粒の膨らみの場。p-ノルムで「なめらかな max」を取る
        lobeAt(t) {
            const k = this.cfg.lobeMix;
            let s = 0;
            for (const b of this.beans) {
                const x = (t - b.c) / b.w;
                if (x <= -1 || x >= 1) continue;
                const d = Math.pow(1 - x * x, this.cfg.lobeSharp) * b.a;
                if (d > 0) s += Math.pow(d, k);
            }
            return s > 0 ? Math.min(1.0, Math.pow(s, 1 / k)) : 0;
        }

        // 軸は X。曲がりは主に幅方向（Y）＝ 莢の平面内で鎌形に反る
        spineAt(t) {
            const y = (this.bendA * Math.sin(Math.PI * t) + this.bendB * Math.sin(Math.PI * 2 * t)) * this.L;
            const z = this.bendC * Math.sin(Math.PI * t) * this.L;
            return new V3((t - 0.5) * this.L, y, z);
        }
        frameAt(t) {
            const e = 1e-3;
            const a = this.spineAt(Math.max(0, t - e)), b = this.spineAt(Math.min(1, t + e));
            const Tv = b.subtract(a); Tv.normalize();
            // 【対策】Frenet 枠だと曲率が反転する点で枠が回ってしまい、
            //         縫合線がねじれる。莢は「平べったい板」なので、
            //         幅方向を常に world Z との外積で決めれば枠は安定する
            const Nv = V3.Cross(new V3(0, 0, 1), Tv); Nv.normalize();
            const B = V3.Cross(Tv, Nv); B.normalize();
            return { T: Tv, N: Nv, B };
        }

        // 半幅（幅方向）
        aAt(t) {
            const cfg = this.cfg, L = this.lobeAt(t);
            const wob = 1 + this.a1 * Math.cos(Math.PI * 2 * t + this.p1) * 0.5;
            return this.W * 0.5 * envA(t, cfg) * (1 + cfg.widthLobe * (L - 0.5)) * wob;
        }
        // 半厚（厚み方向）
        // 【対策】粒の膨らみを幅にも同じだけ掛けると、莢が節くれだった芋虫になる。
        //         実物は縫合線がほぼ直線のまま、厚みだけが粒のところで倍近くなる
        bAt(t) {
            const cfg = this.cfg, L = this.lobeAt(t);
            let b = this.T * 0.5 * envB(t, cfg) * mix(cfg.valleyFloor, 1.0, L * cfg.lobeAmp);
            // 果柄の付け根だけは断面を丸へ寄せる（細い刃のまま繋ぐと不自然）
            const round = smooth(0.16, 0.0, t) * 0.55;
            if (round > 0) b = mix(b, this.aAt(t) * 0.80, round);
            return b;
        }
        phiAt(t, w) {
            return phiOf(w, this.cfg) + this.twist * (t - 0.5);
        }

        _buildBody(skin) {
            const cfg = this.cfg, NA = cfg.segmentsAxis, MA = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= NA; i++) {
                const t = i / NA;
                const c = this.spineAt(t), f = this.frameAt(t);
                const a = this.aAt(t), b = this.bAt(t);
                const ring = [];
                for (let j = 0; j <= MA; j++) {
                    const w = j / MA;
                    const yz = sectionYZ(this.phiAt(t, w), a, b, cfg);
                    // 低周波の非対称。これが無いと完全な回転対称になり、
                    // ハイライトが直線になって押し出し成型に見える
                    const wob = 1 + 0.014 * (Noise.fbm3(Math.cos(w * 6.2832) * 2.2,
                        Math.sin(w * 6.2832) * 2.2, t * 4.5, this.nseed, 3) - 0.5);
                    const y = yz[0] * wob, z = yz[1] * wob;
                    ring.push(new V3(
                        c.x + f.N.x * y + f.B.x * z,
                        c.y + f.N.y * y + f.B.y * z,
                        c.z + f.N.z * y + f.B.z * z));
                }
                rings.push(ring); centers.push(c);
            }

            // 頂点カラー = アルベドに掛ける「粒の陰影」の係数（最大 1.0）
            const tint = [this.rng.range(0.94, 1.00), this.rng.range(0.93, 1.00), this.rng.range(0.92, 1.00)];
            const VV = cfg.vcValley, VM = cfg.vcMid, out = [0, 0, 0], src = [0, 0, 0];
            const colsFn = (t, w) => {
                const L = this.lobeAt(t);
                const f = Math.pow(L, 0.80);
                // 谷 → 中間 → 粒の頂点 の3点補間。色そのものが設定どおりに出る
                if (f < 0.5) {
                    const q = f * 2;
                    for (let i = 0; i < 3; i++) src[i] = mix(VV[i], VM[i], q);
                } else {
                    const q = (f - 0.5) * 2;
                    for (let i = 0; i < 3; i++) src[i] = mix(VM[i], 1.0, q);
                }
                // 粒の輪郭が莢を透かして一段暗い線に見える
                const rim = smooth(0.16, 0.36, L) * (1 - smooth(0.44, 0.66, L));
                const rk = 1 - rim * 0.12;
                // 縫合線の帯は莢が厚く、粒の影響を受けにくい
                const seam = Math.pow(Math.abs(Math.cos(this.phiAt(t, w))), 8);
                // 【対策】莢の両端は「くびれ」ではなく、淡い付け根と乾いた
                //         くちばし。粒の係数をそのまま掛けると、テクスチャで
                //         作った端の色まで谷の暗さで沈む。端では係数を1へ戻す
                const endFade = smooth(0.14, 0.24, t) * (1 - smooth(0.84, 0.94, t));
                const g = 0.96 + 0.08 * Noise.fbm3(Math.cos(w * 6.2832) * 3.5,
                    Math.sin(w * 6.2832) * 3.5, t * 7, this.nseed + 11, 2);
                for (let i = 0; i < 3; i++) {
                    let v = mix(1.0, src[i] * rk, endFade);
                    v = mix(v, mix(VM[i], 1.0, f), seam * 0.65);
                    out[i] = clamp(v * tint[i] * g, 0, 1);
                }
                // 【対策】sweep は両端キャップの色を2回続けて取ってから使う。
                //         使い回しの配列を返すと後の呼び出しが前の値を壊す
                return [out[0], out[1], out[2]];
            };

            const mesh = sweep("edamamePod", rings, centers, colsFn, this.scene, this.uOff);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // ---- 果柄 -----------------------------------------------------
        // 【対策】オクラのような太いカラーを付けると別の野菜になる。
        //         枝豆のヘタは莢の付け根に小さな襟があり、そこから
        //         2mm ほどの細い柄が短く出ているだけ
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = 20;
            const base = this.spineAt(0), f0 = this.frameAt(0);
            const dir = f0.T.scale(-1);
            const L = cfg.stemLen * rng.range(0.80, 1.25);
            const tilt = rng.range(0.05, 0.24), tiltA = rng.range(0, Math.PI * 2);
            const side = f0.N.scale(Math.cos(tiltA)).add(f0.B.scale(Math.sin(tiltA)));
            const r0 = (this.aAt(0) + this.bAt(0)) * 0.5 * 1.05;
            const rEnd = cfg.stemR * rng.range(0.85, 1.15);
            const rings = [], centers = [];
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                const lean = Math.tan(tilt) * L * 0.7 * s * s;
                const c = base.add(dir.scale(L * s)).add(side.scale(lean));
                // 襟（萼の名残）→ 細い柄 → 切り口
                const collar = 1 + cfg.collarAmt * Math.sin(Math.PI * clamp(s / 0.30, 0, 1));
                const taper = mix(1.0, rEnd / r0, Math.pow(smooth(0.0, 0.55, s), 0.75));
                const rr = r0 * collar * taper * (1 - 0.10 * smooth(0.90, 1.0, s));
                if (i % 3 === 0 || i === K) this.stemAxis.push({ c: c, r: rr * 1.05 });
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    // 襟には萼片の名残の 5 稜がうっすら残る
                    const rib = 1 + 0.06 * Math.cos(5 * phi) * (1 - smooth(0.0, 0.35, s));
                    const r = rr * rib;
                    const cs = Math.cos(phi), sn = Math.sin(phi);
                    ring.push(new V3(
                        c.x + (f0.N.x * cs + f0.B.x * sn) * r,
                        c.y + (f0.N.y * cs + f0.B.y * sn) * r,
                        c.z + (f0.N.z * cs + f0.B.z * sn) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const CO = cfg.collarCol, SM = cfg.stemCol, CUT = cfg.stemCut;
            const colsFn = (v, u) => {
                const toStem = smooth(0.10, 0.50, v);
                const cut = smooth(0.92, 1.0, v);
                const g = 0.92 + 0.16 * Noise.fbm3(Math.cos(u * 6.2832) * 5,
                    Math.sin(u * 6.2832) * 5, v * 9, this.nseed + 7, 2);
                return [
                    srgb(mix(mix(CO[0], SM[0], toStem), CUT[0], cut) * g),
                    srgb(mix(mix(CO[1], SM[1], toStem), CUT[1], cut) * g),
                    srgb(mix(mix(CO[2], SM[2], toStem), CUT[2], cut) * g)
                ];
            };
            const mesh = sweep("edamameStem", rings, centers, colsFn, this.scene, 0);
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.parts.push(mesh);
        }

        // ---- 産毛シェル -----------------------------------------------
        // 【対策】表示メッシュ（96×56 など）をそのままシェルに使うと、
        //         半透明パスの頂点数が莢の数だけ倍増して一気に重くなる。
        //         同じ関数を粗く評価した別メッシュを土台にする
        _buildFuzz(skin) {
            const cfg = this.cfg, NA = cfg.shellAxis, MA = cfg.shellRound;
            const rings = [], centers = [];
            for (let i = 0; i <= NA; i++) {
                const t = i / NA;
                const c = this.spineAt(t), f = this.frameAt(t);
                const a = this.aAt(t), b = this.bAt(t);
                const ring = [];
                for (let j = 0; j <= MA; j++) {
                    const w = j / MA;
                    const yz = sectionYZ(this.phiAt(t, w), a, b, cfg);
                    ring.push(new V3(
                        c.x + f.N.x * yz[0] + f.B.x * yz[1],
                        c.y + f.N.y * yz[0] + f.B.y * yz[1],
                        c.z + f.N.z * yz[0] + f.B.z * yz[1]));
                }
                rings.push(ring); centers.push(c);
            }
            const src = sweep("edamameShell0", rings, centers, null, this.scene, this.uOff);
            const pos = src.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const nor = src.getVerticesData(BABYLON.VertexBuffer.NormalKind);
            const uvs = src.getVerticesData(BABYLON.VertexBuffer.UVKind);
            const idx = src.getIndices();
            src.dispose();

            for (let k = 0; k < cfg.fuzzShells; k++) {
                const off = cfg.fuzzLen * (k + 1) / cfg.fuzzShells;
                const p = new Float32Array(pos.length);
                for (let i = 0; i < pos.length; i += 3) {
                    // 【対策】先端は半径が 0.1mm まで細る。そこへ 1mm の
                    //         シェルを一律に押し出すと、莢の10倍の太さの
                    //         風船がくちばしに刺さる。両端で押し出し量を絞る
                    const t = uvs[(i / 3) * 2 + 1];
                    const d = off * smooth(0.015, 0.10, t) * (1 - smooth(0.90, 1.0, t));
                    p[i] = pos[i] + nor[i] * d;
                    p[i + 1] = pos[i + 1] + nor[i + 1] * d;
                    p[i + 2] = pos[i + 2] + nor[i + 2] * d;
                }
                const mesh = makeMesh("edamameFuzz" + k, p, idx.slice(),
                    new Float32Array(nor), new Float32Array(uvs), null, this.scene);
                mesh.material = skin.fuzzMats[k];
                mesh.isPickable = false;
                mesh.receiveShadows = false;
                // 深度を書かないので、莢より後に描かれるよう明示しておく
                mesh.alphaIndex = 100 + k;
                mesh.parent = this.root;
                this.shells.push(mesh);
            }
        }

        // ---- 当たり判定 -----------------------------------------------
        // 【対策】莢は鎌形に反っていて、凸包を1つ取ると反りの内側が
        //         まるごと埋まる。積み上げたときに 2〜3mm 浮いて見えるので、
        //         軸方向に3分割した凸包の複合形状にする。くびれも同じ理由で
        //         多少は残る（ただし埋めても山の安定には効くので深追いしない）
        hullShape() {
            const SEG = 3, N = 6, M = 10, INF = -0.008;
            const parts = [];
            const mkProxy = (t0, t1, withStem) => {
                const rings = [], centers = [];
                if (withStem) {
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
                }
                for (let i = 0; i <= N; i++) {
                    const t = mix(t0, t1, i / N);
                    const c = this.spineAt(t), f = this.frameAt(t);
                    const a = Math.max(0.004, this.aAt(t) + INF);
                    const b = Math.max(0.004, this.bAt(t) + INF);
                    const ring = [];
                    for (let j = 0; j <= M; j++) {
                        const yz = sectionYZ((j % M) / M * Math.PI * 2, a, b, this.cfg);
                        ring.push(new V3(
                            c.x + f.N.x * yz[0] + f.B.x * yz[1],
                            c.y + f.N.y * yz[0] + f.B.y * yz[1],
                            c.z + f.N.z * yz[0] + f.B.z * yz[1]));
                    }
                    rings.push(ring); centers.push(c);
                }
                const proxy = sweep("edamameProxy", rings, centers, null, this.scene, 0);
                proxy.isVisible = false;
                const shape = new BABYLON.PhysicsShapeConvexHull(proxy, this.scene);
                proxy.dispose();
                return shape;
            };

            const OV = 0.05;
            try {
                const container = new BABYLON.PhysicsShapeContainer(this.scene);
                for (let k = 0; k < SEG; k++) {
                    const t0 = Math.max(0, k / SEG - (k > 0 ? OV : 0));
                    const t1 = Math.min(1, (k + 1) / SEG + (k < SEG - 1 ? OV : 0));
                    const sh = mkProxy(t0, t1, k === 0);
                    parts.push(sh);
                    container.addChild(sh);
                }
                return { shape: container, parts };
            } catch (e) {
                // 複合形状が使えない環境では単一の凸包へ退避する
                for (const sh of parts) { try { sh.dispose(); } catch (e2) { } }
                console.warn("[Edamame] PhysicsShapeContainer が使えないので単一凸包にします", e);
                return { shape: mkProxy(0, 1, true), parts: [] };
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

        // 検証用：写真から目算せず、まず数値で形を確かめる
        measure() {
            const cfg = this.cfg;
            let maxA = 0, maxB = 0, minB = Infinity;
            for (let i = 0; i <= 400; i++) {
                const t = i / 400;
                if (t < 0.10 || t > 0.94) continue;
                const a = this.aAt(t), b = this.bAt(t);
                maxA = Math.max(maxA, a); maxB = Math.max(maxB, b);
            }
            // 【対策】くびれは「粒と粒の間」のこと。莢の端まで含めて最小値を
            //         取ると、常に先端のすぼまりか付け根の細りが出てしまい、
            //         「くびれが深すぎる」と誤診する。粒の中心どうしの間だけ見る
            const c0 = this.beans[0].c, c1 = this.beans[this.beans.length - 1].c;
            for (let i = 0; i <= 400; i++) {
                const t = mix(c0, c1, i / 400);
                minB = Math.min(minB, this.bAt(t));
            }
            if (!isFinite(minB) || this.beans.length < 2) minB = maxB;
            return {
                len: this.L, width: maxA * 2, thick: maxB * 2,
                waist: minB * 2, waistRatio: minB / maxB, beans: this.beanCount
            };
        }

        dispose() {
            for (const m of this.parts) m.dispose();
            for (const m of this.shells) m.dispose();
            if (this.root) this.root.dispose();
            this.parts.length = 0; this.shells.length = 0;
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
            const y = DEP * Math.pow(clamp((s - 0.46) / 0.54, 0, 1), 1.55);
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
        m.albedoTexture.anisotropicFilteringLevel = 16;
        m.metallic = 0.0;
        m.roughness = 0.76;
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
        console.warn("[Edamame] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.64;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.16, 34, new V3(0, 1.4, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 14;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする。枝豆は小さいので 3 程度が上限
    camera.minZ = 3;
    camera.maxZ = 200;
    camera.lowerRadiusLimit = 9;
    camera.upperRadiusLimit = 100;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = new V3(14, 24, -16);
    key.intensity = 2.6;
    key.diffuse = new BABYLON.Color3(1.0, 0.99, 0.97);
    key.specular = new BABYLON.Color3(0.60, 0.60, 0.56);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.96, 1.0, 0.96);
    fillL.specular = new BABYLON.Color3(0.24, 0.26, 0.22);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.58;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.76, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】ExponentialShadowMap（ESM）は自己遮蔽で「皮に痣が出る」ことが
    //         ジャガイモ版で判明済み。枝豆は表面が細かいので最初から PCF。
    //         forceBackFacesOnly と bias/normalBias でアクネも同時に抑える
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0006;
    sg.normalBias = 0.02;
    sg.darkness = 0.44;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.00;
    ip.contrast = 1.12;
    ip.vignetteEnabled = false;

    let ground = null;
    if (GLOBAL.showGround) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 160, height: 2, depth: 160 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.90, 0.905).toLinearSpace();
        gm.metallic = 0.0; gm.roughness = 0.88;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        ground.material = gm;
        ground.receiveShadows = true;
        ground.position.y = -1.06;
        if (physics) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    const basket = buildBasket(scene, GLOBAL);
    if (physics) {
        const bShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        bShape.material = { friction: 0.80, restitution: 0.0 };
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
        return GLOBAL.basketThick + GLOBAL.basketDepth * Math.pow(clamp((s - 0.46) / 0.54, 0, 1), 1.55);
    }

    // 【対策】山全体の頂点を基準にすると、外側へ置く物まで山の高さぶん
    //         持ち上げられ、ざるの縁の上から落ちてくることになる。
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
            try { if (it.body) it.body.dispose(); } catch (e) { }
            try { if (it.shape) it.shape.dispose(); } catch (e) { }
            // 複合形状は実装によって子も一緒に破棄される。二重破棄は握りつぶす
            if (it.shapeParts) for (const s of it.shapeParts) { try { s.dispose(); } catch (e) { } }
        }
        queue = []; dropIndex = 0; dropTimer = 0;
        settleTimer = 0; postDropTimer = 0; frozen = false;
    }

    // 【対策】全部を同時に生成すると、初期状態で互いにめり込んでいるぶんの
    //         反発が一気に解放されて弾け飛ぶ。1莢ずつ、山の頂点のすぐ上から放す
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

        const hs = e.hullShape();
        hs.shape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
        const body = new BABYLON.PhysicsBody(e.root, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        body.shape = hs.shape;
        body.setMassProperties({ mass: GLOBAL.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションに書いても効かない
        body.setLinearDamping(GLOBAL.linearDamping);
        body.setAngularDamping(GLOBAL.angularDamping);
        // 【対策】毎フレーム「ノードの姿勢 → 物理ボディ」へ書き戻すと、
        //         物理が出した結果を読み直して押し込む往復が起きる
        body.disablePreStep = true;
        it.shape = hs.shape; it.shapeParts = hs.parts; it.body = body;
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
                rng.gauss(0, 0.55), rng.range(0, Math.PI * 2), rng.gauss(0, 0.55));
            const r = GLOBAL.basketRim * 0.34 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null, shapeParts: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            const cols = Math.ceil(Math.sqrt(items.length));
            for (let i = 0; i < items.length; i++) {
                items[i].root.position.set(
                    (i % cols - (cols - 1) / 2) * 1.9,
                    GLOBAL.basketThick + items[i].T * 0.5,
                    (Math.floor(i / cols) - (cols - 1) / 2) * 5.6);
            }
        }
        if (onRebuilt) onRebuilt();
    }

    function build(varietyKey, seed) {
        clearBodies();
        for (const it of items) it.dispose();
        items = [];
        const cfg = buildConfig(varietyKey, seed, GLOBAL.boiled);
        cfg.fuzzOn = GLOBAL.fuzzOn;
        curCfg = cfg;

        // テクスチャは「品種 × 生/茹で」だけで決まる。
        // 個体差で焼き直すと GUI 操作のたびに固まる
        let skin = skinCache[cfg.skinKey];
        if (!skin) { skin = new Skin(scene, cfg); skinCache[cfg.skinKey] = skin; }

        for (let i = 0; i < cfg.count; i++) {
            items.push(new Edamame(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        // 【対策】産毛シェルは影を落とさせない。深度を書かない半透明なので
        //         シャドウマップに入れるとブロックごとの黒い斑になる
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.40, 0);
        camera.radius = cfg.basketRim * 3.0;

        resetDrop(seed);

        // ---- 検証：写真で判断する前に、まず寸法を測る -------------------
        let s = { len: 0, w: 0, t: 0, wr: 0 }, b3 = 0;
        let mn = Infinity, mx = -Infinity;
        for (const e of items) {
            const m = e.measure();
            s.len += m.len; s.w += m.width; s.t += m.thick; s.wr += m.waistRatio;
            if (m.beans === 3) b3++;
            mn = Math.min(mn, m.len); mx = Math.max(mx, m.len);
        }
        const n = items.length || 1;
        console.log("[Edamame]", BUILD, "/", cfg.label, "/", cfg.boiled ? "塩ゆで" : "生",
            "/ seed =", cfg.seed, "/", n, "莢");
        console.log("  全長 " + mn.toFixed(2) + "〜" + mx.toFixed(2) + "cm（平均 " + (s.len / n).toFixed(2) + "）"
            + " / 幅 " + (s.w / n).toFixed(2) + "cm / 最大厚 " + (s.t / n).toFixed(2) + "cm"
            + " / くびれ比 " + (s.wr / n).toFixed(3)
            + " / 3粒莢 " + b3 + "/" + n
            + " / 周分割 " + cfg.segmentsRound);
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
        // 【対策】枝豆のくびれは数mm。半径を大きく取ると莢どうしの隙間しか
        //         拾わず、肝心の「粒と粒の間の陰り」が出ない
        ssao.radius = 0.40;
        ssao.totalStrength = 1.15;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 140;
        ssao.minZAspect = 0.3;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.97;
    dp.bloomWeight = 0.07;
    dp.bloomKernel = 32;
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
        idle: "#18260f", active: "#3d6b23", edge: "#334527",
        text: "#eef5e9", sub: "#a8bd99", accent: "#a7d372"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "252px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(10,17,7,0.84)";
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

    addLabel("EDAMAME", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    const varietyBtns = {}, countBtns = {}, stateBtns = {};
    function highlight() {
        for (const k in varietyBtns) varietyBtns[k].background = (k === curVariety) ? COL.active : COL.idle;
        for (const k in countBtns) countBtns[k].background = (+k === GLOBAL.count) ? COL.active : COL.idle;
        stateBtns.raw.background = GLOBAL.boiled ? COL.idle : COL.active;
        stateBtns.boiled.background = GLOBAL.boiled ? COL.active : COL.idle;
    }
    for (const k of Object.keys(PRESETS)) {
        varietyBtns[k] = addButton("v_" + k, PRESETS[k].label, () => {
            curVariety = k; build(curVariety, curSeed); highlight();
        });
    }

    addLabel("状態", 13, COL.accent, "26px");
    stateBtns.raw = addButton("raw", "生", () => {
        GLOBAL.boiled = false; build(curVariety, curSeed); highlight();
    });
    stateBtns.boiled = addButton("boiled", "塩ゆで", () => {
        GLOBAL.boiled = true; build(curVariety, curSeed); highlight();
    });

    addLabel("莢の数", 13, COL.accent, "26px");
    for (const c of [16, 24, 36]) {
        countBtns[c] = addButton("c" + c, c + " 莢", () => {
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
    const fuzzBtn = addButton("fuzz", "産毛: ON", () => {
        GLOBAL.fuzzOn = !GLOBAL.fuzzOn;
        fuzzBtn.background = GLOBAL.fuzzOn ? COL.active : COL.idle;
        fuzzBtn.textBlock.text = "産毛: " + (GLOBAL.fuzzOn ? "ON" : "OFF");
        build(curVariety, curSeed); highlight();
    });
    const shadowBtn = addButton("shadow", "影: ON", () => {
        GLOBAL.shadowOn = !GLOBAL.shadowOn;
        key.shadowEnabled = GLOBAL.shadowOn;
        shadowBtn.background = GLOBAL.shadowOn ? COL.active : COL.idle;
        shadowBtn.textBlock.text = "影: " + (GLOBAL.shadowOn ? "ON" : "OFF");
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
    fuzzBtn.background = GLOBAL.fuzzOn ? COL.active : COL.idle;
    shadowBtn.background = GLOBAL.shadowOn ? COL.active : COL.idle;
    dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;

    const info = addLabel("", 12, COL.sub, "58px");
    onRebuilt = () => {
        if (!info) return;
        const e = items[0];
        if (!e) { info.text = ""; return; }
        const m = e.measure();
        const state = !physics ? "物理なし"
            : (dropIndex < queue.length ? "投入中 " + dropIndex + "/" + queue.length
                : (frozen ? "静止" : "落下中"));
        info.text = state + " / " + items.length + "莢\n全長 " + m.len.toFixed(1)
            + "cm 幅 " + m.width.toFixed(2) + "cm 厚 " + m.thick.toFixed(2) + "cm / "
            + m.beans + "粒\nseed: " + curSeed + "  [" + BUILD + "]";
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
    toggleBtn.background = "rgba(10,17,7,0.84)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(10,17,7,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;