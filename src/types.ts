export type ResourceType = 'file' | 'process' | 'service' | 'memory' | 'other';

export interface Registration {
name: string; // ej. "/org/service/db" (ruta jerárquica)
resource: string; // direccion física o descriptor (p. ej. "10.0.0.5:8080" o "/mnt/disk/file.txt")
type: ResourceType;
}

export interface ResolveResult {
found: boolean;
resource?: string;
via?: string; // servidor que devolvió la respuesta
}