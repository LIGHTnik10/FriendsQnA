import { kv } from "@vercel/kv";
import { GameState, Player, getRandomQuestions } from "@/types/game";

const GAME_PREFIX = "game:";
const GAME_TTL = 3600; // 1 hour expiry

function gameKey(lobbyCode: string): string {
  return `${GAME_PREFIX}${lobbyCode}`;
}

export function createGameState(lobbyCode: string): GameState {
  return {
    lobbyCode,
    players: [],
    phase: "lobby",
    currentRound: null,
    currentQuestionerIndex: 0,
    roundNumber: 0,
    questionOptions: [],
    resultsShownAt: null,
  };
}

export async function getGame(lobbyCode: string): Promise<GameState | null> {
  return await kv.get<GameState>(gameKey(lobbyCode));
}

async function saveGame(game: GameState): Promise<void> {
  await kv.set(gameKey(game.lobbyCode), game, { ex: GAME_TTL });
}

export async function createOrJoinGame(
  lobbyCode: string,
  playerId: string,
  playerName: string,
  isHost: boolean
): Promise<GameState> {
  let game = await getGame(lobbyCode);

  if (!game) {
    game = createGameState(lobbyCode);
  }

  // Check if player already exists
  const existingPlayer = game.players.find((p) => p.id === playerId);
  if (!existingPlayer) {
    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: isHost || game.players.length === 0,
    };
    game.players.push(player);
  }

  await saveGame(game);
  return game;
}

export async function startGame(lobbyCode: string): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game || game.players.length < 2) return null;

  game.phase = "question-select";
  game.currentQuestionerIndex = 0;
  game.roundNumber = 1;
  game.questionOptions = getRandomQuestions(3);
  game.currentRound = {
    questionerId: game.players[0].id,
    question: "",
    votes: [],
  };

  await saveGame(game);
  return game;
}

export async function submitQuestion(lobbyCode: string, question: string): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game || !game.currentRound) return null;

  game.currentRound.question = question;
  game.phase = "voting";

  await saveGame(game);
  return game;
}

export async function submitVote(
  lobbyCode: string,
  voterId: string,
  votedForId: string
): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game || !game.currentRound) return null;

  // Check if already voted
  const existingVote = game.currentRound.votes.find((v) => v.voterId === voterId);
  if (existingVote) return game;

  game.currentRound.votes.push({ voterId, votedForId });

  // Check if all players have voted
  if (game.currentRound.votes.length === game.players.length) {
    calculateResults(game);
  }

  await saveGame(game);
  return game;
}

function calculateResults(game: GameState) {
  if (!game.currentRound) return;

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
  const mostVoted = results.filter((r) => r.voteCount === maxVotes).map((r) => r.playerId);

  game.currentRound.results = { votes: results, mostVoted };
  game.phase = "results";
  game.resultsShownAt = Date.now();
}

export async function checkAndAdvanceRound(lobbyCode: string): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game || game.phase !== "results" || !game.resultsShownAt) return game;

  // Check if 15 seconds have passed
  if (Date.now() - game.resultsShownAt >= 15000) {
    game.currentQuestionerIndex = (game.currentQuestionerIndex + 1) % game.players.length;
    game.roundNumber++;
    game.phase = "question-select";
    game.questionOptions = getRandomQuestions(3);
    game.currentRound = {
      questionerId: game.players[game.currentQuestionerIndex].id,
      question: "",
      votes: [],
    };
    game.resultsShownAt = null;
    await saveGame(game);
  }

  return game;
}

export async function endGame(lobbyCode: string): Promise<boolean> {
  await kv.del(gameKey(lobbyCode));
  return true;
}
