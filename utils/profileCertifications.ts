import type { Certification, CertificationOption } from '@/services/api';

const AIDA_INSTRUCTOR_RANK: Record<string, number> = {
  'AIDA-INST': 1,
  'AIDA-MASTER-INST': 2,
  'AIDA-INST-TRAINER': 3,
};

export function groupProfileCertifications(certifications: Certification[], options: CertificationOption[] = []) {
  const catalog = new Map(options.map(option => [option.id, option]));
  const groups = new Map<string, { association: string; certificates: CertificationOption[] }>();
  const unknown: { association: string; labels: string[]; imageUrls?: (string | undefined)[] }[] = [];
  for (const cert of new Map(certifications.map(cert => [cert.id, cert])).values()) {
    const option = cert.association && cert.levelOrder != null && cert.isInstructor != null
      ? cert as CertificationOption : catalog.get(cert.id);
    if (!option) {
      // Preserve real qualifications if the catalog is temporarily unavailable.
      unknown.push({ association: '', labels: [cert.name.trim()], ...(cert.imageUrl ? { imageUrls: [cert.imageUrl] } : {}) });
      continue;
    }
    const key = option.association.code;
    const group = groups.get(key) ?? { association: option.association.name, certificates: [] };
    group.certificates.push({ ...option, imageUrl: cert.imageUrl });
    groups.set(key, group);
  }
  return [...Array.from(groups.values(), group => {
    const instructors = group.certificates.filter(cert => Number(cert.isInstructor) === 1);
    const rank = (cert: CertificationOption) => cert.association.code === 'AIDA' ? AIDA_INSTRUCTOR_RANK[cert.code ?? ''] ?? 0 : 0;
    const ranked = instructors.filter(cert => rank(cert) > 0).sort((a, b) => rank(b) - rank(a));
    // Youth and other specializations are independent of the main instructor ladder.
    const selected = instructors.length
      ? [...ranked.slice(0, 1), ...instructors.filter(cert => rank(cert) === 0)]
      : [...group.certificates].sort((a, b) => b.levelOrder - a.levelOrder).slice(0, 1);
    return {
      association: group.association,
      ...(selected.some(cert => cert.imageUrl) ? { imageUrls: selected.map(cert => cert.imageUrl) } : {}),
      labels: selected.map(cert => {
        const name = cert.name.trim();
        // Catalog names may already include the association; avoid repeating it.
        const prefixes = [cert.association.name, cert.association.code]
          .filter((value): value is string => !!value?.trim()).sort((a, b) => b.length - a.length);
        const prefix = prefixes.find(value => name.toLowerCase().startsWith(`${value.toLowerCase()} `));
        const shortName = prefix ? name.slice(prefix.length).trim() : name;
        const label = cert.association.code === 'AIDA' && !Number(cert.isInstructor)
          && cert.levelOrder >= 1 && cert.levelOrder <= 4
          ? `Level ${cert.levelOrder}` : shortName;
        return `${cert.association.code} ${label}`;
      }),
    };
  }), ...unknown];
}
