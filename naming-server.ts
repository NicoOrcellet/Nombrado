import express from "express";
import bodyParser from "body-parser";

/*
  Tipo que representa una entrada en el registro.
  - name: nombre jerárquico del servicio (ej: "org.dept.svc")
  - host, port: dónde está registrada la instancia
  - type: "RPC" o "RMI"
  - iface: Lista de métodos si es RMI
  - meta: Cualquier metadato extra
  - ttl: Tiempo de vida en segundos (lease). Si se pasa, el cliente debe renovar antes de que expire.
  - registeredAt: timestamp (ms) de cuando se registró.
*/
type Entry = {
  name: string; 
  host: string;
  port: number;
  type: "rpc" | "rmi";
  iface?: string[]; 
  meta?: any;
  ttl?: number; 
  registeredAt: number;
};

//Crear el servidor HTTP.
const app = express();

// Obliga a que el cuerpo de la request contenga el objeto JS
// parseado cuando Content-Type: application/json
app.use(bodyParser.json());

// Puerto donde corre el naming server
const PORT = 5000;


// Mapa de nombre -> lista de instancias
// Se usa una lista para soportar múltiples réplicas/instancias del mismo servicio.
const registry = new Map<string, Entry[]>();

/*
  Endpoint: POST /register
  Body esperado: { name, host, port, type, iface?, meta?, ttl? }
  Acción: agrega la entrada al registro, añadiendo registeredAt.
*/
app.post("/register", (req, res) => {
    // Se construye la entrada añadiendo registeredAt
    const e: Entry = { ...req.body, registeredAt: Date.now() };
    // Se valida el name, host y port, que son obligatorios
    if (!e.name || !e.host || !e.port) return res.status(400).send("missing fields");

    // Se recupera la lista actual (en caso de que exista) y se añade la nueva instancia
    const arr = registry.get(e.name) || [];
    arr.push(e);
    registry.set(e.name, arr);

    //Respuesta: ok :)
    res.json({ ok: true });
});

/*
  Endpoint: POST /unregister
  Body esperado: { name, host, port }
  Acción: elimina la instancia concreta del registro (si coinciden host y port).
*/
app.post("/unregister", (req, res) => {
  const { name, host, port } = req.body;
  if (!name) return res.status(400).send("missing name");

  // Filtramos la lista removiendo la instancia que coincide con host y port
  const arr = (registry.get(name) || []).filter(en => !(en.host === host && en.port === port));

  // Si quedaron instancias se actualiza, si no, se borra la clave
  if (arr.length) registry.set(name, arr); else registry.delete(name);
  res.json({ ok: true });
});

/*
  Endpoint: GET /lookup/:name
  Acción: búsqueda exacta del nombre. Devuelve las instancias activas de ese nombre.
  Aplica filtro TTL (si una entrada tiene ttl y expiró, se la excluye del resultado).
*/
app.get("/lookup/:name", (req, res) => {
  const name = req.params.name;
  const entries = registry.get(name) || [];

  // Filtrar expirados según ttl
  const now = Date.now();
  const filtered = entries.filter(e => !e.ttl || (now - e.registeredAt) < (e.ttl * 1000));

  res.json({ name, entries: filtered });
});

/*
  Endpoint: GET /resolve/:name
  Acción: búsqueda jerárquica. Si no existe coincidencia exacta para "a.b.c.d",
  intenta subir en el árbol: "a.b.c", "a.b", "a" y devuelve la primera coincidencia encontrada.
  Esto permite delegación / fallback por prefijo.
*/
app.get("/resolve/:name", (req, res) => {
  let name = req.params.name;
  const parts = name.split(".");

  // Se recorre desde el candidate más específico hasta el menos (subiendo en la jerarquía)
  for (let i = parts.length; i >= 1; i--) {
    const candidate = parts.slice(0, i).join(".");
    const entries = registry.get(candidate) || [];
    if (entries.length) {
      return res.json({ name: candidate, entries });
    }
  }

  // Si no se encontró nada, 404
  return res.status(404).json({ error: "not found" });
});

/*
  Endpoint: GET /list
  Acción: devuelve todo el contenido del registro (útil para debug / pruebas).
*/
app.get("/list", (req, res) => {
  const obj: any = {};
  for (const [k, v] of registry.entries()) obj[k] = v;
  res.json(obj);
});


// Se arranca el servidor
app.listen(PORT, () => console.log(`Naming server listening on ${PORT}`));
