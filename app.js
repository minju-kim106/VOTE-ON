// 투표 데이터는 브라우저에, 익명 게시글과 신고 정보는 서버에 저장됩니다.
const STORAGE_KEY = 'vote-school-demo-v1';

const initialData = {
  polls: [
    {
      id: 'poll-sports-day',
      question: '올해 체육대회에 새로 추가하고 싶은 종목은?',
      category: '행사',
      options: [{ text: '반 대항 릴레이', votes: 38 }, { text: '피구 토너먼트', votes: 27 }, { text: '선생님과 함께하는 축구', votes: 19 }],
      deadline: futureDate(3),
      author: '학생회',
      createdAt: Date.now() - 86400000 * 2,
      closed: false
    },
    {
      id: 'poll-lunch',
      question: '다음 달 급식 메뉴로 가장 먹고 싶은 것은?',
      category: '급식',
      options: [{ text: '마라탕', votes: 42 }, { text: '치킨마요 덮밥', votes: 35 }, { text: '크림 파스타', votes: 23 }],
      deadline: futureDate(1),
      author: '급식 소통단',
      createdAt: Date.now() - 86400000,
      closed: false
    },
    {
      id: 'poll-rest',
      question: '점심시간에 운동장 개방 시간을 늘리면 어떨까요?',
      category: '학교생활',
      options: [{ text: '찬성해요', votes: 58 }, { text: '지금이 좋아요', votes: 31 }],
      deadline: futureDate(6),
      author: '생활부',
      createdAt: Date.now() - 86400000 * 3,
      closed: false
    },
    {
      id: 'poll-library',
      question: '도서관에 가장 먼저 추가되었으면 하는 공간은?',
      category: '시설',
      options: [{ text: '조용한 개인 열람석', votes: 54 }, { text: '친구와 이야기하는 모둠석', votes: 46 }],
      deadline: pastDate(2),
      author: '도서부',
      createdAt: Date.now() - 86400000 * 8,
      closed: true
    },
    {
      id: 'poll-festival',
      question: '학교 축제에서 가장 기대되는 프로그램은?',
      category: '행사',
      options: [{ text: '동아리 공연', votes: 61 }, { text: '먹거리 부스', votes: 48 }, { text: '미니 게임존', votes: 33 }],
      deadline: pastDate(5),
      author: '축제 준비위원회',
      createdAt: Date.now() - 86400000 * 12,
      closed: true
    }
  ],
  posts: [
    { id: 'post-welcome', text: '익명으로 의견 나눌 수 있는 공간이 생겨서 좋아요! 학교 행사 아이디어도 많이 올라오면 좋겠어요.', createdAt: Date.now() - 3600000 * 2 },
    { id: 'post-cafe', text: '도서관에 편하게 이야기할 수 있는 공간도 있으면 좋겠습니다 :)', createdAt: Date.now() - 3600000 * 6 }
  ],
  votesByPoll: {}
};

function futureDate(days) {
  const date = new Date(Date.now() + days * 86400000);
  date.setHours(17, 0, 0, 0);
  return date.toISOString();
}

function pastDate(days) {
  const date = new Date(Date.now() - days * 86400000);
  date.setHours(17, 0, 0, 0);
  return date.toISOString();
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(initialData);
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.polls) || !Array.isArray(parsed.posts) || !parsed.votesByPoll) {
      throw new Error('저장된 데이터 형식이 올바르지 않습니다.');
    }
    return parsed;
  } catch (error) {
    console.error('VOTE 데이터를 불러오지 못했습니다.', error);
    return structuredClone(initialData);
  }
}

let data = loadData();
let toastTimer;

const pollGrid = document.querySelector('#poll-grid');
const toast = document.querySelector('#toast');
const votePollGrid = document.querySelector('#vote-poll-grid');

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('VOTE 데이터를 저장하지 못했습니다.', error);
    showToast('브라우저 저장 공간에 저장하지 못했어요.');
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatRemaining(deadline) {
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return '마감됨';
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  if (days > 0) return `마감까지 ${days}일`;
  if (hours > 0) return `마감까지 ${hours}시간`;
  return '곧 마감';
}

function isClosed(poll) {
  return poll.closed || new Date(poll.deadline).getTime() <= Date.now();
}

function pollTotal(poll) {
  return poll.options.reduce((total, option) => total + option.votes, 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function renderPolls() {
  if (!pollGrid) return;
  const polls = [...data.polls].sort((a, b) => b.createdAt - a.createdAt);
  document.querySelector('#empty-state').classList.toggle('hidden', polls.length > 0);
  pollGrid.innerHTML = polls.map(renderPollCard).join('');
}

function renderVotePolls() {
  if (!votePollGrid) return;
  const openPolls = data.polls.filter(poll => !isClosed(poll));
  const polls = openPolls
    .filter(poll => data.votesByPoll[poll.id] === undefined)
    .sort((a, b) => b.createdAt - a.createdAt);
  const completionMessage = document.querySelector('#vote-completion-message');
  const hasCompletedVotes = data.polls.some(poll => data.votesByPoll[poll.id] !== undefined);
  completionMessage.classList.toggle('hidden', !hasCompletedVotes);
  completionMessage.textContent = hasCompletedVotes
    ? '투표가 완료됐어요. 참여한 투표는 목록에서 숨겨집니다.'
    : '';
  document.querySelector('#vote-empty-state').classList.toggle('hidden', polls.length > 0);
  if (openPolls.length > 0 && polls.length === 0) {
    document.querySelector('#vote-empty-state h2').textContent = '모든 진행 중인 투표에 참여했어요!';
  } else {
    document.querySelector('#vote-empty-state h2').textContent = '현재 참여할 수 있는 투표가 없어요';
  }
  votePollGrid.innerHTML = polls.map(poll => {
    const options = poll.options.map((option, index) => `
      <label class="vote-choice">
        <input type="radio" name="vote-${escapeHTML(poll.id)}" value="${index}" data-vote-option="${index}">
        <span>${escapeHTML(option.text)}</span>
      </label>`).join('');

    return `<article class="poll-card vote-card" data-vote-card="${escapeHTML(poll.id)}">
      <div class="poll-card-top"><span class="category-tag">${escapeHTML(poll.category)}</span><span class="poll-state">● 진행 중</span></div>
      <h2 class="poll-title">${escapeHTML(poll.question)}</h2>
      <div class="poll-meta"><span>${escapeHTML(poll.author)}</span><span>${escapeHTML(formatRemaining(poll.deadline))}</span></div>
      <form class="vote-form" data-vote-form="${escapeHTML(poll.id)}">
        <fieldset class="vote-choice-list">
          <legend class="sr-only">투표 선택지</legend>
          ${options}
        </fieldset>
        <button class="vote-submit" type="submit">투표하기</button>
      </form>
    </article>`;
  }).join('');
}

function renderPollCard(poll) {
  const total = pollTotal(poll);
  const options = poll.options.map(option => {
    const percent = total ? Math.round(option.votes / total * 100) : 0;
    return `<div class="result-option">
      <div class="result-option-heading"><span>${escapeHTML(option.text)}</span><span class="result-votes">${option.votes.toLocaleString('ko-KR')}표 · ${percent}%</span></div>
      <div class="result-track" role="img" aria-label="${escapeHTML(option.text)} ${option.votes}표, ${percent}%"><span class="result-fill" style="width:${percent}%"></span></div>
    </div>`;
  }).join('');

  return `<article class="poll-card">
    <h3 class="poll-title">${escapeHTML(poll.question)}</h3>
    <div class="option-list">${options}</div>
  </article>`;
}

function renderStats() {
  if (!document.querySelector('#active-count')) return;
  const openPolls = data.polls.filter(poll => !isClosed(poll));
  document.querySelector('#active-count').textContent = openPolls.length;
  document.querySelector('#closed-count').textContent = data.polls.filter(isClosed).length;
  document.querySelector('#total-voters').textContent = data.polls.reduce((sum, poll) => sum + pollTotal(poll), 0).toLocaleString('ko-KR');
}

function renderPosts() {
  if (!document.querySelector('#post-list')) return;
  const sortedPosts = boardPosts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => b.post.createdAt - a.post.createdAt || b.index - a.index)
    .map(({ post }) => post);
  document.querySelector('#post-count').textContent = `${sortedPosts.length}개의 익명 의견`;
  document.querySelector('#post-list').innerHTML = sortedPosts.length
    ? sortedPosts.map(post => `<article class="post-item"><div class="avatar-anon" aria-hidden="true">익</div><div class="post-item-body"><span class="post-author">익명</span><time class="post-time">${escapeHTML(relativeTime(post.createdAt))}</time><p class="post-text">${escapeHTML(post.text)}</p><button class="report-post-button" type="button" data-report-post="${escapeHTML(post.id)}">신고</button></div></article>`).join('')
    : '<div class="empty-posts">첫 번째 의견을 남겨주세요.</div>';
}

let boardPosts = [];

async function loadBoardPosts() {
  const response = await fetch('/api/board/posts');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '게시글을 불러오지 못했습니다.');
  boardPosts = result.posts;
  renderPosts();
}

function setPostMessage(message, isError = false) {
  const messageElement = document.querySelector('#post-message');
  messageElement.textContent = message;
  messageElement.classList.toggle('error', isError);
}

function relativeTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function renderAdminPolls() {
  if (!document.querySelector('#admin-poll-list')) return;
  const sortedPolls = [...data.polls].sort((a, b) => b.createdAt - a.createdAt);
  document.querySelector('#admin-poll-count').textContent = `${sortedPolls.length}개`;
  document.querySelector('#admin-poll-list').innerHTML = sortedPolls.length
    ? sortedPolls.map(poll => `<div class="admin-poll-row"><div class="admin-poll-info"><strong>${escapeHTML(poll.question)}</strong><span>${escapeHTML(poll.category)} · ${isClosed(poll) ? '마감' : '진행 중'} · ${pollTotal(poll)}명 참여</span></div><div class="admin-actions">${!isClosed(poll) ? `<button type="button" data-edit-poll="${escapeHTML(poll.id)}">수정</button><button type="button" data-close-poll="${escapeHTML(poll.id)}">마감</button>` : ''}<button class="delete-button" type="button" data-delete-poll="${escapeHTML(poll.id)}">삭제</button></div></div>`).join('')
    : '<div class="admin-empty">등록된 투표가 없습니다.</div>';
}

function renderNotifications() {
  if (!document.querySelector('#notification-list')) return;
  const closingSoon = data.polls.filter(poll => !isClosed(poll) && new Date(poll.deadline).getTime() - Date.now() <= 86400000);
  document.querySelector('#notification-count').textContent = closingSoon.length;
  document.querySelector('#notification-list').innerHTML = closingSoon.length
    ? closingSoon.map(poll => `<div class="notification-item"><strong>${escapeHTML(poll.question)}</strong><br>${escapeHTML(formatRemaining(poll.deadline))} 마감돼요.</div>`).join('')
    : '<div class="no-notifications">24시간 이내 마감되는 투표가 없어요.</div>';
}

function renderAll() {
  renderPolls();
  renderVotePolls();
  renderStats();
  renderPosts();
  renderAdminPolls();
  renderNotifications();
}

if (votePollGrid) votePollGrid.addEventListener('change', event => {
  const radio = event.target.closest('[data-vote-option]');
  if (!radio) return;
  const card = radio.closest('[data-vote-card]');
  card.querySelectorAll('.vote-choice').forEach(choice => choice.classList.remove('selected'));
  radio.closest('.vote-choice').classList.add('selected');
});

if (votePollGrid) votePollGrid.addEventListener('submit', event => {
  const form = event.target.closest('[data-vote-form]');
  if (!form) return;
  event.preventDefault();
  const poll = data.polls.find(item => item.id === form.dataset.voteForm);
  const selected = form.querySelector('[data-vote-option]:checked');
  if (!poll || isClosed(poll) || data.votesByPoll[poll.id] !== undefined) {
    showToast('이미 마감되었거나 참여한 투표예요.');
    renderAll();
    return;
  }
  if (!selected) {
    showToast('먼저 선택지를 골라주세요.');
    return;
  }

  const optionIndex = Number(selected.value);
  poll.options[optionIndex].votes += 1;
  data.votesByPoll[poll.id] = optionIndex;
  if (saveData()) {
    renderAll();
    showToast('소중한 한 표가 익명으로 반영됐어요!');
  } else {
    poll.options[optionIndex].votes -= 1;
    delete data.votesByPoll[poll.id];
  }
});

function resetPollForm() {
  document.querySelector('#poll-form').reset();
  document.querySelector('#poll-id').value = '';
  document.querySelector('#poll-author').value = '학생회';
  document.querySelector('#form-title').textContent = '새 투표 만들기';
  document.querySelector('#save-poll-button').textContent = '투표 생성하기';
  document.querySelector('#cancel-edit-button').classList.add('hidden');
}

const postInput = document.querySelector('#post-input');
if (postInput) postInput.addEventListener('input', () => {
  document.querySelector('#character-count').textContent = `${postInput.value.length} / 240`;
});

const postForm = document.querySelector('#post-form');
if (postForm) postForm.addEventListener('submit', async event => {
  event.preventDefault();
  const text = postInput.value.trim();
  if (!text) {
    setPostMessage('의견을 입력해 주세요.', true);
    postInput.focus();
    return;
  }
  const moderation = window.VoteModeration.checkPost(text);
  if (!moderation.allowed) {
    setPostMessage(moderation.reason, true);
    postInput.focus();
    return;
  }
  const submitButton = postForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/board/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const result = await response.json();
    if (!response.ok) {
      setPostMessage(result.error || '게시글을 등록하지 못했습니다.', true);
      return;
    }
    postInput.value = '';
    document.querySelector('#character-count').textContent = '0 / 240';
    setPostMessage('익명 의견을 등록했어요.');
    await loadBoardPosts();
  } catch (error) {
    console.error('게시글 등록 요청에 실패했습니다.', error);
    setPostMessage('서버에 연결하지 못했습니다. 서버를 실행한 뒤 다시 시도해 주세요.', true);
  } finally {
    submitButton.disabled = false;
  }
});

const postList = document.querySelector('#post-list');
if (postList) postList.addEventListener('click', async event => {
  const reportButton = event.target.closest('[data-report-post]');
  if (!reportButton) return;
  reportButton.disabled = true;
  try {
    const response = await fetch(`/api/board/posts/${encodeURIComponent(reportButton.dataset.reportPost)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '신고를 접수하지 못했습니다.');
    setPostMessage('신고가 접수되었습니다. 관리자가 확인할게요.');
  } catch (error) {
    console.error('게시글 신고 요청에 실패했습니다.', error);
    setPostMessage(error.message || '신고를 접수하지 못했습니다. 다시 시도해 주세요.', true);
    reportButton.disabled = false;
  }
});

const adminLoginForm = document.querySelector('#admin-login-form');
const adminReportList = document.querySelector('#admin-reports-list');
const adminReportMessage = document.querySelector('#admin-report-message');
const adminLogoutButton = document.querySelector('#admin-logout-button');

function setAdminReportMessage(message, isError = false) {
  if (!adminReportMessage) return;
  adminReportMessage.textContent = message;
  adminReportMessage.classList.toggle('error', isError);
}

function renderAdminReports(posts) {
  adminReportList.innerHTML = posts.length
    ? posts.map(post => `<article class="reported-post"><p class="post-text">${escapeHTML(post.text)}</p><button class="admin-delete-post" type="button" data-delete-reported-post="${escapeHTML(post.id)}">삭제</button></article>`).join('')
    : '<div class="admin-empty">확인할 신고 게시글이 없습니다.</div>';
}

async function loadAdminReports() {
  const response = await fetch('/api/admin/reports');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '신고 목록을 불러오지 못했습니다.');
  adminLoginForm.classList.add('hidden');
  adminLogoutButton.classList.toggle('hidden', response.headers.get('X-Admin-Access') === 'local');
  adminReportList.classList.remove('hidden');
  renderAdminReports(result.posts);
  setAdminReportMessage('신고된 게시글을 불러왔습니다.');
}

if (adminLoginForm) adminLoginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const passwordInput = document.querySelector('#admin-password');
  const submitButton = adminLoginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '로그인하지 못했습니다.');
    passwordInput.value = '';
    await loadAdminReports();
  } catch (error) {
    setAdminReportMessage(error.message || '로그인하지 못했습니다.', true);
  } finally {
    submitButton.disabled = false;
  }
});

if (adminReportList) loadAdminReports().catch(error => {
  adminLoginForm.classList.remove('hidden');
  setAdminReportMessage(error.message || '신고 목록을 불러오지 못했습니다.', true);
});

if (adminReportList) adminReportList.addEventListener('click', async event => {
  const deleteButton = event.target.closest('[data-delete-reported-post]');
  if (!deleteButton) return;
  if (!window.confirm('신고된 게시글을 삭제할까요?')) return;
  deleteButton.disabled = true;
  try {
    const response = await fetch(`/api/admin/posts/${encodeURIComponent(deleteButton.dataset.deleteReportedPost)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '게시글을 삭제하지 못했습니다.');
    await loadAdminReports();
    setAdminReportMessage('게시글을 삭제했습니다.');
  } catch (error) {
    setAdminReportMessage(error.message || '게시글을 삭제하지 못했습니다.', true);
    deleteButton.disabled = false;
  }
});

if (adminLogoutButton) adminLogoutButton.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/admin/logout', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '로그아웃하지 못했습니다.');
    adminLoginForm.classList.remove('hidden');
    adminLogoutButton.classList.add('hidden');
    adminReportList.classList.add('hidden');
    setAdminReportMessage('로그아웃했습니다.');
  } catch (error) {
    setAdminReportMessage(error.message || '로그아웃하지 못했습니다.', true);
  }
});

const pollForm = document.querySelector('#poll-form');
if (pollForm) pollForm.addEventListener('submit', event => {
  event.preventDefault();
  const id = document.querySelector('#poll-id').value;
  const question = document.querySelector('#poll-question').value.trim();
  const category = document.querySelector('#poll-category').value;
  const optionTexts = document.querySelector('#poll-options').value.split(/\r?\n/).map(option => option.trim()).filter(Boolean);
  const deadlineValue = document.querySelector('#poll-deadline').value;
  const author = document.querySelector('#poll-author').value.trim() || '학생회';
  const deadline = new Date(deadlineValue);

  if (optionTexts.length < 2) {
    showToast('선택지는 두 개 이상 입력해 주세요.');
    return;
  }
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    showToast('마감 일시는 현재보다 이후로 설정해 주세요.');
    return;
  }

  if (id) {
    const poll = data.polls.find(item => item.id === id);
    if (!poll) {
      showToast('수정할 투표를 찾지 못했어요.');
      return;
    }
    const hasVotes = poll.options.some(option => option.votes > 0);
    const optionsChanged = poll.options.length !== optionTexts.length
      || poll.options.some((option, index) => option.text !== optionTexts[index]);
    if (hasVotes && optionsChanged) {
      showToast('이미 표가 있는 투표의 선택지는 바꿀 수 없어요.');
      return;
    }
    poll.question = question;
    poll.category = category;
    poll.deadline = deadline.toISOString();
    poll.author = author;
    poll.options = optionTexts.map((text, index) => ({
      text,
      votes: poll.options[index]?.text === text ? poll.options[index].votes : 0
    }));
    document.querySelector('#form-message').textContent = '투표를 수정했어요.';
  } else {
    const newPoll = {
      id: `poll-${Date.now()}`,
      question,
      category,
      options: optionTexts.map(text => ({ text, votes: 0 })),
      deadline: deadline.toISOString(),
      author,
      createdAt: Date.now(),
      closed: false
    };
    data.polls.push(newPoll);
    document.querySelector('#form-message').textContent = '새 투표를 만들었어요.';
  }
  if (saveData()) {
    renderAll();
    if (adminReportList) loadAdminReports().catch(error => {
      if (!error.message.includes('관리자 로그인이 필요합니다.')) {
        setAdminReportMessage(error.message || '신고 목록을 불러오지 못했습니다.', true);
      }
    });
    resetPollForm();
    document.querySelector('#admin').scrollIntoView({ behavior: 'smooth' });
  }
});

const adminPollList = document.querySelector('#admin-poll-list');
if (adminPollList) adminPollList.addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-poll]');
  if (editButton) {
    const poll = data.polls.find(item => item.id === editButton.dataset.editPoll);
    if (!poll || isClosed(poll)) {
      showToast('진행 중인 투표만 수정할 수 있어요.');
      return;
    }
    document.querySelector('#poll-id').value = poll.id;
    document.querySelector('#poll-question').value = poll.question;
    document.querySelector('#poll-category').value = poll.category;
    document.querySelector('#poll-options').value = poll.options.map(option => option.text).join('\n');
    const localDate = new Date(poll.deadline);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    document.querySelector('#poll-deadline').value = localDate.toISOString().slice(0, 16);
    document.querySelector('#poll-author').value = poll.author;
    document.querySelector('#form-title').textContent = '투표 수정하기';
    document.querySelector('#save-poll-button').textContent = '수정 내용 저장';
    document.querySelector('#cancel-edit-button').classList.remove('hidden');
    document.querySelector('#poll-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const closeButton = event.target.closest('[data-close-poll]');
  if (closeButton) {
    const poll = data.polls.find(item => item.id === closeButton.dataset.closePoll);
    if (!poll || isClosed(poll)) return;
    poll.closed = true;
    if (saveData()) {
      renderAll();
      showToast('투표를 마감하고 결과를 공개했어요.');
    }
    return;
  }

  const deleteButton = event.target.closest('[data-delete-poll]');
  if (deleteButton) {
    const poll = data.polls.find(item => item.id === deleteButton.dataset.deletePoll);
    if (!poll) return;
    if (!window.confirm(`"${poll.question}" 투표를 삭제할까요?`)) return;
    data.polls = data.polls.filter(item => item.id !== poll.id);
    delete data.votesByPoll[poll.id];
    if (saveData()) {
      renderAll();
      showToast('투표를 삭제했어요.');
    }
  }
});

const cancelEditButton = document.querySelector('#cancel-edit-button');
if (cancelEditButton) cancelEditButton.addEventListener('click', resetPollForm);

const notificationButton = document.querySelector('#notification-button');
if (notificationButton) notificationButton.addEventListener('click', () => {
  document.querySelector('#notification-popover').classList.toggle('hidden');
});
const closeNotificationsButton = document.querySelector('#close-notifications');
if (closeNotificationsButton) closeNotificationsButton.addEventListener('click', () => {
  document.querySelector('#notification-popover').classList.add('hidden');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
    link.classList.add('active');
  });
});

renderAll();

if (postList) loadBoardPosts().catch(error => {
  console.error('게시글을 불러오지 못했습니다.', error);
  setPostMessage('게시판 서버에 연결할 수 없습니다. 안내된 방법으로 서버를 실행해 주세요.', true);
});
