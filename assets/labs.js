/* =======================================================================
   やさいのつくりかた — インタラクティブ部
   ライブラリ不使用。Canvas 2D の上に、プロジェクトのコードと同じ手順で
   ミニチュアの回転体レンダラを組んである。
   ======================================================================= */
(function () {
"use strict";

var TAU = Math.PI * 2;
var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function mix(a, b, t) { return a + (b - a) * t; }
function smooth(a, b, x) { var t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); }
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

/* --------------------------------------------------------------
   1. Rng — プロジェクトの Rng をそのまま移植
   -------------------------------------------------------------- */
function Rng(seed) { this.s = seed >>> 0; }
Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) | 0;
    var t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
Rng.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
Rng.prototype.gauss = function (m, sd) {
    var u = Math.max(1e-9, this.next()), v = this.next();
    return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

/* --------------------------------------------------------------
   2. Noise — 2D値ノイズ / u方向に折り返す周期版 / fBm
   -------------------------------------------------------------- */
var Noise = {
    h2: function (x, y, seed) {
        var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
        return (h >>> 0) / 4294967295;
    },
    v2: function (x, y, seed) {
        var xi = Math.floor(x), yi = Math.floor(y);
        var xf = x - xi, yf = y - yi;
        var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        var a = this.h2(xi, yi, seed), b = this.h2(xi + 1, yi, seed);
        var c = this.h2(xi, yi + 1, seed), d = this.h2(xi + 1, yi + 1, seed);
        return mix(mix(a, b, u), mix(c, d, u), v);
    },
    // u 方向だけ折り返す（一周してつながる）
    v2u: function (x, y, px, seed) {
        var xi = Math.floor(x), yi = Math.floor(y);
        var xf = x - xi, yf = y - yi;
        var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        var p = Math.max(1, px | 0);
        var x0 = xi % p; if (x0 < 0) x0 += p;
        var x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
        var a = this.h2(x0, yi, seed), b = this.h2(x1, yi, seed);
        var c = this.h2(x0, yi + 1, seed), d = this.h2(x1, yi + 1, seed);
        return mix(mix(a, b, u), mix(c, d, u), v);
    },
    fbm: function (x, y, seed, oct) {
        var s = 0, a = 0.5, f = 1, n = 0;
        for (var o = 0; o < oct; o++) { s += a * this.v2(x * f, y * f, seed + o * 131); n += a; f *= 2; a *= 0.5; }
        return s / n;
    },
    fbmu: function (x, y, period, seed, oct) {
        var s = 0, a = 0.5, f = 1, n = 0;
        for (var o = 0; o < oct; o++) {
            s += a * this.v2u(x * f, y * f, (period * f) | 0, seed + o * 131);
            n += a; f *= 2; a *= 0.5;
        }
        return s / n;
    }
};

/* --------------------------------------------------------------
   3. プロファイル → 回転体
   -------------------------------------------------------------- */
function sampleProfile(ctrl, t) {
    var n = ctrl.length;
    if (t <= ctrl[0].t) return ctrl[0].r;
    if (t >= ctrl[n - 1].t) return ctrl[n - 1].r;
    var i = 0;
    while (i < n - 2 && ctrl[i + 1].t < t) i++;
    var p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
    var u = (t - p1.t) / ((p2.t - p1.t) || 1e-6);
    var r = 0.5 * ((2 * p1.r) + (-p0.r + p2.r) * u
        + (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * u * u
        + (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * u * u * u);
    return Math.max(0.001, r);
}

function makeShape(ctrl, o) {
    o = o || {};
    var bump = o.bump || 0, ridge = o.ridge || 0, ridgeAmp = o.ridgeAmp == null ? 0.07 : o.ridgeAmp;
    var seed = o.seed || 7, height = o.height || 1.7, rs = o.rscale || 1;
    // 肩のくぼみ。プロファイルは t→r しか持てないので、へこみは y 側を曲げて作る。
    // dipFrom から上を dip だけ沈めると、ヘタが座る皿ができる。
    var dip = o.dip || 0, dipFrom = o.dipFrom == null ? 0.78 : o.dipFrom;
    function radius(t, a) {
        var r = sampleProfile(ctrl, t) * rs;
        if (ridge > 0) r *= 1 + ridgeAmp * Math.cos(ridge * a);
        if (bump > 0) r *= 1 + bump * (Noise.fbmu(a / TAU * 8, t * 9, 8, seed, 3) - 0.5) * 2.4;
        return r;
    }
    function yAt(t) {
        var y = (t - 0.5) * height;
        if (dip > 0) { var x = clamp((t - dipFrom) / (1 - dipFrom), 0, 1); y -= dip * x * x * x; }
        return y;
    }
    return {
        radius: radius,
        yAt: yAt,
        height: height,
        pos: function (t, a, out) {
            var r = radius(t, a);
            out[0] = r * Math.cos(a); out[1] = yAt(t); out[2] = r * Math.sin(a);
            return out;
        }
    };
}

// N段 × M分割。継ぎ目のため列は M+1（u=0 と u=1 の頂点を別に持つ）
function buildMesh(shape, N, M) {
    var cols = M + 1, cnt = N * cols;
    var P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), UV = new Float32Array(cnt * 2);
    var tmpA = [0, 0, 0], tmpB = [0, 0, 0], tmpC = [0, 0, 0];
    var dt = 0.5 / N, da = 0.5 / M;
    for (var i = 0; i < N; i++) {
        var t = i / (N - 1);
        for (var j = 0; j < cols; j++) {
            var u = j / M, a = u * TAU, k = i * cols + j;
            shape.pos(t, a, tmpA);
            P[k * 3] = tmpA[0]; P[k * 3 + 1] = tmpA[1]; P[k * 3 + 2] = tmpA[2];
            UV[k * 2] = u; UV[k * 2 + 1] = t;
            // 法線は数値微分。周方向と軸方向の接ベクトルの外積
            shape.pos(clamp(t + dt, 0, 1), a, tmpB);
            shape.pos(clamp(t - dt, 0, 1), a, tmpC);
            var ax = tmpB[0] - tmpC[0], ay = tmpB[1] - tmpC[1], az = tmpB[2] - tmpC[2];
            shape.pos(t, a + da, tmpB); shape.pos(t, a - da, tmpC);
            var bx = tmpB[0] - tmpC[0], by = tmpB[1] - tmpC[1], bz = tmpB[2] - tmpC[2];
            var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            var L = Math.hypot(nx, ny, nz) || 1;
            Nn[k * 3] = nx / L; Nn[k * 3 + 1] = ny / L; Nn[k * 3 + 2] = nz / L;
        }
    }
    return { N: N, M: M, cols: cols, P: P, Nn: Nn, UV: UV, count: cnt };
}

// 回転体ではない部品（葉・がく片など）用。fn(s, w, out) が座標を返す
// (NS+1)×(MW+1) の格子。法線は回転体と同じく数値微分で出す。
// 一周してつながらないので、描くときは cull:false（両面）で使う。
function buildGrid(NS, MW, fn) {
    var cols = MW + 1, cnt = (NS + 1) * cols;
    var P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), UV = new Float32Array(cnt * 2);
    var A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0], D = [0, 0, 0], E = [0, 0, 0];
    var ds = 0.5 / NS, dw = 0.5 / MW;
    for (var i = 0; i <= NS; i++) {
        var s = i / NS;
        for (var j = 0; j < cols; j++) {
            var w = j / MW, k = i * cols + j;
            fn(s, w, A);
            P[k * 3] = A[0]; P[k * 3 + 1] = A[1]; P[k * 3 + 2] = A[2];
            UV[k * 2] = w; UV[k * 2 + 1] = s;
            fn(clamp(s + ds, 0, 1), w, B); fn(clamp(s - ds, 0, 1), w, C);
            fn(s, clamp(w + dw, 0, 1), D); fn(s, clamp(w - dw, 0, 1), E);
            var ax = B[0] - C[0], ay = B[1] - C[1], az = B[2] - C[2];
            var bx = D[0] - E[0], by = D[1] - E[1], bz = D[2] - E[2];
            var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            var L = Math.hypot(nx, ny, nz) || 1;
            Nn[k * 3] = nx / L; Nn[k * 3 + 1] = ny / L; Nn[k * 3 + 2] = nz / L;
        }
    }
    return { N: NS + 1, M: MW, cols: cols, P: P, Nn: Nn, UV: UV, count: cnt };
}

// 部品を上下にずらす（法線は変わらない）
function shiftY(mesh, dy) {
    for (var k = 0; k < mesh.count; k++) mesh.P[k * 3 + 1] += dy;
    return mesh;
}

/* --------------------------------------------------------------
   4. ミニレンダラ（画家のアルゴリズム）
   -------------------------------------------------------------- */
var CAM = { dist: 3.5, f: 1.65 };

function srgbToLin(c) { return c * c; }
function tone(x) { return Math.pow(clamp(x / (1 + x) * 1.45, 0, 1), 0.4545); }

// exCap＝この面が拾えるハイライトの「細さの上限」。renderMesh が面ごとに渡す。
function shadePixel(nx, ny, nz, px, py, pz, alb, m, L, exCap) {
    // 視線
    var vx = -px, vy = -py, vz = -CAM.dist - pz;
    var vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
    var ndl = nx * L[0] + ny * L[1] + nz * L[2]; if (ndl < 0) ndl = 0;
    var ndv = nx * vx + ny * vy + nz * vz; if (ndv < 0) ndv = 0;
    // 補助光（反対側から弱く）
    var f = -nx * L[0] * 0.8 + ny * 0.35 - nz * L[2] * 0.8; if (f < 0) f = 0;
    // ハーフベクトル
    var hx = L[0] + vx, hy = L[1] + vy, hz = L[2] + vz;
    var hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
    var ndh = nx * hx + ny * hy + nz * hz; if (ndh < 0) ndh = 0;

    var rough = m.rough;
    var ex = mix(5, 800, (1 - rough) * (1 - rough));
    // 陰影は面の中心1点でしか測っていない。だから面1枚より細いハイライトは
    // どのサンプル点にも当たらず、指定した艶がまるごと消える（＝素焼きに見える）。
    // 面の中で法線が振れる幅から上限を決め、それより鋭い指定はそこまで広げる。
    // 広げたぶんは明るさを落とす。そのままだと面いっぱいが真っ白に潰れて、
    // ハイライトではなく「白いシール」に見える。
    // 完全に「広げたぶんだけ暗く」すると艶が消えてしまうので、
    // 0.35乗ぶんだけ戻す（暗すぎず、白く潰れもしない落としどころ）。
    var amp = 0.05 + 0.85 * (1 - rough);
    if (exCap && exCap < ex) { amp *= Math.pow(exCap / ex, 0.35); ex = exCap; }
    var spec = Math.pow(ndh, ex) * amp;
    var cex = exCap ? Math.min(1600, exCap) : 1600;
    var coat = m.coat > 0 ? Math.pow(ndh, cex) * m.coat * 2.2 * Math.pow(cex / 1600, 0.6) : 0;
    var fres = Math.pow(1 - ndv, 4.2);
    var sheen = m.sheen > 0 ? fres * m.sheen * 0.75 : 0;
    var sss = m.sss > 0 ? Math.pow(1 - ndv, 2.1) * m.sss * (0.35 + 0.65 * Math.max(0, -(nx * L[0] + nz * L[2]))) : 0;
    // ambK / expo / tonemap は 11章（シーン）の実験でだけ動かす。
    // 指定が無ければ従来どおりの値になるので、他の実験の見た目は変わらない。
    var ambK = m.ambK == null ? 1 : m.ambK;
    var expo = m.expo == null ? 1 : m.expo;
    var tm = m.tonemap !== false;
    var amb = (0.12 + 0.21 * (ny * 0.5 + 0.5)) * ambK;
    var key = ndl * 1.02 + f * 0.20;

    var sc = m.sssCol || [1, 0.55, 0.4];
    var shc = m.sheenCol || [0.82, 0.86, 0.66];
    var r = (srgbToLin(alb[0]) * (amb + key) + spec + coat + sss * sc[0] * 0.7 + sheen * shc[0]) * expo;
    var g = (srgbToLin(alb[1]) * (amb + key) + spec + coat + sss * sc[1] * 0.7 + sheen * shc[1]) * expo;
    var b = (srgbToLin(alb[2]) * (amb + key) + spec + coat + sss * sc[2] * 0.7 + sheen * shc[2]) * expo;
    return "rgb(" + (encode(r, tm) * 255 | 0) + "," + (encode(g, tm) * 255 | 0) + "," + (encode(b, tm) * 255 | 0) + ")";
}

// トーンマッピングあり＝明るいところを圧縮してから画面用に変換。
// なし＝1を超えた分をそのまま切り捨てるので、ハイライトが真っ白に潰れる。
function encode(x, tm) {
    return tm ? tone(x) : Math.pow(clamp(x, 0, 1), 0.4545);
}

var faceBuf = [];

function renderMesh(ctx, W, H, mesh, o) {
    var rot = o.rot || 0, mode = o.mode || "solid";
    var smoothN = o.smooth !== false, flip = !!o.flip, cull = o.cull !== false;
    var mat = o.mat || { rough: 0.4, coat: 0.2, sss: 0.1, sheen: 0 };
    var alb = o.albedo || function () { return [0.8, 0.25, 0.2]; };
    var L = o.light || [-0.42, 0.72, -0.55];
    var Ll = Math.hypot(L[0], L[1], L[2]); L = [L[0] / Ll, L[1] / Ll, L[2] / Ll];

    var S = Math.min(W, H), cx = W / 2, cy = H / 2 + (o.yShift || 0);
    var cs = Math.cos(rot), sn = Math.sin(rot);
    // 見下ろし角。0なら真横から。Y軸で回したあと、X軸まわりに倒す
    var elev = o.elev || 0, ce = Math.cos(elev), se = Math.sin(elev);
    var P = mesh.P, Nn = mesh.Nn, UV = mesh.UV, cols = mesh.cols, N = mesh.N, M = mesh.M;
    var cnt = mesh.count;

    var vx = new Float32Array(cnt * 3), vn = new Float32Array(cnt * 3);
    var sx = new Float32Array(cnt), sy = new Float32Array(cnt);
    for (var k = 0; k < cnt; k++) {
        var x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        var rx = x * cs + z * sn, qz = -x * sn + z * cs;
        var ry = y * ce + qz * se, rz = -y * se + qz * ce;
        vx[k * 3] = rx; vx[k * 3 + 1] = ry; vx[k * 3 + 2] = rz;
        var a = Nn[k * 3], b = Nn[k * 3 + 1], c = Nn[k * 3 + 2];
        var qn = -a * sn + c * cs;
        vn[k * 3] = a * cs + c * sn; vn[k * 3 + 1] = b * ce + qn * se; vn[k * 3 + 2] = -b * se + qn * ce;
        var d = rz + CAM.dist, sc2 = CAM.f * S / Math.max(0.4, d);
        sx[k] = cx + rx * sc2; sy[k] = cy - ry * sc2;
    }

    faceBuf.length = 0;
    for (var i = 0; i < N - 1; i++) {
        for (var j = 0; j < M; j++) {
            var iA = i * cols + j, iB = iA + 1, iC = iA + cols, iD = iC + 1;
            var order = flip ? [iA, iB, iD, iC] : [iA, iC, iD, iB];
            var ax = sx[order[0]], ay = sy[order[0]];
            var bx = sx[order[1]], by = sy[order[1]];
            var cx2 = sx[order[2]], cy2 = sy[order[2]];
            // スクリーン座標は y が下向きなので、正の面積が表向きになる
            var area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
            var back = area < 0;
            if (cull && back && mode !== "facing") continue;

            var z0 = (vx[iA * 3 + 2] + vx[iB * 3 + 2] + vx[iC * 3 + 2] + vx[iD * 3 + 2]) * 0.25;
            var pts = [
                sx[order[0]], sy[order[0]], sx[order[1]], sy[order[1]],
                sx[order[2]], sy[order[2]], sx[order[3]], sy[order[3]]
            ];
            var col;
            if (mode === "wire") {
                col = null;
            } else if (mode === "facing") {
                col = back ? "#DA130E" : "#528530";
            } else {
                var nx, ny, nz;
                if (smoothN) {
                    nx = (vn[iA * 3] + vn[iB * 3] + vn[iC * 3] + vn[iD * 3]) * 0.25;
                    ny = (vn[iA * 3 + 1] + vn[iB * 3 + 1] + vn[iC * 3 + 1] + vn[iD * 3 + 1]) * 0.25;
                    nz = (vn[iA * 3 + 2] + vn[iB * 3 + 2] + vn[iC * 3 + 2] + vn[iD * 3 + 2]) * 0.25;
                } else {
                    var ux = vx[iC * 3] - vx[iA * 3], uy = vx[iC * 3 + 1] - vx[iA * 3 + 1], uz = vx[iC * 3 + 2] - vx[iA * 3 + 2];
                    var wx = vx[iB * 3] - vx[iA * 3], wy = vx[iB * 3 + 1] - vx[iA * 3 + 1], wz = vx[iB * 3 + 2] - vx[iA * 3 + 2];
                    nx = uy * wz - uz * wy; ny = uz * wx - ux * wz; nz = ux * wy - uy * wx;
                }
                var nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
                if (back) { nx = -nx; ny = -ny; nz = -nz; }
                if (mode === "normal") {
                    col = "rgb(" + ((nx * 0.5 + 0.5) * 255 | 0) + "," + ((ny * 0.5 + 0.5) * 255 | 0) + "," + ((nz * 0.5 + 0.5) * 255 | 0) + ")";
                } else {
                    var u0 = (UV[iA * 2] + UV[iD * 2]) * 0.5, v0 = (UV[iA * 2 + 1] + UV[iD * 2 + 1]) * 0.5;
                    var c3 = alb(u0, v0);
                    var mx = (vx[iA * 3] + vx[iD * 3]) * 0.5;
                    var my = (vx[iA * 3 + 1] + vx[iD * 3 + 1]) * 0.5;
                    var mz = (vx[iA * 3 + 2] + vx[iD * 3 + 2]) * 0.5;
                    // 対角の2頂点で法線がどれだけ開いているか（≒この面の曲がり具合）。
                    // 1-cosθ ≒ θ²/2 なので、ここからハイライトの細さの上限が出る
                    var dnd = 1 - (vn[iA * 3] * vn[iD * 3] + vn[iA * 3 + 1] * vn[iD * 3 + 1] + vn[iA * 3 + 2] * vn[iD * 3 + 2]);
                    col = shadePixel(nx, ny, nz, mx, my, mz, c3, mat, L, dnd > 1e-6 ? 0.963 / dnd : 0);
                }
            }
            faceBuf.push({ z: z0, p: pts, c: col });
        }
    }
    faceBuf.sort(function (a, b) { return b.z - a.z; });

    if (mode === "wire") {
        ctx.strokeStyle = "rgba(26,35,28,.55)"; ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (var q = 0; q < faceBuf.length; q++) {
            var p = faceBuf[q].p;
            ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]); ctx.closePath();
        }
        ctx.stroke();
    } else {
        for (var q2 = 0; q2 < faceBuf.length; q2++) {
            var fq = faceBuf[q2], pp = fq.p;
            ctx.fillStyle = fq.c;
            ctx.strokeStyle = fq.c;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(pp[0], pp[1]); ctx.lineTo(pp[2], pp[3]); ctx.lineTo(pp[4], pp[5]); ctx.lineTo(pp[6], pp[7]);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    }
    return { sx: sx, sy: sy, cols: cols, N: N, M: M };
}

/* --------------------------------------------------------------
   5. キャンバスの下ごしらえ（高DPI対応 + 画面内でだけ描く）
   -------------------------------------------------------------- */
function setupCanvas(cv) {
    var ctx = cv.getContext("2d");
    var w = parseInt(cv.getAttribute("width"), 10);
    var h = parseInt(cv.getAttribute("height"), 10);
    function fit() {
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var cw = cv.clientWidth || w;
        var scale = cw / w;
        cv.width = Math.round(w * scale * dpr);
        cv.height = Math.round(h * scale * dpr);
        cv.style.height = Math.round(h * scale) + "px";
        ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    }
    fit();
    window.addEventListener("resize", fit);
    return { ctx: ctx, W: w, H: h, fit: fit };
}

var loops = [];
function addLoop(cv, fn) {
    var o = { cv: cv, fn: fn, on: true };
    loops.push(o);
    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { o.on = es[0].isIntersecting; }, { rootMargin: "120px" });
        io.observe(cv);
    }
    return o;
}
// canvas は width/height を入れ直すと中身が消える。setupCanvas の fit() が
// まさにそれをやるので、毎フレーム描き直していない実験は
// リサイズのあとに自分で描き直さないと白紙のまま残る。
// 連続して飛んでくるリサイズは1フレームにまとめる。
function onResize(fn) {
    var queued = false;
    window.addEventListener("resize", function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; fn(); });
    });
}

var lastT = 0, lastRun = 0;
function spin(now, k) { return reduce ? 0.7 : now * k; }
function tick(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
    // 動きを減らす設定のときは回転を止め、描き直しも間引く
    if (reduce && now - lastRun < 70) { requestAnimationFrame(tick); return; }
    lastRun = now;
    for (var i = 0; i < loops.length; i++) if (loops[i].on) loops[i].fn(dt, now / 1000);
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* --------------------------------------------------------------
   6. 共通プロファイルのプリセット（t は下から上）
   -------------------------------------------------------------- */
// 断面（t は下から上、r は半径）。
// r と PROFILE_H（高さ）は同じ単位なので、この2つで実物の縦横比が決まる。
// 例：トマトは rmax 0.742 → 直径 1.48 に対して高さ 1.25。実物どおり「背より横幅が広い」。
// 両端は r をほぼ 0 まで絞って閉じる。0.2 などで止めると、そこが穴になって
// 上から見たときに背景が透けて見える（回転体にはフタが無いため）。
var PROFILES = {
    carrot: [{ t: 0, r: 0.02 }, { t: 0.18, r: 0.14 }, { t: 0.45, r: 0.26 }, { t: 0.75, r: 0.38 }, { t: 0.95, r: 0.45 }, { t: 1, r: 0.44 }],
    tomato: [{ t: 0, r: 0.02 }, { t: 0.06, r: 0.32 }, { t: 0.16, r: 0.545 }, { t: 0.30, r: 0.675 }, { t: 0.46, r: 0.742 }, { t: 0.61, r: 0.740 }, { t: 0.75, r: 0.680 }, { t: 0.86, r: 0.560 }, { t: 0.94, r: 0.390 }, { t: 0.975, r: 0.195 }, { t: 1, r: 0.02 }],
    // ナス（中長）。t=0 が尻（花落ち）、t=1 がヘタ側。最大径は尻寄りの t≒0.30。
    // 【対策】最大径から上を「しばらく平行 → 上で急に締まる」にすると、
    //         ナスではなく花瓶になる。実物は最大径から t=1 まで一度も
    //         平行にならず、ずっと連続して細り続ける（涙型）。
    //         ヘタの付け根でも最大径の 2割ほどは残っていて、尖らない。
    nasu: [{ t: 0, r: 0.02 }, { t: 0.035, r: 0.198 }, { t: 0.09, r: 0.274 }, { t: 0.18, r: 0.312 },
    { t: 0.30, r: 0.330 }, { t: 0.44, r: 0.317 }, { t: 0.58, r: 0.279 }, { t: 0.71, r: 0.221 },
    { t: 0.84, r: 0.157 }, { t: 1, r: 0.066 }],
    // シイタケ（どんこ）。柄（〜t=0.545）→ ひだの天井がほぼ水平に開く →
    // 縁（t=0.635 が最大径）→ 縁の厚み → 浅いドーム → 頂点で閉じる。
    // シイタケ.js の PROFILE_THICK に合わせて、傘の半径 R を基準に
    // 柄の長さ 0.76R・柄の太さ 0.30R・ドームの高さ 0.43R とした。
    //
    // 【注意】本家の傘は [u, r, y] の3列で、最大径のあと縁が「下へ」落ちてから
    //         内側へ巻き込む。この実験のプロファイルは t→r の1列しか持てず、
    //         同じ高さに r を2つ置けないので、縁の折り返しだけは再現できない
    //         （04章の本文で言っている「(r, y) の2列テーブルが要る形」がこれ）。
    //         代わりにひだの天井をできるだけ水平に寝かせて、
    //         ロート型ではなく「平らな裏 + 浅い傘」に見えるようにしてある。
    shiitake: [{ t: 0, r: 0.245 }, { t: 0.290, r: 0.234 }, { t: 0.480, r: 0.262 }, { t: 0.550, r: 0.350 },
    { t: 0.595, r: 0.660 }, { t: 0.645, r: 0.820 }, { t: 0.700, r: 0.808 }, { t: 0.800, r: 0.752 },
    { t: 0.895, r: 0.630 }, { t: 0.955, r: 0.420 }, { t: 0.988, r: 0.230 }, { t: 1, r: 0.02 }],

    // --- ここから下は 06章（模様）で使う。編集はしないので点数は多めでよい ---

    // スイカ（大玉）。スイカ.js は超楕円（指数 2.16）× elong 1.062 の回転体。
    // 【対策】スイカ.js のコメントのとおり「上下対称の回転体はどれだけ表面を
    //         作り込んでもボールに見える」。下半分を 3.5% 細めた卵形にしてある。
    suika: [{ t: 0, r: 0.02 }, { t: 0.030, r: 0.265 }, { t: 0.090, r: 0.418 }, { t: 0.180, r: 0.570 },
    { t: 0.310, r: 0.665 }, { t: 0.487, r: 0.720 }, { t: 0.660, r: 0.686 }, { t: 0.800, r: 0.588 },
    { t: 0.900, r: 0.448 }, { t: 0.965, r: 0.270 }, { t: 1, r: 0.02 }],

    // きゅうり。キュウリ.js の PROFILE を、こちらの向き（t=1 がヘタ側）に直したもの。
    // 【対策】胴のほとんどが平行。中央を膨らませるとズッキーニになる。
    kyuri: [{ t: 0, r: 0.012 }, { t: 0.028, r: 0.144 }, { t: 0.075, r: 0.176 }, { t: 0.170, r: 0.191 },
    { t: 0.320, r: 0.196 }, { t: 0.500, r: 0.198 }, { t: 0.700, r: 0.195 }, { t: 0.850, r: 0.183 },
    { t: 0.930, r: 0.155 }, { t: 0.975, r: 0.090 }, { t: 1, r: 0.020 }],

    // 玉ねぎ。玉ねぎ.js の MERIDIAN そのまま（t=0 が根盤、t=1 が首）。
    // 最大径は中央ではなく全高の 35〜41%。下端は尖らせず r=0.07 で平らに切る（根盤）。
    tamanegi: [{ t: 0, r: 0.072 }, { t: 0.030, r: 0.300 }, { t: 0.090, r: 0.454 }, { t: 0.170, r: 0.539 },
    { t: 0.280, r: 0.590 }, { t: 0.400, r: 0.600 }, { t: 0.540, r: 0.578 }, { t: 0.680, r: 0.509 },
    { t: 0.810, r: 0.392 }, { t: 0.910, r: 0.251 }, { t: 0.970, r: 0.130 }, { t: 1, r: 0.023 }],

    // メロン。メロン.js は超楕円（指数 2.10）× elong 1.055。
    // スイカと違って卵形の細りが無く、上下対称に近い。
    melon: [{ t: 0, r: 0.02 }, { t: 0.032, r: 0.272 }, { t: 0.095, r: 0.428 }, { t: 0.190, r: 0.559 },
    { t: 0.320, r: 0.653 }, { t: 0.493, r: 0.700 }, { t: 0.665, r: 0.664 }, { t: 0.800, r: 0.577 },
    { t: 0.900, r: 0.446 }, { t: 0.965, r: 0.262 }, { t: 1, r: 0.02 }]
};
// それぞれの「高さ」。これを共通の1.7にしていると、
// トマトが縦長の卵に、シイタケが玉ねぎになる。
// 例：ナスは rmax 0.33 → 直径 0.66 に対して高さ 1.65。
// ナス.js の中長なす（length 13.6cm / radius 2.72cm）と同じ 2.5 : 1。
// シイタケは 1.14。傘の直径 1.64 に対して背が 0.70 で、実物の
// 「傘 5cm・全高 3.4cm」とほぼ同じ。1.55 のままだと背が高すぎて、
// シイタケではなく林に生えるパラソル茸になる。
// 06章ぶんも、それぞれ実物の縦横比で入れておく。
//   スイカ 1.54 / 1.44 = 1.07（本家 elong 1.062）
//   きゅうり 1.80 / 0.396 = 4.5（キュウリ.js の短い品種 length 12.0 / radius 1.32）
//   玉ねぎ 1.13 / 1.20 = 0.94（玉ねぎ.js の height 6.95 / radius 3.70）
//   メロン 1.48 / 1.40 = 1.06（本家 elong 1.055）
var PROFILE_H = {
    carrot: 1.9, tomato: 1.25, nasu: 1.65, shiitake: 1.14,
    suika: 1.54, kyuri: 1.80, tamanegi: 1.13, melon: 1.48
};
function cloneProfile(p) { return p.map(function (o) { return { t: o.t, r: o.r }; }); }

var MATS = {
    nasu: { rough: 0.24, coat: 0.45, sss: 0.10, sheen: 0, col: [0.16, 0.06, 0.24], sssCol: [0.7, 0.3, 0.9] },
    okra: { rough: 0.62, coat: 0.05, sss: 0.18, sheen: 0.55, col: [0.32, 0.52, 0.19], sheenCol: [0.72, 0.80, 0.55], sssCol: [0.5, 0.8, 0.3] },
    imo: { rough: 0.82, coat: 0.0, sss: 0.04, sheen: 0.10, col: [0.55, 0.22, 0.24], sssCol: [0.9, 0.5, 0.4] },
    corn: { rough: 0.30, coat: 0.35, sss: 0.55, sheen: 0, col: [0.92, 0.74, 0.24], sssCol: [1.0, 0.75, 0.25] },
    tomato: { rough: 0.19, coat: 0.40, sss: 0.30, sheen: 0, col: [0.855, 0.075, 0.055], sssCol: [1.0, 0.25, 0.15] }
};

/* ======================================================================
   HERO — 点からトマトが組み上がる
   ====================================================================== */
(function () {
    var cv = $("#heroCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var ctrl = cloneProfile(PROFILES.tomato);
    // 肩のくぼみ。沈むぶんだけ高さを足しておくと、完成形が
    // 直径 1.48 × 高さ 1.17 ＝実物どおり「背より横幅が広い」比率に収まる。
    var DIP = 0.26, DIP_FROM = 0.78;
    var HH = PROFILE_H.tomato + 0.18;       // 高さ。点・曲線・軸の下描きでも同じ値を使う
    var ELEV = 0.28;                        // 少し見下ろす。真横からだと肩もヘタも見えない
    var shape = makeShape(ctrl, {
        bump: 0.020, ridge: 6, ridgeAmp: 0.022, seed: 3,
        height: HH, dip: DIP, dipFrom: DIP_FROM
    });
    // 分割数はハイライトの細さの上限も決めている（renderMesh の exCap）。
    // 粗いままだと、いくら「つるつる」と指定しても艶が面と面の間に落ちて消える。
    var mesh = buildMesh(shape, 52, 80);
    var stageNames = [
        "① 横顔（プロファイル）を決める",
        "② 高さごとにリングを並べる",
        "③ 頂点を三角形でつなぐ",
        "④ 面の向きから明るさを出す",
        "⑤ 模様を計算で描いて貼る",
        "⑥ ヘタを付け、光り方を決めて完成"
    ];
    var stageEl = $("#heroStage"), countEl = $("#heroCount");
    var t0 = 0, started = false, stage = -1;    // -1 から始めないと ① の見出しが出ない
    var DUR = [1.5, 1.5, 1.6, 1.6, 1.6, 4.2];

    /* --- ヘタ（がく片＋軸）。09章「部品を作って組み合わせる」の先取り --- */
    var SEPALS = 6;
    // がく片の背骨。くぼみの底から肩の縁までは果実の面をなぞり、
    // 先だけ面を離れて外へ反り返る。果実の形から取っているので、
    // プロファイルをいじってもヘタが浮いたり埋まったりしない。
    function sepalSpine(s, a, out) {
        var hug = Math.min(1, s / 0.72);
        shape.pos(mix(0.995, 0.925, hug), a, out);
        out[1] += 0.016;                                  // 面から少し浮かせる
        if (s > 0.72) {
            var e = (s - 0.72) / 0.28;
            var rr = Math.hypot(out[0], out[2]) || 1e-6;
            out[0] += out[0] / rr * 0.085 * e;
            out[2] += out[2] / rr * 0.085 * e;
            out[1] += 0.075 * e * e;
        }
    }
    function makeSepal(a0) {
        return buildGrid(14, 6, function (s, w, out) {
            var q = w * 2 - 1;                            // 幅方向 -1（縁）〜 +1（縁）
            var a = a0 + 0.10 * s * s;                    // ほんの少しねじる
            sepalSpine(s, a, out);
            // 笹の葉の輪郭。根元は細く、1/3 あたりで最大、先は尖る
            var hw = 0.10 * Math.pow(s + 0.12, 0.35) * Math.pow(1.002 - s, 0.55) + 0.004;
            out[0] += -Math.sin(a) * hw * q;
            out[2] += Math.cos(a) * hw * q;
            out[1] += 0.028 * (1 - q * q) * (1 - s * 0.5);   // 中肋のふくらみ
        });
    }
    var sepals = [];
    for (var si = 0; si < SEPALS; si++) {
        // 稜（ridge=6 のふくらみ）の谷にがく片を置く
        var sa = Math.PI / SEPALS + si * TAU / SEPALS;
        sepals.push({ a: sa, mesh: makeSepal(sa) });
    }
    // 中央の軸。くぼみの底から短く立てる
    var stem = shiftY(buildMesh(makeShape(
        [{ t: 0, r: 0.075 }, { t: 0.30, r: 0.050 }, { t: 0.72, r: 0.047 }, { t: 1, r: 0.032 }],
        { height: 0.13 }), 8, 16), shape.yAt(1) + 0.048);
    var CALYX = {
        rough: 0.44, coat: 0.10, sss: 0.22, sheen: 0.18,
        sssCol: [0.55, 0.85, 0.32], sheenCol: [0.78, 0.86, 0.58]
    };
    function calyxAlb(u, v) {
        var q = Math.abs(u * 2 - 1);                      // 0=中肋 1=縁
        var midrib = 1 - smooth(0.05, 0.55, q);
        var root = 1 - smooth(0.0, 0.30, v);              // 根元は黄緑
        return [
            clamp(mix(0.16, 0.27, midrib) + 0.12 * root, 0, 1),
            clamp(mix(0.35, 0.50, midrib) + 0.12 * root, 0, 1),
            clamp(mix(0.09, 0.16, midrib), 0, 1)
        ];
    }
    function stemAlb(u, v) { return [mix(0.30, 0.20, v), mix(0.42, 0.36, v), mix(0.16, 0.11, v)]; }

    function albedoCalc(u, v) {
        var base = MATS.tomato.col;
        // 稜の谷だけほんの少し暗い。強くすると縞模様になる
        var groove = 0.5 - 0.5 * Math.cos(u * TAU * 6);
        // ノイズは分割数（M=88）の半分＝44周期より粗いものだけにする。
        // それより細かい模様は面の中心1点では標本化できず、モザイクになる。
        // 逆に粗すぎる（6周期など）と、今度は横縞に見えてしまう。
        var n = Noise.fbmu(u * 15, v * 17, 15, 5, 3) - 0.5;
        var r = base[0] * (1 + 0.05 * n) - 0.05 * groove;
        var g = base[1] + 0.03 * n + 0.02 * groove;
        var b = base[2] + 0.02 * n;
        // 花落ち（下端）はわずかに淡い
        var bot = smooth(0.10, 0.0, v);
        r = mix(r, 0.93, bot * 0.18); g = mix(g, 0.30, bot * 0.18); b = mix(b, 0.22, bot * 0.18);
        // 黄緑はヘタのすぐ周りだけ。ここを広げると柿やモモの色になる
        var sh = smooth(0.91, 1.0, v);
        r = mix(r, 0.74, sh * 0.55); g = mix(g, 0.60, sh * 0.75); b = mix(b, 0.24, sh * 0.6);
        return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
    }
    // 模様は毎フレーム計算しない。06章と同じで、一度だけ焼いて表から引く。
    // 3オクターブの fBm を毎フレーム面の数だけ呼ぶと、それだけで描画時間の
    // 半分近くを食う。返す配列も使い回して、1面ごとの確保をやめる。
    var AW = 128, AH = 96, albTable = new Float32Array(AW * AH * 3);
    for (var aj = 0; aj < AH; aj++) {
        for (var ai = 0; ai < AW; ai++) {
            var ac = albedoCalc(ai / AW, aj / (AH - 1)), ak = (aj * AW + ai) * 3;
            albTable[ak] = ac[0]; albTable[ak + 1] = ac[1]; albTable[ak + 2] = ac[2];
        }
    }
    var albOut = [0, 0, 0];
    function albedo(u, v) {
        var i = (u * AW) | 0; if (i < 0) i = 0; else if (i >= AW) i = AW - 1;
        var j = (v * (AH - 1) + 0.5) | 0; if (j < 0) j = 0; else if (j >= AH) j = AH - 1;
        var k = (j * AW + i) * 3;
        albOut[0] = albTable[k]; albOut[1] = albTable[k + 1]; albOut[2] = albTable[k + 2];
        return albOut;
    }
    var WHITE = [0.86, 0.86, 0.84];
    function white() { return WHITE; }

    function drawCalyx(rot) {
        // 面の並べ替えは renderMesh 1回ぶんの中でしか効かないので、
        // 部品そのものを遠い順に描く（rc·sin(a-rot) が大きいほど奥）
        var parts = [{ z: 0, m: stem, alb: stemAlb }];
        for (var i = 0; i < sepals.length; i++) {
            parts.push({ z: 0.45 * Math.sin(sepals[i].a - rot), m: sepals[i].mesh, alb: calyxAlb });
        }
        parts.sort(function (a, b) { return b.z - a.z; });
        for (var k = 0; k < parts.length; k++) {
            renderMesh(ctx, c.W, c.H, parts[k].m, {
                rot: rot, elev: ELEV, cull: false, albedo: parts[k].alb, mat: CALYX
            });
        }
    }

    // renderMesh と同じカメラ（Y回転 → 見下ろし → 透視）。
    // 下描きだけ別の計算にすると、①②と③以降で形が食い違う。
    var pr = [0, 0, 0];
    function proj(x, y, z, rot) {
        var cs = Math.cos(rot), sn = Math.sin(rot), ce = Math.cos(ELEV), se = Math.sin(ELEV);
        var rx = x * cs + z * sn, qz = -x * sn + z * cs;
        var ry = y * ce + qz * se, rz = -y * se + qz * ce;
        var S = Math.min(c.W, c.H), sc = CAM.f * S / Math.max(0.4, rz + CAM.dist);
        pr[0] = c.W / 2 + rx * sc; pr[1] = c.H / 2 - ry * sc;
        return pr;
    }

    function restart() { t0 = performance.now() / 1000; started = true; stage = -1; }
    restart();
    if (reduce) { started = true; }

    var btn = $("#heroReplay");
    if (btn) btn.addEventListener("click", restart);

    function drawDots(rot) {
        ctx.fillStyle = "#1A231C";
        for (var i = 0; i < ctrl.length; i++) {
            var y = shape.yAt(ctrl[i].t), r = ctrl[i].r;
            for (var s = -1; s <= 1; s += 2) {
                var p = proj(r * s, y, 0, rot);
                ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, TAU); ctx.fill();
            }
        }
        // 曲線
        ctx.strokeStyle = "rgba(218,19,14,.75)"; ctx.lineWidth = 1.6;
        for (var s2 = -1; s2 <= 1; s2 += 2) {
            ctx.beginPath();
            for (var k = 0; k <= 80; k++) {
                var tt = k / 80, rr = sampleProfile(ctrl, tt) * s2;
                var q = proj(rr, shape.yAt(tt), 0, rot);
                if (k === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
            }
            ctx.stroke();
        }
        var a1 = proj(0, shape.yAt(0) - 0.06, 0, rot), ax1 = a1[0], ay1 = a1[1];
        var a2 = proj(0, shape.yAt(1) + 0.22, 0, rot);
        ctx.strokeStyle = "rgba(26,35,28,.3)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawRings(rot) {
        ctx.strokeStyle = "rgba(26,35,28,.5)"; ctx.lineWidth = 1;
        for (var i = 0; i < mesh.N; i += 3) {
            ctx.beginPath();
            for (var j = 0; j <= mesh.M; j++) {
                var k = i * mesh.cols + j;
                var p = proj(mesh.P[k * 3], mesh.P[k * 3 + 1], mesh.P[k * 3 + 2], rot);
                if (j === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
            }
            ctx.stroke();
        }
    }

    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        var el = reduce ? 99 : (performance.now() / 1000 - t0);
        var acc = 0, st = 5;
        for (var i = 0; i < DUR.length; i++) { acc += DUR[i]; if (el < acc) { st = i; break; } }
        if (el >= acc) { st = 5; }
        var rot = spin(now, 0.32);
        if (st !== stage) { stage = st; if (stageEl) stageEl.textContent = stageNames[st]; }
        if (countEl) countEl.textContent = (st === 0 ? ctrl.length * 2 + " 個の制御点"
            : mesh.count.toLocaleString() + " 頂点 / " + ((mesh.N - 1) * mesh.M * 2).toLocaleString() + " 三角形");

        if (st === 0) { drawDots(rot); return; }
        if (st === 1) { drawRings(rot); return; }
        if (st === 2) { renderMesh(ctx, c.W, c.H, mesh, { rot: rot, elev: ELEV, mode: "wire" }); return; }
        if (st === 3) {
            renderMesh(ctx, c.W, c.H, mesh, { rot: rot, elev: ELEV, albedo: white, mat: { rough: 0.85, coat: 0, sss: 0, sheen: 0 } });
            return;
        }
        if (st === 4) {
            renderMesh(ctx, c.W, c.H, mesh, { rot: rot, elev: ELEV, albedo: albedo, mat: { rough: 0.9, coat: 0, sss: 0, sheen: 0 } });
            return;
        }
        renderMesh(ctx, c.W, c.H, mesh, { rot: rot, elev: ELEV, albedo: albedo, mat: MATS.tomato });
        drawCalyx(rot);
    });
})();

/* ======================================================================
   02 — シード
   ====================================================================== */
(function () {
    var cv = $("#seedCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var input = $("#seedInput"), out = $("#seedNumbers");

    function drawOne(x, w, h, seed) {
        var rng = new Rng(seed);
        var len = rng.gauss(1.0, 0.12), fat = rng.gauss(1.0, 0.16);
        var bend = rng.gauss(0, 0.10), taper = rng.range(0.8, 1.4);
        var ctrl = cloneProfile(PROFILES.carrot);
        for (var i = 0; i < ctrl.length; i++) ctrl[i].r *= fat * Math.pow(ctrl[i].t + 0.05, taper * 0.18);
        var H = h * 0.78 * len, base = h * 0.90;
        ctx.beginPath();
        for (var s = 0; s < 2; s++) {
            var dir = s === 0 ? 1 : -1;
            for (var k = 0; k <= 40; k++) {
                var t = s === 0 ? k / 40 : 1 - k / 40;
                var r = sampleProfile(ctrl, t) * w * 0.95
                    * (1 + 0.05 * (Noise.v2(t * 7, seed % 97, seed) - 0.5) * 2);
                var px = x + dir * r + bend * Math.sin(t * 2.2) * w * 0.7;
                var py = base - t * H;
                if (s === 0 && k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        var g = ctx.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, "#B84E13"); g.addColorStop(0.42, "#E2691C"); g.addColorStop(1, "#9E4210");
        ctx.fillStyle = g; ctx.fill();
        // 輪紋
        ctx.strokeStyle = "rgba(120,45,10,.30)"; ctx.lineWidth = 1;
        ctx.save(); ctx.clip();
        for (var m = 0; m < 22; m++) {
            var tt = m / 22 + 0.02 * (Noise.v2(m, seed % 31, seed) - 0.5);
            ctx.beginPath();
            ctx.moveTo(x - w, base - tt * H); ctx.lineTo(x + w, base - tt * H - w * 0.18);
            ctx.stroke();
        }
        ctx.restore();
        // 葉
        ctx.strokeStyle = "#3E6B22"; ctx.lineWidth = 2.4;
        for (var lf = 0; lf < 4; lf++) {
            var a = -1.6 + (lf - 1.5) * 0.36 + rng.range(-0.1, 0.1);
            ctx.beginPath();
            ctx.moveTo(x + bend * Math.sin(2.2) * w * 0.7, base - H);
            ctx.quadraticCurveTo(x + Math.cos(a) * w * 0.9, base - H - h * 0.10,
                x + Math.cos(a) * w * 1.5, base - H - h * 0.17);
            ctx.stroke();
        }
    }

    function render() {
        var seed = (parseInt(input.value, 10) || 0) >>> 0;
        ctx.clearRect(0, 0, c.W, c.H);
        var n = 5, w = c.W / n;
        for (var i = 0; i < n; i++) drawOne(w * (i + 0.5), w * 0.30, c.H, (seed + i * 7919) >>> 0);
        var rng = new Rng(seed), s = [];
        for (var k = 0; k < 4; k++) s.push(rng.next().toFixed(6));
        out.textContent = "rng.next() → " + s.join("  /  ");
    }
    input.addEventListener("input", render);
    $$("[data-seedbtn]").forEach(function (b) {
        b.addEventListener("click", function () {
            if (b.dataset.seedbtn === "next") input.value = (parseInt(input.value, 10) || 0) + 1;
            render();
        });
    });
    render();
    onResize(render);
})();

/* ======================================================================
   03 — ノイズ
   ====================================================================== */
(function () {
    var cv = $("#noiseCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var pal = "gray";
    var sScale = $("#nzScale"), sOct = $("#nzOct"), sCon = $("#nzCon");
    var W = 256, H = 128;
    var img = ctx.createImageData(W, H);

    var PALS = {
        gray: function (v) { return [v * 255, v * 255, v * 255]; },
        potato: function (v) {
            return [mix(140, 214, v), mix(104, 176, v), mix(66, 128, v)];
        },
        suika: function (v) {
            var k = smooth(0.42, 0.56, v);
            return [mix(31, 138, k), mix(74, 186, k), mix(27, 74, k)];
        }
    };

    function render() {
        var sc = +sScale.value, oct = +sOct.value, con = +sCon.value;
        $("#nzScaleV").textContent = sc;
        $("#nzOctV").textContent = oct;
        $("#nzConV").textContent = con.toFixed(2);
        var f = PALS[pal], d = img.data;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                var v = Noise.fbmu(x / W * sc * 2, y / H * sc, sc * 2, 1234, oct);
                v = clamp((v - 0.5) * con + 0.5, 0, 1);
                var rgb = f(v), i = (y * W + x) * 4;
                d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
            }
        }
        var off = document.createElement("canvas");
        off.width = W; off.height = H;
        off.getContext("2d").putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, c.W, c.H);
        ctx.drawImage(off, 0, 0, c.W, c.H);
    }
    [sScale, sOct, sCon].forEach(function (s) { s.addEventListener("input", render); });
    $$("#nzPal .chip").forEach(function (b) {
        b.addEventListener("click", function () {
            pal = b.dataset.pal;
            $$("#nzPal .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
            render();
        });
    });
    render();
    onResize(render);
})();

/* ======================================================================
   04 — プロファイル編集 + 回転体プレビュー
   ====================================================================== */
(function () {
    var cvE = $("#profCanvas"), cvV = $("#profView"); if (!cvE || !cvV) return;
    var e = setupCanvas(cvE), v = setupCanvas(cvV);
    var curKey = "carrot";
    var ctrl = cloneProfile(PROFILES.carrot);
    var hUnits = PROFILE_H.carrot;
    // プリセットごとの色と質感（a=下端、b=上端）。
    // 形だけ切り替えて色をニンジンのままにしておくと、
    // ナスもシイタケも「オレンジ色の何か」にしか見えず、形の違いが伝わらない。
    var LOOKS = {
        carrot: { a: [0.72, 0.30, 0.08], b: [0.90, 0.42, 0.14], mat: { rough: 0.52, coat: 0.10, sss: 0.12, sheen: 0, sssCol: [1, 0.5, 0.25] } },
        // ここは形を見る実験なので、トマトの艶は 07章の値より控えめにする。
        // rough 0.19 のままだと、粗いプレビューでは白い塊が形を覆ってしまう
        tomato: { a: [0.70, 0.05, 0.04], b: [0.88, 0.16, 0.06], mat: { rough: 0.32, coat: 0.18, sss: 0.22, sheen: 0, sssCol: [1.0, 0.30, 0.18] } },
        nasu: { a: [0.13, 0.04, 0.20], b: [0.21, 0.09, 0.31], mat: MATS.nasu },
        shiitake: {
            a: [0.44, 0.35, 0.26], b: [0.32, 0.20, 0.12],
            // ひだ（傘の裏）だけは例外でほぼ白。ここを茶色のままにすると、
            // 形を直しても「茶色い円盤」にしか見えない
            f: function (u, t) {
                var gill = smooth(0.515, 0.585, t) * (1 - smooth(0.635, 0.682, t));
                return [mix(mix(0.44, 0.32, t), 0.90, gill),
                mix(mix(0.35, 0.20, t), 0.88, gill),
                mix(mix(0.26, 0.12, t), 0.79, gill)];
            },
            mat: { rough: 0.80, coat: 0, sss: 0.06, sheen: 0.12, sssCol: [0.8, 0.6, 0.4], sheenCol: [0.80, 0.74, 0.60] }
        }
    };
    function look() { return LOOKS[curKey] || LOOKS.carrot; }
    function lookAlb(u, t) {
        var L = look();
        if (L.f) return L.f(u, t);
        return [mix(L.a[0], L.b[0], t), mix(L.a[1], L.b[1], t), mix(L.a[2], L.b[2], t)];
    }
    var mesh = null, dirty = true, drag = -1;
    var bump = 0, ridge = 0;

    // 横（r）と縦（t×高さ）を同じ倍率で描く。
    // 片方だけ引き伸ばすと、エディタの絵と右の立体の形が食い違う。
    var scale = 1, yTop = 0, yBot = 0;
    function layout() {
        scale = e.W * 0.44;
        var half = hUnits * scale * 0.5;
        yTop = e.H / 2 - half; yBot = e.H / 2 + half;
    }
    layout();
    function toScreen(p) {
        return { x: e.W / 2 + p.r * scale, y: e.H / 2 - (p.t - 0.5) * hUnits * scale };
    }
    function fromScreen(x, y) {
        return {
            r: clamp((x - e.W / 2) / scale, 0.005, 1),
            t: clamp(0.5 - (y - e.H / 2) / (hUnits * scale), 0, 1)
        };
    }

    function drawEditor() {
        var ctx = e.ctx;
        ctx.clearRect(0, 0, e.W, e.H);
        // 方眼
        ctx.strokeStyle = "rgba(175,192,163,.55)"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var gx = 0; gx <= e.W; gx += 20) { ctx.moveTo(gx, 0); ctx.lineTo(gx, e.H); }
        for (var gy = 0; gy <= e.H; gy += 20) { ctx.moveTo(0, gy); ctx.lineTo(e.W, gy); }
        ctx.stroke();
        // 軸
        ctx.strokeStyle = "rgba(26,35,28,.45)"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(e.W / 2, 10); ctx.lineTo(e.W / 2, e.H - 10); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#7B8A7F"; ctx.font = "11px ui-monospace,monospace";
        ctx.fillText("回転軸", e.W / 2 + 6, 20);
        ctx.fillText("r →", e.W / 2 + scale * 0.86, yBot + 18);
        ctx.fillText("y", e.W / 2 - 22, yTop - 6);

        // 曲線（左右対称）
        var pathR = [], pathL = [];
        for (var k = 0; k <= 80; k++) {
            var t = k / 80, r = sampleProfile(ctrl, t);
            var s = toScreen({ t: t, r: r }), s2 = toScreen({ t: t, r: -r });
            pathR.push(s); pathL.push(s2);
        }
        var ctx2 = ctx;
        ctx2.beginPath();
        pathR.forEach(function (p, i) { i ? ctx2.lineTo(p.x, p.y) : ctx2.moveTo(p.x, p.y); });
        for (var q = pathL.length - 1; q >= 0; q--) ctx2.lineTo(pathL[q].x, pathL[q].y);
        ctx2.closePath();
        ctx2.fillStyle = "rgba(226,105,28,.14)"; ctx2.fill();
        ctx2.strokeStyle = "#E2691C"; ctx2.lineWidth = 2; ctx2.stroke();

        // 制御点
        for (var i2 = 0; i2 < ctrl.length; i2++) {
            var sp = toScreen(ctrl[i2]);
            ctx.beginPath(); ctx.arc(sp.x, sp.y, drag === i2 ? 9 : 7, 0, TAU);
            ctx.fillStyle = drag === i2 ? "#DA130E" : "#1A231C"; ctx.fill();
            ctx.strokeStyle = "#F0F2EA"; ctx.lineWidth = 2; ctx.stroke();
        }
    }

    function rebuild() {
        var shape = makeShape(ctrl, { bump: bump, ridge: ridge, ridgeAmp: 0.075, seed: 21, height: hUnits });
        mesh = buildMesh(shape, 40, 54);
        dirty = false;
    }

    function pointer(ev) {
        var rect = cvE.getBoundingClientRect();
        var scale = e.W / rect.width;
        return { x: (ev.clientX - rect.left) * scale, y: (ev.clientY - rect.top) * scale };
    }
    cvE.addEventListener("pointerdown", function (ev) {
        var p = pointer(ev), best = -1, bd = 26 * 26;
        for (var i = 0; i < ctrl.length; i++) {
            var s = toScreen(ctrl[i]);
            var d = (s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y);
            if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) { drag = best; cvE.setPointerCapture(ev.pointerId); drawEditor(); }
    });
    cvE.addEventListener("pointermove", function (ev) {
        if (drag < 0) return;
        ev.preventDefault();
        var p = pointer(ev), q = fromScreen(p.x, p.y);
        var lo = drag === 0 ? 0 : ctrl[drag - 1].t + 0.02;
        var hi = drag === ctrl.length - 1 ? 1 : ctrl[drag + 1].t - 0.02;
        ctrl[drag].t = clamp(q.t, lo, hi);
        ctrl[drag].r = q.r;
        if (drag === 0) ctrl[drag].t = 0;
        if (drag === ctrl.length - 1) ctrl[drag].t = 1;
        dirty = true; drawEditor();
    });
    function endDrag(ev) { if (drag >= 0) { drag = -1; drawEditor(); } }
    cvE.addEventListener("pointerup", endDrag);
    cvE.addEventListener("pointercancel", endDrag);

    $$("#profPresets .chip").forEach(function (b) {
        b.addEventListener("click", function () {
            curKey = b.dataset.prof;
            ctrl = cloneProfile(PROFILES[curKey]);
            hUnits = PROFILE_H[curKey];
            layout();
            $$("#profPresets .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
            dirty = true; drawEditor();
        });
    });
    $("#profBump").addEventListener("input", function () {
        bump = +this.value; $("#profBumpV").textContent = bump.toFixed(3); dirty = true;
    });
    $("#profRidge").addEventListener("input", function () {
        ridge = +this.value; $("#profRidgeV").textContent = ridge; dirty = true;
    });

    rebuild(); drawEditor();
    addLoop(cvV, function (dt, now) {
        if (dirty) rebuild();
        v.ctx.clearRect(0, 0, v.W, v.H);
        renderMesh(v.ctx, v.W, v.H, mesh, {
            rot: spin(now, 0.4), albedo: lookAlb, mat: look().mat
        });
    });
    window.addEventListener("resize", function () { layout(); drawEditor(); });
})();

/* ======================================================================
   05 — 巻き順と法線
   ====================================================================== */
(function () {
    var cv = $("#meshCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var mode = "solid", smoothN = true, flip = false, cull = true, seg = 40;
    var mesh = null;
    function rebuild() {
        var shape = makeShape(PROFILES.tomato, { ridge: 6, ridgeAmp: 0.03, height: PROFILE_H.tomato });
        mesh = buildMesh(shape, Math.max(8, Math.round(seg * 0.8)), seg);
    }
    rebuild();

    $$("#meshMode .chip").forEach(function (b) {
        b.addEventListener("click", function () {
            mode = b.dataset.mmode;
            $$("#meshMode .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        });
    });
    $("#meshSmooth").addEventListener("change", function () { smoothN = this.checked; });
    $("#meshFlip").addEventListener("change", function () { flip = this.checked; });
    $("#meshCull").addEventListener("change", function () { cull = this.checked; });
    $("#meshSeg").addEventListener("input", function () {
        seg = +this.value; $("#meshSegV").textContent = seg; rebuild();
    });

    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: spin(now, 0.4), mode: mode, smooth: smoothN, flip: flip, cull: cull,
            albedo: function () { return MATS.tomato.col; },
            mat: { rough: 0.28, coat: 0.25, sss: 0.18, sheen: 0, sssCol: [1, 0.3, 0.2] }
        });
        if (mode === "facing") {
            ctx.font = "12px ui-monospace,monospace";
            ctx.fillStyle = "#528530"; ctx.fillText("■ 表向き（描かれる）", 14, 22);
            ctx.fillStyle = "#DA130E"; ctx.fillText("■ 裏向き（本来は描かれない）", 14, 40);
        }
        if (cull && flip && mode !== "facing") {
            ctx.font = "13px system-ui,sans-serif";
            ctx.fillStyle = "#7B8A7F";
            ctx.textAlign = "center";
            ctx.fillText("全部の面が裏を向いたので、何も描かれません", c.W / 2, c.H / 2);
            ctx.textAlign = "left";
        }
    });
})();

/* ======================================================================
   06 — テクスチャ
   ====================================================================== */
(function () {
    var cvT = $("#texCanvas"), cvV = $("#texView"); if (!cvT || !cvV) return;
    var t = setupCanvas(cvT), v = setupCanvas(cvV);
    var TS = 256;
    var buf = document.createElement("canvas"); buf.width = TS; buf.height = TS;
    var bctx = buf.getContext("2d");
    var img = bctx.createImageData(TS, TS);
    var data = img.data;
    var kind = "stripe", amt = 1, freq = 1, showUV = false, needBake = true;
    function scheduleBake() { needBake = true; }

    // 模様ごとに、その野菜の形で貼る。全部トマトに貼ると「スイカ柄のトマト」に
    // なってしまい、UV の話より先に形と模様のちぐはぐさが目についてしまう。
    //
    // 分割数はここでは多めにとる。このミニレンダラは色を面の中心1点でしか
    // 拾えないので、分割数がそのまま「模様の解像度」になる。テクスチャの章で
    // 模様がモザイクに潰れていては話にならない。縦横の比はテクセルの密度に
    // 合わせる（きゅうりは縦に長いので段を多く、周は少なく）。
    var KINDS = {
        stripe: {
            prof: "suika", N: 60, M: 88,
            note: "縞が上下の極（へた側とお尻）で1点に集まります。u を周方向にとった結果、勝手にそうなります。"
        },
        wart: {
            prof: "kyuri", N: 84, M: 48,
            note: "胴のほとんどが平行なので、イボの大きさは端まで変わりません。細るのは両端だけです。"
        },
        fiber: {
            prof: "tamanegi", N: 60, M: 88,
            note: "繊維は u 方向に細かく v 方向に長い。首と根盤では、その全部が1点に集まって束になります。"
        },
        net: {
            prof: "melon", N: 60, M: 88,
            note: "網目には向きが無いので、極に寄っても縞ほど崩れて見えません。同じ UV でも模様しだいです。"
        }
    };
    var meshes = {};
    function meshFor(k) {
        var s = KINDS[k] || KINDS.stripe;
        if (!meshes[k]) meshes[k] = buildMesh(makeShape(PROFILES[s.prof], { height: PROFILE_H[s.prof] }), s.N, s.M);
        return meshes[k];
    }
    var noteEl = $("#texNote");
    function syncNote() {
        if (noteEl) noteEl.textContent = (KINDS[kind] || KINDS.stripe).note;
    }

    function px(u, v2) {
        var r, g, b;
        if (kind === "stripe") {
            var warp = (Noise.fbmu(u * 10 * freq, v2 * 4 * freq, 10 * freq, 5, 4) - 0.5) * 0.9 * amt;
            var s = Math.cos((u * 10 + warp) * TAU * 0.6 * freq);
            var fingers = Noise.fbmu(u * 26 * freq, v2 * 9 * freq, 26 * freq, 9, 4) - 0.5;
            var k = smooth(-0.12, 0.30, s + fingers * 1.5 * amt);
            r = mix(0.12, 0.55, k); g = mix(0.29, 0.73, k); b = mix(0.10, 0.30, k);
        } else if (kind === "wart") {
            var base = Noise.fbmu(u * 12 * freq, v2 * 14 * freq, 12 * freq, 3, 3);
            var cell = 0, dots = 14 * freq;
            var cu = Math.floor(u * dots), cv2 = Math.floor(v2 * dots);
            for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
                var hx = Noise.h2(cu + ox, cv2 + oy, 31), hy = Noise.h2(cu + ox, cv2 + oy, 57);
                var dx = (cu + ox + hx) / dots - u, dy = (cv2 + oy + hy) / dots - v2;
                var d = Math.hypot(dx, dy) * dots;
                cell = Math.max(cell, 1 - smooth(0.12, 0.42, d));
            }
            var w = cell * amt;
            r = mix(0.16 + 0.10 * base, 0.86, w * 0.75);
            g = mix(0.40 + 0.14 * base, 0.90, w * 0.55);
            b = mix(0.11 + 0.06 * base, 0.78, w * 0.7);
        } else if (kind === "fiber") {
            var f2 = 0;
            for (var i = 0; i < 3; i++) {
                var fq = 90 * freq * (1 + i * 0.7);
                f2 += (0.6 / (i + 1)) * Math.pow(Math.abs(Math.sin(u * fq * Math.PI + Noise.fbmu(u * 6, v2 * 3, 6, 13 + i, 2) * 7)), 12);
            }
            f2 = clamp(f2 * amt, 0, 1);
            var tone2 = 0.72 + 0.2 * Noise.fbmu(u * 5, v2 * 5, 5, 21, 3);
            r = mix(0.80 * tone2, 0.44, f2); g = mix(0.63 * tone2, 0.30, f2); b = mix(0.36 * tone2, 0.14, f2);
        } else { // net
            // 網目は「セルの境目」。
            // 【対策】fBm の等高線（ridge ノイズ）で描くと、網が密な場所と
            //         何も無い場所ができてしまい、立体に貼るとまだら模様に見える。
            //         実物のメロンの網はコルク層の裂け目なので、全面に均一。
            //         いちばん近い点と2番目に近い点の距離差で「境目」を出すと、
            //         密度がそろった網になる（ボロノイの辺）。
            var cells = Math.max(3, Math.round(7 * freq));
            var cu2 = Math.floor(u * cells), cv3 = Math.floor(v2 * cells);
            var d1 = 9, d2 = 9;
            for (var ny = -1; ny <= 1; ny++) {
                for (var nx = -1; nx <= 1; nx++) {
                    var gx = cu2 + nx, gy = cv3 + ny;
                    // u は一周してつながるので、ハッシュを引く添字だけ折り返す
                    var gw = ((gx % cells) + cells) % cells;
                    var qx = (gx + Noise.h2(gw, gy, 41)) / cells - u;
                    var qy = (gy + Noise.h2(gw, gy, 73)) / cells - v2;
                    var dd = Math.hypot(qx, qy) * cells;
                    if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
                }
            }
            var net = (1 - smooth(0.03, 0.21, d2 - d1)) * amt;
            var g0 = 0.55 + 0.12 * Noise.fbmu(u * 4, v2 * 4, 4, 3, 3);
            r = mix(g0 * 0.85, 0.90, net); g = mix(g0 * 0.86, 0.88, net); b = mix(g0 * 0.55, 0.76, net);
        }
        return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
    }

    function bake() {
        for (var y = 0; y < TS; y++) {
            for (var x = 0; x < TS; x++) {
                var u = x / TS, vv = 1 - y / TS;
                var col = px(u, vv);
                if (showUV) {
                    var ck = ((Math.floor(u * 12) + Math.floor(vv * 12)) & 1) === 0 ? 1 : 0;
                    col = [mix(col[0], ck, 0.28), mix(col[1], ck, 0.28), mix(col[2], ck, 0.28)];
                }
                var i = (y * TS + x) * 4;
                data[i] = col[0] * 255; data[i + 1] = col[1] * 255; data[i + 2] = col[2] * 255; data[i + 3] = 255;
            }
        }
        bctx.putImageData(img, 0, 0);
        t.ctx.clearRect(0, 0, t.W, t.H);
        t.ctx.imageSmoothingEnabled = true;
        t.ctx.drawImage(buf, 0, 0, t.W, t.H);
    }

    // 立体に貼るときは、焼いたテクスチャから引く。
    //
    // 【対策】面の中心1点だけを拾うと、面より細い模様は当たり外れが出て、
    //         そのままムラになる。網目が「網」ではなく「まだら」に化けるのは
    //         これ。面1枚が UV 上で占める幅を求め、その範囲を 3×3 で拾って
    //         平均する。GPU がミップマップでやっているのと同じ理屈。
    // 返す配列は使い回す（面ごとに確保すると、面の数だけゴミが出る）
    var texOut = [0, 0, 0], stepU = 2, stepV = 2;
    function syncFootprint() {
        var s = KINDS[kind] || KINDS.stripe;
        stepU = Math.max(1, Math.round(TS / s.M * 0.5));      // 面1枚は u で 1/M
        stepV = Math.max(1, Math.round(TS / (s.N - 1) * 0.5));  // v で 1/(N-1)
    }
    function sample(u, vv) {
        var cx = Math.floor(u * TS), cy = Math.floor((1 - vv) * TS);
        var r = 0, g = 0, b = 0;
        for (var dy = -1; dy <= 1; dy++) {
            var y = cy + dy * stepV; if (y < 0) y = 0; else if (y >= TS) y = TS - 1;
            for (var dx = -1; dx <= 1; dx++) {
                var x = (cx + dx * stepU) % TS; if (x < 0) x += TS;   // u は一周してつながる
                var i = (y * TS + x) * 4;
                r += data[i]; g += data[i + 1]; b += data[i + 2];
            }
        }
        texOut[0] = r / 2295; texOut[1] = g / 2295; texOut[2] = b / 2295;   // 9 サンプル × 255
        return texOut;
    }

    $$("#texKind .chip").forEach(function (b) {
        b.addEventListener("click", function () {
            kind = b.dataset.tex;
            $$("#texKind .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
            syncNote(); syncFootprint(); scheduleBake();
        });
    });
    $("#texAmt").addEventListener("input", function () { amt = +this.value; $("#texAmtV").textContent = amt.toFixed(2); scheduleBake(); });
    $("#texFreq").addEventListener("input", function () { freq = +this.value; $("#texFreqV").textContent = freq.toFixed(2); scheduleBake(); });
    $("#texUV").addEventListener("change", function () { showUV = this.checked; scheduleBake(); });
    bake(); needBake = false; syncNote(); syncFootprint();
    onResize(scheduleBake);

    addLoop(cvV, function (dt, now) {
        if (needBake) { bake(); needBake = false; }
        v.ctx.clearRect(0, 0, v.W, v.H);
        renderMesh(v.ctx, v.W, v.H, meshFor(kind), {
            rot: spin(now, 0.35), albedo: sample,
            mat: { rough: 0.38, coat: 0.22, sss: 0.08, sheen: 0.05 }
        });
    });
})();

/* ======================================================================
   07 — PBR
   ====================================================================== */
(function () {
    var cv = $("#pbrCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    // ここは艶そのものを見る実験なので、分割は粗くしない。
    // 面が粗いと、鏡面のローブが面の間に落ちてスライダーの効きが見えなくなる
    var mesh = buildMesh(makeShape(PROFILES.nasu, { bump: 0.02, seed: 4, height: PROFILE_H.nasu }), 48, 64);
    var m = { rough: 0.24, coat: 0.45, sss: 0.10, sheen: 0, col: MATS.nasu.col.slice(), sssCol: [0.7, 0.3, 0.9], sheenCol: [0.82, 0.86, 0.66] };
    var ang = -35;
    var ids = { rough: "pbrRough", coat: "pbrCoat", sss: "pbrSss", sheen: "pbrSheen" };

    function sync() {
        $("#pbrRoughV").textContent = m.rough.toFixed(2);
        $("#pbrCoatV").textContent = m.coat.toFixed(2);
        $("#pbrSssV").textContent = m.sss.toFixed(2);
        $("#pbrSheenV").textContent = m.sheen.toFixed(2);
        $("#pbrLightV").textContent = ang + "°";
        $("#pbrRough").value = m.rough; $("#pbrCoat").value = m.coat;
        $("#pbrSss").value = m.sss; $("#pbrSheen").value = m.sheen;
    }
    Object.keys(ids).forEach(function (k) {
        $("#" + ids[k]).addEventListener("input", function () { m[k] = +this.value; sync(); });
    });
    $("#pbrLight").addEventListener("input", function () { ang = +this.value; sync(); });
    $$("#pbrPreset .chip").forEach(function (b) {
        b.addEventListener("click", function () {
            var p = MATS[b.dataset.pbr];
            m.rough = p.rough; m.coat = p.coat; m.sss = p.sss; m.sheen = p.sheen;
            m.col = p.col.slice(); m.sssCol = p.sssCol || [1, 0.5, 0.4];
            m.sheenCol = p.sheenCol || [0.82, 0.86, 0.66];
            $$("#pbrPreset .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
            sync();
        });
    });
    sync();

    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        var a = ang * Math.PI / 180;
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: spin(now, 0.3),
            light: [Math.sin(a) * 0.8, 0.62, -Math.cos(a) * 0.8],
            albedo: function (u, v) {
                var n = Noise.fbmu(u * 10, v * 12, 10, 17, 3);
                return [clamp(m.col[0] * (0.86 + 0.28 * n), 0, 1),
                clamp(m.col[1] * (0.86 + 0.28 * n), 0, 1),
                clamp(m.col[2] * (0.86 + 0.28 * n), 0, 1)];
            },
            mat: m
        });
    });
})();


/* ======================================================================
   ファイル一覧（図鑑とソースビューアで共有）
   [表示名, ファイル名, 色, 説明]
   ====================================================================== */
var FILES = [
        ["トマト", "トマト.js", "#DA130E", "肩のくぼみと、萼片を1枚ずつ立体で作るがく。半径だけでなく (r, y) の2列テーブルが要る形の代表。"],
        ["キュウリ", "キュウリ.js", "#5C8C2E", "浅い縦の稜とイボ。法線マップの上下の符号を間違えた記録が残っていて、教材として一番わかりやすい。"],
        ["ナス", "ナス.js", "#3A2450", "クリアコートの加減がすべて。強すぎると黒ガラス、弱いとゴム。艶の調整の練習台。"],
        ["ピーマン", "ピーマン.js", "#2B6F1C", "縦に3本の深い溝と、そのあいだの丸い「片」。ヘタは星形のがく。ほぼ鏡面。"],
        ["オクラ", "オクラ.js", "#528530", "丸めた正五角形の断面と産毛。sheen（布のような照り）を使う唯一に近い例。"],
        ["ゴーヤ", "ゴーヤ.js", "#3F7A2A", "大きな瘤はジオメトリ、細かい粒は法線マップ。凹凸を2階層に分ける考え方。"],
        ["ニンジン", "ニンジン.js", "#E2691C", "円錐＋輪紋＋側根痕。構造がいちばん素直なので、最初に読むならこれ。"],
        ["ジャガイモ", "ジャガイモ.js", "#8A6B3F", "極（頭とお尻）でUVが潰れる問題への対処が全編にわたる。3Dノイズを使う理由がわかる。"],
        ["サツマイモ", "サツマイモ.js", "#A03A5B", "紡錘形と根跡の縦の列。艶消しの表面を、粗さの分布だけで作る例。"],
        ["トウモロコシ", "トウモロコシ.js", "#D9A227", "粒を実体のメッシュとして作り、芯に植えて結合する。模様で済ませない判断の見本。"],
        ["シイタケ", "シイタケ.js", "#6B4A2E", "ひだ（ラメラ）を実体で立てる。裏返っても嘘にならない作り方。"],
        ["エリンギ", "エリンギ.js", "#C9BFA6", "主役は柄。柄が上へ広がってそのまま傘になる、垂生のひだ。"],
        ["玉ねぎ", "玉ねぎ.js", "#E8D3A8", "異方性・シーン・透過の3つで乾いた薄紙を出す。PBRの合わせ技の教科書。"],
        ["スイカ", "スイカ.js", "#1F4A1B", "縞が極で1点に集まるのは、u を周方向にとった結果。UVの意味がわかる回。"],
        ["メロン", "メロン.js", "#B3A667", "網目に視差マッピング。法線マップのアルファに高さを入れる小技つき。"],
        ["リンゴ", "リンゴ.js", "#C0342B", "5裂の断面と2つのくぼみ。クリアコートが掛け算で効く落とし穴の記録あり。"],
        ["ブドウ", "ブドウ.js", "#5B2A6E", "粒を数十個配置して重なりを解消する反復計算。房の作り方。"],
        ["バナナ", "バナナ.js", "#E3C13F", "断面が5稜の多角形。回転体ではなく、曲がった軸に沿った掃引の例。"],
        ["サクランボ", "サクランボ.js", "#CC1C16", "球ではなくハート形。黄色い地色に赤が回り込み、境目に斑点が飛ぶ。色の作り方の教科書。"],
        ["枝豆", "枝豆.js", "#588A2D", "豆の膨らみを「なめらかな max」で合成する。産毛はシェル（薄い殻）を重ねて生やす。"],
        ["ブロッコリー", "ブロッコリー.js", "#54743C", "テクスチャを1枚も使わない。房を再帰で生やし、粒の谷の暗さを頂点カラーに焼き込む。"],
        ["カリフラワー", "カリフラワー.js", "#EDE9D7", "ブロッコリーと同じ骨格。数値を4か所変えるだけで別の野菜になる、差分設計の見本。"],
        ["ロマネスコ", "ロマネスコ.js", "#A2B340", "黄金角137.5°と等比数列だけで自己相似の螺旋が生まれる。打ち切りの設計がすべて。"]
];
function viewHref(file) { return "view.html?f=" + encodeURIComponent(file); }

/* ======================================================================
   図鑑 — カードからソースを開けるようにする
   ====================================================================== */
(function () {
    var host = $("#catalog"); if (!host) return;
    var frag = document.createDocumentFragment();
    FILES.forEach(function (v) {
        var a = document.createElement("a");
        a.className = "card";
        a.href = viewHref(v[1]);
        a.style.setProperty("--sw", v[2]);
        a.innerHTML = '<h4></h4><p class="fn"></p><p class="d"></p>' +
            '<span class="more">ソースを読む →</span>';
        a.querySelector("h4").textContent = v[0];
        a.querySelector(".fn").textContent = v[1];
        a.querySelector(".d").textContent = v[3];
        frag.appendChild(a);
    });
    host.appendChild(frag);
})();

/* ======================================================================
   ソースビューア
   ・色付けは自前。サンプルには正規表現リテラルもテンプレート文字列も
     出てこないので、コメント/文字列/数値/キーワードだけを見れば足りる
   ・行番号は別の <pre>（ガター）に出す。コード側の <pre> に混ぜると
     全選択したときに行番号までコピーされてしまう
   ====================================================================== */
var KEYWORDS = {};
"var let const function return if else for while do break continue new this class extends super typeof instanceof in of null undefined true false async await try catch finally throw switch case default delete void yield static import export from".split(" ")
    .forEach(function (w) { KEYWORDS[w] = 1; });

function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJs(src) {
    var out = [], i = 0, n = src.length;
    function isDigit(c) { return c >= "0" && c <= "9"; }
    function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
    function isId(c) { return /[A-Za-z0-9_$]/.test(c); }

    while (i < n) {
        var c = src.charAt(i), d = src.charAt(i + 1), j;

        if (c === "/" && d === "/") {                       // 行コメント
            j = src.indexOf("\n", i); if (j < 0) j = n;
            out.push('<span class="c">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (c === "/" && d === "*") {                // ブロックコメント
            j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2;
            out.push('<span class="c">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (c === '"' || c === "'" || c === "`") {   // 文字列
            j = i + 1;
            while (j < n) {
                var e = src.charAt(j);
                if (e === "\\") { j += 2; continue; }
                if (e === c) { j++; break; }
                if (e === "\n" && c !== "`") { break; }     // 閉じ忘れで暴走させない
                j++;
            }
            out.push('<span class="s">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (isDigit(c) || (c === "." && isDigit(d))) { // 数値
            j = i;
            while (j < n && /[0-9a-fA-FxX._+\-]/.test(src.charAt(j))) {
                // 指数以外の符号でここまで、を判定する
                var ch = src.charAt(j);
                if ((ch === "+" || ch === "-") && !/[eE]/.test(src.charAt(j - 1))) break;
                j++;
            }
            out.push('<span class="n">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (isIdStart(c)) {                          // 識別子・キーワード
            j = i; while (j < n && isId(src.charAt(j))) j++;
            var word = src.slice(i, j);
            out.push(KEYWORDS[word] ? '<span class="k">' + word + "</span>" : escHtml(word));
            i = j;
        } else {
            out.push(escHtml(c));
            i++;
        }
    }
    return out.join("");
}

(function () {
    var codeEl = $("#viewCode"); if (!codeEl) return;
    var gutterEl = $("#viewGutter"), chipHost = $("#viewChips");
    var titleEl = $("#viewTitle"), descEl = $("#viewDesc");
    var rawEl = $("#viewRaw"), metaEl = $("#viewMeta"), copyEl = $("#viewCopy");
    var wrapEl = $("#viewWrap");
    var current = null, currentText = "";

    function pick(name) {
        for (var i = 0; i < FILES.length; i++) if (FILES[i][1] === name) return FILES[i];
        return null;
    }

    function render(text) {
        // サンプルは CRLF。CSS の white-space:pre は CR も改行として数えるので、
        // そのまま流すと1行ごとに空行が挟まって行番号とずれる
        text = text.replace(/\r\n?/g, "\n");
        currentText = text;
        var lines = text.split("\n");
        var nums = [];
        for (var i = 1; i <= lines.length; i++) nums.push(i);
        if (gutterEl) gutterEl.textContent = nums.join("\n");
        codeEl.innerHTML = highlightJs(text);
        if (metaEl) metaEl.textContent = lines.length + " 行 / " + Math.round(text.length / 1024) + " KB";
        if (wrapEl) wrapEl.scrollTop = 0;
        if (copyEl) { copyEl.disabled = false; copyEl.textContent = "コードをコピー"; }
    }

    function fail(msg) {
        if (gutterEl) gutterEl.textContent = "";
        codeEl.textContent = msg;
        if (metaEl) metaEl.textContent = "";
        if (copyEl) copyEl.disabled = true;
    }

    // 控えの読み込み。file:// では fetch が使えないので <script> で入れる
    function loadFallback(file, done) {
        if (window.__SRC && window.__SRC[file]) { done(window.__SRC[file]); return; }
        var s = document.createElement("script");
        s.src = "assets/src/" + encodeURIComponent(file.replace(/\.js$/, ".src.js"));
        s.onload = function () {
            done(window.__SRC && window.__SRC[file] ? window.__SRC[file] : null);
        };
        s.onerror = function () { done(null); };
        document.head.appendChild(s);
    }

    function load(v) {
        codeEl.textContent = "読み込んでいます…";
        if (gutterEl) gutterEl.textContent = "";
        var file = v[1];
        var settled = false;
        function useFallback() {
            loadFallback(file, function (text) {
                if (current !== v) return;
                if (text == null) {
                    fail(file + " を読み込めませんでした。右上の「別のタブで開く」から直接ご覧ください。");
                } else {
                    render(text);
                }
            });
        }
        // http で開かれているときは実ファイルを読む（編集がすぐ反映される）
        try {
            fetch(encodeURIComponent(file)).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            }).then(function (t) {
                settled = true;
                if (current === v) render(t);
            }).catch(function () {
                if (!settled) useFallback();
            });
        } catch (e) {
            useFallback();
        }
    }

    function show(v, push) {
        current = v;
        if (titleEl) titleEl.textContent = v[1];
        if (descEl) descEl.textContent = v[3];
        if (rawEl) rawEl.href = encodeURIComponent(v[1]);
        $$("#viewChips .chip").forEach(function (b) {
            b.setAttribute("aria-pressed", b.dataset.file === v[1] ? "true" : "false");
        });
        document.title = v[1] + " — やさいのつくりかた";
        // file:// では replaceState が拒否されることがある。
        // アドレスが更新できなくても表示は続けたいので握りつぶす
        if (push && window.history && history.replaceState) {
            try { history.replaceState(null, "", viewHref(v[1])); } catch (e) { /* noop */ }
        }
        load(v);
    }

    if (chipHost) {
        FILES.forEach(function (v) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "chip";
            b.dataset.file = v[1];
            b.textContent = v[0];
            b.addEventListener("click", function () { show(v, true); });
            chipHost.appendChild(b);
        });
    }

    if (copyEl) {
        copyEl.addEventListener("click", function () {
            if (!currentText) return;
            function ok() { copyEl.textContent = "コピーしました"; setTimeout(function () { copyEl.textContent = "コードをコピー"; }, 1600); }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(currentText).then(ok, legacy);
            } else { legacy(); }
            function legacy() {
                var ta = document.createElement("textarea");
                ta.value = currentText;
                ta.style.position = "fixed"; ta.style.opacity = "0";
                document.body.appendChild(ta); ta.select();
                try { document.execCommand("copy"); ok(); } catch (e) { copyEl.textContent = "コピーできませんでした"; }
                document.body.removeChild(ta);
            }
        });
    }

    var q = /[?&]f=([^&]+)/.exec(location.search);
    var target = (q && pick(decodeURIComponent(q[1]))) || FILES[0];
    show(target, false);
})();

/* ======================================================================
   ここから下は「複数ページ版」で足した実験（09〜11章）
   ====================================================================== */

/* 小さな共通ヘルパ ---------------------------------------------------- */
function chipGroup(sel, cb) {
    var els = $$(sel + " .chip");
    els.forEach(function (b) {
        b.addEventListener("click", function () {
            els.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
            cb(b.getAttribute("data-v"));
        });
    });
}
function slider(id, vid, fmt, cb) {
    var el = $(id); if (!el) return null;
    var out = vid ? $(vid) : null;
    function upd() {
        var n = parseFloat(el.value);
        if (out) out.textContent = fmt ? fmt(n) : String(n);
        cb(n);
    }
    el.addEventListener("input", upd);
    upd();
    return el;
}
// 何度も描き直さないための「汚れフラグ」つきループ
function lazyLoop(cv, draw) {
    var dirty = true;
    function mark() { dirty = true; }
    window.addEventListener("resize", mark);
    addLoop(cv, function () { if (!dirty) return; dirty = false; draw(); });
    return mark;
}

/* ======================================================================
   09a — 粒を格子に並べる（トウモロコシ）
   円柱を切り開いた展開図。列ごとに半ピッチずらすと噛み合う。
   ====================================================================== */
(function () {
    var cv = $("#kernelCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var cols = 16, rows = 11, shift = 0.5, size = 1.0;
    var gapEl = $("#knGap"), cntEl = $("#knCount");
    var mark;

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        var pad = 10;
        var W = c.W - pad * 2, H = c.H - pad * 2;
        var cw = W / cols, ch = H / rows;
        var rx = cw * 0.5 * size, ry = ch * 0.5 * size;

        // 下地（芯）
        ctx.fillStyle = "#C9B47A";
        ctx.fillRect(pad, pad, W, H);

        for (var j = 0; j < cols; j++) {
            for (var i = -1; i <= rows; i++) {
                var cx = pad + (j + 0.5) * cw;
                var cy = pad + (i + 0.5 + (j % 2) * shift) * ch;
                if (cy < pad - ry || cy > pad + H + ry) continue;
                var g = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, ry * 0.1, cx, cy, Math.max(rx, ry) * 1.15);
                g.addColorStop(0, "#FBE9A6");
                g.addColorStop(0.55, "#EFC64A");
                g.addColorStop(1, "#B9861E");
                ctx.save();
                ctx.beginPath();
                ctx.rect(pad, pad, W, H);
                ctx.clip();
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx * 0.94, ry * 0.94, 0, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = "rgba(90,60,10,.35)"; ctx.lineWidth = 0.8; ctx.stroke();
                ctx.restore();
            }
        }
        // 枠
        ctx.strokeStyle = "#AFC0A3"; ctx.lineWidth = 1;
        ctx.strokeRect(pad + 0.5, pad + 0.5, W - 1, H - 1);

        if (cntEl) cntEl.textContent = (cols * rows) + " 粒";
        if (gapEl) gapEl.textContent = size < 1.0 ? "すき間だらけ（ビーズに見える）"
            : (size > 1.06 ? "押し合ってつぶれている（本物っぽい）" : "ちょうど接している");
    }

    mark = lazyLoop(cv, draw);
    slider("#knCols", "#knColsV", function (n) { return n + " 列"; }, function (n) { cols = n | 0; mark(); });
    slider("#knRows", "#knRowsV", function (n) { return n + " 段"; }, function (n) { rows = n | 0; mark(); });
    slider("#knShift", "#knShiftV", function (n) { return n.toFixed(2); }, function (n) { shift = n; mark(); });
    slider("#knSize", "#knSizeV", function (n) { return n.toFixed(2); }, function (n) { size = n; mark(); });
})();

/* ======================================================================
   09b — 重なりをほぐす（ブドウの房）
   まず適当にばらまき、めり込んだぶんだけ互いに押し返す。
   ====================================================================== */
(function () {
    var cv = $("#packCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var count = 38, running = false, iter = 0;
    var berries = [];
    var ovEl = $("#pkOverlap"), itEl = $("#pkIter");
    var seed = 20260801;

    // 房の輪郭：上が広く、下へすぼまる円錐
    function halfWidth(v) { return 0.46 * (1 - 0.72 * Math.pow(v, 1.35)) + 0.03; }

    function scatter() {
        var rng = new Rng(seed);
        // 粒を増やしたぶんだけ小さくする。房の面積に対する詰まり具合を
        // 一定に保たないと、いくらほぐしても重なりが取れなくなる。
        var R = 0.33 / Math.sqrt(count);
        berries = [];
        for (var i = 0; i < count; i++) {
            var v = Math.pow(rng.next(), 0.72);       // 上に少し多め
            var hw = halfWidth(v);
            berries.push({
                x: rng.range(-hw, hw),
                y: v,
                r: Math.max(0.02, rng.gauss(R, R * 0.09))
            });
        }
        iter = 0;
    }

    function overlaps() {
        var n = 0;
        for (var i = 0; i < berries.length; i++) {
            for (var j = i + 1; j < berries.length; j++) {
                var a = berries[i], b = berries[j];
                var dx = b.x - a.x, dy = (b.y - a.y) * 1.0;
                if (Math.hypot(dx, dy) < (a.r + b.r) * 0.98) n++;
            }
        }
        return n;
    }

    // 1回ぶんのほぐし
    function relax() {
        for (var i = 0; i < berries.length; i++) {
            for (var j = i + 1; j < berries.length; j++) {
                var a = berries[i], b = berries[j];
                var dx = b.x - a.x, dy = b.y - a.y;
                var d = Math.hypot(dx, dy) || 1e-4;
                var need = (a.r + b.r) * 0.99;
                if (d < need) {
                    var push = (need - d) * 0.5;
                    dx /= d; dy /= d;
                    a.x -= dx * push; a.y -= dy * push;
                    b.x += dx * push; b.y += dy * push;
                }
            }
        }
        // 房の外へ出た粒を戻す
        for (var k = 0; k < berries.length; k++) {
            var p = berries[k];
            p.y = clamp(p.y, 0.02, 0.98);
            var hw = halfWidth(p.y);
            if (p.x > hw) p.x = hw;
            if (p.x < -hw) p.x = -hw;
        }
        iter++;
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        var cx = c.W / 2, top = 22, hgt = c.H - top - 14;
        var S = Math.min(c.W * 0.94, hgt);

        // 輪郭の目安
        ctx.strokeStyle = "rgba(26,35,28,.22)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath();
        for (var s = -1; s <= 1; s += 2) {
            for (var q = 0; q <= 40; q++) {
                var v = q / 40, X = cx + s * halfWidth(v) * S, Y = top + v * hgt;
                if (q === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
            }
        }
        ctx.stroke(); ctx.setLineDash([]);

        // 軸（果梗）
        ctx.strokeStyle = "#6E5A2E"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, top - 12); ctx.lineTo(cx, top + hgt * 0.9); ctx.stroke();

        // 粒。重なっているものは赤で縁取る
        var bad = {};
        for (var i = 0; i < berries.length; i++) {
            for (var j = i + 1; j < berries.length; j++) {
                var a = berries[i], b = berries[j];
                if (Math.hypot(b.x - a.x, b.y - a.y) < (a.r + b.r) * 0.98) { bad[i] = 1; bad[j] = 1; }
            }
        }
        var sorted = berries.map(function (p, i) { return { p: p, i: i }; })
            .sort(function (A, B) { return A.p.y - B.p.y; });
        for (var m = 0; m < sorted.length; m++) {
            var p = sorted[m].p, idx = sorted[m].i;
            var X = cx + p.x * S, Y = top + p.y * hgt, R = p.r * S;
            var g = ctx.createRadialGradient(X - R * 0.35, Y - R * 0.4, R * 0.1, X, Y, R * 1.1);
            g.addColorStop(0, "#8E6FAE");
            g.addColorStop(0.6, "#4E2A6B");
            g.addColorStop(1, "#2A1240");
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
            ctx.lineWidth = bad[idx] ? 2 : 0.8;
            ctx.strokeStyle = bad[idx] ? "#DA130E" : "rgba(20,8,32,.55)";
            ctx.stroke();
        }

        if (ovEl) ovEl.textContent = overlaps() + " 組";
        if (itEl) itEl.textContent = iter + " 回";
    }

    scatter();
    addLoop(cv, function () {
        if (running) {
            relax();
            if (overlaps() === 0 || iter > 400) running = false;
        }
        draw();
    });

    var bStep = $("#pkStep"), bRun = $("#pkRun"), bReset = $("#pkReset");
    if (bStep) bStep.addEventListener("click", function () { running = false; relax(); });
    if (bRun) bRun.addEventListener("click", function () { running = !running; bRun.setAttribute("aria-pressed", running ? "true" : "false"); });
    if (bReset) bReset.addEventListener("click", function () { running = false; seed = (seed + 7919) | 0; scatter(); });
    slider("#pkCount", "#pkCountV", function (n) { return n + " 粒"; }, function (n) { count = n | 0; running = false; scatter(); });
})();

/* ======================================================================
   10 — 曲がった軸に沿わせる（バナナ / きゅうり / ゴーヤ）
   軸を円弧にして、その各点で断面を「軸に垂直」に置く。
   ====================================================================== */
(function () {
    var cv = $("#spineCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var bend = 0.85, ridge = 5, ridgeAmp = 0.10, twist = 0, showSpine = true;
    var H = 1.75, R0 = 0.26;
    var mesh = null, dirty = true;

    var COLORS = {
        banana: [0.93, 0.78, 0.20],
        kyuri: [0.22, 0.46, 0.16],
        goya: [0.44, 0.66, 0.18]
    };
    var kind = "banana";

    // 軸（円弧）。s は中心からの距離、k は曲がり具合
    function spine(t, out) {
        var s = (t - 0.5) * H, k = bend / H;
        if (Math.abs(k) < 1e-4) { out[0] = 0; out[1] = s; out[2] = 0; out[3] = 0; out[4] = 1; return out; }
        var th = k * s;
        // 円弧のままだと片側に寄るので、両端の x のまん中を原点に寄せる
        var xmid = (1 - Math.cos(bend / 2)) / k * 0.5;
        out[0] = (1 - Math.cos(th)) / k - xmid;   // x
        out[1] = Math.sin(th) / k;                // y
        out[2] = 0;                        // z
        out[3] = Math.cos(th);             // 法線方向（軸に垂直・xy平面内）
        out[4] = -Math.sin(th);
        return out;
    }

    var sp = [0, 0, 0, 0, 0];
    function shape() {
        return {
            height: H,
            pos: function (t, a, out) {
                spine(t, sp);
                var aa = a + twist * (t - 0.5) * Math.PI;
                // 太さ：両端で細る
                var taper = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.35);
                var r = R0 * (0.35 + 0.65 * taper);
                if (ridge > 0) r *= 1 + ridgeAmp * Math.cos(ridge * aa);
                var cx = Math.cos(aa) * r, cz = Math.sin(aa) * r;
                // 断面の平面 = (法線, z軸)
                out[0] = sp[0] + cx * sp[3];
                out[1] = sp[1] + cx * sp[4];
                out[2] = sp[2] + cz;
                return out;
            }
        };
    }

    function rebuild() { mesh = buildMesh(shape(), 42, 40); dirty = false; }
    rebuild();

    function project(x, y, z, rot, S, cx0, cy0) {
        var cs = Math.cos(rot), sn = Math.sin(rot);
        var rx = x * cs + z * sn, rz = -x * sn + z * cs;
        var sc = CAM.f * S / Math.max(0.4, rz + CAM.dist);
        return [cx0 + rx * sc, cy0 - y * sc];
    }

    addLoop(cv, function (dt, now) {
        if (dirty) rebuild();
        ctx.clearRect(0, 0, c.W, c.H);
        var rot = spin(now, 0.45);
        var col = COLORS[kind];
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: rot,
            mat: { rough: kind === "banana" ? 0.55 : 0.3, coat: kind === "banana" ? 0.05 : 0.35, sss: 0.12, sheen: 0 },
            albedo: function (u, v) {
                var n = Noise.fbmu(u * 10, v * 16, 10, 17, 3);
                return [
                    clamp(col[0] * (0.88 + 0.24 * n), 0, 1),
                    clamp(col[1] * (0.88 + 0.24 * n), 0, 1),
                    clamp(col[2] * (0.88 + 0.30 * n), 0, 1)
                ];
            }
        });
        if (showSpine) {
            var S = Math.min(c.W, c.H), cx0 = c.W / 2, cy0 = c.H / 2;
            ctx.strokeStyle = "rgba(218,19,14,.85)"; ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (var q = 0; q <= 50; q++) {
                spine(q / 50, sp);
                var P = project(sp[0], sp[1], 0, rot, S, cx0, cy0);
                if (q === 0) ctx.moveTo(P[0], P[1]); else ctx.lineTo(P[0], P[1]);
            }
            ctx.stroke();
        }
    });

    slider("#spBend", "#spBendV", function (n) { return n.toFixed(2); }, function (n) { bend = n; dirty = true; });
    slider("#spRidge", "#spRidgeV", function (n) { return (n | 0) === 0 ? "なし（丸）" : (n | 0) + " 本"; }, function (n) { ridge = n | 0; dirty = true; });
    slider("#spTwist", "#spTwistV", function (n) { return n.toFixed(2); }, function (n) { twist = n; dirty = true; });
    var swSpine = $("#spShowSpine");
    if (swSpine) swSpine.addEventListener("change", function () { showSpine = swSpine.checked; });
    chipGroup("#spPreset", function (v) {
        kind = v;
        var el;
        if (v === "banana") { bend = 0.85; ridge = 5; ridgeAmp = 0.10; }
        else if (v === "kyuri") { bend = 0.22; ridge = 10; ridgeAmp = 0.045; }
        else { bend = 0.30; ridge = 8; ridgeAmp = 0.20; }
        el = $("#spBend"); if (el) { el.value = bend; el.dispatchEvent(new Event("input")); }
        el = $("#spRidge"); if (el) { el.value = ridge; el.dispatchEvent(new Event("input")); }
        dirty = true;
    });
})();

/* ======================================================================
   11 — シーン（光・環境光・露出・トーンマッピング）
   ====================================================================== */
(function () {
    var cv = $("#sceneCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    // 露出とトーンマッピングの実験。白飛びを見せるのが目的なので、
    // ハイライトが面の間に落ちない程度には分割しておく
    var mesh = buildMesh(makeShape(PROFILES.tomato, { bump: 0.03, ridge: 6, ridgeAmp: 0.02, seed: 3, height: PROFILE_H.tomato }), 48, 64);
    var ang = -35, ambK = 1, expo = 1, tm = true;
    var warnEl = $("#scWarn");

    function albedo(u, v) {
        var base = MATS.tomato.col;
        var n = Noise.fbmu(u * 8, v * 10, 8, 5, 3);
        var sh = smooth(0.78, 1.0, v);
        return [
            clamp(base[0] * (0.88 + 0.2 * n), 0, 1),
            clamp(base[1] + 0.28 * sh + 0.05 * n, 0, 1),
            clamp(base[2] + 0.05 * n, 0, 1)
        ];
    }

    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        var rad = ang * Math.PI / 180;
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: spin(now, 0.35),
            light: [Math.sin(rad), 0.72, -Math.cos(rad)],
            mat: {
                rough: 0.19, coat: 0.40, sss: 0.28, sheen: 0,
                sssCol: [1.0, 0.25, 0.15],
                ambK: ambK, expo: expo, tonemap: tm
            },
            albedo: albedo
        });
        if (warnEl) {
            warnEl.textContent = (!tm && expo > 1.3) ? "ハイライトが真っ白に潰れています"
                : (ambK < 0.25 ? "影が真っ黒に沈んでいます" : "だいたい素直に見えています");
        }
    });

    slider("#scLight", "#scLightV", function (n) { return (n | 0) + "°"; }, function (n) { ang = n; });
    slider("#scAmb", "#scAmbV", function (n) { return n.toFixed(2); }, function (n) { ambK = n; });
    slider("#scExpo", "#scExpoV", function (n) { return n.toFixed(2); }, function (n) { expo = n; });
    var swTone = $("#scTone");
    if (swTone) swTone.addEventListener("change", function () { tm = swTone.checked; });
})();

/* ======================================================================
   12 — 再帰の打ち切り（ロマネスコ）
   円錐の側面図を再帰で描く。打ち切りを「階層数」でやるか
   「粒の大きさ」でやるかで、末端の揃い方がまるで変わる。
   ====================================================================== */
(function () {
    var cv = $("#fracCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var K = 0.52, MINC = 1.5, byDepth = false;
    var LAM = 0.62, TILT = 0.58, SINK = 0.30, ASP = 1.95;
    var FILL = ["#3f5a16", "#4e6c1c", "#5f8022", "#729429", "#86a832", "#9dbd3e"];
    var HEAD_R = 42;                              // mm。頭の底面半径
    var st, mark;

    function grow(ax, ay, ux, uy, rho, H, depth) {
        if (st.total > 24000) { st.over = true; return; }
        var px = -uy, py = ux;                    // 軸に垂直な向き
        var bx = ax + ux * H, by = ay + uy * H;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx + px * rho, by + py * rho);
        ctx.lineTo(bx - px * rho, by - py * rho);
        ctx.closePath();
        ctx.fillStyle = FILL[Math.min(depth, FILL.length - 1)];
        ctx.fill();
        st.total++;

        // ここが本題。打ち切りの条件だけが違う
        var leaf = byDepth ? (depth >= 3) : (K * rho < MINC);
        if (leaf) { mark_leaf(rho); return; }
        // 子を「頂点からの距離が等比数列」で置く。両側の母線に置けば側面図になる
        var placed = 0;
        for (var i = 0; i < 40; i++) {
            var f = 0.985 * Math.pow(LAM, i);
            var cr = K * rho * f;
            if (cr < MINC) break;
            placed++;
            for (var s = -1; s <= 1; s += 2) {
                var qx = ax + ux * (H * f) + px * (rho * f) * s;
                var qy = ay + uy * (H * f) + py * (rho * f) * s;
                // 母線の外向き法線
                var nx = (px * H - ux * rho) * s, ny = (py * H - uy * rho) * s;
                var nl = Math.sqrt(nx * nx + ny * ny) || 1;
                nx /= nl; ny /= nl;
                // 親の軸へ寄せる。寄せないと小塔が真横へ張り出してヒトデになる
                var cxu = mix(nx, ux, TILT), cyu = mix(ny, uy, TILT);
                var cl = Math.sqrt(cxu * cxu + cyu * cyu) || 1;
                cxu /= cl; cyu /= cl;
                grow(qx - cxu * cr * SINK, qy - cyu * cr * SINK,
                     cxu, cyu, cr, cr * ASP, depth + 1);
            }
        }
        // 1個も子が置けなかったものも末端として数える
        if (!placed) mark_leaf(rho);
    }

    function mark_leaf(rho) {
        st.leaves++;
        var d = rho * 2;
        if (d < st.min) st.min = d;
        if (d > st.max) st.max = d;
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        st = { total: 0, leaves: 0, min: 1e9, max: 0, over: false };
        var H = HEAD_R * 2.35;
        var scale = Math.min((c.H - 36) / H, (c.W - 40) / (HEAD_R * 2.6));
        ctx.save();
        ctx.translate(c.W / 2, 18);
        ctx.scale(scale, scale);
        grow(0, 0, 0, 1, HEAD_R, H, 0);
        ctx.restore();

        var el = $("#fracOut");
        if (el) {
            var ok = st.leaves > 0 && st.max > 0;
            var ratio = ok ? st.max / st.min : 1;
            el.innerHTML =
                "円錐の総数：<b>" + st.total + (st.over ? "+（描画を打ち切り）" : "") + " 個</b><br>" +
                "末端の粒：<b>" + st.leaves + " 個</b><br>" +
                "末端の大きさ：<b>" + (ok
                    ? Math.round(st.min * 10) / 10 + " 〜 " + Math.round(st.max * 10) / 10 + " mm"
                    : "—") + "</b><br>" +
                "いちばん大きい粒 ÷ いちばん小さい粒：<b>" + ratio.toFixed(1) + " 倍</b>" +
                (ratio > 2.2
                    ? '<br><span style="color:#b4321c">末端の大きさが揃っていません</span>'
                    : "");
        }
    }

    mark = lazyLoop(cv, draw);
    slider("#fracK", "#fracKV", function (n) { return n.toFixed(2); },
        function (n) { K = n; mark(); });
    slider("#fracMin", "#fracMinV", function (n) { return n.toFixed(1) + " mm"; },
        function (n) { MINC = n; mark(); });
    var sw = $("#fracDepth");
    if (sw) sw.addEventListener("change", function () { byDepth = sw.checked; mark(); });
})();

/* ======================================================================
   13 — 葉序（黄金角）
   点を i·α ずつ回して置くだけ。斜列（見える螺旋）の本数は
   α をフィボナッチ数倍したときの「1周からのずれ」で決まる。
   ====================================================================== */
(function () {
    var cv = $("#phylCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var ang = 137.5, N = 140, link = true;
    var mark;
    var FIB = { 1: 1, 2: 1, 3: 1, 5: 1, 8: 1, 13: 1, 21: 1, 34: 1, 55: 1, 89: 1 };

    // 目に見える斜列 = 「i 番目といちばん近くに並ぶのは i+m 番目か」を実測する。
    // 黄金角のときだけ、この m がフィボナッチ数になる。
    function parastichy(pts, n) {
        var i0 = Math.round(n * 0.55);
        var lim = Math.min(89, n - i0 - 1), cand = [], m;
        for (m = 1; m <= lim; m++) {
            var dx = pts[i0][0] - pts[i0 + m][0], dy = pts[i0][1] - pts[i0 + m][1];
            cand.push([m, dx * dx + dy * dy]);
        }
        cand.sort(function (a, b) { return a[1] - b[1]; });
        return cand.slice(0, 3).map(function (c) { return c[0]; })
            .sort(function (a, b) { return a - b; });
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        var cx = c.W / 2, cy = c.H / 2;
        var R = Math.min(c.W, c.H) / 2 - 16;
        var pts = [], i, t, r;
        for (i = 0; i < N; i++) {
            t = i * ang * Math.PI / 180;
            r = R * Math.sqrt((i + 0.5) / N);
            pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
        }
        var fam = parastichy(pts, N);
        if (link) {
            var COL = ["#DA130E", "#1667c8", "#C98A05"];
            for (var k = 0; k < fam.length; k++) {
                ctx.strokeStyle = COL[k]; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.55;
                ctx.beginPath();
                for (i = 0; i + fam[k] < N; i++) {
                    ctx.moveTo(pts[i][0], pts[i][1]);
                    ctx.lineTo(pts[i + fam[k]][0], pts[i + fam[k]][1]);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        for (i = 0; i < N; i++) {
            var s = 2.4 + 4.2 * Math.sqrt((i + 0.5) / N);
            ctx.fillStyle = "#2B6F1C";
            ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], s, 0, TAU); ctx.fill();
        }
        var el = $("#phylOut");
        if (el) {
            var allFib = fam.length === 3 && fam.every(function (m) { return FIB[m]; });
            el.innerHTML = "見える螺旋（斜列）の本数：<b>" + fam.join(" ／ ") + "</b><br>" +
                (allFib ? "3つともフィボナッチ数です"
                    : '<span style="color:#b4321c">フィボナッチ数から外れました</span>');
        }
    }

    mark = lazyLoop(cv, draw);
    slider("#phylAng", "#phylAngV", function (n) { return n.toFixed(1) + "°"; },
        function (n) { ang = n; mark(); });
    slider("#phylN", "#phylNV", function (n) { return (n | 0) + " 個"; },
        function (n) { N = Math.max(20, n | 0); mark(); });
    var sw = $("#phylLink");
    if (sw) sw.addEventListener("change", function () { link = sw.checked; mark(); });
    $$("#phylPre .chip").forEach(function (b) {
        b.addEventListener("click", function () {
            var el = $("#phylAng");
            el.value = b.dataset.a;
            el.dispatchEvent(new Event("input"));
            $$("#phylPre .chip").forEach(function (o) {
                o.setAttribute("aria-pressed", o === b ? "true" : "false");
            });
        });
    });
})();

/* ----------------------------------------------------------------------
   花蕾（房＋粒）のミニチュア。14章と16章で共有する。
   ブロッコリー.js の sphereAO と同じ式を使っている。
   ---------------------------------------------------------------------- */
function drawCurd(c, o) {
    var ctx = c.ctx;
    ctx.clearRect(0, 0, c.W, c.H);
    var R = Math.min(c.W, c.H) * 0.42;
    var cx = c.W / 2, cy = c.H / 2 + R * 0.06;
    var rng = new Rng(4711);

    // --- 房を半球のうえに置く（フィボナッチ格子）---
    var M = 15, domes = [], i, k;
    var w = Math.sqrt(2 / M);                       // 房ひとつぶんの角半径
    for (i = 0; i < M; i++) {
        var z = 1 - (i + 0.5) / M * 0.92;
        var rr = Math.sqrt(Math.max(0, 1 - z * z));
        var th = i * 2.3999632 + 0.7;
        var d = [rr * Math.cos(th), rr * Math.sin(th) * 0.86 + z * 0.30, z * 0.94];
        var dl = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
        d = [d[0] / dl, d[1] / dl, d[2] / dl];
        var Rd = w * o.swell * (0.86 + 0.28 * rng.next());
        domes.push({
            d: d, R: Rd,
            c: [d[0] * (1 - Rd * 0.55), d[1] * (1 - Rd * 0.55), d[2] * (1 - Rd * 0.55)]
        });
    }

    // --- 粒をならべる ---
    var buds = [];
    for (k = 0; k < domes.length; k++) {
        var dm = domes[k];
        var B = Math.max(18, Math.round(120 * dm.R * dm.R / (w * w)));
        var spin = rng.range(0, TAU);
        for (i = 0; i < B; i++) {
            var lz = 1 - 2 * (i + 0.5) / B;
            var lr = Math.sqrt(Math.max(0, 1 - lz * lz));
            var t2 = i * 2.3999632 + spin;
            var u = [lr * Math.cos(t2), lr * Math.sin(t2), lz];
            // 房の軸（= 頭の法線）から見て裏側は刈る
            if (u[0] * dm.d[0] + u[1] * dm.d[1] + u[2] * dm.d[2] < -0.30) continue;
            var p = [dm.c[0] + u[0] * dm.R, dm.c[1] + u[1] * dm.R, dm.c[2] + u[2] * dm.R];
            // 隣の房にめり込む粒は捨てる
            var inside = false;
            for (var j = 0; j < domes.length && !inside; j++) {
                if (j === k) continue;
                var q = domes[j];
                var ddx = p[0] - q.c[0], ddy = p[1] - q.c[1], ddz = p[2] - q.c[2];
                if (ddx * ddx + ddy * ddy + ddz * ddz < q.R * q.R * 0.985) inside = true;
            }
            if (inside) continue;
            // 遮蔽。隣の房が空をどれだけ覆っているかを立体角で足す
            var occ = 0;
            for (j = 0; j < domes.length; j++) {
                if (j === k) continue;
                var e = domes[j];
                var vx = e.c[0] - p[0], vy = e.c[1] - p[1], vz = e.c[2] - p[2];
                var dist = Math.sqrt(vx * vx + vy * vy + vz * vz);
                if (dist < 1e-4) continue;
                var nd = (vx * u[0] + vy * u[1] + vz * u[2]) / dist;
                if (nd <= 0) continue;
                var q2 = e.R / Math.max(dist, e.R * 1.0001);
                occ += 0.5 * (1 - Math.sqrt(Math.max(0, 1 - q2 * q2))) * nd;
            }
            buds.push({ p: p, n: u, ao: clamp(1 - occ * o.ao, o.floor, 1) });
        }
    }
    buds.sort(function (a, b) { return a.p[2] - b.p[2]; });

    // --- 描く ---
    var TOP = o.top, SIDE = o.side, DEEP = o.deep;
    var LX = -0.42, LY = -0.72, LZ = 0.55;
    var rr2 = R * w * 0.30 * (0.72 + 0.5 * o.asp);
    for (i = 0; i < buds.length; i++) {
        var b = buds[i], n = b.n;
        var lam = clamp(n[0] * LX + n[1] * LY + n[2] * LZ, 0, 1);
        var e2 = smooth(0.05, 0.85, 0.30 + 0.70 * lam);
        var col = [mix(SIDE[0], TOP[0], e2), mix(SIDE[1], TOP[1], e2), mix(SIDE[2], TOP[2], e2)];
        // 遮蔽は黒で掛けるのではなく、谷の色へ寄せる
        col = [mix(DEEP[0], col[0], b.ao), mix(DEEP[1], col[1], b.ao), mix(DEEP[2], col[2], b.ao)];
        var sx = cx + b.p[0] * R, sy = cy - b.p[1] * R;
        var rad = rr2 * (0.86 + 0.30 * (b.p[2] + 1) / 2);
        // 潰れた粒（asp が小さい）ほど内部の陰影が浅い＝融合して見える
        var g = ctx.createRadialGradient(sx - rad * 0.34, sy - rad * 0.40, rad * 0.1, sx, sy, rad);
        var hi = 1 + 0.30 * o.asp;
        g.addColorStop(0, "rgb(" + (col[0] * 255 * hi | 0) + "," + (col[1] * 255 * hi | 0) + "," + (col[2] * 255 * hi | 0) + ")");
        g.addColorStop(1, "rgb(" + (col[0] * 255 * (1 - 0.30 * o.asp) | 0) + "," +
            (col[1] * 255 * (1 - 0.30 * o.asp) | 0) + "," + (col[2] * 255 * (1 - 0.30 * o.asp) | 0) + ")");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.fill();
    }
    return buds.length;
}

var CURD_GREEN = { top: [0.330, 0.455, 0.235], side: [0.170, 0.268, 0.128], deep: [0.058, 0.098, 0.050] };
var CURD_WHITE = { top: [0.930, 0.912, 0.845], side: [0.822, 0.798, 0.718], deep: [0.560, 0.536, 0.462] };

/* ======================================================================
   14 — 頂点カラーと焼き込みAO（ブロッコリー）
   ====================================================================== */
(function () {
    var cv = $("#curdCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var ao = 1.02, floor = 0.20, white = false;
    var mark;

    function draw() {
        var pal = white ? CURD_WHITE : CURD_GREEN;
        var n = drawCurd(c, {
            swell: 1.0, asp: 1.28, ao: ao, floor: floor,
            top: pal.top, side: pal.side, deep: pal.deep
        });
        var el = $("#curdOut");
        if (el) {
            el.innerHTML = "粒の数：<b>" + n + " 個</b>（本物は2〜4万個）<br>" +
                (ao < 0.15 ? "<b>谷が明るいままです。粒はあるのに平板に見えます</b>"
                    : (white && floor < 0.35 ? "<b>白い野菜に墨を流したようになっています</b>"
                        : "谷が締まって、粒が粒に見えています"));
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#curdAO", "#curdAOV", function (n) { return n.toFixed(2); },
        function (n) { ao = n; mark(); });
    slider("#curdFloor", "#curdFloorV", function (n) { return n.toFixed(2); },
        function (n) { floor = n; mark(); });
    var sw = $("#curdWhite");
    if (sw) sw.addEventListener("change", function () { white = sw.checked; mark(); });
})();

/* ======================================================================
   15 — シェル法の産毛（枝豆）
   毛は殻を重ねているだけ。輪郭が濃くなるのは、そこだけ
   同じ毛を斜めから何枚も透かして見ることになるから。
   ====================================================================== */
(function () {
    var cv = $("#fuzzCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var shells = 2, len = 0.075, alpha = 0.30;
    var mark, pts = [];
    var rng = new Rng(90210);
    for (var i = 0; i < 2600; i++) {
        var z = 1 - 2 * (i + 0.5) / 2600;
        var r = Math.sqrt(Math.max(0, 1 - z * z));
        var t = i * 2.3999632;
        pts.push([r * Math.cos(t), z, r * Math.sin(t), rng.range(0.7, 1.3)]);
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        var R = Math.min(c.W / 2.6, c.H / 1.7);
        var cx = c.W / 2, cy = c.H / 2;
        var SX = R * 1.15, SY = R * 0.40, SZ = R * 0.30;   // 莢のかたち（扁平）

        // 莢そのもの
        ctx.fillStyle = "#4a7a24";
        ctx.beginPath(); ctx.ellipse(cx, cy, SX, SY, 0, 0, TAU); ctx.fill();

        var k, j, drawn = 0;
        for (k = 0; k < shells; k++) {
            var g = 1 + len * (k + 1);
            var a = alpha * Math.pow(0.55, k);
            ctx.fillStyle = "rgba(214,219,186," + a.toFixed(3) + ")";
            for (j = 0; j < pts.length; j++) {
                var p = pts[j];
                if (p[2] < -0.15) continue;                 // 裏側は描かない
                var x = cx + p[0] * SX * g;
                var y = cy - p[1] * SY * g;
                ctx.beginPath(); ctx.arc(x, y, 0.85 * p[3], 0, TAU); ctx.fill();
                drawn++;
            }
        }
        var el = $("#fuzzOut");
        if (el) {
            el.innerHTML = "描いた毛：<b>" + drawn + " 個</b>（殻 " + shells + " 枚）<br>" +
                (shells === 0 ? "<b>輪郭がつるつるです。産毛は法線マップでは出ません</b>"
                    : "輪郭のあたりだけ毛が濃く見えています");
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#fuzzShell", "#fuzzShellV", function (n) { return (n | 0) + " 枚"; },
        function (n) { shells = n | 0; mark(); });
    slider("#fuzzLen", "#fuzzLenV", function (n) { return n.toFixed(3); },
        function (n) { len = n; mark(); });
    slider("#fuzzA", "#fuzzAV", function (n) { return n.toFixed(2); },
        function (n) { alpha = n; mark(); });
})();

/* ======================================================================
   16 — 差分でつくる（ブロッコリー → カリフラワー）
   ====================================================================== */
(function () {
    var cv = $("#diffCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var f = { swell: false, fuse: false, ao: false, col: false };
    var mark;

    function draw() {
        var pal = f.col ? CURD_WHITE : CURD_GREEN;
        drawCurd(c, {
            swell: f.swell ? 1.22 : 0.94,
            asp: f.fuse ? 0.52 : 1.28,
            ao: f.ao ? 0.48 : 1.02,
            floor: f.ao ? 0.56 : 0.20,
            top: pal.top, side: pal.side, deep: pal.deep
        });
        var n = (f.swell ? 1 : 0) + (f.fuse ? 1 : 0) + (f.ao ? 1 : 0) + (f.col ? 1 : 0);
        var el = $("#diffOut");
        if (el) {
            el.innerHTML = "変えた項目：<b>" + n + " / 4</b><br>" +
                (n === 0 ? "ブロッコリー"
                    : n === 4 ? "カリフラワー"
                        : (f.col ? "<b style='color:#b4321c'>白いブロッコリー（色だけでは別物になりません）</b>"
                            : "まだブロッコリー寄りです"));
        }
    }
    mark = lazyLoop(cv, draw);
    ["Swell", "Fuse", "Ao", "Col"].forEach(function (key) {
        var el = $("#diff" + key); if (!el) return;
        var k = key.toLowerCase();
        el.addEventListener("change", function () { f[k] = el.checked; mark(); });
    });
})();

/* ======================================================================
   用語集の絞り込み
   ====================================================================== */
(function () {
    var box = $("#termFilter"); if (!box) return;
    var rows = $$("#termTable tr");
    box.addEventListener("input", function () {
        var q = box.value.trim().toLowerCase();
        rows.forEach(function (tr, i) {
            if (i === 0) return;                    // 見出し行
            var hit = !q || tr.textContent.toLowerCase().indexOf(q) >= 0;
            tr.classList.toggle("hide", !hit);
        });
    });
})();

})();

