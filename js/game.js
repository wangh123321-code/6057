var GameState = {
    currentLevel: null,
    foldType: null,
    cuts: [],
    cutMask: null,
    stepCount: 0,
    startTime: 0,
    isFolded: false,
    drawTool: 'rect',
    isDrawing: false,
    drawStart: null,
    targetPattern: null,
    resultPattern: null,
    matchScore: 0,
    bestScores: null,
    freehandPoints: []
};

function loadBestScores() {
    try {
        var data = localStorage.getItem('paperCutBestScores');
        GameState.bestScores = data ? JSON.parse(data) : {};
    } catch (e) {
        GameState.bestScores = {};
    }
}

function saveBestScores() {
    try {
        localStorage.setItem('paperCutBestScores', JSON.stringify(GameState.bestScores));
    } catch (e) { }
}

function getLevelStars(levelId) {
    var scores = GameState.bestScores[levelId];
    if (!scores) return 0;
    return scores.stars || 0;
}

function calcStars(value, thresholds) {
    if (value <= thresholds[0]) return 3;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 1;
    return 0;
}

var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },
    create: function () {
        loadBestScores();
        this.scene.start('Menu');
    }
});

var MenuScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function MenuScene() { Phaser.Scene.call(this, { key: 'Menu' }); },
    create: function () {
        var W = this.cameras.main.width, H = this.cameras.main.height;
        var g = this.add.graphics();
        g.fillStyle(0x5C0A0A, 1); g.fillRect(0, 0, W, H);

        for (var i = 0; i < 8; i++) {
            g.fillStyle(0x8B1A1A, 0.15);
            g.fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), Phaser.Math.Between(40, 120), Phaser.Math.Between(40, 120));
        }

        g.lineStyle(2, 0xFFD700, 0.4);
        for (var i = 0; i < 12; i++) {
            var cx = Phaser.Math.Between(50, W - 50), cy = Phaser.Math.Between(50, H - 50);
            g.beginPath();
            for (var j = 0; j < 6; j++) {
                var a = (Math.PI / 3) * j - Math.PI / 2;
                var px = cx + Math.cos(a) * 20, py = cy + Math.sin(a) * 20;
                j === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
            }
            g.closePath(); g.strokePath();
        }

        this.add.text(W / 2, H * 0.25, '剪纸解谜', {
            fontSize: '72px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFD700', stroke: '#8B0000', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(W / 2, H * 0.38, '折 · 剪 · 展 · 惊艳', {
            fontSize: '28px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFC0CB', stroke: '#5C0A0A', strokeThickness: 3
        }).setOrigin(0.5);

        var btnY = H * 0.58;
        this._makeButton(this, W / 2, btnY, 240, 64, '开始游戏', '#FFD700', '#8B0000', function () {
            this.scene.start('LevelSelect');
        }.bind(this));

        this._makeButton(this, W / 2, btnY + 90, 240, 64, '排行榜', '#FFC0CB', '#5C0A0A', function () {
            this.scene.start('Leaderboard');
        }.bind(this));

        this.add.text(W / 2, H * 0.92, '一把剪刀一张红纸，折三折剪两刀', {
            fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#AA6666'
        }).setOrigin(0.5);
    },
    _makeButton: function (scene, x, y, w, h, text, textColor, bgColor, callback) {
        var g = scene.add.graphics();
        g.fillStyle(Phaser.Display.Color.HexStringToColor(bgColor).color, 0.9);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
        g.lineStyle(2, 0xFFD700, 0.8);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);

        var txt = scene.add.text(x, y, text, {
            fontSize: '28px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: textColor
        }).setOrigin(0.5);

        var zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', function () { g.setAlpha(1); txt.setAlpha(1); });
        zone.on('pointerout', function () { g.setAlpha(0.9); txt.setAlpha(0.9); });
        zone.on('pointerdown', callback);
        return zone;
    }
});

var LevelSelectScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function LevelSelectScene() { Phaser.Scene.call(this, { key: 'LevelSelect' }); },
    create: function () {
        var W = this.cameras.main.width, H = this.cameras.main.height;
        var g = this.add.graphics();
        g.fillStyle(0x5C0A0A, 1); g.fillRect(0, 0, W, H);

        this.add.text(W / 2, 35, '选择关卡', {
            fontSize: '36px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFD700', stroke: '#5C0A0A', strokeThickness: 3
        }).setOrigin(0.5);

        var groupNames = ['对折篇', '三角折篇', '四折篇', '六角折篇', '窗花折篇', '团花折篇'];
        for (var gi = 0; gi < 6; gi++) {
            var gx = 60 + gi * 185;
            this.add.text(gx + 80, 75, groupNames[gi], {
                fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
                color: '#FFC0CB'
            }).setOrigin(0.5);
        }

        var cols = 6, cellW = 170, cellH = 60, startX = 70, startY = 100;
        for (var i = 0; i < 60; i++) {
            var col = i % cols, row = Math.floor(i / cols);
            var level = LEVELS[i];
            var cx = startX + col * (cellW + 15) + cellW / 2;
            var cy = startY + row * (cellH + 8) + cellH / 2;
            var unlocked = i === 0 || getLevelStars(LEVELS[i - 1].id) > 0;
            var stars = getLevelStars(level.id);

            var bg = this.add.graphics();
            var color = unlocked ? 0x8B1A1A : 0x4A0A0A;
            bg.fillStyle(color, 0.9);
            bg.fillRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 6);
            bg.lineStyle(1, unlocked ? 0xFFD700 : 0x663333, 0.6);
            bg.strokeRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 6);

            var nameColor = unlocked ? '#FFD700' : '#663333';
            this.add.text(cx - 10, cy - 8, (i + 1) + '. ' + level.name, {
                fontSize: '14px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
                color: nameColor
            }).setOrigin(0, 0.5);

            var starStr = '';
            for (var s = 0; s < 3; s++) starStr += s < stars ? '★' : '☆';
            this.add.text(cx + cellW / 2 - 8, cy + 8, starStr, {
                fontSize: '12px', color: stars > 0 ? '#FFD700' : '#663333'
            }).setOrigin(1, 0.5);

            if (unlocked) {
                var zone = this.add.zone(cx, cy, cellW, cellH).setInteractive({ useHandCursor: true });
                zone.levelIndex = i;
                zone.on('pointerdown', function () {
                    GameState.currentLevel = LEVELS[this.levelIndex];
                    GameState.cuts = [];
                    GameState.foldType = null;
                    GameState.isFolded = false;
                    GameState.stepCount = 0;
                    GameState.startTime = Date.now();
                    GameState.drawTool = 'rect';
                    this.scene.scene.start('Game');
                });
            }
        }

        var backZone = this.add.zone(60, 35, 80, 40).setInteractive({ useHandCursor: true });
        this.add.text(60, 35, '← 返回', {
            fontSize: '20px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
        }).setOrigin(0.5);
        backZone.on('pointerdown', function () { this.scene.start('Menu'); }.bind(this));
    }
});

var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },
    create: function () {
        var W = this.cameras.main.width, H = this.cameras.main.height;
        var N = FoldEngine.GRID_SIZE;
        var level = GameState.currentLevel;
        if (!level) { this.scene.start('LevelSelect'); return; }

        var bg = this.add.graphics();
        bg.fillStyle(0x5C0A0A, 1); bg.fillRect(0, 0, W, H);

        GameState.targetPattern = FoldEngine.computeTarget(level.foldType, level.solutionCuts, N);
        GameState.cutMask = FoldEngine.createGrid(N, 1);
        GameState.foldType = null;
        GameState.isFolded = false;
        GameState.cuts = [];
        GameState.stepCount = 0;
        GameState.startTime = Date.now();

        this.PAPER_SIZE = 320;
        this.PAPER_X = W / 2 - 60;
        this.PAPER_Y = H / 2 + 30;
        this.TARGET_SIZE = 180;
        this.TARGET_X = 120;
        this.TARGET_Y = H / 2 + 30;
        this.SCALE = this.PAPER_SIZE / N;

        this.add.text(W / 2, 25, '第' + level.id + '关 · ' + level.name, {
            fontSize: '28px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFD700', stroke: '#5C0A0A', strokeThickness: 3
        }).setOrigin(0.5);

        this.timerText = this.add.text(W - 150, 15, '时间: 0s', {
            fontSize: '18px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
        });
        this.stepText = this.add.text(W - 150, 40, '步骤: 0', {
            fontSize: '18px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
        });

        this.add.text(this.TARGET_X, this.PAPER_Y - this.PAPER_SIZE / 2 - 30, '目标图案', {
            fontSize: '18px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFD700'
        }).setOrigin(0.5);

        this.targetCanvas = document.createElement('canvas');
        FoldEngine.renderPatternToCanvas(GameState.targetPattern, N, this.targetCanvas, { showFoldLines: false });
        if (this.textures.exists('targetTex')) this.textures.remove('targetTex');
        this.targetTex = this.textures.createCanvas('targetTex', N, N);
        var tCtx = this.targetTex.getContext();
        tCtx.drawImage(this.targetCanvas, 0, 0);
        this.targetTex.refresh();
        this.add.image(this.TARGET_X, this.TARGET_Y, 'targetTex').setDisplaySize(this.TARGET_SIZE, this.TARGET_SIZE);

        var frameG = this.add.graphics();
        frameG.lineStyle(2, 0xFFD700, 0.8);
        frameG.strokeRect(this.TARGET_X - this.TARGET_SIZE / 2 - 2, this.TARGET_Y - this.TARGET_SIZE / 2 - 2, this.TARGET_SIZE + 4, this.TARGET_SIZE + 4);

        this.add.text(this.PAPER_X, this.PAPER_Y - this.PAPER_SIZE / 2 - 30, '操作区域', {
            fontSize: '18px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFD700'
        }).setOrigin(0.5);

        this.paperCanvas = document.createElement('canvas');
        if (this.textures.exists('paperTex')) this.textures.remove('paperTex');
        this.paperTex = this.textures.createCanvas('paperTex', N, N);
        this._renderFullPaper();
        this.paperImage = this.add.image(this.PAPER_X, this.PAPER_Y, 'paperTex').setDisplaySize(this.PAPER_SIZE, this.PAPER_SIZE);

        var paperFrame = this.add.graphics();
        paperFrame.lineStyle(2, 0xFFD700, 0.8);
        paperFrame.strokeRect(this.PAPER_X - this.PAPER_SIZE / 2 - 2, this.PAPER_Y - this.PAPER_SIZE / 2 - 2, this.PAPER_SIZE + 4, this.PAPER_SIZE + 4);

        this.foldLabel = this.add.text(this.PAPER_X, this.PAPER_Y, '请先选择折法', {
            fontSize: '22px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFD700', stroke: '#5C0A0A', strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0.7);

        var panelX = W - 200;
        this.add.text(panelX, 80, '选择折法', {
            fontSize: '20px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFD700'
        }).setOrigin(0.5);

        this.foldButtons = [];
        var foldTypes = level.availableFolds;
        var hasHalfV = foldTypes.indexOf('half-v') >= 0;
        var hasHalfH = foldTypes.indexOf('half-h') >= 0;
        var needDistinguishHalf = hasHalfV && hasHalfH;
        for (var i = 0; i < foldTypes.length; i++) {
            var ft = foldTypes[i];
            var info = FoldEngine.FOLD_INFO[ft];
            var bx = panelX, by = 115 + i * 45;
            var displayText = info.name;
            if (needDistinguishHalf) {
                if (ft === 'half-v') displayText = '对折(纵)';
                else if (ft === 'half-h') displayText = '对折(横)';
            }
            this._makeFoldBtn(this, bx, by, 160, 36, info.name, ft, displayText);
        }

        this.add.text(panelX, 280, '剪裁工具', {
            fontSize: '20px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFD700'
        }).setOrigin(0.5);

        this.toolButtons = [];
        var tools = [{ key: 'rect', label: '□ 矩形' }, { key: 'circle', label: '○ 圆形' }, { key: 'freehand', label: '～ 自由' }];
        for (var i = 0; i < tools.length; i++) {
            var tx = panelX - 80 + i * 80, ty = 315;
            this._makeToolBtn(this, tx, ty, 70, 32, tools[i].label, tools[i].key);
        }

        this._makeActionBtn(this, panelX, 380, 160, 40, '展开查看', '#FFD700', this._doUnfold.bind(this));
        this._makeActionBtn(this, panelX, 435, 160, 40, '撤销', '#FFC0CB', this._doUndo.bind(this));
        this._makeActionBtn(this, panelX, 490, 160, 40, '重置', '#FF9999', this._doReset.bind(this));

        this.hintText = this.add.text(W / 2, H - 60, '提示: ' + level.hint, {
            fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#AA8888', wordWrap: { width: W - 100 }
        }).setOrigin(0.5);

        var backZone = this.add.zone(50, 25, 80, 30).setInteractive({ useHandCursor: true });
        this.add.text(50, 25, '← 返回', {
            fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
        }).setOrigin(0.5);
        backZone.on('pointerdown', function () { this.scene.start('LevelSelect'); }.bind(this));

        this.drawPreview = this.add.graphics();
        this.paperZone = this.add.zone(this.PAPER_X, this.PAPER_Y, this.PAPER_SIZE, this.PAPER_SIZE).setInteractive();
        this.paperZone.on('pointerdown', this._onPointerDown, this);
        this.paperZone.on('pointermove', this._onPointerMove, this);
        this.paperZone.on('pointerup', this._onPointerUp, this);

        this._updateToolHighlight();
    },

    update: function () {
        if (GameState.startTime > 0) {
            var elapsed = Math.floor((Date.now() - GameState.startTime) / 1000);
            this.timerText.setText('时间: ' + elapsed + 's');
        }
        this.stepText.setText('步骤: ' + GameState.stepCount);
    },

    _renderFullPaper: function () {
        var N = FoldEngine.GRID_SIZE;
        var grid = FoldEngine.createGrid(N, 1);
        FoldEngine.renderPatternToCanvas(grid, N, this.paperCanvas, { showFoldLines: false, paperR: 190, paperG: 30, paperB: 30 });
        var ctx = this.paperTex.getContext();
        ctx.clearRect(0, 0, N, N);
        ctx.drawImage(this.paperCanvas, 0, 0);
        this.paperTex.refresh();
    },

    _renderFoldedPaper: function () {
        var N = FoldEngine.GRID_SIZE;
        FoldEngine.renderFoldedViewScaled(GameState.cutMask, GameState.foldType, N, this.paperCanvas);
        var texW = this.paperCanvas.width;
        var texH = this.paperCanvas.height;
        if (this.textures.exists('paperTex')) this.textures.remove('paperTex');
        this.paperTex = this.textures.createCanvas('paperTex', texW, texH);
        var ctx = this.paperTex.getContext();
        ctx.clearRect(0, 0, texW, texH);
        ctx.drawImage(this.paperCanvas, 0, 0);
        this.paperTex.refresh();
        this.paperImage.setTexture('paperTex');
        this.paperImage.setDisplaySize(this.PAPER_SIZE, this.PAPER_SIZE);
    },

    _renderUnfoldedPaper: function () {
        var N = FoldEngine.GRID_SIZE;
        var pattern = FoldEngine.unfold(GameState.cutMask, GameState.foldType, N);
        FoldEngine.renderPatternToCanvas(pattern, N, this.paperCanvas, { showFoldLines: false });
        var ctx = this.paperTex.getContext();
        ctx.clearRect(0, 0, N, N);
        ctx.drawImage(this.paperCanvas, 0, 0);
        this.paperTex.refresh();
    },

    _makeFoldBtn: function (scene, x, y, w, h, text, foldType, displayText) {
        var g = scene.add.graphics();
        var isSelected = GameState.foldType === foldType;
        g.fillStyle(isSelected ? 0x8B0000 : 0x6B1A1A, 0.9);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
        g.lineStyle(isSelected ? 2 : 1, 0xFFD700, isSelected ? 1 : 0.5);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);

        var btnText = displayText || text;
        var txt = scene.add.text(x, y, btnText, {
            fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: isSelected ? '#FFD700' : '#FFC0CB'
        }).setOrigin(0.5);

        var zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', function () {
            if (!GameState.isFolded) {
                GameState.foldType = foldType;
                GameState.isFolded = true;
                GameState.stepCount++;
                GameState.cutMask = FoldEngine.createGrid(FoldEngine.GRID_SIZE, 1);
                GameState.cuts = [];
                scene.foldLabel.setAlpha(0);
                scene._animateFold(function () {
                    scene._renderFoldedPaper();
                    scene.paperImage.setTexture('paperTex');
                    scene._updateFoldBtnHighlight();
                });
            }
        });
        scene.foldButtons.push({ g: g, txt: txt, zone: zone, foldType: foldType, x: x, y: y, w: w, h: h, displayText: btnText });
    },

    _updateFoldBtnHighlight: function () {
        for (var i = 0; i < this.foldButtons.length; i++) {
            var btn = this.foldButtons[i];
            var sel = btn.foldType === GameState.foldType;
            btn.g.clear();
            btn.g.fillStyle(sel ? 0x8B0000 : 0x6B1A1A, 0.9);
            btn.g.fillRoundedRect(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 6);
            btn.g.lineStyle(sel ? 2 : 1, 0xFFD700, sel ? 1 : 0.5);
            btn.g.strokeRoundedRect(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 6);
            btn.txt.setText(btn.displayText);
            btn.txt.setColor(sel ? '#FFD700' : '#FFC0CB');
        }
    },

    _makeToolBtn: function (scene, x, y, w, h, text, toolKey) {
        var g = scene.add.graphics();
        var isSelected = GameState.drawTool === toolKey;
        g.fillStyle(isSelected ? 0x8B0000 : 0x5C0A0A, 0.9);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
        g.lineStyle(1, 0xFFD700, isSelected ? 1 : 0.4);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);

        var txt = scene.add.text(x, y, text, {
            fontSize: '14px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: isSelected ? '#FFD700' : '#FFC0CB'
        }).setOrigin(0.5);

        var zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', function () {
            GameState.drawTool = toolKey;
            scene._updateToolHighlight();
        });
        scene.toolButtons.push({ g: g, txt: txt, zone: zone, key: toolKey, x: x, y: y, w: w, h: h });
    },

    _updateToolHighlight: function () {
        for (var i = 0; i < this.toolButtons.length; i++) {
            var btn = this.toolButtons[i];
            var sel = btn.key === GameState.drawTool;
            btn.g.clear();
            btn.g.fillStyle(sel ? 0x8B0000 : 0x5C0A0A, 0.9);
            btn.g.fillRoundedRect(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 4);
            btn.g.lineStyle(1, 0xFFD700, sel ? 1 : 0.4);
            btn.g.strokeRoundedRect(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 4);
            btn.txt.setColor(sel ? '#FFD700' : '#FFC0CB');
        }
    },

    _makeActionBtn: function (scene, x, y, w, h, text, color, callback) {
        var g = scene.add.graphics();
        g.fillStyle(0x6B1A1A, 0.9);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
        g.lineStyle(1, 0xFFD700, 0.6);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);

        var txt = scene.add.text(x, y, text, {
            fontSize: '18px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: color
        }).setOrigin(0.5);

        var zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    },

    _animateFold: function (callback) {
        var scene = this;
        var px = this.PAPER_X, py = this.PAPER_Y, ps = this.PAPER_SIZE;

        scene.paperImage.setAlpha(0.5);
        scene.tweens.add({
            targets: scene.paperImage,
            scaleX: 0.8,
            scaleY: 0.8,
            alpha: 1,
            duration: 400,
            ease: 'Power2',
            onComplete: function () {
                scene.paperImage.setScale(1);
                if (callback) callback();
            }
        });
    },

    _animateUnfold: function (callback) {
        var scene = this;
        scene.paperImage.setScale(0.5);
        scene.paperImage.setAlpha(0.3);
        scene.tweens.add({
            targets: scene.paperImage,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 800,
            ease: 'Back.easeOut',
            onComplete: function () {
                if (callback) callback();
            }
        });
    },

    _screenToGrid: function (pointer) {
        var N = FoldEngine.GRID_SIZE;
        var paperLeft = this.PAPER_X - this.PAPER_SIZE / 2;
        var paperTop = this.PAPER_Y - this.PAPER_SIZE / 2;
        var localX = pointer.x - paperLeft;
        var localY = pointer.y - paperTop;

        if (GameState.isFolded && GameState.foldType) {
            var bounds = FoldEngine.getFoldedDisplayBounds(GameState.foldType, N);
            var foldScaleX = this.PAPER_SIZE / bounds.w;
            var foldScaleY = this.PAPER_SIZE / bounds.h;
            var gx = Math.floor(localX / foldScaleX) + bounds.x;
            var gy = Math.floor(localY / foldScaleY) + bounds.y;
            return { x: Phaser.Math.Clamp(gx, bounds.x, bounds.x + bounds.w - 1), y: Phaser.Math.Clamp(gy, bounds.y, bounds.y + bounds.h - 1) };
        } else {
            var gx = Math.floor(localX / this.SCALE);
            var gy = Math.floor(localY / this.SCALE);
            return { x: Phaser.Math.Clamp(gx, 0, N - 1), y: Phaser.Math.Clamp(gy, 0, N - 1) };
        }
    },

    _gridToScreen: function (gx, gy) {
        var N = FoldEngine.GRID_SIZE;
        var paperLeft = this.PAPER_X - this.PAPER_SIZE / 2;
        var paperTop = this.PAPER_Y - this.PAPER_SIZE / 2;

        if (GameState.isFolded && GameState.foldType) {
            var bounds = FoldEngine.getFoldedDisplayBounds(GameState.foldType, N);
            var foldScaleX = this.PAPER_SIZE / bounds.w;
            var foldScaleY = this.PAPER_SIZE / bounds.h;
            return {
                x: paperLeft + (gx - bounds.x) * foldScaleX,
                y: paperTop + (gy - bounds.y) * foldScaleY
            };
        } else {
            return {
                x: paperLeft + gx * this.SCALE,
                y: paperTop + gy * this.SCALE
            };
        }
    },

    _onPointerDown: function (pointer) {
        if (!GameState.isFolded || !GameState.foldType) return;
        var pos = this._screenToGrid(pointer);
        GameState.isDrawing = true;
        GameState.drawStart = pos;
        GameState.freehandPoints = [pos];
    },

    _onPointerMove: function (pointer) {
        if (!GameState.isDrawing || !GameState.isFolded) return;
        var pos = this._screenToGrid(pointer);
        var N = FoldEngine.GRID_SIZE;

        this.drawPreview.clear();

        if (GameState.drawTool === 'freehand') {
            GameState.freehandPoints.push(pos);
            for (var i = 0; i < GameState.freehandPoints.length; i++) {
                var p = GameState.freehandPoints[i];
                if (FoldEngine.isInFoldedRegion(p.x, p.y, GameState.foldType, N)) {
                    var screenPos = this._gridToScreen(p.x, p.y);
                    var cellSize = this._getCellSize();
                    this.drawPreview.fillStyle(0xFFD700, 0.3);
                    this.drawPreview.fillRect(screenPos.x, screenPos.y, cellSize, cellSize);
                }
            }
        } else {
            var sx = GameState.drawStart.x, sy = GameState.drawStart.y;
            var ex = pos.x, ey = pos.y;
            var minX = Math.min(sx, ex), minY = Math.min(sy, ey);
            var maxX = Math.max(sx, ex), maxY = Math.max(sy, ey);

            if (GameState.drawTool === 'rect') {
                var startScreen = this._gridToScreen(minX, minY);
                var endScreen = this._gridToScreen(maxX + 1, maxY + 1);
                var w = endScreen.x - startScreen.x;
                var h = endScreen.y - startScreen.y;
                this.drawPreview.lineStyle(2, 0xFFD700, 0.8);
                this.drawPreview.strokeRect(startScreen.x, startScreen.y, w, h);
                this.drawPreview.fillStyle(0xFFD700, 0.15);
                this.drawPreview.fillRect(startScreen.x, startScreen.y, w, h);
            } else if (GameState.drawTool === 'circle') {
                var cx = (sx + ex) / 2, cy = (sy + ey) / 2;
                var rx = Math.abs(ex - sx) / 2, ry = Math.abs(ey - sy) / 2;
                var r = Math.max(rx, ry);
                var centerScreen = this._gridToScreen(cx, cy);
                var cellSize = this._getCellSize();
                this.drawPreview.lineStyle(2, 0xFFD700, 0.8);
                this.drawPreview.strokeCircle(centerScreen.x, centerScreen.y, r * cellSize);
                this.drawPreview.fillStyle(0xFFD700, 0.1);
                this.drawPreview.fillCircle(centerScreen.x, centerScreen.y, r * cellSize);
            }
        }
    },

    _getCellSize: function () {
        var N = FoldEngine.GRID_SIZE;
        if (GameState.isFolded && GameState.foldType) {
            var bounds = FoldEngine.getFoldedDisplayBounds(GameState.foldType, N);
            var avgScale = (this.PAPER_SIZE / bounds.w + this.PAPER_SIZE / bounds.h) / 2;
            return avgScale;
        }
        return this.SCALE;
    },

    _onPointerUp: function (pointer) {
        if (!GameState.isDrawing || !GameState.isFolded) return;
        GameState.isDrawing = false;
        this.drawPreview.clear();

        var pos = this._screenToGrid(pointer);
        var N = FoldEngine.GRID_SIZE;
        var cut = null;

        if (GameState.drawTool === 'rect') {
            var sx = GameState.drawStart.x, sy = GameState.drawStart.y;
            var ex = pos.x, ey = pos.y;
            var minX = Math.min(sx, ex), minY = Math.min(sy, ey);
            var w = Math.abs(ex - sx) + 1, h = Math.abs(ey - sy) + 1;
            if (w > 1 && h > 1) {
                cut = { type: 'rect', x: minX, y: minY, w: w, h: h };
            }
        } else if (GameState.drawTool === 'circle') {
            var sx = GameState.drawStart.x, sy = GameState.drawStart.y;
            var cx = Math.floor((sx + pos.x) / 2), cy = Math.floor((sy + pos.y) / 2);
            var r = Math.max(Math.abs(pos.x - sx), Math.abs(pos.y - sy));
            r = Math.floor(r / 2);
            if (r > 1) {
                cut = { type: 'circle', cx: cx, cy: cy, r: r };
            }
        } else if (GameState.drawTool === 'freehand') {
            if (GameState.freehandPoints.length > 2) {
                var minX = N, minY = N, maxX = 0, maxY = 0;
                for (var i = 0; i < GameState.freehandPoints.length; i++) {
                    var p = GameState.freehandPoints[i];
                    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                }
                cut = { type: 'rect', x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
            }
        }

        if (cut) {
            GameState.cuts.push(cut);
            FoldEngine.applyCutToMask(GameState.cutMask, cut, GameState.foldType, N);
            GameState.stepCount++;
            this._renderFoldedPaper();
            this.paperImage.setTexture('paperTex');
        }

        GameState.freehandPoints = [];
    },

    _doUnfold: function () {
        if (!GameState.isFolded || !GameState.foldType) return;
        var scene = this;
        GameState.isFolded = false;

        var N = FoldEngine.GRID_SIZE;
        GameState.resultPattern = FoldEngine.unfold(GameState.cutMask, GameState.foldType, N);
        GameState.matchScore = FoldEngine.comparePatterns(GameState.resultPattern, GameState.targetPattern, N);

        scene._renderUnfoldedPaper();

        scene._animateUnfold(function () {
            scene.paperImage.setTexture('paperTex');
            scene.time.delayedCall(600, function () {
                scene.scene.start('Result');
            });
        });
    },

    _doUndo: function () {
        if (GameState.cuts.length === 0) return;
        GameState.cuts.pop();
        var N = FoldEngine.GRID_SIZE;
        GameState.cutMask = FoldEngine.createGrid(N, 1);
        for (var i = 0; i < GameState.cuts.length; i++) {
            FoldEngine.applyCutToMask(GameState.cutMask, GameState.cuts[i], GameState.foldType, N);
        }
        GameState.stepCount = Math.max(0, GameState.stepCount - 1);
        if (GameState.isFolded) {
            this._renderFoldedPaper();
            this.paperImage.setTexture('paperTex');
        }
    },

    _doReset: function () {
        var N = FoldEngine.GRID_SIZE;
        GameState.cuts = [];
        GameState.cutMask = FoldEngine.createGrid(N, 1);
        GameState.stepCount = 0;
        GameState.foldType = null;
        GameState.isFolded = false;
        GameState.startTime = Date.now();
        this.foldLabel.setAlpha(0.7);
        this._renderFullPaper();
        this.paperImage.setTexture('paperTex');
        this._updateFoldBtnHighlight();
    }
});

var ResultScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function ResultScene() { Phaser.Scene.call(this, { key: 'Result' }); },
    create: function () {
        var W = this.cameras.main.width, H = this.cameras.main.height;
        var level = GameState.currentLevel;
        var N = FoldEngine.GRID_SIZE;

        var bg = this.add.graphics();
        bg.fillStyle(0x5C0A0A, 1); bg.fillRect(0, 0, W, H);

        var elapsed = Math.floor((Date.now() - GameState.startTime) / 1000);
        var util = FoldEngine.computeUtilization(GameState.resultPattern, N);
        var matchScore = GameState.matchScore;

        var stepsStars = calcStars(GameState.stepCount, level.starSteps);
        var utilStars = calcStars(util, [level.starUtil[2], level.starUtil[1], level.starUtil[0]]);
        var timeStars = calcStars(elapsed, level.starTime);
        var totalStars = stepsStars + utilStars + timeStars;
        var passed = matchScore >= 0.85;

        this.add.text(W / 2, 60, passed ? '🎉 通关成功！' : '再接再厉', {
            fontSize: '42px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: passed ? '#FFD700' : '#FF6666', stroke: '#5C0A0A', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(W / 2, 120, '匹配度: ' + Math.round(matchScore * 100) + '%', {
            fontSize: '24px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
        }).setOrigin(0.5);

        var resultCanvas = document.createElement('canvas');
        FoldEngine.renderPatternToCanvas(GameState.resultPattern, N, resultCanvas, { showFoldLines: false });
        if (this.textures.exists('resultTex')) this.textures.remove('resultTex');
        var resultTex = this.textures.createCanvas('resultTex', N, N);
        var rCtx = resultTex.getContext();
        rCtx.drawImage(resultCanvas, 0, 0);
        resultTex.refresh();
        this.add.image(W / 2 - 110, 240, 'resultTex').setDisplaySize(160, 160);

        var targetCanvas = document.createElement('canvas');
        FoldEngine.renderPatternToCanvas(GameState.targetPattern, N, targetCanvas, { showFoldLines: false });
        if (this.textures.exists('targetTex2')) this.textures.remove('targetTex2');
        var targetTex2 = this.textures.createCanvas('targetTex2', N, N);
        var tCtx2 = targetTex2.getContext();
        tCtx2.drawImage(targetCanvas, 0, 0);
        targetTex2.refresh();
        this.add.image(W / 2 + 110, 240, 'targetTex2').setDisplaySize(160, 160);

        this.add.text(W / 2 - 110, 160, '你的作品', {
            fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFD700'
        }).setOrigin(0.5);
        this.add.text(W / 2 + 110, 160, '目标图案', {
            fontSize: '16px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFD700'
        }).setOrigin(0.5);

        var metrics = [
            { label: '步骤', value: GameState.stepCount + '步', stars: stepsStars },
            { label: '利用率', value: Math.round(util * 100) + '%', stars: utilStars },
            { label: '用时', value: elapsed + '秒', stars: timeStars }
        ];

        for (var i = 0; i < metrics.length; i++) {
            var my = 360 + i * 55;
            this.add.text(W / 2 - 150, my, metrics[i].label + ': ' + metrics[i].value, {
                fontSize: '22px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
            }).setOrigin(0, 0.5);

            var starStr = '';
            for (var s = 0; s < 3; s++) starStr += s < metrics[i].stars ? '★' : '☆';
            this.add.text(W / 2 + 120, my, starStr, {
                fontSize: '28px', color: '#FFD700'
            }).setOrigin(0, 0.5);
        }

        this.add.text(W / 2, 540, '总评: ' + totalStars + '/9 ★', {
            fontSize: '30px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFD700', stroke: '#5C0A0A', strokeThickness: 3
        }).setOrigin(0.5);

        if (passed) {
            var prev = GameState.bestScores[level.id] || { stars: 0 };
            if (totalStars > prev.stars) {
                GameState.bestScores[level.id] = { stars: totalStars, steps: GameState.stepCount, time: elapsed, util: util };
                saveBestScores();
            }
        }

        var btnY = 610;
        if (passed && level.id < 60) {
            this._makeBtn(this, W / 2 - 150, btnY, 180, 50, '下一关', '#FFD700', function () {
                GameState.currentLevel = LEVELS[level.id];
                this.scene.start('Game');
            }.bind(this));
        }
        this._makeBtn(this, W / 2 + 20, btnY, 180, 50, '重试', '#FFC0CB', function () {
            this.scene.start('Game');
        }.bind(this));
        this._makeBtn(this, W / 2 + 190, btnY, 180, 50, '关卡列表', '#FF9999', function () {
            this.scene.start('LevelSelect');
        }.bind(this));
    },

    _makeBtn: function (scene, x, y, w, h, text, color, callback) {
        var g = scene.add.graphics();
        g.fillStyle(0x6B1A1A, 0.9);
        g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(1, 0xFFD700, 0.6);
        g.strokeRoundedRect(x, y, w, h, 8);

        scene.add.text(x + w / 2, y + h / 2, text, {
            fontSize: '20px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: color
        }).setOrigin(0.5);

        var zone = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }
});

var LeaderboardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function LeaderboardScene() { Phaser.Scene.call(this, { key: 'Leaderboard' }); },
    create: function () {
        var W = this.cameras.main.width, H = this.cameras.main.height;
        var bg = this.add.graphics();
        bg.fillStyle(0x5C0A0A, 1); bg.fillRect(0, 0, W, H);

        this.add.text(W / 2, 40, '排行榜', {
            fontSize: '36px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            color: '#FFD700', stroke: '#5C0A0A', strokeThickness: 3
        }).setOrigin(0.5);

        var scores = GameState.bestScores || {};
        var sorted = [];
        for (var id in scores) {
            sorted.push({ id: parseInt(id), stars: scores[id].stars, steps: scores[id].steps, time: scores[id].time });
        }
        sorted.sort(function (a, b) { return b.stars - a.stars || a.steps - b.steps || a.time - b.time; });

        if (sorted.length === 0) {
            this.add.text(W / 2, H / 2, '还没有通关记录，快去挑战吧！', {
                fontSize: '24px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
            }).setOrigin(0.5);
        } else {
            this.add.text(W / 2 - 200, 90, '关卡', { fontSize: '18px', color: '#FFD700', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
            this.add.text(W / 2 - 80, 90, '星级', { fontSize: '18px', color: '#FFD700', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
            this.add.text(W / 2 + 40, 90, '步骤', { fontSize: '18px', color: '#FFD700', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
            this.add.text(W / 2 + 140, 90, '用时', { fontSize: '18px', color: '#FFD700', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });

            var shown = Math.min(sorted.length, 15);
            for (var i = 0; i < shown; i++) {
                var s = sorted[i];
                var y = 130 + i * 35;
                var name = LEVELS[s.id - 1] ? LEVELS[s.id - 1].name : ('关卡' + s.id);
                this.add.text(W / 2 - 200, y, s.id + '. ' + name, { fontSize: '15px', color: '#FFC0CB', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
                this.add.text(W / 2 - 80, y, s.stars + '/9 ★', { fontSize: '15px', color: '#FFD700', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
                this.add.text(W / 2 + 40, y, s.steps + '步', { fontSize: '15px', color: '#FFC0CB', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
                this.add.text(W / 2 + 140, y, s.time + 's', { fontSize: '15px', color: '#FFC0CB', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' });
            }
        }

        var backZone = this.add.zone(W / 2, H - 50, 200, 50).setInteractive({ useHandCursor: true });
        this.add.text(W / 2, H - 50, '← 返回主菜单', {
            fontSize: '22px', fontFamily: '"Microsoft YaHei","SimHei",sans-serif', color: '#FFC0CB'
        }).setOrigin(0.5);
        backZone.on('pointerdown', function () { this.scene.start('Menu'); }.bind(this));
    }
});

var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: 'game-container',
    backgroundColor: '#5C0A0A',
    scene: [BootScene, MenuScene, LevelSelectScene, GameScene, ResultScene, LeaderboardScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
        activePointers: 2
    }
};

var game = new Phaser.Game(config);
