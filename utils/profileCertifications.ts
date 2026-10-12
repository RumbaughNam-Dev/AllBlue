import type { Certification, CertificationOption } from '@/services/api';

export function groupProfileCertifications(certifications: Certification[], options: CertificationOption[]) {
  const catalog = new Map(options.map(option => [option.id, option]));
  const groups = new Map<string, { association: string; certificates: CertificationOption[] }>();
  const unknown: { association: string; labels: string[]; imageUrls?: (string | undefined)[] }[] = [];
  for (const cert of new Map(certifications.map(cert => [cert.id, cert])).values()) {
    const option = catalog.get(cert.id);
    if (!option) {
      // Preserve real qualifications if the catalog is temporarily unavailable.
      unknown.push({ association: '', labels: [cert.nameKo?.trim() || cert.name], ...(cert.imageUrl ? { imageUrls: [cert.imageUrl] } : {}) });
      continue;
    }
    const key = option.association.code;
    const group = groups.get(key) ?? { association: option.association.name, certificates: [] };
    group.certificates.push({ ...option, imageUrl: cert.imageUrl });
    groups.set(key, group);
  }
  return [...Array.from(groups.values(), group => {
    const instructors = group.certificates.filter(cert => Number(cert.isInstructor) === 1);
    const selected = instructors.length ? instructors : [...group.certificates].sort((a, b) => b.levelOrder - a.levelOrder).slice(0, 1);
    return {
      association: group.association,
      ...(selected.some(cert => cert.imageUrl) ? { imageUrls: selected.map(cert => cert.imageUrl) } : {}),
      labels: selected.map(cert => {
        const name = cert.nameKo?.trim() || cert.name;
        // Catalog names may already include the association; avoid repeating it.
        const prefixes = [cert.association.nameKo, cert.association.name, cert.association.code]
          .filter((value): value is string => !!value?.trim()).sort((a, b) => b.length - a.length);
        const prefix = prefixes.find(value => name.toLowerCase().startsWith(`${value.toLowerCase()} `));
        return prefix ? name.slice(prefix.length).trim() : name;
      }),
    };
  }), ...unknown];
}
