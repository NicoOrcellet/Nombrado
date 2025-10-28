import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

// Tipo de dato que representa una entrada en el sistema de nombres
// Un servicio está definido por su host, puerto y opcionalmente una interfaz (lista de métodos)
type Entry = { host: string; port: number; iface?: string[] };

// Base de datos local de nombres (un simple objeto en memoria)
// La clave es un string (ej: "org.example.calc")
// El valor es un array de entradas [{host, port, iface}, ...]
const namingDb: Record<string, Entry[]> = {};

// Configuración del puerto donde corre este servidor de nombres
// Primero intenta leer de variables de entorno (PORT), si no usa 5000 por defecto
const PORT = Number(process.argv[2]) || process.env.PORT || 5000;

// Lista de otros servidores de nombres conocidos
// Así logramos un sistema jerárquico/distribuido de resolución
// En un sistema real, esto debería venir de un archivo de configuración o servicio de descubrimiento
const otherNamingServers = [
  "http://127.0.0.1:6000",
  "http://127.0.0.1:7000"
];

// Inicializamos la aplicación Express
const app = express();
app.use(bodyParser.json()); // Habilitamos lectura de JSON en las peticiones
  
/* 
  ============================
  ENDPOINT: REGISTRO DE SERVICIO
  ============================
  Un servicio se registra en este naming server enviando una petición POST a /register
  Ejemplo:
  POST /register
  {
    "name": "org.example.calc",
    "host": "127.0.0.1",
    "port": 4000,
    "iface": ["add","mul"]
  }
*/
app.post("/register", (req, res) => {
  const { name, host, port, iface } = req.body;

  // Validamos que vengan los campos obligatorios
  if (!name || !host || !port) {
    return res.status(400).json({ error: "falta name/host/port" });
  }

  // Si ese nombre aún no existe en la DB, lo inicializamos
  if (!namingDb[name]) namingDb[name] = [];

  // Agregamos la nueva entrada al array de ese nombre
  namingDb[name].push({ host, port, iface });

  console.log(`[NamingServer:${PORT}] Registrado: ${name} -> ${host}:${port}`);

  res.json({ status: "ok" });
});

/* 
  ============================
  ENDPOINT: LOOKUP
  ============================
  GET /lookup/:name
  Busca un servicio dado su nombre.
  1) Primero revisa la base de datos local
  2) Si no lo encuentra, consulta a los otros naming servers configurados
*/
app.get("/lookup/:name", async (req, res) => {
  const { name } = req.params;

  // Paso 1: búsqueda local
  const entries = namingDb[name];
  if (entries) {
    return res.json({ entries });
  }

  // Paso 2: búsqueda en otros servidores
  for (const server of otherNamingServers) {
    try {
      const r = await fetch(`${server}/lookup/${encodeURIComponent(name)}`);
      if (r.ok) {
        const json = await r.json();
        if (json.entries && json.entries.length > 0) {
          console.log(`[NamingServer:${PORT}] Redirigido a ${server} para ${name}`);
          return res.json(json);
        }
      }
    } catch (e) {
      console.error(`[NamingServer:${PORT}] Error consultando a ${server}:`, e);
    }
  }

  // Paso 3: si nadie lo tiene, devolvemos lista vacía
  res.json({ entries: [] });
});

/* 
  ============================
  ENDPOINT: RESOLVE
  ============================
  Es prácticamente igual que lookup, pero lo dejamos separado
  para simular una API alternativa (en algunos sistemas se diferencia lookup/resolve).
*/
app.get("/resolve/:name", async (req, res) => {
  const { name } = req.params;

  const entries = namingDb[name];
  if (entries) {
    return res.json({ entries });
  }

  for (const server of otherNamingServers) {
    try {
      const r = await fetch(`${server}/resolve/${encodeURIComponent(name)}`);
      if (r.ok) {
        const json = await r.json();
        if (json.entries && json.entries.length > 0) {
          console.log(`[NamingServer:${PORT}] Redirigido a ${server} para ${name}`);
          return res.json(json);
        }
      }
    } catch (e) {
      console.error(`[NamingServer:${PORT}] Error consultando a ${server}:`, e);
    }
  }

  res.json({ entries: [] });
});

// Finalmente, levantamos el servidor en el puerto configurado
app.listen(PORT, () => {
  console.log(`Naming server escuchando en puerto ${PORT}`);
});
