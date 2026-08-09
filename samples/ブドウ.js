// =====================================================================
//  Photoreal Grape Cluster  /  写実的なブドウの房
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG / 品種プリセット
//    1. Rng          … シード付き擬似乱数（再現性の担保）
//    2. TextureLab   … 手続き的テクスチャ（法線 / ORM / 果粉マスク / クリアコート）
//    3. BerryFactory … 粒メッシュ（へそ・花柱痕・微細凹凸）とPBRマテリアル
//    4. Rachis       … 主軸・側枝・果梗のチューブ生成
//    5. GrapeCluster … 配置 → 重なり解消リラクゼーション → インスタンス化
//    6. Scene        … IBL / ライト / 影 / SSAO2 / トーンマッピング
//    7. GUI          … 品種切替・シード再生成・果粉スライダー（Babylon.GUI）
// =====================================================================

var createScene = function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const PRESETS = {
        // 実寸の目安: 粒径がそのまま基準（巨峰=約2.8cm → 1 unit ≒ 2.5cm）。
        // （巨峰は1房35〜45粒。ここを数百粒にすると房が破裂して嘘になる）

        // 巨峰: 大粒・濃紫・果粉が強い
        kyoho: {
            label: "巨峰",
            berryRadius: 0.55, berryRadiusSd: 0.050,
            elongation: [1.00, 1.14],          // やや縦長（卵形）
            hue: 291, sat: 0.50, val: 0.36,    // sRGB相当のHSV（後でリニアへ）
            hueJitter: 12,
            fleshTint: [0.52, 0.09, 0.20],
            bloomStrength: 1.00,
            skinRoughness: 0.30,
            clusterHeight: 6.2, clusterWidth: 2.50,
            berryCount: 38, unripeRatio: 0.03, density: 1.0
        },
        // シャインマスカット: 黄緑・明確な楕円・果粉は弱く光沢が強い
        shine: {
            label: "シャインマスカット",
            berryRadius: 0.52, berryRadiusSd: 0.042,
            elongation: [1.16, 1.34],
            hue: 76, sat: 0.52, val: 0.66,
            hueJitter: 9,
            fleshTint: [0.55, 0.60, 0.24],
            bloomStrength: 0.35,
            skinRoughness: 0.22,
            clusterHeight: 6.4, clusterWidth: 2.25,
            berryCount: 38, unripeRatio: 0.0, density: 1.0
        },
        // ピノ・ノワール: 小粒・超密着・肩が張る・ほぼ黒
        pinot: {
            label: "ピノ・ノワール",
            berryRadius: 0.32, berryRadiusSd: 0.030,
            elongation: [0.96, 1.06],
            hue: 297, sat: 0.55, val: 0.21,
            hueJitter: 14,
            fleshTint: [0.45, 0.07, 0.16],
            bloomStrength: 1.15,
            skinRoughness: 0.34,
            clusterHeight: 5.2, clusterWidth: 1.95,
            berryCount: 105, unripeRatio: 0.04, density: 1.0
        }
    };

    // 品種によらない共通設定
    const GLOBAL = {
        sag: 1.0,                          // 果重による垂れ下がり
        wingProbability: 0.85,             // 上部に「翼（副穂）」を作る確率
        relaxIterations: 80,               // 重なり解消の反復回数
        pedicelRatio: 0.75,                // 果梗長 / 粒半径
        showTendril: true,                 // 巻きひげ
        useRefraction: true,               // 果皮の屈折（弱め）
        useSSAO: true,                     // 接触部の陰り（写実性に必須）
        shapeVariants: 5,                  // 粒の形状バリエーション数
        textureSize: 128,                  // 手続きテクスチャの解像度（粒は小さいので128で十分）
        skinDetail: 1.0                    // 果皮の肌理の強さ。上げすぎると干しブドウになる
    };

    const START_VARIETY = "kyoho";          // 起動時の品種（GUIで切替可能）
    const START_SEED = 20260725;            // 同じseed → 同じ房（Math.randomは不使用）

    // 品種とシードから、その房ぶんの設定を組み立てる
    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        return cfg;
    }

    const V3 = BABYLON.Vector3;

    // =================================================================
    // 1. Rng : mulberry32（シード付き擬似乱数）
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
        // Box-Muller（正規分布）: 粒径や向きの自然なばらつきに使う
        gauss(mean, sd) {
            const u = Math.max(1e-9, this.next()), v = this.next();
            return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        }
        int(n) { return Math.floor(this.next() * n) % n; }
    }

    // ---- 小物ユーティリティ -----------------------------------------
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

    // HSV(sRGB相当) → リニア空間のColor3
    function hsv2linear(h, s, v) {
        h = (((h % 360) + 360) % 360) / 60;
        const c = v * s, x = c * (1 - Math.abs((h % 2) - 1)), m = v - c;
        let r = 0, g = 0, b = 0;
        if (h < 1) { r = c; g = x; } else if (h < 2) { r = x; g = c; }
        else if (h < 3) { g = c; b = x; } else if (h < 4) { g = x; b = c; }
        else if (h < 5) { r = x; b = c; } else { r = c; b = x; }
        return new BABYLON.Color3(r + m, g + m, b + m).toLinearSpace();
    }

    // 【対策】CreateTube は連続する重複点があると法線が壊れる → 事前に除去
    function dedupePath(points, eps) {
        eps = eps || 1e-4;
        const out = [points[0]];
        for (let i = 1; i < points.length; i++) {
            if (V3.Distance(points[i], out[out.length - 1]) > eps) out.push(points[i]);
        }
        return out.length >= 2 ? out : [points[0], points[0].add(new V3(0, -1e-3, 0))];
    }

    // =================================================================
    // 2. TextureLab : 手続き的テクスチャ生成（外部画像を使わない）
    // =================================================================
    const TextureLab = {
        // 周期性のある値ノイズ（U方向でタイル可能 → 球UVの継ぎ目を目立たせない）
        _hash(x, y, seed) {
            let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
        },
        _value(x, y, period, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            // 【対策】ここは1テクスチャあたり数百万回走る。
            //         wrap をクロージャで作ると生成コストとGCで桁違いに遅くなる。
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

        // 果皮の微細凹凸（法線マップ）: ハイライトを不均一に割る
        // 果皮の肌理（法線マップ）
        // 【対策】実物のブドウの表面は「シワ」ではなく、細かい肌理と皮目（レンズ状の点）。
        //         低周波のノイズを混ぜると、粒の周囲に十数本の畝ができて
        //         干しブドウ／梅干しに見える。高周波だけを弱く使うこと。
        normalMap(scene, size, seed, detail) {
            const P = 8;
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size * P, v = y / size * P;
                    // U方向に約20セル(肌理) + 約56セル(皮目)。畝に見える帯域は使わない
                    h[y * size + x] = this.fbm(u * 2.5, v * 2.5, P * 2.5, seed, 2) * 0.28
                                    + this.fbm(u * 7.0, v * 7.0, P * 7, seed + 77, 2) * 0.72;
                }
            }
            return this._canvasTexture("berryNormal", size, (d, S) => {
                const strength = 0.85 * (detail === undefined ? 1 : detail);
                for (let y = 0; y < S; y++) {
                    // 【対策】UV球は極でUが潰れるので、法線マップがそのまま
                    //         放射状のスターバーストとして出る。極付近はフェードする。
                    const vv = y / S;
                    const poleFade = smooth(0, 0.16, vv) * (1 - smooth(0.84, 1.0, vv));
                    const k = strength * poleFade;
                    for (let x = 0; x < S; x++) {
                        const xl = h[y * S + ((x - 1 + S) % S)], xr = h[y * S + ((x + 1) % S)];
                        const yu = h[((y - 1 + S) % S) * S + x], yd = h[((y + 1) % S) * S + x];
                        let nx = (xl - xr) * k, ny = (yu - yd) * k, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * S + x) * 4;
                        d[i] = (nx * 0.5 + 0.5) * 255;
                        d[i + 1] = (ny * 0.5 + 0.5) * 255;
                        d[i + 2] = (nz * 0.5 + 0.5) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // ORM (R=AO, G=Roughness, B=Metallic)。果粉が乗る面はラフを上げる
        ormMap(scene, size, seed, baseRough, mask) {
            const P = 6;
            return this._canvasTexture("berryORM", size, (d, S) => {
                for (let y = 0; y < S; y++) {
                    for (let x = 0; x < S; x++) {
                        const k = y * S + x;
                        const n = this.fbm(x / S * P, y / S * P, P, seed, 2);
                        const ao = 0.86 + 0.14 * n;
                        const rough = clamp(baseRough * (0.85 + 0.35 * n) + 0.62 * mask[k], 0.05, 1.0);
                        const i = k * 4;
                        d[i] = ao * 255; d[i + 1] = rough * 255; d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // 果粉（ブルーム）マスクを1枚だけ焼く。
        //  ・上向き（果梗側 = V小）ほど濃い
        //  ・触れ合う赤道付近は擦れて薄い
        //  ・雲状のムラを必ず入れる（均一な白濁は不自然）
        // 【対策】sheen / clearCoat / ORM の3枚が同じマスクを使うので、
        //         関数として渡すとノイズを3回計算することになる。配列に焼いて共有する。
        bloomMask(size, seed, strength) {
            const P = 5, m = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const vertical = 1.0 - smooth(0.30, 0.95, v);
                // 帯を狭く強くすると、粒の胴に一本線が入って萎びて見える
                const rubbed = 1.0 - 0.22 * Math.exp(-Math.pow((v - 0.55) / 0.24, 2));
                for (let x = 0; x < size; x++) {
                    const u = x / size;
                    const cloud = this.fbm(u * P, v * P * 0.7, P, seed, 3);
                    const cloud2 = this.fbm(u * P * 3.2, v * P * 2.4, P * 3, seed + 41, 2);
                    m[y * size + x] = clamp(
                        (0.35 + 0.85 * cloud) * (0.55 + 0.45 * cloud2)
                        * (0.45 + 0.75 * vertical) * rubbed * strength, 0, 1);
                }
            }
            return m;
        },
        sheenMap(scene, size, mask) {
            return this._canvasTexture("berrySheen", size, (d, S) => {
                for (let k = 0; k < S * S; k++) {
                    const m = mask[k] * 255, i = k * 4;
                    d[i] = m; d[i + 1] = m; d[i + 2] = m; d[i + 3] = 255;
                }
            }, scene);
        },
        // クリアコート(ロウ層): R=強度, G=ラフネス。果粉が厚い所ほどツヤが鈍る
        clearCoatMap(scene, size, mask) {
            return this._canvasTexture("berryCC", size, (d, S) => {
                for (let k = 0; k < S * S; k++) {
                    const m = mask[k], i = k * 4;
                    d[i] = (1.0 - 0.72 * m) * 255;          // intensity
                    d[i + 1] = (0.06 + 0.55 * m) * 255;     // roughness
                    d[i + 2] = 0; d[i + 3] = 255;
                }
            }, scene);
        }
    };

    // =================================================================
    // 3. BerryFactory : 粒メッシュ + PBRマテリアル
    // =================================================================
    class BerryFactory {
        constructor(scene, rng, cfg) {
            this.scene = scene; this.rng = rng; this.cfg = cfg;
            const S = cfg.textureSize;
            // 肌理だけは高周波なので、法線マップのみ2倍の解像度で焼く
            this.normalTex = TextureLab.normalMap(scene, S * 2, 1234, cfg.skinDetail);
            this.masks = [0, 1, 2].map(i =>
                TextureLab.bloomMask(S, 900 + i * 313, cfg.bloomStrength));
            this.ormTexs = this.masks.map((m, i) =>
                TextureLab.ormMap(scene, S, 500 + i * 97, cfg.skinRoughness, m));
            this.sheenTexs = this.masks.map(m => TextureLab.sheenMap(scene, S, m));
            this.ccTexs = this.masks.map(m => TextureLab.clearCoatMap(scene, S, m));
            this.variants = [];
            this._build();
        }

        // ---- 粒の素メッシュ（真球からの逸脱をここで作る） ------------
        _makeMesh(name, seed) {
            const r = new Rng(seed);
            const m = BABYLON.MeshBuilder.CreateSphere(name,
                { diameter: 1, segments: 28, updatable: true }, this.scene);

            const pos = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const idx = m.getIndices();
            const nrm = m.getVerticesData(BABYLON.VertexBuffer.NormalKind);

            // 低周波ノイズ用のランダム位相（個体ごとに違う歪み）
            const ph = [r.range(0, 9), r.range(0, 9), r.range(0, 9)];

            for (let i = 0; i < pos.length; i += 3) {
                let x = pos[i], y = pos[i + 1], z = pos[i + 2];
                const u = y * 2;                     // -1(花柱痕側) .. +1(果梗側)

                // (a) へそ: 果梗接続部を内側へ凹ませる
                const kNavel = smooth(0.78, 1.0, u);
                let f = 1 - 0.22 * kNavel;          // 深すぎると萎びた印象になる
                x *= f; z *= f; y -= 0.055 * kNavel;

                // (b) 花柱痕: 反対極にごく小さな尖り
                const kStyle = smooth(-0.90, -1.0, u);
                y -= 0.020 * kStyle;

                // (c) 低周波の不整形（真球に見せない）
                const wob = 1
                    + 0.030 * Math.sin(3.1 * x + ph[0]) * Math.cos(2.7 * z + ph[1])
                    + 0.018 * Math.sin(4.6 * y + ph[2]);
                x *= wob; y *= wob; z *= wob;

                pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
            }
            // 【対策】変形したら法線を必ず再計算（忘れると陰影が破綻する）
            BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
            m.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
            m.updateVerticesData(BABYLON.VertexBuffer.NormalKind, nrm);

            // 【対策】インスタンス色を使うため、素メッシュにも白の頂点カラーを持たせる。
            //         こうしておくとVERTEXCOLORのdefineが確実に立ち、
            //         万一インスタンスバッファが効かなくてもマテリアル色にフォールバックする。
            const vc = new Float32Array((pos.length / 3) * 4).fill(1);
            m.setVerticesData(BABYLON.VertexBuffer.ColorKind, vc, false, 4);
            m.hasVertexAlpha = false;   // α=1固定。trueだと透明扱いになり描画順が壊れる
            m.registerInstancedBuffer("color", 4);
            return m;
        }

        // ---- 果実のPBR: 表皮ロウ層 + 果粉 + 内部透過 -----------------
        _makeMaterial(name, albedo, variantIdx) {
            const cfg = this.cfg;
            const pbr = new BABYLON.PBRMaterial(name, this.scene);
            pbr.albedoColor = albedo;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;                      // 実値はORMテクスチャのG channel
            pbr.metallicTexture = this.ormTexs[variantIdx % 3];
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            pbr.bumpTexture.level = 0.40;   // これ以上上げると皮が萎びて見える

            // 果皮のロウ層（クリアコート）: 鋭い二次ハイライトを作る
            pbr.clearCoat.isEnabled = true;
            pbr.clearCoat.intensity = 0.85;
            pbr.clearCoat.roughness = 0.10;
            pbr.clearCoat.texture = this.ccTexs[variantIdx % 3];  // R=強度 / G=粗さ
            pbr.clearCoat.useRoughnessFromMainTexture = true;

            // 果粉（ブルーム）: αブレンドを使わず sheen で粉っぽさを出す。
            // 【対策】強度0でも isEnabled は true のままにする。
            //         falseにするとGUIのスライダーから復帰できない。
            pbr.sheen.isEnabled = true;
            pbr.sheen.intensity = 0.9 * cfg.bloomStrength;
            pbr.sheen.color = new BABYLON.Color3(0.86, 0.88, 0.93);
            pbr.sheen.texture = this.sheenTexs[variantIdx % 3];
            pbr.sheen.useRoughnessFromMainTexture = false;
            pbr.sheen.roughness = 0.95;
            pbr.sheen.albedoScaling = true;           // エネルギー保存（白飛び防止）

            // 果肉の透過（逆光で内部が透ける）
            const t = cfg.fleshTint;
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(t[0], t[1], t[2]);
            pbr.subSurface.translucencyIntensity = 1.0;
            pbr.subSurface.minimumThickness = 0.15;
            pbr.subSurface.maximumThickness = cfg.berryRadius * 2.0;
            pbr.subSurface.tintColorAtDistance = cfg.berryRadius * 1.6;
            if (cfg.useRefraction) {
                pbr.subSurface.isRefractionEnabled = true;
                pbr.subSurface.refractionIntensity = 0.14;   // 強くすると宝石的になりすぎる
                pbr.indexOfRefraction = 1.35;
                if ("indexOfRefraction" in pbr.subSurface) pbr.subSurface.indexOfRefraction = 1.35;
            }
            return pbr;
        }

        _build() {
            const cfg = this.cfg, r = this.rng;
            const n = cfg.shapeVariants;
            for (let i = 0; i < n; i++) {
                const k = n > 1 ? i / (n - 1) : 0.5;   // n=1 でも壊れないように
                // 熟度の異なる系統色。粒ごとの微差はインスタンスカラーで上乗せする
                const hue = cfg.hue + (k - 0.5) * cfg.hueJitter * 2;
                const val = cfg.val * (0.82 + 0.36 * k);
                const mesh = this._makeMesh("berrySrc" + i, 7000 + i * 911);
                mesh.material = this._makeMaterial("berryMat" + i, hsv2linear(hue, cfg.sat, val), i);
                mesh.receiveShadows = true;
                this.variants.push({ mesh, used: 0, unripe: false });
            }
            // 未熟粒（緑）: 乗算では紫を緑にできないので専用バリアントを持つ
            if (cfg.unripeRatio > 0) {
                const mesh = this._makeMesh("berrySrcUnripe", 4242);
                mesh.material = this._makeMaterial("berryMatUnripe",
                    hsv2linear(102, 0.42, Math.max(cfg.val, 0.34) * 1.25), 1);
                mesh.material.subSurface.tintColor = new BABYLON.Color3(0.40, 0.52, 0.20);
                mesh.receiveShadows = true;
                this.variants.push({ mesh, used: 0, unripe: true });
            }
        }

        // 房を作り直すときに呼ぶ。粒メッシュとテクスチャは品種ごとに使い回し、
        // インスタンスだけを捨てる。
        // 【対策】品種を切り替えるたびに手続きテクスチャを再生成すると、
        //         クリックのたびにブラウザが数百ms固まる。マテリアルは品種単位でキャッシュする。
        reset() {
            for (const v of this.variants) {
                const insts = (v.mesh.instances || []).slice();
                for (const inst of insts) inst.dispose();
                v.used = 0;
                // 【対策】ここで setEnabled(true) にすると、他品種に切り替えたあと
                //         使われなくなった素メッシュが直径1の白い球として原点に残る。
                //         必ず無効化し、実際に粒として使うときに _instantiate 側で戻す。
                v.mesh.setEnabled(false);
                v.mesh.position.set(0, 0, 0);
                v.mesh.rotationQuaternion = null;
                v.mesh.scaling.set(1, 1, 1);
            }
        }

        // シーンを畳むときに使う。テクスチャまで確実に解放する。
        dispose() {
            for (const v of this.variants) {
                if (v.mesh.material) v.mesh.material.dispose(true, false); // テクスチャは共有なので個別に
                v.mesh.dispose();                                          // インスタンスも一緒に破棄される
            }
            const texs = [this.normalTex].concat(this.ormTexs, this.sheenTexs, this.ccTexs);
            for (const t of texs) t.dispose();
            this.variants.length = 0;
        }

        pickVariant(rnd) {
            const ripe = this.variants.filter(v => !v.unripe);
            const unripe = this.variants.filter(v => v.unripe);
            if (unripe.length && rnd.next() < this.cfg.unripeRatio) return unripe[0];
            return ripe[rnd.int(ripe.length)];
        }
    }

    // =================================================================
    // 4. Rachis : 主軸・側枝・果梗
    // =================================================================
    function tubeFromControls(name, ctrl, r0, r1, tess, scene) {
        const path = dedupePath(
            BABYLON.Curve3.CreateCatmullRomSpline(ctrl, 8, false).getPoints());
        const tube = BABYLON.MeshBuilder.CreateTube(name, {
            path, tessellation: tess, cap: BABYLON.Mesh.CAP_ALL,
            radiusFunction: (i) => {
                const t = i / (path.length - 1);
                // 【対策】半径0はNaN/描画崩れの原因 → 必ず下限でクランプ
                return Math.max(0.012, r0 + (r1 - r0) * t);
            }
        }, scene);
        return { mesh: tube, path };
    }

    // 軸の色: 基部は木質化した褐色、先端ほど緑（頂点カラーで表現）
    function colorizeStem(mesh, axisWidth) {
        const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const col = new Float32Array((pos.length / 3) * 4);
        const woody = new BABYLON.Color3(0.115, 0.070, 0.038).toLinearSpace();
        const green = new BABYLON.Color3(0.230, 0.245, 0.105).toLinearSpace();
        for (let i = 0, c = 0; i < pos.length; i += 3, c += 4) {
            const d = Math.hypot(pos[i], pos[i + 2]);
            const f = clamp(d / (axisWidth * 0.55), 0, 1);
            col[c] = woody.r + (green.r - woody.r) * f;
            col[c + 1] = woody.g + (green.g - woody.g) * f;
            col[c + 2] = woody.b + (green.b - woody.b) * f;
            col[c + 3] = 1;
        }
        mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // =================================================================
    // 5. GrapeCluster
    // =================================================================
    class GrapeCluster {
        constructor(scene, rng, cfg, factory) {
            this.scene = scene; this.rng = rng; this.cfg = cfg; this.factory = factory;
            this.berries = [];
            this.stemParts = [];
            this._buildRachis();
            this._buildBranches();
            this._relax();
            this._buildPedicels();
            this._instantiate();
            this._mergeStems();
            if (cfg.showTendril) this._buildTendril();
        }

        // 房の外形（円錐ではなく「肩の張った逆円錐」）
        envelope(t) {
            const s = smooth(0, 0.17, t);
            return this.cfg.clusterWidth * (0.44 + 0.56 * s) * Math.pow(Math.max(1e-4, 1 - t), 0.62);
        }

        _buildRachis() {
            const H = this.cfg.clusterHeight, r = this.rng, ctrl = [];
            for (let i = 0; i <= 6; i++) {
                const t = i / 6;
                const bend = Math.pow(t, 1.4);
                ctrl.push(new V3(
                    Math.sin(t * 3.0 + 0.7) * H * 0.045 * bend + r.gauss(0, 0.012) * H,
                    H * 0.16 - t * H * 1.04,
                    Math.cos(t * 2.2 + 1.9) * H * 0.032 * bend
                ));
            }
            const { mesh, path } = tubeFromControls("rachis", ctrl,
                H * 0.020, H * 0.0065, 12, this.scene);
            this.rachisPath = path;
            this.stemParts.push(mesh);
        }

        _pointOnPath(path, t) {
            const f = clamp(t, 0, 1) * (path.length - 1);
            const i = Math.min(path.length - 2, Math.floor(f));
            return V3.Lerp(path[i], path[i + 1], f - i);
        }

        _buildBranches() {
            const cfg = this.cfg, r = this.rng;
            const nBranch = Math.max(6, Math.round(cfg.clusterHeight * 1.6));
            const GOLDEN = 2.399963;
            this.branches = [];

            for (let j = 0; j < nBranch; j++) {
                // t=0 付近は果梗（房柄）として空けておく。ここを詰めると房の頭が丸くなる
                let t = 0.13 + 0.85 * (j / (nBranch - 1)) + r.gauss(0, 0.015);
                t = clamp(t, 0.08, 0.99);
                const a = j * GOLDEN + r.gauss(0, 0.22);
                const ox = Math.cos(a), oz = Math.sin(a);

                // 【対策】枝長を envelope そのものにすると、枝先に付く粒の分だけ房が太る。
                //         粒半径を引いておかないと想定の 1.5 倍の直径になる。
                let L = Math.max(cfg.berryRadius * 1.4,
                    this.envelope(t) - cfg.berryRadius * 1.15) * r.range(0.78, 1.0);
                // 翼（副穂）: 上部の枝だけを長くし、その枝の粒には外形制限を緩める
                const isWing = (j <= 1) && (r.next() < cfg.wingProbability);
                const envScale = isWing ? 1.20 : 1.0;
                if (isWing) L *= 1.22;

                // 主軸上の起点 + 起点付近は少しだけ上へ跳ねてから垂れる
                const p0 = this._pointOnPath(this.rachisPath, t * 0.94 + 0.03);
                const sag = cfg.sag;
                const ctrl = [
                    p0,
                    p0.add(new V3(ox * L * 0.32, L * 0.03 - L * 0.06 * sag, oz * L * 0.32)),
                    p0.add(new V3(ox * L * 0.70, -L * 0.24 * sag, oz * L * 0.70)),
                    p0.add(new V3(ox * L * 1.00, -L * 0.54 * sag, oz * L * 1.00))
                ];
                const { mesh, path } = tubeFromControls("branch" + j, ctrl,
                    Math.max(0.030, L * 0.032), Math.max(0.016, L * 0.014), 8, this.scene);
                this.stemParts.push(mesh);
                this.branches.push({ path, L, t, ox, oz, isWing, envScale });
            }

            // 枝長に比例して粒数を配分（房全体で berryCount 個になるように）
            const total = this.branches.reduce((s, b) => s + b.L * (b.isWing ? 1.35 : 1), 0);
            const budget = Math.round(cfg.berryCount * cfg.density);
            for (const b of this.branches) {
                const share = (b.L * (b.isWing ? 1.35 : 1)) / total;
                b.count = Math.max(1, Math.round(budget * share));
            }
            for (const b of this.branches) this._seedBerries(b);
        }

        _seedBerries(b) {
            const cfg = this.cfg, r = this.rng;
            for (let k = 0; k < b.count; k++) {
                const s = clamp(r.range(0.12, 1.0), 0, 1);
                const anchor = this._pointOnPath(b.path, s);
                // 粒径: 下部・房内部ほど小さい
                const sizeBias = 1.0 - 0.16 * b.t - 0.10 * (1 - s);
                const rad = Math.max(0.12,
                    r.gauss(cfg.berryRadius * sizeBias, cfg.berryRadiusSd));
                // 方向: 外向き + 下向きバイアス + ランダム
                const dir = new V3(
                    r.gauss(0, 1) + b.ox * 1.1,
                    r.gauss(0, 1) - 1.15,
                    r.gauss(0, 1) + b.oz * 1.1
                ).normalize();
                const ped = rad * cfg.pedicelRatio * r.range(0.7, 1.3);
                const center = anchor.add(dir.scale(rad + ped));
                this.berries.push({
                    c: center, r: rad, anchor, branch: b, envScale: b.envScale, touch: 0,
                    elong: r.range(cfg.elongation[0], cfg.elongation[1]),
                    flat: r.range(0.94, 1.05),
                    spin: r.range(0, Math.PI * 2),
                    tiltA: r.gauss(0, 0.16), tiltB: r.range(0, Math.PI * 2),
                    tone: r.gauss(1.0, 0.13),
                    hueShift: r.gauss(0, 0.055),
                    variant: this.factory.pickVariant(r)
                });
            }
        }

        // 果梗の起点を、緩和後の位置から見て最寄りの枝上の点に取り直す。
        // 【対策】単純な最近傍だと起点が粒の内部に入り、果梗が消える（果梗長が負になる）。
        //         粒に埋まる点は候補から除外する。
        _reanchor() {
            for (const b of this.berries) {
                let best = null, bd = Infinity;
                for (const p of b.branch.path) {
                    const d = V3.DistanceSquared(p, b.c);
                    if (d < (b.r * 1.15) * (b.r * 1.15)) continue;
                    if (d < bd) { bd = d; best = p; }
                }
                if (best) b.anchor = best;
            }
        }

        // 配置後の緩和: 外形に収めて重力で締め、最後に相互貫通を解消する
        _relax() {
            const cfg = this.cfg, B = this.berries;
            const H = cfg.clusterHeight;
            const reanchorAt = Math.floor(cfg.relaxIterations * 0.5);

            for (let it = 0; it < cfg.relaxIterations; it++) {
                const settle = 0.5 * (1 - it / cfg.relaxIterations); // 序盤ほど強く締める
                if (it === reanchorAt) this._reanchor();             // 拘束が効いた状態で取り直す

                // (1) 重力＋外形への収め（房の直径はここで決まる）
                for (const b of B) {
                    b.c.y -= 0.012 * settle * b.r;
                    const t = clamp(-b.c.y / H, 0, 1);
                    const rad = Math.hypot(b.c.x, b.c.z);
                    if (rad < 1e-4) continue;
                    // envelope は粒の外表面の半径。中心はそこから粒半径だけ内側
                    const target = Math.max(b.r * 0.4, this.envelope(t) * b.envScale - b.r);
                    // 内側なら軽く外へ、外側なら確実に内へ（ハードクランプ）
                    let s;
                    if (rad > target) s = (target + (rad - target) * 0.35) / rad;
                    else s = 1 - (rad - target * 0.86) * 0.05 * settle / rad;
                    b.c.x *= s; b.c.z *= s;
                }

                // (2) 果梗長の拘束（枝から離れすぎ・近すぎを戻す）
                for (const b of B) {
                    const v = b.c.subtract(b.anchor);
                    const d = v.length();
                    const lo = b.r * 1.06, hi = b.r * (1.0 + cfg.pedicelRatio * 2.0);
                    if (d > hi) b.c = b.anchor.add(v.scale(hi / d));
                    else if (d < lo) b.c = b.anchor.add(v.scale(lo / Math.max(d, 1e-4)));
                }

                // (3) 主軸との干渉回避（粒が軸にめり込むと嘘っぽくなる）
                for (const b of B) {
                    const rad = Math.hypot(b.c.x, b.c.z);
                    const minR = b.r + H * 0.018;
                    if (rad < minR) {
                        const s = rad < 1e-4 ? 1 : minR / rad;
                        b.c.x = (b.c.x || 1e-3) * s; b.c.z = (b.c.z || 1e-3) * s;
                    }
                }

                // (4) 相互貫通の解消。
                // 【対策】これを最後に置く。他の拘束の後に走らせないと、
                //         せっかく離した粒が果梗拘束で再びめり込む。
                //         0.985 でごく僅かな押し合いだけ許容 → 接触面が生まれる
                this._separateOnce(1.0);
            }

            // 最終保証: 果梗が必ず正の長さを持つようにする
            this._reanchor();
            for (const b of B) {
                const v = b.c.subtract(b.anchor);
                const d = v.length();
                if (d < b.r * 1.06) b.c = b.anchor.add(v.scale((b.r * 1.06) / Math.max(d, 1e-4)));
            }
            // 【対策】Gauss-Seidel の1パスでは押し出しが収束しきらない。
            //         最後に分離だけを数回まわして、貫通を確実に潰す。
            for (let pass = 0; pass < 8; pass++) this._separateOnce(1.0);
        }

        _separateOnce(strength) {
            const B = this.berries, n = B.length;
            for (const b of B) b.touch = 0;
            for (let i = 0; i < n; i++) {
                const a = B[i];
                for (let j = i + 1; j < n; j++) {
                    const b = B[j];
                    const dx = a.c.x - b.c.x, dy = a.c.y - b.c.y, dz = a.c.z - b.c.z;
                    const minD = (a.r + b.r) * 0.985;
                    const d2 = dx * dx + dy * dy + dz * dz;
                    if (d2 >= minD * minD || d2 < 1e-9) continue;
                    const d = Math.sqrt(d2);
                    const push = (minD - d) * 0.5 * strength;
                    const nx = dx / d, ny = dy / d, nz = dz / d;
                    a.c.x += nx * push; a.c.y += ny * push; a.c.z += nz * push;
                    b.c.x -= nx * push; b.c.y -= ny * push; b.c.z -= nz * push;
                    a.touch++; b.touch++;
                }
            }
        }

        _buildPedicels() {
            const parts = [];
            for (const b of this.berries) {
                const dir = b.c.subtract(b.anchor);
                const len = dir.length();
                if (len < 1e-3) continue;
                dir.normalize();
                // 粒の内部（半径×0.85）まで挿す → 浮きも貫通も起きない
                const tip = b.c.subtract(dir.scale(b.r * 0.85));
                const mid = V3.Lerp(b.anchor, tip, 0.5)
                    .add(new V3(0, -len * 0.12, 0));  // 自重で軽く弓なりに
                const { mesh } = tubeFromControls("ped", [b.anchor, mid, tip],
                    b.r * 0.075, b.r * 0.058, 6, this.scene);
                parts.push(mesh);
            }
            this.pedicelParts = parts;
        }

        _instantiate() {
            const up = V3.Up();
            for (const b of this.berries) {
                const v = b.variant;
                const dir = b.c.subtract(b.anchor).normalize();   // へそが向く方向

                // 姿勢: ローカル+Y(へそ)を果梗方向へ合わせ、軸周りにランダム回転＋傾き
                const q = new BABYLON.Quaternion();
                BABYLON.Quaternion.FromUnitVectorsToRef(up, dir, q);
                const spin = BABYLON.Quaternion.RotationAxis(dir, b.spin);
                const tiltAxis = new V3(Math.cos(b.tiltB), 0, Math.sin(b.tiltB));
                const tilt = BABYLON.Quaternion.RotationAxis(tiltAxis, b.tiltA);
                const rot = tilt.multiply(spin.multiply(q));

                // 押し合いの多い粒はわずかに扁平化（密着房の平面）
                const squash = 1 - Math.min(0.055, (b.touch || 0) * 0.014);
                const d = b.r * 2;
                const scale = new V3(d * b.flat * squash, d * b.elong, d / b.flat * squash);

                // 素メッシュ1つ目はそのまま1粒として使う（非表示メッシュを作らない）
                let node;
                if (v.used === 0) {
                    node = v.mesh;          // 1粒目は素メッシュ自身を使う
                    node.setEnabled(true);
                } else {
                    node = v.mesh.createInstance("berry_" + v.mesh.name + "_" + v.used);
                }
                v.used++;
                node.position.copyFrom(b.c);
                node.rotationQuaternion = rot;
                node.scaling.copyFrom(scale);

                // 粒ごとの色差（マテリアル色に対する乗算的な変調）
                const t = clamp(b.tone, 0.62, 1.35);
                const h = b.hueShift;
                const col = new BABYLON.Color4(
                    clamp(t * (1 + h), 0, 2), clamp(t * (1 - Math.abs(h) * 0.5), 0, 2),
                    clamp(t * (1 - h), 0, 2), 1);
                if (node.instancedBuffers) node.instancedBuffers.color = col;
            }
            // 【対策】1粒も割り当てられなかったバリアントは素メッシュが原点に
            //         白い球として残ってしまう。必ず無効化する。
            for (const v of this.factory.variants) {
                if (v.used === 0) v.mesh.setEnabled(false);
            }
        }

        _mergeStems() {
            const all = this.stemParts.concat(this.pedicelParts);
            for (const m of all) colorizeStem(m, this.cfg.clusterWidth);
            const merged = BABYLON.Mesh.MergeMeshes(all, true, true);
            const mat = new BABYLON.PBRMaterial("stemMat", this.scene);
            mat.albedoColor = new BABYLON.Color3(1, 1, 1);   // 実色は頂点カラー
            mat.metallic = 0.0;
            mat.roughness = 0.72;
            // 果実と同じテクスチャを共有する（level は共有インスタンスなので上書きしない）
            mat.bumpTexture = this.factory.normalTex;
            mat.subSurface.isTranslucencyEnabled = true;      // 若い果梗の緑が透ける
            mat.subSurface.tintColor = new BABYLON.Color3(0.28, 0.34, 0.10);
            mat.subSurface.translucencyIntensity = 0.45;
            mat.subSurface.maximumThickness = 0.12;
            merged.material = mat;
            merged.receiveShadows = true;
            merged.name = "stems";
            this.stems = merged;
        }

        _buildTendril() {
            const H = this.cfg.clusterHeight, r = this.rng;
            const start = this._pointOnPath(this.rachisPath, 0.015);
            const dirA = r.range(0, Math.PI * 2);
            // 巻きひげは「水平に伸びてから、進行方向そのものを軸にして巻く」。
            // 【対策】鉛直軸まわりに巻くと平たい渦になり、板が刺さったように見える。
            const ax = Math.cos(dirA), az = Math.sin(dirA);      // 伸びる向き
            const wx = -Math.sin(dirA), wz = Math.cos(dirA);     // 巻きの基底（水平・直交）
            const N = 60, reach = H * 0.20, turns = 3.0;
            const ctrl = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const coil = clamp((t - 0.30) / 0.70, 0, 1);     // 前半は真っ直ぐ伸びる
                const rad = H * 0.028 * smooth(0, 0.30, coil);
                const ang = coil * turns * Math.PI * 2;
                const c = Math.cos(ang) - 1, sn = Math.sin(ang);
                ctrl.push(new V3(
                    start.x + ax * reach * t + wx * sn * rad,
                    start.y + H * 0.055 * t - H * 0.045 * t * t + c * rad,
                    start.z + az * reach * t + wz * sn * rad
                ));
            }
            const { mesh } = tubeFromControls("tendril", ctrl, H * 0.005, H * 0.0026, 6, this.scene);
            colorizeStem(mesh, this.cfg.clusterWidth * 0.6);
            mesh.material = this.stems.material;
            mesh.receiveShadows = true;
            this.tendril = mesh;
        }

        dispose() {
            if (this.tendril) this.tendril.dispose();
            if (this.stems) {
                if (this.stems.material) this.stems.material.dispose(true, false);
                this.stems.dispose();
            }
            this.berries.length = 0;
        }

        get shadowCasters() {
            const list = this.factory.variants.map(v => v.mesh);
            list.push(this.stems);
            if (this.tendril) list.push(this.tendril);
            return list;
        }
    }

    // =================================================================
    // 6. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.05, 1);

    // --- IBL: PBRは環境テクスチャが無いと成立しない（最重要）
    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.95;
    scene.createDefaultSkybox(env, true, 1000, 0.42, false);

    // --- カメラ（房のサイズは品種で変わるので、生成後にフレーミングし直す）
    const camera = new BABYLON.ArcRotateCamera("cam",
        -1.05, 1.19, 13, new V3(0, -3, 0), scene);
    camera.attachControl(true);
    camera.wheelPrecision = 18;
    camera.minZ = 0.05;
    scene.cameraToUseForPointers = camera;

    // --- ライト（キー + 逆光リム: リムが無いと透過が見えない）
    const H0 = 6.5;   // ライト配置用の基準スケール
    const key = new BABYLON.DirectionalLight("key", new V3(-0.55, -0.95, 0.45).normalize(), scene);
    key.position = new V3(H0 * 1.2, H0 * 1.8, -H0 * 1.0);
    key.intensity = 3.4;
    key.diffuse = new BABYLON.Color3(1.0, 0.97, 0.92);
    key.autoCalcShadowZBounds = true;

    const rim = new BABYLON.DirectionalLight("rim", new V3(0.45, -0.30, -1.0).normalize(), scene);
    rim.intensity = 4.6;
    rim.diffuse = new BABYLON.Color3(1.0, 0.92, 0.82);
    rim.specular = new BABYLON.Color3(0.6, 0.6, 0.6);

    const fill = new BABYLON.HemisphericLight("fill", new V3(0, 1, 0), scene);
    fill.intensity = 0.12;

    // --- 影（房の内部に落ちる自己遮蔽が立体感を生む）
    const sg = new BABYLON.ShadowGenerator(1024, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.bias = 0.006;
    sg.normalBias = 0.02;

    // --- トーンマッピング（ACES）: 紫の飽和と白飛びを防ぐ
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.15;
    ip.contrast = 1.35;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 2.2;
    ip.vignetteCameraFov = 0.7;
    ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    // =================================================================
    //  房の生成 / 差し替え
    // =================================================================
    let state = null;          // { cfg, factory, cluster }
    const factoryCache = {};   // 品種 → BerryFactory（テクスチャの再生成を避ける）
    let ssao = null;           // 後段で生成（房の粒径に合わせて半径を更新する）
    let onClusterRebuilt = null;   // GUI側のコールバック

    function buildCluster(varietyKey, seed) {
        // 【対策】差し替え時は必ず前の房を破棄する。
        //         メッシュだけ消してテクスチャを残すと、切替のたびにVRAMが増え続ける。
        let prevFactory = null;
        if (state) {
            state.cluster.dispose();       // 軸・果梗・巻きひげを破棄
            prevFactory = state.factory;
            prevFactory.reset();           // 粒のインスタンスだけ破棄（メッシュとテクスチャは再利用）
            state = null;
        }

        const cfg = buildConfig(varietyKey, seed);
        const rng = new Rng(cfg.seed);

        // 粒メッシュとマテリアルは品種だけで決まるのでキャッシュできる
        let factory = factoryCache[varietyKey];
        if (!factory) {
            // 生成直後は used=0 なので reset 不要
            factory = new BerryFactory(scene, new Rng(cfg.seed), cfg);
            factoryCache[varietyKey] = factory;
        } else if (factory !== prevFactory) {
            factory.reset();               // 同じ factory を二度 reset しない
        }

        const cluster = new GrapeCluster(scene, rng, cfg, factory);
        state = { cfg, factory, cluster };

        // 影のキャスターを張り替える（古いメッシュはdisposeで自動的に外れる）
        const shadowMap = sg.getShadowMap();
        if (shadowMap && shadowMap.renderList) shadowMap.renderList.length = 0;
        for (const m of cluster.shadowCasters) sg.addShadowCaster(m, true);

        // 品種で房のサイズが変わるのでフレーミングを合わせる。
        // 【対策】camera.setTarget() は alpha/beta/radius を再計算してしまい、
        //         ユーザーが回した視点がリセットされる。target を直接書き換える。
        const H = cfg.clusterHeight;
        camera.target.set(0, -H * 0.47, 0);
        camera.radius = H * 2.05;
        camera.lowerRadiusLimit = H * 0.5;
        camera.upperRadiusLimit = H * 6;

        if (ssao) ssao.radius = cfg.berryRadius * 1.6;
        if (onClusterRebuilt) onClusterRebuilt(state);

        console.log("[GrapeCluster]", cfg.label, "/ berries =", cluster.berries.length,
            "/ seed =", cfg.seed);
        return state;
    }

    // 果粉の強さだけはリビルド不要（sheenの強度を差し替えるだけ）
    function applyBloomStrength(v) {
        if (!state) return;
        for (const variant of state.factory.variants) {
            const mat = variant.mesh.material;
            if (mat && mat.sheen) mat.sheen.intensity = 0.9 * v;
        }
    }

    buildCluster(START_VARIETY, START_SEED);

    // --- ポストプロセス
    // 【対策】SSAO2 → DefaultRenderingPipeline の順で生成する。
    //         逆順にすると環境によって描画が黒く抜けることがある。
    if (state.cfg.useSSAO) {
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        ssao.radius = state.cfg.berryRadius * 1.6;
        ssao.totalStrength = 1.35;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = H0 * 8;
        ssao.minZAspect = 0.25;
    }
    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.88;
    dp.bloomWeight = 0.22;
    dp.bloomKernel = 48;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.22;
    dp.depthOfFieldEnabled = true;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
    dp.depthOfField.fStop = 3.2;
    dp.depthOfField.focalLength = 85;
    dp.depthOfField.focusDistance = camera.radius * 1000;   // mm

    scene.onBeforeRenderObservable.add(() => {
        if (dp.depthOfFieldEnabled) dp.depthOfField.focusDistance = camera.radius * 1000;
    });

    // =================================================================
    // 7. GUI （Babylon.GUI）
    // =================================================================
    // 【対策】フルスクリーンGUIは既定だとシーンと同じカメラで合成されるため、
    //         Bloom / 被写界深度 / シャープンがUIにも乗ってボケる。
    //         GUI専用カメラを layerMask で分離し、ポストプロセスの外に出す。
    const GUI_MASK = 0x20000000;
    const guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
    guiCam.layerMask = GUI_MASK;
    scene.activeCameras = [camera, guiCam];

    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.layerMask = GUI_MASK;

    const COL = {
        idle: "#2b2733", active: "#6d4b8f", edge: "#4a4356",
        text: "#ece7f2", sub: "#a99fb8", accent: "#c9a6e6"
    };

    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "232px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10;
    card.thickness = 1;
    card.color = COL.edge;
    card.background = "rgba(16,14,20,0.80)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px";
    card.top = "16px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "200px";
    panel.isVertical = true;
    panel.paddingTop = "14px";
    panel.paddingBottom = "14px";
    card.addControl(panel);

    function addLabel(text, size, color, height) {
        const t = new BABYLON.GUI.TextBlock();
        t.text = text;
        t.height = height || "22px";
        t.color = color || COL.text;
        t.fontSize = size || 13;
        t.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        t.textWrapping = true;
        panel.addControl(t);
        return t;
    }
    function addButton(name, text, onClick) {
        const b = BABYLON.GUI.Button.CreateSimpleButton(name, text);
        b.height = "36px";
        b.paddingBottom = "6px";
        b.color = COL.text;
        b.background = COL.idle;
        b.cornerRadius = 6;
        b.thickness = 0;
        b.fontSize = 14;
        b.onPointerUpObservable.add(onClick);
        panel.addControl(b);
        return b;
    }

    addLabel("BUNCH OF GRAPES", 11, COL.sub, "18px");
    addLabel("品種", 13, COL.accent, "22px");

    let currentVariety = START_VARIETY;
    let currentSeed = START_SEED;
    const varietyButtons = {};

    function highlight() {
        for (const k in varietyButtons) {
            varietyButtons[k].background = (k === currentVariety) ? COL.active : COL.idle;
        }
    }
    function switchTo(key, seed) {
        currentVariety = key;
        currentSeed = seed >>> 0;
        buildCluster(currentVariety, currentSeed);
        highlight();
    }

    for (const key of Object.keys(PRESETS)) {
        varietyButtons[key] = addButton("v_" + key, PRESETS[key].label,
            () => switchTo(key, currentSeed));
    }
    highlight();

    const spacer = new BABYLON.GUI.Rectangle();
    spacer.height = "10px"; spacer.thickness = 0; spacer.background = "";
    panel.addControl(spacer);

    addButton("reseed", "別の房を生成", () => {
        // シードを変えるだけで、同じ品種の別個体になる
        switchTo(currentVariety, (currentSeed * 1664525 + 1013904223) >>> 0);
    });

    const rotateBtn = addButton("rotate", "自動回転: OFF", () => {
        camera.useAutoRotationBehavior = !camera.useAutoRotationBehavior;
        if (camera.autoRotationBehavior) camera.autoRotationBehavior.idleRotationSpeed = 0.12;
        rotateBtn.textBlock.text = "自動回転: " + (camera.useAutoRotationBehavior ? "ON" : "OFF");
        rotateBtn.background = camera.useAutoRotationBehavior ? COL.active : COL.idle;
    });

    const bloomLabel = addLabel("果粉の強さ  " + state.cfg.bloomStrength.toFixed(2), 13, COL.accent, "22px");
    const bloomSlider = new BABYLON.GUI.Slider("bloom");
    bloomSlider.minimum = 0;
    bloomSlider.maximum = 1.6;
    bloomSlider.value = state.cfg.bloomStrength;
    bloomSlider.height = "18px";
    bloomSlider.width = "196px";
    bloomSlider.paddingBottom = "8px";
    bloomSlider.color = COL.accent;
    bloomSlider.background = "#332c3d";
    bloomSlider.borderColor = "transparent";
    bloomSlider.onValueChangedObservable.add((v) => {
        bloomLabel.text = "果粉の強さ  " + v.toFixed(2);
        applyBloomStrength(v);
    });
    panel.addControl(bloomSlider);

    const info = addLabel("", 12, COL.sub, "40px");

    // 房が作り直されるたびにGUIの表示を追従させる
    onClusterRebuilt = (st) => {
        if (bloomSlider) bloomSlider.value = st.cfg.bloomStrength;   // 品種ごとの既定値に戻す
        if (info) {
            info.text = st.cluster.berries.length + " 粒 / 房長 "
                + st.cfg.clusterHeight.toFixed(1) + "\nseed: " + st.cfg.seed;
        }
    };
    onClusterRebuilt(state);

    return scene;
};

export default createScene;
