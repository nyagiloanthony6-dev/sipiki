// ============================================================================
// Zod schemas — the single source of truth for what the API accepts.
// Mirrors the validation rules in the registration wizard (sipiki-register.jsx);
// the server never trusts that the browser enforced them.
// ============================================================================
const { z } = require('zod');
const { normalizePhone } = require('../utils/phone');

const BUSINESS_TYPES = ['Mtu Binafsi', 'Kampuni (Ltd)', 'Ushirika / Kikundi'];
const CATEGORIES = ['Mavazi', 'Simu na Vifaa', 'Viatu', 'Urembo', 'Mikoba na Vifaa'];
const PAYOUT_PROVIDERS = ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'HaloPesa'];
const REGIONS = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma', 'Kilimanjaro',
  'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pemba Kaskazini',
  'Pemba Kusini', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
  'Tanga', 'Unguja Kaskazini', 'Unguja Kusini', 'Unguja Mjini Magharibi',
];

// A phone field that is validated AND transformed to the canonical 255XXXXXXXXX form
const phone = z
  .string()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Namba ya simu si sahihi' });
    return n;
  });

// TIN: 9 digits, stored formatted as 123-456-789
const tin = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((d) => d.length === 9, 'TIN ina tarakimu 9')
  .transform((d) => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`);

// NIDA: 20 digits
const nida = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((d) => d.length === 20, 'Namba ya NIDA ina tarakimu 20');

// Password policy: length matters more than composition rules
const password = z
  .string()
  .min(8, 'Nenosiri liwe na herufi angalau 8')
  .max(72, 'Nenosiri ni refu kupita kiasi'); // bcrypt ignores everything after 72 bytes

const vendorRegistrationSchema = z.object({
  // --- Business
  businessName: z.string().trim().min(3).max(120),
  businessType: z.enum(BUSINESS_TYPES),
  region: z.enum(REGIONS),
  location: z.string().trim().min(3).max(200),
  // multipart sends arrays as JSON strings; the controller parses before validating
  categories: z.array(z.enum(CATEGORIES)).min(1).max(CATEGORIES.length),
  description: z.string().trim().max(1000).optional().default(''),
  // --- Owner
  ownerName: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, 'Andika majina kamili'),
  phone,
  email: z.string().trim().toLowerCase().email().max(255),
  nida,
  tin,
  password,
  // --- Payout (Mobile Money)
  payoutProvider: z.enum(PAYOUT_PROVIDERS),
  payoutPhone: phone,
  payoutName: z.string().trim().min(3).max(120),
  // --- Terms
  terms: z.literal(true, { errorMap: () => ({ message: 'Lazima ukubali masharti' }) }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

const customerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  password,
});

// Reason is required when rejecting or suspending — the vendor is told why via SMS
const reasonSchema = z.object({
  reason: z.string().trim().min(5, 'Eleza sababu kwa ufupi').max(300),
});

module.exports = { vendorRegistrationSchema, loginSchema, customerRegistrationSchema, reasonSchema };
