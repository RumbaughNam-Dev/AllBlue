import type { TourLink, TourProposalInput, TourRegistrationInput, TourRole, TourStyle } from '@/services/api';

// 서버(tour-rules.ts)와 같은 규칙
export const TOUR_FORM_LIMITS = {
  imageMax: 10, titleMin: 2, titleMax: 40, placeMax: 30, capacityMin: 2, capacityMax: 20, itemLength: 40, itemCount: 20,
  linkMax: 5, linkNameMax: 20, linkUrlMax: 500, applyMessageMax: 100, proposalMessageMax: 200,
};

// remote: 이미 올린 사진 (수정할 때), 다시 올리지 않고 주소 그대로 보냄
export type LocalImage = { uri: string; mimeType: string; remote?: boolean };

// 4 · 5장 등록 화면 (수정도 같은 화면). 참여자로는 사진 · 기간 · 지역 · 투어 장소 · 형태 · 인원, 인솔자로는 인솔 정보까지
export type TourForm = {
  role: TourRole;
  images: LocalImage[];
  coverUri: string; // 대표 사진 (카드에 크게) — 처음엔 첫 장
  continentCode: string;
  countryCode: string;
  place: string; // 투어 장소: 도시 이름 (참여자로 · 인솔자로 모두 필수)
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;
  tourStyle: TourStyle | '';
  capacity: number; // 총 인원 2~20 (인솔자 빼고)
  baseCount: number; // 지금 모인 인원: 참여자로는 나 포함 1명부터, 인솔자로는 인솔자 빼고 0명부터
  title: string;
  fee: string; // 숫자만 (쉼표는 보여줄 때)
  included: string[];
  excluded: string[];
  links: TourLink[]; // 문의 링크: 투어마다 따로 넣음, 프로필 링크와 연동 안 함 (16장)
};
export type TourField = 'images' | 'region' | 'place' | 'period' | 'style' | 'counts' | 'title' | 'fee' | 'links';

export const emptyTourForm = (role: TourRole = 'PARTICIPANT'): TourForm => ({
  role, images: [], coverUri: '', continentCode: '', countryCode: '', place: '', startDate: '', endDate: '', tourStyle: '',
  capacity: 4, baseCount: role === 'PARTICIPANT' ? 1 : 0, title: '', fee: '', included: [], excluded: [], links: [],
});

export const coverIndexOf = (images: LocalImage[], coverUri: string) => Math.max(0, images.findIndex(image => image.uri === coverUri));

// 인원 규칙: 참여자로는 나를 포함해 1명부터 총 인원까지, 인솔자로는 인솔자 빼고 0명부터
export const baseMin = (role: TourRole) => (role === 'PARTICIPANT' ? 1 : 0);

// 잘못된 값은 라벨 옆에 바로 보여줄 문구 (맞는 칸은 빠짐). joined: 수정할 때 이미 수락한 참여자 수
export function tourFormErrors(form: TourForm, today: string, joined = 0): Partial<Record<TourField, string>> {
  const L = TOUR_FORM_LIMITS;
  const errors: Partial<Record<TourField, string>> = {};
  // 사진: 참여자로는 선택, 인솔자로(소개 이미지)는 1장 이상
  if (form.role === 'LEADER' && form.images.length < 1) errors.images = '1장 이상 올려 주세요';
  if (!form.continentCode || !form.countryCode) errors.region = '대륙과 나라를 골라 주세요';
  if (!placeText(form.place)) errors.place = '도시 이름을 입력해 주세요';
  if (!form.startDate || !form.endDate) errors.period = '시작일과 종료일을 골라 주세요';
  else if (form.startDate < today) errors.period = '시작일은 오늘 이후로 골라 주세요';
  else if (form.endDate < form.startDate) errors.period = '종료일이 시작일보다 빨라요';
  if (!form.tourStyle) errors.style = '투어 형태를 골라 주세요';
  if (form.baseCount < baseMin(form.role) || form.baseCount > form.capacity) errors.counts = '지금 모인 인원은 총 인원까지예요';
  else if (form.baseCount + joined > form.capacity) errors.counts = `확정된 ${form.baseCount + joined}명보다 적게 못 줄여요`;
  if (form.role === 'LEADER') {
    const title = form.title.trim();
    if (title.length < L.titleMin || title.length > L.titleMax) errors.title = `${L.titleMin}~${L.titleMax}자로 입력해 주세요`;
    if (form.links.length < 1) errors.links = '1개 이상 넣어 주세요';
  }
  return errors;
}

// 남은 자리에 따라 등록될 상태 (4 · 5장 아래 안내 · 확인 창)
export function registerOutcome(form: Pick<TourForm, 'role' | 'capacity' | 'baseCount'>) {
  const left = form.capacity - form.baseCount;
  if (form.role === 'LEADER') return left > 0 ? 'RECRUITING' : 'CLOSED';
  return left > 0 ? 'RECRUITING' : 'SEEKING_LEADER';
}

const lines = (items: string[]) => items.map(line => line.trim()).filter(Boolean);
// 투어 장소: 앞뒤 공백을 빼고 여러 칸은 한 칸으로 (서버와 같은 규칙)
const placeText = (place: string) => place.trim().replace(/\s+/g, ' ');

// 사진을 올린 뒤 서버로 보낼 값 (빈 줄은 저장 안 함)
export function toTourInput(form: TourForm, imageUrls: string[]): TourRegistrationInput {
  const base = {
    role: form.role, images: imageUrls, coverIndex: coverIndexOf(form.images, form.coverUri),
    continentCode: form.continentCode, countryCode: form.countryCode, place: placeText(form.place), startDate: form.startDate, endDate: form.endDate,
    tourStyle: form.tourStyle as TourStyle, capacity: form.capacity, baseCount: form.baseCount,
  };
  if (form.role === 'PARTICIPANT') return base;
  return {
    ...base, title: form.title.trim().replace(/\s+/g, ' '), fee: form.fee ? Number(digitsOnly(form.fee)) : null,
    included: lines(form.included), excluded: lines(form.excluded), links: form.links,
  };
}

// 수정: 저장된 투어를 입력 칸으로 (장소가 없던 예전 투어는 빈 칸 → 채워야 저장)
export function formFromTour(tour: {
  registerRole: TourRole; images: string[]; coverIndex: number; continentCode: string; countryCode: string; place?: string | null;
  startDate: string; endDate: string;
  tourStyle: TourStyle; capacity: number; baseCount: number; title: string | null; fee: number | null; included: string[]; excluded: string[];
}, links: TourLink[]): TourForm {
  return {
    role: tour.registerRole, images: tour.images.map(uri => ({ uri, mimeType: '', remote: true })),
    coverUri: tour.images[tour.coverIndex] ?? tour.images[0] ?? '',
    continentCode: tour.continentCode, countryCode: tour.countryCode, place: tour.place ?? '', startDate: tour.startDate, endDate: tour.endDate,
    tourStyle: tour.tourStyle, capacity: tour.capacity, baseCount: tour.baseCount,
    title: tour.title ?? '', fee: tour.fee !== null ? String(tour.fee) : '', included: tour.included, excluded: tour.excluded, links,
  };
}

// 8장 제안하기: 인솔자로 등록과 같은 인솔 정보 칸 + 한마디 (제안에선 참가비 필수)
export type ProposalForm = {
  images: LocalImage[]; coverUri: string; title: string; fee: string; included: string[]; excluded: string[]; links: TourLink[]; message: string;
};
export type ProposalField = 'images' | 'title' | 'fee' | 'links' | 'message';
export const EMPTY_PROPOSAL_FORM: ProposalForm = { images: [], coverUri: '', title: '', fee: '', included: [], excluded: [], links: [], message: '' };

export function proposalErrors(form: ProposalForm): Partial<Record<ProposalField, string>> {
  const L = TOUR_FORM_LIMITS;
  const errors: Partial<Record<ProposalField, string>> = {};
  if (form.images.length < 1) errors.images = '1장 이상 올려 주세요';
  const title = form.title.trim();
  if (title.length < L.titleMin || title.length > L.titleMax) errors.title = `${L.titleMin}~${L.titleMax}자로 입력해 주세요`;
  if (!digitsOnly(form.fee)) errors.fee = '참가비를 입력해 주세요';
  if (form.links.length < 1) errors.links = '1개 이상 넣어 주세요';
  if (form.message.trim().length > L.proposalMessageMax) errors.message = `${L.proposalMessageMax}자까지예요`;
  return errors;
}

export function toProposalInput(form: ProposalForm, imageUrls: string[]): TourProposalInput {
  return {
    images: imageUrls, coverIndex: coverIndexOf(form.images, form.coverUri), title: form.title.trim().replace(/\s+/g, ' '),
    fee: Number(digitsOnly(form.fee)), included: lines(form.included), excluded: lines(form.excluded), links: form.links, message: form.message.trim(),
  };
}

export function proposalFormFrom(p: { images: string[]; coverIndex: number; title: string; fee: number; included: string[]; excluded: string[]; links: TourLink[]; message: string | null }): ProposalForm {
  return {
    images: p.images.map(uri => ({ uri, mimeType: '', remote: true })), coverUri: p.images[p.coverIndex] ?? p.images[0] ?? '',
    title: p.title, fee: String(p.fee), included: p.included, excluded: p.excluded, links: p.links, message: p.message ?? '',
  };
}

// 링크 규칙 (서버와 같음): 앞뒤 공백을 빼고, https://가 없으면 붙임. 주소로 볼 수 없으면 null.
export function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();
  const url = /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:\/\//i, 'https://') : `https://${trimmed}`;
  return url.length <= TOUR_FORM_LIMITS.linkUrlMax && /^https:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i.test(url) ? url : null;
}

// 링크 추가 팝업: 칸 아래 빨간 글씨 (빈 칸은 아직 안 알림)
export function linkErrors(name: string, url: string) {
  const errors: { name?: string; url?: string } = {};
  if (name.trim().length > TOUR_FORM_LIMITS.linkNameMax) errors.name = `${TOUR_FORM_LIMITS.linkNameMax}자까지 넣을 수 있어요`;
  if (url.trim() && !normalizeLinkUrl(url)) errors.url = '주소를 다시 확인해 주세요';
  return errors;
}

export const digitsOnly = (text: string) => text.replace(/\D/g, '');

// '1200000' → '1,200,000' (참가비는 숫자만, 천 단위 쉼표 자동)
export function feeDigits(digits: string) {
  const trimmed = digitsOnly(digits).replace(/^0+(?=\d)/, '');
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 무언가 넣거나 바꿨으면 나가기 전에 물어봄 (바뀐 게 없으면 바로 나감)
export const isDirty = <T,>(form: T, initial: T) => JSON.stringify(form) !== JSON.stringify(initial);

export function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

// 이 휴대폰 날짜로 오늘 (서버가 한국 시간으로 다시 확인)
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
