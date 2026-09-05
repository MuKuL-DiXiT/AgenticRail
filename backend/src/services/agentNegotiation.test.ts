import { MerchantService } from './merchantService';
import { DEMO_MERCHANT_ID } from './catalogService';
import { initDb, closeDb } from '../ledger/db';

describe('Merchant Agent Manifest & Agent-to-Agent Negotiation', () => {
  beforeAll(() => {
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('should return a machine-readable capability manifest', () => {
    const manifest = MerchantService.getAgentManifest(DEMO_MERCHANT_ID);

    expect(manifest.merchant_id).toBe(DEMO_MERCHANT_ID);
    expect(manifest.protocol_version).toBe('agentcart.v1');
    expect(manifest.capabilities).toContain('catalog.search');
    expect(manifest.capabilities).toContain('cart.create');
    expect(manifest.endpoints.negotiate_offer).toBeDefined();
    expect(manifest.policy_constraints.autonomous_checkout_allowed).toBe(true);
  });

  it('should accept multi-item bundle discount negotiation between agents', () => {
    const offer = MerchantService.negotiateAgentOffer(DEMO_MERCHANT_ID, {
      buyer_agent_id: 'buyer_agent_001',
      product_ids: ['prod_pegasus_001', 'prod_socks_001'],
      total_budget_paise: 550000,
    });

    expect(offer.accepted).toBe(true);
    expect(offer.discount_percentage).toBe(10);
    expect(offer.bundle_name).toBe('Athlete Starter Pack Bundle');
    expect(offer.offer_code).toContain('AGENT_BUNDLE_');
  });

  it('should reject bundle discount for single item order and provide rationale', () => {
    const offer = MerchantService.negotiateAgentOffer(DEMO_MERCHANT_ID, {
      buyer_agent_id: 'buyer_agent_001',
      product_ids: ['prod_pegasus_001'],
    });

    expect(offer.accepted).toBe(false);
    expect(offer.discount_percentage).toBe(0);
    expect(offer.rationale).toContain('Standard price applies');
  });
});
