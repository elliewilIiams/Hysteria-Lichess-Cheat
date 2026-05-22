import { getCurrentFen, isFlipped, getBoard } from "./lichess";

const API_URL = "http://127.0.0.1:5267/analyze";

interface MoveInfo {
  from: string;
  to: string;
  uci: string;
  san: string;
  score: number | null;
  mate: number | null;
}

interface AnalysisResponse {
  fen: string;
  moves: MoveInfo[];
}

// запрос анализа на бекенд
async function requestAnalysis(fen: string): Promise<AnalysisResponse | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// перевод клетки (e2) в координаты на доске
function squareToCoords(sq: string, flipped: boolean): [number, number] {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  return [
    flipped ? 7 - file : file,
    flipped ? rank : 7 - rank,
  ];
}

// цвета стрелок: от лучшего хода к 4-му
const ARROW_COLORS = ["rgba(0,200,83,0.85)", "rgba(0,150,255,0.7)", "rgba(255,170,0,0.6)", "rgba(180,80,255,0.5)"];

// рисуем SVG стрелки поверх доски
function drawArrows(moves: MoveInfo[]) {
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

  // маркеры-наконечники стрелок
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

  // линии стрелок
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

// панель с оценками ходов
function renderPanel(moves: MoveInfo[]) {
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

// основной цикл
let lastFen = "";
let lastMoves: MoveInfo[] = [];
let running = true;
let delay = 300;
let intervalId = setInterval(tick, delay);

chrome.storage?.local?.get("delay", (data: any) => {
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

  // фильтр: показываем только на своём ходу
  const myColor = isFlipped() ? "b" : "w";
  const turn = fen.split(" ")[1];
  if (turn !== myColor) {
    document.getElementById("hysteria-arrows")?.remove();
    document.getElementById("hysteria-panel")?.remove();
    lastFen = "";
    lastMoves = [];
    return;
  }

  // позиция не изменилась — перерисовываем если стрелки пропали
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

// обновляем позицию стрелок при скролле/ресайзе
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

// сообщения из popup
chrome.runtime?.onMessage?.addListener((msg: any) => {
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
