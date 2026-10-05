// Traduce errores de Supabase / red a mensajes claros en español.
type ErrorLike = { code?: string; message?: string; name?: string } | null | undefined;

export function isNetworkError(error: unknown): boolean {
  const e = error as ErrorLike;
  const message = e?.message ?? '';
  return (
    e?.name === 'AuthRetryableFetchError' ||
    message.includes('Network request failed') ||
    message.includes('Failed to fetch')
  );
}

export function getErrorMessage(error: unknown): string {
  const e = error as ErrorLike;
  if (isNetworkError(error)) {
    return 'Sin conexión. Revisá tu red e intentá de nuevo.';
  }
  if (e?.code === 'invalid_credentials' || e?.message?.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (e?.code === '42501') {
    return 'Tu rol no tiene permiso para esta acción.';
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}
