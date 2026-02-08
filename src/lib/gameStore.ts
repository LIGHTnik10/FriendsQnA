import { kv } from "@vercel/kv";
import { GameState, Player, getRandomQuestions } from "@/types/game";
import { v4 as uuidv4 } from "uuid";

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

// Get only real (non-phantom) players
function getRealPlayers(game: GameState): Player[] {
  return game.players.filter((p) => !p.isPhantom);
}

// Get next real player index for questioner rotation
function getNextQuestionerIndex(game: GameState): number {
  const realPlayers = getRealPlayers(game);
  if (realPlayers.length === 0) return 0;

  // Find current questioner's position in real players
  const currentQuestioner = game.currentRound?.questionerId;
  const currentIndex = realPlayers.findIndex((p) => p.id === currentQuestioner);

  // Get next real player
  const nextRealIndex = (currentIndex + 1) % realPlayers.length;
  const nextPlayer = realPlayers[nextRealIndex];

  // Return index in full players array
  return game.players.findIndex((p) => p.id === nextPlayer.id);
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
    const realPlayers = getRealPlayers(game);
    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: isHost || realPlayers.length === 0,
      isPhantom: false,
    };
    game.players.push(player);
  }

  await saveGame(game);
  return game;
}

export async function addPhantomPlayer(
  lobbyCode: string,
  playerName: string
): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game || game.phase !== "lobby") return null;

  const player: Player = {
    id: uuidv4(),
    name: playerName,
    isHost: false,
    isPhantom: true,
  };
  game.players.push(player);

  await saveGame(game);
  return game;
}

export async function removePhantomPlayer(
  lobbyCode: string,
  playerId: string
): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game || game.phase !== "lobby") return null;

  game.players = game.players.filter((p) => p.id !== playerId || !p.isPhantom);

  await saveGame(game);
  return game;
}

export async function startGame(lobbyCode: string): Promise<GameState | null> {
  const game = await getGame(lobbyCode);
  if (!game) return null;

  const realPlayers = getRealPlayers(game);
  if (realPlayers.length < 2) return null;

  // Find first real player to be questioner
  const firstRealPlayerIndex = game.players.findIndex((p) => !p.isPhantom);

  game.phase = "question-select";
  game.currentQuestionerIndex = firstRealPlayerIndex;
  game.roundNumber = 1;
  game.questionOptions = getRandomQuestions(3);
  game.currentRound = {
    questionerId: game.players[firstRealPlayerIndex].id,
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

  // Check if all REAL players have voted (phantom players don't vote)
  const realPlayers = getRealPlayers(game);
  if (game.currentRound.votes.length === realPlayers.length) {
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
    // Get next real player as questioner
    const nextIndex = getNextQuestionerIndex(game);
    game.currentQuestionerIndex = nextIndex;
    game.roundNumber++;
    game.phase = "question-select";
    game.questionOptions = getRandomQuestions(3);
    game.currentRound = {
      questionerId: game.players[nextIndex].id,
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
