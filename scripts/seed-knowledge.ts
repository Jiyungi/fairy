/**
 * Seed knowledge_chunks in Supabase from reference-data/*.md
 *
 * Usage:
 *   npm run seed:knowledge
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Run migration 0002_rag_knowledge_chunks.sql in Supabase SQL editor first.
 */

import { createClient } from "@supabase/supabase-js";

import { chunkMarkdownFile, loadReferenceCorpus } from "../lib/rag/chunk-markdown";
import { embedText } from "../lib/rag/embed";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const chunks = loadReferenceCorpus();
  console.log(`Embedding and upserting ${chunks.length} chunks...`);

  let ok = 0;
  for (const chunk of chunks) {
    const embedding = await embedText(`${chunk.section}\n${chunk.content}`);
    const { error } = await client.from("knowledge_chunks").upsert(
      {
        source_file: chunk.sourceFile,
        section: chunk.section,
        content: chunk.content,
        topic: chunk.topic,
        embedding,
      },
      { onConflict: "source_file,section" },
    );
    if (error) {
      console.error(`Failed ${chunk.sourceFile} § ${chunk.section}:`, error.message);
      continue;
    }
    ok += 1;
  }

  console.log(`Done. Upserted ${ok}/${chunks.length} chunks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
