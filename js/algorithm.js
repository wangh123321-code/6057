var FoldEngine = (function () {
    var GRID = 80;

    var FOLD_INFO = {
        'half-v': { name: '对折', category: '对折', layers: 2, symmetry: 2 },
        'half-h': { name: '对折', category: '对折', layers: 2, symmetry: 2 },
        'triangle': { name: '三角折', category: '三角折', layers: 2, symmetry: 2 },
        'quarter': { name: '四折', category: '四折', layers: 4, symmetry: 4 },
        'hexagonal': { name: '六角折', category: '六角折', layers: 6, symmetry: 6 },
        'window': { name: '窗花折', category: '窗花折', layers: 8, symmetry: 8 },
        'round': { name: '团花折', category: '团花折', layers: 12, symmetry: 12 }
    };

    function createGrid(size, val) {
        var g = [];
        for (var y = 0; y < size; y++) {
            g[y] = [];
            for (var x = 0; x < size; x++) {
                g[y][x] = (val !== undefined) ? val : 1;
            }
        }
        return g;
    }

    function cloneGrid(grid) {
        var g = [];
        for (var y = 0; y < grid.length; y++) {
            g[y] = grid[y].slice();
        }
        return g;
    }

    function isInFoldedRegion(x, y, foldType, N) {
        var cx = N / 2, cy = N / 2;
        switch (foldType) {
            case 'half-v':
                return x >= 0 && x < N / 2 && y >= 0 && y < N;
            case 'half-h':
                return x >= 0 && x < N && y >= 0 && y < N / 2;
            case 'triangle':
                return x >= 0 && x < N && y >= 0 && y < N && y >= x;
            case 'quarter':
                return x >= 0 && x < N / 2 && y >= 0 && y < N / 2;
            case 'hexagonal': {
                var angle = Math.atan2(y - cy, x - cx);
                if (angle < 0) angle += 2 * Math.PI;
                var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                return dist <= cx && angle <= Math.PI / 3;
            }
            case 'window': {
                var angle = Math.atan2(y - cy, x - cx);
                if (angle < 0) angle += 2 * Math.PI;
                var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                return dist <= cx && angle <= Math.PI / 4;
            }
            case 'round': {
                var angle = Math.atan2(y - cy, x - cx);
                if (angle < 0) angle += 2 * Math.PI;
                var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                return dist <= cx && angle <= Math.PI / 6;
            }
            default:
                return true;
        }
    }

    function getSymmetryPoints(x, y, foldType, N) {
        var cx = N / 2, cy = N / 2;
        switch (foldType) {
            case 'half-v':
                return [[x, y], [N - 1 - x, y]];
            case 'half-h':
                return [[x, y], [x, N - 1 - y]];
            case 'triangle':
                return [[x, y], [y, x]];
            case 'quarter':
                return [
                    [x, y],
                    [N - 1 - x, y],
                    [x, N - 1 - y],
                    [N - 1 - x, N - 1 - y]
                ];
            case 'hexagonal':
                return _radialSym(x, y, cx, cy, 6);
            case 'window':
                return _dihedralSym(x, y, cx, cy, 4);
            case 'round':
                return _radialSym(x, y, cx, cy, 12);
            default:
                return [[x, y]];
        }
    }

    function _radialSym(x, y, cx, cy, n) {
        var pts = [];
        var dx = x - cx, dy = y - cy;
        var step = (2 * Math.PI) / n;
        for (var i = 0; i < n; i++) {
            var a = step * i;
            var c = Math.cos(a), s = Math.sin(a);
            pts.push([
                Math.round(dx * c - dy * s + cx),
                Math.round(dx * s + dy * c + cy)
            ]);
        }
        return pts;
    }

    function _dihedralSym(x, y, cx, cy, n) {
        var pts = [];
        var dx = x - cx, dy = y - cy;
        var step = (2 * Math.PI) / n;
        for (var i = 0; i < n; i++) {
            var a = step * i;
            var c = Math.cos(a), s = Math.sin(a);
            pts.push([
                Math.round(dx * c - dy * s + cx),
                Math.round(dx * s + dy * c + cy)
            ]);
        }
        for (var i = 0; i < n; i++) {
            var a = step * i;
            var c = Math.cos(a), s = Math.sin(a);
            var rdx = dx, rdy = -dy;
            pts.push([
                Math.round(rdx * c - rdy * s + cx),
                Math.round(rdx * s + rdy * c + cy)
            ]);
        }
        return pts;
    }

    function applyCutToMask(mask, cut, foldType, N) {
        if (cut.type === 'rect') {
            for (var dy = 0; dy < cut.h; dy++) {
                for (var dx = 0; dx < cut.w; dx++) {
                    var px = cut.x + dx, py = cut.y + dy;
                    if (px >= 0 && px < N && py >= 0 && py < N) {
                        if (isInFoldedRegion(px, py, foldType, N)) {
                            mask[py][px] = 0;
                        }
                    }
                }
            }
        } else if (cut.type === 'circle') {
            var r = cut.r || cut.radius;
            for (var dy = -r; dy <= r; dy++) {
                for (var dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy <= r * r) {
                        var px = cut.cx + dx, py = cut.cy + dy;
                        if (px >= 0 && px < N && py >= 0 && py < N) {
                            if (isInFoldedRegion(px, py, foldType, N)) {
                                mask[py][px] = 0;
                            }
                        }
                    }
                }
            }
        } else if (cut.type === 'triangle') {
            var minX = Math.min(cut.x1, cut.x2, cut.x3);
            var maxX = Math.max(cut.x1, cut.x2, cut.x3);
            var minY = Math.min(cut.y1, cut.y2, cut.y3);
            var maxY = Math.max(cut.y1, cut.y2, cut.y3);
            for (var py = minY; py <= maxY; py++) {
                for (var px = minX; px <= maxX; px++) {
                    if (px >= 0 && px < N && py >= 0 && py < N) {
                        if (_pointInTriangle(px, py, cut.x1, cut.y1, cut.x2, cut.y2, cut.x3, cut.y3)) {
                            if (isInFoldedRegion(px, py, foldType, N)) {
                                mask[py][px] = 0;
                            }
                        }
                    }
                }
            }
        }
    }

    function _pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
        var d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
        var d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
        var d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
        var hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        var hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        return !(hasNeg && hasPos);
    }

    function unfold(cutMask, foldType, N) {
        var result = createGrid(N, 1);
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                if (!isInFoldedRegion(x, y, foldType, N)) continue;
                if (cutMask[y][x] === 0) {
                    var pts = getSymmetryPoints(x, y, foldType, N);
                    for (var i = 0; i < pts.length; i++) {
                        var sx = pts[i][0], sy = pts[i][1];
                        if (sx >= 0 && sx < N && sy >= 0 && sy < N) {
                            result[sy][sx] = 0;
                        }
                    }
                }
            }
        }
        return result;
    }

    function computeTarget(foldType, cuts, N) {
        var mask = createGrid(N, 1);
        for (var i = 0; i < cuts.length; i++) {
            applyCutToMask(mask, cuts[i], foldType, N);
        }
        return unfold(mask, foldType, N);
    }

    function computeCutMask(foldType, cuts, N) {
        var mask = createGrid(N, 1);
        for (var i = 0; i < cuts.length; i++) {
            applyCutToMask(mask, cuts[i], foldType, N);
        }
        return mask;
    }

    function comparePatterns(p1, p2, N) {
        var match = 0, total = N * N;
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                if (p1[y][x] === p2[y][x]) match++;
            }
        }
        return match / total;
    }

    function computeUtilization(pattern, N) {
        var paper = 0;
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                if (pattern[y][x] === 1) paper++;
            }
        }
        return paper / (N * N);
    }

    function renderPatternToCanvas(pattern, N, canvas, opts) {
        opts = opts || {};
        var paperR = opts.paperR !== undefined ? opts.paperR : 190;
        var paperG = opts.paperG !== undefined ? opts.paperG : 30;
        var paperB = opts.paperB !== undefined ? opts.paperB : 30;
        var cutR = opts.cutR !== undefined ? opts.cutR : 50;
        var cutG = opts.cutG !== undefined ? opts.cutG : 15;
        var cutB = opts.cutB !== undefined ? opts.cutB : 15;
        var cutA = opts.cutA !== undefined ? opts.cutA : 255;
        var foldType = opts.foldType || null;
        var showFoldLines = opts.showFoldLines || false;

        canvas.width = N;
        canvas.height = N;
        var ctx = canvas.getContext('2d');
        var imgData = ctx.createImageData(N, N);

        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                var idx = (y * N + x) * 4;
                if (pattern[y][x] === 1) {
                    var inFold = foldType ? isInFoldedRegion(x, y, foldType, N) : true;
                    if (foldType && !inFold) {
                        imgData.data[idx] = 80;
                        imgData.data[idx + 1] = 20;
                        imgData.data[idx + 2] = 20;
                        imgData.data[idx + 3] = 120;
                    } else {
                        imgData.data[idx] = paperR;
                        imgData.data[idx + 1] = paperG;
                        imgData.data[idx + 2] = paperB;
                        imgData.data[idx + 3] = 255;
                    }
                } else {
                    imgData.data[idx] = cutR;
                    imgData.data[idx + 1] = cutG;
                    imgData.data[idx + 2] = cutB;
                    imgData.data[idx + 3] = cutA;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        if (showFoldLines && foldType) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            switch (foldType) {
                case 'half-v':
                    ctx.beginPath();
                    ctx.moveTo(N / 2, 0);
                    ctx.lineTo(N / 2, N);
                    ctx.stroke();
                    break;
                case 'half-h':
                    ctx.beginPath();
                    ctx.moveTo(0, N / 2);
                    ctx.lineTo(N, N / 2);
                    ctx.stroke();
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(N - 1, N - 1);
                    ctx.stroke();
                    break;
                case 'quarter':
                    ctx.beginPath();
                    ctx.moveTo(N / 2, 0);
                    ctx.lineTo(N / 2, N);
                    ctx.moveTo(0, N / 2);
                    ctx.lineTo(N, N / 2);
                    ctx.stroke();
                    break;
                default:
                    break;
            }
            ctx.setLineDash([]);
        }
    }

    function renderFoldedView(cutMask, foldType, N, canvas, opts) {
        opts = opts || {};
        canvas.width = N;
        canvas.height = N;
        var ctx = canvas.getContext('2d');
        var imgData = ctx.createImageData(N, N);

        var paperR = opts.paperR || 190, paperG = opts.paperG || 30, paperB = opts.paperB || 30;

        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                var idx = (y * N + x) * 4;
                if (isInFoldedRegion(x, y, foldType, N)) {
                    if (cutMask[y][x] === 1) {
                        imgData.data[idx] = paperR;
                        imgData.data[idx + 1] = paperG;
                        imgData.data[idx + 2] = paperB;
                        imgData.data[idx + 3] = 255;
                    } else {
                        imgData.data[idx] = 50;
                        imgData.data[idx + 1] = 15;
                        imgData.data[idx + 2] = 15;
                        imgData.data[idx + 3] = 255;
                    }
                } else {
                    imgData.data[idx] = 0;
                    imgData.data[idx + 1] = 0;
                    imgData.data[idx + 2] = 0;
                    imgData.data[idx + 3] = 0;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.lineWidth = 1;
        _drawFoldedBorder(ctx, foldType, N);
    }

    function _drawFoldedBorder(ctx, foldType, N) {
        var cx = N / 2, cy = N / 2;
        ctx.beginPath();
        switch (foldType) {
            case 'half-v':
                ctx.rect(0, 0, N / 2, N);
                break;
            case 'half-h':
                ctx.rect(0, 0, N, N / 2);
                break;
            case 'triangle':
                ctx.moveTo(0, 0);
                ctx.lineTo(N, N);
                ctx.lineTo(0, N);
                ctx.closePath();
                break;
            case 'quarter':
                ctx.rect(0, 0, N / 2, N / 2);
                break;
            case 'hexagonal':
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, cx, 0, Math.PI / 3);
                ctx.closePath();
                break;
            case 'window':
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, cx, 0, Math.PI / 4);
                ctx.closePath();
                break;
            case 'round':
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, cx, 0, Math.PI / 6);
                ctx.closePath();
                break;
        }
        ctx.stroke();
    }

    function renderFoldedViewScaled(cutMask, foldType, N, canvas, opts) {
        opts = opts || {};
        var bounds = getFoldedDisplayBounds(foldType, N);
        var outW = Math.ceil(bounds.w);
        var outH = Math.ceil(bounds.h);
        canvas.width = outW;
        canvas.height = outH;
        var ctx = canvas.getContext('2d');
        var imgData = ctx.createImageData(outW, outH);

        var paperR = opts.paperR || 190, paperG = opts.paperG || 30, paperB = opts.paperB || 30;

        for (var y = 0; y < outH; y++) {
            for (var x = 0; x < outW; x++) {
                var idx = (y * outW + x) * 4;
                var srcX = x + bounds.x;
                var srcY = y + bounds.y;
                if (srcX >= 0 && srcX < N && srcY >= 0 && srcY < N) {
                    if (isInFoldedRegion(srcX, srcY, foldType, N)) {
                        if (cutMask[srcY][srcX] === 1) {
                            imgData.data[idx] = paperR;
                            imgData.data[idx + 1] = paperG;
                            imgData.data[idx + 2] = paperB;
                            imgData.data[idx + 3] = 255;
                        } else {
                            imgData.data[idx] = 50;
                            imgData.data[idx + 1] = 15;
                            imgData.data[idx + 2] = 15;
                            imgData.data[idx + 3] = 255;
                        }
                    } else {
                        imgData.data[idx] = 0;
                        imgData.data[idx + 1] = 0;
                        imgData.data[idx + 2] = 0;
                        imgData.data[idx + 3] = 0;
                    }
                } else {
                    imgData.data[idx] = 0;
                    imgData.data[idx + 1] = 0;
                    imgData.data[idx + 2] = 0;
                    imgData.data[idx + 3] = 0;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.lineWidth = 1;
        _drawScaledFoldedBorder(ctx, foldType, outW, outH, bounds);
    }

    function _drawScaledFoldedBorder(ctx, foldType, outW, outH, bounds) {
        var N = bounds.w * 2;
        var cx = outW / 2, cy = outH / 2;
        ctx.beginPath();
        switch (foldType) {
            case 'half-v':
                ctx.rect(0, 0, outW, outH);
                break;
            case 'half-h':
                ctx.rect(0, 0, outW, outH);
                break;
            case 'triangle':
                ctx.moveTo(0, 0);
                ctx.lineTo(outW, outH);
                ctx.lineTo(0, outH);
                ctx.closePath();
                break;
            case 'quarter':
                ctx.rect(0, 0, outW, outH);
                break;
            case 'hexagonal': {
                var oldCx = bounds.x + bounds.w / 2;
                var oldCy = bounds.y + bounds.h / 2;
                var maxDist = Math.min(bounds.w, bounds.h) / 2;
                var scale = Math.min(outW / bounds.w, outH / bounds.h);
                var displayR = maxDist * scale;
                var newCx = outW / 2, newCy = outH / 2;
                ctx.moveTo(newCx, newCy);
                ctx.arc(newCx, newCy, displayR, 0, Math.PI / 3);
                ctx.closePath();
                break;
            }
            case 'window': {
                var newCx = outW / 2, newCy = outH / 2;
                var displayR = Math.min(outW, outH) / 2;
                ctx.moveTo(newCx, newCy);
                ctx.arc(newCx, newCy, displayR, 0, Math.PI / 4);
                ctx.closePath();
                break;
            }
            case 'round': {
                var newCx = outW / 2, newCy = outH / 2;
                var displayR = Math.min(outW, outH) / 2;
                ctx.moveTo(newCx, newCy);
                ctx.arc(newCx, newCy, displayR, 0, Math.PI / 6);
                ctx.closePath();
                break;
            }
        }
        ctx.stroke();
    }

    function getFoldedDisplayBounds(foldType, N) {
        switch (foldType) {
            case 'half-v': return { x: 0, y: 0, w: N / 2, h: N };
            case 'half-h': return { x: 0, y: 0, w: N, h: N / 2 };
            case 'triangle': return { x: 0, y: 0, w: N, h: N };
            case 'quarter': return { x: 0, y: 0, w: N / 2, h: N / 2 };
            case 'hexagonal': return { x: 0, y: 0, w: N, h: N };
            case 'window': return { x: 0, y: 0, w: N, h: N };
            case 'round': return { x: 0, y: 0, w: N, h: N };
            default: return { x: 0, y: 0, w: N, h: N };
        }
    }

    function gridToCanvasCoord(gx, gy, N, displaySize, offsetX, offsetY) {
        var scale = displaySize / N;
        return {
            x: offsetX + gx * scale,
            y: offsetY + gy * scale
        };
    }

    function canvasToGridCoord(cx, cy, N, displaySize, offsetX, offsetY) {
        var scale = displaySize / N;
        return {
            x: Math.floor((cx - offsetX) / scale),
            y: Math.floor((cy - offsetY) / scale)
        };
    }

    return {
        GRID_SIZE: GRID,
        FOLD_INFO: FOLD_INFO,
        createGrid: createGrid,
        cloneGrid: cloneGrid,
        isInFoldedRegion: isInFoldedRegion,
        getSymmetryPoints: getSymmetryPoints,
        applyCutToMask: applyCutToMask,
        unfold: unfold,
        computeTarget: computeTarget,
        computeCutMask: computeCutMask,
        comparePatterns: comparePatterns,
        computeUtilization: computeUtilization,
        renderPatternToCanvas: renderPatternToCanvas,
        renderFoldedView: renderFoldedView,
        renderFoldedViewScaled: renderFoldedViewScaled,
        getFoldedDisplayBounds: getFoldedDisplayBounds,
        gridToCanvasCoord: gridToCanvasCoord,
        canvasToGridCoord: canvasToGridCoord
    };
})();
