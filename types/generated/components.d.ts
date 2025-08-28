import type { Schema, Struct } from '@strapi/strapi';

export interface VariantVariant extends Struct.ComponentSchema {
  collectionName: 'components_variant_variants';
  info: {
    displayName: 'Variant';
    icon: 'grid';
  };
  attributes: {
    name: Schema.Attribute.String & Schema.Attribute.Required;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'variant.variant': VariantVariant;
    }
  }
}
