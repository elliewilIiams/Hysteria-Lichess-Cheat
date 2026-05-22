from flask import Flask, request, jsonify
from flask_cors import CORS
import chess
import chess.engine
import shutil
import threading
import atexit
import signal
import sys

#создание аппки
app = Flask(__name__)
CORS(app)

#базовое расположение стокфиша, можно указать свой путь 
STOCKFISH_PATH = shutil.which("stockfish") or "D:/stockfish/stockfish-windows-x86-64.exe"
#ограничение в 300 мс 
LIMIT = chess.engine.Limit(time=0.3)
#количество вариантов, которые возвращает движок
MULTIPV = 4

#переменная движка
_engine = None
#блокировка потока для беспрерывной работы движка
_lock = threading.Lock()

#запуск движка
def get_engine():
    global _engine
    if _engine is None:
        _engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        print("Stockfish запустился (engine started)")
    return _engine

#если движок заглох (90% случаев из-за НЕВАЛИДНЫХ данных FEN)
def restart_engine():
    global _engine
    try:
        if _engine:
            _engine.quit()
            print("Движок сдох, перезапускаю (restarting)")
    except Exception:
        pass
    _engine = None
    return get_engine()

#при закрытии сервера чтобы движок не ебашил в холостую (после закрытие сервера процесс stockfish-windows-x86-64.exe не умирает )
def safe_shutdown():
    global _engine
    with _lock:
        if _engine:
            try:
                _engine.quit()
            except Exception:
                pass
            _engine = None


atexit.register(safe_shutdown)

#валидация фена с фронтенда чтоб не заставлять движок глохнуть из-за помойных данных
def validate_fen(fen: str) -> chess.Board | None:
    try:
        board = chess.Board(fen)
        if not board.is_valid():
            board.set_castling_fen("-")
            if not board.is_valid():
                return None
        return board
    except Exception:
        return None

#на локальном порту эндпоинт /analyze принимает пост запрос с положением на доске 
# post 200 возвращает валидные данные от движка в виде массива ходов, оценки и вариантов мата
# post 400 в случае если фен не валид или не передан
# post 500 если движок сдох
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True)
    fen = data.get("fen")
    if not fen:
        return jsonify({"error": "where is fen?"}), 400

    board = validate_fen(fen)
    if not board:
        return jsonify({"error": "fen is invalid"}), 400

    if board.is_game_over():
        return jsonify({"fen": fen, "moves": []})

    moves = []
    with _lock:
        for attempt in range(2):
            try:
                #обращение к движку
                eng = get_engine()
                results = eng.analyse(board, LIMIT, multipv=MULTIPV)
                for info in results:
                    pv = info.get("pv", [])
                    score = info.get("score")
                    if pv and board.is_legal(pv[0]):
                        #заполнение массива для возвращения на фронт
                        moves.append({
                            "from": chess.square_name(pv[0].from_square),
                            "to": chess.square_name(pv[0].to_square),
                            "uci": pv[0].uci(),
                            "san": board.san(pv[0]),
                            "score": score.relative.score(mate_score=10000) if score else None,
                            "mate": score.relative.mate() if score and score.relative.is_mate() else None,
                        })
                break
            except chess.engine.EngineTerminatedError:
                restart_engine()
                if attempt == 1:
                    return jsonify({"error": "engine is 200"}), 500
            except Exception:
                if attempt == 1:
                    return jsonify({"error": "analysis failed"}), 500
                restart_engine()

    return jsonify({"fen": fen, "moves": moves})

#запуск сервера на локальном порту 5267
if __name__ == "__main__":
    get_engine()
    print(f"Hysteria backend running on http://127.0.0.1:5267")
    app.run(host="127.0.0.1", port=5267, debug=False, threaded=False)
