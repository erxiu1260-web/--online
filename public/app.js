const socket = io();
const boardEl = document.querySelector('#board');
const statusEl = document.querySelector('#status');
const roomCodeEl = document.querySelector('#room-code');
const blackPlayerEl = document.querySelector('#black-player');
const whitePlayerEl = document.querySelector('#white-player');
const toastEl = document.querySelector('#toast');
let myColor = 'spectator', state = null;
const params = new URLSearchParams(location.search);
const roomId = (params.get('room') || Math.random().toString(36).slice(2, 8)).toUpperCase();
if (!params.get('room')) history.replaceState(null, '', `?room=${roomId}`);
roomCodeEl.textContent = roomId;

function toast(message) { toastEl.textContent = message; toastEl.classList.add('show'); setTimeout(() => toastEl.classList.remove('show'), 1800); }
function label(color) { return color === 'black' ? '黑方' : '白方'; }
function render() {
  if (!state) return;
  boardEl.innerHTML = '';
  state.board.forEach((line, row) => line.forEach((color, col) => {
    const cell = document.createElement('button'); cell.className = 'cell'; cell.setAttribute('aria-label', `${row + 1} 行 ${col + 1} 列`);
    if (color) { const piece = document.createElement('span'); piece.className = `piece ${color}${state.lastMove?.row === row && state.lastMove?.col === col ? ' last' : ''}`; cell.append(piece); }
    cell.addEventListener('click', () => socket.emit('move', { row, col })); boardEl.append(cell);
  }));
  blackPlayerEl.textContent = state.playerCount >= 1 ? '已加入' : '等待加入';
  whitePlayerEl.textContent = state.playerCount >= 2 ? '已加入' : '等待朋友加入';
  if (state.winner === 'draw') statusEl.textContent = '棋盘已满，平局！';
  else if (state.winner) statusEl.textContent = `${label(state.winner)}获胜！`;
  else if (state.playerCount < 2) statusEl.textContent = myColor === 'black' ? '等待朋友加入房间…' : '房间观战中，等待下一局';
  else statusEl.textContent = state.turn === myColor ? '轮到你落子' : `轮到${label(state.turn)}落子`;
}
socket.on('connect', () => socket.emit('join', { roomId }));
socket.on('joined', data => { myColor = data.color; state = data.state; render(); if (myColor === 'spectator') toast('房间已满，正在观战'); });
socket.on('state', next => { state = next; render(); });
socket.on('errorMessage', toast);
document.querySelector('#copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('邀请链接已复制'); } catch { prompt('复制这个链接给朋友：', location.href); } });
document.querySelector('#restart').addEventListener('click', () => socket.emit('restart'));
