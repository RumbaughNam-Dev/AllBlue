// Same level mapping used by profile editing: 5 = instructor, A = administrator.
export function hasInstructorAccess(level?: string | number | null) {
  return String(level) === '5' || level === 'A';
}
