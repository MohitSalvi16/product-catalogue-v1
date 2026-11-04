export interface MailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

/** The boundary to the email provider. Rejects with MailDeliveryError. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
