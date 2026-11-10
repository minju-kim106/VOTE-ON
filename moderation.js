(function (root, factory) {
  const moderation = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = moderation;
  if (root) root.VoteModeration = moderation;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const blockedTerms = [
    '시발', '씨발', '씨팔', 'ㅅㅂ', '병신', '븅신', '개새끼', '새끼야',
    '좆', '지랄', '꺼져', '닥쳐', '죽어', '한남', '한녀', '맘충',
    '바보', '멍청이', '찐따', '쓰레기','미친','ㅁㅊ','ㅈㄹ','ㅄ','ㅂㅅ','ㅂㅅㄲ','ㅂㅅㄲ야','ㅂㅅ야','ㅂㅅ같은놈','ㅂㅅ같은년','개새끼야','개새끼같은놈','개새끼같은년',
    '개새끼같은놈아','개새끼같은년아','개새끼같은놈이','개새끼같은년이','개새끼같은놈이야','개새끼같은년이야','개새끼같은놈이냐','개새끼같은년이냐','개새끼같은놈이냐?','개새끼같은년이냐?','개새끼같은놈이냐!','개새끼같은년이냐!','개새끼같은놈이냐!!','개새끼같은년이냐!!'
  ];
  const finalJamoIndex = new Map([
    [0x1100, 1], [0x1101, 2], [0x1102, 4], [0x1103, 7], [0x1105, 8],
    [0x1106, 16], [0x1107, 17], [0x1109, 19], [0x110a, 20], [0x110b, 21],
    [0x110c, 22], [0x110e, 23], [0x110f, 24], [0x1110, 25], [0x1111, 26], [0x1112, 27]
  ]);

  function composeHangul(value) {
    const characters = [...value];
    let result = '';
    for (let index = 0; index < characters.length; index += 1) {
      const onset = characters[index].codePointAt(0);
      const vowel = characters[index + 1]?.codePointAt(0);
      if (!characters[index + 1] || onset < 0x1100 || onset > 0x1112 || vowel < 0x1161 || vowel > 0x1175) {
        result += characters[index];
        continue;
      }

      let trailing = 0;
      const next = characters[index + 2]?.codePointAt(0);
      if (next >= 0x11a8 && next <= 0x11c2) {
        trailing = next - 0x11a7;
        index += 1;
      } else if (next >= 0x1100 && next <= 0x1112) {
        const afterNext = characters[index + 3]?.codePointAt(0);
        const canBeFinal = afterNext === undefined || afterNext < 0x1161 || afterNext > 0x1175;
        const finalIndex = finalJamoIndex.get(next);
        if (canBeFinal && finalIndex) {
          trailing = finalIndex;
          index += 1;
        }
      }
      const syllable = 0xac00 + (onset - 0x1100) * 588 + (vowel - 0x1161) * 28 + trailing;
      result += String.fromCodePoint(syllable);
      index += 1;
    }
    return result;
  }

  function normalizeText(value) {
    const decomposed = String(value)
      .normalize('NFKC')
      .normalize('NFKD')
      .toLocaleLowerCase('ko-KR')
      .replace(/[\u200B-\u200F\uFEFF\u00AD]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .replace(/(.)\1{2,}/gu, '$1');
    return composeHangul(decomposed);
  }

  const normalizedBlockedTerms = blockedTerms.map(normalizeText);

  function containsPersonalInformation(value) {
    const text = String(value).normalize('NFKC');
    const digits = text.replace(/\D/g, '');
    const hasPhone = /(?:^|[^\d])(?:\+?82[\s().-]*0?[\s().-]*)?(?:01[016789][\s().-]*\d{3,4}[\s().-]*\d{4}|0\d{1,2}[\s().-]*\d{3,4}[\s().-]*\d{4})(?:$|[^\d])/u.test(text)
      || /(?:^|[^\d])\+?82[\s().-]*1[016789][\s().-]*\d{3,4}[\s().-]*\d{4}(?:$|[^\d])/u.test(text);
    const hasEmail = /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u.test(text);
    const hasIdNumber = /\d{6}[\s-]?[1-4]\d{6}/u.test(text) || /\d{13}/u.test(digits);
    const hasSchoolId = /학번\s*[:：은는이가]?\s*\d{4,10}/u.test(text);
    const nameEnding = '(?=$|\\s|[,.;!?]|(?:입니다|이에요|예요|이야|임)(?:\\s|$|[,.;!?]))';
    const nameLabel = '(?:이름|실명|성명|본명)(?=\\s|은|는|이|가|[:=：])';
    const hasKoreanName = new RegExp(
      `${nameLabel}\\s*(?:(?:은|는|이|가)\\s*|[:=：]\\s*)?[가-힣]{2,4}${nameEnding}`,
      'u'
    ).test(text)
      || new RegExp(`(?:저는|나는|제\\s*이름은|내\\s*이름은)\\s*[가-힣]{2,4}${nameEnding}`, 'u').test(text);
    const hasEnglishName = new RegExp(
      `${nameLabel}\\s*(?:(?:은|는|이|가)\\s*|[:=：]\\s*)?[A-Z][A-Z.'-]*(?:\\s+[A-Z][A-Z.'-]*){0,2}(?=$|\\s|[,.;!?])`,
      'iu'
    ).test(text);
    const hasLabeledAddress = /(?:집\s*주소|주소|거주지|사는\s*곳)\s*(?:(?:은|는|이|가)\s*)?[:=：]?\s*\S{4,}/u.test(text);
    const hasKoreanStreetAddress = /(?:(?:서울|부산|대구|인천|광주|대전|울산|세종|제주)(?:특별자치도|특별자치시|특별시|광역시|시)?|[가-힣]{2,}(?:도|특별자치도))\s*[가-힣0-9\s-]{1,30}(?:시|군|구)\s*[가-힣0-9\s-]{1,30}(?:동|읍|면|리|로|길)\s*\d+(?:-\d+)?(?:번지)?/u.test(text);
    return hasPhone || hasEmail || hasIdNumber || hasSchoolId || hasKoreanName || hasEnglishName
      || hasLabeledAddress || hasKoreanStreetAddress;
  }

  function checkPost(value) {
    const text = String(value).trim();
    if (containsPersonalInformation(text)) {
      return {
        allowed: false,
        reason: '개인정보가 포함되어 있을 수 있습니다. 이름, 연락처, 학번 등을 지우고 다시 작성해 주세요.'
      };
    }

    const normalized = normalizeText(text);
    if (normalizedBlockedTerms.some(term => term && normalized.includes(term))) {
      return {
        allowed: false,
        reason: '부적절한 표현이 포함되어 있습니다. 내용을 수정해 주세요.'
      };
    }

    return { allowed: true, reason: '' };
  }

  return { checkPost, containsPersonalInformation, normalizeText };
});
