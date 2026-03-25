const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let cards = [];
let waitingQueue = [];
let games = {};

// =====================
// Load cards from Limitless
// =====================
async function loadCards() {
  if (cards.length) return cards;
  const res = await fetch("https://limitlesstcg.com/api/cards");
  const data = await res.json();
  cards = data.cards.map(c => ({
    ...c,
    hp: c.hp || 100,
    energy: 0
  }));
  return cards;
}

// =====================
// Matchmaking
// =====================
function matchmake(socket) {
  if (waitingQueue.length === 0) {
    waitingQueue.push(socket);
    socket.emit("waiting", "Waiting for opponent...");
  } else {
    const opponent = waitingQueue.shift();
    startGame(socket, opponent);
  }
}

// =====================
// Start Game
// =====================
async function startGame(player1, player2) {
  await loadCards();
  const id = Math.random().toString(36).substring(7);

  const deck1 = [...cards].sort(() => Math.random() - 0.5).slice(0, 40);
  const deck2 = [...cards].sort(() => Math.random() - 0.5).slice(0, 40);

  const game = {
    id,
    players: [player1.id, player2.id],
    state: {
      turn: "player1",
      log: [],
      player1: createPlayer(deck1),
      player2: createPlayer(deck2)
    }
  };

  draw(game.state.player1, 7);
  draw(game.state.player2, 7);

  games[id] = game;

  player1.join(id);
  player2.join(id);

  player1.emit("start", { gameId: id, player: "player1", state: game.state });
  player2.emit("start", { gameId: id, player: "player2", state: game.state });
}

// =====================
// Player template
// =====================
function createPlayer(deck) {
  return {
    deck,
    hand: [],
    active: null,
    bench: [],
    prizes: 6,
    energyUsed: false
  };
}

// =====================
// Draw cards
// =====================
function draw(player, n) {
  for (let i = 0; i < n; i++) {
    if (player.deck.length) player.hand.push(player.deck.pop());
  }
}

// =====================
// Game logic
// =====================
function applyMove(game, playerKey, move) {
  const state = game.state;
  const opponentKey = playerKey === "player1" ? "player2" : "player1";
  const player = state[playerKey];
  const opponent = state[opponentKey];

  if (state.turn !== playerKey) return;

  switch (move.type) {
    case "play":
      const card = player.hand.splice(move.index, 1)[0];
      card.hpLeft = card.hp;
      card.energy = 0;
      if (!player.active) player.active = card;
      else if (player.bench.length < 5) player.bench.push(card);
      state.log.push(`${playerKey} played ${card.name}`);
      break;

    case "attach":
      if (!player.active) break;
      if (!player.energyUsed) {
        player.active.energy++;
        state.log.push(`${playerKey} attached energy`);
        player.energyUsed = true;
      }
      break;

    case "attack":
      if (!player.active || !opponent.active) break;
      let damage = 20 + (player.active.energy || 0) * 10;
      opponent.active.hpLeft -= damage;
      state.log.push(`${playerKey} attacked for ${damage}`);
      if (opponent.active.hpLeft <= 0) {
        opponent.active = null;
        player.prizes--;
        state.log.push(`${playerKey} took a prize!`);
      }
      state.turn = opponentKey;
      player.energyUsed = false;
      draw(opponent, 1);
      break;
  }
}

// =====================
// Socket.io
// =====================
io.on("connection", socket => {
  socket.on("findGame", () => matchmake(socket));

  socket.on("move", ({ gameId, player, move }) => {
    const game = games[gameId];
    if (!game) return;

    applyMove(game, player, move);

    io.to(gameId).emit("update", game.state);
  });

  socket.on("disconnect", () => {
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
  });
});

server.listen(3000, () => console.log("Server running on 3000"));
