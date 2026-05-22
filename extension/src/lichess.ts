// маппинг CSS-классов фигур Lichess в FEN-символы
const PIECE_CLASS_MAP: Record<string, string> = {
  pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k",
};

// проверяем перевёрнута ли доска (играем за чёрных)
export function isFlipped(): boolean {
  return document.querySelector(".cg-wrap.orientation-black") !== null;
}

// получаем элемент доски
export function getBoard(): HTMLElement | null {
  return document.querySelector("cg-board") as HTMLElement;
}

// получаем FEN текущей позиции
export function getCurrentFen(): string | null {
  // страница анализа — FEN в URL
  if (location.pathname.startsWith("/analysis")) {
    const parts = location.pathname.replace("/analysis/", "").replace("/analysis", "");
    const fen = decodeURIComponent(parts).replace(/_/g, " ");
    if (fen.includes("/")) return fen;
  }

  // поле ввода FEN (анализ/студия)
  const inp = document.querySelector(".copyable") as HTMLInputElement | null;
  if (inp?.value?.includes("/")) return inp.value;

  // живая партия — парсим фигуры из DOM
  return parseBoardDOM();
}

// парсим позицию из DOM-элементов фигур на доске
function parseBoardDOM(): string | null {
  const board = document.querySelector("cg-board") as HTMLElement | null;
  if (!board) return null;

  const pieces = board.querySelectorAll("piece");
  if (pieces.length < 2) return null;

  const flipped = isFlipped();
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));

  pieces.forEach((el) => {
    const cls = el.className;
    if (cls.includes("ghost")) return;

    const isWhite = cls.includes("white");
    let piece = "";
    for (const [name, letter] of Object.entries(PIECE_CLASS_MAP)) {
      if (cls.includes(name)) { piece = letter; break; }
    }
    if (!piece) return;

    // позиция фигуры через CSS transform
    const style = (el as HTMLElement).style.transform || (el as HTMLElement).getAttribute("style") || "";
    const matchPct = style.match(/translate\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
    const matchPx = style.match(/translate\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\)/);

    let file: number, rank: number;
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

    // пересчёт координат с учётом ориентации доски
    let r: number, f: number;
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

  // собираем FEN-строку из сетки
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      if (grid[r][f]) {
        if (empty) { fen += empty; empty = 0; }
        fen += grid[r][f];
      } else {
        empty++;
      }
    }
    if (empty) fen += empty;
    if (r < 7) fen += "/";
  }

  // определяем чей ход по количеству полуходов в списке ходов
  const moveList = document.querySelector("l4x, .moves, rm6");
  let moveCount = 0;
  if (moveList) {
    const moveEls = moveList.querySelectorAll("kwdb, u8t, move");
    moveCount = moveEls.length;
  }
  const turn = moveCount % 2 === 0 ? "w" : "b";

  return fen + " " + turn + " KQkq - 0 1";
}
