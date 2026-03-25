const socket = io();
let gameId, playerKey, state;

function findGame() {
  socket.emit("findGame");
}

socket.on("waiting", msg => alert(msg));

socket.on("start", ({ gameId: id, player, state: s }) => {
  gameId = id;
  playerKey = player;
  state = s;
  document.getElementById("game").style.display = "block";
  render();
});

socket.on("update", s => {
  state = s;
  render();
});

function playCard(index) {
  socket.emit("move", { gameId, player: playerKey, move: { type: "play", index } });
}

function attachEnergy() {
  socket.emit("move", { gameId, player: playerKey, move: { type: "attach" } });
}

function attack() {
  socket.emit("move", { gameId, player: playerKey, move: { type: "attack" } });
}

function render() {
  const p = state[playerKey];
  const o = state[playerKey === "player1" ? "player2" : "player1"];
  document.getElementById("active").innerHTML = p.active ? card(p.active) : "";
  document.getElementById("bench").innerHTML = p.bench.map(card).join("");
  document.getElementById("hand").innerHTML = p.hand.map((c,i)=>card(c)+`<button onclick="playCard(${i})">Play</button>`).join("");
  document.getElementById("oppActive").innerHTML = o.active ? card(o.active) : "";
  document.getElementById("log").textContent = state.log.join("\n");
}

function card(c) {
  return `<div><img src="${c.image}"><div>${c.name}</div><div>HP:${c.hpLeft||c.hp}</div><div>Energy:${c.energy||0}</div></div>`;
}
