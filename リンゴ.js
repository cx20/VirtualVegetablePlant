// =====================================================================
//  Photoreal Apple  /  写実的なリンゴ（調整版）
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  今回の調整点:
//    A. 光沢: クリアコートが「鏡」になっていた原因を修正
//       ・clearCoat の intensity / roughness はテクスチャ値と「乗算」される。
//         roughness 0.26 × ORM相当の G(0.2〜0.6) → 実効 0.05〜0.16 で
//         ほぼ完全鏡面になり、環境（建物）が映り込んでガラスに見えていた
//       ・基材の roughness も上げ、環境反射自体を LOD でぼかす
//       ・ライトの specular を落とし、ブルーム / コントラストも抑える
//    B. 色: 日焼けに下限を持たせて全周にうっすら赤を回す（参考写真のふじ）
//       梗あの奥だけは赤を落として暗く・粗くする
//    C. 果梗: 折れ線になっていた曲がりを全長に分散し、太さと接続を修正
//       ・肩を越えた直後に一気に倒れて以降まっすぐ → 肘のような形だった
//       ・付け根を梗あの内壁半径でクランプし、少し埋めて接続を隠す
//       ・先端を丸め、縦の稜と色ムラを追加
//
//  実物の要点（ここを外すと「赤い球」になる）:
//    ・断面は円ではなく5裂。がく側ほど稜が立ち、赤道ではほぼ円に戻る
//    ・上下にくぼみがある。梗あ（軸のくぼみ）は深く、がくあ（萼のくぼみ）は浅い
//    ・最大径は中央ではなく高さの55%付近（肩が張る）
//    ・左右非対称。完全な回転体にすると作り物に見える
//    ・色は一様な赤ではない。地色の上に日焼けの赤、その上に縦の条紋が乗る
//    ・果点（レンチセル）という淡い斑点が全面にある。これが最大の質感要素
//    ・表面はロウ質だが「鏡」ではない。擦れてムラのある半光沢
// =====================================================================

var createScene = function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const PRESETS = {
        // ふじ: 地色は黄緑、日焼けの赤に縦の条紋がはっきり出る
        fuji: {
            label: "ふじ",
            radius: 4.05, height: 7.55,
            lobeAmp: 0.040, asymmetry: 0.030,
            ground: [0.62, 0.58, 0.20],       // 地色（sRGB相当）
            blush: [0.62, 0.10, 0.075],       // 日焼けの赤
            stripe: [0.44, 0.05, 0.05],       // 条紋
            // blushFloor: 陽の当たらない側に残す赤の下限。0だと半分が地色のまま
            blushAmount: 0.92, blushFloor: 0.44, blushSpread: 0.85, stripeAmount: 0.42,
            lenticel: [0.82, 0.78, 0.62], lenticelCount: 1500,
            russetAmount: 0.60,
            skinRoughness: 0.46, waxIntensity: 0.85
        },
        // 王林: 黄緑一色。日焼けはほぼ無く、果点が大きく目立つ
        orin: {
            label: "王林",
            radius: 4.00, height: 7.70,
            lobeAmp: 0.034, asymmetry: 0.026,
            ground: [0.69, 0.70, 0.28],
            blush: [0.66, 0.60, 0.24],
            stripe: [0.60, 0.56, 0.22],
            blushAmount: 0.16, blushFloor: 0.10, blushSpread: 1.4, stripeAmount: 0.08,
            lenticel: [0.82, 0.80, 0.62], lenticelCount: 1900,
            russetAmount: 0.80,
            skinRoughness: 0.52, waxIntensity: 0.58
        },
        // 紅玉: 濃い赤一色。縦長で5裂が強く、がく側が張る
        jonathan: {
            label: "紅玉",
            radius: 3.75, height: 7.90,
            lobeAmp: 0.058, asymmetry: 0.034,
            ground: [0.58, 0.50, 0.16],
            blush: [0.45, 0.048, 0.050],
            stripe: [0.30, 0.030, 0.038],
            blushAmount: 1.0, blushFloor: 0.60, blushSpread: 1.5, stripeAmount: 0.22,
            lenticel: [0.74, 0.68, 0.56], lenticelCount: 1600,
            russetAmount: 0.40,
            skinRoughness: 0.42, waxIntensity: 0.92
        }
    };

    const GLOBAL = {
        // --- 分割
        segmentsMeridian: 150,
        segmentsRound: 80,
        lobeCount: 5,
        // --- 果梗
        stemLength: 2.15,
        stemRadius: 0.195,
        stemTiltDeg: 17,
        stemSegments: 36,
        stemSides: 16,
        // --- テクスチャ
        textureSize: 512,
        skinDetail: 1.0,
        // --- 描画
        useSSAO: true,
        showGround: true
    };

    const START_VARIETY = "fuji";
    const START_SEED = 20260725;

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        return cfg;
    }

    const V3 = BABYLON.Vector3;

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
        gauss(mean, sd) {
            const u = Math.max(1e-9, this.next()), v = this.next();
            return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        }
        int(n) { return Math.floor(this.next() * n) % n; }
    }

    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;

    // =================================================================
    // 2. Geo : リング列から掃引メッシュを作る
    // =================================================================
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
            const facesToward = (ia, ib, ic, dx, dy, dz) => {
                const ax = positions[ia*3], ay = positions[ia*3+1], az = positions[ia*3+2];
                const e1x = positions[ib*3]-ax, e1y = positions[ib*3+1]-ay, e1z = positions[ib*3+2]-az;
                const e2x = positions[ic*3]-ax, e2y = positions[ic*3+1]-ay, e2z = positions[ic*3+2]-az;
                const nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
                return nx*dx + ny*dy + nz*dz > 0;
            };

            let indices = sideIndices(false);
            let normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);

            // 側面が外向きか。リングの半径がいちばん大きい行で判定する
            let mi = Math.floor(N / 2), best = -1;
            for (let i = 1; i < N - 1; i++) {
                const d = Math.hypot(rings[i][0].x - centers[i].x, rings[i][0].z - centers[i].z);
                if (d > best) { best = d; mi = i; }
            }
            const mj = Math.floor(M / 4);
            const vi = mi * M + mj, cc = centers[mi];
            const ox = positions[vi*3] - cc.x, oy = positions[vi*3+1] - cc.y, oz = positions[vi*3+2] - cc.z;
            const dot = ox * normals[vi*3] + oy * normals[vi*3+1] + oz * normals[vi*3+2];
            if (dot < 0) indices = sideIndices(true);

            // 【対策】キャップの巻き順は側面の flip と一致しない。同じフラグを
            //         流用すると、側面が正しいときキャップが裏返って穴に見える。
            if (capStart) {
                const b = { x: centers[0].x - centers[1].x, y: centers[0].y - centers[1].y, z: centers[0].z - centers[1].z };
                const okOrder = facesToward(capA, 0, 1, b.x, b.y, b.z);
                for (let j = 0; j < M - 1; j++) {
                    if (okOrder) indices.push(capA, j, j + 1); else indices.push(capA, j + 1, j);
                }
            }
            if (capEnd) {
                const o = (N - 1) * M;
                const f = { x: centers[N-1].x - centers[N-2].x, y: centers[N-1].y - centers[N-2].y, z: centers[N-1].z - centers[N-2].z };
                const okOrder = facesToward(capB, o, o + 1, f.x, f.y, f.z);
                for (let j = 0; j < M - 1; j++) {
                    if (okOrder) indices.push(capB, o + j, o + j + 1); else indices.push(capB, o + j + 1, o + j);
                }
            }
            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);

            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = positions; vd.indices = indices;
            vd.normals = normals; vd.uvs = uvs;
            vd.applyToMesh(mesh, false);
            return mesh;
        },

        ring(center, outer, side, M, radiusOf) {
            const pts = [];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * Math.PI * 2;
                const rr = radiusOf(phi);
                const a = j / M * Math.PI * 2;
                const ca = Math.cos(a), sa = Math.sin(a);
                pts.push(new V3(
                    center.x + (outer.x * ca + side.x * sa) * rr,
                    center.y + (outer.y * ca + side.y * sa) * rr,
                    center.z + (outer.z * ca + side.z * sa) * rr
                ));
            }
            return pts;
        }
    };

    // =================================================================
    // 3. Profile : 子午線と断面
    // =================================================================
    const MERIDIAN = [
        [0.000, 0.845], [0.048, 0.850], [0.105, 0.872], [0.170, 0.908],
        [0.245, 0.940], [0.360, 0.955], [0.510, 0.945], [0.670, 0.910],
        [0.820, 0.850], [0.930, 0.762], [0.988, 0.658], [1.000, 0.545],
        [0.975, 0.430], [0.905, 0.315], [0.795, 0.205], [0.650, 0.115],
        [0.480, 0.053], [0.350, 0.027], [0.245, 0.032], [0.145, 0.051],
        [0.052, 0.065], [0.000, 0.069]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }

    function meridianAt(v) {
        const P = MERIDIAN, n = P.length;
        const f = clamp(v, 0, 1) * (n - 1);
        const i = Math.min(n - 2, Math.floor(f));
        const t = f - i;
        const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(n - 1, i + 2)];
        return {
            r: catmull(a[0], b[0], c[0], d[0], t),
            y: catmull(a[1], b[1], c[1], d[1], t)
        };
    }

    function lobeAt(phi, yn, cfg) {
        const amp = cfg.lobeAmp * (0.10
            + 0.90 * smooth(0.42, 0.06, yn)      // がく側で最大
            + 0.30 * smooth(0.72, 0.95, yn));    // 肩でわずかに張る
        return 1 + amp * Math.cos(cfg.lobeCount * phi);
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
        _canvasTexture(name, size, fill, scene) {
            const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(size, size);
            fill(img.data, size);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            return dt;
        },

        // ---- 果点（レンチセル）------------------------------------------
        lenticelMask(size, seed, cfg) {
            const m = new Float32Array(size * size);
            const r = new Rng(seed);
            const n = cfg.lenticelCount;
            for (let k = 0; k < n; k++) {
                const u = r.next();
                const v = clamp(r.range(0.10, 0.94) + r.gauss(0, 0.03), 0.06, 0.96);
                const shrink = 0.35 + 0.65 * Math.sin(Math.PI * v);
                const rad = r.range(0.0009, 0.0024) * size * shrink;
                const rx = Math.max(0.8, rad), ry = Math.max(0.8, rad * r.range(0.9, 1.3));
                const cx = u * size, cy = v * size;
                const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
                const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(size - 1, Math.ceil(cy + ry));
                for (let y = y0; y <= y1; y++) {
                    const dy = (y - cy) / ry;
                    for (let x = x0; x <= x1; x++) {
                        const dx = (x - cx) / rx;
                        const d = Math.hypot(dx, dy);
                        if (d >= 1) continue;
                        const w = Math.pow(1 - d, 0.7);
                        const xw = ((x % size) + size) % size;
                        const i = y * size + xw;
                        if (w > m[i]) m[i] = w;
                    }
                }
            }
            return m;
        },

        // ---- 日焼け（片側だけ赤い）と条紋 --------------------------------
        blushAt(u, v, cfg, seed) {
            let du = Math.abs(u - 0.5);
            du = Math.min(du, 1 - du) * 2;                       // 0(正面)..1(裏)
            // 【対策】falloff を 0 まで落とすと裏側が地色のままで、緑のリンゴに
            //         見える。実物は日陰側も薄く色づく。下限（blushFloor）を持たせる
            const angular = cfg.blushFloor
                + (1 - cfg.blushFloor) * Math.pow(1 - du, cfg.blushSpread);
            // 梗あの奥は光が当たらないので赤が乗らない。ここを赤くすると
            // くぼみが光って「穴の空いた作り物」に見える
            const wellCut = 1 - 0.78 * smooth(0.11, 0.0, v);
            const vertical = (0.80 + 0.20 * smooth(0.99, 0.30, v)) * wellCut;
            // 境界を滑らかなグラデーションにするとエアブラシに見える。
            // 2段のノイズで縁を崩す
            const cloud = this.fbm(u * 6, v * 4, 6, seed, 3);
            const grain = this.fbm(u * 19, v * 13, 19, seed + 5, 2);
            return clamp(cfg.blushAmount * angular * vertical
                * (0.48 + 0.95 * cloud) * (0.82 + 0.36 * grain), 0, 1);
        },
        stripeAt(u, v, cfg, seed) {
            const a = this.fbm(u * 96, v * 3.0, 96, seed, 2);
            const patch = this.fbm(u * 5, v * 4, 5, seed + 7, 2);
            return smooth(0.50, 0.70, a) * smooth(0.35, 0.62, patch);
        },

        albedo(scene, size, cfg, lent, seed) {
            const G = cfg.ground, B = cfg.blush, S = cfg.stripe, L = cfg.lenticel;
            const RUSSET = [0.40, 0.31, 0.19];
            const CALYX = [0.20, 0.16, 0.11];
            const WELL = [0.30, 0.22, 0.13];
            return this._canvasTexture("appleAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const wellK = smooth(0.14, 0.0, v);             // 梗あの奥
                    const calyxK = smooth(0.93, 1.0, v);            // がくあ
                    const russetBand = smooth(0.26, 0.02, v) * cfg.russetAmount;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let cr = G[0], cg = G[1], cb = G[2];
                        const mott = 0.92 + 0.16 * this.fbm(u * 9, v * 6, 9, seed + 3, 2);
                        cr *= mott; cg *= mott; cb *= mott;
                        // 日焼け → その上に条紋
                        const bl = this.blushAt(u, v, cfg, seed + 11);
                        cr = mix(cr, B[0], bl); cg = mix(cg, B[1], bl); cb = mix(cb, B[2], bl);
                        const st = this.stripeAt(u, v, cfg, seed + 23) * cfg.stripeAmount * clamp(bl * 1.4, 0, 1);
                        cr = mix(cr, S[0], st); cg = mix(cg, S[1], st); cb = mix(cb, S[2], st);
                        // サビ（梗あ周辺のコルク化）
                        const rs = russetBand * smooth(0.45, 0.80, this.fbm(u * 16, v * 14, 16, seed + 31, 3));
                        cr = mix(cr, RUSSET[0], rs); cg = mix(cg, RUSSET[1], rs); cb = mix(cb, RUSSET[2], rs);
                        // 果点：赤い面では明るく、地色の面ではごく淡く
                        const lw = smooth(0.15, 0.85, lent[y * N + x]) * (0.35 + 0.65 * bl);
                        cr = mix(cr, L[0], lw * 0.85); cg = mix(cg, L[1], lw * 0.85); cb = mix(cb, L[2], lw * 0.85);
                        // 梗あの奥と、がくの星形
                        if (wellK > 0) { cr = mix(cr, WELL[0], wellK); cg = mix(cg, WELL[1], wellK); cb = mix(cb, WELL[2], wellK); }
                        if (calyxK > 0) {
                            const star = smooth(-0.1, 0.6, Math.cos(cfg.lobeCount * u * Math.PI * 2));
                            const w = calyxK * (0.35 + 0.65 * star);
                            cr = mix(cr, CALYX[0], w); cg = mix(cg, CALYX[1], w); cb = mix(cb, CALYX[2], w);
                        }
                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // ロウ層のムラ。R=強度 / G=粗さ
        // 【対策】clearCoat.texture の R/G はマテリアル側の intensity / roughness と
        //         「乗算」される。ここを小さく作ると実効 roughness が 0.1 を割り、
        //         環境の建物まで鏡像で映り込んでガラス玉になる。
        //         実物のロウは擦れてムラがあり、半光沢どまり。
        wax(scene, size, cfg, seed) {
            return this._canvasTexture("appleWax", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const dull = Math.max(smooth(0.22, 0.02, v), smooth(0.90, 1.0, v));
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const smudge = this.fbm(u * 6, v * 5, 6, seed, 3);
                        const fine = this.fbm(u * 22, v * 18, 22, seed + 9, 2);
                        let inten = (0.55 + 0.35 * smudge) * (1 - 0.70 * dull);
                        let rough = 0.42 + 0.24 * (1 - smudge) + 0.12 * fine + 0.26 * dull;
                        d[i] = clamp(inten, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        orm(scene, size, cfg, lent, seed) {
            return this._canvasTexture("appleORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const wellK = smooth(0.14, 0.0, v);
                    const calyxK = smooth(0.92, 1.0, v);
                    const russetBand = smooth(0.20, 0.05, v) * cfg.russetAmount;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let rough = cfg.skinRoughness * (0.9 + 0.25 * this.fbm(u * 12, v * 9, 12, seed + 5, 2));
                        let ao = 1.0;
                        const rs = russetBand * smooth(0.45, 0.80, this.fbm(u * 16, v * 14, 16, seed + 31, 3));
                        rough = mix(rough, 0.82, rs);
                        // 果点はワックスが乗らないので、わずかに粗い
                        rough = mix(rough, clamp(rough + 0.18, 0, 1), smooth(0.2, 0.9, lent[y * N + x]));
                        // 【対策】梗あ / がくあが滑らかなままだと、くぼみの底だけ
                        //         ぬらりと光って樹脂に見える。ここは明確に粗くする
                        rough = mix(rough, 0.88, wellK);
                        rough = mix(rough, 0.86, calyxK);
                        // くぼみは光が回り込まない
                        ao = mix(ao, 0.38, wellK);
                        ao = mix(ao, 0.50, calyxK);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.04, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // 【対策】ブドウ・バナナと同じ罠。低周波を強く入れると萎びて見える。
        //         果点のわずかな隆起と、ごく細かい肌理だけ。
        //         ただしこの微細な法線ゆらぎが鏡面反射を割ってくれるので、
        //         ガラス感を消す意味でも level を上げておく（SkinFactory 側）
        normal(scene, size, cfg, lent, seed, detail) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    const skin = this.fbm(u * 70, v * 55, 70, seed, 2) * 0.60;
                    const micro = this.fbm(u * 150, v * 120, 150, seed + 61, 2) * 0.22;
                    const russet = this.fbm(u * 26, v * 22, 26, seed + 31, 2)
                        * smooth(0.20, 0.05, v) * cfg.russetAmount * 0.9;
                    h[y * size + x] = skin + micro + russet + lent[y * size + x] * 0.35;
                }
            }
            return this._canvasTexture("appleNormal", size, (d, N) => {
                const strength = 0.90 * (detail === undefined ? 1 : detail);
                for (let y = 0; y < N; y++) {
                    const vv = y / N;
                    const poleFade = smooth(0, 0.10, vv) * (1 - smooth(0.90, 1.0, vv));
                    const k = strength * poleFade;
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
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
        },

        // 果梗用の法線。果皮のマップを流用すると密度が合わないので別に焼く
        stemNormal(scene, size, seed) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    // 縦に長く伸びた繊維
                    h[y * size + x] = this.fbm(u * 40, v * 6, 40, seed, 3) * 0.8
                        + this.fbm(u * 90, v * 60, 90, seed + 17, 2) * 0.25;
                }
            }
            return this._canvasTexture("stemNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * 2.2, ny = (yu - yd) * 2.2, nz = 1;
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
    //  SkinFactory : 品種ごとのマテリアル（キャッシュ対象）
    // =================================================================
    class SkinFactory {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const lent = TextureLab.lenticelMask(S, 3301, cfg);
            let n = 0;
            for (let i = 0; i < lent.length; i++) if (lent[i] > 0.2) n++;
            this.lenticelCoverage = n / lent.length;

            this.albedoTex = TextureLab.albedo(scene, S, cfg, lent, 77);
            this.ormTex = TextureLab.orm(scene, S, cfg, lent, 77);
            this.normalTex = TextureLab.normal(scene, S, cfg, lent, 909, cfg.skinDetail);
            this.waxTex = TextureLab.wax(scene, S, cfg, 512);
            this.stemNormalTex = TextureLab.stemNormal(scene, 256, 4242);

            const pbr = new BABYLON.PBRMaterial("appleSkin", scene);
            pbr.albedoTexture = this.albedoTex;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;                    // 実値はORMのGチャンネル
            pbr.metallicTexture = this.ormTex;
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            pbr.bumpTexture.level = 0.70;           // 微細な法線ゆらぎが鏡面を割る
            // 【対策】リンゴはロウ質だが「鏡」ではない。
            //         intensity / roughness はテクスチャの R / G と乗算されるので、
            //         roughness をテクスチャ側の値ぶん見込んで高めに設定する。
            //         実効 roughness ≒ 0.70 × 0.42〜0.95 = 0.29〜0.66
            pbr.clearCoat.isEnabled = true;
            pbr.clearCoat.intensity = 0.45 * cfg.waxIntensity;
            pbr.clearCoat.roughness = 0.70;
            pbr.clearCoat.texture = this.waxTex;      // R=強度 / G=粗さ
            pbr.clearCoat.useRoughnessFromMainTexture = true;
            pbr.clearCoat.indexOfRefraction = 1.36;
            // 果肉のごく弱い透過（縁で効く）
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(0.55, 0.30, 0.20);
            pbr.subSurface.translucencyIntensity = 0.14;
            pbr.subSurface.minimumThickness = 0.5;
            pbr.subSurface.maximumThickness = 3.0;
            this.skin = pbr;

            const stem = new BABYLON.PBRMaterial("appleStem", scene);
            stem.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            stem.metallic = 0.0;
            stem.roughness = 0.92;                            // 木質。光らせない
            stem.bumpTexture = this.stemNormalTex;
            stem.bumpTexture.level = 0.8;
            this.stem = stem;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.stem.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose();
            this.normalTex.dispose(); this.waxTex.dispose();
            this.stemNormalTex.dispose();
        }
    }

    // =================================================================
    // 5. Apple
    // =================================================================
    class Apple {
        constructor(scene, cfg, seed, skin) {
            this.scene = scene; this.cfg = cfg;
            const rng = new Rng(seed);
            this.rng = rng;
            this.R = cfg.radius * rng.range(0.94, 1.06);
            this.H = cfg.height * rng.range(0.94, 1.06);
            this.asymPhase = rng.range(0, Math.PI * 2);
            this.asym = cfg.asymmetry * rng.range(0.6, 1.4);
            this.d2 = cfg.asymmetry * rng.range(0.30, 0.60);
            this.d3 = cfg.asymmetry * rng.range(0.18, 0.40);
            this.p2 = rng.range(0, Math.PI * 2);
            this.p3 = rng.range(0, Math.PI * 2);
            this.tilt = rng.gauss(0, 0.022);          // 軸のわずかな傾き
            this.tiltDir = rng.range(0, Math.PI * 2);
            this.parts = [];
            this._buildBody(skin);
            this._buildStem(skin);
            this.root = new BABYLON.TransformNode("apple", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        centerAt(yn) {
            const k = this.tilt * this.H * (yn - 0.5);
            return new V3(Math.cos(this.tiltDir) * k, yn * this.H, Math.sin(this.tiltDir) * k);
        }

        radiusAt(v, phi) {
            const m = meridianAt(v);
            let r = m.r * this.R * lobeAt(phi, m.y, this.cfg);
            const dent =
                this.asym * Math.cos(phi - this.asymPhase) * (0.35 + 0.65 * Math.sin(Math.PI * m.y))
                + this.d2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * m.y * 1.3)
                + this.d3 * Math.cos(3 * phi - this.p3) * Math.sin(Math.PI * m.y * 0.8);
            r *= 1 + dent;
            return r;
        }

        // 梗あ（軸のくぼみ）の内壁半径。肩より上なら Infinity
        // 【対策】果梗の太さをこれでクランプしないと、付け根がくぼみの壁を
        //         突き抜けて「刺さっている」ように見える
        cavityRadiusAt(y) {
            const P = this.meridian;
            for (let i = 1; i < P.length; i++) {
                if (P[i].y < P[i - 1].y) break;              // 肩を越えたら終わり
                if (y >= P[i - 1].y && y <= P[i].y) {
                    const t = (y - P[i - 1].y) / Math.max(1e-6, P[i].y - P[i - 1].y);
                    return mix(P[i - 1].r, P[i].r, t);
                }
            }
            return Infinity;
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsMeridian, M = cfg.segmentsRound;
            const rings = [], centers = [];
            this.meridian = [];
            for (let i = 0; i <= N; i++) {
                const v = i / N;
                const m = meridianAt(v);
                const c = this.centerAt(m.y);
                rings.push(Geo.ring(c, new V3(1, 0, 0), new V3(0, 0, 1), M,
                    (phi) => Math.max(0.004, this.radiusAt(v, phi))));
                centers.push(c);
                this.meridian.push({ v, r: m.r * this.R, y: m.y * this.H, c });
            }
            const mesh = Geo.build("appleBody", rings, centers, true, true, this.scene);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
            this.rings = rings;
            this.centers = centers;
        }

        // 果梗：梗あの底から立ち上がり、全長にわたってゆるく曲がる
        _buildStem(skin) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const base = this.centerAt(meridianAt(0).y);
            const rimY = this.shoulderY();

            const L = cfg.stemLength * rng.range(0.85, 1.15);
            // 【対策】くぼみの頂点はメッシュ上は1点なので、そこから生やすと
            //         付け根に隙間が見える。少し埋めた位置から始める
            const sink = cfg.stemRadius * 1.8;
            const y0 = base.y - sink;
            const Ltot = L + sink;
            // 梗あの縁までは真っ直ぐ立てる（壁を突き抜けさせない）
            const clear = clamp((rimY - y0) / Ltot, 0, 0.7);

            const tiltA = rng.range(0, Math.PI * 2);
            const tilt = cfg.stemTiltDeg * Math.PI / 180 * rng.range(0.7, 1.35);
            const bendA = tiltA + rng.range(-1.4, 1.4);       // 二次的な曲がり
            const bend = tilt * rng.range(0.20, 0.50);
            const wobPhase = rng.range(0, Math.PI * 2);
            const wobAmp = cfg.stemRadius * rng.range(0.10, 0.30);

            const rings = [], centers = [];
            for (let k = 0; k <= K; k++) {
                const s = k / K;
                const y = y0 + Ltot * s;

                // 【対策】旧版は「肩を越えてから smoothstep で一気に倒す」ため、
                //         倒しきった後がまっすぐになり、肘のような折れ線になっていた。
                //         片持ち梁のたわみ（t²）で曲率を全長に配分すると、
                //         接線が連続したまま先端まで曲がり続ける
                const t = clamp((s - clear) / Math.max(1e-3, 1 - clear), 0, 1);
                const lean = Math.tan(tilt) * Ltot * 0.80 * t * t;
                const lean2 = Math.tan(bend) * Ltot * 0.35 * t * t * t;
                const wob = wobAmp * Math.sin(s * 5.5 + wobPhase) * t;

                const c = new V3(
                    base.x + Math.cos(tiltA) * lean + Math.cos(bendA) * (lean2 + wob),
                    y,
                    base.z + Math.sin(tiltA) * lean + Math.sin(bendA) * (lean2 + wob)
                );

                // 太さ：根元がやや太く、中間は細く、先端（切り口）でわずかに膨らむ
                const taper = 0.72 + 0.40 * Math.pow(1 - s, 2.4);
                const tip = 0.28 * smooth(0.80, 0.97, s);
                let rr = cfg.stemRadius * (taper + tip);
                // 梗あの内壁でクランプ（壁を突き抜けない）
                const cav = this.cavityRadiusAt(y);
                if (isFinite(cav)) rr = Math.min(rr, Math.max(cfg.stemRadius * 0.55, cav * 0.85));
                // 先端を丸める
                rr *= 1 - 0.82 * Math.pow(smooth(0.955, 1.0, s), 1.4);

                rings.push(Geo.ring(c, new V3(1, 0, 0), new V3(0, 0, 1), M, (phi) =>
                    Math.max(0.012, rr * (1
                        + 0.055 * Math.cos(3 * phi + s * 1.7)
                        + 0.030 * Math.cos(7 * phi + 1.1)))));
                centers.push(c);
            }

            const mesh = Geo.build("appleStem", rings, centers, false, true, this.scene);
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const uv = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            const col = new Float32Array((pos.length / 3) * 4);
            // 付け根は暗く、中程が明るく、切り口はまた暗い
            const root = new BABYLON.Color3(0.22, 0.17, 0.10).toLinearSpace();
            const mid = new BABYLON.Color3(0.44, 0.35, 0.20).toLinearSpace();
            const cut = new BABYLON.Color3(0.28, 0.21, 0.13).toLinearSpace();
            for (let i = 0, c = 0; i < pos.length / 3; i++, c += 4) {
                const t = uv ? uv[i * 2 + 1] : 0;
                const u = uv ? uv[i * 2] : 0;
                const w1 = smooth(0.05, 0.55, t);
                const w2 = smooth(0.80, 1.0, t);
                // 縦筋のわずかな色ムラ
                const g = 0.90 + 0.20 * TextureLab.fbm(u * 12, t * 4, 12, 771, 2);
                col[c] = mix(mix(root.r, mid.r, w1), cut.r, w2) * g;
                col[c + 1] = mix(mix(root.g, mid.g, w1), cut.g, w2) * g;
                col[c + 2] = mix(mix(root.b, mid.b, w1), cut.b, w2) * g;
                col[c + 3] = 1;
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
            mesh.hasVertexAlpha = false;
            mesh.material = skin.stem;
            mesh.receiveShadows = true;
            this.stem = mesh;
            this.stemBase = base;
            this.stemRings = rings;
            this.stemCenters = centers;
            this.parts.push(mesh);
        }

        // 肩（梗あの縁）の高さ
        shoulderY() {
            let best = -Infinity;
            for (let i = 0; i <= 60; i++) {
                const y = meridianAt(i / 60 * 0.4).y * this.H;
                if (y > best) best = y;
            }
            return best;
        }

        bounds() {
            let o = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
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
    // 6. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.05, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    // 【対策】環境マップが鮮明なままだと、建物の輪郭がそのまま映り込んで
    //         ガラス玉に見える。参照するミップを1段ぼかす
    env.lodGenerationOffset = 0.55;
    scene.environmentIntensity = 0.62;
    scene.createDefaultSkybox(env, true, 1000, 0.70, false);

    const camera = new BABYLON.ArcRotateCamera("cam", -1.05, 1.25, 26, new V3(0, 0, 0), scene);
    camera.attachControl(true);
    camera.wheelPrecision = 12;
    camera.minZ = 0.05;
    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 120;
    scene.cameraToUseForPointers = camera;

    // 【対策】平行光源のハイライトは点になる。強いままだと「鏡に映った電球」
    //         にしか見えないので、specular を落として拡散側で明るさを稼ぐ
    const key = new BABYLON.DirectionalLight("key", new V3(-0.55, -0.95, 0.45).normalize(), scene);
    key.position = new V3(14, 24, -12);
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.97, 0.92);
    key.specular = new BABYLON.Color3(0.35, 0.34, 0.32);
    key.autoCalcShadowZBounds = true;

    const rim = new BABYLON.DirectionalLight("rim", new V3(0.5, -0.3, -1.0).normalize(), scene);
    rim.intensity = 1.5;
    rim.diffuse = new BABYLON.Color3(1.0, 0.92, 0.86);
    rim.specular = new BABYLON.Color3(0.22, 0.21, 0.20);

    const fill = new BABYLON.HemisphericLight("fill", new V3(0, 1, 0), scene);
    fill.intensity = 0.16;
    fill.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(1024, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.bias = 0.003;
    sg.normalBias = 0.02;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 1.14;                 // 上げすぎるとハイライトが白飛びして硬く見える
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.5;
    ip.vignetteCameraFov = 0.7;
    ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    let ground = null;
    function ensureGround(y) {
        if (!GLOBAL.showGround) return;
        if (!ground) {
            ground = BABYLON.MeshBuilder.CreateDisc("ground", { radius: 60, tessellation: 64 }, scene);
            ground.rotation.x = Math.PI / 2;
            const gm = new BABYLON.PBRMaterial("groundMat", scene);
            gm.albedoColor = new BABYLON.Color3(0.22, 0.20, 0.19).toLinearSpace();
            gm.metallic = 0.0; gm.roughness = 0.92;
            ground.material = gm;
            ground.receiveShadows = true;
        }
        ground.position.y = y;
    }

    // =================================================================
    //  生成 / 差し替え
    // =================================================================
    let state = null;
    const skinCache = {};
    let ssao = null;
    let onRebuilt = null;

    function build(varietyKey, seed) {
        if (state) { state.apple.dispose(); state = null; }
        const cfg = buildConfig(varietyKey, seed);

        // 【対策】テクスチャは品種だけで決まる。個体差で焼き直すと
        //         GUI操作のたびに固まる。品種単位でキャッシュする
        let skin = skinCache[varietyKey];
        if (!skin) { skin = new SkinFactory(scene, cfg); skinCache[varietyKey] = skin; }

        const apple = new Apple(scene, cfg, cfg.seed, skin);
        state = { cfg, skin, apple };

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const m of apple.parts) sg.addShadowCaster(m, true);

        const bb = apple.bounds();
        apple.root.position.y = -(bb.minY);          // 接地させる
        apple.root.position.x = -(bb.minX + bb.maxX) * 0.5;
        apple.root.position.z = -(bb.minZ + bb.maxZ) * 0.5;
        state.bounds = bb;

        ensureGround(-0.01);
        camera.target.set(0, (bb.maxY - bb.minY) * 0.45, 0);
        camera.radius = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 2.6;
        if (ssao) ssao.radius = cfg.radius * 0.45;
        if (onRebuilt) onRebuilt(state);

        console.log("[Apple]", cfg.label, "/ seed =", cfg.seed,
            "/ lenticels =", (skin.lenticelCoverage * 100).toFixed(1) + "%");
        return state;
    }

    build(START_VARIETY, START_SEED);

    if (GLOBAL.useSSAO) {
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        ssao.radius = state.cfg.radius * 0.45;
        ssao.totalStrength = 0.95;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 120;
        ssao.minZAspect = 0.25;
    }
    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    // 【対策】ブルームが強いとハイライトが滲んで発光体に見え、
    //         これも「ガラス玉」の一因になる。閾値を上げて量を減らす
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.95;
    dp.bloomWeight = 0.09;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.12;
    dp.depthOfFieldEnabled = true;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
    dp.depthOfField.fStop = 4.2;
    dp.depthOfField.focalLength = 70;
    dp.depthOfField.focusDistance = camera.radius * 1000;
    scene.onBeforeRenderObservable.add(() => {
        if (dp.depthOfFieldEnabled) dp.depthOfField.focusDistance = camera.radius * 1000;
    });

    // =================================================================
    // 7. GUI
    // =================================================================
    // 【対策】フルスクリーンGUIは既定でシーンと同じカメラで合成されるため、
    //         Bloom / 被写界深度 / シャープンがUIにも乗ってボケる。
    //         GUI専用カメラを layerMask で分離する。
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#2c2426", active: "#8f3a3f", edge: "#4d3d3f",
        text: "#f4ecec", sub: "#b8a5a6", accent: "#e2a0a3"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "228px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(18,13,14,0.80)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "16px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "196px"; panel.isVertical = true;
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

    addLabel("APPLE", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    let curVariety = START_VARIETY, curSeed = START_SEED;
    const varietyButtons = {};
    function highlight() {
        for (const k in varietyButtons) varietyButtons[k].background = (k === curVariety) ? COL.active : COL.idle;
    }
    for (const key of Object.keys(PRESETS)) {
        varietyButtons[key] = addButton("v_" + key, PRESETS[key].label, () => {
            curVariety = key; build(curVariety, curSeed); highlight();
        });
    }

    const sp = new BABYLON.GUI.Rectangle();
    sp.height = "8px"; sp.thickness = 0; sp.background = "";
    panel.addControl(sp);

    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed); highlight();
    });
    const rotateBtn = addButton("rotate", "自動回転: OFF", () => {
        camera.useAutoRotationBehavior = !camera.useAutoRotationBehavior;
        if (camera.autoRotationBehavior) camera.autoRotationBehavior.idleRotationSpeed = 0.1;
        rotateBtn.textBlock.text = "自動回転: " + (camera.useAutoRotationBehavior ? "ON" : "OFF");
        rotateBtn.background = camera.useAutoRotationBehavior ? COL.active : COL.idle;
    });

    const info = addLabel("", 12, COL.sub, "52px");
    onRebuilt = (st) => {
        if (!info) return;
        const a = st.apple, bb = st.bounds;
        info.text = "径 " + (bb.maxX - bb.minX).toFixed(1) + "cm / 高さ "
            + (bb.maxY - bb.minY).toFixed(1) + "cm\n果点 "
            + (st.skin.lenticelCoverage * 100).toFixed(1) + "%\nseed: " + st.cfg.seed;
    };
    onRebuilt(state);
    highlight();

    return scene;
};

export default createScene;