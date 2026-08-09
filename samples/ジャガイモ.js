// =====================================================================
//  Photoreal Potato  /  写実的なジャガイモ      BUILD: jaga-H
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  jaga-G からの変更点:
//    ・影を PCF に変えた。指数シャドウマップ（ESM）は深度を指数関数で
//      近似するので、ぼかすと影がキャスター自身の明るい面へにじむ。
//      丸い物体では曲線で縁取られた楕円の暗い領域になり、痣に見えた
//    ・forceBackFacesOnly を有効にした。閉じたメッシュなら裏面だけを
//      シャドウマップへ描けば自己遮蔽が原理的に起きない
//    ・影の ON/OFF を GUI に出した。この種の切り分けに要る
//
//  jaga-F からの変更点:
//    ・かさぶたを小さく淡くした。最大の塊が直径 1.6cm で周囲より輝度が
//      13.7 暗く、泥のムラの暗い側（直径 3cm）と重なると楕円形の痣に
//      見えていた。実物のかさぶたはもっと小さく、乾いた薄茶
//    ・泥と乾きのムラの振れ幅をさらに圧縮した
//
//  jaga-E からの変更点（形状の破綻を直す）:
//    ・平面切断を正しい式にした。jaga-E までは半径 r を「中心からその方向
//      への距離」として扱っていたが、渡していたのは軸からの円筒半径。
//      さらに切断面の位置を円筒半径から決めていたので、極方向を向いた
//      平面では位置がほぼ 0 になり、半球全体が軸まで潰れて扇形の突起に
//      なっていた。平面 P·n = p と回転面の交わりを解けば r の上限は
//      (p - x·nx) / w（w は周方向の成分）で求まる
//
//  jaga-D からの変更点:
//    ・dirAt を実際の形に合わせた。jaga-D までは v をそのまま極角として
//      扱っており「球」を仮定していたが、実際のメッシュは軸方向の位置で
//      半径を決めるプロファイル形状で、極付近は球よりずっと速く膨らむ。
//      そのため角半径 6.6° のつもりのへそが実測で直径 24mm の皿になり、
//      極が黒く傷んだように見えていた。芽も極寄りでは同じく肥大していた
//
//  jaga-C からの変更点（極の破綻を直す）:
//    ・細かい模様（網目・皮目・暗点）も球面方向の3Dノイズにした。
//      UV の高周波は極で u が一点に潰れて放射状の縞になる。jaga-C は
//      それを隠すため極で模様を消しており、頭頂部だけつるりとしていた
//    ・肌のテクスチャに異方性フィルタを設定。極では u 方向が極端に
//      圧縮されるので、無いと GPU が高い LOD を選んでぼやける
//    ・へそを v ではなく方向で置いた。v<0.03 で塗ると極付近では帯では
//      なく円錐状のキャップ全体になり、大きな黒い滲みになる
//    ・法線マップの極の減衰をほぼ不要にした。高さ場が方向の関数に
//      なったので、極では u 方向の変化が自然に 0 へ収束する
//
//  jaga-B からの変更点:
//    ・削りを本当の平面切断にした。半径を「平面までの距離」で頭打ちに
//      する（なめらかな最小値で角を丸める）。前は方向ごとに半径を
//      落としていただけで、球をへこませた形にしかなっていなかった
//    ・芽の受け皿を深くした。1.5mm では自分で影を作れず、中心の点しか
//      見えていなかった
//    ・色ムラの低周波を細かく弱くした。芋の1/3ほどの斑が乗っていて
//      鶉の卵に見えていた。代わりに細かい粉の粒を強めた
//
//  jaga-A からの変更点（実物の写真と見比べての手直し）:
//    ・芽を「受け皿・中心の点・眉」の3層に分けた。一様に暗い窪みだと
//      ケシの実を刺したように見える。実物は浅い皿の中心だけが暗い
//    ・平面で削る処理を追加。土や石に押されてできる平らな面が無いと、
//      どれだけ瘤を足しても粘土団子にしかならない
//    ・個体の大きさを共通の係数で振るようにした。長径と短径を別々に
//      振っていたので、結果として全部同じ大きさになっていた
//    ・皮の色を淡い灰白色寄りに。細かい暗点（皮目）を足した
//    ・接地の陰を濃くし、ざるを細かい編み目に直した
//
//  構成:
//    0. CONFIG      … 品種プリセット（男爵 / メークイン / キタアカリ）
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 3D値ノイズ / 2D周期ノイズ
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Fields      … 球面方向の場 / 螺旋配置の芽 / プロファイル
//    5. TextureLab  … 皮のアルベド・ORM・法線、竹の網代を手続き生成
//    6. Potato      … 塊茎
//    7. Basket      … ざる
//    8. Scene / 物理（Havok で1個ずつ落とす）
//    9. GUI
//
//  サツマイモ版からの根本的な違い:
//    ・形を「軸方向のプロファイル」で作れない。塊茎はほぼ回転楕円体で、
//      そこに大きな瘤（ローブ）が2〜4個乗って歪んでいる。半径を
//      「球面上の方向 dir の関数」にして、3次元ノイズで膨らませる
//    ・芽（eye）が主役。直径5〜10mm あって輪郭をはっきり凹ませるので、
//      テクスチャだけでなくジオメトリにも入れる
//    ・芽には必ず「眉」がある。窪みの片側（頂芽の向き）に三日月形の
//      隆起が付く。これが無いと、ただの丸い穴になって虫食いに見える
//    ・芽の配置は螺旋（黄金角）で、頂芽側ほど密。無作為に散らすと
//      「泥のはねたボール」になる
//    ・皮は擦れて剥ける。淡い果肉が覗く不定形の斑が必ずある
//
//  法線マップについて（きゅうり版・ゴーヤー版と同じ落とし穴）:
//    ・高さ場から法線を焼くとき、v 方向は (yd - yu) にすること。
//      (yu - yd) は「V が上を向く」OpenGL 系の規約で、Babylon の接空間は
//      V が下向き。混ぜると u方向は正・v方向は逆というねじれた法線になる
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const PRESETS = {
        danshaku: {
            label: "男爵",
            // 丸くごつごつ。芽が深く、肩に平らな面が出る
            length: 7.6, radius: 3.05,
            oval: 0.15,                         // 0=球に近い / 1=細長い
            // 瘤（ローブ）。形の個性はほぼここで決まる
            // 【対策】f1 を上げると瘤が細かくなって金平糖になる。
            //         直径1個ぶんに 3〜5 個の瘤が乗るくらいが実物
            lumpA: 0.130, lumpB: 0.048, f1: 2.2, f2: 3.4,
            asymmetry: 0.055, flatten: 0.100,
            cutCount: 3, cutInset0: 0.72, cutInset1: 0.90, cutSoft: 0.13,
            // 芽（単位はラジアン。球面上の角半径）
            // 【対策】0.16 まで上げると直径11mmの穴になり、レンコンに見える。
            //         実物は5〜10mm。r0/r1 を離して大小を付ける
            eyeCount: 15, eyeBias: 0.72, eyeR0: 0.085, eyeR1: 0.155,
            eyeBasinGeo: 0.082, eyePitGeo: 0.048, browGeo: 0.078,
            eyeBasinTex: 0.18, eyePitTex: 0.30, browTex: 0.22,
            eyeRingAmt: 0.30,
            // 皮の傷み
            scabAmount: 0.26, scrapeAmount: 0.24,
            navelR: 0.185, navelDepthTex: 0.26, navelDepthGeo: 0.050,
            // 色（sRGB）
            skinBase: [0.795, 0.715, 0.560],
            skinDark: [0.640, 0.552, 0.408],    // 泥と陰
            skinPale: [0.885, 0.850, 0.765],    // 乾いた粉
            flesh: [0.920, 0.885, 0.775],       // 皮が剥けて覗く果肉
            scab: [0.630, 0.535, 0.400],
            eyeDark: [0.330, 0.260, 0.185],     // 芽の中心の点。黒ではない
            eyeRing: [0.590, 0.485, 0.355],
            eyeLip: [0.900, 0.865, 0.780],      // 眉。ここがいちばん明るい
            lent: [0.905, 0.870, 0.775],        // 皮目（淡点）
            speck: [0.395, 0.325, 0.240],       // 皮目（暗点）
            navel: [0.470, 0.385, 0.280],       // へそ（ストロンの跡）
            skinRoughness: 0.82
        },
        mayqueen: {
            label: "メークイン",
            // 細長くなめらか。芽が浅く、色は黄色寄り
            length: 10.4, radius: 2.70,
            oval: 0.85,
            lumpA: 0.080, lumpB: 0.030, f1: 2.0, f2: 3.2,
            asymmetry: 0.045, flatten: 0.072,
            cutCount: 2, cutInset0: 0.82, cutInset1: 0.95, cutSoft: 0.17,
            eyeCount: 11, eyeBias: 0.78, eyeR0: 0.075, eyeR1: 0.130,
            eyeBasinGeo: 0.050, eyePitGeo: 0.030, browGeo: 0.046,
            eyeBasinTex: 0.12, eyePitTex: 0.22, browTex: 0.14,
            eyeRingAmt: 0.22,
            scabAmount: 0.16, scrapeAmount: 0.14,
            navelR: 0.170, navelDepthTex: 0.22, navelDepthGeo: 0.042,
            skinBase: [0.820, 0.740, 0.570],
            skinDark: [0.665, 0.575, 0.420],
            skinPale: [0.900, 0.860, 0.755],
            flesh: [0.925, 0.890, 0.770],
            scab: [0.640, 0.545, 0.405],
            eyeDark: [0.345, 0.275, 0.195],
            eyeRing: [0.605, 0.500, 0.360],
            eyeLip: [0.910, 0.875, 0.780],
            lent: [0.915, 0.880, 0.780],
            speck: [0.410, 0.340, 0.250],
            navel: [0.485, 0.400, 0.290],
            skinRoughness: 0.76
        },
        kitaakari: {
            label: "キタアカリ",
            // 男爵に近い丸型。芽のまわりが赤みを帯びるのが見分け
            length: 7.4, radius: 3.00,
            oval: 0.10,
            lumpA: 0.138, lumpB: 0.052, f1: 2.3, f2: 3.5,
            asymmetry: 0.058, flatten: 0.105,
            cutCount: 3, cutInset0: 0.71, cutInset1: 0.89, cutSoft: 0.12,
            eyeCount: 16, eyeBias: 0.70, eyeR0: 0.088, eyeR1: 0.160,
            eyeBasinGeo: 0.086, eyePitGeo: 0.050, browGeo: 0.082,
            eyeBasinTex: 0.19, eyePitTex: 0.32, browTex: 0.23,
            // 【対策】ここがキタアカリらしさ。芽の周囲だけ赤褐色に染まる
            eyeRingAmt: 0.62,
            scabAmount: 0.23, scrapeAmount: 0.22,
            navelR: 0.185, navelDepthTex: 0.26, navelDepthGeo: 0.050,
            skinBase: [0.820, 0.730, 0.530],
            skinDark: [0.655, 0.550, 0.385],
            skinPale: [0.895, 0.850, 0.730],
            flesh: [0.925, 0.885, 0.750],
            scab: [0.635, 0.530, 0.385],
            eyeDark: [0.335, 0.240, 0.175],
            eyeRing: [0.660, 0.420, 0.310],
            eyeLip: [0.900, 0.860, 0.755],
            lent: [0.910, 0.870, 0.760],
            speck: [0.405, 0.320, 0.235],
            navel: [0.480, 0.375, 0.270],
            skinRoughness: 0.80
        }
    };

    const GLOBAL = {
        count: 5,                  // 個数

        // 籠（ざる）
        basketRim: 16.5,
        basketDepth: 6.0,
        basketThick: 0.50,
        basketSegments: 96,
        basketRings: 34,

        // --- 物理（Havok）
        // 【対策】Havok の接触許容量・スリープ閾値は「絶対値」で、メートル系を
        //         前提に決まっている。シーンが cm 単位だと、物体の大きさに対して
        //         これらが実質1/100の厳しさになる。実重力 981 を入れると
        //         1ステップあたりのめり込みが許容量を超え、押し戻され続けて
        //         プルプル震える。重力を数百まで落とすのがいちばん安い解
        gravity: 620,
        physicsHz: 120,
        pieceMass: 1.0,
        // 【対策】ジャガイモは丸い。摩擦が低いと籠の中をいつまでも転がる
        friction: 0.80,
        restitution: 0.03,
        linearDamping: 0.18,
        angularDamping: 0.90,
        dropInterval: 0.24,
        dropClearance: 1.6,
        freezeWhenSettled: true,
        settleSpeed: 3.0, settleSpin: 3.5, settleHold: 0.35,
        settleTimeout: 5.5,

        // 【対策】芽をジオメトリで出すので、球としての分割が要る。
        //         芽1個（直径8mm ≒ 円周の1/25）に周方向6頂点が下限
        segmentsAxis: 176,
        segmentsRound: 160,

        textureSize: 1024,
        showGround: true,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.042,
        dofFStop: 2.8,

        // GUI
        compactWidth: 700,
        compactMinSide: 480,
        guiMaxScale: 2.2
    };

    const START_VARIETY = "danshaku";
    const START_SEED = 20260801;
    const BUILD = "jaga-H";

    const V3 = BABYLON.Vector3;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const srgb = (v) => Math.pow(clamp(v, 0, 1), 2.2);

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
        // u 方向だけ折り返す（皮のUVは u が周方向で継ぎ目が無い）
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

    function makeMesh(name, positions, indices, normals, uvs, scene) {
        const mesh = new BABYLON.Mesh(name, scene);
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.indices = indices; vd.normals = normals;
        if (uvs) vd.uvs = uvs;
        vd.applyToMesh(mesh, false);
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // リング列の掃引。両端はキャップで閉じる
    // uOff: UV の u をずらす量。模様を個体ごとに回すのに使う
    function sweep(name, rings, centers, scene, uOff) {
        uOff = uOff || 0;
        const N = rings.length, M = rings[0].length;
        const total = N * M + 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                const k = i * M + j, p = rings[i][j];
                positions[k * 3] = p.x; positions[k * 3 + 1] = p.y; positions[k * 3 + 2] = p.z;
                uvs[k * 2] = j / (M - 1) + uOff; uvs[k * 2 + 1] = i / (N - 1);
            }
        }
        const capA = N * M, capB = N * M + 1;
        positions[capA * 3] = centers[0].x; positions[capA * 3 + 1] = centers[0].y; positions[capA * 3 + 2] = centers[0].z;
        positions[capB * 3] = centers[N - 1].x; positions[capB * 3 + 1] = centers[N - 1].y; positions[capB * 3 + 2] = centers[N - 1].z;
        uvs[capA * 2] = 0.5 + uOff; uvs[capA * 2 + 1] = 0;
        uvs[capB * 2] = 0.5 + uOff; uvs[capB * 2 + 1] = 1;
        const indices = [];
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < M - 1; j++) {
            const A = i * M + j, B = A + 1, C = A + M, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        // 【対策】両端のキャップは側面と巻き順を揃える。逆だと ComputeNormals が
        //         端のリングで外向きと内向きの面法線を足し合わせて頂点法線が裏返る
        for (let j = 0; j < M - 1; j++) indices.push(capA, j, j + 1);
        const o = (N - 1) * M;
        for (let j = 0; j < M - 1; j++) indices.push(capB, o + j + 1, o + j);

        // 【対策】判定の基準は端ではなく胴の中央。半径が最大で法線が素直に
        //         外を向いており、個体によらず安定する
        const refI = Math.floor(N / 2), refIdx = refI * M;
        const normals = finalize(positions, indices, centers[refI], refIdx);
        weldNormals(positions, normals);
        return makeMesh(name, positions, indices, normals, uvs, scene);
    }

    // =================================================================
    // 4. Fields
    // =================================================================
    // UV から「中心から見た単位方向」へ。u が周方向、v が軸方向
    // 【対策】皮の模様も芽もこの方向で評価する。UV の格子で評価すると
    //         極で潰れて放射状の縞になるうえ、u=0 に継ぎ目が出る
    // 【対策】v をそのまま極角として使う（＝球を仮定する）と、極付近で
    //         実際の形と大きく食い違う。この塊茎は軸方向の位置で半径を
    //         決めるプロファイル形状で、極では球よりずっと速く膨らむ。
    //         v=0.02 のとき球なら極角 3.6° だが実際は 13.8° ある。
    //         そのまま角半径でへそや芽を置くと、極寄りだけ 4 倍に肥大する。
    //         実際のプロファイルから方向を組み立てれば、角半径が
    //         球面上の実距離とほぼ比例するようになる
    function dirAt(u, v, ar, oval) {
        const r = profileAt(v, oval);
        const x = (0.5 - v) * ar;
        const ph = u * Math.PI * 2;
        const l = Math.hypot(x, r) || 1;
        return { x: x / l, y: r * Math.cos(ph) / l, z: r * Math.sin(ph) / l };
    }
    // v が増える向きの単位接ベクトル（芽の眉をどちら側に付けるかに使う）
    function tanVAt(u, v, ar, oval) {
        const e = 2e-3;
        const a = dirAt(u, Math.max(0, v - e), ar, oval);
        const b = dirAt(u, Math.min(1, v + e), ar, oval);
        let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
        const l = Math.hypot(tx, ty, tz) || 1;
        return { x: tx / l, y: ty / l, z: tz / l };
    }
    // 与えられた x 成分を持つ方向の v を逆に求める（切断面の位置決めに使う）
    // 【対策】dirAt がプロファイル込みになったので、acos では逆算できない。
    //         x 成分は v について単調減少なので二分探索でよい
    function vForX(nx, ar, oval) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) * 0.5;
            if (dirAt(0, mid, ar, oval).x > nx) lo = mid; else hi = mid;
        }
        return (lo + hi) * 0.5;
    }
    // へそ（ストロンの跡）。t=0 側の極にひとつだけある小さなくぼみ
    // 【対策】v<0.03 のような帯で塗ると、極付近では帯ではなく円錐状の
    //         キャップ全体を覆うことになり、大きな黒い滲みになる。
    //         芽と同じく「方向からの角距離」で置けば正しい大きさになる
    function navelAt(dx, r) {
        const ang = Math.acos(clamp(dx, -1, 1));
        return smooth(r, r * 0.25, ang);
    }


    // [軸方向 t, 半径比]。t=0 がへそ側、t=1 が頂芽側
    // 【対策】塊茎は紡錘形ではない。中央が長く太いままで、両端が急に丸まる。
    //         サツマイモのプロファイルをそのまま使うとレモンになる
    const PROF_ROUND = [
        [0.000, 0.000], [0.018, 0.310], [0.045, 0.470], [0.090, 0.632],
        [0.150, 0.764], [0.230, 0.870], [0.330, 0.946], [0.450, 0.995],
        [0.560, 1.000], [0.665, 0.976], [0.765, 0.906], [0.855, 0.784],
        [0.925, 0.592], [0.970, 0.352], [1.000, 0.025]
    ];
    const PROF_OVAL = [
        [0.000, 0.000], [0.018, 0.348], [0.045, 0.530], [0.090, 0.700],
        [0.150, 0.828], [0.230, 0.918], [0.330, 0.972], [0.450, 1.000],
        [0.560, 1.000], [0.665, 0.988], [0.765, 0.942], [0.855, 0.845],
        [0.925, 0.664], [0.970, 0.405], [1.000, 0.028]
    ];

    function catmull(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    // 【対策】制御点の1列目に t を書きながら添字を等間隔とみなして補間すると、
    //         書いた位置と実際の形が食い違う。t で区間を引いてから補間する
    function profileAt(t, oval) {
        const A = PROF_ROUND, B = PROF_OVAL, n = A.length;
        t = clamp(t, 0, 1);
        let i = 1;
        while (i < n - 1 && A[i][0] < t) i++;
        const t0 = A[i - 1][0], t1 = A[i][0];
        const u = (t1 > t0) ? (t - t0) / (t1 - t0) : 0;
        const i0 = Math.max(0, i - 2), i1 = i - 1, i2 = i, i3 = Math.min(n - 1, i + 1);
        const a = catmull(A[i0][1], A[i1][1], A[i2][1], A[i3][1], u);
        const b = catmull(B[i0][1], B[i1][1], B[i2][1], B[i3][1], u);
        return Math.max(0, mix(a, b, clamp(oval, 0, 1)));
    }

    // ---- 芽（eye）の配置 ------------------------------------------------
    // 【対策】芽は球面に無作為に散っているのではなく、螺旋（黄金角）に沿って
    //         並び、頂芽の側ほど密になる。ここを乱数だけで置くと
    //         「泥のはねたボール」になって、ジャガイモに見えない
    function makeEyes(cfg) {
        const rng = new Rng(cfg.skinSeed + 7717);
        const out = [];
        for (let i = 0; i < cfg.eyeCount; i++) {
            const s = (i + 0.5) / cfg.eyeCount;
            // eyeBias < 1 で t=1（頂芽）側へ密度を寄せる
            let v = Math.pow(s, cfg.eyeBias);
            v = clamp(v * 0.88 + 0.06 + rng.gauss(0, 0.030), 0.045, 0.965);
            const u = ((i * 0.381966 + rng.gauss(0, 0.045)) % 1 + 1) % 1;
            const r = cfg.eyeR0 + (cfg.eyeR1 - cfg.eyeR0) * rng.next();
            out.push({
                c: dirAt(u, v, cfg.axisRatio, cfg.oval),
                tv: tanVAt(u, v, cfg.axisRatio, cfg.oval), r: r,
                cosMax: Math.cos(Math.min(Math.PI, r * 2.4)),
                // 【対策】全部を同じ濃さで出すと水玉になる。実物ははっきり
                //         見えるのが数個で、残りは言われないと気づかない
                s: 0.34 + 0.66 * Math.pow(rng.next(), 1.25),
                t: rng.next()
            });
        }
        return out;
    }

    // 芽の場。受け皿（basin）・中心の点（pit）・眉（brow）・染み（ring）
    // 【対策】芽を「ひとつの暗い窪み」として作ると、ケシの実を刺したように
    //         見える。実物は直径1cmほどの浅い受け皿で、暗いのは中心の
    //         数mmだけ。しかも片側の眉がいちばん明るく光る。
    //         この3層を分けて初めてジャガイモの芽に見える
    function eyeAt(dx, dy, dz, eyes) {
        let basin = 0, pit = 0, brow = 0, ring = 0, tip = 0;
        for (let i = 0; i < eyes.length; i++) {
            const e = eyes[i];
            const dot = dx * e.c.x + dy * e.c.y + dz * e.c.z;
            if (dot < e.cosMax) continue;
            const ang = Math.acos(clamp(dot, -1, 1));
            const a = ang / e.r;
            const bs = smooth(1.55, 0.20, a) * e.s;
            if (bs > basin) { basin = bs; tip = e.t; }
            const p = smooth(0.42, 0.08, a) * e.s;
            if (p > pit) pit = p;
            // 【対策】眉は窪みの「片側だけ」に付く。全周に付けるとドーナツになり、
            //         付けないとただの穴になって虫食いに見える。
            //         頂芽の向き（tv）の側に寄せるのが実物
            const sd = (dx * e.tv.x + dy * e.tv.y + dz * e.tv.z) / Math.max(1e-5, Math.sin(ang));
            if (sd > 0) {
                const band = Math.exp(-Math.pow((a - 1.02) / 0.34, 2));
                const b = band * Math.pow(sd, 1.3) * e.s;
                if (b > brow) brow = b;
            }
            const rg = smooth(1.9, 0.5, a) * e.s;
            if (rg > ring) ring = rg;
        }
        return { basin, pit, brow, ring, tip };
    }

    // =================================================================
    //  設定の組み立て
    // =================================================================
    function buildConfig(varietyKey, seed) {
        const cfg = Object.assign({}, GLOBAL, PRESETS[varietyKey]);
        cfg.variety = varietyKey;
        cfg.seed = seed >>> 0;
        // 【対策】皮のテクスチャは品種単位でキャッシュするので、模様の種は
        //         品種名から決めて個体乱数から切り離す。個体差は
        //         「大きさ・瘤・扁平・模様の回転」で出す
        let h = 2166136261;
        for (let i = 0; i < varietyKey.length; i++) {
            h ^= varietyKey.charCodeAt(i); h = Math.imul(h, 16777619);
        }
        cfg.skinSeed = (h >>> 0) % 100000;
        // 【対策】dirAt は長軸と短軸の比を要る。個体ごとに ±10% 振れるが、
        //         テクスチャは品種単位なので、両方ともプリセット値で揃える。
        //         ここがずれると芽の位置と窪みが合わなくなる
        cfg.axisRatio = cfg.length / (2 * cfg.radius);
        cfg.eyes = makeEyes(cfg);
        if (cfg.count > 3) { cfg.segmentsAxis = 144; cfg.segmentsRound = 128; }
        if (cfg.count > 5) { cfg.segmentsAxis = 112; cfg.segmentsRound = 96; }
        return cfg;
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
            // 【対策】極では u 方向が極端に圧縮されるため、等方フィルタだと
            //         GPU が u 側の縮小率に合わせて高い LOD を選び、極一帯が
            //         ぼやける。異方性フィルタを入れると v 方向の解像度が残る
            dt.anisotropicFilteringLevel = 16;
            return dt;
        },

        // 皮の場をいちど計算して 3 枚のテクスチャで共有する
        // 【対策】低周波（泥・かさぶた・剥け）は球面方向の3Dノイズで作る。
        //         UV の2Dノイズでやると極で潰れ、u=0 に継ぎ目が出る。
        //         逆に高周波（網目・粒）はUVでよい。潰れても細かさが変わるだけ
        field(size, cfg) {
            const N = size, n2 = N * N, eyes = cfg.eyes, sd = cfg.skinSeed;
            const F = {
                basin: new Float32Array(n2), pit: new Float32Array(n2),
                brow: new Float32Array(n2),
                ring: new Float32Array(n2), tip: new Float32Array(n2),
                dirt: new Float32Array(n2), scab: new Float32Array(n2),
                scrape: new Float32Array(n2), grain: new Float32Array(n2),
                fine: new Float32Array(n2), lent: new Float32Array(n2),
                navel: new Float32Array(n2),
                h: new Float32Array(n2)
            };
            // 【対策】ノイズの周波数は「単位球の座標」で効く。半径 R cm の球で
            //         周期 L cm の模様が欲しければ K = R / L。R=3cm・2mm の網目なら
            //         K=15（赤道まわりに約94個）で、UV の u*90 と同じ細かさになる
            const K_RUS = 15, K_FINE = 60, K_SPECK = 68;
            for (let y = 0; y < N; y++) {
                const v = y / N;
                for (let x = 0; x < N; x++) {
                    const u = x / N, i = y * N + x;
                    const d = dirAt(u, v, cfg.axisRatio, cfg.oval);
                    const E = eyeAt(d.x, d.y, d.z, eyes);
                    // 【対策】周波数 2.2 では芋の1/3ほどの斑になり、鶉の卵に見える。
                    //         実物の色差はもっと細かく、しかも弱い
                    const dirt = Noise.fbm3(d.x * 4.6 + 11, d.y * 4.6 + 5, d.z * 4.6 + 3, sd + 17, 2);
                    // 【対策】周波数 5.5 だと塊が直径 1.6cm まで育ち、泥のムラの
                    //         暗い側と重なって楕円形の痣に見える。実物のかさぶたは
                    //         数mm〜1cm の散らばった傷
                    const sc = Noise.fbm3(d.x * 9.5 + 2, d.y * 9.5 + 9, d.z * 9.5 + 7, sd + 41, 2);
                    const sk = Noise.fbm3(d.x * 3.4 + 6, d.y * 3.4 + 1, d.z * 3.4 + 8, sd + 67, 2);
                    // 網目（ラセット）と、その上の細かい粒・皮目・暗点
                    // 【対策】ここを UV の高周波にすると、極で u が一点に潰れて
                    //         放射状の縞になる。方向の3Dノイズなら極も赤道も等方で、
                    //         極を特別扱いする必要がなくなる
                    // 【対策】3Dノイズは2Dの倍のハッシュを引く。3オクターブだと
                    //         1024² の焼きが3秒近くまで伸びるので2オクターブに抑え、
                    //         足りない細かさは下の単オクターブ3本で足す
                    const rus = Noise.fbm3(d.x * K_RUS + 21, d.y * K_RUS + 4, d.z * K_RUS + 13, sd + 11, 2);
                    const gra = Noise.v3(d.x * K_FINE + 7, d.y * K_FINE + 19, d.z * K_FINE + 2, sd + 23);
                    // 【対策】皮目の淡点と暗点は、同じ場の上端と下端から取る。
                    //         別々の3Dノイズを引くと 1024² で 0.4 秒ぶん重くなるうえ、
                    //         実物でも淡点と暗点は同じ場所には出ない
                    const spk = Noise.v3(d.x * K_SPECK + 15, d.y * K_SPECK + 6, d.z * K_SPECK + 9, sd + 193);
                    const scab = smooth(0.70, 0.90, sc) * cfg.scabAmount;
                    // 【対策】剥けた皮は縁が滑らかに溶けない。しきい値を狭く取って
                    //         はっきりした境目を作らないと、ただの色ムラに見える
                    const scrape = smooth(0.795, 0.855, sk) * cfg.scrapeAmount;
                    F.basin[i] = E.basin; F.pit[i] = E.pit;
                    F.brow[i] = E.brow; F.ring[i] = E.ring; F.tip[i] = E.tip;
                    F.dirt[i] = dirt; F.scab[i] = scab; F.scrape[i] = scrape;
                    F.grain[i] = 0.62 * rus + 0.38 * gra;
                    F.fine[i] = spk; F.lent[i] = 1 - spk;
                    F.navel[i] = navelAt(d.x, cfg.navelR);
                    F.h[i] = clamp(
                        0.52
                        - cfg.eyeBasinTex * E.basin
                        - cfg.eyePitTex * E.pit
                        + cfg.browTex * E.brow
                        + 0.17 * (rus - 0.5)
                        + 0.14 * (gra - 0.5)
                        + 0.10 * scab
                        - 0.05 * scrape
                        - cfg.navelDepthTex * F.navel[i], 0, 1);
                }
            }
            return F;
        },

        albedo(scene, size, cfg, F) {
            const BS = cfg.skinBase, DK = cfg.skinDark, PL = cfg.skinPale;
            const FL = cfg.flesh, SC = cfg.scab, ED = cfg.eyeDark;
            const ER = cfg.eyeRing, EL = cfg.eyeLip, LN = cfg.lent, NV = cfg.navel;
        const SK = cfg.speck;
            return this._tex("jagaAlbedo", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i0 = y * N + x, i = i0 * 4;
                        // 泥と乾きのムラ。ジャガイモの色差はほぼこれ
                        // 【対策】ここを 0〜1 で振り切ると斑の塊になる。
                        //         下限を持ち上げて振れ幅を 2/3 に抑える
                        // 【対策】ここの振れ幅がかさぶたと重なると痣になる。
                        //         下限をさらに持ち上げて振れを半分に抑える
                        const dt = 0.52 + 0.48 * smooth(0.26, 0.82, F.dirt[i0]);
                        let cr = mix(DK[0], BS[0], dt);
                        let cg = mix(DK[1], BS[1], dt);
                        let cb = mix(DK[2], BS[2], dt);
                        // 乾いて粉を吹いた面
                        const pale = smooth(0.74, 0.97, F.dirt[i0]) * 0.26;
                        cr = mix(cr, PL[0], pale); cg = mix(cg, PL[1], pale); cb = mix(cb, PL[2], pale);
                        // 網目の明暗
                        const g = 0.90 + 0.20 * F.grain[i0];
                        cr *= g; cg *= g; cb *= g;
                        // かさぶた
                        const sb = F.scab[i0];
                        cr = mix(cr, SC[0], sb); cg = mix(cg, SC[1], sb); cb = mix(cb, SC[2], sb);
                        // 【対策】掘りたてのジャガイモは必ずどこか皮が剥けている。
                        //         これが無いと蝋細工に見える。剥けた面は果肉が
                        //         露出しているので、まわりより明らかに明るい
                        const sp = F.scrape[i0];
                        cr = mix(cr, FL[0], sp); cg = mix(cg, FL[1], sp); cb = mix(cb, FL[2], sp);
                        // 皮目（細かい淡点）
                        const le = smooth(0.80, 0.94, F.lent[i0]);
                        cr = mix(cr, LN[0], le * 0.55); cg = mix(cg, LN[1], le * 0.55); cb = mix(cb, LN[2], le * 0.55);
                        // 【対策】実物の皮には細かい暗点が一面に散っている。
                        //         これが無いと、遠目には合っていても寄ると
                        //         のっぺりした粘土に見える
                        const sk = smooth(0.84, 0.97, F.fine[i0]) * 0.45;
                        cr = mix(cr, SK[0], sk); cg = mix(cg, SK[1], sk); cb = mix(cb, SK[2], sk);
                        // 芽：周囲の染み → 眉の淡い縁 → 窪みの底
                        const rg = smooth(0.10, 0.85, F.ring[i0]) * cfg.eyeRingAmt;
                        cr = mix(cr, ER[0], rg); cg = mix(cg, ER[1], rg); cb = mix(cb, ER[2], rg);
                        // 受け皿の中はごくわずかに沈むだけ。ここを暗くしない
                        const bs = smooth(0.15, 0.90, F.basin[i0]) * 0.22;
                        cr = mix(cr, DK[0], bs); cg = mix(cg, DK[1], bs); cb = mix(cb, DK[2], bs);
                        // 眉は皮が乾いてめくれた部分。いちばん明るい
                        const lip = smooth(0.20, 0.80, F.brow[i0]) * 0.55;
                        cr = mix(cr, EL[0], lip); cg = mix(cg, EL[1], lip); cb = mix(cb, EL[2], lip);
                        // 暗いのは中心の数mmだけ
                        const core = Math.pow(smooth(0.25, 0.90, F.pit[i0]), 1.1) * (0.50 + 0.30 * F.tip[i0]);
                        cr = mix(cr, ED[0], core); cg = mix(cg, ED[1], core); cb = mix(cb, ED[2], core);
                        // へそ（ストロンの跡）。t=0 側の極にひとつだけ
                        const nv = F.navel[i0];
                        cr = mix(cr, NV[0], nv * 0.62); cg = mix(cg, NV[1], nv * 0.62); cb = mix(cb, NV[2], nv * 0.62);
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
            return this._tex("jagaORM", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const i0 = y * N + x, i = i0 * 4;
                        // 【対策】ジャガイモの皮はコルク質で、艶はほぼ無い。
                        //         0.5 台まで下げると洗って濡れた芋になる
                        let rough = cfg.skinRoughness * (0.94 + 0.16 * F.grain[i0]);
                        // 乾いた粉、かさぶたはさらに粗い
                        rough = mix(rough, 0.94, smooth(0.72, 0.96, F.dirt[i0]) * 0.5);
                        rough = mix(rough, 0.92, F.scab[i0] * 0.9);
                        // 【対策】剥けた果肉だけは湿っていて、わずかに光る。
                        //         ここに差を付けないと、色を変えただけの平らな斑になる
                        rough = mix(rough, cfg.skinRoughness * 0.62, F.scrape[i0] * 0.9);
                        // 【対策】jaga-A は芽の全体を 0.34 まで落としていて、色の
                        //         暗さと二重にかかって黒い点になっていた。
                        //         受け皿は軽く、中心だけ落とす
                        let ao = 1.0;
                        ao = mix(ao, 0.68, smooth(0.12, 0.92, F.basin[i0]));
                        ao = mix(ao, 0.42, smooth(0.25, 0.92, F.pit[i0]));
                        ao = mix(ao, 0.84, F.scab[i0] * 0.5);
                        ao = mix(ao, 0.58, F.navel[i0]);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        normal(scene, size, F, strength) {
            const hf = F.h;
            return this._tex("jagaNormal", size, (d, N) => {
                for (let y = 0; y < N; y++) {
                    // 【対策】高さ場が方向の関数になったので、極では u 方向の
                    //         変化が自然に 0 へ収束する。減衰はもう要らないが、
                    //         Babylon が画面微分から接空間を作る都合で最後の
                    //         数テクセルだけ不安定なので、そこだけ細く落とす
                    const vv = y / N;
                    const k = strength * smooth(0, 0.012, vv) * (1 - smooth(0.988, 1.0, vv));
                    for (let x = 0; x < N; x++) {
                        const xl = hf[y * N + ((x - 1 + N) % N)], xr = hf[y * N + ((x + 1) % N)];
                        const yu = hf[Math.max(0, y - 1) * N + x], yd = hf[Math.min(N - 1, y + 1) * N + x];
                        // 【対策】v 方向は (yd - yu)。(yu - yd) は「V が上を向く」
                        //         OpenGL 系の規約で、Babylon の接空間は V が下向き。
                        //         混ぜると u方向は正・v方向は逆というねじれた法線になり、
                        //         芽の眉が場所によって膨らんだり凹んだりする
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

        // 竹ひごの網代（あじろ）。u が周方向、v が中心→縁
        bamboo(scene, size, seed) {
            const OVER = [0.88, 0.79, 0.58], UNDER = [0.79, 0.69, 0.49], GAP = [0.54, 0.45, 0.31];
            return this._tex("basketAlbedo", size, (d, N) => {
                // 【対策】市松の目が粗いと布のチェック柄になる。実物のざるは
                //         細いひごが放射状に走り、輪の側が数倍太い
                const SPOKE = 96, RING = 22;
                for (let y = 0; y < N; y++) {
                    const v = y / N;
                    for (let x = 0; x < N; x++) {
                        const u = x / N, i = (y * N + x) * 4;
                        const su = u * SPOKE, sv = v * RING;
                        const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
                        const over = ((Math.floor(su) + Math.floor(sv)) & 1) === 0;
                        const bu = Math.sin(Math.PI * fu), bv = Math.sin(Math.PI * fv);
                        const shade = over ? (0.84 + 0.22 * bv) : (0.70 + 0.16 * bu);
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
            }, scene);
        }
    };

    // =================================================================
    //  マテリアル（品種ごとにキャッシュ）
    // =================================================================
    class Skin {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const F = TextureLab.field(S, cfg);
            this.albedoTex = TextureLab.albedo(scene, S, cfg, F);
            this.ormTex = TextureLab.orm(scene, S, cfg, F);
            this.normalTex = TextureLab.normal(scene, S, F, 3.0);

            const m = new BABYLON.PBRMaterial("jagaSkin", scene);
            m.albedoTexture = this.albedoTex;
            m.metallic = 0.0;
            m.roughness = 1.0;                   // 実値は ORM の G
            m.metallicTexture = this.ormTex;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.bumpTexture = this.normalTex;
            m.bumpTexture.level = 1.00;
            m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
            m.useAlphaFromAlbedoTexture = false;
            // 【対策】クリアコートもサブサーフェスも付けない。ジャガイモの皮は
            //         コルク質で、光沢も透過も無い。付けた瞬間に食品サンプルになる
            m.clearCoat.isEnabled = false;
            m.subSurface.isTranslucencyEnabled = false;
            this.skin = m;
        }

        // 表示モード 0=通常 / 1=白クレイ（法線のみ）/ 2=法線マップそのもの
        // 【対策】芽の窪みは色でも AO でも暗くしてあるので、通常表示のままでは
        //         「窪んで見える」のが法線のおかげか色のおかげか区別できない
        setDebug(mode) {
            const m = this.skin;
            const C3 = BABYLON.Color3;
            if (mode === 2) {
                m.unlit = true; m.disableLighting = true;
                m.albedoTexture = null; m.albedoColor = new C3(0, 0, 0);
                m.emissiveTexture = this.normalTex; m.emissiveColor = new C3(1, 1, 1);
                m.metallicTexture = null; m.bumpTexture = null;
                return;
            }
            m.unlit = false; m.disableLighting = false;
            m.emissiveTexture = null; m.emissiveColor = new C3(0, 0, 0);
            m.bumpTexture = this.normalTex;
            if (mode === 1) {
                m.albedoTexture = null; m.albedoColor = new C3(0.78, 0.78, 0.78);
                m.metallicTexture = null; m.roughness = 0.62;
            } else {
                m.albedoTexture = this.albedoTex; m.albedoColor = new C3(1, 1, 1);
                m.metallicTexture = this.ormTex; m.roughness = 1.0;
            }
        }

        dispose() {
            this.skin.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Potato
    // =================================================================
    class Potato {
        constructor(scene, cfg, seed, skin) {
            const rng = new Rng(seed);
            this.scene = scene; this.cfg = cfg; this.rng = rng;
            // 【対策】長径と短径を別々に振ると、大きい／小さいが打ち消し合って
            //         結局どれも同じ大きさになる。共通の係数で振ってから
            //         比率を崩す
            const sz = rng.range(0.78, 1.24);
            this.L = cfg.length * sz * rng.range(0.90, 1.10);
            this.R = cfg.radius * sz * rng.range(0.90, 1.10);
            this.oval = clamp(cfg.oval + rng.gauss(0, 0.14), 0, 1);
            this.nseed = rng.int(900000) + 1000;
            // 瘤（ローブ）。形の個性はほぼここ
            this.lumpA = cfg.lumpA * rng.range(0.6, 1.5);
            this.lumpB = cfg.lumpB * rng.range(0.5, 1.6);
            this.f1 = cfg.f1 * rng.range(0.82, 1.22);
            this.f2 = cfg.f2 * rng.range(0.85, 1.18);
            this.o1 = rng.range(0, 60); this.o2 = rng.range(0, 60); this.o3 = rng.range(0, 60);
            // 断面の非対称と、土の中で押されてできる扁平
            this.a1 = cfg.asymmetry * rng.range(0.6, 1.4);
            this.a2 = cfg.asymmetry * rng.range(0.3, 0.8);
            this.p1 = rng.range(0, Math.PI * 2);
            this.p2 = rng.range(0, Math.PI * 2);
            this.flat = cfg.flatten * rng.range(0.5, 1.5);
            this.flatA = rng.range(0, Math.PI * 2);
            // 【対策】土や石に押されてできる平らな面。正弦波的な瘤だけでは
            //         どこまでも粘土団子で、この「削り」を入れて初めて
            //         写真のような角のある塊茎になる
            // 切断面はメッシュ座標（x が軸）で持つ
            this.cuts = [];
            const nc = 1 + rng.int(cfg.cutCount);
            for (let i = 0; i < nc; i++) {
                const th = Math.acos(rng.range(-1, 1)), ph = rng.range(0, Math.PI * 2);
                const nx = Math.cos(th), ny = Math.sin(th) * Math.cos(ph), nz = Math.sin(th) * Math.sin(ph);
                // 【対策】平面の位置は「中心からその向きの表面までの距離」の
                //         割合で決める。円筒半径で決めると、極を向いた平面では
                //         ほぼ 0 になって半球全体が軸まで潰れ、扇形の突起になる
                // 【対策】dirAt の x はメッシュの x と符号が逆なので、
                //         逆算に渡すときに反転する
                const vv = vForX(-nx, cfg.axisRatio, cfg.oval);
                const pp = Math.atan2(nz, ny);
                const cd = { x: -nx, y: ny, z: nz };
                const rr = this.R * profileAt(vv, this.oval) * this.lumpAt(cd) * this.sectionAt(vv, pp);
                const xx = (vv - 0.5) * this.L;
                const dist = Math.hypot(xx, rr);
                this.cuts.push({ nx: nx, ny: ny, nz: nz,
                    p: dist * rng.range(cfg.cutInset0, cfg.cutInset1) });
            }
            this.cutSoft = this.R * cfg.cutSoft;
            // 【対策】芽の位置はテクスチャ側で固定なので、個体差は UV を回して出す。
            //         ジオメトリ側も同じ uOff を足した座標で場を評価する
            this.uOff = rng.next();

            this.parts = [];
            this._buildBody(skin);
            this.root = new BABYLON.TransformNode("jaga", scene);
            for (const m of this.parts) m.parent = this.root;
        }

        // 軸は X。塊茎はほとんど曲がらないので背骨は直線
        spineAt(t) { return new V3((t - 0.5) * this.L, 0, 0); }

        // 球面方向の低周波ノイズ。これが瘤になる
        // 【対策】2次元のUVノイズで膨らませると、極で潰れて頭だけ尖る。
        //         方向ベクトルで評価すれば球面のどこでも等方に膨らむ
        lumpAt(d) {
            // 【対策】オクターブを増やすと高い周波数が入り、輪郭が細かく
            //         波打ってゴルフボールになる。瘤は2オクターブで十分
            const n1 = Noise.fbm3(d.x * this.f1 + this.o1, d.y * this.f1 + this.o2, d.z * this.f1 + this.o3,
                this.nseed, 2) - 0.5;
            const n2 = Noise.fbm3(d.x * this.f2 + this.o2, d.y * this.f2 + this.o3, d.z * this.f2 + this.o1,
                this.nseed + 31, 2) - 0.5;
            return 1 + this.lumpA * 2 * n1 + this.lumpB * 2 * n2;
        }

        // 平面 P·n = p で切る。回転面の点は P = (x, r cosφ, r sinφ) なので
        // P·n = x·nx + r·w（w = cosφ·ny + sinφ·nz）。r ≤ (p - x·nx) / w が上限
        // 【対策】jaga-E までは r を「中心からの距離」とみなして p/cosθ で
        //         頭打ちにしていたが、渡していたのは円筒半径。軸に近いほど
        //         誤差が大きく、極付近では半径が軸まで潰れて突起になった
        // 【対策】硬い min では刃物で切ったように稜が立つので、なめらかな
        //         最小値（smin）で角を丸める
        cutAt(x, phi, r) {
            const r0 = r, k = this.cutSoft;
            for (let i = 0; i < this.cuts.length; i++) {
                const c = this.cuts[i];
                const w = Math.cos(phi) * c.ny + Math.sin(phi) * c.nz;
                if (w < 0.15) continue;
                const lim = (c.p - x * c.nx) / w;
                if (lim >= r + k) continue;
                const hh = clamp(0.5 + 0.5 * (lim - r) / k, 0, 1);
                r = (lim + (r - lim) * hh) - k * hh * (1 - hh);
            }
            // 【対策】平面が深く当たる帯では上限が負にもなりうる。回転面では
            //         その断面を消せないので、削りすぎを止めないと軸まで
            //         潰れて扇形の突起になる
            return Math.max(r, r0 * 0.55);
        }

        sectionAt(t, phi) {
            const asym = this.a1 * Math.cos(phi - this.p1) * Math.sin(Math.PI * t)
                + this.a2 * Math.cos(2 * phi - this.p2) * Math.sin(Math.PI * t * 1.3);
            const flat = -this.flat * Math.cos(2 * (phi - this.flatA));
            return 1 + asym + flat;
        }

        // uTex はテクスチャと同じ座標系（周方向 0..1 + uOff）
        radiusAt(t, uTex) {
            const cfg = this.cfg;
            const d = dirAt(uTex, t, cfg.axisRatio, cfg.oval);
            const E = eyeAt(d.x, d.y, d.z, cfg.eyes);
            const rel = 1 - cfg.eyeBasinGeo * E.basin - cfg.eyePitGeo * E.pit
                + cfg.browGeo * E.brow - cfg.navelDepthGeo * navelAt(d.x, cfg.navelR);
            const phi = uTex * Math.PI * 2;
            const r0 = this.R * profileAt(t, this.oval) * this.lumpAt(d)
                * this.sectionAt(t, phi) * rel;
            return Math.max(0.004, this.cutAt((t - 0.5) * this.L, phi, r0));
        }

        _buildBody(skin) {
            const cfg = this.cfg, N = cfg.segmentsAxis, M = cfg.segmentsRound;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const w = (j % M) / M;
                    const phi = w * Math.PI * 2;
                    const r = this.radiusAt(t, w + this.uOff);
                    ring.push(new V3(c.x, c.y + Math.cos(phi) * r, c.z + Math.sin(phi) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const mesh = sweep("jagaBody", rings, centers, this.scene, this.uOff);
            mesh.material = skin.skin;
            mesh.receiveShadows = true;
            this.body = mesh;
            this.parts.push(mesh);
        }

        // 当たり判定：表示メッシュから凸包を取ると生成が重いので、
        // 同じ関数を粗く評価した代理メッシュから凸包を起こす
        // 【対策】芽の窪みは凸包では無視されるので入れない。細かい起伏を
        //         残すと、ほぼ同一平面の面が大量に生まれて接触が毎ステップ
        //         別の面へ飛び移り、積み重なったときに震える
        hullShape() {
            const N = 24, M = 20;
            const rings = [], centers = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const c = this.spineAt(t);
                const ring = [];
                for (let j = 0; j <= M; j++) {
                    const w = (j % M) / M, phi = w * Math.PI * 2;
                    const d = dirAt(w + this.uOff, t, this.cfg.axisRatio, this.cfg.oval);
                    const r0 = this.R * profileAt(t, this.oval) * this.lumpAt(d) * this.sectionAt(t, phi);
                    const r = Math.max(0.004, this.cutAt((t - 0.5) * this.L, phi, r0)) * 0.98;
                    ring.push(new V3(c.x, c.y + Math.cos(phi) * r, c.z + Math.sin(phi) * r));
                }
                rings.push(ring); centers.push(c);
            }
            const proxy = sweep("jagaProxy", rings, centers, this.scene, 0);
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
        const normals = finalize(positions, indices, new V3(0, DEP * 0.35, 0), LAY + refI * W);
        weldNormals(positions, normals);
        const mesh = makeMesh("basket", positions, indices, normals, uvs, scene);
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
        console.warn("[Jaga] Havok を初期化できませんでした。物理なしで並べます。", err);
    }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    env.lodGenerationOffset = 0.80;
    scene.environmentIntensity = 0.56;

    const camera = new BABYLON.ArcRotateCamera("cam", -1.28, 1.20, 52, new V3(0, 2.2, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.58;
    camera.wheelPrecision = 8;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、接している面が
    //         互いに勝ったり負けたりする
    camera.minZ = 6;
    camera.maxZ = 300;
    camera.lowerRadiusLimit = 16;
    camera.upperRadiusLimit = 160;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.45, -0.92, 0.55).normalize(), scene);
    key.position = new V3(20, 34, -22);
    key.intensity = 2.5;
    key.diffuse = new BABYLON.Color3(1.0, 0.98, 0.94);
    key.specular = new BABYLON.Color3(0.30, 0.29, 0.27);
    key.autoCalcShadowZBounds = true;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.9, -0.35, -0.55).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.98, 0.97, 1.0);
    fillL.specular = new BABYLON.Color3(0.12, 0.12, 0.12);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.56;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.74, 0.72, 0.68);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】useBlurExponentialShadowMap は深度を指数関数で近似するため、
    //         ぼかすと影がキャスター自身の明るい面へにじみ出す。丸い物体だと
    //         曲線で縁取られた楕円の暗い領域になり、皮の痣と見分けがつかない。
    //         depthScale を上げれば減るが、cm 単位のシーンでは精度が足りない。
    //         PCF なら深度比較そのものなので、にじみは原理的に起きない
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    // 【対策】閉じたメッシュなら裏面だけをシャドウマップへ描けばよい。
    //         こうすると自己遮蔽（シャドウアクネ）が原理的に起きず、
    //         隣の個体へ落ちる影はそのまま残る
    sg.forceBackFacesOnly = true;
    // 【対策】バイアスは正規化深度なので、シーンのスケールではなく
    //         autoCalcShadowZBounds が決めた深度域に対して効く。
    //         大きすぎると接地部の影が浮く（ピーターパン）
    sg.bias = 0.0006;
    sg.normalBias = 0.02;
    sg.darkness = 0.34;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.06;
    ip.contrast = 1.12;
    ip.vignetteEnabled = false;

    let ground = null;
    if (GLOBAL.showGround) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 240, height: 2, depth: 240 }, scene);
        const gm = new BABYLON.PBRMaterial("groundMat", scene);
        gm.albedoColor = new BABYLON.Color3(0.90, 0.89, 0.885).toLinearSpace();
        gm.metallic = 0.0; gm.roughness = 0.88;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        ground.material = gm;
        ground.receiveShadows = true;
        // 器の外面とのあいだに 0.8mm のすき間を作る（深度分解能の10倍）
        ground.position.y = -1.08;
        if (physics) {
            new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
                { mass: 0, friction: 0.70, restitution: 0.02 }, scene);
        }
    }

    const basket = buildBasket(scene, GLOBAL);
    if (physics) {
        const bShape = new BABYLON.PhysicsShapeMesh(basket, scene);
        bShape.material = { friction: 0.74, restitution: 0.0 };
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

    // 皮の凹凸の強さと法線の向き。実機で見ながら合わせられるようにする
    const BUMPS = [
        { label: "弱", level: 0.55 },
        { label: "中", level: 1.00 },
        { label: "強", level: 1.50 },
        { label: "最強", level: 2.20 }
    ];
    let bumpIdx = 1, invY = false;
    function applyRelief() {
        for (const k in skinCache) {
            const m = skinCache[k].skin;
            if (m.bumpTexture) m.bumpTexture.level = BUMPS[bumpIdx].level;
            m.invertNormalMapY = invY;
        }
    }
    const DEBUGS = ["通常", "白クレイ", "法線マップ"];
    let dbgIdx = 0;
    function applyDebug() {
        for (const k in skinCache) skinCache[k].setDebug(dbgIdx);
    }

    // ---- 法線の向きを目で判定するための診断ライト --------------------
    // 【対策】既定の照明は key もヘミスフェリックも環境マップも全部「上から」。
    //         接空間で光を (Lu, Lv, Ln) と書くと、法線の v 成分を反転したときの
    //         陰影の変化は 2*nv*Lv、つまり光の v 成分に比例する。
    //         ほぼ真横から当てて初めて差が見える
    const DIAGS = ["OFF", "X方向", "Z方向"];
    let diagIdx = 0;
    const LIGHT0 = {
        dir: key.direction.clone(), keyI: key.intensity,
        fillI: fillL.intensity, ambI: amb.intensity, envI: scene.environmentIntensity
    };
    function applyDiag() {
        if (diagIdx === 0) {
            key.direction = LIGHT0.dir.clone();
            key.intensity = LIGHT0.keyI;
            fillL.intensity = LIGHT0.fillI;
            amb.intensity = LIGHT0.ambI;
            scene.environmentIntensity = LIGHT0.envI;
            return;
        }
        const a = (diagIdx === 1) ? 0 : Math.PI / 2;
        key.direction = new V3(-Math.cos(a) * 0.98, -0.21, -Math.sin(a) * 0.98).normalize();
        key.intensity = 3.2;
        fillL.intensity = 0.0;
        amb.intensity = 0.10;
        scene.environmentIntensity = 0.06;
    }

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
            if (it.shape) it.shape.dispose();
        }
        queue = []; dropIndex = 0; dropTimer = 0;
        settleTimer = 0; postDropTimer = 0; frozen = false;
    }

    // 【対策】全部を同時に生成すると、初期状態で互いにめり込んでいるぶんの
    //         反発が一気に解放されて弾け飛ぶ。1個ずつ、山の頂点のすぐ上から放す
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
        const a0 = rng.range(0, Math.PI * 2);
        for (let i = 0; i < items.length; i++) {
            const e = items[i];
            // 【対策】物理で動かすノードは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            e.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
                rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2));
            const r = GLOBAL.basketRim * 0.36 * Math.sqrt(rng.next());
            const a = a0 + i * 2.39996;                 // 黄金角
            queue.push({ e, x: Math.cos(a) * r, z: Math.sin(a) * r, body: null, shape: null });
            if (physics) e.root.setEnabled(false);
        }
        if (physics) {
            dropTimer = GLOBAL.dropInterval;
        } else {
            for (let i = 0; i < items.length; i++) {
                items[i].root.position.set(
                    0, GLOBAL.basketThick + items[i].R,
                    (i - (items.length - 1) / 2) * items[i].R * 2.4);
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

        for (let i = 0; i < cfg.count; i++) {
            items.push(new Potato(scene, cfg, (seed + i * 7919) >>> 0, skin));
        }

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const e of items) for (const m of e.parts) sg.addShadowCaster(m, true);
        sg.addShadowCaster(basket, true);

        camera.target.set(0, cfg.basketDepth * 0.35, 0);
        camera.radius = cfg.basketRim * 3.2;

        applyDebug();
        applyRelief();
        resetDrop(seed);
        console.log("[Jaga]", BUILD, "/", cfg.label, "/ seed =", cfg.seed, "/", cfg.count, "個");
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
        // 【対策】芽の窪みは1cmに満たない。半径を大きく取ると窪みを拾わず、
        //         個体どうしの隙間しか暗くならない
        // 【対策】芽の受け皿と、個体どうしの隙間の両方を拾わせたい。
        //         半径を絞りすぎると隙間が明るいままで、山が浮いて見える
        ssao.radius = 1.25;
        ssao.totalStrength = 1.30;
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
    dp.bloomWeight = 0.05;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.18;
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
        idle: "#2a2318", active: "#7a5c28", edge: "#4a3f2c",
        text: "#f6efe2", sub: "#c0b298", accent: "#e3c483"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "238px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(18,14,8,0.84)";
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

    addLabel("JAGAIMO", 11, COL.sub, "18px");
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
    for (const c of [3, 5, 8]) {
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
    const dbgBtn = addButton("dbg", "表示: 通常", () => {
        dbgIdx = (dbgIdx + 1) % DEBUGS.length;
        applyDebug(); applyRelief();
        dbgBtn.background = dbgIdx ? COL.active : COL.idle;
        dbgBtn.textBlock.text = "表示: " + DEBUGS[dbgIdx];
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
    const diagBtn = addButton("diag", "診断ライト: OFF", () => {
        diagIdx = (diagIdx + 1) % DIAGS.length;
        applyDiag();
        diagBtn.background = diagIdx ? COL.active : COL.idle;
        diagBtn.textBlock.text = "診断ライト: " + DIAGS[diagIdx];
    });
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
        info.text = state + " / " + items.length + "個 / 長径 " + e.L.toFixed(1)
            + "cm 短径 " + (e.R * 2).toFixed(1) + "cm\nseed: " + curSeed + "  [" + BUILD + "]";
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
    toggleBtn.background = "rgba(18,14,8,0.84)";
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
        toggleBtn.background = panelOpen ? COL.active : "rgba(18,14,8,0.84)";
    }
    toggleBtn.onPointerUpObservable.add(() => { panelOpen = !panelOpen; applyGuiLayout(); });
    engine.onResizeObservable.add(applyGuiLayout);

    highlight();
    applyGuiLayout();

    return scene;
};

export default createScene;