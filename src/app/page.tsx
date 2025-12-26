"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const createLobby = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }
    const newLobbyCode = uuidv4().slice(0, 6).toUpperCase();
    const playerId = uuidv4();
    router.push(`/game/${newLobbyCode}?name=${encodeURIComponent(name)}&playerId=${playerId}&host=true`);
  };

  const joinLobby = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }
    if (!lobbyCode.trim()) {
      alert("Please enter a lobby code");
      return;
    }
    const playerId = uuidv4();
    router.push(`/game/${lobbyCode.toUpperCase()}?name=${encodeURIComponent(name)}&playerId=${playerId}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2">Friends Q&A</h1>
          <p className="text-gray-300">Vote on who fits the question best!</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 space-y-6">
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
            />
          </div>

          {!isJoining ? (
            <div className="space-y-4">
              <button
                onClick={createLobby}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
              >
                Create New Lobby
              </button>
              <button
                onClick={() => setIsJoining(true)}
                className="w-full py-4 px-6 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all border border-white/30"
              >
                Join Existing Lobby
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Lobby Code
                </label>
                <input
                  type="text"
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase text-center text-2xl tracking-widest"
                />
              </div>
              <button
                onClick={joinLobby}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
              >
                Join Lobby
              </button>
              <button
                onClick={() => setIsJoining(false)}
                className="w-full py-3 px-6 text-gray-300 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
