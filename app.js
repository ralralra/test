'use strict';

const API_URL = 'https://script.google.com/macros/s/AKfycbzISphRKvl-4EsIGU-8ZDaArCpW6bjlaeEHj8qf_0KLAisAl95gcnIEjcdHwFsyDmNcng/exec';
const $ = (selector) => document.querySelector(selector);
const wall = $('#message-wall');
const wallStatus = $('#wall-status');
const counter = $('#wall-counter');
const pauseButton = $('#pause-carousel');
const expandButton = $('#expand-message');
const dialog = $('#project-dialog');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let messages = [];
let currentIndex = 0;
let paused = reducedMotion.matches;
let hovering = false;
let fetching = false;
let submitting = false;
let wallInView = true;
let lastFocusedElement = null;
let localRevision = 0;

const projects = {
  meal: {
    title: '오늘의 급식, 우리의 별점',
    description: '급식 조회와 학생 의견 수집을 연결하는 학교생활 앱입니다.',
    features: ['학교 검색과 나의 학교 설정', '나이스 급식 API로 날짜별 식단 조회', '별점과 한줄평을 구글시트에 저장', '학교·날짜별 평가 목록과 평균 별점 표시']
  },
  festival: {
    title: '우리 부스에 놀러 와!',
    description: '우리 동아리만의 매력을 담고, 실제 방문과 참여로 연결하는 홍보 페이지입니다.',
    features: ['부스 소개와 활동 사진', '운영 시간과 찾아오는 길', '참여 신청 및 구글시트 저장', '휴대폰에서도 보기 편한 반응형 화면']
  },
  portfolio: {
    title: '나를 소개하는 한 페이지',
    description: '관심사와 경험, 앞으로의 목표를 나의 언어와 디자인으로 표현하는 포트폴리오입니다.',
    features: ['자기소개와 관심 분야', '활동 결과물과 프로젝트 이야기', '별명으로 남기는 응원 방명록', '나만의 색과 스타일로 꾸민 모바일 화면']
  },
  town: {
    title: '우리 동네, 함께 바꾸기',
    description: '주변의 작은 불편을 발견하고, 함께 해결할 아이디어를 모으는 참여형 앱입니다.',
    features: ['생활 속 문제와 개선 아이디어 등록', '분류별 의견 모아 보기', '지도 또는 목록으로 위치 안내', '수집한 의견을 정리해 캠페인 제안하기']
  }
};

function showDialog(title, description, content, eyebrow = 'PROJECT GUIDE') {
  lastFocusedElement = document.activeElement;
  $('#dialog-title').textContent = title;
  $('#dialog-description').textContent = description;
  $('#dialog-eyebrow').textContent = eyebrow;
  $('#dialog-body').replaceChildren(content);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}
function listSection(title, items, ordered) {
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement(ordered ? 'ol' : 'ul');
  items.forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
  section.append(heading, list);
  return section;
}
document.querySelectorAll('.project-open').forEach(button => button.addEventListener('click', () => {
  const project = projects[button.dataset.project];
  const content = document.createElement('div');
  content.append(listSection('이런 기능을 만들어요', project.features, false));
  showDialog(project.title, project.description, content);
}));
document.querySelectorAll('.dialog-close, .dialog-done').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { document.body.style.overflow = ''; lastFocusedElement?.focus({ preventScroll: true }); });

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  let count = 0;
  document.querySelectorAll('.filter').forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
  document.querySelectorAll('.project-card').forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; if (!card.hidden) count++; });
  $('#project-count').textContent = `${count}개의 아이디어`;
}));

// Continuous vertical ticker. Only the cards inside the wall are in the DOM:
// virtual slot k always shows messages[k mod N], so the scroll never runs out.
const CARD_HEIGHT = 88;
const CARD_PITCH = 96; // card height + gap
const SCROLL_SPEED = 22; // px per second, about 4.4s per message
const mod = (n, m) => ((n % m) + m) % m;
const cards = new Map(); // virtual slot -> card element
let scrollOffset = 0; // 0 = messages[0] in the middle; keeps growing while scrolling
let centerSlot = null;
let lastFrame = 0;

function clearCards() { cards.clear(); centerSlot = null; currentIndex = -1; }
function updatePauseButton() {
  pauseButton.disabled = messages.length < 2;
  pauseButton.textContent = paused ? '▷' : 'Ⅱ';
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? '메시지 자동 스크롤 재생' : '메시지 자동 스크롤 일시정지');
}
function placeholder(title, detail = '', loading = false) {
  clearCards(); wall.replaceChildren();
  const box = document.createElement('div'); box.className = 'wall-placeholder';
  const symbol = document.createElement(loading ? 'span' : 'strong');
  if (loading) symbol.className = 'loader'; else symbol.textContent = '♡';
  const text = document.createElement('p'); text.textContent = title;
  const small = document.createElement('small'); small.textContent = detail;
  box.append(symbol, text, small); wall.append(box);
  counter.textContent = ''; expandButton.hidden = true; updatePauseButton();
}
function createCard(item) {
  const card = document.createElement('article');
  card.className = 'message-card'; card.dataset.messageId = item.id;
  const message = document.createElement('p'); message.textContent = item.message;
  const author = document.createElement('span'); author.className = 'message-author'; author.textContent = item.nickname;
  card.append(message, author);
  return card;
}
function drawWall() {
  const count = messages.length;
  if (!count) return;
  if (count === 1) scrollOffset = 0; // A single message stays still instead of repeating itself.
  const height = wall.clientHeight || 280;
  const middle = height / 2;
  const top = middle - CARD_HEIGHT / 2;
  const first = count === 1 ? 0 : Math.floor((scrollOffset - top - CARD_HEIGHT) / CARD_PITCH) + 1;
  const last = count === 1 ? 0 : Math.ceil((scrollOffset + height - top) / CARD_PITCH) - 1;
  cards.forEach((card, slot) => { if (slot < first || slot > last) { card.remove(); cards.delete(slot); } });
  for (let slot = first; slot <= last; slot++) {
    let card = cards.get(slot);
    if (!card) { card = createCard(messages[mod(slot, count)]); cards.set(slot, card); wall.append(card); }
    const y = top + slot * CARD_PITCH - scrollOffset;
    // 0 in the middle, 1 at the neighbouring position: sharp in the middle, blurred and faded outside.
    const distance = Math.abs(y + CARD_HEIGHT / 2 - middle) / CARD_PITCH;
    const t = Math.min(1, distance);
    card.style.transform = `translateY(${y.toFixed(2)}px) scale(${(1 - .06 * t).toFixed(4)})`;
    card.style.opacity = (distance <= 1 ? 1 - .72 * distance : Math.max(0, .28 * (2 - distance))).toFixed(3);
    card.style.filter = t < .01 ? 'none' : `blur(${(1.4 * t).toFixed(2)}px)`;
  }
  const nextCenter = count === 1 ? 0 : Math.round(scrollOffset / CARD_PITCH);
  if (nextCenter !== centerSlot || cards.get(nextCenter)?.getAttribute('aria-hidden') !== 'false') {
    centerSlot = nextCenter;
    cards.forEach((card, slot) => card.setAttribute('aria-hidden', String(slot !== centerSlot)));
  }
  const index = mod(centerSlot, count);
  if (index !== currentIndex) { currentIndex = index; counter.textContent = `${currentIndex + 1} / ${count}`; }
}
function renderMessages() {
  clearCards(); wall.replaceChildren();
  if (!messages.length) { placeholder('첫 번째 응원의 주인공이 되어 주세요.', '아직 도착한 응원 메시지가 없어요.'); return; }
  expandButton.hidden = false;
  updatePauseButton();
  drawWall();
}
function tick(now) {
  const dt = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0; // Clamp so a stalled frame does not jump.
  lastFrame = now;
  if (messages.length > 1 && wallInView && !dialog.open) {
    if (paused || hovering) {
      // Glide the nearest message into the middle so it can be read while stopped.
      const target = Math.round(scrollOffset / CARD_PITCH) * CARD_PITCH;
      if (scrollOffset !== target) {
        const diff = target - scrollOffset;
        scrollOffset = Math.abs(diff) < .5 ? target : scrollOffset + diff * Math.min(1, dt * 8);
        drawWall();
      }
    } else {
      scrollOffset += SCROLL_SPEED * dt;
      drawWall();
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
pauseButton.addEventListener('click', () => { paused = !paused; updatePauseButton(); });
// Mouse only: a tap on a phone fires mouseenter without a matching mouseleave and would stop the wall for good.
wall.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovering = true; });
wall.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') hovering = false; });
reducedMotion.addEventListener('change', event => { paused = event.matches; updatePauseButton(); });
window.addEventListener('resize', drawWall);
if ('IntersectionObserver' in window) new IntersectionObserver(entries => { wallInView = entries[0].isIntersecting; }, { threshold: .25 }).observe(wall);
expandButton.addEventListener('click', () => {
  const item = messages[currentIndex]; if (!item) return;
  const content = document.createElement('div'); content.className = 'dialog-full-message'; content.textContent = item.message;
  showDialog('마음을 담은 응원', `${item.nickname} 님의 메시지`, content, 'A LITTLE ENCOURAGEMENT');
});

async function requestJSON(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow', credentials: 'omit' });
    if (!response.ok) throw new Error('서버 응답을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.');
    let result;
    try { result = await response.json(); } catch { throw new Error('서버 연결 설정을 확인해 주세요.'); }
    if (result.success !== true) throw new Error(result.message || '요청을 처리하지 못했습니다.');
    return result;
  } finally { clearTimeout(timeout); }
}
function replaceMessages(nextMessages, preferId) {
  const previousId = preferId || messages[currentIndex]?.id;
  const seen = new Set();
  messages = nextMessages.filter(item => item && typeof item.id === 'string' && typeof item.nickname === 'string' && typeof item.message === 'string' && !seen.has(item.id) && seen.add(item.id));
  // Keep the partly scrolled position on a background refresh so the wall does not jump.
  const drift = preferId ? 0 : scrollOffset - Math.round(scrollOffset / CARD_PITCH) * CARD_PITCH;
  scrollOffset = Math.max(0, messages.findIndex(item => item.id === previousId)) * CARD_PITCH + drift;
  renderMessages();
}
async function loadMessages({ quiet = false } = {}) {
  if (fetching || submitting) return;
  fetching = true;
  const revision = localRevision;
  const reload = $('#reload-messages'); reload.disabled = true;
  if (!quiet) { wallStatus.textContent = '응원을 불러오는 중'; wallStatus.dataset.error = 'false'; wall.setAttribute('aria-busy', 'true'); }
  try {
    const url = new URL(API_URL); url.searchParams.set('action', 'list'); url.searchParams.set('limit', '100'); url.searchParams.set('_', String(Date.now()));
    const result = await requestJSON(url.toString());
    if (!Array.isArray(result.data)) throw new Error('메시지 목록 형식을 확인해 주세요.');
    if (revision !== localRevision) return; // An older GET must not overwrite a newly confirmed submission.
    replaceMessages(result.data);
    wallStatus.textContent = Number(result.total) > messages.length ? `최근 ${messages.length}개의 응원` : messages.length ? `${messages.length}개의 따뜻한 응원` : '첫 응원을 기다리고 있어요';
    wallStatus.dataset.error = 'false';
  } catch (error) {
    if (revision !== localRevision) return;
    wallStatus.textContent = messages.length ? '새로고침 실패 · 이전 메시지를 표시합니다' : '연결을 확인한 뒤 ↻ 버튼을 눌러 주세요';
    wallStatus.dataset.error = 'true';
    if (!messages.length) placeholder('아직 응원을 불러오지 못했어요.', '네트워크 또는 서버 공개 설정을 확인해 주세요.');
  } finally { fetching = false; reload.disabled = false; wall.setAttribute('aria-busy', 'false'); }
}
$('#reload-messages').addEventListener('click', () => loadMessages());
setInterval(() => { if (!document.hidden && wallInView) loadMessages({ quiet: true }); }, 45000);

const countCharacters = text => Array.from(text.normalize('NFC')).length;
const normalizeInput = text => text.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
$('#message').addEventListener('input', () => {
  const length = countCharacters($('#message').value);
  $('#message-count').textContent = `${length} / 300`;
  $('#message-count').classList.toggle('over-limit', length > 300);
});
try { $('#nickname').value = localStorage.getItem('make-lab-nickname') || ''; } catch { /* Private storage can be unavailable. */ }
$('#cheer-form').addEventListener('submit', async event => {
  event.preventDefault(); if (submitting) return;
  const nickname = normalizeInput($('#nickname').value);
  const message = normalizeInput($('#message').value);
  const status = $('#form-status'); status.dataset.error = 'true';
  if (!nickname || countCharacters(nickname) > 20) { status.textContent = '별명은 1~20자로 입력해 주세요.'; $('#nickname').focus(); return; }
  if (!message || countCharacters(message) > 300) { status.textContent = '응원 메시지는 1~300자로 입력해 주세요.'; $('#message').focus(); return; }
  submitting = true; localRevision++;
  const button = $('#submit-cheer'); button.disabled = true; button.textContent = '마음을 전하고 있어요…';
  status.textContent = ''; $('#cheer-form').setAttribute('aria-busy', 'true');
  try {
    const result = await requestJSON(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'save', nickname, message })
    });
    localRevision++;
    try { localStorage.setItem('make-lab-nickname', nickname); } catch { /* Saving the preference is optional. */ }
    $('#message').value = ''; $('#message-count').textContent = '0 / 300'; $('#message-count').classList.remove('over-limit');
    status.dataset.error = 'false';
    if (result.data && result.data.visible === true) {
      replaceMessages([result.data, ...messages].slice(0, 100), result.data.id);
      wallStatus.textContent = `${messages.length}개의 따뜻한 응원`;
      wallStatus.dataset.error = 'false';
      status.textContent = '응원이 도착했어요. 따뜻한 마음을 나눠 주셔서 감사합니다!';
    } else { status.textContent = '응원이 저장되었습니다. 공개 여부는 관리자의 설정에 따라 반영됩니다.'; }
  } catch (error) {
    // No blind retry: the server might have saved the request before the response was lost.
    status.dataset.error = 'true';
    status.textContent = '저장 완료를 확인하지 못했습니다. 중복 등록을 피하려면 위의 ↻ 버튼으로 등록 여부를 확인한 후 다시 시도해 주세요. 입력한 내용은 그대로 남겨 두었습니다.';
  } finally {
    submitting = false; button.disabled = false; $('#cheer-form').setAttribute('aria-busy', 'false');
    button.replaceChildren(document.createTextNode('응원 보내기 '));
    const arrow = document.createElement('span'); arrow.textContent = '→'; button.append(arrow);
  }
});
updatePauseButton();
loadMessages();
