// =====================================================================
//  Photoreal Kaki  /  写実的な柿（v2 : ざるに落とす）   BUILD: kaki-B2
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  v2 の変更点
//    ・竹ざるに柿を1個ずつ落とす（Havok）。投入・静止判定・固定は
//      サツマイモ imo-D の仕組みをそのまま流用:
//        固定ステップ（120Hz）・重力 620（cm 単位で震えない値）・
//        disablePreStep・静止したら STATIC に固定・下にある物のすぐ上から放す
//    ・ざるは参考写真に合わせて新規に作った（6. Zaru）
//        浅い皿形 / 網代（3 本越え 1 本潜り）を真上から平行投影 /
//        竹を束ねて巻いた太い縁 / 黄色い留め具（茶色いひごは kaki-B2 で除去）
//    ・柿の当たり判定は粗い代理形状の凸包。がく片の先と果梗の頂点も含め、
//      逆さに落ちてもへたがざるにめり込まない
//    ・imo-D で判明した不具合を水平展開:
//        法線マップの v 方向を (yd - yu) に（Babylon の接空間は V が下向き）、
//        「凹凸の向き」切替を GUI に、PCF ＋ forceBackFacesOnly の影、
//        異方性フィルタ、GUI 専用カメラでも Inspector が動く bindDebugCamera
//
//  v1 : 富有柿・次郎柿の形（超楕円の子午線＋角の丸い四角の断面＋縦溝）、
//       艶の強い皮、4 枚のがく片・花托・果梗
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const PRESETS = {
        // 富有柿: 扁平でやや角張る。肩が張り、溝は浅い
        fuyu: {
            label: "富有柿",
            radius: 4.10, height: 6.20,
            superNTop: 2.70, superN: 2.30, topDimple: 0.050, dimpleWidth: 0.24,
            bottomTaper: 0.05, squareN: 2.45,
            grooveAmount: 0.020, grooveWidth: 0.12, asymmetry: 0.016,
            ground: [0.96, 0.45, 0.07],
            deep: [0.90, 0.30, 0.04],
            yellow: [0.98, 0.62, 0.16],
            seat: [0.84, 0.66, 0.30],
            sunAmount: 0.45, sunFloor: 0.55, sunSpread: 1.1,
            yellowAmount: 0.40, bottomDeep: 0.22,
            speckleCount: 16000, speckleInk: 0.10, dotCount: 40,
            lumpAmount: 0.35, grainAmount: 1.00,
            skinRoughness: 0.40, waxIntensity: 1.00, coatRoughness: 0.40, bumpLevel: 0.55,
            sepalLength: 0.44, sepalWidth: 0.26, sepalCurl: 0.07, sepalCup: 0.06,
            sepalWave: 0.013, sepalStiff: 0.55, sepalDry: 0.35, sepalSpots: 0.10,
            receptacleRadius: 0.16, stemRadius: 0.16, stemLength: 0.16
        },
        // 次郎柿: さらに扁平で四角い。4本の溝がはっきりしている
        jiro: {
            label: "次郎柿",
            radius: 4.20, height: 5.70,
            superNTop: 3.20, superN: 2.60, topDimple: 0.035, dimpleWidth: 0.22,
            bottomTaper: 0.03, squareN: 2.90,
            grooveAmount: 0.042, grooveWidth: 0.10, asymmetry: 0.014,
            ground: [0.97, 0.49, 0.08],
            deep: [0.92, 0.35, 0.05],
            yellow: [0.98, 0.64, 0.18],
            seat: [0.84, 0.68, 0.32],
            sunAmount: 0.40, sunFloor: 0.55, sunSpread: 1.1,
            yellowAmount: 0.45, bottomDeep: 0.18,
            speckleCount: 16000, speckleInk: 0.10, dotCount: 30,
            lumpAmount: 0.30, grainAmount: 1.00,
            skinRoughness: 0.40, waxIntensity: 1.00, coatRoughness: 0.40, bumpLevel: 0.55,
            sepalLength: 0.40, sepalWidth: 0.25, sepalCurl: 0.05, sepalCup: 0.05,
            sepalWave: 0.011, sepalStiff: 0.60, sepalDry: 0.30, sepalSpots: 0.08,
            receptacleRadius: 0.15, stemRadius: 0.16, stemLength: 0.14
        }
    };

    const GLOBAL = {
        count: 3,                   // 個数

        segmentsMeridian: 160,
        segmentsRound: 192,         // 4 の倍数（溝と角を頂点に乗せる）
        sepalSegS: 40, sepalSegT: 30,
        receptacleRings: 12, receptacleSides: 64,
        stemSegments: 6, stemSides: 16,
        textureSize: 1024,
        sepalTextureSize: 512,
        skinDetail: 1.0,

        // --- ざる（cm）
        basketRim: 15.0,            // 編み面の半径
        basketDepth: 4.2,           // 深さ
        basketFlat: 0.40,           // 平らな底の割合（半径比）
        basketThick: 0.45,          // ひごの厚み
        basketSegments: 128, basketRings: 40,
        weaveWidth: 0.48,           // ひごの幅
        weaveTexture: 2048,         // 30cm を 2048 px（ひご1本 ≒ 32 px）
        darkStrips: [],             // 茶色いひご（半径比）。空なら無し
        rimOffset: 0.20, rimY: 4.2 + 0.45 + 0.18,
        rimTube: 0.68, rimTubeV: 0.56,
        rimSegments: 240, rimSides: 18, rimWrapRepeat: 13,
        tieCount: 5, tieWidth: 1.5, tiePhase: 0.35,

        // --- 物理（Havok）。imo-D と同じ考え方
        // 【対策】Havok の接触許容量・スリープ閾値はメートル系の絶対値。
        //         cm 単位で実重力 981 を入れると震える。数百に落とす
        gravity: 620,
        physicsHz: 120,
        pieceMass: 1.0,
        friction: 0.80,
        restitution: 0.06,
        linearDamping: 0.15,
        angularDamping: 0.85,
        dropInterval: 0.45,
        dropClearance: 5.0,         // 下にある物の上からの落下高さ
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 6.0,

        useSSAO: true,
        useDOF: true,
        dofRatio: 0.055,
        dofFStop: 2.8,
        guiOwnCamera: true,
        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "fuyu";
    const START_SEED = 20261011;
    const BUILD = "kaki-B2";

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        // キー欠落は NaN → 真っ黒の原因になるので、fuyu をスキーマとして検出する
        const SCHEMA = PRESETS.fuyu;
        for (const k in SCHEMA) {
            if (!(k in cfg)) {
                console.error("[Config] preset '" + varietyKey + "' にキー '" + k + "' がありません。fuyu の値で補完します:", SCHEMA[k]);
                cfg[k] = SCHEMA[k];
            } else if (typeof SCHEMA[k] === "number" && !isFinite(cfg[k])) {
                console.error("[Config] preset '" + varietyKey + "' のキー '" + k + "' が数値ではありません:", cfg[k]);
                cfg[k] = SCHEMA[k];
            }
        }
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        return cfg;
    }

    const V3 = BABYLON.Vector3;

    // =================================================================
    // 1. Rng / helpers
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
        gauss(mean, sd) {
            const u = Math.max(1e-9, this.next()), v = this.next();
            return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        }
    }

    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    // 【対策】fBm のしきい値は分布を測って決める（勘で置くと何も出ない）
    function quantile(arr, q) {
        const step = Math.max(1, Math.floor(arr.length / 20000));
        const s = [];
        for (let i = 0; i < arr.length; i += step) s.push(arr[i]);
        s.sort((a, b) => a - b);
        return s[Math.floor(clamp(q, 0, 1) * (s.length - 1))];
    }

    // =================================================================
    // 2. Geo : リング列から掃引メッシュを作る（ミカン v12 と同じ）
    // =================================================================
    function fixNormals(normals) {
        let bad = 0;
        for (let i = 0; i < normals.length; i += 3) {
            const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
            if (!(l > 1e-6)) { normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0; bad++; }
        }
        return bad;
    }

    const Geo = {
        build(name, rings, centers, capStart, capEnd, scene) {
            const N = rings.length, M = rings[0].length;
            const positions = new Float32Array(N * M * 3 + 6);
            const uvs = new Float32Array(N * M * 2 + 4);
            let p = 0, q = 0;
            for (let i = 0; i < N; i++) {
                const ring = rings[i], v = i / (N - 1);
                for (let j = 0; j < M; j++) {
                    positions[p++] = ring[j].x; positions[p++] = ring[j].y; positions[p++] = ring[j].z;
                    uvs[q++] = j / (M - 1); uvs[q++] = v;
                }
            }
            const capA = N * M, capB = N * M + 1;
            positions[p++] = centers[0].x; positions[p++] = centers[0].y; positions[p++] = centers[0].z;
            positions[p++] = centers[N - 1].x; positions[p++] = centers[N - 1].y; positions[p++] = centers[N - 1].z;
            uvs[q++] = 0.5; uvs[q++] = 0.0;
            uvs[q++] = 0.5; uvs[q++] = 1.0;

            const sideIndices = (flip) => {
                const idx = [];
                for (let i = 0; i < N - 1; i++) {
                    for (let j = 0; j < M - 1; j++) {
                        const a = i * M + j, b = a + 1, c = a + M, d = c + 1;
                        if (flip) idx.push(a, b, c, b, d, c);
                        else idx.push(a, c, b, b, c, d);
                    }
                }
                return idx;
            };

            // 側面の向きは「全頂点平均」で判定（Babylon の法線規約に合わせる）
            let indices = sideIndices(false);
            let normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            const nv = N * M;
            let gx = 0, gy = 0, gz = 0;
            for (let i = 0; i < nv; i++) { gx += positions[i * 3]; gy += positions[i * 3 + 1]; gz += positions[i * 3 + 2]; }
            gx /= nv; gy /= nv; gz /= nv;
            let score = 0;
            for (let i = 0; i < nv; i++) {
                score += (positions[i * 3] - gx) * normals[i * 3]
                    + (positions[i * 3 + 1] - gy) * normals[i * 3 + 1]
                    + (positions[i * 3 + 2] - gz) * normals[i * 3 + 2];
            }
            const flipped = score < 0;
            if (flipped) indices = sideIndices(true);

            // キャップの巻き順は側面から一意に決まる
            if (capStart) {
                for (let j = 0; j < M - 1; j++) {
                    if (flipped) indices.push(capA, j + 1, j); else indices.push(capA, j, j + 1);
                }
            }
            if (capEnd) {
                const o = (N - 1) * M;
                for (let j = 0; j < M - 1; j++) {
                    if (flipped) indices.push(capB, o + j, o + j + 1); else indices.push(capB, o + j + 1, o + j);
                }
            }

            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            const bad = fixNormals(normals);
            if (flipped || bad) console.log("[Geo]", name, "winding flipped =", flipped, "/ degenerate normals =", bad);

            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = positions; vd.indices = indices;
            vd.normals = normals; vd.uvs = uvs;
            vd.applyToMesh(mesh, false);
            return mesh;
        },

        // 格子（(rows+1)×(cols+1)）から面を作る。法線は上（+Y）向きに揃える
        grid(name, rows, cols, positions, uvs, colors, scene) {
            const W = cols + 1;
            const make = (flip) => {
                const idx = [];
                for (let i = 0; i < rows; i++) {
                    for (let j = 0; j < cols; j++) {
                        const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
                        if (flip) idx.push(a, b, c, b, d, c);
                        else idx.push(a, c, b, b, c, d);
                    }
                }
                return idx;
            };
            let indices = make(false);
            let normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            let up = 0;
            for (let i = 1; i < normals.length; i += 3) up += normals[i];
            if (up < 0) {
                indices = make(true);
                normals = new Float32Array(positions.length);
                BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            }
            fixNormals(normals);
            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = positions; vd.indices = indices;
            vd.normals = normals; vd.uvs = uvs;
            if (colors) vd.colors = colors;
            vd.applyToMesh(mesh, false);
            return mesh;
        },

        ring(center, M, radiusOf) {
            const pts = [];
            for (let j = 0; j <= M; j++) {
                const a = (j % M) / M * Math.PI * 2;
                const rr = radiusOf(a);
                pts.push(new V3(center.x + Math.cos(a) * rr, center.y, center.z + Math.sin(a) * rr));
            }
            return pts;
        }
    };

    // =================================================================
    // 3. Profile : 子午線
    //   v = 0 がへた側、1 が花落ち側。返す y は 0（底）..1（天面）
    // =================================================================
    function meridianAt(v, cfg) {
        const th = clamp(v, 0, 1) * Math.PI;
        const ct = Math.cos(th), st = Math.sin(th);
        const n = ct > 0 ? cfg.superNTop : cfg.superN;
        let r = Math.pow(st, 2 / n);
        let y = 0.5 + 0.5 * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n);
        // 下すぼまり（柿は最大径が赤道よりわずかに上）
        r *= 1 - cfg.bottomTaper * smooth(0.55, 0.05, y);
        // へたの座る浅い窪み（外周が少し盛り上がって見える）
        const dw = cfg.dimpleWidth;
        y -= cfg.topDimple * Math.exp(-(r * r) / (2 * dw * dw)) * smooth(0.45, 0.60, y);
        // 花落ちの小さな窪み
        y += 0.008 * Math.exp(-(r * r) / (2 * 0.05 * 0.05)) * smooth(0.55, 0.40, y);
        return { r, y };
    }

    // =================================================================
    // 4. TextureLab
    // =================================================================
    const TextureLab = {
        _hash(x, y, seed) {
            let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
        },
        _value(x, y, period, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const p = period | 0;
            let x0 = xi % p; if (x0 < 0) x0 += p;
            let x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
            const a = this._hash(x0, yi, seed), b = this._hash(x1, yi, seed);
            const c = this._hash(x0, yi + 1, seed), d = this._hash(x1, yi + 1, seed);
            return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
        },
        fbm(x, y, basePeriod, seed, octaves) {
            let sum = 0, amp = 0.5, f = 1;
            for (let o = 0; o < octaves; o++) {
                sum += amp * this._value(x * f, y * f, basePeriod * f, seed + o * 131);
                f *= 2; amp *= 0.5;
            }
            return sum;
        },
        _canvasTexture(name, size, fill, scene, opt) {
            const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(size, size);
            fill(img.data, size);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            const o = opt || {};
            dt.wrapU = (o.wrapU === false) ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.wrapV = o.wrapV ? BABYLON.Texture.WRAP_ADDRESSMODE : BABYLON.Texture.CLAMP_ADDRESSMODE;
            // 【対策】極付近は u 方向が圧縮される。等方フィルタだとそこがぼやける
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },
        // 【対策】v 方向は (yd - yu)。(yu - yd) は V が上向きの OpenGL 系の規約で、
        //         Babylon の接空間は V が下向き。混ぜると窪みが膨らんで見える
        //         （サツマイモ imo-D で確認。GUI の「凹凸の向き」で反転できる）
        _normalFromHeight(name, h, size, strength, scene, poleFadeOn, opt) {
            return this._canvasTexture(name, size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const vv = y / N;
                    const fade = poleFadeOn ? smooth(0, 0.05, vv) * (1 - smooth(0.95, 1.0, vv)) : 1;
                    const k = strength * fade;
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * k * (poleFadeOn ? 0.5 : 1), ny = (yd - yu) * k, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * N + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, opt);
        },

        // ---- 点の散布（球面上で面積一様）---------------------------------
        // u は円周（2πR）、v は子午線（πR）を張るので rx = ry / (2·sin(πv))
        scatter(size, count, rMin, rMax, seed, vMin, vMax) {
            const f = new Float32Array(size * size);
            const r = new Rng(seed);
            const cMin = Math.cos(Math.PI * vMin), cMax = Math.cos(Math.PI * vMax);
            for (let n = 0; n < count; n++) {
                const v = Math.acos(mix(cMin, cMax, r.next())) / Math.PI;
                const u = r.next();
                const s = Math.max(0.15, Math.sin(Math.PI * v));
                const ry = mix(rMin, rMax, r.next() * r.next());
                const rx = ry / (2 * s);
                const amp = r.range(0.5, 1.0);
                const cx = u * size, cy = v * size;
                const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
                const y0 = Math.max(0, Math.floor(cy - ry - 1)), y1 = Math.min(size - 1, Math.ceil(cy + ry + 1));
                for (let y = y0; y <= y1; y++) {
                    const dy = (y + 0.5 - cy) / ry;
                    for (let x = x0; x <= x1; x++) {
                        const dx = (x + 0.5 - cx) / rx;
                        const d2 = dx * dx + dy * dy;
                        if (d2 >= 1) continue;
                        const val = amp * (1 - d2) * (1 - d2);
                        const i = y * size + (((x % size) + size) % size);
                        if (val > f[i]) f[i] = val;
                    }
                }
            }
            return f;
        },

        sunAt(u, v, cfg, seed) {
            let du = Math.abs(u - 0.5);
            du = Math.min(du, 1 - du) * 2;
            const angular = cfg.sunFloor + (1 - cfg.sunFloor) * Math.pow(1 - du, cfg.sunSpread);
            const cloud = this.fbm(u * 5, v * 4, 5, seed, 3);
            return clamp(cfg.sunAmount * angular * (0.55 + 0.80 * cloud), 0, 1);
        },

        // 溝の位置（u）。角はがく片の方向 = u 0, 0.25, 0.5, 0.75、溝はその間
        grooveDist(u) {
            const t = ((u - 0.125) * 4) % 1;
            const f = t < 0 ? t + 1 : t;
            return Math.min(f, 1 - f) / 4;           // u 単位の距離
        },

        bodyFields(size, cfg, seed) {
            const yel = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                for (let x = 0; x < size; x++) {
                    yel[y * size + x] = this.fbm(x / size * 4, v * 3, 4, seed + 7, 3);
                }
            }
            const S = size / 1024;
            return {
                yel,
                yLo: quantile(yel, 0.45), yHi: quantile(yel, 0.92),
                sp: this.scatter(size, cfg.speckleCount, 0.9 * S, 1.6 * S, seed + 21, 0.06, 0.985),
                dot: this.scatter(size, cfg.dotCount, 1.4 * S, 3.0 * S, seed + 33, 0.07, 0.90)
            };
        },

        bodyAlbedo(scene, size, cfg, F, seed) {
            const G = cfg.ground, D = cfg.deep, Y = cfg.yellow, SEAT = cfg.seat;
            const LINE = [0.84, 0.30, 0.05], BLINE = [0.58, 0.30, 0.10];
            const SPECK = [1.00, 0.72, 0.34], DOT = [0.40, 0.20, 0.08], NAVEL = [0.20, 0.13, 0.08];
            return this._canvasTexture("kakiAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const seatK = smooth(0.075, 0.0, v);
                    const navelK = smooth(0.990, 0.997, v);
                    const yBand = 0.35 + 0.65 * smooth(0.75, 0.15, v);
                    const lineBand = smooth(0.08, 0.28, v) * smooth(0.78, 0.50, v);
                    const blBand = smooth(0.80, 0.985, v);
                    const bottom = cfg.bottomDeep * smooth(0.45, 0.95, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, k = y * N + x, i = k * 4;
                        let cr = G[0], cg = G[1], cb = G[2];

                        const mott = 0.96 + 0.08 * this.fbm(u * 7, v * 5, 7, seed + 3, 2);
                        cr *= mott; cg *= mott; cb *= mott;

                        const sn = clamp(this.sunAt(u, v, cfg, seed + 11) + bottom, 0, 1);
                        cr = mix(cr, D[0], sn); cg = mix(cg, D[1], sn); cb = mix(cb, D[2], sn);

                        const yw = cfg.yellowAmount * smooth(F.yLo, F.yHi, F.yel[k]) * yBand;
                        cr = mix(cr, Y[0], yw); cg = mix(cg, Y[1], yw); cb = mix(cb, Y[2], yw);

                        // 溝の細い筋（側面）と花落ちから伸びる4本の筋
                        const gd = this.grooveDist(u);
                        const lw = lineBand * Math.exp(-(gd * gd) / (2 * 0.0035 * 0.0035)) * 0.12;
                        cr = mix(cr, LINE[0], lw); cg = mix(cg, LINE[1], lw); cb = mix(cb, LINE[2], lw);
                        const bw = blBand * Math.exp(-(gd * gd) / (2 * 0.006 * 0.006)) * 0.30;
                        cr = mix(cr, BLINE[0], bw); cg = mix(cg, BLINE[1], bw); cb = mix(cb, BLINE[2], bw);

                        const sw = F.sp[k] * cfg.speckleInk;
                        cr = mix(cr, SPECK[0], sw); cg = mix(cg, SPECK[1], sw); cb = mix(cb, SPECK[2], sw);
                        const dw = F.dot[k] * 0.85;
                        cr = mix(cr, DOT[0], dw); cg = mix(cg, DOT[1], dw); cb = mix(cb, DOT[2], dw);

                        if (seatK > 0) {
                            cr = mix(cr, SEAT[0], seatK * 0.7); cg = mix(cg, SEAT[1], seatK * 0.7); cb = mix(cb, SEAT[2], seatK * 0.7);
                        }
                        if (navelK > 0) {
                            cr = mix(cr, NAVEL[0], navelK); cg = mix(cg, NAVEL[1], navelK); cb = mix(cb, NAVEL[2], navelK);
                        }
                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        bodyORM(scene, size, cfg, F, seed) {
            return this._canvasTexture("kakiORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const seatK = smooth(0.06, 0.0, v);
                    const navelK = smooth(0.985, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, k = y * N + x, i = k * 4;
                        let rough = cfg.skinRoughness * (0.90 + 0.20 * this.fbm(u * 12, v * 9, 12, seed + 5, 2));
                        rough = mix(rough, 0.75, F.dot[k]);
                        rough = mix(rough, 0.85, seatK);
                        rough = mix(rough, 0.80, navelK);
                        const ao = mix(1.0, 0.55, seatK) * mix(1.0, 0.7, navelK);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // クリアコート（R=強度 / G=粗さ）。広い艶に指紋のようなムラ
        bodyWax(scene, size, cfg, F, seed) {
            return this._canvasTexture("kakiWax", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const dull = Math.max(smooth(0.09, 0.01, v), smooth(0.97, 1.0, v));
                    for (let x = 0; x < N; x++) {
                        const u = x / N, k = y * N + x, i = k * 4;
                        const smudge = this.fbm(u * 6, v * 5, 6, seed, 3);
                        const fine = this.fbm(u * 24, v * 18, 24, seed + 9, 2);
                        const inten = (0.82 + 0.18 * smudge) * (1 - 0.75 * dull) * (1 - 0.7 * F.dot[k]);
                        const rough = 0.30 + 0.32 * (1 - smudge) + 0.12 * fine + 0.40 * dull + 0.30 * F.dot[k];
                        d[i] = clamp(inten, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.10, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        bodyNormal(scene, size, cfg, F, seed, detail) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const blBand = smooth(0.82, 0.985, v);
                for (let x = 0; x < size; x++) {
                    const u = x / size, k = y * size + x;
                    const lump = this.fbm(u * 6, v * 5, 6, seed + 3, 3) * 0.50 * cfg.lumpAmount;
                    const fine = this.fbm(u * 70, v * 55, 70, seed, 2) * 0.10 * cfg.grainAmount;
                    const micro = this.fbm(u * 200, v * 160, 200, seed + 61, 2) * 0.05 * cfg.grainAmount;
                    const gd = this.grooveDist(u);
                    const bl = blBand * Math.exp(-(gd * gd) / (2 * 0.005 * 0.005));
                    h[k] = lump + fine + micro + F.sp[k] * 0.08 - F.dot[k] * 0.20 - bl * 0.25;
                }
            }
            const strength = 1.05 * (detail === undefined ? 1 : detail) * (size / 1024);
            return this._normalFromHeight("kakiNormal", h, size, strength, scene, true);
        },

        // ---- がく片（u = 幅方向 0..1 / v = 基部 0 → 先端 1）-------------
        sepalFields(size, seed) {
            const spot = new Float32Array(size * size), dry = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size, k = y * size + x;
                    spot[k] = this.fbm(u * 22, v * 22, 22, seed + 5, 3);
                    dry[k] = this.fbm(u * 5, v * 5, 5, seed + 9, 3);
                }
            }
            return { spot, dry };
        },
        sepalVein(u, v) {
            const xx = (u - 0.5) * 2, ax = Math.abs(xx);
            const mid = Math.exp(-(xx * xx) / (2 * 0.035 * 0.035));
            const lat = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (v * 6 - ax * 1.6)), 14)
                * smooth(0.03, 0.20, ax) * (1 - smooth(0.85, 1.0, ax)) * smooth(0.04, 0.15, v);
            return Math.max(mid, lat * 0.7);
        },
        sepalAlbedo(scene, size, cfg, F, seed) {
            const BASE = [0.34, 0.46, 0.13], MID = [0.55, 0.64, 0.24], EDGE = [0.68, 0.68, 0.32];
            const DRY = [0.50, 0.40, 0.19], SPOT = [0.33, 0.23, 0.21], VEIN = [0.72, 0.74, 0.42];
            const sLo = quantile(F.spot, 1 - cfg.sepalSpots), sHi = quantile(F.spot, 1 - cfg.sepalSpots * 0.3);
            const dLo = quantile(F.dry, 0.50), dHi = quantile(F.dry, 0.88);
            return this._canvasTexture("sepalAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, k = y * N + x, i = k * 4;
                        const ax = Math.abs((u - 0.5) * 2);
                        const w1 = smooth(0.05, 0.45, v);
                        let cr = mix(BASE[0], MID[0], w1), cg = mix(BASE[1], MID[1], w1), cb = mix(BASE[2], MID[2], w1);
                        const e = Math.max(smooth(0.70, 0.98, ax), smooth(0.85, 1.0, v));
                        cr = mix(cr, EDGE[0], e * 0.7); cg = mix(cg, EDGE[1], e * 0.7); cb = mix(cb, EDGE[2], e * 0.7);
                        const g = 0.90 + 0.20 * this.fbm(u * 9, v * 9, 9, seed + 2, 2);
                        cr *= g; cg *= g; cb *= g;
                        const vn = this.sepalVein(u, v) * 0.45;
                        cr = mix(cr, VEIN[0], vn); cg = mix(cg, VEIN[1], vn); cb = mix(cb, VEIN[2], vn);
                        const sw = smooth(sLo, sHi, F.spot[k]) * smooth(0.02, 0.15, v) * smooth(0.80, 0.35, v) * 0.85;
                        cr = mix(cr, SPOT[0], sw); cg = mix(cg, SPOT[1], sw); cb = mix(cb, SPOT[2], sw);
                        const dw = cfg.sepalDry * (0.3 + 0.7 * e) * smooth(dLo, dHi, F.dry[k]) * (0.4 + 0.6 * smooth(0.3, 1.0, v));
                        cr = mix(cr, DRY[0], dw); cg = mix(cg, DRY[1], dw); cb = mix(cb, DRY[2], dw);
                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, { wrapU: false });
        },
        sepalNormal(scene, size, seed) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    h[y * size + x] = this.sepalVein(u, v) * 1.0
                        + this.fbm(u * 40, v * 40, 40, seed, 2) * 0.35;
                }
            }
            return this._normalFromHeight("sepalNormal", h, size, 1.6 * (size / 512), scene, false, { wrapU: false });
        }
    };

    // =================================================================
    //  SkinFactory : 品種ごとのマテリアル（キャッシュ対象）
    // =================================================================
    class SkinFactory {
        constructor(scene, cfg) {
            const S = cfg.textureSize, SS = cfg.sepalTextureSize;
            const t0 = performance.now();
            const F = TextureLab.bodyFields(S, cfg, 77);
            this.albedoTex = TextureLab.bodyAlbedo(scene, S, cfg, F, 77);
            this.ormTex = TextureLab.bodyORM(scene, S, cfg, F, 77);
            this.waxTex = TextureLab.bodyWax(scene, S, cfg, F, 512);
            this.normalTex = TextureLab.bodyNormal(scene, S, cfg, F, 909, cfg.skinDetail);
            const SF = TextureLab.sepalFields(SS, 4242);
            this.sepalAlbedoTex = TextureLab.sepalAlbedo(scene, SS, cfg, SF, 4242);
            this.sepalNormalTex = TextureLab.sepalNormal(scene, SS, 4243);
            this.bakeMs = performance.now() - t0;

            const pbr = new BABYLON.PBRMaterial("kakiSkin", scene);
            pbr.albedoTexture = this.albedoTex;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;
            pbr.metallicTexture = this.ormTex;
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            pbr.bumpTexture.level = cfg.bumpLevel;
            this.bumpBase = cfg.bumpLevel;
            pbr.clearCoat.isEnabled = true;
            pbr.clearCoat.intensity = 0.80 * cfg.waxIntensity;
            if (!isFinite(pbr.clearCoat.intensity)) pbr.clearCoat.intensity = 0.8;
            pbr.clearCoat.roughness = cfg.coatRoughness;      // 実効粗さ = テクスチャ G × これ
            pbr.clearCoat.texture = this.waxTex;
            pbr.clearCoat.useRoughnessFromMainTexture = true;
            pbr.clearCoat.indexOfRefraction = 1.40;
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(0.95, 0.40, 0.10);
            pbr.subSurface.translucencyIntensity = 0.08;
            pbr.subSurface.minimumThickness = 1.0;
            pbr.subSurface.maximumThickness = 5.0;
            this.skin = pbr;

            const sepal = new BABYLON.PBRMaterial("kakiSepal", scene);
            sepal.albedoTexture = this.sepalAlbedoTex;
            sepal.metallic = 0.0;
            sepal.roughness = 0.62;
            sepal.bumpTexture = this.sepalNormalTex;
            sepal.bumpTexture.level = 0.7;
            sepal.backFaceCulling = false;
            sepal.twoSidedLighting = true;
            this.sepal = sepal;

            const cushion = new BABYLON.PBRMaterial("kakiReceptacle", scene);
            cushion.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            cushion.metallic = 0.0;
            cushion.roughness = 0.60;
            this.cushion = cushion;

            const stem = new BABYLON.PBRMaterial("kakiStem", scene);
            stem.albedoColor = new BABYLON.Color3(1, 1, 1);
            stem.metallic = 0.0;
            stem.roughness = 0.85;
            this.stem = stem;
        }
        dispose() {
            this.skin.dispose(true, false); this.sepal.dispose(true, false);
            this.cushion.dispose(true, false); this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.waxTex.dispose(); this.normalTex.dispose();
            this.sepalAlbedoTex.dispose(); this.sepalNormalTex.dispose();
        }
    }

    const lin = (c) => new BABYLON.Color3(c[0], c[1], c[2]).toLinearSpace();

    // =================================================================
    // 5. Kaki
    // =================================================================
    class Kaki {
        constructor(scene, cfg, seed, skin) {
            this.scene = scene; this.cfg = cfg;
            const rng = new Rng(seed);
            this.rng = rng;
            this.R = cfg.radius * rng.range(0.95, 1.05);
            this.H = cfg.height * rng.range(0.95, 1.05);
            // 角（がく片の向き）は u = 0 に固定する。テクスチャの溝の筋と合わせるため。
            // 個体ごとの向きは root を回して出す
            this.cornerPhase = 0;
            this.asymPhase = rng.range(0, Math.PI * 2);
            this.asym = cfg.asymmetry * rng.range(0.6, 1.4);
            this.d2 = cfg.asymmetry * rng.range(0.35, 0.70);
            this.d3 = cfg.asymmetry * rng.range(0.20, 0.45);
            this.p2 = rng.range(0, Math.PI * 2);
            this.p3 = rng.range(0, Math.PI * 2);
            this.grooveDepth = [0, 1, 2, 3].map(() => rng.range(0.55, 1.30));

            this.parts = [];
            this._buildBody(skin);
            this._buildReceptacle(skin);
            this._buildSepals(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("kaki", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        radiusAt(v, phi) {
            const cfg = this.cfg;
            const m = meridianAt(v, cfg);
            const yb = Math.sin(Math.PI * clamp(m.y, 0, 1));
            // 角の丸い四角（超楕円の断面）。極に近いほど丸に戻す
            const n = 2 + (cfg.squareN - 2) * (0.25 + 0.75 * yb);
            const ps = phi - this.cornerPhase + Math.PI / 4;
            const c = Math.abs(Math.cos(ps)), s = Math.abs(Math.sin(ps));
            let f = Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
            f /= (1 + Math.pow(2, 0.5 - 1 / n)) * 0.5;           // 平均径を保つ
            let r = m.r * this.R * f;
            // 角と角の間の縦溝
            let g = 0;
            const w = cfg.grooveWidth;
            for (let k = 0; k < 4; k++) {
                const dp = wrapAngle(phi - (this.cornerPhase + Math.PI / 4 + k * Math.PI / 2));
                g += this.grooveDepth[k] * Math.exp(-(dp * dp) / (2 * w * w));
            }
            const band = smooth(0.06, 0.40, m.y) * smooth(0.98, 0.70, m.y);
            r *= 1 - cfg.grooveAmount * band * g;
            // 個体差の歪み
            r *= 1 + this.asym * Math.cos(phi - this.asymPhase) * (0.30 + 0.70 * yb)
                + this.d2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * m.y * 1.3)
                + this.d3 * Math.cos(3 * phi - this.p3) * Math.sin(Math.PI * m.y * 0.8);
            return Math.max(0.004, r);
        }

        // 方向 phi で水平半径 rho の位置にある果皮の高さ（上半分のみ探索）
        seatAt(rho, phi) {
            const N = this.cfg.segmentsMeridian;
            let pr = this.radiusAt(0, phi), py = meridianAt(0, this.cfg).y * this.H;
            for (let i = 1; i <= N / 2; i++) {
                const v = i / N;
                const r = this.radiusAt(v, phi), y = meridianAt(v, this.cfg).y * this.H;
                if (r >= rho) {
                    const t = clamp((rho - pr) / Math.max(1e-6, r - pr), 0, 1);
                    return { y: mix(py, y, t) };
                }
                pr = r; py = y;
            }
            return { y: py };
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsMeridian, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const v = i / N;
                const c = new V3(0, meridianAt(v, cfg).y * this.H, 0);
                rings.push(Geo.ring(c, M, (phi) => this.radiusAt(v, phi)));
                centers.push(c);
            }
            const mesh = Geo.build("kakiBody", rings, centers, true, true, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // 花托（中央の四角いクッション）
        _buildReceptacle(skin) {
            const cfg = this.cfg, R = this.R;
            const K = cfg.receptacleRings, M = cfg.receptacleSides;
            const rc = R * cfg.receptacleRadius;
            const positions = [], uvs = [], colors = [];
            const cIn = lin([0.60, 0.62, 0.28]), cMid = lin([0.48, 0.56, 0.20]), cOut = lin([0.42, 0.50, 0.17]);
            for (let i = 0; i <= K; i++) {
                const s = i / K;
                for (let j = 0; j <= M; j++) {
                    const phi = (j % M) / M * Math.PI * 2;
                    const sq = 1 + 0.10 * Math.cos(4 * (phi - this.cornerPhase));
                    const rho = rc * s * sq;
                    const seat = this.seatAt(rho, phi);
                    const lift = R * (0.003 + 0.067 * Math.pow(Math.max(0, 1 - s * s), 0.6));
                    positions.push(Math.cos(phi) * rho, seat.y + lift, Math.sin(phi) * rho);
                    uvs.push(j / M, s);
                    const w1 = smooth(0.15, 0.6, s), w2 = smooth(0.6, 1.0, s);
                    const g = 0.92 + 0.16 * TextureLab.fbm(phi * 2, s * 4, 12, 613, 2);
                    colors.push(mix(mix(cIn.r, cMid.r, w1), cOut.r, w2) * g,
                        mix(mix(cIn.g, cMid.g, w1), cOut.g, w2) * g,
                        mix(mix(cIn.b, cMid.b, w1), cOut.b, w2) * g, 1);
                }
            }
            const mesh = Geo.grid("kakiReceptacle", K, M, new Float32Array(positions),
                new Float32Array(uvs), new Float32Array(colors), this.scene);
            mesh.material = skin.cushion;
            mesh.receiveShadows = true;
            this.receptacleTopY = this.seatAt(0, 0).y + R * 0.070;
            this.parts.push(mesh);
        }

        // がく片 4 枚
        _buildSepals(skin) {
            const cfg = this.cfg, rng = this.rng, R = this.R;
            const S = cfg.sepalSegS, T = cfg.sepalSegT;
            // 【対策】がく片は基部で重なる。同じ高さだと z-fighting になるので
            //         層の順番を 0,2,1,3 にして隣どうしの高さを必ず変える
            const layerOrder = [0, 2, 1, 3];
            this.sepals = [];
            for (let k = 0; k < 4; k++) {
                const a = this.cornerPhase + k * Math.PI / 2 + rng.range(-0.10, 0.10);
                const L = R * cfg.sepalLength * rng.range(0.88, 1.12);
                const W = R * cfg.sepalWidth * rng.range(0.88, 1.12);
                const curl = rng.range(0.5, 1.5), cup = rng.range(0.6, 1.4);
                const wph = rng.range(0, Math.PI * 2), twist = rng.range(-1, 1);
                const skew = rng.range(-0.12, 0.12);
                const layer = layerOrder[k] * 0.006 * R;
                const rho0 = 0.09 * R;
                const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
                const yRef = this.seatAt(rho0 + 0.25 * L, a).y;

                const positions = new Float32Array((S + 1) * (T + 1) * 3);
                const uvs = new Float32Array((S + 1) * (T + 1) * 2);
                let p = 0, q = 0;
                for (let i = 0; i <= S; i++) {
                    const s = i / S;
                    // 幅: 基部は細く、中ほどで最大、先は丸く尖る
                    let hw = W * Math.pow(Math.sin(Math.PI * (0.06 + 0.92 * s)), 0.6);
                    hw *= 1 + 0.06 * Math.sin(s * Math.PI * 5 + wph);
                    for (let j = 0; j <= T; j++) {
                        const t = -1 + 2 * j / T;
                        const along = rho0 + s * L;
                        const side = t * hw + skew * s * s * L;
                        const x = dx * along + px * side, z = dz * along + pz * side;
                        const rr = Math.hypot(x, z), ph = Math.atan2(z, x);
                        const seat = this.seatAt(rr, ph);
                        // 硬い葉なので果皮の曲面に沿い切らない（sepalStiff）
                        const yb = Math.max(seat.y, mix(seat.y, yRef, cfg.sepalStiff));
                        let lift = R * (0.010
                            + cfg.sepalCurl * curl * Math.pow(smooth(0.30, 1.0, s), 2)
                            + cfg.sepalCup * cup * t * t * smooth(0.05, 0.70, s)
                            + cfg.sepalWave * Math.sin(s * Math.PI * 4.5 + wph + t * 1.3) * Math.pow(Math.abs(t), 1.5) * smooth(0.2, 0.9, s)
                            + 0.03 * twist * t * s);
                        lift = Math.max(R * 0.006, lift) + layer;
                        positions[p++] = x; positions[p++] = yb + lift; positions[p++] = z;
                        uvs[q++] = 0.5 + 0.5 * t; uvs[q++] = s;
                    }
                }
                const mesh = Geo.grid("kakiSepal" + k, S, T, positions, uvs, null, this.scene);
                mesh.material = skin.sepal;
                mesh.receiveShadows = true;
                this.sepals.push(mesh);
                this.parts.push(mesh);
            }
        }

        // 果梗の切り株
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const rs = cfg.stemRadius * rng.range(0.9, 1.1);
            const y0 = this.receptacleTopY - rs * 0.8;
            const L = cfg.stemLength * rng.range(0.8, 1.2) + rs * 0.8;
            const rings = [], centers = [];
            for (let k = 0; k <= K; k++) {
                const s = k / K;
                const c = new V3(0, y0 + L * s, 0);
                const rr = rs * (1.25 - 0.25 * smooth(0, 0.4, s)) * (1 - 0.06 * smooth(0.8, 1.0, s));
                rings.push(Geo.ring(c, M, (phi) => rr * (1 + 0.06 * Math.cos(3 * phi + 0.7) + 0.03 * Math.cos(5 * phi))));
                centers.push(c);
            }
            const mesh = Geo.build("kakiStem", rings, centers, false, true, this.scene);
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const uv = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            const col = new Float32Array((pos.length / 3) * 4);
            const cRoot = lin([0.42, 0.40, 0.20]), cBark = lin([0.36, 0.25, 0.14]), cCut = lin([0.66, 0.56, 0.38]);
            for (let i = 0, c = 0; i < pos.length / 3; i++, c += 4) {
                const t = uv[i * 2 + 1];
                const w1 = smooth(0.0, 0.5, t), w2 = smooth(0.92, 1.0, t);
                const g = 0.88 + 0.24 * TextureLab.fbm(uv[i * 2] * 10, t * 3, 10, 771, 2);
                col[c] = mix(mix(cRoot.r, cBark.r, w1), cCut.r, w2) * g;
                col[c + 1] = mix(mix(cRoot.g, cBark.g, w1), cCut.g, w2) * g;
                col[c + 2] = mix(mix(cRoot.b, cBark.b, w1), cCut.b, w2) * g;
                col[c + 3] = 1;
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
            mesh.hasVertexAlpha = false;
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stemTopY = y0 + L;
            this.parts.push(mesh);
        }

        // 当たり判定：同じ関数を粗く評価した代理点群の凸包
        // 【対策】細かい点群のまま凸包にすると、ほぼ同一平面の面が大量にでき、
        //         接触マニフォールドが毎ステップ別の面へ飛び移って震える（imo-D）。
        //         低周波（四角い断面・溝・歪み）だけ残す
        // 【対策】がく片の先と果梗の頂点も入れる。入れないと逆さに落ちたとき
        //         へたがざるにめり込む
        hullShape() {
            const cfg = this.cfg, pts = [];
            const NM = 20, NR = 24;
            for (let i = 0; i <= NM; i++) {
                const v = i / NM, y = meridianAt(v, cfg).y * this.H;
                for (let j = 0; j < NR; j++) {
                    const phi = j / NR * Math.PI * 2, r = this.radiusAt(v, phi) * 0.985;
                    pts.push(Math.cos(phi) * r, y, Math.sin(phi) * r);
                }
            }
            const S = cfg.sepalSegS, T = cfg.sepalSegT;
            for (const sm of this.sepals) {
                const p = sm.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                for (const i of [S >> 1, S]) for (const j of [0, T >> 1, T]) {
                    const k = (i * (T + 1) + j) * 3;
                    pts.push(p[k], p[k + 1], p[k + 2]);
                }
            }
            pts.push(0, this.stemTopY, 0);
            // 【対策】花落ち側は丸いので、凸包の底がほぼ同一平面の小さな面の
            //         集まりになり、接地面が毎ステップ入れ替わって揺れ続ける
            //         （実測で 5 秒以上 1〜4 cm/s で揺れていた）。
            //         底を 1.8mm だけ削いで一枚の平面にする。見た目には出ない
            let ymin = Infinity;
            for (let i = 1; i < pts.length; i += 3) ymin = Math.min(ymin, pts[i]);
            const yCut = ymin + 0.045 * this.R;
            for (let i = 1; i < pts.length; i += 3) if (pts[i] < yCut) pts[i] = yCut;
            const n = pts.length / 3, idx = [];
            for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
            const proxy = new BABYLON.Mesh("kakiProxy", this.scene);
            const vd = new BABYLON.VertexData();
            vd.positions = new Float32Array(pts); vd.indices = idx;
            vd.applyToMesh(proxy, false);
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

        bounds() {
            const o = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
            for (const m of this.parts) {
                const p = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                for (let i = 0; i < p.length; i += 3) {
                    o.minX = Math.min(o.minX, p[i]); o.maxX = Math.max(o.maxX, p[i]);
                    o.minY = Math.min(o.minY, p[i + 1]); o.maxY = Math.max(o.maxY, p[i + 1]);
                    o.minZ = Math.min(o.minZ, p[i + 2]); o.maxZ = Math.max(o.maxZ, p[i + 2]);
                }
            }
            return o;
        }

        dispose() {
            for (const m of this.parts) m.dispose();
            if (this.root) this.root.dispose();
            this.parts.length = 0;
        }
    }

    // =================================================================
    // 6. Zaru （竹ざる）
    // =================================================================
    // 写真の要点
    //   ・浅く広い皿形。底は平らで、縁に向かってゆるく立ち上がる
    //   ・網代（あじろ）編み。横のひごが主で、縦のひごは短く顔を出すだけ
    //     （3 本越え 1 本潜りの綾）。そのため横縞に斜めの段々が乗って見える
    //   ・ところどころに茶色く染めたひごが走る
    //   ・縁は竹を束ねて細いひごで巻いた太い輪。黄色い留め具が数か所
    //
    // 【対策】網代は器の形に関係なく平行に走るので、テクスチャは極座標でなく
    //         真上からの平行投影（xz）で貼る。極座標だと中心に向かって
    //         ひごが放射状に集まり、写真とまったく違う「蜘蛛の巣」になる
    const ZaruLab = {
        weave(scene, size, cfg, seed) {
            const N = size, Rt = cfg.basketRim + 1.0, w = cfg.weaveWidth;
            const H = new Float32Array(N * N);
            const alb = new Uint8ClampedArray(N * N * 4);
            const orm = new Uint8ClampedArray(N * N * 4);
            const TL = TextureLab;
            const hash = (n) => TL._hash(n | 0, 17, seed);
            const darkRows = new Set();
            for (const f of cfg.darkStrips) darkRows.add(Math.round(f * cfg.basketRim / w));
            const mod4 = (a) => ((a % 4) + 4) % 4;
            const BAMBOO = [0.86, 0.73, 0.49], SKIN = [0.84, 0.76, 0.50], DARK = [0.44, 0.27, 0.16];
            for (let py = 0; py < N; py++) {
                const z0 = ((py + 0.5) / N * 2 - 1) * Rt;
                for (let px = 0; px < N; px++) {
                    const x0 = ((px + 0.5) / N * 2 - 1) * Rt;
                    // 手編みの揺らぎ：ひごの列がわずかに波打つ
                    let Z = z0 / w, X = x0 / w;
                    Z += 0.07 * Math.sin(X * 0.31 + Math.floor(Z) * 0.9);
                    X += 0.07 * Math.sin(Z * 0.27 + Math.floor(X) * 1.3);
                    const i = Math.floor(Z), j = Math.floor(X);
                    const fz = Z - i, fx = X - j;
                    const weftTop = mod4(j - i) !== 0;           // 3 本越え 1 本潜り
                    let c, along, strip, dip = 0, dark = false;
                    if (weftTop) {
                        c = fz; along = X; strip = i;
                        if (mod4(j + 1 - i) === 0) dip += smooth(0.62, 1.0, fx);
                        if (mod4(j - 1 - i) === 0) dip += smooth(0.38, 0.0, fx);
                        dark = darkRows.has(i) || darkRows.has(-i);
                    } else {
                        c = fx; along = Z; strip = 100000 + j;
                        dip = smooth(0.60, 1.0, fz) + smooth(0.40, 0.0, fz);
                    }
                    const gap = smooth(0.0, 0.08, c) * smooth(1.0, 0.92, c);
                    const prof = Math.pow(Math.max(0, Math.sin(Math.PI * c)), 0.35);
                    let h = mix(-0.35, 0.45 + 0.55 * prof - 0.40 * dip, gap);
                    const k = py * N + px;
                    H[k] = h;

                    const outer = hash(strip * 3 + 1) < 0.35;  // 表皮側が出ているひご
                    const tone = 0.88 + 0.16 * hash(strip * 7 + 3);
                    const fib = 0.90 + 0.18 * TL.fbm(along * 0.7, (c + strip * 1.37) * 12, 4096, seed + 5, 3);
                    const age = 0.94 + 0.10 * TL.fbm(x0 * 0.18 + 50, z0 * 0.18 + 50, 4096, seed + 9, 3);
                    const base = dark ? DARK : (outer ? SKIN : BAMBOO);
                    const ao = mix(0.42, 1.0, gap) * (1 - 0.30 * dip);
                    const s = tone * fib * age * (0.55 + 0.45 * ao);
                    const q = k * 4;
                    alb[q] = clamp(base[0] * s, 0, 1) * 255;
                    alb[q + 1] = clamp(base[1] * s, 0, 1) * 255;
                    alb[q + 2] = clamp(base[2] * s, 0, 1) * 255;
                    alb[q + 3] = 255;
                    orm[q] = clamp(ao, 0, 1) * 255;
                    orm[q + 1] = clamp(0.60 + 0.20 * (1 - gap) - (outer ? 0.16 : 0) + 0.06 * (1 - fib), 0.05, 1) * 255;
                    orm[q + 2] = 0; orm[q + 3] = 255;
                }
            }
            const copy = (src) => (d) => d.set(src);
            const opt = { wrapU: false, wrapV: false };
            return {
                albedo: TL._canvasTexture("zaruAlbedo", N, copy(alb), scene, opt),
                orm: TL._canvasTexture("zaruORM", N, copy(orm), scene, opt),
                normal: TL._normalFromHeight("zaruNormal", H, N, 1.4 * (N / 1024), scene, false, opt)
            };
        },

        // 縁を巻くひご（u = 輪に沿う / v = 管の周り）。らせんで巻く
        // 【対策】uScale で繰り返すので、u 方向の巻き数は整数にして継ぎ目を消す
        rimWrap(scene, size, seed) {
            const TL = TextureLab, H = new Float32Array(size * size);
            const WRAPS = 12, COL = [0.84, 0.70, 0.45];
            const alb = TL._canvasTexture("rimAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, k = y * N + x, i = k * 4;
                        const t = u * WRAPS + v, c = t - Math.floor(t), n = Math.floor(t);
                        const gap = smooth(0.0, 0.10, c) * smooth(1.0, 0.90, c);
                        H[k] = mix(-0.4, Math.pow(Math.sin(Math.PI * c), 0.4), gap);
                        const fib = 0.88 + 0.20 * TL.fbm(v * 3 + n * 0.37, c * 9 + n * 2.1, 4096, seed, 3);
                        const tone = 0.90 + 0.14 * TL._hash(n, 5, seed);
                        const s = fib * tone * mix(0.45, 1.0, gap);
                        d[i] = clamp(COL[0] * s, 0, 1) * 255;
                        d[i + 1] = clamp(COL[1] * s, 0, 1) * 255;
                        d[i + 2] = clamp(COL[2] * s, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene, { wrapU: true, wrapV: true });
            const nrm = TL._normalFromHeight("rimNormal", H, size, 1.6 * (size / 512), scene, false, { wrapU: true, wrapV: true });
            return { albedo: alb, normal: nrm };
        }
    };

    // 位置の同じ頂点の法線を平均する（継ぎ目・中心の縮退リング）
    function weldNormals(positions, normals) {
        const map = new Map();
        const key = (i) => Math.round(positions[i * 3] * 1e3) + "," + Math.round(positions[i * 3 + 1] * 1e3) + "," + Math.round(positions[i * 3 + 2] * 1e3);
        const n = positions.length / 3;
        for (let i = 0; i < n; i++) {
            const k = key(i);
            let a = map.get(k);
            if (!a) { a = []; map.set(k, a); }
            a.push(i);
        }
        for (const a of map.values()) {
            if (a.length < 2) continue;
            let x = 0, y = 0, z = 0;
            for (const i of a) { x += normals[i * 3]; y += normals[i * 3 + 1]; z += normals[i * 3 + 2]; }
            const l = Math.hypot(x, y, z) || 1;
            for (const i of a) { normals[i * 3] = x / l; normals[i * 3 + 1] = y / l; normals[i * 3 + 2] = z / l; }
        }
    }

    // 向きの基準 refDir(i) と法線の内積の総和が負なら三角形を裏返す
    function orientedMesh(name, positions, indices, uvs, refDir, scene) {
        let normals = new Float32Array(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        let score = 0;
        for (let i = 0; i < positions.length / 3; i++) {
            const r = refDir(i);
            if (r) score += normals[i * 3] * r[0] + normals[i * 3 + 1] * r[1] + normals[i * 3 + 2] * r[2];
        }
        if (score < 0) {
            for (let t = 0; t < indices.length; t += 3) { const a = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = a; }
            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        }
        weldNormals(positions, normals);
        fixNormals(normals);
        const mesh = new BABYLON.Mesh(name, scene);
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.indices = indices; vd.normals = normals; vd.uvs = uvs;
        vd.applyToMesh(mesh, false);
        return { mesh, flipped: score < 0 };
    }

    // 輪に沿った管（縁・留め具）。swell(q) で太さを変える（q = 0..1 は区間内の位置）
    function ringTube(name, cfg, a0, a1, segs, sides, swell, scene) {
        const rC = cfg.basketRim + cfg.rimOffset, yC = cfg.rimY;
        const W = sides + 1, positions = [], uvs = [], ref = [];
        for (let i = 0; i <= segs; i++) {
            const q = i / segs, a = a0 + (a1 - a0) * q;
            const ca = Math.cos(a), sa = Math.sin(a), sw = swell ? swell(q) : 1;
            for (let j = 0; j <= sides; j++) {
                const b = (j % sides) / sides * Math.PI * 2;
                const ox = Math.cos(b) * cfg.rimTube * sw, oy = Math.sin(b) * cfg.rimTubeV * sw;
                positions.push((rC + ox) * ca, yC + oy, (rC + ox) * sa);
                uvs.push(q, j / sides);
                ref.push([Math.cos(b) * ca, Math.sin(b), Math.cos(b) * sa]);
            }
        }
        const indices = [];
        for (let i = 0; i < segs; i++) for (let j = 0; j < sides; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        return orientedMesh(name, new Float32Array(positions), indices, new Float32Array(uvs), (i) => ref[i], scene).mesh;
    }

    // 【対策】当たり判定に薄い一枚板を使うと落下速度によってはすり抜ける。
    //         内面と外面を張って縁で閉じた厚みのある器にする（サツマイモ版と同じ）
    function zaruInnerY(cfg, r) {
        const s = clamp(r / cfg.basketRim, 0, 1);
        return cfg.basketThick + cfg.basketDepth * Math.pow(clamp((s - cfg.basketFlat) / (1 - cfg.basketFlat), 0, 1), 1.7);
    }

    function buildZaru(scene, cfg) {
        const t0 = performance.now();
        const M = cfg.basketSegments, K = cfg.basketRings;
        const TH = cfg.basketThick, RIM = cfg.basketRim, Rt = RIM + 1.0;
        const prof = (s) => [RIM * s, zaruInnerY(cfg, RIM * s)];
        const pn = (s) => {
            const e = 2e-3, a = prof(Math.max(0, s - e)), b = prof(Math.min(1, s + e));
            const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
            return [-dy / l, dr / l];                      // 内側（上）向きの法線
        };
        const W = M + 1, LAY = (K + 1) * W;
        const positions = new Float32Array(LAY * 2 * 3), uvs = new Float32Array(LAY * 2 * 2);
        const ref = new Array(LAY * 2);
        for (let i = 0; i <= K; i++) {
            const s = i / K, pr = prof(s), nn = pn(s);
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * Math.PI * 2, cs = Math.cos(phi), sn = Math.sin(phi);
                const a = i * W + j, b = LAY + a;
                const ro = pr[0] - nn[0] * TH, yo = pr[1] - nn[1] * TH;
                positions.set([pr[0] * cs, pr[1], pr[0] * sn], a * 3);
                positions.set([ro * cs, yo, ro * sn], b * 3);
                uvs.set([pr[0] * cs / (2 * Rt) + 0.5, pr[0] * sn / (2 * Rt) + 0.5], a * 2);
                uvs.set([ro * cs / (2 * Rt) + 0.5, ro * sn / (2 * Rt) + 0.5], b * 2);
                ref[a] = [nn[0] * cs, nn[1], nn[0] * sn];
                ref[b] = [-nn[0] * cs, -nn[1], -nn[0] * sn];
            }
        }
        const indices = [];
        for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
            indices.push(LAY + A, LAY + B, LAY + C, LAY + B, LAY + D, LAY + C);
        }
        for (let j = 0; j < M; j++) {                     // 縁で内外を閉じる
            const o0 = K * W + j, o1 = o0 + 1;
            indices.push(o0, LAY + o0, o1, o1, LAY + o0, LAY + o1);
        }
        // 内面・外面のどちらも「器の外へ」向くかを個別に判定できるよう、
        // 層ごとに巻き順を確かめる（内面は上向き、外面は下向きが正）
        const bowl = orientedMesh("zaruBowl", positions, indices, uvs, (i) => ref[i], scene).mesh;

        const tex = ZaruLab.weave(scene, cfg.weaveTexture, cfg, 2718);
        const m = new BABYLON.PBRMaterial("zaruMat", scene);
        m.albedoTexture = tex.albedo;
        m.metallic = 0.0; m.roughness = 1.0;
        m.metallicTexture = tex.orm;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.bumpTexture = tex.normal;
        m.bumpTexture.level = 1.0;
        m.backFaceCulling = false;
        m.twoSidedLighting = true;
        bowl.material = m;
        bowl.receiveShadows = true;

        // 縁：竹の束をひごで巻いた輪
        const rim = ringTube("zaruRim", cfg, 0, Math.PI * 2, cfg.rimSegments, cfg.rimSides, null, scene);
        const rt = ZaruLab.rimWrap(scene, 512, 919);
        const rm = new BABYLON.PBRMaterial("zaruRimMat", scene);
        rm.albedoTexture = rt.albedo;
        rm.bumpTexture = rt.normal;
        rm.bumpTexture.level = 1.0;
        // 【対策】巻き数は 12 × uScale。継ぎ目が出ないよう整数倍にする
        for (const t of [rt.albedo, rt.normal]) { t.uScale = cfg.rimWrapRepeat; t.vScale = 1; }
        rm.metallic = 0.0; rm.roughness = 0.62;
        rim.material = rm;
        rim.receiveShadows = true;

        // 黄色い留め具：縁より少し太い帯。両端は縁へなじませる
        const tm = new BABYLON.PBRMaterial("zaruTieMat", scene);
        tm.albedoColor = new BABYLON.Color3(0.92, 0.77, 0.18).toLinearSpace();
        tm.metallic = 0.0; tm.roughness = 0.36;
        const ties = [];
        const rC = RIM + cfg.rimOffset, half = cfg.tieWidth * 0.5 / rC;
        for (let k = 0; k < cfg.tieCount; k++) {
            const a = cfg.tiePhase + k * Math.PI * 2 / cfg.tieCount;
            const t = ringTube("zaruTie" + k, cfg, a - half, a + half, 10, cfg.rimSides,
                (q) => 1 + 0.12 * smooth(0.0, 0.18, q) * smooth(1.0, 0.82, q), scene);
            t.material = tm;
            t.receiveShadows = true;
            ties.push(t);
        }
        console.log("[Zaru] bake =", (performance.now() - t0).toFixed(0) + "ms");
        return { bowl, rim, ties, parts: [bowl, rim].concat(ties) };
    }

    // =================================================================
    // 7. Scene / 物理（サツマイモ imo-D の投入・静止の仕組みを流用）
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.93, 0.93, 0.935, 1);

    let physics = false;
    try {
        const havok = await HavokPhysics();
        // 【対策】第1引数 false で固定ステップ。フレーム落ちでステップ幅が
        //         変わると接触が解けたり食い込んだりを繰り返して震える
        const hk = new BABYLON.HavokPlugin(false, havok);
        scene.enablePhysics(new V3(0, -GLOBAL.gravity, 0), hk);
        if (hk.setTimeStep) hk.setTimeStep(1 / GLOBAL.physicsHz);
        physics = true;
    } catch (err) {
        console.warn("[Kaki] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.62;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.00, 50, new V3(0, 2.5, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセス有効時は 16bit 深度。minZ が小さいと接した面が Z ファイティングする
    camera.minZ = 6;
    camera.maxZ = 300;
    camera.lowerRadiusLimit = 14;
    camera.upperRadiusLimit = 160;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = key.direction.scale(-70);
    key.intensity = 2.4;
    key.diffuse = new BABYLON.Color3(1.0, 0.98, 0.95);
    key.specular = new BABYLON.Color3(0.42, 0.40, 0.38);
    key.autoCalcShadowZBounds = true;
    // 【対策】影用フラスタムは固定（自動だとキャスターの範囲で切れ、
    //         地面に落ちるざるの影が直線で途切れる）
    key.shadowFrustumSize = (GLOBAL.basketRim + 2) * 2 * 1.5;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.0;
    fillL.diffuse = new BABYLON.Color3(0.98, 0.97, 1.0);
    fillL.specular = new BABYLON.Color3(0.16, 0.16, 0.16);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.55;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.72, 0.72);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】PCF ＋ 裏面だけ描画。ESM のにじみ・自己遮蔽を起こさない
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0006;
    sg.normalBias = 0.02;
    sg.darkness = 0.42;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.04;
    ip.contrast = 1.10;
    ip.vignetteEnabled = false;

    // 【対策】厚みゼロの床は当たり判定に使えないので箱。
    //         ざるの外面とのあいだに 0.8mm のすき間を作る（深度分解能の10倍）
    const ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 240, height: 2, depth: 240 }, scene);
    const gm = new BABYLON.PBRMaterial("groundMat", scene);
    gm.albedoColor = new BABYLON.Color3(0.91, 0.91, 0.915).toLinearSpace();
    gm.metallic = 0.0; gm.roughness = 0.90;
    ground.material = gm;
    ground.receiveShadows = true;
    ground.position.y = -1.08;
    if (physics) {
        new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
            { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
    }

    const zaru = buildZaru(scene, GLOBAL);
    if (physics) {
        for (const m of [zaru.bowl, zaru.rim]) {
            const s = new BABYLON.PhysicsShapeMesh(m, scene);
            s.material = { friction: 0.72, restitution: 0.0 };
            const b = new BABYLON.PhysicsBody(m, BABYLON.PhysicsMotionType.STATIC, false, scene);
            b.shape = s;
        }
    }

    // =================================================================
    //  生成と投入
    // =================================================================
    let items = [], curVariety = START_VARIETY, curSeed = START_SEED;
    const skinCache = {};
    let onRebuilt = null;
    let queue = [], dropIndex = 0, dropTimer = 0, settleTimer = 0, postDropTimer = 0, frozen = false;

    const BUMPS = [{ label: "弱", k: 0.5 }, { label: "中", k: 1.0 }, { label: "強", k: 1.7 }];
    let bumpIdx = 1, invY = false;
    function applyRelief() {
        for (const k in skinCache) {
            const s = skinCache[k];
            s.skin.bumpTexture.level = s.bumpBase * BUMPS[bumpIdx].k;
            s.skin.invertNormalMapY = invY;
            s.sepal.invertNormalMapY = invY;
        }
    }

    // 【対策】山全体の頂点を基準にすると外側へ置く物まで持ち上がり、
    //         縁の上から落ちてくる。水平方向に重なっている物だけを見る
    function localTopY(x, z, rh) {
        let top = zaruInnerY(GLOBAL, Math.hypot(x, z));
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

    // 【対策】全部を同時に生成すると、互いのめり込みが一気に解放されて
    //         弾け飛ぶ。1個ずつ、下にある物のすぐ上から放す
    function spawnNext() {
        const it = queue[dropIndex], e = it.e;
        e.root.setEnabled(true);
        e.root.position.set(it.x, 0, it.z);
        e.root.computeWorldMatrix(true);
        const b = e.worldBounds();
        const rh = Math.max(b.mxx - b.mnx, b.mxz - b.mnz) * 0.5;
        e.root.position.y = localTopY(it.x, it.z, rh) + GLOBAL.dropClearance - b.mny;
        e.root.computeWorldMatrix(true);

        const shape = e.hullShape();
        shape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
        const body = new BABYLON.PhysicsBody(e.root, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        body.shape = shape;
        body.setMassProperties({ mass: GLOBAL.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションでは効かない
        body.setLinearDamping(GLOBAL.linearDamping);
        body.setAngularDamping(GLOBAL.angularDamping);
        // 【対策】毎フレームのノード → 物理への書き戻しを止める（押し込みの往復が起きる）
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
            // 【対策】物理で動かすノードは rotationQuaternion を使う
            //         （Euler のままだと Havok 側の姿勢と食い違う）
            // 【対策】柿は扁平なので、大きく傾けて放すと隣に寄りかかったまま
            //         横倒しで止まりやすい。傾きは小さく、代わりに一部を
            //         逆さ（へたが下）にする（写真の奥の2個がそう）
            const flip = rng.next() < 0.35 ? Math.PI : 0;
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                flip + rng.gauss(0, 0.14), rng.range(0, Math.PI * 2), rng.gauss(0, 0.14));
            // 【対策】ランダムに散らすと投入位置が重なり、後の個体が前の個体の上に
            //         載って傾く。最大4個は輪に並べ、5個目以降は中央の上から
            const ring = Math.min(items.length, 4);
            const RING_R = [0, 0, 4.4, 4.8, 6.0][ring];
            let x = 0, z = 0;
            if (i < ring) {
                const a = a0 + i * Math.PI * 2 / ring;
                x = Math.cos(a) * RING_R + rng.range(-0.5, 0.5);
                z = Math.sin(a) * RING_R + rng.range(-0.5, 0.5);
            } else {
                x = rng.range(-1, 1); z = rng.range(-1, 1);
            }
            queue.push({ e, x, z, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            for (let i = 0; i < items.length; i++) {
                const a = a0 + i * Math.PI * 2 / items.length, r = items.length === 1 ? 0 : 5;
                items[i].root.position.set(Math.cos(a) * r, zaruInnerY(GLOBAL, r), Math.sin(a) * r);
            }
        }
        if (onRebuilt) onRebuilt();
    }

    function build(varietyKey, seed) {
        clearBodies();
        for (const it of items) { for (const m of it.parts) sg.removeShadowCaster(m); it.dispose(); }
        items = [];
        const cfg = buildConfig(varietyKey, seed);

        let skin = skinCache[varietyKey];
        if (!skin) { skin = new SkinFactory(scene, cfg); skinCache[varietyKey] = skin; }

        for (let i = 0; i < GLOBAL.count; i++) {
            items.push(new Kaki(scene, cfg, (cfg.seed + i * 7919) >>> 0, skin));
        }
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);

        applyRelief();
        resetDrop(seed);
        console.log("[Kaki]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", GLOBAL.count, "個 / bake =", skin.bakeMs.toFixed(0) + "ms");
    }

    for (const m of zaru.parts) sg.addShadowCaster(m, true);
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
        ssao.radius = 1.1;
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
    dp.bloomWeight = 0.06;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.16;
    // 【対策】focalLength を focusDistance の一定比率にすると、寄っても引いてもボケ量が変わらない
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
    // 8. GUI（imo-D と同じ構成。専用カメラ＋Inspector 用の基準カメラ固定）
    // =================================================================
    const GUI_MASK = 0x20000000;

    function bindDebugCamera(scene, mainCam) {
        // (1) UtilityLayerRenderer（Physics Helper / ギズモ）
        const ULR = BABYLON.UtilityLayerRenderer;
        if (ULR) {
            if (!ULR.prototype.__foodCamPatch) {
                ULR.__foodCamTable = new WeakMap();
                const orig = ULR.prototype.getRenderCamera;
                ULR.prototype.getRenderCamera = function (getRigParentIfPossible) {
                    if (!this._renderCamera) {
                        const cam = ULR.__foodCamTable.get(this.originalScene);
                        if (cam) return (getRigParentIfPossible && cam.isRigCamera) ? cam.rigParent : cam;
                    }
                    return orig.call(this, getRigParentIfPossible);
                };
                ULR.prototype.__foodCamPatch = true;
            }
            ULR.__foodCamTable.set(scene, mainCam);
        }
        // (2) EffectLayer（選択のアウトライン）
        scene.onBeforeRenderObservable.add(() => {
            const ls = scene.effectLayers;
            if (!ls) return;
            for (let i = 0; i < ls.length; i++) {
                const l = ls[i];
                if (l.__foodCamBound) continue;
                l.__foodCamBound = true;
                if (l._effectLayerOptions) l._effectLayerOptions.camera = mainCam;
                if (l._mainTexture) l._mainTexture.activeCamera = mainCam;
            }
        });
        // (3)(4) scene.activeCamera（Picker）
        scene.onAfterRenderObservable.add(() => {
            if (scene.activeCamera !== mainCam) scene.activeCamera = mainCam;
        });
        scene.onPrePointerObservable.add(() => {
            if (scene.activeCamera !== mainCam) scene.activeCamera = mainCam;
        });
    }

    if (GLOBAL.guiOwnCamera) {
        const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
        guiCam.layerMask = GUI_MASK;
        scene.activeCameras = [camera, guiCam];
        bindDebugCamera(scene, camera);
    } else {
        scene.activeCameras = [camera];
    }
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer && GLOBAL.guiOwnCamera) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#2b1c12", active: "#b4561a", edge: "#4a3222",
        text: "#f7ece2", sub: "#c4ab95", accent: "#f0a05c"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(20,12,8,0.84)";
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

    addLabel("KAKI", 11, COL.sub, "18px");
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
    for (const c of [1, 3, 5]) {
        countBtns[c] = addButton("c" + c, c + " 個", () => {
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
    const bumpBtn = addButton("bump", "皮の凹凸: 中", () => {
        bumpIdx = (bumpIdx + 1) % BUMPS.length;
        applyRelief();
        bumpBtn.textBlock.text = "皮の凹凸: " + BUMPS[bumpIdx].label;
    });
    const invBtn = addButton("inv", "凹凸の向き: 標準", () => {
        invY = !invY;
        applyRelief();
        invBtn.background = invY ? COL.active : COL.idle;
        invBtn.textBlock.text = "凹凸の向き: " + (invY ? "反転" : "標準");
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

    const info = addLabel("", 12, COL.sub, "44px");
    onRebuilt = () => {
        const e = items[0];
        if (!e) { info.text = ""; return; }
        const state = !physics ? "物理なし"
            : (dropIndex < queue.length ? "投入中 " + dropIndex + "/" + queue.length
                : (frozen ? "静止" : "落下中"));
        info.text = state + " / " + items.length + "個 / 径 " + (e.R * 2).toFixed(1)
            + "cm\nseed: " + curSeed + "  [" + BUILD + "]";
    };
    onRebuilt();

    // ---- GUI の開閉（スマホでは初期状態で畳む。開いたら DPR ぶん拡大）---
    function viewportCss() {
        const c = engine.getRenderingCanvas();
        return {
            w: (c && c.clientWidth) || (typeof window !== "undefined" ? window.innerWidth : 0) || 1024,
            h: (c && c.clientHeight) || (typeof window !== "undefined" ? window.innerHeight : 0) || 768
        };
    }
    function isCompact() {
        const v = viewportCss();
        return v.w < GLOBAL.compactWidth || Math.min(v.w, v.h) < GLOBAL.compactMinSide;
    }

    const toggleBtn = BABYLON.GUI.Button.CreateSimpleButton("guiToggle", "≡");
    toggleBtn.width = "38px"; toggleBtn.height = "38px";
    toggleBtn.cornerRadius = 10; toggleBtn.thickness = 1;
    toggleBtn.color = COL.edge;
    toggleBtn.background = "rgba(20,12,8,0.84)";
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
        if (toggleBtn.textBlock) toggleBtn.textBlock.text = panelOpen ? "×" : "≡";
        toggleBtn.background = panelOpen ? COL.active : "rgba(20,12,8,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;