/* =======================================================================
   08章の実験 — 本物の Havok を動かす

   このファイルだけは、ほかの実験と違って Babylon.js と Havok を
   CDN から読み込む。18本のサンプルとまったく同じ API を使いたいので、
   自前の簡易物理ではなく本物を動かしている。
   パラメータ（重力620・120Hz・摩擦0.88・反発0.02・0.26秒おきに1本）は
   ニンジン.js の GLOBAL からそのまま持ってきた値。

   ダウンロードが大きい（合計10MBほど）ので、ボタンを押すまで読み込まない。
   ======================================================================= */
(function () {
"use strict";

var CDN_BABYLON = "https://cdn.babylonjs.com/babylon.js";
var CDN_HAVOK = "https://cdn.babylonjs.com/havok/HavokPhysics_umd.js";
var CDN_ENV = "https://assets.babylonjs.com/environments/environmentSpecular.env";

var cv = document.getElementById("hkCanvas");
if (!cv) return;

var elStart = document.getElementById("hkStart");
var elStatus = document.getElementById("hkStatus");
var elCount = document.getElementById("hkCount");
var elOne = document.getElementById("hkOne");
var elAll = document.getElementById("hkAll");
var elReset = document.getElementById("hkReset");
var elFric = document.getElementById("hkFric");
var elRest = document.getElementById("hkRest");
var elGrav = document.getElementById("hkGrav");
var elFricV = document.getElementById("hkFricV");
var elRestV = document.getElementById("hkRestV");
var elGravV = document.getElementById("hkGravV");
var elPanel = document.getElementById("hkPanel");

// ニンジン.js の GLOBAL と同じ値
var CFG = {
    gravity: 620,        // cm/s^2（実寸どおりなら 981）
    physicsHz: 120,      // 固定タイムステップ
    pieceMass: 1.0,
    friction: 0.88,
    restitution: 0.02,
    linearDamping: 0.15,
    angularDamping: 0.90,
    dropInterval: 0.26,
    // サンプルは 1.6。落ちる瞬間が見えるように少しだけ高くしてある。
    // ここを大きくすると落下が速くなり、着地で山が崩れる
    dropClearance: 3.0,
    basketRim: 18.0,
    basketDepth: 6.0,
    count: 8
};

function status(msg) { if (elStatus) elStatus.textContent = msg; }
function setBusy(on) {
    [elOne, elAll, elReset, elFric, elRest, elGrav].forEach(function (el) {
        if (el) el.disabled = on;
    });
}
setBusy(true);

function loadScript(src) {
    return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error(src + " を読み込めませんでした")); };
        document.head.appendChild(s);
    });
}

/* ----------------------------------------------------------------------
   起動
   ---------------------------------------------------------------------- */
var started = false;
if (elStart) {
    elStart.addEventListener("click", function () {
        if (started) return;
        started = true;
        elStart.disabled = true;
        boot();
    });
}

function boot() {
    status("Babylon.js を読み込んでいます…（約8MB）");
    loadScript(CDN_BABYLON)
        .then(function () {
            status("Havok を読み込んでいます…（約2MB）");
            return loadScript(CDN_HAVOK);
        })
        .then(function () {
            status("物理エンジンを初期化しています…");
            return HavokPhysics();
        })
        .then(function (havok) {
            if (elStart) elStart.style.display = "none";
            if (elPanel) elPanel.hidden = false;
            build(havok);
        })
        .catch(function (err) {
            started = false;
            if (elStart) { elStart.disabled = false; elStart.textContent = "もう一度ためす"; }
            status("読み込みに失敗しました。インターネットに接続されているか確認してください。（" + err.message + "）");
            console.warn("[havok-lab]", err);
        });
}

/* ----------------------------------------------------------------------
   シーン
   ---------------------------------------------------------------------- */
function build(havok) {
    var V3 = BABYLON.Vector3;
    // deterministicLockstep = 固定ステップのまま、実時間に追いつくよう
    // 1フレームに必要な回数だけ物理を進める（最大 lockstepMaxSteps 回）。
    // これが無いと「1フレーム＝1/120秒」になり、
    // 60fps の画面では物理がちょうど半分の速さで進んでしまう。
    var engine = new BABYLON.Engine(cv, true, {
        preserveDrawingBuffer: false,
        stencil: false,
        deterministicLockstep: true,
        lockstepMaxSteps: 8,
        timeStep: 1 / CFG.physicsHz
    });
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.937, 0.945, 0.918, 1);

    // 【対策】HavokPlugin の第1引数は _useDeltaForWorldStep。
    //         true だとフレームのデルタでそのまま積分するので、
    //         フレーム落ちのたびにステップ幅が変わって接触が暴れる。
    //         false にして固定ステップにする（サンプルと同じ）。
    var hk = new BABYLON.HavokPlugin(false, havok);
    scene.enablePhysics(new V3(0, -CFG.gravity, 0), hk);
    if (hk.setTimeStep) hk.setTimeStep(1 / CFG.physicsHz);

    try {
        var env = BABYLON.CubeTexture.CreateFromPrefilteredData(CDN_ENV, scene);
        scene.environmentTexture = env;
        env.lodGenerationOffset = 0.8;
        scene.environmentIntensity = 0.70;
    } catch (e) { /* 環境マップが無くてもライトだけで見える */ }

    var camera = new BABYLON.ArcRotateCamera("cam", -1.15, 1.12, 62, new V3(0, 2.0, 0), scene);
    camera.attachControl(cv, true);
    camera.fov = 0.6;
    camera.lowerRadiusLimit = 28;
    camera.upperRadiusLimit = 110;
    camera.upperBetaLimit = 1.48;
    camera.wheelDeltaPercentage = 0.02;

    var hemi = new BABYLON.HemisphericLight("h", new V3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.55;
    var dir = new BABYLON.DirectionalLight("d", new V3(-0.45, -1, 0.35), scene);
    dir.position = new V3(24, 44, -20);
    dir.intensity = 2.2;
    dir.shadowMinZ = 1; dir.shadowMaxZ = 130;
    var shadow = new BABYLON.ShadowGenerator(1024, dir);
    // 指数シャドウマップは光がにじんで、器を透かして影が出てしまう。
    // PCF は深度を素直に比べるので、器の裏に野菜の影が抜けない
    shadow.usePercentageCloserFiltering = true;
    shadow.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    shadow.setDarkness(0.32);

    function pbr(name, rgb, rough) {
        var m = new BABYLON.PBRMaterial(name, scene);
        m.albedoColor = BABYLON.Color3.FromArray(rgb).toLinearSpace();
        m.metallic = 0;
        m.roughness = rough;
        return m;
    }

    /* --- 床 --- */
    var ground = BABYLON.MeshBuilder.CreateDisc("ground", { radius: 60, tessellation: 64 }, scene);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -1.7;
    ground.material = pbr("mGround", [0.80, 0.81, 0.77], 0.92);
    ground.receiveShadows = true;
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.7, restitution: 0.02 }, scene);

    /* --- ざる（回転体） --- */
    var R = CFG.basketRim, D = CFG.basketDepth, TH = 0.55;
    var prof = [];
    // 器の内側の断面（半径, 高さ）。あとで position.y に D を足して焼き込むので、
    // 焼いたあとの内側の高さは この y + D になる
    var outer = [[0, -D], [R * 0.34, -D * 0.93], [R * 0.62, -D * 0.72],
                 [R * 0.84, -D * 0.36], [R * 0.96, D * 0.16], [R, D * 0.55]];
    for (var i = 0; i < outer.length; i++) prof.push(new V3(outer[i][0], outer[i][1], 0));
    for (var j = outer.length - 1; j >= 0; j--) {
        prof.push(new V3(outer[j][0] + (j === 0 ? 0 : TH), outer[j][1] + TH, 0));
    }
    // 断面を閉じた輪にしてあるので、これだけで厚みのある殻になる。
    // 両面（DOUBLESIDE）にすると同じ位置に裏表2枚が重なり、
    // シャドウマップで自分自身に影を落として同心円状のノイズが出る
    var basket = BABYLON.MeshBuilder.CreateLathe("basket", {
        shape: prof, tessellation: 72, closed: true
    }, scene);
    basket.position.y = D;
    basket.material = pbr("mBasket", [0.72, 0.60, 0.36], 0.72);
    basket.receiveShadows = true;
    basket.bakeCurrentTransformIntoVertices();

    // 器のように「へこんだ形」は、箱や球では代用できない。
    // 三角形メッシュそのものを当たり判定にする（静止物だけに許される）
    var bShape = new BABYLON.PhysicsShapeMesh(basket, scene);
    bShape.material = { friction: 0.68, restitution: 0.0 };
    var bBody = new BABYLON.PhysicsBody(basket, BABYLON.PhysicsMotionType.STATIC, false, scene);
    bBody.shape = bShape;
    // 器も影を落とす側にしないと、器が光を遮らないことになり、
    // 器の下の床に野菜の影だけが浮いて見える
    shadow.addShadowCaster(basket);

    // 半径 r における器の内側（野菜が乗る面）の高さ。
    // outer は殻の下面なので、肉厚 TH ぶん上が内側になる
    function bowlSurfaceY(r) {
        var y;
        if (r <= outer[0][0]) y = outer[0][1];
        else {
            y = outer[outer.length - 1][1];
            for (var i = 1; i < outer.length; i++) {
                if (r <= outer[i][0]) {
                    var t = (r - outer[i - 1][0]) / (outer[i][0] - outer[i - 1][0]);
                    y = outer[i - 1][1] + (outer[i][1] - outer[i - 1][1]) * t;
                    break;
                }
            }
        }
        return y + TH + D;
    }

    /* --- 野菜 --- */
    var mCarrot = pbr("mCarrot", [0.886, 0.412, 0.110], 0.55);
    var mTomato = pbr("mTomato", [0.855, 0.075, 0.055], 0.30);
    var mKyuri = pbr("mKyuri", [0.196, 0.404, 0.145], 0.42);

    var seed = 20260801;
    function rnd() {
        seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function rng(a, b) { return a + (b - a) * rnd(); }

    function makePiece(k) {
        var m;
        if (k % 3 === 0) {
            m = BABYLON.MeshBuilder.CreateCylinder("carrot" + k, {
                height: rng(14, 17), diameterTop: 0.7, diameterBottom: rng(3.2, 4.0), tessellation: 18
            }, scene);
            m.material = mCarrot;
        } else if (k % 3 === 1) {
            var d = rng(6.0, 7.2);
            m = BABYLON.MeshBuilder.CreateSphere("tomato" + k, {
                diameterX: d, diameterZ: d, diameterY: d * 0.84, segments: 14
            }, scene);
            m.material = mTomato;
        } else {
            m = BABYLON.MeshBuilder.CreateCapsule("kyuri" + k, {
                height: rng(15, 18), radius: rng(1.5, 1.8), tessellation: 16, subdivisions: 1
            }, scene);
            m.material = mKyuri;
        }
        m.receiveShadows = true;
        shadow.addShadowCaster(m);
        return m;
    }

    var pieces = [];
    for (var p = 0; p < CFG.count; p++) {
        pieces.push({ mesh: makePiece(p), body: null, shape: null });
    }

    /* ------------------------------------------------------------------
       落とす
       ------------------------------------------------------------------ */
    var queue = [], timer = 0, mode = "one", dropped = 0;

    function friction() { return elFric ? +elFric.value : CFG.friction; }
    function restitution() { return elRest ? +elRest.value : CFG.restitution; }

    function clearBodies() {
        for (var i = 0; i < pieces.length; i++) {
            var e = pieces[i];
            if (e.body) { e.body.dispose(); e.body = null; }
            if (e.shape) { e.shape.dispose(); e.shape = null; }
            e.mesh.setEnabled(false);
        }
        dropped = 0;
        if (elCount) elCount.textContent = "0 / " + CFG.count + " 個";
    }

    // (x,z) のまわりで、すでに積まれている野菜の一番高いところ
    function pileTopAt(x, z, rad) {
        var top = -1e9;
        for (var i = 0; i < pieces.length; i++) {
            if (!pieces[i].body) continue;
            var bb = pieces[i].mesh.getBoundingInfo().boundingBox;
            var c = bb.centerWorld, ext = bb.extendSizeWorld;
            var d = Math.hypot(c.x - x, c.z - z);
            if (d < rad + Math.max(ext.x, ext.z)) top = Math.max(top, c.y + ext.y);
        }
        return top;
    }

    function spawn(item) {
        var e = item.e, m = e.mesh;
        m.setEnabled(true);
        // 【対策】物理で動かすノードは rotationQuaternion を使う。
        //         Euler の rotation のままだと Havok 側の姿勢と食い違う
        m.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
            item.rx, item.ry, item.rz);
        m.position.set(item.x, 0, item.z);
        m.computeWorldMatrix(true);

        // 落とす高さ。高いところから落とすと速度がついて山が崩れるので、
        // サンプルと同じく「いま積まれている山の頂点のすぐ上」から放す。
        // 全部いっぺんに出すモードだけは、わざと重ねたいので固定の高さにする。
        var bb0 = m.getBoundingInfo().boundingBox;
        var halfY = bb0.extendSizeWorld.y;
        var rad = Math.max(bb0.extendSizeWorld.x, bb0.extendSizeWorld.z);
        if (mode === "one") {
            var base = Math.max(bowlSurfaceY(Math.hypot(item.x, item.z)),
                                pileTopAt(item.x, item.z, rad));
            m.position.y = base + CFG.dropClearance + halfY;
        } else {
            m.position.y = bowlSurfaceY(0) + 3.5;
        }
        m.computeWorldMatrix(true);

        var shape = new BABYLON.PhysicsShapeConvexHull(m, scene);
        shape.material = { friction: friction(), restitution: restitution() };
        var body = new BABYLON.PhysicsBody(m, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        body.shape = shape;
        body.setMassProperties({ mass: CFG.pieceMass });
        // 【対策】damping は PhysicsAggregate のオプションに書いても効かない
        body.setLinearDamping(CFG.linearDamping);
        body.setAngularDamping(CFG.angularDamping);
        // 【対策】毎フレーム「ノードの姿勢 → 物理ボディ」へ書き戻すと、
        //         物理の出した結果を押し戻す往復が起きる
        body.disablePreStep = true;

        e.body = body; e.shape = shape;
        dropped++;
        if (elCount) elCount.textContent = dropped + " / " + CFG.count + " 個";
    }

    // one : ばらけた位置から 0.26 秒おきに1個ずつ
    // all : ほぼ同じ場所に全部いっぺんに（＝互いにめり込んだ状態で始まる）
    function reset(newMode) {
        mode = newMode || mode;
        clearBodies();
        queue = [];
        seed = 20260801;
        var a0 = rng(0, Math.PI * 2);
        for (var i = 0; i < pieces.length; i++) {
            // one : 黄金角でばらけさせる（サンプルと同じ）
            // all : ぜんぶ同じ場所。互いに完全にめり込んだ状態から始まる
            var r = mode === "one" ? CFG.basketRim * 0.34 * Math.sqrt(rnd()) : 0;
            var a = a0 + i * 2.39996;            // 黄金角
            rnd();                                // 姿勢の乱数を one/all で揃える
            queue.push({
                e: pieces[i],
                x: Math.cos(a) * r, z: Math.sin(a) * r,
                // 【対策】長い野菜を完全にランダムな姿勢で落とすと、
                //         立ったまま刺さって器から生える。長手を水平に寝かせる
                rx: rng(-0.35, 0.35), ry: rng(0, Math.PI * 2), rz: Math.PI / 2 + rng(-0.3, 0.3)
            });
        }
        if (mode === "all") {
            while (queue.length) spawn(queue.shift());
            status("全部いっぺんに出しました。めり込みを押しのけ合って、中央に固まります。");
        } else {
            timer = 0;
            status("0.26秒おきに1個ずつ落としています。");
        }
    }

    // 落とす間隔は「物理の時計」で数える。描画のフレームレートで
    // 数えると、重い機械では物理が追いつく前に次が降ってくる。
    scene.onBeforeStepObservable.add(function () {
        if (mode !== "one" || !queue.length) return;
        timer -= 1 / CFG.physicsHz;
        if (timer <= 0) {
            timer = CFG.dropInterval;
            spawn(queue.shift());
            if (!queue.length) status("盛り付け完了。座標は1つも手で決めていません。");
        }
    });

    /* --- コントロール --- */
    function syncMaterials() {
        for (var i = 0; i < pieces.length; i++) {
            if (pieces[i].shape) {
                pieces[i].shape.material = { friction: friction(), restitution: restitution() };
            }
        }
    }
    if (elFric) elFric.addEventListener("input", function () {
        if (elFricV) elFricV.textContent = (+this.value).toFixed(2);
        syncMaterials();
    });
    if (elRest) elRest.addEventListener("input", function () {
        if (elRestV) elRestV.textContent = (+this.value).toFixed(2);
        syncMaterials();
    });
    if (elGrav) elGrav.addEventListener("input", function () {
        var g = +this.value;
        if (elGravV) elGravV.textContent = g + " cm/s²";
        scene.getPhysicsEngine().setGravity(new V3(0, -g, 0));
        if (g > 900) status("重力を実寸の981に近づけました。接触が解けきらず、野菜が細かく震えます。");
    });

    if (elOne) elOne.addEventListener("click", function () { reset("one"); });
    if (elAll) elAll.addEventListener("click", function () { reset("all"); });
    if (elReset) elReset.addEventListener("click", function () { reset(mode); });

    /* --- 実行 --- */
    setBusy(false);
    reset("one");
    engine.runRenderLoop(function () { scene.render(); });
    window.addEventListener("resize", function () { engine.resize(); });

    // 画面外では回さない（スクロールで戻ってきたら再開）
    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) {
            if (es[0].isIntersecting) {
                engine.runRenderLoop(function () { scene.render(); });
            } else {
                engine.stopRenderLoop();
            }
        }, { rootMargin: "150px" });
        io.observe(cv);
    }
}
})();
