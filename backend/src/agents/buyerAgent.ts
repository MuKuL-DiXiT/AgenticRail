import { v4 as uuidv4 } from 'uuid';
import { Groq } from 'groq-sdk';
import { env } from '../config/env';
import { AgentTools } from './tools';
import { Cart, Order, PolicyEvaluationResult, Product } from '../models/domain';
import { CartOrderService } from '../services/cartOrderService';
import { AuditService } from '../services/auditService';
import { PaymentService } from '../services/paymentService';
import { RecommendationEngine, UpsellSuggestion } from '../services/recommendationEngine';
import { PolicyEngine, DEFAULT_BUYER_ID } from '../services/policyEngine';

export type AgentState =
  | 'IDLE'
  | 'UNDERSTAND_INTENT'
  | 'SEARCH_CATALOG'
  | 'EVALUATE_PRODUCTS'
  | 'RECOMMEND'
  | 'BUILD_CART'
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
  intent: 'SEARCH' | 'ADD_TO_CART' | 'CHECKOUT' | 'GREETING' | 'UNKNOWN';
  query: string;
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
  if (/^(hi|hello|hey|greetings|help|howdy)\b/i.test(lower) && ruleQuery.length === 0) {
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
              'You are an e-commerce buyer agent intent parser. Output strict JSON with keys: "intent" ("SEARCH"|"ADD_TO_CART"|"CHECKOUT"|"GREETING"|"UNKNOWN"), "query" (search keywords of products/items such as "salomon flask", "hydration vest", "running shoes", "socks" or empty string), and "max_budget_inr" (number if user specified a maximum budget or price limit, otherwise null). Example: {"intent": "SEARCH", "query": "salomon flask", "max_budget_inr": null}.',
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

    // 1. Audit Intent
    AuditService.recordEvent({
      conversation_id: ctx.conversation_id,
      actor: 'BUYER_AGENT',
      event_type: 'USER_INPUT',
      title: 'User Message Received',
      description: `User prompted: "${userMessage}"`,
      status: 'INFO',
    });

    // FLOW A: User explicitly confirms payment / checkout
    if (
      (msg === 'yes' || msg.includes('proceed') || msg.includes('pay') || msg.includes('checkout') || msg.includes('confirm')) &&
      ctx.cart &&
      ctx.cart.items.length > 0 &&
      (ctx.state === 'CHECK_POLICY' || ctx.state === 'REQUEST_CONFIRMATION' || ctx.state === 'CALCULATE_TOTAL')
    ) {
      return await this.handlePaymentExecution(ctx);
    }

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

    // 5. Extract dynamic user intent, query terms, and budget
    const extracted = await extractSearchIntent(userMessage);

    // FLOW: Greetings without search keywords
    if (extracted.intent === 'GREETING' && (!extracted.query || extracted.query.length === 0)) {
      return {
        reply: `👋 Welcome! I am your **Autonomous AI Buyer Agent**.\n\nTell me what you're looking for (e.g. *"hydration vest"*, *"running shoes under ₹5,000"*, *"bottle under 1900"*, *"socks"*, or *"electrolyte mix"*), and I will search the merchant's live catalog, negotiate price concessions, and manage autonomous checkout within your policy limits.`,
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
        negotiationNote = `\n\n🤝 **Autonomous Merchant Negotiation:**\nThe **${topMatch.name}** is listed at ₹${(topMatch.price_paise / 100).toLocaleString()}. Through automated machine-to-machine bargaining, I negotiated an instant **${negotiation.discount_percentage}% price-match concession (-₹${(negotiation.discount_paise / 100).toLocaleString()})** with the merchant agent, bringing your final price down to **₹${(discountedPrice / 100).toLocaleString()}**!`;
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
        negotiationNote = `\n\n🤝 **Autonomous Merchant Negotiation (Floor Counter-Offer):**\nI bargained aggressively with the merchant agent and extracted their maximum allowable automated concession of **${negotiation.discount_percentage}% (-₹${(negotiation.discount_paise / 100).toLocaleString()})**, bringing your price from ₹${(topMatch.price_paise / 100).toLocaleString()} down to **₹${(discountedPrice / 100).toLocaleString()}**!`;
      }
    }

    // Dynamic decision & options summary
    const optionsText = products
      .slice(0, 4)
      .map((p, idx) => {
        const isAbove = maxBudget && p.price_paise > maxBudget;
        const tag =
          ctx.negotiated_discount?.accepted && p.id === topMatch.id
            ? ` *(Negotiated to ₹${((topMatch.price_paise - (ctx.negotiated_discount?.discount_paise || 0)) / 100).toLocaleString()})*`
            : isAbove
            ? ' *(Eligible for agent negotiation)*'
            : '';
        return `${idx + 1}. **${p.name}** (${p.category}) — ₹${(p.price_paise / 100).toLocaleString()}${tag}`;
      })
      .join('\n');

    let recommendationReason = '';
    if (ctx.negotiated_discount?.accepted) {
      recommendationReason = `I negotiated down the **${topMatch.name}** to ₹${((topMatch.price_paise - ctx.negotiated_discount.discount_paise) / 100).toLocaleString()} to get you the maximum possible savings.`;
    } else if (maxBudget) {
      recommendationReason = `I recommend the **${topMatch.name}** (₹${(topMatch.price_paise / 100).toLocaleString()}) because it has the highest relevance score and satisfies your budget limit.`;
    } else {
      recommendationReason = `I recommend the **${topMatch.name}** (₹${(topMatch.price_paise / 100).toLocaleString()}) as the top match for "${extracted.query || 'your search'}".`;
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
        ? `₹${(currentCart.total_paise / 100).toLocaleString()} (after ₹${(currentCart.discount_paise / 100).toLocaleString()} negotiated concession)`
        : `₹${(product.price_paise / 100).toLocaleString()}`;

      const upsellShortName = topUpsell.product.name.split(' ').slice(0, 3).join(' ');
      return {
        reply: `I've added **${product.name}** (${priceSummary}) to your cart.\n\n💡 **Smart Add-On Suggestion:**\n${topUpsell.pitch_message}\n\nWould you like to add them?`,
        context: ctx,
        action_type: 'UPSELL_PROPOSAL',
        quick_replies: [`Yes, add ${upsellShortName} (₹${(topUpsell.product.price_paise / 100).toLocaleString()})`, 'No, proceed to checkout'],
      };
    }

    return await this.evaluateCartPolicy(ctx, false);
  }

  private static async evaluateCartPolicy(ctx: AgentContext, includedUpsell: boolean) {
    if (!ctx.cart) throw new Error('Cart not initialized');

    ctx.state = 'CHECK_POLICY';
    const policyResult: PolicyEvaluationResult = await AgentTools.check_policy.execute(
      {
        amount_paise: ctx.cart.total_paise,
        categories: ['footwear', 'apparel', 'gear', 'nutrition'],
        buyer_id: ctx.agent_id,
      },
      { conversation_id: ctx.conversation_id, agent_id: ctx.agent_id }
    );

    ctx.policy_result = policyResult;

    const totalStr = `₹${(ctx.cart.total_paise / 100).toLocaleString()}`;
    const discountInfo = ctx.cart.discount_paise > 0
      ? ` (includes -₹${(ctx.cart.discount_paise / 100).toLocaleString()} negotiated agent concession)`
      : '';
    let policyText = '';

    if (policyResult.verdict === 'ALLOW') {
      ctx.state = 'CALCULATE_TOTAL';
      policyText = `✅ **Policy Status:** ALLOWED\nThis amount is within your autonomous spending limit of ₹${(policyResult.max_allowed_paise / 100).toLocaleString()}.\n\nReady to proceed with payment?`;
    } else if (policyResult.verdict === 'REQUIRE_CONFIRMATION') {
      ctx.state = 'REQUEST_CONFIRMATION';
      policyText = `⚠️ **Policy Status:** MANUAL CONFIRMATION REQUIRED\nTotal amount exceeds your autonomous threshold of ₹${(policyResult.confirmation_threshold_paise / 100).toLocaleString()}.\n\nPlease explicitly confirm to proceed with payment.`;
    } else {
      ctx.state = 'COMPLETE';
      return {
        reply: `❌ **Transaction Blocked by Policy:**\n${policyResult.reason}`,
        context: ctx,
        policy_verdict: 'DENY',
        quick_replies: ['Modify cart', 'Check policy rules'],
      };
    }

    return {
      reply: `Your cart total is **${totalStr}**${discountInfo} (${ctx.cart.items.length} item${ctx.cart.items.length > 1 ? 's' : ''}).\n\n${policyText}`,
      context: ctx,
      action_type: 'POLICY_EVALUATION',
      policy_verdict: policyResult.verdict,
      quick_replies: ['Yes, proceed with payment', 'View order summary', 'Cancel'],
    };
  }

  private static async handlePaymentExecution(ctx: AgentContext) {
    if (!ctx.cart) throw new Error('No active cart');

    // 1. Create order with cryptographic policy ticket
    ctx.state = 'CREATE_ORDER';
    const order = await AgentTools.create_order.execute(
      {
        cart_id: ctx.cart.id,
        policy_ticket: (ctx.policy_result as any)?.ticket,
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
        reply: `⚠️ **Payment Failed**\n\nNo duplicate charge was created.\n\n- **Order ID:** ${order.id.slice(0, 8)}\n- **Amount:** ₹${(order.total_paise / 100).toFixed(2)}\n- **Reason:** ${paymentRes.payment.failure_reason || 'Payment provider rejected request.'}\n\n**Safe Recovery Options:**\nYou can retry the payment or select another payment method.`,
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
      reply: `🎉 **Transaction Completed Successfully!**\n\n- **Amount Paid:** ₹${(order.total_paise / 100).toLocaleString()}\n- **Order ID:** ${order.id}\n- **Payment ID:** ${settlement.payment.razorpay_payment_id}\n- **Status:** PAID & SETTLED ON LEDGER\n\nThe transaction has been cryptographically signed and linked to the tamper-evident audit ledger.`,
      context: ctx,
      action_type: 'PAYMENT_CONFIRMED',
      policy_verdict: 'ALLOW',
      quick_replies: ['View audit trail', 'Shop for more items'],
    };
  }
}
