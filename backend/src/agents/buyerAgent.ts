import { v4 as uuidv4 } from 'uuid';
import { Groq } from 'groq-sdk';
import { env } from '../config/env';
import { AgentTools } from './tools';
import { Cart, CartItem, Order, PolicyEvaluationResult, Product } from '../models/domain';
import { CartOrderService } from '../services/cartOrderService';
import { CatalogService } from '../services/catalogService';
import { AuditService } from '../services/auditService';
import { PaymentService } from '../services/paymentService';
import { RecommendationEngine, UpsellSuggestion } from '../services/recommendationEngine';
import { PolicyEngine, DEFAULT_BUYER_ID } from '../services/policyEngine';
import { formatPaise } from '../utils/format';

export type AgentState =
  | 'IDLE'
  | 'UNDERSTAND_INTENT'
  | 'SEARCH_CATALOG'
  | 'EVALUATE_PRODUCTS'
  | 'RECOMMEND'
  | 'BUILD_CART'
  | 'MODIFY_CART'
  | 'CALCULATE_TOTAL'
  | 'CHECK_POLICY'
  | 'REQUEST_CONFIRMATION'
  | 'CREATE_ORDER'
  | 'REQUEST_PAYMENT'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'COMPLETE';

export interface AgentContext {
  conversation_id: string;
  agent_id: string;
  state: AgentState;
  user_intent?: string;
  search_results: Product[];
  selected_product?: Product;
  upsell_suggestion?: UpsellSuggestion;
  cart?: Cart;
  order?: Order;
  policy_result?: PolicyEvaluationResult;
  payment_options?: any;
  negotiated_discount?: {
    accepted: boolean;
    discount_percentage: number;
    discount_paise: number;
    bundle_name: string;
    rationale: string;
    offer_code: string;
  };
  error?: string;
}

export interface ExtractedIntent {
  intent: 'SEARCH' | 'ADD_TO_CART' | 'REMOVE_FROM_CART' | 'MODIFY_CART' | 'CLEAR_CART' | 'CHECK_POLICY' | 'CHECKOUT' | 'GREETING' | 'UNKNOWN';
  query: string;
  targetItem?: string;
  targetQuantity?: number;
  maxBudgetPaise?: number;
}

export async function extractSearchIntent(userMessage: string): Promise<ExtractedIntent> {
  const cleanMsg = userMessage.trim();
  const lower = cleanMsg.toLowerCase();

  // Pure greeting check - return welcome intent immediately
  if (/^(hi|hello|hey|greetings|help|howdy|good morning|good afternoon|good evening)[!.,\s]*$/i.test(cleanMsg)) {
    return {
      intent: 'GREETING',
      query: '',
      maxBudgetPaise: undefined,
    };
  }

  // 1. Fast Rule-Based Regex Extraction (Reliable baseline & offline fallback)
  let ruleBudgetPaise: number | undefined = undefined;
  const budgetMatch =
    cleanMsg.match(/(?:under|below|less than|budget(?: of)?|max|up to|within)\s*(?:₹|inr|rs\.?)?\s*([\d,]+)/i) ||
    cleanMsg.match(/(?:₹|inr|rs\.?)\s*([\d,]+)/i) ||
    cleanMsg.match(/([\d,]+)\s*(?:₹|inr|rs|rupees)/i);

  if (budgetMatch) {
    const rawVal = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
    if (rawVal > 0 && rawVal < 1000000) {
      ruleBudgetPaise = rawVal * 100;
    }
  }

  // Remove budget phrase to isolate product keyword tokens
  let ruleQuery = lower
    .replace(/(?:under|below|less than|budget(?: of)?|max|up to|within)\s*(?:₹|inr|rs\.?)?\s*[\d,]+/gi, '')
    .replace(/(?:₹|inr|rs\.?)\s*[\d,]+/gi, '')
    .replace(/[\d,]+\s*(?:₹|inr|rs|rupees)/gi, '')
    .replace(/\b(can you|could you|please|i need|i want|looking for|search for|find me|show me|find|search|show|get me|buy me|buy|what do you have|do you have|give me|any)\b/gi, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let ruleIntent: ExtractedIntent['intent'] = 'SEARCH';
  let targetItem: string | undefined = undefined;
  let targetQuantity: number | undefined = undefined;

  if (/\b(clear\s+(the\s+|my\s+)?cart|empty\s+(the\s+|my\s+)?cart|delete\s+(the\s+|my\s+)?cart|reset\s+(the\s+|my\s+)?cart|remove\s+all(\s+items)?)\b/i.test(lower)) {
    ruleIntent = 'CLEAR_CART';
  } else if (
    /\b(check\s+policy|view\s+policy|show\s+policy|policy\s+rules?|spending\s+rules?|spending\s+limits?|policy\s+limits?|my\s+policy|guardrails?|budget\s+limit)\b/i.test(lower) ||
    lower === 'check policy rules' ||
    lower === 'policy rules'
  ) {
    ruleIntent = 'CHECK_POLICY';
  } else if (/\b(remove|delete|drop|take\s*out|discard)\b/i.test(lower)) {
    ruleIntent = 'REMOVE_FROM_CART';
    targetItem = lower
      .replace(/\b(remove|delete|drop|take\s*out|discard|from\s+(the\s+|my\s+)?cart|out\s+of\s+(the\s+|my\s+)?cart|please|can you|could you|the|my|item|product)\b/gi, '')
      .trim();
  } else if (
    /\b(change|update|set|make)\b.*?\b(quantity|qty)\b/i.test(lower) ||
    /\b(quantity|qty)\b.*?\b(to|is|=)\b/i.test(lower) ||
    /\b(make\s+it|set\s+to|change\s+to)\s+\d+/i.test(lower)
  ) {
    ruleIntent = 'MODIFY_CART';
    const qMatch = lower.match(/\b(\d+)\b/);
    if (qMatch) {
      targetQuantity = parseInt(qMatch[1], 10);
    }
    targetItem = lower
      .replace(/\b(change|update|set|make|quantity|qty|of|the|my|item|product|to|is|\d+|pairs?|in\s+(the\s+|my\s+)?cart)\b/gi, '')
      .trim();
  } else if (/^(modify\s+cart|edit\s+cart|change\s+cart|view\s+cart|show\s+cart|check\s+cart|my\s+cart)\b/i.test(lower)) {
    ruleIntent = 'MODIFY_CART';
  } else if (/^(hi|hello|hey|greetings|help|howdy)\b/i.test(lower) && ruleQuery.length === 0) {
    ruleIntent = 'GREETING';
  } else if (/^(checkout|proceed|pay|confirm order|place order)\b/i.test(lower)) {
    ruleIntent = 'CHECKOUT';
  } else if (/add to cart|add it|buy it|buy this/i.test(lower) || /^(yes,\s*add|yes\s*add)\b/i.test(lower)) {
    ruleIntent = 'ADD_TO_CART';
  }

  // 2. LLM Extraction via Groq if API key is provided
  const apiKey = env.BUYER_AGENT || env.BUYER_AGENT_API_KEY || process.env.BUYER_AGENT;
  if (apiKey && !env.MOCK_MODE && process.env.NODE_ENV !== 'test') {
    try {
      const groq = new Groq({ apiKey });
      const parsePromise = groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are an e-commerce buyer agent intent parser. Output strict JSON with keys: "intent" ("SEARCH"|"ADD_TO_CART"|"REMOVE_FROM_CART"|"MODIFY_CART"|"CLEAR_CART"|"CHECK_POLICY"|"CHECKOUT"|"GREETING"|"UNKNOWN"), "query" (search keywords or empty string), "target_item" (item keyword to remove or modify or empty string), "target_quantity" (number if quantity update specified, else null), and "max_budget_inr" (number if user specified a maximum budget or price limit, otherwise null). Example: {"intent": "CHECK_POLICY", "query": "", "target_item": null, "target_quantity": null, "max_budget_inr": null}.',
          },
          { role: 'user', content: cleanMsg },
        ],
        model: 'openai/gpt-oss-20b',
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
      const res = await Promise.race([parsePromise, timeoutPromise]);

      if (res && (res as any).choices?.[0]?.message?.content) {
        const parsed = JSON.parse((res as any).choices[0].message.content);
        return {
          intent: parsed.intent || ruleIntent,
          query: typeof parsed.query === 'string' && parsed.query.trim().length > 0 ? parsed.query.trim() : ruleQuery,
          targetItem: typeof parsed.target_item === 'string' && parsed.target_item.trim().length > 0 ? parsed.target_item.trim() : targetItem,
          targetQuantity: typeof parsed.target_quantity === 'number' ? parsed.target_quantity : targetQuantity,
          maxBudgetPaise:
            typeof parsed.max_budget_inr === 'number' && parsed.max_budget_inr > 0
              ? parsed.max_budget_inr * 100
              : ruleBudgetPaise,
        };
      }
    } catch {
      // Graceful fallback to rule parser if network or Groq fails
    }
  }

  return {
    intent: ruleIntent,
    query: ruleQuery,
    targetItem,
    targetQuantity,
    maxBudgetPaise: ruleBudgetPaise,
  };
}

export class BuyerAgent {
  private static sessions: Map<string, AgentContext> = new Map();

  public static getOrCreateContext(conversationId?: string, buyerId?: string): AgentContext {
    const id = conversationId || uuidv4();
    if (!this.sessions.has(id)) {
      const ctx: AgentContext = {
        conversation_id: id,
        agent_id: buyerId || DEFAULT_BUYER_ID,
        state: 'IDLE',
        search_results: [],
      };
      this.sessions.set(id, ctx);
    } else if (buyerId) {
      this.sessions.get(id)!.agent_id = buyerId;
    }
    return this.sessions.get(id)!;
  }

  public static async processMessage(
    userMessage: string,
    conversationId?: string,
    buyerId?: string
  ): Promise<{
    reply: string;
    context: AgentContext;
    action_type?: string;
    policy_verdict?: string;
    quick_replies?: string[];
  }> {
    const ctx = this.getOrCreateContext(conversationId, buyerId);
    const msg = userMessage.toLowerCase().trim();

    // Sync active cart from DB if not loaded in session
    if (!ctx.cart) {
      const activeCart = CartOrderService.getActiveCartForBuyer(ctx.agent_id);
      if (activeCart && activeCart.items.length > 0) {
        ctx.cart = activeCart;
      }
    }

    // 1. Audit Intent
    AuditService.recordEvent({
      conversation_id: ctx.conversation_id,
      actor: 'BUYER_AGENT',
      event_type: 'USER_INPUT',
      title: 'User Message Received',
      description: `User prompted: "${userMessage}"`,
      status: 'INFO',
    });

    // FLOW B: User accepts upsell
    if (
      (msg.includes('add') || msg.includes('yes') || (ctx.upsell_suggestion && msg.includes(ctx.upsell_suggestion.product.name.toLowerCase().split(' ')[0]))) &&
      ctx.upsell_suggestion &&
      ctx.cart &&
      ctx.state === 'BUILD_CART'
    ) {
      ctx.state = 'BUILD_CART';
      const updatedCart = await AgentTools.add_to_cart.execute(
        {
          cart_id: ctx.cart.id,
          product_id: ctx.upsell_suggestion.product.id,
          quantity: 1,
        },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );
      ctx.cart = updatedCart;

      // Negotiate bundle discount for multi-item cart
      const currentCart = ctx.cart!;
      const productIds = currentCart.items.map(i => i.product_id);
      const bundleNegotiation = await AgentTools.negotiate_offer.execute(
        {
          merchant_id: currentCart.merchant_id,
          product_ids: productIds,
        },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );

      if (bundleNegotiation.accepted && bundleNegotiation.discount_paise > 0) {
        ctx.negotiated_discount = bundleNegotiation;
        ctx.cart = CartOrderService.applyDiscount(currentCart.id, bundleNegotiation.discount_paise);
      }

      // Now evaluate policy
      return await this.evaluateCartPolicy(ctx, true);
    }

    // FLOW C: User declines upsell
    if (
      (msg.startsWith('no') || msg.includes('skip') || msg.includes('no thanks') || msg.includes('proceed to checkout') || msg.includes('just ')) &&
      ctx.cart &&
      ctx.selected_product &&
      ctx.state === 'BUILD_CART'
    ) {
      return await this.evaluateCartPolicy(ctx, false);
    }

    // FLOW A: User explicitly confirms payment / checkout (after policy evaluation or direct checkout request)
    const isExplicitPaymentConfirmation =
      !msg.startsWith('no') &&
      !msg.includes('no thanks') &&
      !msg.includes('skip') &&
      (msg === 'yes' ||
        msg === 'proceed' ||
        msg === 'pay' ||
        msg === 'checkout' ||
        msg === 'confirm' ||
        msg.includes('proceed with payment') ||
        msg.includes('proceed to payment') ||
        msg.includes('proceed to checkout') ||
        msg.includes('place order') ||
        msg.includes('confirm order') ||
        msg.includes('confirm payment') ||
        (msg.startsWith('yes') &&
          (ctx.state === 'REQUEST_CONFIRMATION' ||
            ctx.state === 'CHECK_POLICY' ||
            ctx.state === 'CALCULATE_TOTAL' ||
            ctx.state === 'CREATE_ORDER')));

    if (
      isExplicitPaymentConfirmation &&
      ctx.cart &&
      ctx.cart.items.length > 0 &&
      ctx.state !== 'SEARCH_CATALOG' &&
      ctx.state !== 'BUILD_CART'
    ) {
      return await this.handlePaymentExecution(ctx);
    }

    // 5. Extract dynamic user intent, query terms, and budget
    const extracted = await extractSearchIntent(userMessage);

    // FLOW: Cart Modification (Remove items, modify quantity, clear cart)
    const isCartModification =
      extracted.intent === 'CLEAR_CART' ||
      extracted.intent === 'REMOVE_FROM_CART' ||
      extracted.intent === 'MODIFY_CART' ||
      /\b(clear\s+cart|empty\s+cart|delete\s+cart|remove\s+cart|reset\s+cart)\b/i.test(msg) ||
      /\b(remove|delete|drop|discard|take\s*out)\b.*?\b(from\s+cart|cart|item|product|shoes|vest|bottle|socks|mix|gels?|shoes?|jacket)\b/i.test(msg) ||
      /^\b(remove|delete)\s+[a-z0-9]/i.test(msg) ||
      /\b(change|update|set|make)\b.*?\b(quantity|qty)\b/i.test(msg);

    if (isCartModification) {
      return await this.handleCartModification(ctx, userMessage, extracted);
    }

    // FLOW: Check Policy Rules & Spending Limits
    if (
      extracted.intent === 'CHECK_POLICY' ||
      /\b(check\s+policy|view\s+policy|show\s+policy|policy\s+rules?|spending\s+limits?|my\s+policy|spending\s+rules?)\b/i.test(msg) ||
      msg === 'check policy rules' ||
      msg === 'policy rules'
    ) {
      const policy = PolicyEngine.getPolicy(ctx.agent_id);
      const todaySpent = PolicyEngine.getTodaySpentPaise(ctx.agent_id);
      const remainingDaily = Math.max(0, policy.daily_spend_limit_paise - todaySpent);

      return {
        reply: `[POLICY RULES] **Your Autonomous Spending Policy Rules:**\n\n` +
          `• **Single Transaction Limit:** ${formatPaise(policy.max_transaction_paise)}\n` +
          `• **Daily Spending Budget:** ${formatPaise(policy.daily_spend_limit_paise)}\n` +
          `• **Today's Committed Spend:** ${formatPaise(todaySpent)}\n` +
          `• **Remaining Daily Budget:** ${formatPaise(remainingDaily)}\n` +
          `• **Human Confirmation Threshold:** > ${formatPaise(policy.require_confirmation_above_paise)}\n` +
          `• **Permitted Categories:** ${policy.allowed_categories.join(', ')}\n\n` +
          `*Transactions within limits are settled autonomously without manual approval. Transactions above the confirmation threshold require explicit confirmation.*`,
        context: ctx,
        action_type: 'VIEW_POLICY',
        quick_replies: ['Search running shoes', 'Find water bottle', 'View cart'],
      };
    }

    // FLOW: Greetings without search keywords
    if (extracted.intent === 'GREETING' && (!extracted.query || extracted.query.length === 0)) {
      return {
        reply: `[WELCOME] Welcome! I am your **Autonomous AI Buyer Agent**.\n\nTell me what you're looking for (e.g. *"hydration vest"*, *"running shoes under ₹5,000"*, *"bottle under 1900"*, *"socks"*, or *"electrolyte mix"*), and I will search the merchant's live catalog, negotiate price concessions, and manage autonomous checkout within your policy limits.`,
        context: ctx,
        quick_replies: ['Search running shoes', 'Find hydration vest', 'Show accessories', 'View electrolyte mix'],
      };
    }

    const isExplicitCartAction =
      msg.includes('add to cart') ||
      msg.includes('add it') ||
      msg.includes('buy it') ||
      (msg.startsWith('yes') && ctx.state === 'RECOMMEND') ||
      msg === 'add' ||
      msg === 'buy';

    // Check if user is searching or expressing budget constraints
    const isSearchOrBudget =
      !isExplicitCartAction &&
      (extracted.intent === 'SEARCH' ||
        extracted.maxBudgetPaise !== undefined ||
        /\b(need|find|search|show|looking for|want|under|below|less than|budget|within|max|₹)\b/i.test(userMessage));

    // FLOW D: User selects specific product or confirms adding to cart
    // MUST NOT trigger if user is asking for a new search or budget request (e.g. "I need a bottle under 1900")
    if (
      !isSearchOrBudget &&
      ctx.search_results.length > 0 &&
      (isExplicitCartAction ||
        msg.includes('first option') ||
        msg.includes('option 1') ||
        msg.includes('option 2') ||
        msg.includes('second') ||
        msg.includes('option 3') ||
        msg.includes('third') ||
        msg.startsWith('select ') ||
        msg.startsWith('choose ') ||
        msg.startsWith('pick '))
    ) {
      let product: Product | undefined;
      if (msg.includes('option 2') || msg.includes('second') || msg.includes('2nd')) {
        product = ctx.search_results[1] || ctx.search_results[0];
      } else if (msg.includes('option 3') || msg.includes('third') || msg.includes('3rd')) {
        product = ctx.search_results[2] || ctx.search_results[0];
      } else {
        product =
          ctx.search_results.find(p => {
            const parts = p.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            return parts.some(w => msg.includes(w));
          }) ||
          ctx.selected_product ||
          ctx.search_results[0];
      }

      if (product) {
        return await this.selectAndAddProduct(ctx, product);
      }
    }

    // FLOW E: Dynamic Catalog Search & Autonomous Negotiation
    ctx.state = 'SEARCH_CATALOG';
    ctx.user_intent = userMessage;
    ctx.negotiated_discount = undefined;
    ctx.upsell_suggestion = undefined;

    // If previous transaction completed, clear cart for new shopping request
    if (ctx.order?.status === 'PAID') {
      ctx.cart = undefined;
      ctx.order = undefined;
    }

    const maxBudget = extracted.maxBudgetPaise;
    // Proactive Negotiation Discovery Buffer:
    // Search catalog up to 25% above stated budget so the buyer agent can discover
    // high-value items and aggressively negotiate price-match concessions to bring them down!
    const searchBufferBudget = maxBudget ? Math.round(maxBudget * 1.25) : undefined;

    const products: Product[] = await AgentTools.search_products.execute(
      { query: extracted.query, max_price_paise: searchBufferBudget },
      { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
    );

    ctx.search_results = products;
    ctx.state = 'RECOMMEND';

    if (products.length === 0) {
      const budgetText = maxBudget ? ` within your budget of ₹${(maxBudget / 100).toLocaleString()}` : '';
      const queryText = extracted.query ? ` for "${extracted.query}"` : '';
      return {
        reply: `I searched the merchant's catalog${queryText}${budgetText}, but didn't find matching items in stock. Would you like to try another keyword or browse other categories?`,
        context: ctx,
        quick_replies: ['Show all products', 'Search footwear', 'Search gear', 'Search accessories'],
      };
    }

    const topMatch = products[0];
    ctx.selected_product = topMatch;

    // Proactive Agent-to-Agent Negotiation:
    // The Buyer Agent acts as an aggressive bargainer trying to bring the merchant AI down as much as possible,
    // without having access to the merchant's secret concession limits.
    let negotiationNote = '';
    let negotiationPayload: any = null;

    if (maxBudget && topMatch.price_paise > maxBudget) {
      // Bring down the price to meet or beat the user's budget ceiling
      negotiationPayload = {
        merchant_id: topMatch.merchant_id,
        product_ids: [topMatch.id],
        total_budget_paise: maxBudget,
      };
    } else if (!maxBudget) {
      // When no budget ceiling is specified, aggressively probe the merchant for an automated checkout discount
      negotiationPayload = {
        merchant_id: topMatch.merchant_id,
        product_ids: [topMatch.id],
        requested_discount_percent: 15,
      };
    }

    if (negotiationPayload) {
      const negotiation = await AgentTools.negotiate_offer.execute(
        negotiationPayload,
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );

      if (negotiation.accepted && negotiation.discount_paise > 0) {
        ctx.negotiated_discount = negotiation;
        const discountedPrice = topMatch.price_paise - negotiation.discount_paise;
        negotiationNote = `\n\n[NEGOTIATION] **Autonomous Merchant Negotiation:**\nThe **${topMatch.name}** is listed at ${formatPaise(topMatch.price_paise)}. Through automated machine-to-machine bargaining, I negotiated an instant **${negotiation.discount_percentage}% price-match concession (-${formatPaise(negotiation.discount_paise)})** with the merchant agent, bringing your final price down to **${formatPaise(discountedPrice)}**!`;
      } else if (negotiation.counter_offer && negotiation.discount_paise > 0) {
        // The merchant countered with its secret maximum floor!
        ctx.negotiated_discount = {
          accepted: true,
          discount_percentage: negotiation.discount_percentage,
          discount_paise: negotiation.discount_paise,
          bundle_name: negotiation.bundle_name,
          rationale: negotiation.rationale,
          offer_code: negotiation.offer_code,
        };
        const discountedPrice = topMatch.price_paise - negotiation.discount_paise;
        negotiationNote = `\n\n[NEGOTIATION] **Autonomous Merchant Negotiation (Floor Counter-Offer):**\nI bargained aggressively with the merchant agent and extracted their maximum allowable automated concession of **${negotiation.discount_percentage}% (-${formatPaise(negotiation.discount_paise)})**, bringing your price from ${formatPaise(topMatch.price_paise)} down to **${formatPaise(discountedPrice)}**!`;
      }
    }

    // Dynamic decision & options summary
    const optionsText = products
      .slice(0, 4)
      .map((p, idx) => {
        const isAbove = maxBudget && p.price_paise > maxBudget;
        const tag =
          ctx.negotiated_discount?.accepted && p.id === topMatch.id
            ? ` *(Negotiated to ${formatPaise(topMatch.price_paise - (ctx.negotiated_discount?.discount_paise || 0))})*`
            : isAbove
            ? ' *(Eligible for agent negotiation)*'
            : '';
        return `${idx + 1}. **${p.name}** (${p.category}) — ${formatPaise(p.price_paise)}${tag}`;
      })
      .join('\n');

    let recommendationReason = '';
    if (ctx.negotiated_discount?.accepted) {
      recommendationReason = `I negotiated down the **${topMatch.name}** to ${formatPaise(topMatch.price_paise - ctx.negotiated_discount.discount_paise)} to get you the maximum possible savings.`;
    } else if (maxBudget) {
      recommendationReason = `I recommend the **${topMatch.name}** (${formatPaise(topMatch.price_paise)}) because it has the highest relevance score and satisfies your budget limit.`;
    } else {
      recommendationReason = `I recommend the **${topMatch.name}** (${formatPaise(topMatch.price_paise)}) as the top match for "${extracted.query || 'your search'}".`;
    }

    const reply = `I found **${products.length} matching option${products.length > 1 ? 's' : ''}** in the merchant's catalog:\n\n${optionsText}${negotiationNote}\n\n**Recommendation:**\n${recommendationReason}\n\nWould you like me to add it to your cart?`;

    const quick_replies = [
      'Yes, add to cart',
      ...(products.length > 1 ? [`View ${products[1].name.split(' ').slice(0, 3).join(' ')}`] : []),
      'Search another item',
    ];

    return {
      reply,
      context: ctx,
      action_type: 'RECOMMEND_PRODUCT',
      quick_replies,
    };
  }

  private static async selectAndAddProduct(ctx: AgentContext, product: Product) {
    ctx.selected_product = product;
    ctx.state = 'BUILD_CART';

    // 1. Create cart if not exists
    if (!ctx.cart) {
      ctx.cart = await AgentTools.create_cart.execute(
        { buyer_id: ctx.agent_id, merchant_id: product.merchant_id },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );
    }

    // 2. Add product to cart
    ctx.cart = await AgentTools.add_to_cart.execute(
      {
        cart_id: ctx.cart!.id,
        product_id: product.id,
        quantity: 1,
      },
      { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
    );

    // 3. Apply negotiated discount if present
    if (ctx.negotiated_discount && ctx.negotiated_discount.discount_paise > 0 && ctx.cart) {
      ctx.cart = CartOrderService.applyDiscount(ctx.cart.id, ctx.negotiated_discount.discount_paise);
    }

    // 4. Check for intelligent upsells/cross-sells (Growth Engine)
    const upsells = RecommendationEngine.getRecommendationsForProduct(product.id);
    if (upsells.length > 0) {
      const topUpsell = upsells[0];
      ctx.upsell_suggestion = topUpsell;

      const currentCart = ctx.cart!;
      const priceSummary = currentCart.discount_paise > 0
        ? `${formatPaise(currentCart.total_paise)} (after ${formatPaise(currentCart.discount_paise)} negotiated concession)`
        : formatPaise(product.price_paise);

      const upsellShortName = topUpsell.product.name.split(' ').slice(0, 3).join(' ');
      return {
        reply: `I've added **${product.name}** (${priceSummary}) to your cart.\n\n[UPSELL] **Smart Add-On Suggestion:**\n${topUpsell.pitch_message}\n\nWould you like to add them?`,
        context: ctx,
        action_type: 'UPSELL_PROPOSAL',
        quick_replies: [`Yes, add ${upsellShortName} (${formatPaise(topUpsell.product.price_paise)})`, 'No, proceed to checkout'],
      };
    }

    return await this.evaluateCartPolicy(ctx, false);
  }

  private static async handleCartModification(
    ctx: AgentContext,
    userMessage: string,
    extracted: ExtractedIntent
  ): Promise<{
    reply: string;
    context: AgentContext;
    action_type?: string;
    policy_verdict?: string;
    quick_replies?: string[];
  }> {
    if (!ctx.cart) {
      const activeCart = CartOrderService.getActiveCartForBuyer(ctx.agent_id);
      if (activeCart) {
        ctx.cart = activeCart;
      }
    }

    if (!ctx.cart || ctx.cart.items.length === 0) {
      return {
        reply: 'Your shopping cart is currently empty, so there are no items to remove or modify.',
        context: ctx,
        quick_replies: ['Search running shoes', 'Find hydration vest', 'Browse catalog'],
      };
    }

    const lowerMsg = userMessage.toLowerCase().trim();

    // 1. CLEAR CART
    if (
      extracted.intent === 'CLEAR_CART' ||
      /\b(clear|empty|delete|reset)\b.*?\bcart\b/i.test(lowerMsg) ||
      /\bremove all\b/i.test(lowerMsg)
    ) {
      const clearedCart = await AgentTools.clear_cart.execute(
        { cart_id: ctx.cart.id },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );
      ctx.cart = clearedCart;
      ctx.state = 'IDLE';
      ctx.negotiated_discount = undefined;
      ctx.upsell_suggestion = undefined;

      return {
        reply: `[CART CLEARED] **Your cart has been cleared.** All items have been removed.\n\nWhat would you like to search for next?`,
        context: ctx,
        action_type: 'CLEAR_CART',
        quick_replies: ['Search running shoes', 'Find hydration vest', 'Browse catalog'],
      };
    }

    // 2. MODIFY QUANTITY
    if (extracted.targetQuantity !== undefined || (extracted.intent === 'MODIFY_CART' && /\b(\d+)\b/.test(lowerMsg))) {
      let qty = extracted.targetQuantity;
      if (qty === undefined) {
        const match = lowerMsg.match(/\b(\d+)\b/);
        if (match) qty = parseInt(match[1], 10);
      }

      if (qty !== undefined) {
        let matchedItem: CartItem | undefined;
        const target = (extracted.targetItem || '').toLowerCase().trim();

        if (ctx.cart.items.length === 1) {
          matchedItem = ctx.cart.items[0];
        } else if (target) {
          matchedItem = ctx.cart.items.find(
            i =>
              i.product_id.toLowerCase() === target ||
              i.product_name.toLowerCase().includes(target) ||
              target.includes(i.product_name.toLowerCase()) ||
              i.product_name.toLowerCase().split(/\s+/).some(w => w.length > 2 && target.includes(w))
          );
        } else if (/\b(first|1st|item 1)\b/i.test(lowerMsg)) {
          matchedItem = ctx.cart.items[0];
        } else if (/\b(second|2nd|item 2)\b/i.test(lowerMsg)) {
          matchedItem = ctx.cart.items[1];
        } else if (/\b(third|3rd|item 3)\b/i.test(lowerMsg)) {
          matchedItem = ctx.cart.items[2];
        }

        if (!matchedItem && ctx.cart.items.length > 0) {
          matchedItem = ctx.cart.items[0];
        }

        if (!matchedItem) {
          return {
            reply: `I couldn't determine which item you want to update. Your cart has:\n${ctx.cart.items.map(i => `• ${i.product_name} (Qty: ${i.quantity})`).join('\n')}`,
            context: ctx,
          };
        }

        const updatedCart = await AgentTools.update_cart_quantity.execute(
          {
            cart_id: ctx.cart.id,
            product_id: matchedItem.product_id,
            product_name: matchedItem.product_name,
            quantity: qty,
          },
          { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
        );
        ctx.cart = updatedCart;

        if (qty <= 0 && updatedCart.items.length === 0) {
          ctx.state = 'IDLE';
          ctx.negotiated_discount = undefined;
          return {
            reply: `[ITEM REMOVED] Removed **${matchedItem.product_name}** from your cart. Your cart is now empty.`,
            context: ctx,
            action_type: 'REMOVE_FROM_CART',
            quick_replies: ['Search running shoes', 'Find hydration vest', 'Browse catalog'],
          };
        }

        ctx.state = 'MODIFY_CART';
        const prefix = `[QUANTITY UPDATED] Updated quantity of **${matchedItem.product_name}** to **${qty}**.\n\n`;
        return await this.evaluateCartPolicy(ctx, false, prefix);
      }
    }

    // 3. REMOVE ITEM FROM CART
    if (extracted.intent === 'REMOVE_FROM_CART' || /\b(remove|delete|drop|discard|take out)\b/i.test(lowerMsg)) {
      let matchedItem: CartItem | undefined;
      const target = (extracted.targetItem || '').toLowerCase().trim();

      if (ctx.cart.items.length === 1 && (!target || target === 'it' || target === 'the item' || target === 'product' || target === 'this')) {
        matchedItem = ctx.cart.items[0];
      } else if (/\b(first|1st|item 1)\b/i.test(lowerMsg)) {
        matchedItem = ctx.cart.items[0];
      } else if (/\b(second|2nd|item 2)\b/i.test(lowerMsg)) {
        matchedItem = ctx.cart.items[1];
      } else if (/\b(third|3rd|item 3)\b/i.test(lowerMsg)) {
        matchedItem = ctx.cart.items[2];
      } else if (/\b(last|last item)\b/i.test(lowerMsg)) {
        matchedItem = ctx.cart.items[ctx.cart.items.length - 1];
      } else if (target) {
        matchedItem = ctx.cart.items.find(
          i =>
            i.product_id.toLowerCase() === target ||
            i.product_name.toLowerCase().includes(target) ||
            target.includes(i.product_name.toLowerCase()) ||
            i.product_name.toLowerCase().split(/\s+/).some(w => w.length > 2 && target.includes(w))
        );
      }

      if (!matchedItem) {
        const itemNames = ctx.cart.items.map(i => `• **${i.product_name}** (${formatPaise(i.unit_price_paise)})`).join('\n');
        return {
          reply: `I couldn't tell which item you want to remove. Your cart currently contains:\n\n${itemNames}\n\nPlease specify which product you would like to remove.`,
          context: ctx,
          quick_replies: ctx.cart.items.map(i => `Remove ${i.product_name.split(' ').slice(0, 3).join(' ')}`),
        };
      }

      const updatedCart = await AgentTools.remove_from_cart.execute(
        {
          cart_id: ctx.cart.id,
          product_id: matchedItem.product_id,
          product_name: matchedItem.product_name,
        },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );
      ctx.cart = updatedCart;

      if (updatedCart.items.length === 0) {
        ctx.state = 'IDLE';
        ctx.negotiated_discount = undefined;
        ctx.upsell_suggestion = undefined;
        return {
          reply: `[ITEM REMOVED] Removed **${matchedItem.product_name}** from your cart. Your cart is now empty.`,
          context: ctx,
          action_type: 'REMOVE_FROM_CART',
          quick_replies: ['Search running shoes', 'Find hydration vest', 'Browse catalog'],
        };
      }

      ctx.state = 'MODIFY_CART';
      const prefix = `[ITEM REMOVED] Removed **${matchedItem.product_name}** from your cart.\n\n`;
      return await this.evaluateCartPolicy(ctx, false, prefix);
    }

    // 4. GENERIC VIEW / MODIFY CART INQUIRY
    const itemsList = ctx.cart.items.map(i => `• **${i.product_name}** x${i.quantity} — ${formatPaise(i.subtotal_paise)}`).join('\n');
    const discountText = ctx.cart.discount_paise > 0 ? `\n- Concession discount: -${formatPaise(ctx.cart.discount_paise)}` : '';
    return {
      reply: `[CART SUMMARY] **Current Shopping Cart:**\n\n${itemsList}${discountText}\n\n**Total:** ${formatPaise(ctx.cart.total_paise)}\n\nYou can prompt me to *"remove [item]"*, *"change quantity of [item] to [N]"*, *"clear cart"*, or *"proceed to checkout"*.`,
      context: ctx,
      action_type: 'VIEW_CART',
      quick_replies: ['Proceed to checkout', 'Clear cart', ...ctx.cart.items.map(i => `Remove ${i.product_name.split(' ').slice(0, 3).join(' ')}`)],
    };
  }

  private static async evaluateCartPolicy(ctx: AgentContext, includedUpsell: boolean, prefixMessage?: string) {
    if (!ctx.cart) throw new Error('Cart not initialized');

    const cartCategories = Array.from(
      new Set(
        ctx.cart.items
          .map(item => {
            const product = CatalogService.getProductById(item.product_id);
            return product?.category;
          })
          .filter((c): c is string => Boolean(c))
      )
    );

    ctx.state = 'CHECK_POLICY';
    const policyResult: PolicyEvaluationResult = await AgentTools.check_policy.execute(
      {
        amount_paise: ctx.cart.total_paise,
        categories: cartCategories.length > 0 ? cartCategories : undefined,
        buyer_id: ctx.agent_id,
      },
      { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
    );

    ctx.policy_result = policyResult;

    const totalStr = formatPaise(ctx.cart.total_paise);
    const discountInfo = ctx.cart.discount_paise > 0
      ? ` (includes -${formatPaise(ctx.cart.discount_paise)} negotiated agent concession)`
      : '';
    let policyText = '';
    const prefix = prefixMessage || '';

    if (policyResult.verdict === 'ALLOW') {
      ctx.state = 'CALCULATE_TOTAL';
      policyText = `[ALLOWED] **Policy Status:** ALLOWED\nThis amount is within your autonomous spending limit of ${formatPaise(policyResult.max_allowed_paise)}.\n\nReady to proceed with payment?`;
    } else if (policyResult.verdict === 'REQUIRE_CONFIRMATION') {
      ctx.state = 'REQUEST_CONFIRMATION';
      policyText = `[REQUIRE CONFIRMATION] **Policy Status:** MANUAL CONFIRMATION REQUIRED\nTotal amount exceeds your autonomous threshold of ${formatPaise(policyResult.confirmation_threshold_paise)}.\n\nPlease explicitly confirm to proceed with payment.`;
    } else {
      ctx.state = 'COMPLETE';
      return {
        reply: `${prefix}[BLOCKED] **Transaction Blocked by Policy:**\n${policyResult.reason}`,
        context: ctx,
        policy_verdict: 'DENY',
        quick_replies: ['Modify cart', 'Check policy rules'],
      };
    }

    return {
      reply: `${prefix}Your cart total is **${totalStr}**${discountInfo} (${ctx.cart.items.length} item${ctx.cart.items.length > 1 ? 's' : ''}).\n\n${policyText}`,
      context: ctx,
      action_type: 'POLICY_EVALUATION',
      policy_verdict: policyResult.verdict,
      quick_replies: ['Yes, proceed with payment', 'View order summary', 'Cancel'],
    };
  }

  private static async handlePaymentExecution(ctx: AgentContext) {
    if (!ctx.cart || ctx.cart.items.length === 0) {
      return {
        reply: 'Your cart is currently empty. Please add items to your cart before proceeding to payment.',
        context: ctx,
        quick_replies: ['Search running shoes', 'Find hydration vest', 'Browse catalog'],
      };
    }

    const previousState = ctx.state;
    ctx.state = 'CREATE_ORDER';

    try {
      let policyTicket = (ctx.policy_result as any)?.ticket;
      if (!policyTicket && ctx.cart) {
        // User has explicitly confirmed payment during manual confirmation workflow!
        // Issue an authorized confirmation policy ticket for the approved amount.
        policyTicket = PolicyEngine.issuePolicyTicket({
          buyer_id: ctx.agent_id,
          amount_paise: ctx.cart.total_paise,
          verdict: 'ALLOW',
          cart_id: ctx.cart.id,
        });
        if (ctx.policy_result) {
          (ctx.policy_result as any).ticket = policyTicket;
        }
      }

      // 1. Create order with cryptographic policy ticket
      const order = await AgentTools.create_order.execute(
        {
          cart_id: ctx.cart.id,
          policy_ticket: policyTicket,
        },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );
      ctx.order = order;

      // 2. Request Payment via Razorpay
      ctx.state = 'REQUEST_PAYMENT';
      const paymentRes = await AgentTools.request_payment.execute(
        { order_id: order.id },
        { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
      );

      ctx.payment_options = paymentRes.razorpay_options;

      // Check if failure mode was triggered
      if (paymentRes.payment.status === 'FAILED') {
        ctx.state = 'PAYMENT_FAILED';
        return {
          reply: `[PAYMENT FAILED] **Payment Failed**\n\nNo duplicate charge was created.\n\n- **Order ID:** ${order.id.slice(0, 8)}\n- **Amount:** ${formatPaise(order.total_paise)}\n- **Reason:** ${paymentRes.payment.failure_reason || 'Payment provider rejected request.'}\n\n**Safe Recovery Options:**\nYou can retry the payment or select another payment method.`,
          context: ctx,
          action_type: 'PAYMENT_FAILED',
          quick_replies: ['Retry payment', 'Cancel order'],
        };
      }

      // Otherwise initiate capture / test settlement
      const settlement = await PaymentService.captureAndSettlePayment({
        orderId: order.id,
        razorpayOrderId: paymentRes.payment.razorpay_order_id,
        conversationId: ctx.conversation_id,
      });

      ctx.state = 'PAYMENT_CONFIRMED';
      ctx.order = CartOrderService.getOrder(order.id) || ctx.order;

      return {
        reply: `[SUCCESS] **Transaction Completed Successfully!**\n\n- **Amount Paid:** ${formatPaise(order.total_paise)}\n- **Order ID:** ${order.id}\n- **Payment ID:** ${settlement.payment.razorpay_payment_id}\n- **Status:** PAID & SETTLED ON LEDGER\n\nThe transaction has been cryptographically signed and linked to the tamper-evident audit ledger.`,
        context: ctx,
        action_type: 'PAYMENT_CONFIRMED',
        policy_verdict: 'ALLOW',
        quick_replies: ['View audit trail', 'Shop for more items'],
      };
    } catch (err: any) {
      ctx.state = previousState;
      return {
        reply: `[CHECKOUT ERROR] **Unable to Complete Checkout:**\n${err.message}\n\nPlease check your policy rules or modify your cart.`,
        context: ctx,
        action_type: 'PAYMENT_ERROR',
        quick_replies: ['Yes, proceed with payment', 'Check policy rules', 'Modify cart'],
      };
    }
  }
}
