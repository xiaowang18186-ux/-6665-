import request from "supertest";
import { createApp } from "../server/app";
import { MemoryRiskStore } from "../server/risk/store";

export const FP_A = "a".repeat(64);
export const FP_B = "b".repeat(64);

export function setup(now = () => Date.now()) {
  const store = new MemoryRiskStore(now);
  const app = createApp(store);
  const session = async (fp: string, ip = "1.1.1.1") => {
    const r = await request(app).post("/api/session/init").set("device-fingerprint", fp).set("x-forwarded-for", ip);
    return r.body.data.token as string;
  };
  const gen = (fp: string, token: string, body: object, path = "/api/miniapp") =>
    request(app).post(path).set("device-fingerprint", fp).set("x-session-token", token).send(body);
  return { store, app, session, gen };
}

export const miniBody = (i: number) => ({ type: "booking", budget: "lt5k", requirement: `需求描述第 ${i} 版，预约功能` });
