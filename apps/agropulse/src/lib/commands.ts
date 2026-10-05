// Comandos de riego: etiquetas y mensajes de error.
import { getErrorMessage } from '@/lib/errors';

export type CommandAction = 'open' | 'close';
export type CommandStatus = 'pending' | 'applied' | 'failed';

export function actionLabel(action: CommandAction, durationMin: number | null): string {
  if (action === 'close') return 'Cerrar';
  return durationMin ? `Abrir ${durationMin} min` : 'Abrir';
}

export const STATUS_LABELS: Record<CommandStatus, string> = {
  pending: 'Pendiente',
  applied: 'Aplicado',
  failed: 'Falló',
};

export function failureReasonLabel(reason: string | null): string {
  if (reason === 'valve_timeout') return 'La válvula no respondió (valve_timeout).';
  return reason ?? 'Error desconocido.';
}

// Las dos restricciones únicas de irrigation_commands devuelven el mismo código (23505);
// se distinguen por el nombre de la restricción que viene en el mensaje.
export function getCommandErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23505' && e.message?.includes('one_pending_per_valve')) {
    return 'Ya hay un comando pendiente para esta válvula. Esperá a que se aplique.';
  }
  if (e?.code === '23505' && e.message?.includes('irrigation_commands_client_request_id_key')) {
    return 'Este comando ya fue enviado (no se duplicó).';
  }
  if (e?.code === '42501') {
    return 'Tu rol no permite comandar válvulas.';
  }
  return getErrorMessage(error);
}
