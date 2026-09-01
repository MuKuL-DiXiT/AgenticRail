import { WorkerBot, BotPersonality } from './bot';
import { env } from '../config/env';

// Worker 1: Fast & Cheap (always bids 10% of max budget)
const cheapPersonality: BotPersonality = (desc, max) => ({
  willBid: true,
  amount: Math.floor(max * 0.1),
});

// Worker 2: Load-based (simulates load, randomly bids between 20% and 80%)
const loadBasedPersonality: BotPersonality = (desc, max) => ({
  willBid: Math.random() > 0.2, // 80% chance to bid
  amount: Math.floor(max * (0.2 + Math.random() * 0.6)),
});

// Worker 3: Specialist (only bids if task description contains certain keywords)
const specialistPersonality: BotPersonality = (desc, max) => {
  const keywords = ['code', 'analyze', 'summarize'];
  const isSpecialist = keywords.some((k) => desc.toLowerCase().includes(k));
  return {
    willBid: isSpecialist,
    amount: Math.floor(max * 0.5), // Bids reasonably if it matches
  };
};

// Worker 4: Premium (always bids 90% of max budget)
const premiumPersonality: BotPersonality = (desc, max) => ({
  willBid: true,
  amount: Math.floor(max * 0.9),
});

// Worker 5: Judge (Doesn't bid on normal tasks, only evaluates. For now, never bids)
const judgePersonality: BotPersonality = () => ({
  willBid: false,
  amount: 0,
});

export const workers = [
  new WorkerBot('worker_1', env.GROQ_API_KEY_WORKER_1, cheapPersonality),
  new WorkerBot('worker_2', env.GROQ_API_KEY_WORKER_2, loadBasedPersonality),
  new WorkerBot('worker_3', env.GROQ_API_KEY_WORKER_3, specialistPersonality),
  new WorkerBot('worker_4', env.GROQ_API_KEY_WORKER_4, premiumPersonality),
  new WorkerBot('worker_5', env.GROQ_API_KEY_WORKER_5, judgePersonality),
];

export async function startWorkers() {
  for (const w of workers) {
    await w.start();
  }
}
