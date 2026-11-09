// ============================================================================
// Product details a customer reads before buying:
//   specs     — [{ label, value }]   e.g. Brand: Reinzosil, Material: Rubber, Warranty: 6 months
//   variants  — [{ size, color, stockQuantity }]  e.g. Saizi 42 / Nyeusi / 3 left
// Shared by the seller portal (writes) and the order code (label text).
// ============================================================================
const { z } = require('zod');

const MAX_SPECS = 20;
const MAX_VARIANTS = 40;

const specSchema = z.object({
  label: z.string().trim().min(1, 'Andika jina la maelezo').max(40, 'Jina la maelezo ni refu mno'),
  value: z.string().trim().min(1, 'Andika thamani').max(200, 'Maelezo ni marefu mno'),
});
const specsSchema = z.array(specSchema).max(MAX_SPECS, `Maelezo yasizidi ${MAX_SPECS}`);

const variantSchema = z.object({
  size: z.string().trim().max(20, 'Saizi ni ndefu mno').optional().default(''),
  color: z.string().trim().max(30, 'Jina la rangi ni refu mno').optional().default(''),
  stockQuantity: z.number({ invalid_type_error: 'Weka idadi kwa namba' }).int('Idadi iwe namba kamili').min(0, 'Idadi haiwezi kuwa hasi').max(100000, 'Idadi ni kubwa mno'),
}).refine((v) => v.size || v.color, { message: 'Kila mstari uwe na saizi au rangi' });
const variantsSchema = z.array(variantSchema).max(MAX_VARIANTS, `Chaguo zisizidi ${MAX_VARIANTS}`).superRefine((list, ctx) => {
  const seen = new Set();
  list.forEach((v, i) => {
    const key = variantKey(v);
    if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [i], message: 'Saizi na rangi hii imeandikwa mara mbili' });
    seen.add(key);
  });
});

const variantKey = (v) => `${v.size.toLowerCase()}|${v.color.toLowerCase()}`;

/** "Saizi 42 · Nyeusi" — how a chosen option is written in carts, orders and messages. */
function variantLabel(v) {
  return [v.size && `Saizi ${v.size}`, v.color].filter(Boolean).join(' · ');
}

/**
 * Makes the product's variants match `list` (inside a transaction). Existing options keep their id when the
 * same size + colour is still listed, so carts and past orders keep pointing at the right one.
 * Returns the total stock of all options.
 */
async function syncVariants(tx, productId, list) {
  const existing = await tx.productVariant.findMany({ where: { productId }, select: { id: true, size: true, color: true } });
  const byKey = new Map(existing.map((e) => [variantKey(e), e]));
  const keep = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const v = list[i];
    const found = byKey.get(variantKey(v));
    if (found) {
      keep.add(found.id);
      await tx.productVariant.update({ where: { id: found.id }, data: { size: v.size, color: v.color, stockQuantity: v.stockQuantity, position: i } });
    } else {
      await tx.productVariant.create({ data: { productId, size: v.size, color: v.color, stockQuantity: v.stockQuantity, position: i } });
    }
  }
  const drop = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (drop.length) await tx.productVariant.deleteMany({ where: { id: { in: drop } } });
  return list.reduce((sum, v) => sum + v.stockQuantity, 0);
}

module.exports = { specsSchema, variantsSchema, variantLabel, syncVariants, MAX_SPECS, MAX_VARIANTS };
