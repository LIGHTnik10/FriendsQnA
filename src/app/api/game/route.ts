import { NextRequest, NextResponse } from "next/server";
import {
  getGame,
  createOrJoinGame,
  startGame,
  submitQuestion,
  submitVote,
  checkAndAdvanceRound,
  endGame,
} from "@/lib/gameStore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lobbyCode = searchParams.get("lobbyCode");

  if (!lobbyCode) {
    return NextResponse.json({ error: "Lobby code required" }, { status: 400 });
  }

  // Check and advance round if in results phase
  const game = checkAndAdvanceRound(lobbyCode);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(game);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, lobbyCode, playerId, playerName, isHost, question, votedForId } = body;

  switch (action) {
    case "join": {
      if (!lobbyCode || !playerId || !playerName) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const game = createOrJoinGame(lobbyCode, playerId, playerName, isHost);
      return NextResponse.json(game);
    }

    case "start": {
      if (!lobbyCode) {
        return NextResponse.json({ error: "Lobby code required" }, { status: 400 });
      }
      const game = startGame(lobbyCode);
      if (!game) {
        return NextResponse.json({ error: "Cannot start game" }, { status: 400 });
      }
      return NextResponse.json(game);
    }

    case "submit-question": {
      if (!lobbyCode || !question) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const game = submitQuestion(lobbyCode, question);
      if (!game) {
        return NextResponse.json({ error: "Cannot submit question" }, { status: 400 });
      }
      return NextResponse.json(game);
    }

    case "vote": {
      if (!lobbyCode || !playerId || !votedForId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const game = submitVote(lobbyCode, playerId, votedForId);
      if (!game) {
        return NextResponse.json({ error: "Cannot submit vote" }, { status: 400 });
      }
      return NextResponse.json(game);
    }

    case "end": {
      if (!lobbyCode) {
        return NextResponse.json({ error: "Lobby code required" }, { status: 400 });
      }
      endGame(lobbyCode);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
