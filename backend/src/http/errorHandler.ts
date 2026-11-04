import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MailDeliveryError, NotFoundError, ProductSourceError } from '../domain/errors.js';

function send(reply: FastifyReply, status: number, code: string, message: string, details?: object) {
  return reply.status(status).send({ error: { code, message, ...(details && { details }) } });
}

/** One error shape for the whole API. Internals are logged, never returned. */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof z.ZodError) {
    const { fieldErrors } = z.flattenError(error);
    return send(reply, 400, 'VALIDATION_FAILED', 'Please check the highlighted fields', { fieldErrors });
  }
  if (error instanceof NotFoundError) {
    return send(reply, 404, 'NOT_FOUND', error.message);
  }
  if (error instanceof ProductSourceError) {
    request.log.error({ err: error }, 'Product source unavailable');
    return send(reply, 503, 'PRODUCT_SOURCE_UNAVAILABLE', 'Products are unavailable right now');
  }
  if (error instanceof MailDeliveryError) {
    request.log.error({ err: error }, 'Enquiry email failed');
    return send(reply, 503, 'ENQUIRY_NOT_SENT', 'We could not send your enquiry. Please try again');
  }
  if (error.statusCode === 429) {
    return send(reply, 429, 'RATE_LIMITED', 'Too many requests. Please try again shortly');
  }
  if (error.statusCode && error.statusCode < 500) {
    return send(reply, error.statusCode, 'BAD_REQUEST', 'The request could not be processed');
  }
  request.log.error({ err: error }, 'Unhandled error');
  return send(reply, 500, 'INTERNAL_ERROR', 'Something went wrong');
}
