export function maskPhone(phone?: string) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  return phone;
}

// 트레이닝 참가 비용: 30000 → '30,000원', 0 → '무료'
export function formatWon(amount?: number | null) {
  if (amount == null) return '-';
  return amount === 0 ? '무료' : `${amount.toLocaleString('ko-KR')}원`;
}

// 입력칸 숫자만 남기고 세 자리마다 쉼표 ('30000' → '30,000')
export function formatDigits(text: string) {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
