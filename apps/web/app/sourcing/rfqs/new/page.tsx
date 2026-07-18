'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ErrorState, Input } from '@procurement/ui';
import { ApiError, createRfq } from '../../../lib/api';
import { validateRfqDraft } from '../../../lib/validation';
const v = (fd: FormData, k: string) => String(fd.get(k) ?? '');
export default function NewRfqPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: v(fd, 'title'),
      procurementCategory: v(fd, 'procurementCategory'),
      currency: v(fd, 'currency').toUpperCase(),
      clarificationDeadline: v(fd, 'clarificationDeadline'),
      submissionDeadline: v(fd, 'submissionDeadline'),
      requiredBy: v(fd, 'requiredBy'),
      deliveryLocation: v(fd, 'deliveryLocation'),
    };
    const next = validateRfqDraft(payload);
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const rfq = await createRfq(payload);
      router.push(`/sourcing/rfqs/${rfq.id}`);
    } catch (err) {
      if (err instanceof ApiError) setApiError(err);
    }
  }
  return (
    <form className="request-form" onSubmit={submit} noValidate>
      {apiError && <ErrorState title={apiError.kind} description={apiError.message} />}{' '}
      {[
        'title',
        'procurementCategory',
        'currency',
        'clarificationDeadline',
        'submissionDeadline',
        'requiredBy',
        'deliveryLocation',
      ].map((name) => (
        <label key={name}>
          {name.replace(/([A-Z])/g, ' $1')}
          <Input
            name={name}
            type={
              name.includes('Deadline') ? 'datetime-local' : name === 'requiredBy' ? 'date' : 'text'
            }
            defaultValue={name === 'currency' ? 'USD' : ''}
            aria-invalid={Boolean(errors[name])}
          />
          {errors[name] && <span className="field-error">{errors[name]}</span>}
        </label>
      ))}
      <Button>Save RFQ draft</Button>
    </form>
  );
}
