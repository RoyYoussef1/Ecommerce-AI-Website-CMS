import fetch from 'node-fetch';

type EmbedResponse = {
  model: string;
  embeddings: number[][];
};

function extractText(description: any): string {
  if (!Array.isArray(description)) return '';
  return description
    .flatMap((block) =>
      Array.isArray(block.children)
        ? block.children.map((child: any) => child.text || '')
        : []
    )
    .filter(Boolean)
    .join(' ');
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch('http://localhost:11434/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
  });

  const raw = await res.text();
  strapi.log.info(`[embed] status ${res.status} — payload: ${raw}`);

  if (!res.ok) {
    throw new Error(`Embedding API error: ${raw}`);
  }

  const json = JSON.parse(raw) as EmbedResponse;
  if (
    !Array.isArray(json.embeddings) ||
    json.embeddings.length === 0 ||
    !Array.isArray(json.embeddings[0])
  ) {
    throw new Error(`Invalid embeddings response: ${raw}`);
  }

  return json.embeddings[0];
}

export default {
  async beforeCreate(event: any) {
    const data = event.params.data;
    const title = data.title ?? '';
    const descText = extractText(data.description);
    const textToEmbed = `${title} ${descText}`.trim();

    try {
      data.embedding = await embedText(textToEmbed);
      strapi.log.info('[lifecycle] embedding created for:', textToEmbed);
    } catch (err) {
      strapi.log.error('[lifecycle] embedding error:', err);
    }
  },

  async beforeUpdate(event: any) {
    const data = event.params.data;
    if (data.title || data.description) {
      const title = data.title ?? '';
      const descText = extractText(data.description);
      const textToEmbed = `${title} ${descText}`.trim();

      try {
        data.embedding = await embedText(textToEmbed);
        strapi.log.info('[lifecycle] embedding updated for:', textToEmbed);
      } catch (err) {
        strapi.log.error('[lifecycle] embedding error:', err);
      }
    }
  },
};
