import type { TourLink, TourRequestInput } from '@/services/api';

// Mirrors common_code TOUR_CONFIG; the server checks the same rules.
export const TOUR_FORM_LIMITS = { imageMax: 10, titleMin: 2, titleMax: 40, capacityMin: 2, capacityMax: 20, itemLength: 40, itemCount: 20, linkMax: 5, linkNameMax: 20, linkUrlMax: 500 };

// remote: already uploaded (editing a saved tour), sent as-is instead of uploading again
export type LocalImage = { uri: string; mimeType: string; remote?: boolean };
export type TourForm = {
  images: LocalImage[];
  title: string;
  continentCode: string;
  countryCode: string;
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;
  capacity: string; // digits as typed
  fee: string; // digits as typed (shown with commas)
  included: string[];
  excluded: string[];
  links: TourLink[]; // 문의 링크: 새 투어는 프로필 링크로 미리 채움 (17장)
};
export type TourField = 'images' | 'title' | 'region' | 'period' | 'capacity' | 'links';

export const EMPTY_TOUR_FORM: TourForm = {
  images: [], title: '', continentCode: '', countryCode: '', startDate: '', endDate: '', capacity: '', fee: '', included: [], excluded: [], links: [],
};

// 5장: 잘못된 값은 라벨 옆에 바로 보여줄 문구. 맞는 칸은 빠짐.
// minCapacity: when editing, the tour can't go below the people already recruited.
export function tourFormErrors(form: TourForm, today: string, minCapacity = 0): Partial<Record<TourField, string>> {
  const L = TOUR_FORM_LIMITS;
  const errors: Partial<Record<TourField, string>> = {};
  if (form.images.length < 1) errors.images = '1장 이상 올려 주세요';
  const title = form.title.trim();
  if (title.length < L.titleMin || title.length > L.titleMax) errors.title = `${L.titleMin}~${L.titleMax}자로 입력해 주세요`;
  if (!form.continentCode || !form.countryCode) errors.region = '대륙과 나라를 골라 주세요';
  if (!form.startDate || !form.endDate) errors.period = '시작일과 종료일을 골라 주세요';
  else if (form.startDate < today) errors.period = '시작일은 오늘 이후로 골라 주세요';
  else if (form.endDate < form.startDate) errors.period = '종료일이 시작일보다 빨라요';
  const capacity = Number(form.capacity);
  if (!/^\d+$/.test(form.capacity) || capacity < L.capacityMin || capacity > L.capacityMax) errors.capacity = `${L.capacityMin}~${L.capacityMax}명`;
  else if (capacity < minCapacity) errors.capacity = `이미 모집된 ${minCapacity}명보다 적게 못 줄여요`;
  if (form.links.length < 1) errors.links = '1개 이상 넣어 주세요';
  return errors;
}

// 14장 링크 규칙 (서버와 같음): 앞뒤 공백을 빼고, https://가 없으면 붙임. 주소로 볼 수 없으면 null.
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
export function formatFee(digits: string) {
  const trimmed = digitsOnly(digits).replace(/^0+(?=\d)/, '');
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Something was entered or changed, so leaving asks first (바뀐 게 없으면 바로 나감).
export function isTourFormDirty(form: TourForm, initial: TourForm = EMPTY_TOUR_FORM) {
  return JSON.stringify(form) !== JSON.stringify(initial);
}

// 수정: 저장된 투어를 입력 칸으로
export function formFromTour(tour: {
  images: string[]; title: string; continentCode: string; countryCode: string; startDate: string; endDate: string;
  capacity: number; fee: number | null; included: string[]; excluded: string[];
}, links: TourLink[]): TourForm {
  return {
    images: tour.images.map(uri => ({ uri, mimeType: '', remote: true })),
    title: tour.title, continentCode: tour.continentCode, countryCode: tour.countryCode,
    startDate: tour.startDate, endDate: tour.endDate, capacity: String(tour.capacity), fee: tour.fee !== null ? String(tour.fee) : '',
    included: tour.included, excluded: tour.excluded, links,
  };
}

export function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

// What the server receives once the images are uploaded (빈 줄은 저장 안 함).
export function toTourRequest(form: TourForm, imageUrls: string[]): TourRequestInput {
  const lines = (items: string[]) => items.map(line => line.trim()).filter(Boolean);
  return {
    images: imageUrls,
    title: form.title.trim().replace(/\s+/g, ' '),
    continentCode: form.continentCode,
    countryCode: form.countryCode,
    startDate: form.startDate,
    endDate: form.endDate,
    capacity: Number(form.capacity),
    fee: form.fee ? Number(digitsOnly(form.fee)) : null,
    included: lines(form.included),
    excluded: lines(form.excluded),
    links: form.links,
  };
}

// Today on this phone as YYYY-MM-DD (the server re-checks with Korean time).
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
