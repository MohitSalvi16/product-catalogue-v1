import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, type EnquiryRequest } from '../api/client';
import { FormField } from '../components/FormField';
import { QueryStatus } from '../components/QueryStatus';

type ContactDetails = Omit<EnquiryRequest, 'productId'>;

const emptyForm: ContactDetails = { name: '', email: '', phone: '', message: '' };

export function EnquiryPage() {
  const { id = '' } = useParams();
  const [form, setForm] = useState(emptyForm);
  const { data: product, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.product(id),
  });
  const enquiry = useMutation({ mutationFn: api.submitEnquiry });

  if (!product) return <QueryStatus error={error} notFoundMessage="We could not find that product" />;

  if (enquiry.isSuccess) {
    return (
      <section role="status">
        <h1>Thank you</h1>
        <p>We have received your enquiry about {product.title} and will be in touch soon.</p>
        <Link to="/">Continue browsing</Link>
      </section>
    );
  }

  const failure = enquiry.error instanceof ApiError ? enquiry.error : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    enquiry.mutate({ ...form, productId: id });
  }

  const field = (name: keyof ContactDetails) => ({
    name,
    value: form[name],
    error: failure?.fieldErrors[name]?.[0],
    onChange: (value: string) => setForm({ ...form, [name]: value }),
  });

  return (
    <>
      <h1>Enquire about {product.title}</h1>
      <form className="enquiry-form" onSubmit={handleSubmit}>
        <FormField {...field('name')} label="Name" required maxLength={100} autoComplete="name" />
        <FormField {...field('email')} label="Email" required type="email" autoComplete="email" />
        <FormField {...field('phone')} label="Phone (optional)" type="tel" maxLength={30} autoComplete="tel" />
        <FormField {...field('message')} label="Message (optional)" multiline maxLength={2000} />
        {failure && <p role="alert">{failure.message}</p>}
        <button type="submit" className="button" disabled={enquiry.isPending}>
          {enquiry.isPending ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </>
  );
}
