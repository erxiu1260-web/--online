const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const BOARD_SIZE = 15;
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

function createRoom(roomId) {
  return {
    board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
    players: { black: null, white: null },
    turn: 'black', winner: null, lastMove: null
  };
}

function roomState(room) {
  return {
    board: room.board, turn: room.turn, winner: room.winner,
    lastMove: room.lastMove,
    playerCount: Number(Boolean(room.players.black)) + Number(Boolean(room.players.white))
  };
}

function hasFive(board, row, col, color) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  return directions.some(([dr, dc]) => {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = col + dc * sign;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === color) {
        count++; r += dr * sign; c += dc * sign;
      }
    }
    return count >= 5;
  });
}

function emitState(roomId, room) { io.to(roomId).emit('state', roomState(room)); }

io.on('connection', socket => {
  socket.on('join', ({ roomId }) => {
    roomId = String(roomId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    if (!roomId) return socket.emit('errorMessage', '房间号无效。');
    let room = rooms.get(roomId);
    if (!room) { room = createRoom(roomId); rooms.set(roomId, room); }
    let color = 'spectator';
    if (!room.players.black) { room.players.black = socket.id; color = 'black'; }
    else if (!room.players.white) { room.players.white = socket.id; color = 'white'; }
    socket.data.roomId = roomId; socket.data.color = color;
    socket.join(roomId);
    socket.emit('joined', { roomId, color, state: roomState(room) });
    emitState(roomId, room);
  });

  socket.on('move', ({ row, col }) => {
    const { roomId, color } = socket.data;
    const room = rooms.get(roomId);
    if (!room || !['black', 'white'].includes(color)) return;
    if (room.winner || room.turn !== color || !Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE || room.board[row][col]) return;
    room.board[row][col] = color;
    room.lastMove = { row, col, color };
    if (hasFive(room.board, row, col, color)) room.winner = color;
    else if (room.board.every(line => line.every(Boolean))) room.winner = 'draw';
    else room.turn = color === 'black' ? 'white' : 'black';
    emitState(roomId, room);
  });

  socket.on('restart', () => {
    const { roomId, color } = socket.data;
    const room = rooms.get(roomId);
    if (!room || !['black', 'white'].includes(color)) return;
    room.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    room.turn = 'black'; room.winner = null; room.lastMove = null;
    emitState(roomId, room);
  });

  socket.on('disconnect', () => {
    const { roomId, color } = socket.data;
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.players[color] === socket.id) room.players[color] = null;
    emitState(roomId, room);
    if (!room.players.black && !room.players.white) rooms.delete(roomId);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Gomoku is running on http://localhost:${port}`));
