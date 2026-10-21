import assert from "node:assert/strict";
import test from "node:test";
import { signStoryMediaUrls } from "./story-media.ts";

const asset = "storage://story-media/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333.webp";
const secondAsset = "storage://story-media/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/44444444-4444-4444-4444-444444444444.webp";

test("batch media signing makes one storage request and preserves safe references", async () => {
  const calls: string[][] = [];
  const supabase = {
    storage: {
      from() {
        return {
          async createSignedUrls(paths: string[]) {
            calls.push(paths);
            return { data: paths.map((path) => ({ path, signedUrl: `https://cdn.example/${path}` })), error: null };
          },
        };
      },
    },
  };

  const urls = await signStoryMediaUrls(supabase as never, [asset, asset, secondAsset, "https://example.com/cover.webp", "unsafe://media"]);

  assert.deepEqual(calls, [[asset.replace("storage://story-media/", ""), secondAsset.replace("storage://story-media/", "")]]);
  assert.equal(urls.get(asset), `https://cdn.example/${asset.replace("storage://story-media/", "")}`);
  assert.equal(urls.get("https://example.com/cover.webp"), "https://example.com/cover.webp");
  assert.equal(urls.get("unsafe://media"), null);
});
