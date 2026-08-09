// =====================================================================
//  Photoreal Cherry  /  写実的なサクランボ（佐藤錦・ナポレオン・紅秀峰）
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  実物の要点（ここを外すと「赤い球にヒモ」になる）:
//    ・輪郭は球ではなくハート形。最大径は高さの60〜65%（上が張り下がすぼむ）
//    ・縫合線（ふくろ線）が梗あから果頂まで1本通り、その面がわずかに扁平
//    ・梗あは狭くて深い漏斗。ここに軸が「刺さる」のではなく「埋まる」
//    ・果頂に小さな点（花柱痕）がありごく浅くくぼむ
//    ・色は一様な赤ではない。黄色い地色の上に日向側から赤が回り込む。
//      境界はぼかしではなく、細かい赤い斑点が飛び散った状態
//    ・果柄は果実の直径の1.5〜2倍と長く、太さは1mm前後。
//      淡い黄緑で、樹から離れた先端だけが茶色く乾いてこぶになる
//    ・表面は薄いロウで強い光沢。ただし「鏡」ではない（環境の建物が映ったら失敗）
//
//  リンゴ版からの引き継ぎ:
//    ・法線マップの V の符号は (yd - yu)。Babylon の接空間は V が下向きなので
//      OpenGL 系の (yu - yd) で焼くと凹凸が反転する（メロン／スイカ版で確定）
//    ・影は ESM ではなく PCF。ESM の自己遮蔽が「皮の痣」になる（ジャガイモ版）
//    ・テクスチャは品種単位でキャッシュ。個体差で焼き直すと GUI 操作で固まる
// =====================================================================

var createScene = function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const PRESETS = {
        // 佐藤錦: 黄色い地色に赤。日向側が濃く、日陰側に黄色が残るのが特徴
        satonishiki: {
            label: "佐藤錦",
            radius: 1.16, height: 2.18,
            sutureDepth: 0.052, flatten: 0.045, asymmetry: 0.022,
            ground: [0.90, 0.72, 0.26],       // 地色（黄）
            blush: [0.80, 0.11, 0.085],       // 日焼けの赤
            deep: [0.52, 0.035, 0.050],       // いちばん濃い所
            blushAmount: 0.95, blushFloor: 0.30, blushSpread: 1.15,
            fleckAmount: 0.55,                // 境界に飛ぶ赤い斑点
            speckle: [0.93, 0.80, 0.52], speckleCount: 2200,
            skinRoughness: 0.24, waxIntensity: 0.95,
            stemLength: 3.9, stemRadius: 0.048
        },
        // ナポレオン: やや大きく縦長。色づきが浅く黄色が広く残る
        napoleon: {
            label: "ナポレオン",
            radius: 1.22, height: 2.42,
            sutureDepth: 0.060, flatten: 0.052, asymmetry: 0.026,
            ground: [0.92, 0.78, 0.30],
            blush: [0.78, 0.16, 0.10],
            deep: [0.56, 0.06, 0.055],
            blushAmount: 0.84, blushFloor: 0.16, blushSpread: 1.45,
            fleckAmount: 0.70,
            speckle: [0.94, 0.83, 0.56], speckleCount: 2400,
            skinRoughness: 0.26, waxIntensity: 0.88,
            stemLength: 4.3, stemRadius: 0.050
        },
        // 紅秀峰: 大玉で丸い。全体が濃い赤に染まり黄色はほぼ残らない
        benishuho: {
            label: "紅秀峰",
            radius: 1.36, height: 2.36,
            sutureDepth: 0.046, flatten: 0.038, asymmetry: 0.020,
            ground: [0.80, 0.42, 0.16],
            blush: [0.56, 0.045, 0.055],
            deep: [0.31, 0.018, 0.032],
            blushAmount: 1.0, blushFloor: 0.74, blushSpread: 1.7,
            fleckAmount: 0.25,
            speckle: [0.78, 0.55, 0.40], speckleCount: 2000,
            skinRoughness: 0.22, waxIntensity: 1.0,
            stemLength: 4.0, stemRadius: 0.052
        }
    };

    const GLOBAL = {
        // --- 分割
        segmentsMeridian: 140,
        segmentsRound: 96,
        // --- 果柄
        stemSegments: 56,
        stemSides: 12,
        // --- テクスチャ
        textureSize: 512,
        skinDetail: 1.0,
        // --- 描画
        useSSAO: true,
        showGround: true
    };

    const START_VARIETY = "satonishiki";
    const START_SEED = 20260801;
    const START_COUNT = 2;                    // 1 = 1個 / 2 = 双子

    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        return cfg;
    }

    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;

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
            return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
        }
    }

    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    // 角度差を -π..π に畳む
    const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

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
                const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
                const e1x = positions[ib * 3] - ax, e1y = positions[ib * 3 + 1] - ay, e1z = positions[ib * 3 + 2] - az;
                const e2x = positions[ic * 3] - ax, e2y = positions[ic * 3 + 1] - ay, e2z = positions[ic * 3 + 2] - az;
                const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
                return nx * dx + ny * dy + nz * dz > 0;
            };

            let indices = sideIndices(false);
            let normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);

            // 側面が外向きか。リングの半径がいちばん大きい行で判定する
            let mi = Math.floor(N / 2), best = -1;
            for (let i = 1; i < N - 1; i++) {
                const d = Math.hypot(rings[i][0].x - centers[i].x, rings[i][0].y - centers[i].y, rings[i][0].z - centers[i].z);
                if (d > best) { best = d; mi = i; }
            }
            const mj = Math.floor(M / 4);
            const vi = mi * M + mj, cc = centers[mi];
            const ox = positions[vi * 3] - cc.x, oy = positions[vi * 3 + 1] - cc.y, oz = positions[vi * 3 + 2] - cc.z;
            const dot = ox * normals[vi * 3] + oy * normals[vi * 3 + 1] + oz * normals[vi * 3 + 2];
            if (dot < 0) indices = sideIndices(true);

            // 【対策】キャップの巻き順は側面の flip と一致しない。同じフラグを
            //         流用すると、側面が正しいときキャップが裏返って穴に見える
            if (capStart) {
                const b = { x: centers[0].x - centers[1].x, y: centers[0].y - centers[1].y, z: centers[0].z - centers[1].z };
                const okOrder = facesToward(capA, 0, 1, b.x, b.y, b.z);
                for (let j = 0; j < M - 1; j++) {
                    if (okOrder) indices.push(capA, j, j + 1); else indices.push(capA, j + 1, j);
                }
            }
            if (capEnd) {
                const o = (N - 1) * M;
                const f = { x: centers[N - 1].x - centers[N - 2].x, y: centers[N - 1].y - centers[N - 2].y, z: centers[N - 1].z - centers[N - 2].z };
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
                const phi = (j % M) / M * TAU;
                const rr = radiusOf(phi);
                const ca = Math.cos(j / M * TAU), sa = Math.sin(j / M * TAU);
                pts.push(new V3(
                    center.x + (outer.x * ca + side.x * sa) * rr,
                    center.y + (outer.y * ca + side.y * sa) * rr,
                    center.z + (outer.z * ca + side.z * sa) * rr
                ));
            }
            return pts;
        },

        // 曲線に沿ったチューブ。
        // 【対策】各点で「上ベクトルとの外積」で断面の基底を作ると、接線が
        //         鉛直に近づいた所で基底が暴れてリボンがねじれる。ひとつ前の
        //         基底を接線に直交する平面へ射影して運ぶ（平行移動フレーム）
        tube(points, M, radiusOf) {
            const n = points.length;
            const rings = [], centers = [];
            let nrm = null;
            for (let i = 0; i < n; i++) {
                const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
                let t = b.subtract(a);
                if (t.lengthSquared() < 1e-12) t = new V3(0, 1, 0);
                t.normalize();
                if (!nrm) {
                    const ref = Math.abs(t.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
                    nrm = V3.Cross(t, ref).normalize();
                } else {
                    nrm = nrm.subtract(t.scale(V3.Dot(nrm, t)));
                    if (nrm.lengthSquared() < 1e-10) {
                        const ref = Math.abs(t.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
                        nrm = V3.Cross(t, ref);
                    }
                    nrm.normalize();
                }
                const bin = V3.Cross(t, nrm).normalize();
                const s = i / (n - 1);
                rings.push(this.ring(points[i], nrm, bin, M, (phi) => radiusOf(s, phi, points[i].y)));
                centers.push(points[i]);
            }
            return { rings, centers };
        }
    };

    function bezier3(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return new V3(
            p0.x * a + p1.x * b + p2.x * c + p3.x * d,
            p0.y * a + p1.y * b + p2.y * c + p3.y * d,
            p0.z * a + p1.z * b + p2.z * c + p3.z * d
        );
    }

    // =================================================================
    // 3. Profile : 子午線（梗あの底 → 外周 → 果頂）
    //    r, y ともに 0..1 の正規化値
    // =================================================================
    const MERIDIAN = [
        [0.000, 0.762], [0.058, 0.768], [0.118, 0.792], [0.178, 0.832],
        [0.240, 0.878], [0.312, 0.926], [0.432, 0.958], [0.580, 0.968],
        [0.722, 0.950], [0.852, 0.906], [0.946, 0.836], [0.994, 0.742],
        [1.000, 0.632], [0.976, 0.512], [0.921, 0.396], [0.841, 0.290],
        [0.731, 0.196], [0.592, 0.119], [0.432, 0.060], [0.272, 0.024],
        [0.132, 0.005], [0.046, 0.000], [0.000, 0.011]      // 果頂はわずかにくぼむ
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
        return { r: catmull(a[0], b[0], c[0], d[0], t), y: catmull(a[1], b[1], c[1], d[1], t) };
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
            dt.anisotropicFilteringLevel = 16;   // 斜めから見た赤道付近のにじみ対策
            return dt;
        },

        // ---- 果点：サクランボのそれはリンゴより小さく淡い -----------------
        speckleMask(size, seed, cfg) {
            const m = new Float32Array(size * size);
            const r = new Rng(seed);
            for (let k = 0; k < cfg.speckleCount; k++) {
                const u = r.next();
                const v = clamp(r.range(0.12, 0.96) + r.gauss(0, 0.03), 0.08, 0.98);
                const shrink = 0.35 + 0.65 * Math.sin(Math.PI * v);
                const rad = r.range(0.0006, 0.0016) * size * shrink;
                const rx = Math.max(0.7, rad), ry = Math.max(0.7, rad * r.range(0.9, 1.25));
                const cx = u * size, cy = v * size;
                const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
                const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(size - 1, Math.ceil(cy + ry));
                for (let y = y0; y <= y1; y++) {
                    const dy = (y - cy) / ry;
                    for (let x = x0; x <= x1; x++) {
                        const dx = (x - cx) / rx;
                        const d = Math.hypot(dx, dy);
                        if (d >= 1) continue;
                        const w = Math.pow(1 - d, 0.8);
                        const xw = ((x % size) + size) % size;
                        const i = y * size + xw;
                        if (w > m[i]) m[i] = w;
                    }
                }
            }
            return m;
        },

        // ---- 日焼け：u=0.5 が日向 -----------------------------------------
        blushAt(u, v, cfg, seed) {
            let du = Math.abs(u - 0.5);
            du = Math.min(du, 1 - du) * 2;                     // 0(日向)..1(日陰)
            const angular = cfg.blushFloor + (1 - cfg.blushFloor) * Math.pow(1 - du, cfg.blushSpread);
            // 梗あの奥は光が当たらない。ここを赤くするとくぼみが光って作り物に見える
            const wellCut = 1 - 0.72 * smooth(0.13, 0.0, v);
            // 果頂側はやや色が浅い（最後に色づく部位）
            const vertical = (0.88 + 0.12 * smooth(1.0, 0.45, v)) * wellCut;
            const cloud = this.fbm(u * 5, v * 4, 5, seed, 3);
            const grain = this.fbm(u * 17, v * 13, 17, seed + 5, 2);
            return clamp(cfg.blushAmount * angular * vertical
                * (0.52 + 0.92 * cloud) * (0.84 + 0.32 * grain), 0, 1);
        },

        albedo(scene, size, cfg, spec, seed) {
            const G = cfg.ground, B = cfg.blush, D = cfg.deep, L = cfg.speckle;
            const WELL = [0.26, 0.23, 0.11];      // 梗あの奥（黄緑〜褐）
            const TIP = [0.40, 0.26, 0.15];       // 果頂の点（花柱痕）
            return this._canvasTexture("cherryAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const wellK = smooth(0.15, 0.0, v);
                    const tipK = smooth(0.972, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let cr = G[0], cg = G[1], cb = G[2];
                        // 地色のむら（黄色い部分が均一だとプラスチックに見える）
                        const mott = 0.93 + 0.14 * this.fbm(u * 8, v * 6, 8, seed + 3, 2);
                        cr *= mott; cg *= mott; cb *= mott;

                        const bl = this.blushAt(u, v, cfg, seed + 11);
                        cr = mix(cr, B[0], bl); cg = mix(cg, B[1], bl); cb = mix(cb, B[2], bl);

                        // 【対策】赤と黄の境目をグラデーションだけで作るとエアブラシに
                        //         見える。実物は境界の手前に細かい赤い斑点が飛ぶ
                        const fk = this.fbm(u * 60, v * 46, 60, seed + 41, 2);
                        const band = smooth(0.06, 0.30, bl) * (1 - smooth(0.55, 0.85, bl));
                        const fleck = smooth(0.58, 0.74, fk) * band * cfg.fleckAmount;
                        cr = mix(cr, B[0], fleck); cg = mix(cg, B[1], fleck); cb = mix(cb, B[2], fleck);

                        // いちばん濃い所（日向の中心）はさらに沈んだ赤
                        const dp = smooth(0.72, 0.99, bl) * 0.75;
                        cr = mix(cr, D[0], dp); cg = mix(cg, D[1], dp); cb = mix(cb, D[2], dp);

                        // ごく淡い縦の条（果肉の維管束に沿う筋）
                        const stripe = (this.fbm(u * 80, v * 2.4, 80, seed + 61, 2) - 0.5) * 0.10 * bl;
                        cr = clamp(cr + stripe, 0, 1); cg = clamp(cg + stripe * 0.5, 0, 1); cb = clamp(cb + stripe * 0.4, 0, 1);

                        // 果点はごく淡く。強くすると梨になる
                        const lw = smooth(0.25, 0.9, spec[y * N + x]) * (0.25 + 0.75 * bl) * 0.30;
                        cr = mix(cr, L[0], lw); cg = mix(cg, L[1], lw); cb = mix(cb, L[2], lw);

                        if (wellK > 0) { cr = mix(cr, WELL[0], wellK); cg = mix(cg, WELL[1], wellK); cb = mix(cb, WELL[2], wellK); }
                        if (tipK > 0) { cr = mix(cr, TIP[0], tipK * 0.85); cg = mix(cg, TIP[1], tipK * 0.85); cb = mix(cb, TIP[2], tipK * 0.85); }

                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // ロウ層。R=強度 / G=粗さ（マテリアル側の値と乗算される）
        wax(scene, size, cfg, seed) {
            return this._canvasTexture("cherryWax", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const dull = Math.max(smooth(0.24, 0.02, v), smooth(0.94, 1.0, v));
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const smudge = this.fbm(u * 5, v * 4, 5, seed, 3);
                        const fine = this.fbm(u * 20, v * 16, 20, seed + 9, 2);
                        const inten = (0.72 + 0.24 * smudge) * (1 - 0.75 * dull);
                        const rough = 0.30 + 0.16 * (1 - smudge) + 0.10 * fine + 0.40 * dull;
                        d[i] = clamp(inten, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        orm(scene, size, cfg, spec, seed) {
            return this._canvasTexture("cherryORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    const wellK = smooth(0.16, 0.0, v);
                    const tipK = smooth(0.965, 1.0, v);
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        let rough = cfg.skinRoughness * (0.9 + 0.28 * this.fbm(u * 11, v * 9, 11, seed + 5, 2));
                        let ao = 1.0;
                        // 果点はロウが乗らないのでわずかに粗い
                        rough = mix(rough, clamp(rough + 0.14, 0, 1), smooth(0.25, 0.9, spec[y * N + x]));
                        // 【対策】梗あ／果頂が滑らかなままだと、くぼみの底だけ
                        //         ぬらりと光って樹脂に見える。ここは明確に粗くする
                        rough = mix(rough, 0.86, wellK);
                        rough = mix(rough, 0.72, tipK);
                        ao = mix(ao, 0.32, wellK);
                        ao = mix(ao, 0.62, tipK);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.04, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // 【対策】低周波を入れると萎びて見える。サクランボの肌は張っているので
        //         果点のごく浅い隆起と、微細な肌理だけ。
        //         この微細なゆらぎが鏡面反射を割り、ガラス玉化も防ぐ。
        //         V の符号は (yd - yu)。Babylon の接空間は V が下向きなので、
        //         OpenGL 系の (yu - yd) で焼くと凹凸が反転する
        normal(scene, size, cfg, spec, seed, detail) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    const skin = this.fbm(u * 90, v * 70, 90, seed, 2) * 0.45;
                    const micro = this.fbm(u * 180, v * 145, 180, seed + 61, 2) * 0.20;
                    h[y * size + x] = skin + micro + spec[y * size + x] * 0.30;
                }
            }
            return this._canvasTexture("cherryNormal", size, (d, N) => {
                const strength = 0.85 * (detail === undefined ? 1 : detail);
                for (let y = 0; y < N; y++) {
                    const vv = y / N;
                    const poleFade = smooth(0, 0.10, vv) * (1 - smooth(0.90, 1.0, vv));
                    const k = strength * poleFade;
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
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

        // 果柄用。細い縦の繊維。果皮のマップを流用すると密度が合わない
        stemNormal(scene, size, seed) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    h[y * size + x] = this.fbm(u * 26, v * 3, 26, seed, 3) * 0.85
                        + this.fbm(u * 70, v * 40, 70, seed + 17, 2) * 0.22;
                }
            }
            return this._canvasTexture("cherryStemNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    for (let x = 0; x < N; x++) {
                        const xl = h[y * N + ((x - 1 + N) % N)], xr = h[y * N + ((x + 1) % N)];
                        const yu = h[Math.max(0, y - 1) * N + x], yd = h[Math.min(N - 1, y + 1) * N + x];
                        let nx = (xl - xr) * 1.8, ny = (yd - yu) * 1.8, nz = 1;
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
    // 5. SkinFactory : 品種ごとのマテリアル（キャッシュ対象）
    // =================================================================
    class SkinFactory {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const spec = TextureLab.speckleMask(S, 5501, cfg);
            let n = 0;
            for (let i = 0; i < spec.length; i++) if (spec[i] > 0.2) n++;
            this.speckleCoverage = n / spec.length;

            this.albedoTex = TextureLab.albedo(scene, S, cfg, spec, 131);
            this.ormTex = TextureLab.orm(scene, S, cfg, spec, 131);
            this.normalTex = TextureLab.normal(scene, S, cfg, spec, 707, cfg.skinDetail);
            this.waxTex = TextureLab.wax(scene, S, cfg, 313);
            this.stemNormalTex = TextureLab.stemNormal(scene, 256, 4242);

            const pbr = new BABYLON.PBRMaterial("cherrySkin", scene);
            pbr.albedoTexture = this.albedoTex;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;                    // 実値は ORM の G チャンネル
            pbr.metallicTexture = this.ormTex;
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            pbr.bumpTexture.level = 0.42;           // 肌は張っている。強くすると梨になる
            // 【対策】clearCoat の intensity / roughness はテクスチャの R / G と
            //         「乗算」される。ここを小さく作ると実効 roughness が 0.1 を
            //         割り、環境の建物まで映り込んでガラス玉になる。
            //         実効 roughness ≒ 0.42 × 0.30〜0.60 = 0.13〜0.25（強い光沢だが鏡ではない）
            pbr.clearCoat.isEnabled = true;
            pbr.clearCoat.intensity = 0.85 * cfg.waxIntensity;
            pbr.clearCoat.roughness = 0.42;
            pbr.clearCoat.texture = this.waxTex;
            pbr.clearCoat.useRoughnessFromMainTexture = true;
            pbr.clearCoat.indexOfRefraction = 1.38;
            // 果肉の透過。小さくて薄いぶんリンゴより効かせる（縁が赤く透ける）
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(0.62, 0.11, 0.10);
            pbr.subSurface.translucencyIntensity = 0.30;
            pbr.subSurface.minimumThickness = 0.2;
            pbr.subSurface.maximumThickness = 1.6;
            this.skin = pbr;

            const stem = new BABYLON.PBRMaterial("cherryStem", scene);
            stem.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            stem.metallic = 0.0;
            stem.roughness = 0.58;                            // 生の軸。しっとりした半光沢
            stem.bumpTexture = this.stemNormalTex;
            stem.bumpTexture.level = 0.55;
            stem.subSurface.isTranslucencyEnabled = true;     // 細いので逆光で透ける
            stem.subSurface.tintColor = new BABYLON.Color3(0.45, 0.55, 0.18);
            stem.subSurface.translucencyIntensity = 0.35;
            stem.subSurface.minimumThickness = 0.02;
            stem.subSurface.maximumThickness = 0.12;
            stem.backFaceCulling = true;
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
    // 6. Cherry
    // =================================================================
    class Cherry {
        constructor(scene, cfg, seed, skin) {
            this.scene = scene; this.cfg = cfg; this.skin = skin;
            const rng = new Rng(seed);
            this.rng = rng;
            this.R = cfg.radius * rng.range(0.93, 1.07);
            this.H = cfg.height * rng.range(0.94, 1.06);
            // 縫合線の向きは個体ごとに変える（テクスチャに焼かず形状だけで作るので自由）
            this.suturePhi = rng.range(0, TAU);
            this.sutureDepth = cfg.sutureDepth * rng.range(0.7, 1.35);
            this.flatten = cfg.flatten * rng.range(0.6, 1.4);
            this.asym = cfg.asymmetry * rng.range(0.5, 1.5);
            this.asymPhase = rng.range(0, TAU);
            this.d2 = cfg.asymmetry * rng.range(0.3, 0.7);
            this.p2 = rng.range(0, TAU);
            this.tilt = rng.gauss(0, 0.030);
            this.tiltDir = rng.range(0, TAU);
            this.parts = [];
            this.root = new BABYLON.TransformNode("cherry", scene);
            this._buildBody();
        }

        centerAt(yn) {
            // 軸のわずかな傾き。完全な回転体にすると作り物に見える
            const k = this.tilt * this.H * (yn - 0.4);
            return new V3(Math.cos(this.tiltDir) * k, yn * this.H, Math.sin(this.tiltDir) * k);
        }

        radiusAt(v, phi) {
            const m = meridianAt(v);
            let r = m.r * this.R;
            // 縫合線: 梗あから果頂まで通る1本の浅い溝
            const dphi = angDiff(phi, this.suturePhi);
            const gw = 0.42;                                     // 溝の幅（rad）
            const along = smooth(0.0, 0.10, v) * (0.35 + 0.65 * smooth(1.0, 0.42, v));
            const groove = this.sutureDepth * Math.exp(-(dphi * dphi) / (gw * gw)) * along;
            r *= 1 - groove;
            // 縫合線の面がわずかに扁平（真円だと球に見える）
            r *= 1 - this.flatten * (0.5 + 0.5 * Math.cos(2 * dphi)) * Math.sin(Math.PI * m.y);
            // 左右非対称のごく緩いへこみ
            r *= 1 + this.asym * Math.cos(phi - this.asymPhase) * (0.35 + 0.65 * Math.sin(Math.PI * m.y))
                + this.d2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * m.y * 1.2);
            return r;
        }

        // 梗あ（軸のくぼみ）の内壁半径。肩より上なら Infinity
        // 【対策】果柄の太さをこれでクランプしないと、付け根がくぼみの壁を
        //         突き抜けて「刺さっている」ように見える
        cavityRadiusAt(y) {
            const P = this.meridian;
            for (let i = 1; i < P.length; i++) {
                if (P[i].y < P[i - 1].y) break;                  // 肩を越えたら終わり
                if (y >= P[i - 1].y && y <= P[i].y) {
                    const t = (y - P[i - 1].y) / Math.max(1e-6, P[i].y - P[i - 1].y);
                    return mix(P[i - 1].r, P[i].r, t);
                }
            }
            return Infinity;
        }

        shoulderY() {
            let best = -Infinity;
            for (let i = 0; i <= 80; i++) {
                const y = meridianAt(i / 80 * 0.45).y * this.H;
                if (y > best) best = y;
            }
            return best;
        }

        _buildBody() {
            const cfg = this.cfg, N = cfg.segmentsMeridian, M = cfg.segmentsRound;
            const rings = [], centers = [];
            this.meridian = [];
            for (let i = 0; i <= N; i++) {
                const v = i / N;
                const m = meridianAt(v);
                const c = this.centerAt(m.y);
                rings.push(Geo.ring(c, new V3(1, 0, 0), new V3(0, 0, 1), M,
                    (phi) => Math.max(0.002, this.radiusAt(v, phi))));
                centers.push(c);
                this.meridian.push({ v, r: m.r * this.R, y: m.y * this.H, c });
            }
            const mesh = Geo.build("cherryBody", rings, centers, true, true, this.scene);
            mesh.material = this.skin.skin;
            mesh.receiveShadows = true;
            mesh.parent = this.root;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // 果柄。endLocal を渡すとその点へ向かって伸びる（双子の合流点用）
        buildStem(endLocal) {
            const cfg = this.cfg, rng = this.rng;
            const K = cfg.stemSegments, M = cfg.stemSides;
            const base = this.centerAt(meridianAt(0).y);
            const rimY = this.shoulderY();
            const L = cfg.stemLength * rng.range(0.88, 1.14);

            // 【対策】くぼみの頂点はメッシュ上は1点なので、そこから生やすと
            //         付け根に隙間が見える。少し埋めた位置から始める
            const sink = cfg.stemRadius * 2.2;
            const p0 = new V3(base.x, base.y - sink, base.z);

            let p3;
            if (endLocal) {
                p3 = endLocal.clone();
            } else {
                const dir = rng.range(0, TAU);
                const lean = Math.tan(rng.range(0.16, 0.42));    // 9〜24°
                p3 = new V3(
                    p0.x + Math.cos(dir) * L * lean * 0.9,
                    p0.y + L * 0.94,
                    p0.z + Math.sin(dir) * L * lean * 0.9
                );
            }
            // 出だしは梗あから真上。到着側は下から回り込ませる
            const side = rng.range(0, TAU);
            const swing = L * rng.range(0.10, 0.26);
            const p1 = new V3(p0.x + Math.cos(side) * swing * 0.4, p0.y + L * 0.46, p0.z + Math.sin(side) * swing * 0.4);
            const toBase = new V3(p0.x - p3.x, 0, p0.z - p3.z);
            if (toBase.lengthSquared() < 1e-8) toBase.set(Math.cos(side), 0, Math.sin(side));
            toBase.normalize();
            const p2 = new V3(
                p3.x + toBase.x * L * 0.24 + Math.cos(side + 1.7) * swing * 0.5,
                p3.y - L * (endLocal ? 0.34 : 0.26),
                p3.z + toBase.z * L * 0.24 + Math.sin(side + 1.7) * swing * 0.5
            );

            const wobA = rng.range(0, TAU), wobK = rng.range(2.2, 4.0);
            const pts = [];
            for (let k = 0; k <= K; k++) {
                const s = k / K;
                const p = bezier3(p0, p1, p2, p3, s);
                // 実物の軸はまっすぐではない。ごく浅い蛇行を全長に乗せる
                const w = Math.sin(s * wobK + wobA) * cfg.stemRadius * 1.5 * Math.sin(Math.PI * s);
                p.x += Math.cos(wobA) * w; p.z += Math.sin(wobA) * w;
                pts.push(p);
            }

            const self = this;
            const t = Geo.tube(pts, M, (s, phi, y) => {
                // 太さ：果実側がやや太く、中ほどは一定、樹側の切れ口でこぶになる
                let rr = cfg.stemRadius * (0.78 + 0.42 * Math.pow(1 - s, 2.2));
                rr *= 1 + 0.95 * smooth(0.86, 0.98, s);          // 離層痕のこぶ
                rr *= 1 - 0.85 * Math.pow(smooth(0.975, 1.0, s), 1.2);  // 先端を丸める
                rr *= 1 + 0.06 * Math.cos(3 * phi + s * 2.2) + 0.03 * Math.cos(7 * phi);
                const cav = self.cavityRadiusAt(y);
                if (isFinite(cav)) rr = Math.min(rr, Math.max(cfg.stemRadius * 0.5, cav * 0.8));
                return Math.max(0.004, rr);
            });

            const mesh = Geo.build("cherryStem", t.rings, t.centers, false, true, this.scene);
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const uv = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            const col = new Float32Array((pos.length / 3) * 4);
            // 果実に近い付け根はやや濃く、中ほどは明るい黄緑、樹側は乾いた褐色
            const root = new BABYLON.Color3(0.36, 0.42, 0.16).toLinearSpace();
            const mid = new BABYLON.Color3(0.63, 0.70, 0.31).toLinearSpace();
            const dry = new BABYLON.Color3(0.34, 0.25, 0.13).toLinearSpace();
            const tipRng = new Rng(1234567);
            const dryStart = 0.84 + tipRng.range(-0.04, 0.05);
            for (let i = 0, c = 0; i < pos.length / 3; i++, c += 4) {
                const tt = uv ? uv[i * 2 + 1] : 0;
                const uu = uv ? uv[i * 2] : 0;
                const w1 = smooth(0.04, 0.42, tt);
                const w2 = smooth(dryStart, Math.min(0.99, dryStart + 0.10), tt);
                const g = 0.88 + 0.24 * TextureLab.fbm(uu * 10, tt * 5, 10, 907, 2);
                col[c] = mix(mix(root.r, mid.r, w1), dry.r, w2) * g;
                col[c + 1] = mix(mix(root.g, mid.g, w1), dry.g, w2) * g;
                col[c + 2] = mix(mix(root.b, mid.b, w1), dry.b, w2) * g;
                col[c + 3] = 1;
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
            mesh.hasVertexAlpha = false;
            mesh.material = this.skin.stem;
            mesh.receiveShadows = true;
            mesh.parent = this.root;
            this.stem = mesh;
            this.parts.push(mesh);
            return mesh;
        }

        topY() { return meridianAt(0.32).y * this.H; }

        dispose() {
            for (const m of this.parts) m.dispose();
            this.root.dispose();
            this.parts.length = 0;
        }
    }

    // =================================================================
    // 7. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.05, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    // 【対策】環境マップが鮮明なままだと建物の輪郭がそのまま映り込んでガラス玉に
    //         見える。参照するミップを少しぼかす（リンゴより光沢が強いので控えめ）
    env.lodGenerationOffset = 0.35;
    scene.environmentIntensity = 0.72;
    scene.createDefaultSkybox(env, true, 1000, 0.72, false);

    const camera = new BABYLON.ArcRotateCamera("cam", -1.15, 1.22, 9, new V3(0, 0, 0), scene);
    camera.attachControl(true);
    camera.wheelPrecision = 45;               // 果実が小さいので細かく
    camera.minZ = 0.02;
    camera.lowerRadiusLimit = 2.2;
    camera.upperRadiusLimit = 40;
    scene.cameraToUseForPointers = camera;

    // 【対策】平行光源のハイライトは点になる。強いままだと「鏡に映った電球」に
    //         見えるので specular を落として拡散側で明るさを稼ぐ
    const key = new BABYLON.DirectionalLight("key", new V3(-0.55, -0.92, 0.42).normalize(), scene);
    key.position = new V3(5, 9, -4);
    key.intensity = 2.6;
    key.diffuse = new BABYLON.Color3(1.0, 0.97, 0.92);
    key.specular = new BABYLON.Color3(0.55, 0.53, 0.50);
    key.autoCalcShadowZBounds = true;

    const rim = new BABYLON.DirectionalLight("rim", new V3(0.55, -0.25, -1.0).normalize(), scene);
    rim.intensity = 1.45;
    rim.diffuse = new BABYLON.Color3(1.0, 0.90, 0.84);
    rim.specular = new BABYLON.Color3(0.30, 0.28, 0.27);

    const fill = new BABYLON.HemisphericLight("fill", new V3(0, 1, 0), scene);
    fill.intensity = 0.20;
    fill.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】影は ESM ではなく PCF。ESM だと自己遮蔽が果皮に痣として出る
    //         （ジャガイモ版で判明した現象）。scale が小さいので bias も控えめ
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.forceBackFacesOnly = true;
    sg.bias = 0.0008;
    sg.normalBias = 0.006;
    sg.setDarkness(0.44);

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 1.12;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.4;
    ip.vignetteCameraFov = 0.7;
    ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    let ground = null;
    function ensureGround(y) {
        if (!GLOBAL.showGround) return;
        if (!ground) {
            ground = BABYLON.MeshBuilder.CreateDisc("ground", { radius: 30, tessellation: 64 }, scene);
            ground.rotation.x = Math.PI / 2;
            const gm = new BABYLON.PBRMaterial("groundMat", scene);
            gm.albedoColor = new BABYLON.Color3(0.20, 0.19, 0.18).toLinearSpace();
            gm.metallic = 0.0; gm.roughness = 0.92;
            ground.material = gm;
            ground.receiveShadows = true;
        }
        ground.position.y = y;
    }

    // =================================================================
    // 8. 生成 / 差し替え
    // =================================================================
    let state = null;
    const skinCache = {};
    let ssao = null;
    let onRebuilt = null;

    function worldBounds(meshes) {
        const o = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
        for (const m of meshes) {
            m.computeWorldMatrix(true);
            const bb = m.getBoundingInfo().boundingBox;
            o.minX = Math.min(o.minX, bb.minimumWorld.x); o.maxX = Math.max(o.maxX, bb.maximumWorld.x);
            o.minY = Math.min(o.minY, bb.minimumWorld.y); o.maxY = Math.max(o.maxY, bb.maximumWorld.y);
            o.minZ = Math.min(o.minZ, bb.minimumWorld.z); o.maxZ = Math.max(o.maxZ, bb.maximumWorld.z);
        }
        return o;
    }

    function build(varietyKey, seed, count) {
        if (state) { for (const c of state.cherries) c.dispose(); state.group.dispose(); state = null; }
        const cfg = buildConfig(varietyKey, seed);

        // 【対策】テクスチャは品種だけで決まる。個体差で焼き直すと GUI 操作の
        //         たびに固まる。品種単位でキャッシュする
        let skin = skinCache[varietyKey];
        if (!skin) { skin = new SkinFactory(scene, cfg); skinCache[varietyKey] = skin; }

        const rng = new Rng((cfg.seed ^ 0x9E3779B9) >>> 0);
        const group = new BABYLON.TransformNode("cherryGroup", scene);
        const cherries = [];
        for (let i = 0; i < count; i++) {
            const c = new Cherry(scene, cfg, (cfg.seed + i * 7919) >>> 0, skin);
            c.root.parent = group;
            cherries.push(c);
        }

        // --- 配置 ---
        if (count === 1) {
            cherries[0].root.position.set(0, 0, 0);
            cherries[0].root.rotation.y = rng.range(0, TAU);
        } else {
            // 実った双子は互いに触れ合う。最大径どうしが軽く当たる距離に置く
            const sep = (cherries[0].R + cherries[1].R) * 0.52;
            const axis = rng.range(0, TAU);
            for (let i = 0; i < 2; i++) {
                const sgn = i === 0 ? -1 : 1;
                cherries[i].root.position.set(Math.cos(axis) * sep * sgn, 0, Math.sin(axis) * sep * sgn);
                cherries[i].root.rotation.y = rng.range(0, TAU);
            }
        }

        // --- 果柄（双子は1点で合流させる）---
        if (count === 1) {
            cherries[0].buildStem(null);
        } else {
            const top = Math.max(cherries[0].topY(), cherries[1].topY());
            const junction = new V3(
                rng.range(-0.12, 0.12),
                top + cfg.stemLength * rng.range(0.62, 0.74),
                rng.range(-0.12, 0.12)
            );
            for (const c of cherries) {
                // root は Y 回転しているので、合流点をローカル系へ戻す
                const yaw = c.root.rotation.y;
                const dx = junction.x - c.root.position.x, dz = junction.z - c.root.position.z;
                const cs = Math.cos(-yaw), sn = Math.sin(-yaw);
                c.buildStem(new V3(dx * cs - dz * sn, junction.y, dx * sn + dz * cs));
            }
        }

        const meshes = [];
        for (const c of cherries) for (const m of c.parts) meshes.push(m);

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const m of meshes) sg.addShadowCaster(m, true);

        const bb = worldBounds(meshes);
        group.position.y = -bb.minY;                     // 接地させる
        group.position.x = -(bb.minX + bb.maxX) * 0.5;
        group.position.z = -(bb.minZ + bb.maxZ) * 0.5;

        ensureGround(-0.002);
        const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY, d = bb.maxZ - bb.minZ;
        camera.target.set(0, h * 0.42, 0);
        camera.radius = Math.max(w, d, h * 0.75) * 2.9;
        if (ssao) ssao.radius = cfg.radius * 0.40;

        state = { cfg, skin, cherries, group, bounds: bb, count };
        if (onRebuilt) onRebuilt(state);

        console.log("[Cherry]", cfg.label, "/ seed =", cfg.seed, "/ 個数 =", count,
            "/ 果点 =", (skin.speckleCoverage * 100).toFixed(1) + "%");
        return state;
    }

    build(START_VARIETY, START_SEED, START_COUNT);

    if (GLOBAL.useSSAO) {
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        ssao.radius = state.cfg.radius * 0.40;
        ssao.totalStrength = 0.90;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 60;
        ssao.minZAspect = 0.15;
    }
    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    // 【対策】ブルームが強いとハイライトが滲んで発光体に見える。閾値を上げる
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.92;
    dp.bloomWeight = 0.12;
    dp.bloomKernel = 36;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.14;
    // 【対策】被写界深度の錯乱円は「シーンの1単位 = 1m」として深度を mm に
    //         換算している（内部で ×1000）。単位を cm のつもりで焦点距離を
    //         合わせても合焦しないので、ピント位置は radius×1000 のまま。
    //         代わりに焦点距離と絞りで被写界深度の幅を作る。
    //         f=85mm / F4.0 だと合焦範囲はカメラ距離の 0.8〜1.3 倍。
    //         果実全体はピント内に収まり、地面の奥と背景だけが流れる
    dp.depthOfFieldEnabled = true;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
    dp.depthOfField.fStop = 4.0;
    dp.depthOfField.focalLength = 85;
    const DOF_SCALE = 1000;
    dp.depthOfField.focusDistance = camera.radius * DOF_SCALE;
    scene.onBeforeRenderObservable.add(() => {
        if (dp.depthOfFieldEnabled) dp.depthOfField.focusDistance = camera.radius * DOF_SCALE;
    });

    // =================================================================
    // 9. GUI
    // =================================================================
    // 【対策】フルスクリーン GUI は既定でシーンと同じカメラで合成されるため、
    //         Bloom / 被写界深度 / シャープンが UI にも乗ってボケる。
    //         GUI 専用カメラを layerMask で分離する
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#2b2224", active: "#a33240", edge: "#4b3a3d",
        text: "#f6eded", sub: "#bfa8aa", accent: "#f0a8ac"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(17,12,13,0.80)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "16px";
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
    function spacer(h) {
        const s = new BABYLON.GUI.Rectangle();
        s.height = h; s.thickness = 0; s.background = "";
        panel.addControl(s);
    }

    addLabel("CHERRY", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    let curVariety = START_VARIETY, curSeed = START_SEED, curCount = START_COUNT;
    const varietyButtons = {}, countButtons = {};
    function highlight() {
        for (const k in varietyButtons) varietyButtons[k].background = (k === curVariety) ? COL.active : COL.idle;
        for (const k in countButtons) countButtons[k].background = (+k === curCount) ? COL.active : COL.idle;
    }
    for (const key of Object.keys(PRESETS)) {
        varietyButtons[key] = addButton("v_" + key, PRESETS[key].label, () => {
            curVariety = key; build(curVariety, curSeed, curCount); highlight();
        });
    }

    spacer("8px");
    addLabel("個数", 13, COL.accent, "22px");
    countButtons["1"] = addButton("c_1", "1個", () => { curCount = 1; build(curVariety, curSeed, curCount); highlight(); });
    countButtons["2"] = addButton("c_2", "双子（2個）", () => { curCount = 2; build(curVariety, curSeed, curCount); highlight(); });

    spacer("8px");
    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        build(curVariety, curSeed, curCount); highlight();
    });
    const rotateBtn = addButton("rotate", "自動回転: OFF", () => {
        camera.useAutoRotationBehavior = !camera.useAutoRotationBehavior;
        if (camera.autoRotationBehavior) camera.autoRotationBehavior.idleRotationSpeed = 0.1;
        rotateBtn.textBlock.text = "自動回転: " + (camera.useAutoRotationBehavior ? "ON" : "OFF");
        rotateBtn.background = camera.useAutoRotationBehavior ? COL.active : COL.idle;
    });
    let shadowOn = true;
    const shadowBtn = addButton("shadow", "影: ON", () => {
        shadowOn = !shadowOn;
        const sm = sg.getShadowMap();
        if (sm) sm.refreshRate = shadowOn
            ? BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME : 0;
        sg.setDarkness(shadowOn ? 0.44 : 1.0);
        shadowBtn.textBlock.text = "影: " + (shadowOn ? "ON" : "OFF");
        shadowBtn.background = shadowOn ? COL.active : COL.idle;
    });
    shadowBtn.background = COL.active;
    const dofBtn = addButton("dof", "被写界深度: ON", () => {
        dp.depthOfFieldEnabled = !dp.depthOfFieldEnabled;
        dofBtn.textBlock.text = "被写界深度: " + (dp.depthOfFieldEnabled ? "ON" : "OFF");
        dofBtn.background = dp.depthOfFieldEnabled ? COL.active : COL.idle;
    });
    dofBtn.background = COL.active;

    const info = addLabel("", 12, COL.sub, "56px");
    onRebuilt = (st) => {
        if (!info) return;
        const c0 = st.cherries[0];
        info.text = "果径 " + (c0.R * 2).toFixed(2) + "cm / 果高 "
            + (meridianAt(0.32).y * c0.H).toFixed(2) + "cm\n果柄 "
            + st.cfg.stemLength.toFixed(1) + "cm 前後\nseed: " + st.cfg.seed;
    };
    onRebuilt(state);
    highlight();

    return scene;
};

export default createScene;