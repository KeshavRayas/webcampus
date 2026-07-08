import { APIRequestContext, Browser } from "@playwright/test";
import { resolveApiBaseUrl } from "./config";

export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  private get baseUrl(): string {
    return resolveApiBaseUrl();
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request.get(`${this.baseUrl}${path}`);
    const body = await res.json();
    if (!res.ok())
      throw new Error(
        `GET ${path} failed: ${res.status()} ${JSON.stringify(body)}`
      );
    return body as T;
  }

  async post<T>(path: string, data?: Record<string, unknown>): Promise<T> {
    const res = await this.request.post(`${this.baseUrl}${path}`, { data });
    const body = await res.json();
    if (!res.ok())
      throw new Error(
        `POST ${path} failed: ${res.status()} ${JSON.stringify(body)}`
      );
    return body as T;
  }

  async put<T>(path: string, data?: Record<string, unknown>): Promise<T> {
    const res = await this.request.put(`${this.baseUrl}${path}`, { data });
    const body = await res.json();
    if (!res.ok())
      throw new Error(
        `PUT ${path} failed: ${res.status()} ${JSON.stringify(body)}`
      );
    return body as T;
  }

  async patch<T>(path: string, data?: Record<string, unknown>): Promise<T> {
    const res = await this.request.patch(`${this.baseUrl}${path}`, { data });
    const body = await res.json();
    if (!res.ok())
      throw new Error(
        `PATCH ${path} failed: ${res.status()} ${JSON.stringify(body)}`
      );
    return body as T;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await this.request.delete(`${this.baseUrl}${path}`);
    const body = await res.json();
    if (!res.ok())
      throw new Error(
        `DELETE ${path} failed: ${res.status()} ${JSON.stringify(body)}`
      );
    return body as T;
  }
}

export async function createApiForRole(
  browser: Browser,
  role: string
): Promise<ApiHelper> {
  const ctx = await browser.newContext({ storageState: `.auth/${role}.json` });
  const page = await ctx.newPage();
  return new ApiHelper(page.request);
}
