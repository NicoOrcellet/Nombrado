import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import { Registration, ResolveResult } from "./types";

/**
 * NameServer: gestiona un espacio de nombres local y puede delegar consultas
 * a servidores subordinados (children). Se ofrece una API HTTP simple:
 * - POST /register { name, resource, type }
 * - GET /resolve?name=/a/b/c
 * - GET /info
 */
export class NameServer {
  private app = express();
  private registrations = new Map<string, Registration>();
  private children: string[] = [];
  private port: number;
  private id: string;

  constructor(id: string, port: number, children: string[] = []) {
    this.id = id;
    this.port = port;
    this.children = children; // lista de URLs (http://host:port)
    this.app.use(bodyParser.json());

    this.app.post("/register", (req, res) => {
      const r: Registration = req.body;
      if (!r.name || !r.resource)
        return res.status(400).json({ error: "name and resource required" });
      this.registrations.set(r.name, r);
      console.log(`[${this.id}] Registered ${r.name} -> ${r.resource}`);
      return res.json({ ok: true });
    });

    this.app.get("/resolve", async (req, res) => {
      const name = String(req.query.name || "");
      if (!name) return res.status(400).json({ error: "name query required" });

      const result = await this.resolve(name);
      return res.json(result);
    });

    this.app.get("/info", (req, res) => {
      return res.json({
        id: this.id,
        port: this.port,
        children: this.children,
        ownNames: Array.from(this.registrations.keys()),
      });
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`[${this.id}] NameServer listening on port ${this.port}`);
    });
  }

  /**
   * Intento simple de resolución:
   */
  async resolve(name: string): Promise<ResolveResult> {
    // Exact match
    if (this.registrations.has(name)) {
      const reg = this.registrations.get(name)!;
      return { found: true, resource: reg.resource, via: this.id };
    }

    // Try children recursively
    for (const child of this.children) {
      try {
        const url = `${child}/resolve?name=${encodeURIComponent(name)}`;
        const resp = await axios.get(url, { timeout: 2000 });
        const r = resp.data as ResolveResult;
        if (r && r.found) {
          return { ...r, via: this.id };
        }
      } catch (e) {
        // child unavailable - ignore
        console.log(`[${this.id}] child ${child} unreachable or error`);
      }
    }

    // Not found
    return { found: false };
  }
}
