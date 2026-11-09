const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPost } = require('./moderation.js');

test('allows ordinary school feedback', () => {
  assert.deepEqual(checkPost('도서관에 조용히 공부할 공간이 더 있으면 좋겠어요.'), {
    allowed: true,
    reason: ''
  });
});

test('blocks prohibited expressions even when separators or compatibility jamo are used', () => {
  for (const text of ['시발', '시.발', 'ㅅ ㅂ', 'ㅂㅕㅇㅅㅣㄴ']) {
    assert.equal(checkPost(text).allowed, false, `${text} should be rejected`);
    assert.equal(checkPost(text).reason, '부적절한 표현이 포함되어 있습니다. 내용을 수정해 주세요.');
  }
});

test('warns about phone numbers, email addresses, and labeled real names', () => {
  for (const text of [
    '연락처 010-1234-5678',
    '메일 vote.student@example.com',
    '실명: 김민수',
    '학번 20261234'
  ]) {
    assert.equal(checkPost(text).allowed, false, `${text} should be rejected`);
    assert.match(checkPost(text).reason, /개인정보/);
  }
});
