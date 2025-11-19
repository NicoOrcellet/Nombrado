import axios from "axios";
import { Registration } from "./types";

/** Cliente de ejemplo que registra algunos nombres y prueba resoluciones */

async function register(serverUrl: string, reg: Registration) {
  try {
    const resp = await axios.post(`${serverUrl}/register`, reg);
    console.log(`POST ${serverUrl}/register ->`, resp.data);
  } catch (e) {
    console.error("Register error", (e as Error).message);
  }
}

async function resolve(serverUrl: string, name: string) {
  try {
    const resp = await axios.get(`${serverUrl}/resolve`, { params: { name } });
    console.log(`RESOLVE ${name} ->`, resp.data);
  } catch (e) {
    console.error("Resolve error", (e as Error).message);
  }
}

(async () => {
  // Registrar en ns2 (la hoja)
  await register("http://localhost:3002", {
    name: "/org/service/db",
    resource: "10.0.0.5:5432",
    type: "service",
  });
  await register("http://localhost:3001", {
    name: "/org/service/cache",
    resource: "10.0.0.6:6379",
    type: "service",
  });

  // Intentos de resolución (siempre al root para simular cliente final)
  await resolve("http://localhost:3000", "/org/service/db");
  await resolve("http://localhost:3000", "/org/service/cache");
  await resolve("http://localhost:3000", "/org/service/missing");
})();
