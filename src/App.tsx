import React, { useState, useEffect, useRef } from 'react';
import './App.css';

type Player = 'O' | 'X' | null;
type Difficulty = 'easy' | 'normal' | 'hard';
type Screen = 'cover' | 'game';

interface SwipeState {
  index: number | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('cover');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);
  const [winner, setWinner] = useState<Player | 'DRAW' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);

  // 脳トレ計測用ステート
  const [scores, setScores] = useState({ player: 0, pc: 0, draw: 0 });
  const [turnStartTime, setTurnStartTime] = useState<number>(Date.now());
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [lastReaction, setLastReaction] = useState<number | null>(null);

  // フリック操作用ステート
  const [swipe, setSwipe] = useState<SwipeState>({
    index: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [hintIndex, setHintIndex] = useState<number | null>(null);

  const aiTimeoutRef = useRef<number | null>(null);

  // 勝敗判定
  const checkWinner = (currentBoard: Player[]) => {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (
        currentBoard[a] &&
        currentBoard[a] === currentBoard[b] &&
        currentBoard[a] === currentBoard[c]
      ) {
        return { winner: currentBoard[a], line };
      }
    }
    if (currentBoard.every((cell) => cell !== null)) {
      return { winner: 'DRAW' as const, line: null };
    }
    return null;
  };

  // ゲーム開始・リセット
  const startGame = (selectedDiff?: Difficulty) => {
    if (aiTimeoutRef.current) {
      window.clearTimeout(aiTimeoutRef.current);
    }
    if (selectedDiff) {
      setDifficulty(selectedDiff);
    }
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setWinner(null);
    setWinningLine(null);
    setReactionTimes([]);
    setLastReaction(null);
    setHintIndex(null);
    setTurnStartTime(Date.now());
    setScreen('game');
  };

  // プレイヤーの手を確定
  const handlePlayerMove = (index: number) => {
    if (!isPlayerTurn || winner || board[index] !== null) return;

    const now = Date.now();
    const elapsed = Number(((now - turnStartTime) / 1000).toFixed(2));
    setLastReaction(elapsed);
    setReactionTimes((prev) => [...prev, elapsed]);
    setHintIndex(null);

    const nextBoard = [...board];
    nextBoard[index] = 'O';
    setBoard(nextBoard);

    const result = checkWinner(nextBoard);
    if (result) {
      setWinner(result.winner);
      setWinningLine(result.line);
      if (result.winner === 'O') {
        setScores((s) => ({ ...s, player: s.player + 1 }));
      } else if (result.winner === 'DRAW') {
        setScores((s) => ({ ...s, draw: s.draw + 1 }));
      }
    } else {
      setIsPlayerTurn(false);
    }
  };

  // PC（×）の思考ルーチン
  const getBestMove = (currentBoard: Player[], diff: Difficulty): number => {
    const emptyIndices = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter((val): val is number => val !== null);

    if (emptyIndices.length === 0) return -1;

    if (diff === 'easy') {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    if (diff === 'normal' && Math.random() < 0.45) {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    for (const idx of emptyIndices) {
      const copy = [...currentBoard];
      copy[idx] = 'X';
      if (checkWinner(copy)?.winner === 'X') return idx;
    }

    for (const idx of emptyIndices) {
      const copy = [...currentBoard];
      copy[idx] = 'O';
      if (checkWinner(copy)?.winner === 'O') return idx;
    }

    if (emptyIndices.includes(4)) return 4;

    const corners = [0, 2, 6, 8].filter((c) => emptyIndices.includes(c));
    if (corners.length > 0) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  };

  // PCのターン処理
  useEffect(() => {
    if (screen === 'game' && !isPlayerTurn && !winner) {
      aiTimeoutRef.current = window.setTimeout(() => {
        const move = getBestMove(board, difficulty);
        if (move !== -1) {
          const nextBoard = [...board];
          nextBoard[move] = 'X';
          setBoard(nextBoard);

          const result = checkWinner(nextBoard);
          if (result) {
            setWinner(result.winner);
            setWinningLine(result.line);
            if (result.winner === 'X') {
              setScores((s) => ({ ...s, pc: s.pc + 1 }));
            } else if (result.winner === 'DRAW') {
              setScores((s) => ({ ...s, draw: s.draw + 1 }));
            }
          } else {
            setIsPlayerTurn(true);
            setTurnStartTime(Date.now());
          }
        }
      }, 520);
    }

    return () => {
      if (aiTimeoutRef.current) {
        window.clearTimeout(aiTimeoutRef.current);
      }
    };
  }, [isPlayerTurn, winner, screen, board, difficulty]);

  // フリック操作
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    index: number
  ) => {
    if (!isPlayerTurn || winner || board[index] !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSwipe({
      index,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipe.index === null) return;
    setSwipe((prev) => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipe.index === null) return;

    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;
    const distance = Math.hypot(dx, dy);
    const targetIndex = swipe.index;

    setSwipe({
      index: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });

    if (distance >= 22) {
      handlePlayerMove(targetIndex);
    } else {
      setHintIndex(targetIndex);
      window.setTimeout(() => {
        setHintIndex((prev) => (prev === targetIndex ? null : prev));
      }, 1500);
    }
  };

  const avgReaction =
    reactionTimes.length > 0
      ? (
          reactionTimes.reduce((acc, cur) => acc + cur, 0) /
          reactionTimes.length
        ).toFixed(2)
      : '--';

  const getBrainRank = (avgStr: string) => {
    if (avgStr === '--') return '計測中';
    const val = parseFloat(avgStr);
    if (val <= 1.0) return '超神速脳！⚡';
    if (val <= 1.8) return 'キレキレ脳！✨';
    if (val <= 2.8) return 'バランス脳！🍊';
    return 'じっくり思考脳！🍀';
  };

  // 1. カバー画面
  if (screen === 'cover') {
    return (
      <div className="min-h-screen vivid-bg flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="relative z-10 w-full max-w-md bg-white rounded-[2.2rem] shadow-2xl border-4 border-orange-500 border-b-[10px] p-6 sm:p-8 text-center">
          <div className="inline-flex items-center gap-1.5 bg-lime-500 text-white px-4 py-1.5 rounded-full text-sm font-black tracking-wide mb-4 shadow-sm border-2 border-lime-600">
            <span>🧠 フリック脳トレバトル ✨</span>
          </div>

          <div className="flex justify-center items-center gap-4 my-3">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg border-4 border-white border-b-8 border-b-orange-700">
              <span className="text-5xl font-black text-white leading-none">
                〇
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-amber-100 border-2 border-amber-400 text-orange-600 font-black text-xl">
              VS
            </div>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center shadow-lg border-4 border-white border-b-8 border-b-green-700">
              <span className="text-5xl font-black text-white leading-none">
                ×
              </span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mt-2 mb-2">
            <span className="text-orange-600">○×</span>
            <span className="text-lime-600">脳トレ</span>
            ゲーム
          </h1>
          <p className="text-slate-600 text-sm font-bold mb-5">
            マスをシュッとフリックして先に3つ揃えよう！
          </p>

          <div className="bg-orange-50 rounded-2xl p-4 mb-6 text-left border-2 border-orange-300">
            <div className="text-orange-700 font-black text-sm mb-2">
              👉 カンタン遊び方
            </div>
            <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 font-bold">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                  〇
                </span>
                <span>
                  あなたは<strong className="text-orange-600">「〇」</strong>
                  ！マスを指でスッと払う（フリック）！
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-lime-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                  ×
                </span>
                <span>
                  パソコンは<strong className="text-lime-700">「×」</strong>
                  と対戦。タテ・ヨコ・ナナメ3つで勝利！
                </span>
              </li>
            </ul>
          </div>

          <div className="mb-6">
            <p className="text-xs font-black text-slate-500 mb-2">
              ▼ パソコンの強さをえらんでね
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'easy', label: 'やさしい', emoji: '🌱' },
                  { id: 'normal', label: 'ふつう', emoji: '🍊' },
                  { id: 'hard', label: 'つよい', emoji: '🔥' },
                ] as const
              ).map((item) => {
                const active = difficulty === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setDifficulty(item.id)}
                    className={`py-2.5 px-2 rounded-2xl font-black text-sm transition-all border-2 cursor-pointer ${
                      active
                        ? 'bg-lime-500 border-lime-700 border-b-4 text-white shadow-md scale-105'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-lime-50'
                    }`}
                  >
                    <div className="text-base">{item.emoji}</div>
                    <div>{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => startGame()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white font-black text-xl shadow-lg border-2 border-orange-700 border-b-8 active:border-b-2 active:translate-y-1 transition-all cursor-pointer"
          >
            ▶ ゲームスタート！
          </button>
        </div>
      </div>
    );
  }

  // 2. ゲーム画面
  return (
    <div className="min-h-screen vivid-bg flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="relative z-10 w-full max-w-md bg-white rounded-[2.2rem] shadow-2xl border-4 border-lime-600 border-b-[10px] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setScreen('cover')}
            className="px-3.5 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 border-2 border-orange-300 text-orange-800 font-black text-xs cursor-pointer"
          >
            🏠 表紙へ
          </button>

          <div className="bg-lime-500 text-white px-3.5 py-1.5 rounded-full border-2 border-lime-700 shadow-sm text-xs font-black">
            {difficulty === 'easy'
              ? '🌱 やさしい'
              : difficulty === 'normal'
                ? '🍊 ふつう'
                : '🔥 つよい'}
          </div>

          <button
            onClick={() => startGame()}
            className="px-3.5 py-2 rounded-xl bg-lime-100 hover:bg-lime-200 border-2 border-lime-400 text-lime-800 font-black text-xs cursor-pointer"
          >
            🔄 リセット
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-orange-500 text-white rounded-2xl p-2 text-center border-2 border-orange-700 border-b-4">
            <div className="text-[11px] font-black opacity-95">あなた (〇)</div>
            <div className="text-2xl font-black">
              {scores.player}
              <span className="text-xs ml-0.5">勝</span>
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl p-2 text-center border-2 border-amber-400 border-b-4">
            <div className="text-[11px] font-black text-amber-800">⚡ 平均反応</div>
            <div className="text-xl font-black text-slate-800 mt-0.5">
              {avgReaction}
              <span className="text-xs text-slate-600">秒</span>
            </div>
          </div>

          <div className="bg-lime-600 text-white rounded-2xl p-2 text-center border-2 border-lime-800 border-b-4">
            <div className="text-[11px] font-black opacity-95">PC (×)</div>
            <div className="text-2xl font-black">
              {scores.pc}
              <span className="text-xs ml-0.5">勝</span>
            </div>
          </div>
        </div>

        <div className="mb-4 text-center">
          {winner ? (
            <div
              className={`py-2.5 px-4 rounded-2xl font-black text-base border-2 border-b-4 ${
                winner === 'O'
                  ? 'bg-orange-500 text-white border-orange-700'
                  : winner === 'X'
                    ? 'bg-lime-600 text-white border-lime-800'
                    : 'bg-amber-300 text-slate-900 border-amber-500'
              }`}
            >
              {winner === 'O'
                ? '🎉 あなたの勝ち！'
                : winner === 'X'
                  ? '💪 パソコンの勝ち！'
                  : '✨ 引き分け！'}
            </div>
          ) : isPlayerTurn ? (
            <div className="py-2.5 px-4 rounded-2xl bg-orange-100 border-2 border-orange-500 text-orange-800 font-black text-sm">
              👉 マスをフリックして「〇」を置いてね！
            </div>
          ) : (
            <div className="py-2.5 px-4 rounded-2xl bg-lime-100 border-2 border-lime-600 text-lime-900 font-black text-sm">
              🤖 パソコンが考え中…
            </div>
          )}
        </div>

        <div className="bg-lime-500 p-3.5 rounded-3xl border-4 border-lime-700 border-b-8 shadow-inner">
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, index) => {
              const isWinCell = winningLine?.includes(index);
              const isSwipingThis = swipe.index === index;
              const dx = isSwipingThis
                ? Math.max(-24, Math.min(24, swipe.currentX - swipe.startX))
                : 0;
              const dy = isSwipingThis
                ? Math.max(-24, Math.min(24, swipe.currentY - swipe.startY))
                : 0;

              return (
                <div
                  key={index}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    transform: isSwipingThis
                      ? `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(1.06)`
                      : undefined,
                  }}
                  className={`relative aspect-square rounded-2xl flex items-center justify-center select-none ${
                    isWinCell
                      ? 'bg-yellow-300 border-4 border-orange-600 shadow-lg scale-105'
                      : cell === null && isPlayerTurn && !winner
                        ? 'bg-white hover:bg-orange-50 border-3 border-orange-300 border-b-4 border-b-orange-400 cursor-grab active:cursor-grabbing'
                        : 'bg-white border-2 border-lime-300'
                  }`}
                >
                  {cell === 'O' && (
                    <div className="w-4/5 h-4/5 rounded-full bg-orange-500 flex items-center justify-center shadow-md border-2 border-orange-700">
                      <span className="text-4xl sm:text-5xl font-black text-white">
                        〇
                      </span>
                    </div>
                  )}

                  {cell === 'X' && (
                    <div className="w-4/5 h-4/5 rounded-2xl bg-slate-800 flex items-center justify-center shadow-md border-2 border-slate-950">
                      <span className="text-4xl sm:text-5xl font-black text-lime-300">
                        ×
                      </span>
                    </div>
                  )}

                  {cell === null && isSwipingThis && (
                    <div className="w-3/4 h-3/4 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md scale-110">
                      <span className="text-3xl sm:text-4xl font-black">〇</span>
                    </div>
                  )}

                  {cell === null && hintIndex === index && !isSwipingThis && (
                    <div className="absolute inset-0 bg-orange-500/95 rounded-2xl flex flex-col items-center justify-center text-white p-1 text-center animate-bounce z-10 border-2 border-orange-700">
                      <span className="text-xs font-black">シュッとフリック！</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex-1 bg-orange-50 border-2 border-orange-300 rounded-2xl px-3 py-2 flex items-center justify-between text-xs font-black text-slate-700">
            <span className="text-orange-700">🏆 脳トレ判定</span>
            <span className="text-lime-700 text-sm">
              {getBrainRank(avgReaction)}
            </span>
          </div>

          {winner && (
            <button
              onClick={() => startGame()}
              className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-lime-500 text-white font-black text-sm shadow-md border-2 border-orange-700 border-b-4 cursor-pointer shrink-0"
            >
              🔄 もう1回！
            </button>
          )}
        </div>

        {lastReaction !== null && !winner && (
          <div className="mt-2 text-center text-xs font-bold text-slate-500">
            直前のフリック速度：
            <span className="text-orange-600 font-black">{lastReaction}秒</span>
          </div>
        )}
      </div>
    </div>
  );
}