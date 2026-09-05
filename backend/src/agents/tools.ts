import { CatalogService } from '../services/catalogService';
import { CartOrderService } from '../services/cartOrderService';
import { RecommendationEngine } from '../services/recommendationEngine';
import { PolicyEngine } from '../services/policyEngine';
import { PaymentService } from '../services/paymentService';
import { AuditService } from '../services/auditService';
import { MerchantService } from '../services/merchantService';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, context: { conversation_id: string; agent_id: string }) => Promise<any>;
}

export const AgentTools: Record<string, ToolDefinition> = {
  search_products: {
    name: 'search_products',
    description: 'Search the merchant catalog using semantic query, category, and maximum price in paise.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term e.g. "running shoes"' },
        category: { type: 'string', description: 'Category filter e.g. "footwear"' },
        max_price_paise: { type: 'number', description: 'Budget ceiling in paise (e.g. 500000 for ₹5,000)' },
      },
      required: ['query'],
    },
    execute: async (args, context) => {
      const results = CatalogService.search(args.query, {
        category: args.category,
        maxPricePaise: args.max_price_paise,
      });

      AuditService.recordAction({
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        action_type: 'SEARCH_CATALOG',
        summary: `Searched catalog for "${args.query}" (${results.length} products found)`,
        inputs: args,
        result: { count: results.length, top_match: results[0]?.name },
      });

      AuditService.recordEvent({
        conversation_id: context.conversation_id,
        actor: 'BUYER_AGENT',
        event_type: 'CATALOG_SEARCH',
        title: 'Catalog Search Executed',
        description: `Discovered ${results.length} products matching query "${args.query}".`,
        status: 'SUCCESS',
        metadata: { query: args.query, results_count: results.length },
      });

      // Information Asymmetry: Redact merchant confidential concession limits from buyer agent view
      const sanitized = results.map((p) => {
        const copy = { ...p };
        if (copy.policies) {
          copy.policies = {
            autonomous_checkout: copy.policies.autonomous_checkout,
            requires_reservation: copy.policies.requires_reservation,
          };
        }
        return copy;
      });

      return sanitized;
    },
  },

  get_product: {
    name: 'get_product',
    description: 'Get full product details including variants and specifications by product ID.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'UUID of the product' },
      },
      required: ['product_id'],
    },
    execute: async (args, context) => {
      let product = CatalogService.getProductById(args.product_id);
      if (product && product.policies) {
        product = {
          ...product,
          policies: {
            autonomous_checkout: product.policies.autonomous_checkout,
            requires_reservation: product.policies.requires_reservation,
          },
        };
      }

      AuditService.recordAction({
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        action_type: 'GET_PRODUCT',
        summary: `Retrieved details for product ${args.product_id}`,
        inputs: args,
        result: { found: !!product, name: product?.name },
      });

      return product;
    },
  },

  check_inventory: {
    name: 'check_inventory',
    description: 'Verify current stock availability for a product or specific variant.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        variant_id: { type: 'string' },
      },
      required: ['product_id'],
    },
    execute: async (args, context) => {
      const status = CatalogService.checkInventory(args.product_id, args.variant_id);
      AuditService.recordEvent({
        conversation_id: context.conversation_id,
        actor: 'MERCHANT_AGENT',
        event_type: 'INVENTORY_CHECK',
        title: 'Inventory Verified',
        description: `Product ${args.product_id} has ${status.totalStock} units available in stock.`,
        status: status.available ? 'SUCCESS' : 'WARNING',
        metadata: status,
      });
      return status;
    },
  },

  get_product_recommendations: {
    name: 'get_product_recommendations',
    description: 'Retrieve data-driven upsell and cross-sell suggestions for a product.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
      },
      required: ['product_id'],
    },
    execute: async (args) => {
      return RecommendationEngine.getRecommendationsForProduct(args.product_id);
    },
  },

  create_cart: {
    name: 'create_cart',
    description: 'Create an active shopping cart for the buyer agent.',
    parameters: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string' },
        merchant_id: { type: 'string' },
      },
    },
    execute: async (args) => {
      return CartOrderService.createCart(args.buyer_id, args.merchant_id);
    },
  },

  add_to_cart: {
    name: 'add_to_cart',
    description: 'Add a product and quantity to an active cart.',
    parameters: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        product_id: { type: 'string' },
        quantity: { type: 'number' },
        variant_id: { type: 'string' },
      },
      required: ['cart_id', 'product_id'],
    },
    execute: async (args, context) => {
      const cart = CartOrderService.addItem(args.cart_id, args.product_id, args.quantity || 1, args.variant_id);
      const product = CatalogService.getProductById(args.product_id);

      AuditService.recordAction({
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        action_type: 'ADD_TO_CART',
        summary: `Added ${product?.name || args.product_id} to cart (Total: ₹${(cart.total_paise / 100).toFixed(2)})`,
        inputs: args,
        result: { cart_id: cart.id, total_items: cart.items.length, total_paise: cart.total_paise },
      });

      AuditService.recordEvent({
        conversation_id: context.conversation_id,
        actor: 'BUYER_AGENT',
        event_type: 'CART_UPDATED',
        title: 'Product Added to Cart',
        description: `Added "${product?.name}" to Cart. Cart total is now ₹${(cart.total_paise / 100).toFixed(2)}.`,
        status: 'SUCCESS',
        metadata: { cart_id: cart.id, items: cart.items },
      });

      return cart;
    },
  },

  check_policy: {
    name: 'check_policy',
    description: 'Evaluate buyer spending policy for a proposed transaction amount and categories.',
    parameters: {
      type: 'object',
      properties: {
        amount_paise: { type: 'number' },
        categories: { type: 'array', items: { type: 'string' } },
        buyer_id: { type: 'string' },
      },
      required: ['amount_paise'],
    },
    execute: async (args, context) => {
      const evaluation = PolicyEngine.evaluateTransaction(args);

      AuditService.recordAction({
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        action_type: 'POLICY_CHECK',
        summary: `Policy check: ${evaluation.verdict} — ${evaluation.reason}`,
        inputs: args,
        result: evaluation,
        policy_verdict: evaluation.verdict,
      });

      AuditService.recordEvent({
        conversation_id: context.conversation_id,
        actor: 'POLICY_ENGINE',
        event_type: 'POLICY_EVALUATION',
        title: `Policy Verdict: ${evaluation.verdict}`,
        description: evaluation.reason,
        status: evaluation.verdict === 'ALLOW' ? 'SUCCESS' : evaluation.verdict === 'REQUIRE_CONFIRMATION' ? 'WARNING' : 'FAILURE',
        metadata: evaluation,
      });

      return evaluation;
    },
  },

  create_order: {
    name: 'create_order',
    description: 'Convert an active cart into a confirmed order ready for payment with verified policy ticket.',
    parameters: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        policy_ticket: { type: 'object', description: 'Cryptographically signed PolicyTicket from check_policy' },
      },
      required: ['cart_id'],
    },
    execute: async (args, context) => {
      const order = CartOrderService.createOrderFromCart(args.cart_id, args.policy_ticket);

      AuditService.recordAction({
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        action_type: 'CREATE_ORDER',
        summary: `Created order ${order.id.slice(0, 8)} for ₹${(order.total_paise / 100).toFixed(2)} with policy verification`,
        inputs: args,
        result: { order_id: order.id, total_paise: order.total_paise },
      });

      AuditService.recordEvent({
        conversation_id: context.conversation_id,
        actor: 'ORDER_SERVICE',
        event_type: 'ORDER_CREATED',
        title: 'Order Created & Policy Sealed',
        description: `Order ${order.id} generated from Cart ${args.cart_id} with total ₹${(order.total_paise / 100).toFixed(2)}.`,
        status: 'SUCCESS',
        metadata: { order_id: order.id, items: order.items, total_paise: order.total_paise },
      });

      return order;
    },
  },

  request_payment: {
    name: 'request_payment',
    description: 'Initialize a Razorpay Test Mode transaction for an order.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        force_failure: { type: 'boolean' },
      },
      required: ['order_id'],
    },
    execute: async (args, context) => {
      return PaymentService.createPaymentOrder(args.order_id, context.conversation_id, args.force_failure);
    },
  },

  negotiate_offer: {
    name: 'negotiate_offer',
    description: 'Negotiate price concessions, bundle discounts, or budget price-matching with the merchant commerce agent.',
    parameters: {
      type: 'object',
      properties: {
        merchant_id: { type: 'string' },
        product_ids: { type: 'array', items: { type: 'string' } },
        total_budget_paise: { type: 'number' },
        requested_discount_percent: { type: 'number' },
      },
      required: ['merchant_id', 'product_ids'],
    },
    execute: async (args, context) => {
      const negotiation = MerchantService.negotiateAgentOffer(args.merchant_id, {
        buyer_agent_id: context.agent_id,
        product_ids: args.product_ids,
        total_budget_paise: args.total_budget_paise,
        requested_discount_percent: args.requested_discount_percent,
        conversation_id: context.conversation_id,
      });

      AuditService.recordAction({
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        action_type: 'NEGOTIATE_OFFER',
        summary: negotiation.accepted
          ? `Negotiated concession: ${negotiation.bundle_name} (-₹${(negotiation.discount_paise / 100).toFixed(2)})`
          : 'Negotiation declined by merchant agent',
        inputs: args,
        result: negotiation,
      });

      AuditService.recordEvent({
        conversation_id: context.conversation_id,
        actor: 'MERCHANT_AGENT',
        event_type: 'AGENT_NEGOTIATION',
        title: negotiation.accepted ? 'Price Concession Approved' : 'Standard Pricing Maintained',
        description: negotiation.rationale,
        status: negotiation.accepted ? 'SUCCESS' : 'INFO',
        metadata: negotiation,
      });

      return negotiation;
    },
  },
};
