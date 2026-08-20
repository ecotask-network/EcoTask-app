export interface ProofMetadataInput {
  taskId: string;
  photoCid: string;
  lat?: number;
  lng?: number;
  capturedAt?: string;
}

export function buildProofMetadata(
  input: ProofMetadataInput,
): Record<string, unknown> {
  return {
    taskId: input.taskId,
    photoCid: input.photoCid,
    lat: input.lat,
    lng: input.lng,
    capturedAt: input.capturedAt || new Date().toISOString(),
    source: 'ecotask-app',
  };
}

export function proofFileName(
  taskId: string,
  capturedAt?: string,
  extension = 'jpg',
): string {
  const time = capturedAt ? new Date(capturedAt).getTime() : Date.now();
  const safeTime = isNaN(time) ? Date.now() : time;
  return `proof-${taskId}-${safeTime}.${extension}`;
}
