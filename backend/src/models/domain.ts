import { z } from 'zod';

export const MoneySchema = z.number().int().nonnegative(); // Amount in paise (1 INR = 100 paise)

export const MerchantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  currency: z.string().default('INR'),
  description: z.string().optional(),
  support_email: z.string().email().optional(),
  capabilities: z.array(z.string()),
  created_at: z.string(),
});

export type Merchant = z.infer<typeof MerchantSchema>;

export const ProductVariantSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  sku: z.string(),
  name: z.string(),
  price_paise: MoneySchema,
  stock_quantity: z.number().int().nonnegative(),
  attributes: z.record(z.string(), z.string()).optional(),
});

export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductPolicySchema = z.object({
  max_concession_percent: z.number().min(0).max(50).default(15).optional(),
  autonomous_checkout: z.boolean().default(true).optional(),
  requires_reservation: z.boolean().default(false).optional(),
});

export type ProductPolicy = z.infer<typeof ProductPolicySchema>;

export const ProductSchema = z.object({
  id: z.string(),
  merchant_id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  price_paise: MoneySchema,
  image_url: z.string().optional(),
  variants: z.array(ProductVariantSchema).default([]),
  policies: ProductPolicySchema.optional(),
  created_at: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CartItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  product_name: z.string(),
  unit_price_paise: MoneySchema,
  quantity: z.number().int().positive(),
  subtotal_paise: MoneySchema,
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  id: z.string().uuid(),
  buyer_id: z.string(),
  merchant_id: z.string().uuid(),
  status: z.enum(['ACTIVE', 'CHECKED_OUT', 'ABANDONED']),
  items: z.array(CartItemSchema),
  subtotal_paise: MoneySchema,
  discount_paise: MoneySchema.default(0),
  total_paise: MoneySchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type Cart = z.infer<typeof CartSchema>;

export const OrderStatusEnum = z.enum([
  'PENDING_PAYMENT',
  'PAYMENT_AUTHORIZED',
  'PAID',
  'PAYMENT_FAILED',
  'CANCELLED',
  'REFUNDED'
]);

export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  cart_id: z.string().uuid(),
  buyer_id: z.string(),
  merchant_id: z.string().uuid(),
  status: OrderStatusEnum,
  items: z.array(CartItemSchema),
  total_paise: MoneySchema,
  currency: z.string().default('INR'),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

export const PaymentStatusEnum = z.enum([
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'REFUNDED'
]);

export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  amount_paise: MoneySchema,
  currency: z.string().default('INR'),
  status: PaymentStatusEnum,
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
  failure_reason: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const PolicySchema = z.object({
  id: z.string().uuid(),
  buyer_id: z.string(),
  max_transaction_paise: MoneySchema,
  daily_spend_limit_paise: MoneySchema,
  require_confirmation_above_paise: MoneySchema,
  allowed_categories: z.array(z.string()),
  created_at: z.string(),
});

export type Policy = z.infer<typeof PolicySchema>;

export const PolicyVerdictEnum = z.enum(['ALLOW', 'DENY', 'REQUIRE_CONFIRMATION']);
export type PolicyVerdict = z.infer<typeof PolicyVerdictEnum>;

export const PolicyEvaluationResultSchema = z.object({
  verdict: PolicyVerdictEnum,
  reason: z.string(),
  policy_id: z.string().optional(),
  evaluated_amount_paise: MoneySchema,
  max_allowed_paise: MoneySchema,
  confirmation_threshold_paise: MoneySchema,
});

export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;

export const AgentActionSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string(),
  agent_id: z.string(),
  action_type: z.string(),
  summary: z.string(),
  inputs: z.record(z.string(), z.any()),
  result: z.record(z.string(), z.any()),
  policy_verdict: PolicyVerdictEnum.optional(),
  timestamp: z.string(),
});

export type AgentAction = z.infer<typeof AgentActionSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  conversation_id: z.string(),
  actor: z.string(),
  event_type: z.string(),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  status: z.enum(['SUCCESS', 'WARNING', 'FAILURE', 'INFO']),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string(),
  event_type: z.string(),
  payload: z.record(z.string(), z.any()),
  processed: z.boolean(),
  created_at: z.string(),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  source_product_id: z.string().uuid(),
  recommended_product_id: z.string().uuid(),
  type: z.enum(['UPSELL', 'CROSS_SELL', 'FREQUENTLY_BOUGHT_TOGETHER']),
  rationale: z.string(),
  relevance_score: z.number(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

export const MerchantManifestSchema = z.object({
  merchant_id: z.string(),
  merchant_name: z.string(),
  capabilities: z.array(z.string()),
  supported_currencies: z.array(z.string()),
  policy_constraints: z.record(z.string(), z.any()),
  endpoints: z.object({
    catalog_search: z.string(),
    product_get: z.string(),
    inventory_check: z.string(),
    negotiate_offer: z.string().optional(),
    cart_create: z.string(),
    checkout_create: z.string(),
    payment_request: z.string(),
  }),
  protocol_version: z.string(),
});

export type MerchantManifest = z.infer<typeof MerchantManifestSchema>;

export const PolicyTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  buyer_id: z.string(),
  amount_paise: MoneySchema,
  cart_id: z.string().uuid().optional(),
  verdict: PolicyVerdictEnum,
  issued_at: z.string(),
  expires_at: z.string(),
  signature: z.string(),
});

export type PolicyTicket = z.infer<typeof PolicyTicketSchema>;
