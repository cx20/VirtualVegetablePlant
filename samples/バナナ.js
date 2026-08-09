// =====================================================================
//  Photoreal Banana  /  写実的なバナナ
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG / 熟度プリセット
//    1. Rng          … シード付き擬似乱数（再現性の担保）
//    2. Geo          … 掃引メッシュの共通ビルダ（面の裏表は自動判定）
//    3. Profile      … 断面形状と太さ（果柄から先端まで1本の関数で連続）
//    4. Spine        … 軸。果柄と果実で曲率の向きが逆になる
//    5. TextureLab   … シュガースポット / 縦繊維 / 稜の陰影を手続き生成
//    6. Banana       … 果柄〜果実を1メッシュで掃引
//    7. Scene        … IBL / ライト / 影 / SSAO2 / トーンマッピング
//    8. GUI          … 熟度・本数・個体差（Babylon.GUI）
//
//  実物の要点（ここを外すと「黄色い曲がった円柱」になる）:
//    ・断面は円ではなく5稜の丸みのある多角形。端ほど稜が立つ
//    ・曲率は一様ではなく、中央より両端が強い
//    ・先端に黒い花柱痕、根元に太く角張った果柄がある
//    ・色は一様な黄色ではなく、両端に緑が残り、縦の繊維条がある
//    ・シュガースポットは稜の上と外側に多く、房状に固まって出る
//    ・表面は光沢物ではない。ロウ質の弱い反射のみ
// =====================================================================

var createScene = function () {
    // =================================================================
    // 0. CONFIG
    // =================================================================
    const RIPENESS_PRESETS = {
        green:   { label: "青め",             ripeness: 0.16 },
        ready:   { label: "食べ頃",           ripeness: 0.52 },
        ripe:    { label: "完熟",             ripeness: 0.78 },
        spotted: { label: "シュガースポット", ripeness: 0.96 }
    };

    const GLOBAL = {
        // --- 形状（1 unit ≒ 1cm）
        totalLength: 21.5,       // 果柄を含む全長
        stalkFrac: 0.185,        // 全長に占める果柄の割合（テクスチャと共有するため固定）
        radius: 1.72,            // 果実の最大半径
        bendDeg: 76,             // 果実部の曲がり角（実物は60〜100°）
        stalkBendDeg: 24,        // 果柄の折れ角（果実とは逆向きに曲がる）
        ridgeCount: 5,           // 稜の数（3稜の品種もある）
        ridgeAmp: 0.080,         // 稜の張り出し
        innerFlat: 0.10,         // 内側（凹側）の平坦化
        twistDeg: 9,             // 稜のねじれ
        // --- 分割
        segmentsLength: 160,
        segmentsRound: 32,
        // --- テクスチャ
        textureSize: 512,
        skinDetail: 1.0,         // 縦繊維の強さ（上げすぎると干からびて見える）
        spotDensity: 1100,       // 完熟時のシュガースポット数の上限
        // --- 配置と描画
        count: 1,                // 1=単体 / 3・5=房
        useSSAO: true,
        showGround: false        // trueにすると接地面と落ち影が出る
    };

    const START_RIPE = "ripe";
    const START_SEED = 20260725;

    function buildConfig(ripeKey, seed) {
        const cfg = Object.assign({}, GLOBAL, RIPENESS_PRESETS[ripeKey]);
        cfg.ripeKey = ripeKey;
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
        // 【対策】面の裏表は掃引の向きと断面の回転方向で簡単に反転する。
        //         法線を計算したあと実際に外向きかを判定し、
        //         内向きなら索引の巻き順を入れ替えて作り直す。
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
            // 三角形 (ia,ib,ic) の法線が dir 方向を向いているか
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

            const mi = Math.floor(N / 2), mj = Math.floor(M / 4);
            const vi = mi * M + mj, cc = centers[mi];
            const ox = positions[vi*3] - cc.x, oy = positions[vi*3+1] - cc.y, oz = positions[vi*3+2] - cc.z;
            const dot = ox * normals[vi*3] + oy * normals[vi*3+1] + oz * normals[vi*3+2];
            if (dot < 0) indices = sideIndices(true);

            // 【対策】キャップの巻き順は側面の flip と一致しない。
            //         同じ flip を適用すると、側面が正しいときキャップが裏返り、
            //         端が「穴が開いた筒」に見える。キャップは独立に判定する。
            if (capStart) {
                const back = { x: centers[0].x - centers[1].x, y: centers[0].y - centers[1].y, z: centers[0].z - centers[1].z };
                const okOrder = facesToward(capA, 0, 1, back.x, back.y, back.z);
                for (let j = 0; j < M - 1; j++) {
                    if (okOrder) indices.push(capA, j, j + 1); else indices.push(capA, j + 1, j);
                }
            }
            if (capEnd) {
                const o = (N - 1) * M;
                const fwd = { x: centers[N-1].x - centers[N-2].x, y: centers[N-1].y - centers[N-2].y, z: centers[N-1].z - centers[N-2].z };
                const okOrder = facesToward(capB, o, o + 1, fwd.x, fwd.y, fwd.z);
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
            mesh.__flipped = dot < 0;
            return mesh;
        },

        ring(center, outer, side, M, radiusOf, twist) {
            const pts = [];
            for (let j = 0; j <= M; j++) {
                const phi = (j % M) / M * Math.PI * 2;
                const rr = radiusOf(phi);
                const a = j / M * Math.PI * 2 + twist;   // シーム側も角度は連続させる
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
    // 3. Profile : 果柄の切り口(s=0) から 花柱痕(s=1) まで連続な形状関数
    // =================================================================
    // 【対策】果実と果柄を別メッシュで作ると、必ず継ぎ目に段差か隙間が出る。
    //         太さも断面も1本の関数で表し、1回の掃引で作る。
    function fruitRadius(t) {
        const shoulder = smooth(0, 0.18, t);            // 果柄側の立ち上がり
        const taper = 1 - smooth(0.66, 1.00, t);        // 先端に向かう絞り
        let r = (0.58 + 0.42 * shoulder) * (0.13 + 0.87 * Math.pow(taper, 0.55));
        // 中央のわずかな膨らみ。sin^2 にして t=0 での傾きを0にする
        // （sin のままだと接続部で傾きが不連続になり、稜に微かな段が出る）
        r *= 0.97 + 0.03 * Math.pow(Math.sin(Math.PI * t), 2);
        // 先端を平らなキャップで閉じると切断面に見えるので半球状に丸める
        if (t > 0.962) r *= Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.962) / 0.038, 2)));
        return Math.max(0.012, r);
    }

    function radiusAt(s, cfg) {
        const s0 = cfg.stalkFrac;
        if (s >= s0) return fruitRadius((s - s0) / (1 - s0));
        const u = s / s0;                               // 果柄部 0=切り口 1=果実との境
        // 【対策】接続部の太さを定数でベタ書きすると、果実側の式を少し変えた
        //         だけで段差が復活する。果実側の関数から取る。
        const rCut = 0.44, rMid = 0.27, rJoin = fruitRadius(0);
        return rCut + (rMid - rCut) * smooth(0, 0.45, u) + (rJoin - rMid) * smooth(0.45, 1.0, u);
    }

    // 断面: 丸みのある5角形。端ほど、そして果柄ほど稜が立つ
    function crossAt(phi, s, cfg) {
        const s0 = cfg.stalkFrac;
        let amp, flat;
        if (s >= s0) {
            const t = (s - s0) / (1 - s0);
            const endness = 1 - Math.sin(Math.PI * clamp(t, 0, 1));
            amp = cfg.ridgeAmp * (0.50 + 0.85 * endness);
            flat = cfg.innerFlat;
        } else {
            const u = s / s0;
            // u=1 で果実部 t=0 の値（ridgeAmp*1.35）に一致させて連続にする
            amp = cfg.ridgeAmp * (1.95 - 0.60 * smooth(0.40, 1.0, u));
            flat = cfg.innerFlat * (0.35 + 0.65 * smooth(0.40, 1.0, u));
        }
        let r = 1 + amp * Math.cos(cfg.ridgeCount * phi);
        r *= 1 - flat * Math.max(0, -Math.cos(phi));
        // 房の中で隣と押し合うため、横方向(phi=±90°)が平らになる。
        // 単体で売られている実にもこの平面は残っている。
        const lf = cfg.lateralFlatten || 0;
        if (lf > 0) r *= 1 - lf * Math.pow(Math.abs(Math.sin(phi)), 1.5);
        return r;
    }

    // =================================================================
    // 4. Spine
    // =================================================================
    class Spine {
        constructor(cfg, rng) {
            const N = cfg.segmentsLength;
            const total = cfg.totalLength * rng.range(0.93, 1.07);
            const s0 = cfg.stalkFrac;
            this.total = total;
            this.fruitLength = total * (1 - s0);
            const ds = total / N;

            const bendF = cfg.bendDeg * rng.range(0.87, 1.13) * Math.PI / 180;
            // 【対策】果柄の折れをここまで振ると、先端の向き
            //         (= -仰角 - 果柄の折れ + 果実の曲がり) が符号反転して
            //         垂れ下がった個体が混ざる。振り幅を抑える。
            const bendS = cfg.stalkBendDeg * rng.range(0.85, 1.15) * Math.PI / 180;

            // 曲率プロファイル。果実部は中央より両端が強く曲がる
            const raw = [], isFruit = [];
            for (let i = 0; i <= N; i++) {
                const s = i / N;
                if (s >= s0) {
                    const t = (s - s0) / (1 - s0);
                    raw.push(0.55 + 0.75 * (smooth(0.38, 0.0, t) + smooth(0.62, 1.0, t)));
                    isFruit.push(true);
                } else {
                    const u = s / s0;
                    raw.push(Math.sin(Math.PI * u));
                    isFruit.push(false);
                }
            }
            let sumF = 0, sumS = 0;
            for (let i = 0; i <= N; i++) (isFruit[i] ? (sumF += raw[i]) : (sumS += raw[i]));
            const kF = sumF > 0 ? bendF / sumF : 0;
            const kS = sumS > 0 ? bendS / sumS : 0;

            // 積分して軸を作る（果柄は果実と逆向きに折れる）
            const pts = [];
            let ang = 0, x = 0, y = 0;
            const wob = rng.range(-1, 1) * 0.012;
            for (let i = 0; i <= N; i++) {
                const s = i / N;
                pts.push(new V3(x, y, Math.sin(s * Math.PI * 1.3) * total * wob));
                x += Math.cos(ang) * ds; y += Math.sin(ang) * ds;
                ang += isFruit[i] ? -raw[i] * kF : +raw[i] * kS;
            }

            // --- 正準ローカル系 --------------------------------------
            // 【対策】房に組むには、房側が実の姿勢を決められないと困る。
            //         個体ごとの向きをここで揃えておく:
            //           原点 = 果柄の切り口 / +X = 生え出る向き / +Y = 果実の凸側
            //         果実部の曲率は常に同符号なので、凸側は必ず +Y になる。
            const p0 = pts[0];
            for (const p of pts) { p.x -= p0.x; p.y -= p0.y; p.z -= p0.z; }
            const iA = Math.ceil(s0 * N), iB = N;
            this.iFruitStart = iA;
            this.iMid = Math.floor((iA + iB) / 2);
            this.chord = new V3(pts[iB].x - pts[iA].x, pts[iB].y - pts[iA].y, 0);

            this.points = pts;
            this.totalBend = bendF;
            this.stalkBend = bendS;

            // outer(=凸側) が +Y を向く向きに side の符号を決める
            this.flip = 1;
            if (this.frame(this.iMid).outer.y < 0) this.flip = -1;
        }

        frame(i) {
            const N = this.points.length - 1;
            const a = this.points[Math.max(0, i - 1)], b = this.points[Math.min(N, i + 1)];
            const T = b.subtract(a);
            const l = T.length() || 1; T.x /= l; T.y /= l; T.z /= l;
            const fl = this.flip === undefined ? 1 : this.flip;
            let sx = -T.z * T.x, sy = -T.z * T.y, sz = 1 - T.z * T.z;
            const sl = Math.hypot(sx, sy, sz) || 1;
            const side = new V3(fl * sx / sl, fl * sy / sl, fl * sz / sl);
            const outer = new V3(
                side.y * T.z - side.z * T.y,
                side.z * T.x - side.x * T.z,
                side.x * T.y - side.y * T.x
            );
            return { T, side, outer };
        }
    }

    // 局所座標(切り口原点・+X生長方向・+Y凸側) を配置先へ載せ替える基底
    function makeBasis(origin, dir, upRef) {
        const x = new V3(dir.x, dir.y, dir.z); x.normalize();
        const d = upRef.x * x.x + upRef.y * x.y + upRef.z * x.z;
        const y = new V3(upRef.x - x.x * d, upRef.y - x.y * d, upRef.z - x.z * d);
        y.normalize();
        const z = new V3(x.y * y.z - x.z * y.y, x.z * y.x - x.x * y.z, x.x * y.y - x.y * y.x);
        return { o: origin, x, y, z };
    }
    function mapPoint(b, p) {
        return new V3(
            b.o.x + b.x.x * p.x + b.y.x * p.y + b.z.x * p.z,
            b.o.y + b.x.y * p.x + b.y.y * p.y + b.z.y * p.z,
            b.o.z + b.x.z * p.x + b.y.z * p.y + b.z.z * p.z);
    }
    function mapVec(b, v) {
        return new V3(
            b.x.x * v.x + b.y.x * v.y + b.z.x * v.z,
            b.x.y * v.x + b.y.y * v.y + b.z.y * v.z,
            b.x.z * v.x + b.y.z * v.y + b.z.z * v.z);
    }

    // 房(hand)の配置。
    // 実物は1本の花軸の切り口(クラウン)から指(finger)が2列に出て扇状に開く。
    // 【対策】同じ実を平行移動で並べても房には見えない。
    //         果柄の付け根をクラウンの内部に置き、方位角・仰角・軸まわりの
    //         ロールを個別に与えて初めて房の形になる。
    // 【対策】実物の房は放射状に開かない。付け根で横に並び、
    //         そこからほぼ平行に伸びて互いに密着する。
    //         隣との間隔は「方位角の開き」ではなく「付け根の横間隔」で作る。
    //         扇を40°も取ると花のように広がってしまう。
    const HAND = {
        crownHeight: 5.2,
        rowY: [-1.05, -3.45],        // 上段/下段の取り付け高さ（この差が上下の分離を作る）
        rowRadius: [0.45, 0.70],     // クラウン軸からの前後位置
        lateral: 1.60,               // 同じ段で隣り合う指の横間隔（付け根）
        // 【対策】下段は上段より1本少ないので、同じ刻みでそのまま上段の
        //         中間位置に来る。ここでさらに半ピッチずらすと、上段の指の
        //         真下に重なって交差する（方位角のときと同じ罠）。
        rowLateralShift: [0, 0],
        fanStepDeg: 14,              // 先端に向かってわずかに開く
        rowTipDeg: [30, 24],         // 先端をどれだけ持ち上げるか
        rollDeg: 9                   // 外側の指ほど外へロールする
    };

    // v を axis まわりに ang だけ回す（v ⟂ axis を前提）
    function rotateAboutAxis(v, axis, ang) {
        const c = Math.cos(ang), s = Math.sin(ang);
        const cx = axis.y * v.z - axis.z * v.y;
        const cy = axis.z * v.x - axis.x * v.z;
        const cz = axis.x * v.y - axis.y * v.x;
        return new V3(v.x * c + cx * s, v.y * c + cy * s, v.z * c + cz * s);
    }

    function handPlacements(n, rng) {
        if (n <= 1) return [null];   // 単体は自動姿勢
        const rows = n <= 3 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)];
        const out = [];
        for (let ri = 0; ri < rows.length; ri++) {
            const cnt = rows[ri];
            for (let i = 0; i < cnt; i++) {
                const k = cnt === 1 ? 0 : (i / (cnt - 1) - 0.5);
                out.push({
                    psi: k * HAND.fanStepDeg * (cnt - 1) * Math.PI / 180 + rng.gauss(0, 0.02),
                    lateral: k * HAND.lateral * (cnt - 1) + HAND.rowLateralShift[ri],
                    rc: HAND.rowRadius[ri],
                    y: HAND.rowY[ri] + rng.gauss(0, 0.06),
                    roll: k * HAND.rollDeg * 2 * Math.PI / 180,
                    // 仰角ではなく「先端をどこへ向けたいか」を指定する。
                    // 仰角は実の実測値から Banana 側で逆算する。
                    tip: HAND.rowTipDeg[ri] * Math.PI / 180 + rng.gauss(0, 0.03)
                });
            }
        }
        return out;
    }

    // クラウン（花軸の切り株）の半径。指の果柄の付け根を飲み込む大きさが必要。
    // 干渉検査からも参照するので関数として独立させる。
    // 【対策】指を横に並べた分だけクラウンも広くないと、果柄の切り口が
    //         クラウンからはみ出して露出する。指の広がりから幅を決める。
    let crownMidR = 2.6;
    function crownRadius(y, phi) {
        const H = HAND.crownHeight;
        const s = clamp(-y / H, 0, 1);
        const topR = crownMidR * 0.50, midR = crownMidR, botR = crownMidR * 0.36;
        let r = topR + (midR - topR) * smooth(0, 0.32, s);
        r = r + (botR - r) * smooth(0.70, 1.0, s);   // 下段の果柄を隠せるよう裾を残す
        // 指の並ぶ z 方向に長い楕円 + 縦の稜
        // 【対策】扁平にしすぎると、下段の果柄がクラウンを出た直後に
        //         剥き出しになり、隣と擦れているのが見えてしまう。
        const e = 1 / Math.sqrt(Math.pow(Math.cos(phi) / 0.62, 2) + Math.pow(Math.sin(phi), 2));
        return r * e * (1 + 0.06 * Math.cos(7 * phi));
    }
    function isInsideCrown(p) {
        if (p.y > 0.2 || p.y < -HAND.crownHeight) return false;
        return Math.hypot(p.x, p.z) < crownRadius(p.y, Math.atan2(p.z, p.x));
    }

    function buildCrown(scene, rng, mat, places) {
        let span = 0;
        for (const p of places) span = Math.max(span, Math.abs(p.lateral));
        crownMidR = Math.max(1.95, span + 1.20);
        const K = 26, M = 22;
        const H = HAND.crownHeight;
        const rings = [], centers = [];
        for (let k = 0; k <= K; k++) {
            const s = k / K;
            const y = -s * H;
            const c = new V3(0, y, 0);
            rings.push(Geo.ring(c, new V3(1, 0, 0), new V3(0, 0, 1), M, (phi) => crownRadius(y, phi), 0));
            centers.push(c);
        }
        const mesh = Geo.build("crown", rings, centers, true, true, scene);
        const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const uv = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
        const col = new Float32Array((pos.length / 3) * 4);
        const cut = new BABYLON.Color3(0.62, 0.55, 0.41).toLinearSpace();
        const body = new BABYLON.Color3(0.46, 0.41, 0.24).toLinearSpace();
        for (let i = 0, c = 0; i < pos.length / 3; i++, c += 4) {
            const v = uv ? uv[i * 2 + 1] : 0;
            const w = smooth(0.0, 0.14, v);
            col[c] = mix(cut.r, body.r, w);
            col[c + 1] = mix(cut.g, body.g, w);
            col[c + 2] = mix(cut.b, body.b, w);
            col[c + 3] = 1;
        }
        mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false, 4);
        mesh.hasVertexAlpha = false;
        mesh.material = mat;
        mesh.receiveShadows = true;
        return mesh;
    }

    // =================================================================
    // 5. TextureLab
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

        // ---- シュガースポット ------------------------------------------
        // 【対策】アルベド・ORM・法線が同じ斑点を必要とする。
        //         3回別々に散らすと位置がズレるので、1枚焼いて共有する。
        spotMask(size, seed, ripeness, cfg) {
            const core = new Float32Array(size * size);
            const soft = new Float32Array(size * size);
            const r = new Rng(seed);
            const s0 = cfg.stalkFrac;

            const amount = Math.pow(clamp((ripeness - 0.44) / 0.56, 0, 1), 1.35);
            const nSpot = Math.round(amount * cfg.spotDensity);
            const nCluster = Math.max(1, Math.round(nSpot / 14));

            const cu = [], cv = [];
            for (let k = 0; k < nCluster; k++) {
                let u = r.next();
                // 稜の上に並びやすい（実物で最も目立つ特徴）
                if (r.next() < 0.5) u = (Math.round(u * cfg.ridgeCount) / cfg.ridgeCount + r.gauss(0, 0.04) + 1) % 1;
                cu.push(u);
                // 果柄には出ない。先端付近は少ない
                cv.push(clamp(r.range(s0 + 0.05, 0.95), s0 + 0.03, 0.96));
            }

            const blot = (buf, ux, vy, rad, elong, power) => {
                const rx = Math.max(1, rad), ry = Math.max(1, rad * elong);
                const x0 = Math.floor(ux - rx), x1 = Math.ceil(ux + rx);
                const y0 = Math.max(0, Math.floor(vy - ry)), y1 = Math.min(size - 1, Math.ceil(vy + ry));
                for (let y = y0; y <= y1; y++) {
                    const dy = (y - vy) / ry;
                    for (let x = x0; x <= x1; x++) {
                        const dx = (x - ux) / rx;
                        const d = Math.hypot(dx, dy);
                        if (d >= 1) continue;
                        const w = Math.pow(1 - d, power);
                        const xw = ((x % size) + size) % size;      // u方向は巻く
                        const i = y * size + xw;
                        if (w > buf[i]) buf[i] = w;
                    }
                }
            };

            for (let k = 0; k < nSpot; k++) {
                const c = r.int(nCluster);
                const u = (cu[c] + r.gauss(0, 0.055) + 1) % 1;
                const v = clamp(cv[c] + r.gauss(0, 0.085), s0 + 0.02, 0.97);
                const big = r.next() < 0.08;
                const rad = (big ? r.range(0.012, 0.030) : r.range(0.0035, 0.010)) * size;
                blot(core, u * size, v * size, rad, r.range(1.15, 1.9), r.range(0.55, 1.1));
            }
            const nBruise = Math.round(Math.pow(clamp((ripeness - 0.72) / 0.28, 0, 1), 1.6) * 9);
            for (let k = 0; k < nBruise; k++) {
                blot(soft, r.next() * size, r.range(s0 + 0.08, 0.9) * size,
                    r.range(0.05, 0.13) * size, r.range(1.4, 2.6), 1.7);
            }
            return { core, soft };
        },

        streak1D(size, seed) {
            const a = new Float32Array(size);
            for (let x = 0; x < size; x++) {
                const u = x / size;
                a[x] = this.fbm(u * 46, 0.5, 46, seed, 2) * 0.62
                     + this.fbm(u * 150, 3.5, 150, seed + 17, 1) * 0.38;
            }
            return a;
        },

        albedo(scene, size, seed, ripeness, spots, cfg) {
            const streak = this.streak1D(size, seed + 5);
            const s0 = cfg.stalkFrac;
            const GREEN = [0.40, 0.53, 0.15];
            const YELLOW = [0.94, 0.79, 0.16];
            const GOLD = [0.84, 0.59, 0.10];
            const SPOT = [0.30, 0.16, 0.06];
            const SPOTC = [0.11, 0.062, 0.035];
            const BRUISE = [0.44, 0.32, 0.14];
            const TIP = [0.085, 0.062, 0.050];
            const STALK = [0.30, 0.26, 0.13];
            const CUT = [0.52, 0.45, 0.31];

            return this._canvasTexture("bananaAlbedo", size, (d, S) => {
                for (let y = 0; y < S; y++) {
                    const v = y / S;
                    const inFruit = smooth(s0 - 0.02, s0 + 0.05, v);
                    // 果実部: 両端は最後まで緑が残る
                    const tt = clamp((v - s0) / (1 - s0), 0, 1);
                    const middle = smooth(0.03, 0.18, tt) * (1 - smooth(0.78, 0.97, tt));
                    const localRipe = clamp(ripeness * (0.52 + 0.48 * middle), 0, 1);
                    const toYellow = clamp(localRipe / 0.48, 0, 1);
                    const toGold = clamp((localRipe - 0.55) / 0.45, 0, 1) * 0.55;
                    const tipK = smooth(0.955, 1.0, v);
                    const cutK = smooth(0.055, 0.0, v);
                    for (let x = 0; x < S; x++) {
                        const u = x / S, i = (y * S + x) * 4;
                        let cr = mix(GREEN[0], YELLOW[0], toYellow);
                        let cg = mix(GREEN[1], YELLOW[1], toYellow);
                        let cb = mix(GREEN[2], YELLOW[2], toYellow);
                        cr = mix(cr, GOLD[0], toGold); cg = mix(cg, GOLD[1], toGold); cb = mix(cb, GOLD[2], toGold);

                        // 果柄は褐色。境目は滑らかに繋ぐ
                        cr = mix(STALK[0], cr, inFruit);
                        cg = mix(STALK[1], cg, inFruit);
                        cb = mix(STALK[2], cb, inFruit);

                        // 縦繊維（明度のみ動かす。色相を動かすと汚れて見える）
                        const st = 0.93 + 0.14 * streak[x];
                        const ridge = 1 + 0.045 * Math.cos(cfg.ridgeCount * u * Math.PI * 2);
                        const k = st * ridge;
                        cr *= k; cg *= k; cb *= k;

                        const sf = spots.soft[y * S + x];
                        if (sf > 0) {
                            const w = Math.min(1, sf * 0.75);
                            cr = mix(cr, BRUISE[0], w); cg = mix(cg, BRUISE[1], w); cb = mix(cb, BRUISE[2], w);
                        }
                        const sc = spots.core[y * S + x];
                        if (sc > 0) {
                            const w = smooth(0.06, 0.55, sc), core = smooth(0.55, 0.92, sc);
                            cr = mix(cr, mix(SPOT[0], SPOTC[0], core), w);
                            cg = mix(cg, mix(SPOT[1], SPOTC[1], core), w);
                            cb = mix(cb, mix(SPOT[2], SPOTC[2], core), w);
                        }
                        if (tipK > 0) { cr = mix(cr, TIP[0], tipK); cg = mix(cg, TIP[1], tipK); cb = mix(cb, TIP[2], tipK); }
                        if (cutK > 0) { cr = mix(cr, CUT[0], cutK); cg = mix(cg, CUT[1], cutK); cb = mix(cb, CUT[2], cutK); }

                        d[i] = clamp(cr, 0, 1) * 255;
                        d[i + 1] = clamp(cg, 0, 1) * 255;
                        d[i + 2] = clamp(cb, 0, 1) * 255;
                        d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        orm(scene, size, seed, spots, cfg) {
            const streak = this.streak1D(size, seed + 5);
            const s0 = cfg.stalkFrac;
            return this._canvasTexture("bananaORM", size, (d, S) => {
                for (let y = 0; y < S; y++) {
                    const v = y / S;
                    const inFruit = smooth(s0 - 0.02, s0 + 0.05, v);
                    const tipK = smooth(0.95, 1.0, v);
                    for (let x = 0; x < S; x++) {
                        const u = x / S, i = (y * S + x) * 4;
                        const ridge = Math.cos(cfg.ridgeCount * u * Math.PI * 2);
                        // 谷は触れられずザラつき、稜は擦れて滑らか
                        let rough = 0.46 - 0.07 * ridge + 0.05 * streak[x];
                        let ao = 0.94 - 0.06 * Math.max(0, -ridge);
                        rough = mix(0.88, rough, inFruit);          // 果柄は粗い
                        const sc = spots.core[y * S + x];
                        rough = mix(rough, 0.74, smooth(0.05, 0.7, sc));
                        ao = mix(ao, 0.72, smooth(0.25, 0.95, sc));
                        rough = mix(rough, 0.90, tipK);
                        d[i] = clamp(ao, 0, 1) * 255;
                        d[i + 1] = clamp(rough, 0.05, 1) * 255;
                        d[i + 2] = 0; d[i + 3] = 255;
                    }
                }
            }, scene);
        },

        // 【対策】ブドウのときと同じ罠。低周波を強く入れると干からびて見える。
        //         縦方向に引き伸ばした高周波だけを弱く使う。
        normal(scene, size, seed, spots, detail) {
            const h = new Float32Array(size * size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size;
                    const fib = this.fbm(u * 90, v * 7, 90, seed, 2) * 0.72
                              + this.fbm(u * 26, v * 3, 26, seed + 31, 1) * 0.28;
                    h[y * size + x] = fib - spots.core[y * size + x] * 0.55;   // 斑点は少し凹む
                }
            }
            return this._canvasTexture("bananaNormal", size, (d, S) => {
                const strength = 0.80 * (detail === undefined ? 1 : detail);
                for (let y = 0; y < S; y++) {
                    for (let x = 0; x < S; x++) {
                        const xl = h[y * S + ((x - 1 + S) % S)], xr = h[y * S + ((x + 1) % S)];
                        const yu = h[Math.max(0, y - 1) * S + x], yd = h[Math.min(S - 1, y + 1) * S + x];
                        let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
                        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
                        const i = (y * S + x) * 4;
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
    //  SkinFactory : 熟度ごとのマテリアル（キャッシュ対象）
    // =================================================================
    class SkinFactory {
        constructor(scene, cfg) {
            const S = cfg.textureSize;
            const spots = TextureLab.spotMask(S, 1301, cfg.ripeness, cfg);
            let n = 0;
            for (let i = 0; i < spots.core.length; i++) if (spots.core[i] > 0.2) n++;
            this.spotCoverage = n / spots.core.length;

            this.albedoTex = TextureLab.albedo(scene, S, 77, cfg.ripeness, spots, cfg);
            this.ormTex = TextureLab.orm(scene, S, 77, spots, cfg);
            this.normalTex = TextureLab.normal(scene, S, 909, spots, cfg.skinDetail);

            const pbr = new BABYLON.PBRMaterial("bananaSkin", scene);
            pbr.albedoTexture = this.albedoTex;
            pbr.metallic = 0.0;
            pbr.roughness = 1.0;                     // 実値はORMのGチャンネル
            pbr.metallicTexture = this.ormTex;
            pbr.useAmbientOcclusionFromMetallicTextureRed = true;
            pbr.useRoughnessFromMetallicTextureGreen = true;
            pbr.useMetallnessFromMetallicTextureBlue = true;
            pbr.bumpTexture = this.normalTex;
            pbr.bumpTexture.level = 0.45;
            // 【対策】バナナは光沢物ではない。クリアコートを強くすると
            //         プラスチックの玩具になる。ロウ質の弱い反射だけ乗せる
            pbr.clearCoat.isEnabled = true;
            pbr.clearCoat.intensity = 0.22;
            pbr.clearCoat.roughness = 0.38;
            pbr.subSurface.isTranslucencyEnabled = true;
            pbr.subSurface.tintColor = new BABYLON.Color3(0.55, 0.42, 0.10);
            pbr.subSurface.translucencyIntensity = 0.26;
            pbr.subSurface.minimumThickness = 0.2;
            pbr.subSurface.maximumThickness = 1.2;
            this.skin = pbr;

            // クラウン（花軸の切り株）。実色は頂点カラーで与える
            const crown = new BABYLON.PBRMaterial("bananaCrown", scene);
            crown.albedoColor = new BABYLON.Color3(1, 1, 1);
            crown.metallic = 0.0;
            crown.roughness = 0.88;
            crown.bumpTexture = this.normalTex;
            this.crown = crown;
        }
        dispose() {
            this.skin.dispose(true, false);
            this.crown.dispose(true, false);
            this.albedoTex.dispose(); this.ormTex.dispose(); this.normalTex.dispose();
        }
    }

    // =================================================================
    // 6. Banana
    // =================================================================
    class Banana {
        constructor(scene, cfg, seed, skin, placement) {
            this.scene = scene; this.cfg = cfg;
            const rng = new Rng(seed);
            this.spine = new Spine(cfg, rng);
            this.radius = cfg.radius * rng.range(0.93, 1.07);
            this.basis = this._resolveBasis(placement);

            const N = cfg.segmentsLength, M = cfg.segmentsRound;
            const rings = [], centers = [];
            this.worldPoints = [];
            this.frames = [];
            for (let i = 0; i <= N; i++) {
                const s = i / N;
                const f = this.spine.frame(i);
                const c = mapPoint(this.basis, this.spine.points[i]);
                const outer = mapVec(this.basis, f.outer);
                const side = mapVec(this.basis, f.side);
                const prof = radiusAt(s, cfg) * this.radius;
                const twist = cfg.twistDeg * Math.PI / 180 * s;
                rings.push(Geo.ring(c, outer, side, M,
                    (phi) => prof * crossAt(phi, s, cfg), twist));
                centers.push(c);
                this.worldPoints.push(c);
                this.frames.push({ outer, side, twist });
            }
            // 切り口(s=0)は実際に平らなのでキャップする。先端は丸まって閉じている
            this.mesh = Geo.build("banana", rings, centers, true, true, scene);
            this.mesh.material = skin.skin;
            this.mesh.receiveShadows = true;
            this.parts = [this.mesh];
            this.centers = centers;
        }

        // placement 未指定（単体表示）のときは、果実部の弦を水平にし凸側を上へ向ける
        _resolveBasis(placement) {
            if (placement) {
                // 【対策】先端の向き = -仰角 - 果柄の折れ + 果実の曲がり。
                //         曲がりは個体ごとにランダムなので、仰角を定数にすると
                //         垂れ下がったままの実が混ざる。実測値から逆算する。
                const pitch = this.spine.totalBend - this.spine.stalkBend - placement.tip;
                const cp = Math.cos(pitch), sp = Math.sin(pitch);
                const h = new V3(-Math.cos(placement.psi), 0, Math.sin(placement.psi));
                const dir = new V3(h.x * cp, -sp, h.z * cp);
                // 凸側(局所+Y)は下向き。ここを上向きにすると房が上下逆さになる
                let up = new V3(-h.x * sp, -cp, -h.z * sp);
                const axis = new V3(dir.x, dir.y, dir.z); axis.normalize();
                up = rotateAboutAxis(up, axis, placement.roll);
                const origin = new V3(h.x * placement.rc, placement.y,
                    h.z * placement.rc + placement.lateral);
                this.pitch = pitch;
                return makeBasis(origin, dir, up);
            }
            const c = this.spine.chord;
            const th = -Math.atan2(c.y, c.x);
            const ct = Math.cos(th), stg = Math.sin(th);
            return {
                o: new V3(0, 0, 0),
                x: new V3(ct, stg, 0),
                y: new V3(-stg, ct, 0),
                z: new V3(0, 0, 1)
            };
        }

        // 軸に沿った局所半径（房の干渉検査に使う）
        radiusAtIndex(i) {
            const s = i / this.cfg.segmentsLength;
            return radiusAt(s, this.cfg) * this.radius * (1 + this.cfg.ridgeAmp * 1.35);
        }

        // 指定した方向における実際の断面半径。
        // 隣の指との距離を測るとき、稜のある最大半径で代用すると
        // 実際には触れていない場所まで貫通と判定されてしまう。
        radiusToward(i, dx, dy, dz) {
            const f = this.frames[i];
            const co = dx * f.outer.x + dy * f.outer.y + dz * f.outer.z;
            const cs = dx * f.side.x + dy * f.side.y + dz * f.side.z;
            const phi = Math.atan2(cs, co) - f.twist;
            const s = i / this.cfg.segmentsLength;
            return radiusAt(s, this.cfg) * this.radius * crossAt(phi, s, this.cfg);
        }

        bounds() {
            const p = this.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (let i = 0; i < p.length; i += 3) {
                if (p[i] < minX) minX = p[i]; if (p[i] > maxX) maxX = p[i];
                if (p[i + 1] < minY) minY = p[i + 1]; if (p[i + 1] > maxY) maxY = p[i + 1];
                if (p[i + 2] < minZ) minZ = p[i + 2]; if (p[i + 2] > maxZ) maxZ = p[i + 2];
            }
            return { minX, maxX, minY, maxY, minZ, maxZ };
        }

        dispose() { this.mesh.dispose(); this.parts.length = 0; }
    }

    // =================================================================
    // 7. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.05, 1);

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.95;
    scene.createDefaultSkybox(env, true, 1000, 0.45, false);

    const camera = new BABYLON.ArcRotateCamera("cam", -1.15, 1.16, 42, new V3(0, 0, 0), scene);
    camera.attachControl(true);
    camera.wheelPrecision = 6;
    camera.minZ = 0.1;
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 200;
    scene.cameraToUseForPointers = camera;

    const key = new BABYLON.DirectionalLight("key", new V3(-0.5, -0.95, 0.4).normalize(), scene);
    key.position = new V3(20, 34, -18);
    key.intensity = 3.0;
    key.diffuse = new BABYLON.Color3(1.0, 0.97, 0.92);
    key.autoCalcShadowZBounds = true;

    const rim = new BABYLON.DirectionalLight("rim", new V3(0.5, -0.25, -1.0).normalize(), scene);
    rim.intensity = 3.0;
    rim.diffuse = new BABYLON.Color3(1.0, 0.93, 0.84);

    const fill = new BABYLON.HemisphericLight("fill", new V3(0, 1, 0), scene);
    fill.intensity = 0.14;

    const sg = new BABYLON.ShadowGenerator(1024, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.bias = 0.004;
    sg.normalBias = 0.02;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.10;
    ip.contrast = 1.30;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 2.0;
    ip.vignetteCameraFov = 0.7;
    ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    let ground = null;
    function ensureGround(y) {
        if (!GLOBAL.showGround) return;
        if (!ground) {
            ground = BABYLON.MeshBuilder.CreateDisc("ground", { radius: 60, tessellation: 64 }, scene);
            ground.rotation.x = Math.PI / 2;
            const gm = new BABYLON.PBRMaterial("groundMat", scene);
            gm.albedoColor = new BABYLON.Color3(0.16, 0.14, 0.13).toLinearSpace();
            gm.metallic = 0.0; gm.roughness = 0.72;
            ground.material = gm;
            ground.receiveShadows = true;
        }
        ground.position.y = y;
    }

    // =================================================================
    //  生成 / 差し替え
    // =================================================================
    let state = null;
    const skinCache = {};       // 熟度キー → SkinFactory
    let ssao = null;
    let onRebuilt = null;

    function build(ripeKey, seed, count) {
        if (state) {
            for (const b of state.bananas) b.dispose();
            if (state.crown) state.crown.dispose();
            if (state.groupRoot) state.groupRoot.dispose();
            state = null;
        }
        const cfg = buildConfig(ripeKey, seed);
        cfg.count = count;

        // 【対策】テクスチャは熟度だけで決まる。本数や個体差で焼き直すと
        //         GUI操作のたびに固まる。熟度単位でキャッシュする
        let skin = skinCache[ripeKey];
        if (!skin) { skin = new SkinFactory(scene, cfg); skinCache[ripeKey] = skin; }

        const n = Math.max(1, count | 0);
        const rng = new Rng((cfg.seed ^ 0x9E3779B9) >>> 0);
        const places = handPlacements(n, rng);

        const groupRoot = new BABYLON.TransformNode("hand", scene);
        const bananas = [];
        for (let i = 0; i < n; i++) {
            const b = new Banana(scene, cfg, (cfg.seed + i * 7919) >>> 0, skin, places[i]);
            b.mesh.parent = groupRoot;
            bananas.push(b);
        }
        let crown = null;
        if (n > 1) {
            crown = buildCrown(scene, rng, skin.crown, places);
            crown.parent = groupRoot;
        }

        state = { cfg, skin, bananas, crown, groupRoot };

        const sm = sg.getShadowMap();
        if (sm && sm.renderList) sm.renderList.length = 0;
        for (const b of bananas) sg.addShadowCaster(b.mesh, true);
        if (crown) sg.addShadowCaster(crown, true);

        // 房全体のバウンディングを取って中央へ寄せ、カメラを合わせる
        let bb = null;
        const merge = (o) => {
            if (!bb) { bb = Object.assign({}, o); return; }
            bb.minX = Math.min(bb.minX, o.minX); bb.maxX = Math.max(bb.maxX, o.maxX);
            bb.minY = Math.min(bb.minY, o.minY); bb.maxY = Math.max(bb.maxY, o.maxY);
            bb.minZ = Math.min(bb.minZ, o.minZ); bb.maxZ = Math.max(bb.maxZ, o.maxZ);
        };
        for (const b of bananas) merge(b.bounds());
        if (crown) {
            const p = crown.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            let o = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
            for (let i = 0; i < p.length; i += 3) {
                o.minX = Math.min(o.minX, p[i]); o.maxX = Math.max(o.maxX, p[i]);
                o.minY = Math.min(o.minY, p[i + 1]); o.maxY = Math.max(o.maxY, p[i + 1]);
                o.minZ = Math.min(o.minZ, p[i + 2]); o.maxZ = Math.max(o.maxZ, p[i + 2]);
            }
            merge(o);
        }
        groupRoot.position.x = -(bb.minX + bb.maxX) * 0.5;
        groupRoot.position.y = -(bb.minY + bb.maxY) * 0.5;
        groupRoot.position.z = -(bb.minZ + bb.maxZ) * 0.5;
        state.bounds = bb;

        ensureGround(bb.minY + groupRoot.position.y - 0.02);
        camera.target.set(0, 0, 0);
        const span = Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ, bb.maxY - bb.minY);
        camera.radius = span * 2.0;
        if (ssao) ssao.radius = cfg.radius * 0.9;
        if (onRebuilt) onRebuilt(state);

        console.log("[Banana]", cfg.label, "/ count =", n, "/ seed =", cfg.seed,
            "/ spots =", (skin.spotCoverage * 100).toFixed(1) + "%");
        return state;
    }

    build(START_RIPE, START_SEED, GLOBAL.count);

    if (GLOBAL.useSSAO) {
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.75, blurRatio: 1.0 }, [camera]);
        ssao.radius = state.cfg.radius * 0.9;
        ssao.totalStrength = 1.10;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 200;
        ssao.minZAspect = 0.25;
    }
    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.90;
    dp.bloomWeight = 0.15;
    dp.bloomKernel = 48;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.20;
    dp.depthOfFieldEnabled = true;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
    dp.depthOfField.fStop = 4.0;
    dp.depthOfField.focalLength = 60;
    dp.depthOfField.focusDistance = camera.radius * 1000;
    scene.onBeforeRenderObservable.add(() => {
        if (dp.depthOfFieldEnabled) dp.depthOfField.focusDistance = camera.radius * 1000;
    });

    // =================================================================
    // 8. GUI
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
        idle: "#2e2a22", active: "#8a6d1f", edge: "#4d4535",
        text: "#f2ecdd", sub: "#b3a888", accent: "#e0c165"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "236px";
    card.adaptHeightToChildren = true;
    card.cornerRadius = 10; card.thickness = 1;
    card.color = COL.edge; card.background = "rgba(18,16,12,0.80)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "16px";
    ui.addControl(card);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "204px"; panel.isVertical = true;
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
    function addSpacer(h) {
        const r = new BABYLON.GUI.Rectangle();
        r.height = h; r.thickness = 0; r.background = "";
        panel.addControl(r);
    }

    addLabel("BANANA", 11, COL.sub, "18px");
    addLabel("熟度", 13, COL.accent, "22px");

    let curRipe = START_RIPE, curSeed = START_SEED, curCount = GLOBAL.count;
    const ripeButtons = {}, countButtons = {};

    function highlight() {
        for (const k in ripeButtons) ripeButtons[k].background = (k === curRipe) ? COL.active : COL.idle;
        for (const k in countButtons) countButtons[k].background = (+k === curCount) ? COL.active : COL.idle;
    }
    function rebuild() { build(curRipe, curSeed, curCount); highlight(); }

    for (const key of Object.keys(RIPENESS_PRESETS)) {
        ripeButtons[key] = addButton("r_" + key, RIPENESS_PRESETS[key].label,
            () => { curRipe = key; rebuild(); });
    }

    addSpacer("8px");
    addLabel("本数", 13, COL.accent, "22px");
    for (const n of [1, 3, 5]) {
        countButtons[n] = addButton("c_" + n, n === 1 ? "単体" : n + "本の房",
            () => { curCount = n; rebuild(); });
    }

    addSpacer("8px");
    addButton("reseed", "別の個体を生成", () => {
        curSeed = (curSeed * 1664525 + 1013904223) >>> 0;
        rebuild();
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
        const b = st.bananas[0];
        info.text = "曲がり " + (b.spine.totalBend * 180 / Math.PI).toFixed(0) + "° / 全長 "
            + b.spine.total.toFixed(1) + "cm\nシュガースポット "
            + (st.skin.spotCoverage * 100).toFixed(1) + "%"
            + (st.crown ? " / クラウン有" : "") + "\nseed: " + st.cfg.seed;
    };
    onRebuilt(state);
    highlight();

    return scene;
};

export default createScene;