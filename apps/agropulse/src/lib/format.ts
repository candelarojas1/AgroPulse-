// Antigüedad de una lectura: "hace 12 s", "hace 5 min", "hace 2 h", "hace 3 d" (RF-09).
export function formatAge(isoDate: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
