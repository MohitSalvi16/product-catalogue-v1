import nodemailer, { type Transporter } from 'nodemailer';
import { MailDeliveryError } from '../../domain/errors.js';
import type { Mailer, MailMessage } from '../../ports/Mailer.js';

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  pass?: string | undefined;
}

/** Works with Mailpit locally and with any SMTP relay, Amazon SES included. */
export function createSmtpTransport({ host, port, secure, user, pass }: SmtpOptions): Transporter {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass } } : {}),
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
}

export class SmtpMailer implements Mailer {
  constructor(
    private readonly transport: Pick<Transporter, 'sendMail'>,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch (error) {
      throw new MailDeliveryError('Could not send email', { cause: error });
    }
  }
}
