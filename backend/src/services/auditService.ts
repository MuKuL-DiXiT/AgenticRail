import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../ledger/db';
import { AgentAction, AuditEvent, PolicyVerdict } from '../models/domain';

type AuditListener = (event: AuditEvent) => void;
type ActionListener = (action: AgentAction) => void;

export class AuditService {
  private static auditListeners: AuditListener[] = [];
  private static actionListeners: ActionListener[] = [];

  public static onAuditEvent(listener: AuditListener): void {
    this.auditListeners.push(listener);
  }

  public static onAgentAction(listener: ActionListener): void {
    this.actionListeners.push(listener);
  }

  public static recordEvent(params: {
    conversation_id: string;
    actor: 'BUYER_AGENT' | 'MERCHANT_AGENT' | 'POLICY_ENGINE' | 'ORDER_SERVICE' | 'RAZORPAY' | 'WEBHOOK' | 'LEDGER';
    event_type: string;
    title: string;
    description: string;
    status: 'SUCCESS' | 'WARNING' | 'FAILURE' | 'INFO';
    metadata?: Record<string, any>;
  }): AuditEvent {
    const db = getDb();
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      conversation_id: params.conversation_id,
      actor: params.actor,
      event_type: params.event_type,
      title: params.title,
      description: params.description,
      metadata: params.metadata || {},
      status: params.status,
    };

    db.prepare(`
      INSERT INTO audit_events (id, timestamp, conversation_id, actor, event_type, title, description, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.timestamp,
      event.conversation_id,
      event.actor,
      event.event_type,
      event.title,
      event.description,
      JSON.stringify(event.metadata || {}),
      event.status
    );

    this.auditListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error dispatching audit listener', err);
      }
    });

    return event;
  }

  public static recordAction(params: {
    conversation_id: string;
    agent_id: string;
    action_type: string;
    summary: string;
    inputs: Record<string, any>;
    result: Record<string, any>;
    policy_verdict?: PolicyVerdict;
  }): AgentAction {
    const db = getDb();
    const action: AgentAction = {
      id: uuidv4(),
      conversation_id: params.conversation_id,
      agent_id: params.agent_id,
      action_type: params.action_type,
      summary: params.summary,
      inputs: params.inputs,
      result: params.result,
      policy_verdict: params.policy_verdict,
      timestamp: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO agent_actions (id, conversation_id, agent_id, action_type, summary, inputs, result, policy_verdict, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      action.id,
      action.conversation_id,
      action.agent_id,
      action.action_type,
      action.summary,
      JSON.stringify(action.inputs),
      JSON.stringify(action.result),
      action.policy_verdict || null,
      action.timestamp
    );

    this.actionListeners.forEach(listener => {
      try {
        listener(action);
      } catch (err) {
        console.error('Error dispatching action listener', err);
      }
    });

    return action;
  }

  public static getEvents(conversationId?: string, limit: number = 100): AuditEvent[] {
    const db = getDb();
    let sql = 'SELECT * FROM audit_events';
    const params: any[] = [];

    if (conversationId) {
      sql += ' WHERE conversation_id = ?';
      params.push(conversationId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      conversation_id: r.conversation_id,
      actor: r.actor,
      event_type: r.event_type,
      title: r.title,
      description: r.description,
      metadata: JSON.parse(r.metadata || '{}'),
      status: r.status,
    }));
  }

  public static getActions(conversationId?: string, limit: number = 100): AgentAction[] {
    const db = getDb();
    let sql = 'SELECT * FROM agent_actions';
    const params: any[] = [];

    if (conversationId) {
      sql += ' WHERE conversation_id = ?';
      params.push(conversationId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      conversation_id: r.conversation_id,
      agent_id: r.agent_id,
      action_type: r.action_type,
      summary: r.summary,
      inputs: JSON.parse(r.inputs || '{}'),
      result: JSON.parse(r.result || '{}'),
      policy_verdict: r.policy_verdict,
      timestamp: r.timestamp,
    }));
  }
}
