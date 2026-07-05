/**
 * conversation controller
 *
 * Ownership is enforced here at the data layer: no caller can read or create
 * conversations on behalf of another user, regardless of query params sent.
 * Non-owned records return 404 (not 403) so their existence isn't revealed.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::conversation.conversation',
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const { title } = (ctx.request.body?.data ?? {}) as { title?: unknown };

      const conversation = await strapi
        .documents('api::conversation.conversation')
        .create({
          data: {
            title: typeof title === 'string' && title.trim() ? title : 'New chat',
            // Always the authenticated user — any client-sent value is ignored
            user: user.documentId ?? user.id,
          },
          status: 'published',
        });

      return { data: conversation };
    },

    async find(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      // The content API rejects client queries referencing the user relation,
      // so the ownership filter is applied through the documents service
      // (server-side, not client-forgeable) after sanitizing the client query.
      const sanitizedQuery = (await this.sanitizeQuery(ctx)) as Record<string, any>;

      const results = await strapi
        .documents('api::conversation.conversation')
        .findMany({
          ...sanitizedQuery,
          filters: {
            $and: [
              sanitizedQuery.filters ?? {},
              { user: { id: { $eq: user.id } } },
            ],
          },
        });

      const sanitized = await this.sanitizeOutput(results, ctx);
      return this.transformResponse(sanitized);
    },

    async findOne(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const conversation = await strapi
        .documents('api::conversation.conversation')
        .findOne({
          documentId: ctx.params.id,
          populate: { user: { fields: ['id'] } },
        });

      if (!conversation || (conversation as any).user?.id !== user.id) {
        return ctx.notFound();
      }

      return super.findOne(ctx);
    },
  })
);
