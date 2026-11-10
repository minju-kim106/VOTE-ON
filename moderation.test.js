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

test('blocks names, student IDs, phone numbers, email addresses, addresses, and resident registration numbers', () => {
  for (const text of [
    '연락처 010-1234-5678',
    '전화 02 123 4567',
    '연락처 +82 10 1234 5678',
    '메일 vote.student@example.com',
    '실명: 김민수',
    '이름은 김민수입니다.',
    '저는 홍길동이에요.',
    '이름: John Smith',
    '학번 20261234',
    '주소: 서울시 강남구 테헤란로 123',
    '서울특별시 강남구 역삼동 테헤란로 123-4',
    '주민등록번호 900101-1234567'
  ]) {
    assert.equal(checkPost(text).allowed, false, `${text} should be rejected`);
    assert.match(checkPost(text).reason, /개인정보/);
  }
});

test('allows ordinary text containing dates, locations, and unlabelled common Korean words', () => {
  for (const text of [
    '다음 주 2026년 11월에 학교 축제가 열려요.',
    '서울에서 열린 행사에 참여하고 싶어요.',
    '이름처럼 예쁜 학교 정원이 생기면 좋겠어요.'
  ]) {
    assert.equal(checkPost(text).allowed, true, `${text} should be allowed`);
  }
});
