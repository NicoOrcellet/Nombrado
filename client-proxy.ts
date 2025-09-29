import fetch from "node-fetch";

// Tipo que representa una entrada en el Naming Server
// Cada entrada describe un servicio con host, puerto y (opcional) su interfaz
type Entry = { host: string; port: number; iface?: string[]; };

// Cliente para conectarse al Naming Server
// Permite buscar (lookup) y resolver (resolve) servicios por nombre
class NamingClient {
  public namingBase: string;

  // Constructor: recibe la URL base del naming server
  constructor(namingBase = "http://127.0.0.1:5000") {
    this.namingBase = namingBase;
  }

  // Busca un servicio por nombre en el naming server
  // Devuelve un array con las entradas registradas
  async lookup(name: string): Promise<Entry[]> {
    const r = await fetch(`${this.namingBase}/lookup/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error(`lookup failed: ${r.status}`);
    const json = await r.json();
    return json.entries; // ⚠️ importante: el array está dentro de "entries"
  }

  // Similar a lookup, pero puede devolver múltiples instancias vivas
  async resolve(name: string): Promise<Entry[]> {
    const r = await fetch(`${this.namingBase}/resolve/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error(`resolve failed: ${r.status}`);
    const json = await r.json();
    return json.entries; // también está dentro de "entries"
  }
}

// Construye un proxy dinámico para invocar métodos remotos
function buildProxy(entry: Entry) {
  const base = `http://${entry.host}:${entry.port}`; // host+puerto del servicio

  // Handler del Proxy: intercepta llamadas a propiedades
  const handler: ProxyHandler<any> = {
    get(_, prop: string) {
      // Cada propiedad accedida se interpreta como un método remoto
      return async (...args: any[]) => {
        // Llamada HTTP POST al endpoint /invoke del servicio
        const res = await fetch(`${base}/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: prop, args })
        });

        const json = await res.json();

        if (!res.ok) throw new Error(json.error || "invoke error");

        return json.result; // resultado del método remoto
      };
    }
  };

  return new Proxy({}, handler); // devolvemos el proxy "mágico"
}

// Ejemplo de uso del cliente
(async () => {
  const nc = new NamingClient(); // cliente hacia el naming server

  // 1) Buscamos el servicio "org.example.calc"
  const entries = await nc.lookup("org.example.calc");

  if (entries.length === 0) throw new Error("no service"); // no hay servicio registrado

  const entry = entries[0]; // tomamos la primera entrada

  // 2) Construimos el proxy dinámico
  const remote = buildProxy(entry);

  // 3) Usamos el proxy como si fuera un objeto local
  const sum = await remote.add(2, 3);
  console.log("2+3 =", sum);

  const m = await remote.mul(4, 5);
  console.log("4*5 =", m);
})();
