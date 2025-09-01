import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::product.product",
  ({ strapi }) => ({
    async create(ctx) {
      const { data } = ctx.request.body;

      try {
        const textToEmbed = data.title + " " + data.short_desc || "" ;
        const embedding = await embedText(textToEmbed);
        console.log("📦 Generated embedding:", embedding);
        data.embedding = embedding;
      } catch (error) {
        strapi.log.error("❌ Failed to generate embedding on create:", error);
        ctx.throw(500, "Embedding generation failed");
      }

      const response = await super.create(ctx);
      return response;
    },

    async update(ctx) {
      const { data } = ctx.request.body;

      try {
        const textToEmbed = data.title + " " + data.short_desc || "";
        const embedding = await embedText(textToEmbed);
        console.log("📦 Generated embedding:", embedding);
        data.embedding = embedding;
      } catch (error) {
        strapi.log.error("❌ Failed to generate embedding on update:", error);
        ctx.throw(500, "Embedding generation failed");
      }

      const response = await super.update(ctx);
      return response;
    },

    async findOne(ctx) {
      const { id } = ctx.params;

      const product = await strapi.db.query("api::product.product").findOne({
        where: { id },
        populate: { variants: true, mainImage: true, galleryImages: true },
      });

      return { ...product };
    },

    async find(ctx) {
      const { filters } = ctx.query;
      const pagination = ctx.query?.pagination;

      const entities = await strapi.db.query("api::product.product").findMany({
        where: {
          publishedAt: { $notNull: true },
          ...(typeof filters === "object" && filters !== null ? filters : {}),
        },
        populate: {
          variants: true,
          mainImage: true,
          galleryImages: true,
        },
        ...(pagination &&
        typeof pagination === "object" &&
        "pageSize" in pagination &&
        "page" in pagination
          ? {
              limit: (pagination as any).pageSize,
              offset:
                ((pagination as any).page - 1) * (pagination as any).pageSize,
            }
          : {}),
      });

      return entities;
    },
  })
);

type EmbeddingResponse = {
  embedding: number[];
};

async function embedText(text: string): Promise<number[]> {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error: ${res.statusText}`);
  }

  const data = (await res.json()) as EmbeddingResponse;

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Invalid embedding structure from API");
  }

  return data.embedding;
}
