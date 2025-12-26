import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { GameState, Player, Vote, getRandomQuestions } from "./src/types/game";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store game states
const games = new Map<string, GameState>();

// Helper to generate game state
function createGameState(lobbyCode: string): GameState {
  return {
    lobbyCode,
    players: [],
    phase: "lobby",
    currentRound: null,
    currentQuestionerIndex: 0,
    roundNumber: 0,
  };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    let currentLobby: string | null = null;
    let currentPlayer: Player | null = null;

    socket.on("join-lobby", ({ lobbyCode, playerName, playerId, isHost }) => {
      currentLobby = lobbyCode;

      // Create or get game state
      if (!games.has(lobbyCode)) {
        games.set(lobbyCode, createGameState(lobbyCode));
      }

      const game = games.get(lobbyCode)!;

      // Check if player already exists
      const existingPlayer = game.players.find((p) => p.id === playerId);
      if (existingPlayer) {
        currentPlayer = existingPlayer;
      } else {
        currentPlayer = {
          id: playerId,
          name: playerName,
          isHost: isHost === true || game.players.length === 0,
        };
        game.players.push(currentPlayer);
      }

      socket.join(lobbyCode);

      // Emit current game state to all players in lobby
      io.to(lobbyCode).emit("game-state", game);

      console.log(`Player ${playerName} joined lobby ${lobbyCode}`);
    });

    socket.on("start-game", ({ lobbyCode }) => {
      const game = games.get(lobbyCode);
      if (!game) return;

      if (game.players.length < 2) {
        socket.emit("error", { message: "Need at least 2 players to start" });
        return;
      }

      // Start first round
      game.phase = "question-select";
      game.currentQuestionerIndex = 0;
      game.roundNumber = 1;
      game.currentRound = {
        questionerId: game.players[0].id,
        question: "",
        votes: [],
      };

      io.to(lobbyCode).emit("game-state", game);
      io.to(lobbyCode).emit("question-options", {
        questions: getRandomQuestions(3),
        questionerId: game.players[0].id,
      });
    });

    socket.on("submit-question", ({ lobbyCode, question }) => {
      const game = games.get(lobbyCode);
      if (!game || !game.currentRound) return;

      game.currentRound.question = question;
      game.phase = "voting";

      io.to(lobbyCode).emit("game-state", game);
    });

    socket.on("submit-vote", ({ lobbyCode, voterId, votedForId }) => {
      const game = games.get(lobbyCode);
      if (!game || !game.currentRound) return;

      // Check if already voted
      const existingVote = game.currentRound.votes.find(
        (v) => v.voterId === voterId
      );
      if (existingVote) return;

      game.currentRound.votes.push({ voterId, votedForId });

      // Check if all players have voted
      if (game.currentRound.votes.length === game.players.length) {
        // Calculate results
        const voteCounts = new Map<string, number>();
        game.players.forEach((p) => voteCounts.set(p.id, 0));

        game.currentRound.votes.forEach((vote) => {
          const current = voteCounts.get(vote.votedForId) || 0;
          voteCounts.set(vote.votedForId, current + 1);
        });

        const results = game.players
          .map((p) => ({
            playerId: p.id,
            playerName: p.name,
            voteCount: voteCounts.get(p.id) || 0,
          }))
          .sort((a, b) => b.voteCount - a.voteCount);

        const maxVotes = results[0].voteCount;
        const mostVoted = results
          .filter((r) => r.voteCount === maxVotes)
          .map((r) => r.playerId);

        game.currentRound.results = { votes: results, mostVoted };
        game.phase = "results";

        io.to(lobbyCode).emit("game-state", game);

        // Auto-advance to next round after 15 seconds
        setTimeout(() => {
          const currentGame = games.get(lobbyCode);
          if (!currentGame || currentGame.phase !== "results") return;

          // Move to next questioner
          currentGame.currentQuestionerIndex =
            (currentGame.currentQuestionerIndex + 1) %
            currentGame.players.length;
          currentGame.roundNumber++;
          currentGame.phase = "question-select";
          currentGame.currentRound = {
            questionerId:
              currentGame.players[currentGame.currentQuestionerIndex].id,
            question: "",
            votes: [],
          };

          io.to(lobbyCode).emit("game-state", currentGame);
          io.to(lobbyCode).emit("question-options", {
            questions: getRandomQuestions(3),
            questionerId:
              currentGame.players[currentGame.currentQuestionerIndex].id,
          });
        }, 15000);
      } else {
        io.to(lobbyCode).emit("vote-count", {
          count: game.currentRound.votes.length,
          total: game.players.length,
        });
      }
    });

    socket.on("end-game", ({ lobbyCode }) => {
      const game = games.get(lobbyCode);
      if (!game) return;

      games.delete(lobbyCode);
      io.to(lobbyCode).emit("game-ended");
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

      if (currentLobby && currentPlayer) {
        const game = games.get(currentLobby);
        if (game) {
          // Remove player from game
          game.players = game.players.filter((p) => p.id !== currentPlayer!.id);

          // If no players left, delete game
          if (game.players.length === 0) {
            games.delete(currentLobby);
          } else {
            // If host left, assign new host
            if (currentPlayer.isHost && game.players.length > 0) {
              game.players[0].isHost = true;
            }
            io.to(currentLobby).emit("game-state", game);
          }
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
