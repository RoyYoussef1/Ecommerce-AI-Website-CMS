/**
 * message controller
 *
 * Ownership is enforced through the parent conversation's user relation.
 * Non-owned records return 404 (not 403) so their existence isn't revealed.
 */

import { factories } from '@strapi/strapi';

async function findOwnedConversation(
  strapi: any,
  documentId: unknown,
  userId: number
) {
  if (!documentId || typeof documentId !== 'string') return null;

  const conversation = await strapi
    .documents('api::conversation.conversation')
    .findOne({
      documentId,
      populate: { user: { fields: ['id'] } },
    });

  if (!conversation || conversation.user?.id !== userId) return null;
  return conversation;
}

export default factories.createCoreController(
  'api::message.message',
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const {
        role,
        content,
        products,
        conversation: conversationId,
      } = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

      if (role !== 'user' && role !== 'assistant') {
        return ctx.badRequest('role must be "user" or "assistant"');
      }
      if (typeof content !== 'string') {
        return ctx.badRequest('content must be a string');
      }

      const conversation = await findOwnedConversation(
        strapi,
        conversationId,
        user.id
      );
      if (!conversation) return ctx.notFound();

      const message = await strapi.documents('api::message.message').create({
        data: {
          role,
          content,
          products: (products ?? null) as any,
          conversation: conversationId as string,
        },
        status: 'published',
      });

      // Touch the parent conversation so its updatedAt reflects last activity
      // (used for newest-first sorting in the sidebar)
      await strapi.documents('api::conversation.conversation').update({
        documentId: conversationId as string,
        data: { title: conversation.title },
        status: 'published',
      });

      return { data: message };
    },

    async find(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      // Query validation rejects a nested conversation.user filter, so resolve
      // the user's conversation ids first, then filter messages by those.
      // Both filters are applied server-side and cannot be forged by clients.
      const owned = await strapi
        .documents('api::conversation.conversation')
        .findMany({
          filters: { user: { id: { $eq: user.id } } },
          fields: ['id'],
        });
      const ownedIds = owned.map((c: any) => c.documentId);

      if (ownedIds.length === 0) {
        return this.transformResponse([]);
      }

      const sanitizedQuery = (await this.sanitizeQuery(ctx)) as Record<string, any>;

      const results = await strapi.documents('api::message.message').findMany({
        ...sanitizedQuery,
        filters: {
          $and: [
            sanitizedQuery.filters ?? {},
            { conversation: { documentId: { $in: ownedIds } } },
          ],
        },
      });

      const sanitized = await this.sanitizeOutput(results, ctx);
      return this.transformResponse(sanitized);
    },

    async findOne(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const message = await strapi.documents('api::message.message').findOne({
        documentId: ctx.params.id,
        populate: { conversation: { populate: { user: { fields: ['id'] } } } },
      });

      if (!message || (message as any).conversation?.user?.id !== user.id) {
        return ctx.notFound();
      }

      return super.findOne(ctx);
    },
  })
);
