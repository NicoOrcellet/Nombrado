import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

// Nombre del servicio que se registrará en el naming-server
const SERVICE_NAME = "org.example.calc";

// Dirección donde este servicio corre
const HOST = "127.0.0.1";
const PORT = 6001;

// Dirección del naming-server
const NAMING = "http://127.0.0.1:5000";

//Crear el servidor HTTP.
const app = express();

// Obliga a que el cuerpo de la request contenga el objeto JS
// parseado cuando Content-Type: application/json
app.use(bodyParser.json());


// Implementación de métodos del servicio
// Estos son los métodos disponibles para RMI
const impl = {
  // Método que suma dos números
  add: (a: number, b: number) => a + b,

  // Método que multiplica dos números
  mul: (a: number, b: number) => a * b,

  // Método que devuelve un mensaje "echo"
  echo: (msg: string) => `echo:${msg}`,
};



// Endpoint RMI: /invoke
// Este endpoint recibe:
// { method: "add", args: [2,3] }
// y devuelve { result: 5 }
app.post("/invoke", async (req, res) => {
  const { method, args } = req.body;

  // Se valida la request
  if (!method || !Array.isArray(args)) return res.status(400).send("bad request");

  // Se comprueba si existe el metodo, y en caso de que si, se lo llama
  const fn = (impl as any)[method];
  if (!fn) return res.status(404).send("no such method");

  try {
    const result = fn(...args);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Endpoint RPC: /call
// Permite invocar un procedimiento por nombre (forma procedural)
app.post("/call", (req, res) => {
  const { proc, args } = req.body;
  if (!proc) return res.status(400).send("missing proc");

  // Mapear nombre de procedimiento a función interna
  if (proc === "calc.add") {
    return res.json({ result: impl.add(args[0], args[1]) });
  }

  // Si no se reconoce el procedimiento
  return res.status(404).send("proc not found");
});

// Inicialización del servidor
app.listen(PORT, async () => {
  console.log(`Service ${SERVICE_NAME} listening on ${PORT}`);
  
  // Registro automático en el naming-server
  // Cada servicio al arrancar se registra para que los clientes lo puedan encontrar
  await fetch(`${NAMING}/register`, {
    method: "POST",
    body: JSON.stringify({
      name: SERVICE_NAME, // nombre jerárquico del servicio
      host: HOST,         // IP o hostname donde corre
      port: PORT,         // puerto donde escucha
      type: "rmi",        // tipo de servicio (podría ser RPC o RMI)
      iface: ["add", "mul", "echo"], // lista de métodos disponibles
      ttl: 600             // tiempo de vida en segundos
    }),
    headers: { "Content-Type": "application/json" }
  });
  console.log("Registered with naming server");
});
