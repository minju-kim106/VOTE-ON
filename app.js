// 브라우저 저장소를 사용하므로 이 데모의 데이터는 현재 브라우저에만 저장됩니다.
const STORAGE_KEY = 'vote-school-demo-v1';
const CATEGORIES = ['전체', '학교생활', '급식', '행사', '시설', '기타'];

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
let activeCategory = '전체';
let toastTimer;

const pollGrid = document.querySelector('#poll-grid');
const categoryList = document.querySelector('#category-list');
const searchInput = document.querySelector('#search-input');
const sortSelect = document.querySelector('#sort-select');
const toast = document.querySelector('#toast');

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

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value));
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

function renderCategories() {
  if (!categoryList) return;
  const available = new Set(data.polls.map(poll => poll.category));
  categoryList.innerHTML = CATEGORIES.filter(category => category === '전체' || available.has(category))
    .map(category => `<button class="category-chip ${activeCategory === category ? 'active' : ''}" type="button" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`)
    .join('');
}

function renderPolls() {
  if (!pollGrid || !searchInput || !sortSelect) return;
  const query = searchInput.value.trim().toLocaleLowerCase('ko');
  let polls = data.polls.filter(poll => {
    const categoryMatches = activeCategory === '전체' || poll.category === activeCategory;
    const searchMatches = `${poll.question} ${poll.category}`.toLocaleLowerCase('ko').includes(query);
    return categoryMatches && searchMatches;
  });

  if (sortSelect.value === 'closing') {
    polls.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  } else {
    polls.sort((a, b) => b.createdAt - a.createdAt);
  }

  document.querySelector('#empty-state').classList.toggle('hidden', polls.length > 0);
  pollGrid.innerHTML = polls.map(renderPollCard).join('');
}

function renderPollCard(poll) {
  const closed = isClosed(poll);
  const total = pollTotal(poll);
  const chosenOption = data.votesByPoll[poll.id];
  const options = poll.options.map((option, index) => {
    const percent = total ? Math.round(option.votes / total * 100) : 0;
    const showResults = closed;
    const selected = chosenOption === index;
    const content = `<span class="option-content"><span>${escapeHTML(option.text)}</span>${showResults ? `<span class="option-count">${percent}% · ${option.votes}표</span>` : ''}</span>`;
    const progress = showResults ? `<span class="option-result-bar" style="width:${percent}%"></span>` : '';
    if (closed) return `<div class="vote-option ${selected ? 'chosen' : ''}">${progress}${content}</div>`;
    return `<button class="vote-option ${selected ? 'chosen' : ''}" type="button" data-poll-id="${escapeHTML(poll.id)}" data-option-index="${index}" ${chosenOption !== undefined ? 'disabled' : ''}>${progress}${content}</button>`;
  }).join('');

  const deadlineLabel = closed ? `마감 ${formatDate(poll.deadline)}` : formatRemaining(poll.deadline);
  return `<article class="poll-card">
    <div class="poll-card-top"><span class="category-tag">${escapeHTML(poll.category)}</span><span class="poll-state ${closed ? 'closed' : ''}">${closed ? '결과 공개' : '● 진행 중'}</span></div>
    <h3 class="poll-title">${escapeHTML(poll.question)}</h3>
    <div class="poll-meta"><span>${escapeHTML(poll.author)}</span><span class="${!closed && deadlineLabel === '곧 마감' ? 'deadline-soon' : ''}">${escapeHTML(deadlineLabel)}</span></div>
    <div class="option-list">${options}</div>
    <div class="poll-action-row">
      <span>${total.toLocaleString('ko-KR')}명 참여</span>
      ${closed ? '<span class="result-label">투표 결과</span>' : chosenOption !== undefined ? '<span class="result-label">참여 완료 ✓</span>' : `<button class="vote-submit" type="button" data-submit-poll="${escapeHTML(poll.id)}">투표하기</button>`}
    </div>
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
  const sortedPosts = [...data.posts].sort((a, b) => b.createdAt - a.createdAt);
  document.querySelector('#post-count').textContent = `${sortedPosts.length}개의 익명 의견`;
  document.querySelector('#post-list').innerHTML = sortedPosts.length
    ? sortedPosts.map(post => `<article class="post-item"><div class="avatar-anon" aria-hidden="true">익</div><div class="post-item-body"><span class="post-author">익명</span><time class="post-time">${escapeHTML(relativeTime(post.createdAt))}</time><p class="post-text">${escapeHTML(post.text)}</p></div></article>`).join('')
    : '<div class="empty-posts">첫 번째 의견을 남겨주세요.</div>';
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
  if (pollGrid) {
    renderCategories();
    renderPolls();
  }
  renderStats();
  renderPosts();
  renderAdminPolls();
  renderNotifications();
}

function resetPollForm() {
  document.querySelector('#poll-form').reset();
  document.querySelector('#poll-id').value = '';
  document.querySelector('#poll-author').value = '학생회';
  document.querySelector('#form-title').textContent = '새 투표 만들기';
  document.querySelector('#save-poll-button').textContent = '투표 생성하기';
  document.querySelector('#cancel-edit-button').classList.add('hidden');
}

if (categoryList) categoryList.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderPolls();
});

if (pollGrid) pollGrid.addEventListener('click', event => {
  const optionButton = event.target.closest('[data-option-index]');
  if (optionButton) {
    const poll = data.polls.find(item => item.id === optionButton.dataset.pollId);
    if (!poll || isClosed(poll) || data.votesByPoll[poll.id] !== undefined) return;
    pollGrid.querySelectorAll(`[data-poll-id="${CSS.escape(poll.id)}"]`).forEach(button => button.classList.remove('chosen'));
    optionButton.classList.add('chosen');
    optionButton.setAttribute('aria-pressed', 'true');
    return;
  }

  const submitButton = event.target.closest('[data-submit-poll]');
  if (!submitButton) return;
  const poll = data.polls.find(item => item.id === submitButton.dataset.submitPoll);
  const selected = pollGrid.querySelector(`[data-poll-id="${CSS.escape(submitButton.dataset.submitPoll)}"].chosen`);
  if (!poll || !selected) {
    showToast('먼저 선택지를 골라주세요.');
    return;
  }
  if (isClosed(poll) || data.votesByPoll[poll.id] !== undefined) {
    showToast('이미 마감되었거나 참여한 투표예요.');
    return;
  }

  const optionIndex = Number(selected.dataset.optionIndex);
  poll.options[optionIndex].votes += 1;
  data.votesByPoll[poll.id] = optionIndex;
  if (saveData()) {
    renderAll();
    showToast('소중한 한 표가 익명으로 반영됐어요!');
  }
});

if (searchInput) searchInput.addEventListener('input', renderPolls);
if (sortSelect) sortSelect.addEventListener('change', renderPolls);

const postInput = document.querySelector('#post-input');
if (postInput) postInput.addEventListener('input', () => {
  document.querySelector('#character-count').textContent = `${postInput.value.length} / 240`;
});

const postForm = document.querySelector('#post-form');
if (postForm) postForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = postInput.value.trim();
  if (!text) {
    showToast('의견을 입력해 주세요.');
    postInput.focus();
    return;
  }
  data.posts.push({ id: `post-${Date.now()}`, text, createdAt: Date.now() });
  if (saveData()) {
    postInput.value = '';
    document.querySelector('#character-count').textContent = '0 / 240';
    renderPosts();
    showToast('익명 의견을 등록했어요.');
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
