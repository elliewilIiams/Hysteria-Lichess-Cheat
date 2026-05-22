"use strict";
(() => {
  // src/lichess.ts
  var PIECE_CLASS_MAP = {
    pawn: "p",
    knight: "n",
    bishop: "b",
    rook: "r",
    queen: "q",
    king: "k"
  };
  function isFlipped() {
    return document.querySelector(".cg-wrap.orientation-black") !== null;
  }
  function getBoard() {
    return document.querySelector("cg-board");
  }
  function getCurrentFen() {
    if (location.pathname.startsWith("/analysis")) {
      const parts = location.pathname.replace("/analysis/", "").replace("/analysis", "");
      const fen = decodeURIComponent(parts).replace(/_/g, " ");
      if (fen.includes("/")) return fen;
    }
    const inp = document.querySelector(".copyable");
    if (inp?.value?.includes("/")) return inp.value;
    return parseBoardDOM();
  }
  function parseBoardDOM() {
    const board = document.querySelector("cg-board");
    if (!board) return null;
    const pieces = board.querySelectorAll("piece");
    if (pieces.length < 2) return null;
    const flipped = isFlipped();
    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    pieces.forEach((el) => {
      const cls = el.className;
      if (cls.includes("ghost")) return;
      const isWhite = cls.includes("white");
      let piece = "";
      for (const [name, letter] of Object.entries(PIECE_CLASS_MAP)) {
        if (cls.includes(name)) {
          piece = letter;
          break;
        }
      }
      if (!piece) return;
      const style = el.style.transform || el.getAttribute("style") || "";
      const matchPct = style.match(/translate\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
      const matchPx = style.match(/translate\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\)/);
      let file, rank;
      if (matchPct) {
        file = Math.round(parseFloat(matchPct[1]) / 12.5);
        rank = Math.round(parseFloat(matchPct[2]) / 12.5);
      } else if (matchPx) {
        const boardSize = board.getBoundingClientRect().width;
        const cellSize = boardSize / 8;
        file = Math.round(parseFloat(matchPx[1]) / cellSize);
        rank = Math.round(parseFloat(matchPx[2]) / cellSize);
      } else {
        return;
      }
      let r, f;
      if (flipped) {
        f = 7 - file;
        r = 7 - rank;
      } else {
        f = file;
        r = rank;
      }
      if (f >= 0 && f < 8 && r >= 0 && r < 8) {
        grid[r][f] = isWhite ? piece.toUpperCase() : piece;
      }
    });
    let fen = "";
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        if (grid[r][f]) {
          if (empty) {
            fen += empty;
            empty = 0;
          }
          fen += grid[r][f];
        } else {
          empty++;
        }
      }
      if (empty) fen += empty;
      if (r < 7) fen += "/";
    }
    const moveList = document.querySelector("l4x, .moves, rm6");
    let moveCount = 0;
    if (moveList) {
      const moveEls = moveList.querySelectorAll("kwdb, u8t, move");
      moveCount = moveEls.length;
    }
    const turn = moveCount % 2 === 0 ? "w" : "b";
    return fen + " " + turn + " KQkq - 0 1";
  }

  // src/content.ts
  var API_URL = "http://127.0.0.1:5267/analyze";
  async function requestAnalysis(fen) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  function squareToCoords(sq, flipped) {
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1]) - 1;
    return [
      flipped ? 7 - file : file,
      flipped ? rank : 7 - rank
    ];
  }
  var ARROW_COLORS = ["rgba(0,200,83,0.85)", "rgba(0,150,255,0.7)", "rgba(255,170,0,0.6)", "rgba(180,80,255,0.5)"];
  function drawArrows(moves) {
    document.getElementById("hysteria-arrows")?.remove();
    if (!moves.length) return;
    const board = getBoard();
    if (!board) return;
    const rect = board.getBoundingClientRect();
    if (rect.width === 0) return;
    const size = rect.width;
    const cellSize = size / 8;
    const flipped = isFlipped();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "hysteria-arrows";
    svg.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${size}px;height:${size}px;pointer-events:none;z-index:99999;`;
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    moves.forEach((_, i) => {
      const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      marker.setAttribute("id", `hh-${i}`);
      marker.setAttribute("markerWidth", "3");
      marker.setAttribute("markerHeight", "3");
      marker.setAttribute("refX", "1.5");
      marker.setAttribute("refY", "1.5");
      marker.setAttribute("orient", "auto");
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("points", "0,0 3,1.5 0,3");
      poly.setAttribute("fill", ARROW_COLORS[i] || ARROW_COLORS[0]);
      marker.appendChild(poly);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);
    moves.forEach((move, i) => {
      const [x1, y1] = squareToCoords(move.from, flipped);
      const [x2, y2] = squareToCoords(move.to, flipped);
      const cx1 = x1 * cellSize + cellSize / 2;
      const cy1 = y1 * cellSize + cellSize / 2;
      const cx2 = x2 * cellSize + cellSize / 2;
      const cy2 = y2 * cellSize + cellSize / 2;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(cx1));
      line.setAttribute("y1", String(cy1));
      line.setAttribute("x2", String(cx2));
      line.setAttribute("y2", String(cy2));
      line.setAttribute("stroke", ARROW_COLORS[i] || ARROW_COLORS[0]);
      line.setAttribute("stroke-width", String(i === 0 ? 10 : 6));
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("marker-end", `url(#hh-${i})`);
      line.setAttribute("opacity", String(i === 0 ? 0.9 : 0.6));
      svg.appendChild(line);
    });
    document.body.appendChild(svg);
  }
  function renderPanel(moves) {
    let panel = document.getElementById("hysteria-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "hysteria-panel";
      document.body.appendChild(panel);
    }
    if (!moves.length) {
      panel.innerHTML = `<div class="hp-title">Hysteria</div><div class="hp-empty">Waiting...</div>`;
      return;
    }
    const rows = moves.map((m, i) => {
      const scoreText = m.mate !== null ? `M${m.mate}` : ((m.score ?? 0) / 100).toFixed(2);
      const color = ARROW_COLORS[i] || "#fff";
      return `<div class="hp-row${i === 0 ? " hp-best" : ""}"><span class="hp-dot" style="background:${color}"></span><span class="hp-score">${scoreText}</span></div>`;
    }).join("");
    panel.innerHTML = `<div class="hp-title">Hysteria</div>${rows}`;
  }
  var lastFen = "";
  var lastMoves = [];
  var running = true;
  var delay = 300;
  var intervalId = setInterval(tick, delay);
  chrome.storage?.local?.get("delay", (data) => {
    if (data?.delay) {
      delay = data.delay;
      clearInterval(intervalId);
      intervalId = setInterval(tick, delay);
    }
  });
  async function tick() {
    if (!running) return;
    const fen = getCurrentFen();
    if (!fen) return;
    const myColor = isFlipped() ? "b" : "w";
    const turn = fen.split(" ")[1];
    if (turn !== myColor) {
      document.getElementById("hysteria-arrows")?.remove();
      document.getElementById("hysteria-panel")?.remove();
      lastFen = "";
      lastMoves = [];
      return;
    }
    if (fen === lastFen) {
      if (lastMoves.length && !document.getElementById("hysteria-arrows")) {
        drawArrows(lastMoves);
        renderPanel(lastMoves);
      }
      return;
    }
    lastFen = fen;
    const data = await requestAnalysis(fen);
    if (!data?.moves?.length) {
      lastMoves = [];
      return;
    }
    lastMoves = data.moves;
    drawArrows(data.moves);
    renderPanel(data.moves);
  }
  function updateArrowPos() {
    const svg = document.getElementById("hysteria-arrows");
    const board = getBoard();
    if (svg && board) {
      const rect = board.getBoundingClientRect();
      svg.style.top = rect.top + "px";
      svg.style.left = rect.left + "px";
    }
  }
  window.addEventListener("scroll", updateArrowPos, { passive: true });
  window.addEventListener("resize", updateArrowPos, { passive: true });
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === "toggle") {
      running = !running;
      if (!running) {
        document.getElementById("hysteria-arrows")?.remove();
        document.getElementById("hysteria-panel")?.remove();
        lastMoves = [];
      }
    }
    if (msg.type === "setDelay") {
      delay = msg.delay || 500;
      clearInterval(intervalId);
      intervalId = setInterval(tick, delay);
    }
  });
})();
