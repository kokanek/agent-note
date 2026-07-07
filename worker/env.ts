export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  API_KEY: string;
}

export type Bindings = { Bindings: Env };
