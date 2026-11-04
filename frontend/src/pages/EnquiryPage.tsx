import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, type EnquiryRequest } from '../api/client';
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

  function field(name: keyof ContactDetails, label: string, props: FieldProps = {}) {
    const fieldError = failure?.fieldErrors[name]?.[0];
    const { multiline, ...inputProps } = props;
    const shared = {
      id: name,
      name,
      value: form[name],
      'aria-invalid': fieldError ? true : undefined,
      'aria-describedby': fieldError ? `${name}-error` : undefined,
      onChange: (event: { target: { value: string } }) =>
        setForm({ ...form, [name]: event.target.value }),
      ...inputProps,
    };

    return (
      <div className="form-field">
        <label htmlFor={name}>{label}</label>
        {multiline ? <textarea rows={5} {...shared} /> : <input {...shared} />}
        {fieldError && (
          <p id={`${name}-error`} className="form-field__error">
            {fieldError}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <h1>Enquire about {product.title}</h1>
      <form className="enquiry-form" onSubmit={handleSubmit}>
        {field('name', 'Name', { required: true, maxLength: 100, autoComplete: 'name' })}
        {field('email', 'Email', { required: true, type: 'email', autoComplete: 'email' })}
        {field('phone', 'Phone (optional)', { type: 'tel', maxLength: 30, autoComplete: 'tel' })}
        {field('message', 'Message (optional)', { multiline: true, maxLength: 2000 })}
        {failure && <p role="alert">{failure.message}</p>}
        <button type="submit" className="button" disabled={enquiry.isPending}>
          {enquiry.isPending ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </>
  );
}

interface FieldProps {
  required?: boolean;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  multiline?: boolean;
}
