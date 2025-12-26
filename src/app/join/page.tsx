"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyCode = searchParams.get("code") || "";

  const [name, setName] = useState("");

  const joinLobby = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }
    const playerId = uuidv4();
    router.push(`/game/${lobbyCode}?name=${encodeURIComponent(name)}&playerId=${playerId}`);
  };

  return (
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-2">Friends Q&A</h1>
        <p className="text-gray-300">Join the game!</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 space-y-6">
        <div className="text-center">
          <p className="text-gray-300 text-sm">Joining lobby</p>
          <p className="font-mono text-3xl font-bold tracking-widest text-white mt-1">
            {lobbyCode}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            onKeyDown={(e) => e.key === "Enter" && joinLobby()}
            autoFocus
          />
        </div>

        <button
          onClick={joinLobby}
          className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
        >
          Join Game
        </button>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Suspense fallback={<div className="text-white text-xl">Loading...</div>}>
        <JoinForm />
      </Suspense>
    </main>
  );
}
