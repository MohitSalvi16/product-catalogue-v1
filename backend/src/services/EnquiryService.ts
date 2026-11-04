import type { Logger } from '../ports/Logger.js';
import type { Mailer } from '../ports/Mailer.js';
import type { CatalogueService } from './CatalogueService.js';

export interface Enquiry {
  productId: string;
  name: string;
  email: string;
  phone?: string | undefined;
  message?: string | undefined;
}

export class EnquiryService {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly mailer: Mailer,
    private readonly salesInbox: string,
    private readonly logger: Logger,
  ) {}

  async submit(enquiry: Enquiry): Promise<void> {
    // Resolved here rather than trusted from the client, so the sales team sees
    // the real product and a forged id cannot put arbitrary text in the subject.
    const product = await this.catalogue.getProduct(enquiry.productId);

    await this.mailer.send({
      to: this.salesInbox,
      replyTo: enquiry.email,
      subject: `New enquiry: ${product.title}`,
      text: [
        `Product: ${product.title} (id ${product.id})`,
        `Price: ${product.price.toFixed(2)}`,
        '',
        `Name: ${enquiry.name}`,
        `Email: ${enquiry.email}`,
        `Phone: ${enquiry.phone ?? 'Not provided'}`,
        '',
        'Message:',
        enquiry.message ?? 'Not provided',
      ].join('\n'),
    });

    // Contact details stay out of the logs.
    this.logger.info({ productId: product.id }, 'Enquiry sent to sales inbox');
  }
}
