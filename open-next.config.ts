import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Enable R2/KV-backed incremental cache here if needed, e.g.:
  // incrementalCache: r2IncrementalCache,
});
