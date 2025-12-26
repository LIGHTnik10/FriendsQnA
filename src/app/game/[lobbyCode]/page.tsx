"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { GameState, Player, RoundResults } from "@/types/game";

interface PageProps {
  params: Promise<{ lobbyCode: string }>;
}

export default function GamePage({ params }: PageProps) {
  const { lobbyCode } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const playerName = searchParams.get("name") || "Player";
  const playerId = searchParams.get("playerId") || "";
  const isHost = searchParams.get("host") === "true";

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [resultsTimer, setResultsTimer] = useState(15);
  const [connected, setConnected] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const lastPhaseRef = useRef<string>("");

  const currentPlayer = gameState?.players.find((p) => p.id === playerId);
  const isCurrentPlayerHost = currentPlayer?.isHost || false;
  const isQuestioner = gameState?.currentRound?.questionerId === playerId;

  // Join game on mount
  useEffect(() => {
    const joinGame = async () => {
      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "join",
            lobbyCode,
            playerId,
            playerName,
            isHost,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
          setConnected(true);
        }
      } catch (error) {
        console.error("Failed to join game:", error);
      }
    };
    joinGame();
  }, [lobbyCode, playerId, playerName, isHost]);

  // Poll for game state updates
  useEffect(() => {
    if (!connected || gameEnded) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game?lobbyCode=${lobbyCode}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);

          // Reset hasVoted when phase changes to voting
          if (data.phase === "voting" && lastPhaseRef.current !== "voting") {
            setHasVoted(false);
          }

          // Reset timer when entering results phase
          if (data.phase === "results" && lastPhaseRef.current !== "results") {
            setResultsTimer(15);
          }

          lastPhaseRef.current = data.phase;
        } else if (res.status === 404) {
          setGameEnded(true);
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to fetch game state:", error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [connected, lobbyCode, gameEnded, router]);

  // Results countdown timer
  useEffect(() => {
    if (gameState?.phase === "results" && resultsTimer > 0) {
      const timer = setTimeout(() => setResultsTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, resultsTimer]);

  const startGame = useCallback(async () => {
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", lobbyCode }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to start game");
      }
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  }, [lobbyCode]);

  const submitQuestion = useCallback(
    async (question: string) => {
      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit-question", lobbyCode, question }),
        });
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
        }
      } catch (error) {
        console.error("Failed to submit question:", error);
      }
    },
    [lobbyCode]
  );

  const submitVote = useCallback(
    async (votedForId: string) => {
      if (hasVoted) return;
      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "vote", lobbyCode, playerId, votedForId }),
        });
        if (res.ok) {
          setHasVoted(true);
          const data = await res.json();
          setGameState(data);
        }
      } catch (error) {
        console.error("Failed to submit vote:", error);
      }
    },
    [lobbyCode, playerId, hasVoted]
  );

  const endGame = useCallback(async () => {
    try {
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", lobbyCode }),
      });
      setGameEnded(true);
      router.push("/");
    } catch (error) {
      console.error("Failed to end game:", error);
    }
  }, [lobbyCode, router]);

  if (!connected || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-xl">Connecting...</div>
      </div>
    );
  }

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${lobbyCode}`
      : "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-white">
          <span className="text-sm text-gray-300">Lobby:</span>
          <span className="ml-2 font-mono text-xl font-bold tracking-widest">
            {lobbyCode}
          </span>
        </div>
        {isCurrentPlayerHost && (
          <button
            onClick={endGame}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            End Game
          </button>
        )}
      </div>

      {/* Lobby Phase */}
      {gameState.phase === "lobby" && (
        <LobbyPhase
          players={gameState.players}
          isHost={isCurrentPlayerHost}
          lobbyCode={lobbyCode}
          joinUrl={joinUrl}
          onStartGame={startGame}
        />
      )}

      {/* Question Selection Phase */}
      {gameState.phase === "question-select" && (
        <QuestionSelectPhase
          isQuestioner={isQuestioner}
          questionOptions={gameState.questionOptions}
          customQuestion={customQuestion}
          showCustomInput={showCustomInput}
          questioner={gameState.players.find(
            (p) => p.id === gameState.currentRound?.questionerId
          )}
          roundNumber={gameState.roundNumber}
          onSelectQuestion={submitQuestion}
          onCustomQuestionChange={setCustomQuestion}
          onToggleCustomInput={() => setShowCustomInput(!showCustomInput)}
        />
      )}

      {/* Voting Phase */}
      {gameState.phase === "voting" && gameState.currentRound && (
        <VotingPhase
          question={gameState.currentRound.question}
          players={gameState.players}
          hasVoted={hasVoted}
          voteCount={{
            count: gameState.currentRound.votes.length,
            total: gameState.players.length,
          }}
          onVote={submitVote}
        />
      )}

      {/* Results Phase */}
      {gameState.phase === "results" && gameState.currentRound?.results && (
        <ResultsPhase
          question={gameState.currentRound.question}
          results={gameState.currentRound.results}
          players={gameState.players}
          timer={resultsTimer}
        />
      )}
    </main>
  );
}

// Lobby Phase Component
function LobbyPhase({
  players,
  isHost,
  lobbyCode,
  joinUrl,
  onStartGame,
}: {
  players: Player[];
  isHost: boolean;
  lobbyCode: string;
  joinUrl: string;
  onStartGame: () => void;
}) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Waiting for Players</h2>
        <p className="text-gray-300">Share the QR code or lobby code to invite friends</p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
        <QRCodeSVG value={joinUrl} size={200} />
        <p className="mt-4 text-gray-600 text-sm">Scan to join</p>
        <p className="font-mono text-2xl font-bold tracking-widest text-gray-800 mt-2">
          {lobbyCode}
        </p>
      </div>

      {/* Players List */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">
          Players ({players.length})
        </h3>
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3"
            >
              <span className="text-white">{player.name}</span>
              {player.isHost && (
                <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full font-semibold">
                  HOST
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Start Button (Host Only) */}
      {isHost && (
        <button
          onClick={onStartGame}
          disabled={players.length < 2}
          className={`w-full py-4 px-6 font-semibold rounded-xl transition-all ${
            players.length >= 2
              ? "bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white transform hover:scale-105"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {players.length < 2 ? "Need at least 2 players" : "Start Game"}
        </button>
      )}

      {!isHost && (
        <div className="text-center text-gray-300">
          Waiting for host to start the game...
        </div>
      )}
    </div>
  );
}

// Question Selection Phase Component
function QuestionSelectPhase({
  isQuestioner,
  questionOptions,
  customQuestion,
  showCustomInput,
  questioner,
  roundNumber,
  onSelectQuestion,
  onCustomQuestionChange,
  onToggleCustomInput,
}: {
  isQuestioner: boolean;
  questionOptions: string[];
  customQuestion: string;
  showCustomInput: boolean;
  questioner?: Player;
  roundNumber: number;
  onSelectQuestion: (question: string) => void;
  onCustomQuestionChange: (value: string) => void;
  onToggleCustomInput: () => void;
}) {
  if (!isQuestioner) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <div className="text-6xl mb-4">🤔</div>
          <h2 className="text-2xl font-bold text-white mb-2">Round {roundNumber}</h2>
          <p className="text-gray-300">
            <span className="font-semibold text-white">{questioner?.name || "Someone"}</span> is
            picking a question...
          </p>
          <div className="mt-6 flex justify-center">
            <div className="animate-pulse flex space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animation-delay-200"></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animation-delay-400"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Round {roundNumber}</h2>
        <p className="text-gray-300">Pick a question for everyone to vote on!</p>
      </div>

      <div className="space-y-3">
        {questionOptions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSelectQuestion(question)}
            className="w-full text-left p-4 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-xl text-white transition-all border border-white/20 hover:border-white/40"
          >
            {question}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 bg-transparent text-gray-400 text-sm">or</span>
        </div>
      </div>

      {!showCustomInput ? (
        <button
          onClick={onToggleCustomInput}
          className="w-full py-4 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all border border-dashed border-white/30"
        >
          Write Custom Question
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => onCustomQuestionChange(e.target.value)}
            placeholder="Type your question..."
            className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => onSelectQuestion(customQuestion)}
              disabled={!customQuestion.trim()}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
            <button
              onClick={onToggleCustomInput}
              className="py-3 px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Voting Phase Component
function VotingPhase({
  question,
  players,
  hasVoted,
  voteCount,
  onVote,
}: {
  question: string;
  players: Player[];
  hasVoted: boolean;
  voteCount: { count: number; total: number };
  onVote: (playerId: string) => void;
}) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 mb-4">
          <p className="text-white text-xl font-semibold">{question}</p>
        </div>
        <p className="text-gray-300">Who fits this description best?</p>
      </div>

      {!hasVoted ? (
        <div className="grid grid-cols-2 gap-3">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => onVote(player.id)}
              className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-xl text-white transition-all border border-white/20 hover:border-white/40 hover:scale-105"
            >
              {player.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-white text-xl font-semibold mb-2">Vote submitted!</p>
          <p className="text-gray-300">
            Waiting for others... ({voteCount.count}/{voteCount.total})
          </p>
          <div className="mt-4 w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
              style={{
                width: `${(voteCount.count / voteCount.total) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Results Phase Component
function ResultsPhase({
  question,
  results,
  players,
  timer,
}: {
  question: string;
  results: RoundResults;
  players: Player[];
  timer: number;
}) {
  const winner = players.find((p) => results.mostVoted.includes(p.id));

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4">
          <p className="text-white text-lg">{question}</p>
        </div>
      </div>

      {/* Winner Announcement */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-2">🏆</div>
        <p className="text-white/80 text-sm mb-1">Most Voted</p>
        <p className="text-white text-3xl font-bold">
          {results.mostVoted.length > 1
            ? results.mostVoted
                .map((id) => players.find((p) => p.id === id)?.name)
                .join(" & ")
            : winner?.name}
        </p>
        <p className="text-white/80 mt-2">
          {results.votes[0].voteCount} vote{results.votes[0].voteCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* All Results */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">All Votes</h3>
        <div className="space-y-3">
          {results.votes.map((result, index) => (
            <div
              key={result.playerId}
              className={`flex items-center justify-between p-3 rounded-xl ${
                index === 0 ? "bg-yellow-500/20" : "bg-white/5"
              }`}
            >
              <div className="flex items-center space-x-3">
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold ${
                    index === 0
                      ? "bg-yellow-500 text-yellow-900"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="text-white">{result.playerName}</span>
              </div>
              <span className="text-white font-semibold">
                {result.voteCount} vote{result.voteCount !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Round Timer */}
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 bg-white/10 rounded-full px-6 py-3">
          <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full font-bold text-white">
            {timer}
          </div>
          <span className="text-gray-300">Next round starting...</span>
        </div>
      </div>
    </div>
  );
}
