// Importamos las librerías necesarias
import express from "express";       // Framework para levantar un servidor HTTP
import bodyParser from "body-parser"; // Para interpretar el cuerpo de las peticiones en JSON
import fetch from "node-fetch";      // Para hacer peticiones HTTP a los naming servers

// ===============================
// CONFIGURACIÓN DEL SERVICIO
// ===============================

// Puerto donde se ejecutará este servicio
const PORT = 6001;

// Nombre con el que este servicio se va a registrar en el sistema de nombres
const SERVICE_NAME = "org.example.calc";

// Lista de naming servers a los que este servicio se registrará
// (en un sistema real podrían ser configurables vía archivo o variables de entorno)
const NAMING_SERVERS = ["http://127.0.0.1:5000"];

// Inicializamos el servidor Express
const app = express();
app.use(bodyParser.json()); // Middleware para parsear JSON en requests

// ===============================
// DEFINICIÓN DE MÉTODOS DEL SERVICIO
// ===============================
// Este objeto contiene las funciones que queremos exponer de manera remota.
// Los clientes podrán invocarlas sin saber el host/puerto real del servicio.
const methods = {
  add: (a: number, b: number) => a + b,       // Suma
  mul: (a: number, b: number) => a * b,       // Multiplicación
  echo: (msg: string) => msg                  // Devuelve el mismo mensaje recibido
};

// ===============================
// ENDPOINT DE INVOCACIÓN
// ===============================
// Todos los métodos remotos se llaman a través de este único endpoint.
// El cliente manda { method: "nombreMetodo", args: [argumentos] }
// Ejemplo: { method: "add", args: [2,3] }
app.post("/invoke", (req, res) => {
  // Extraemos método y argumentos de la petición
  const { method, args } = req.body as { method: string; args: any[] };

  // Validamos que el método exista en nuestra lista de métodos
  if (!(method in methods)) {
    return res.status(400).json({ error: `Método ${method} no existe` });
  }

  // Obtenemos la función correspondiente
  const fn = methods[method as keyof typeof methods] as (...args: any[]) => any;

  // Ejecutamos la función con los argumentos recibidos
  const result = fn(...args);

  // Devolvemos el resultado al cliente
  res.json({ result });
});

// ===============================
// REGISTRO EN NAMING SERVERS
// ===============================
// Cuando este servicio arranca, se registra automáticamente en todos
// los naming servers configurados, informando su nombre, host, puerto
// y qué métodos soporta.
async function registerService() {
  for (const ns of NAMING_SERVERS) {
    try {
      await fetch(`${ns}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: SERVICE_NAME,         // nombre único del servicio
          host: "127.0.0.1",          // dirección del host
          port: PORT,                 // puerto en el que escucha
          iface: Object.keys(methods) // lista de métodos que expone
        })
      });
      console.log(`Servicio registrado en ${ns}`);
    } catch (e) {
      console.error(`Error registrando en ${ns}:`, e);
    }
  }
}

// ===============================
// ARRANQUE DEL SERVICIO
// ===============================
// Iniciamos el servidor en el puerto configurado y llamamos a registerService()
// para anunciarlo en el sistema de nombres.
app.listen(PORT, async () => {
  console.log(`Servicio ${SERVICE_NAME} escuchando en puerto ${PORT}`);
  await registerService();
});
