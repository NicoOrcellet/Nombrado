// Importamos librería para hacer peticiones HTTP
import fetch from "node-fetch";

// ===============================
// TIPO DE DATO Entry
// ===============================
// Representa una entrada obtenida desde el naming server
// Cada servicio tiene: host, puerto y opcionalmente la interfaz (métodos que ofrece)
type Entry = { host: string; port: number; iface?: string[] };

// ===============================
// CLIENTE DE NAMING SERVER
// ===============================
// Clase que permite consultar a un naming server para obtener la dirección
// de un servicio registrado.
class NamingClient {
   public namingBase: string;

  // Constructor: recibe la URL base del naming server (ej: http://127.0.0.1:5000)
  constructor(namingBase = "http://127.0.0.1:5000") {
    this.namingBase = namingBase;
  }

  // Método lookup: busca un servicio por su nombre
  // Devuelve un array de entradas [{host, port, iface}]
  async lookup(name: string): Promise<Entry[]> {
    const r = await fetch(`${this.namingBase}/lookup/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error(`lookup failed: ${r.status}`);
    const json = await r.json();
    return json.entries;
  }
}

// ===============================
// INTERFAZ DE LOS MÉTODOS REMOTOS
// ===============================
// Esto define cómo se espera que sea la "API" del servicio remoto.
// No implementa nada, solo sirve para que TypeScript nos dé autocompletado y chequeos.
interface RemoteCalc {
  add(a: number, b: number): Promise<number>;
  mul(a: number, b: number): Promise<number>;
  echo(msg: string): Promise<string>;
}

// ===============================
// PROXY DINÁMICO
// ===============================
// Esta función construye un "proxy" que actúa como si fuera el servicio remoto.
// Cuando llamamos a remote.add(2,3), en realidad manda una petición HTTP al servicio real.
function buildProxy(entry: Entry): RemoteCalc {
  const base = `http://${entry.host}:${entry.port}`;

  return new Proxy({} as RemoteCalc, {
    // "get" intercepta cualquier acceso a propiedades del objeto proxy
    // Ejemplo: remote.add -> prop = "add"
    get(_, prop: string) {
      // Devolvemos una función async que enviará la invocación al servicio
      return async (...args: any[]) => {
        const res = await fetch(`${base}/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Mandamos { method: "add", args: [2,3] }
          body: JSON.stringify({ method: prop, args })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "invoke error");
        return json.result;
      };
    }
  });
}

// ===============================
// EJEMPLO DE USO
// ===============================
// Flujo completo:
// 1. Consultamos al naming server para encontrar el servicio "org.example.calc"
// 2. Creamos un proxy dinámico para ese servicio
// 3. Llamamos a sus métodos como si fueran locales
(async () => {
  // Creamos un cliente apuntando al naming server en 127.0.0.1:5000
  const nc = new NamingClient("http://127.0.0.1:5000");

  // Buscamos el servicio por nombre
  const entries = await nc.lookup("org.example.calc");
  if (entries.length === 0) throw new Error("No se encontró el servicio");

  // Construimos un proxy con la primera entrada encontrada
  const remote = buildProxy(entries[0]);

  // Llamamos a métodos remotos como si fueran locales
  const sum = await remote.add(2, 3);
  console.log("2+3 =", sum);

  const mul = await remote.mul(4, 5);
  console.log("4*5 =", mul);

  const echo = await remote.echo("Hola mundo!");
  console.log("Echo:", echo);
})();
