import crypto from 'crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { emailOutboxService, normalizeOutboxProcessLimit } from '../services/email-outbox.service.js';

const router = Router();

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function getProvidedToken(req: any): string {
  return String(req.headers['x-internal-job-token'] || '').trim();
}

function isAuthorized(req: any): boolean {
  const configuredToken = String(env.INTERNAL_JOB_TOKEN || '').trim();
  const providedToken = getProvidedToken(req);
  if (!configuredToken || !providedToken) return false;
  return timingSafeEqualString(providedToken, configuredToken);
}

async function processEmailOutbox(req: any, res: any) {
  if (!isAuthorized(req)) {
    return sendError(res, 'Nao autorizado', 401);
  }

  try {
    const limit = normalizeOutboxProcessLimit(req.body?.limit ?? 20);
    console.log(`[InternalJobs] Processando email outbox via POST; limit=${limit}`);
    const result = await emailOutboxService.processPending(limit);
    return sendSuccess(res, result, 'Outbox processada');
  } catch (error) {
    console.error('[InternalJobs] Falha ao processar outbox:', error);
    return sendError(res, 'Erro ao processar outbox', 500);
  }
}

// Endpoint mutavel: apenas POST e token em header. Nunca aceite secret em query string.
router.post('/process-email-outbox', processEmailOutbox);

export default router;
