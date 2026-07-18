export function validateRfqDraft(input: {
  title: string;
  currency: string;
  procurementCategory: string;
  clarificationDeadline: string;
  submissionDeadline: string;
  requiredBy: string;
  deliveryLocation: string;
}) {
  const e: Record<string, string> = {};
  if (!input.title.trim()) e.title = 'Title is required.';
  if (!/^[A-Z]{3}$/.test(input.currency)) e.currency = 'Currency must be a three-letter ISO code.';
  if (!input.procurementCategory.trim())
    e.procurementCategory = 'Procurement category is required.';
  if (!input.clarificationDeadline) e.clarificationDeadline = 'Clarification deadline is required.';
  if (!input.submissionDeadline) e.submissionDeadline = 'Quotation deadline is required.';
  if (
    input.clarificationDeadline &&
    input.submissionDeadline &&
    new Date(input.clarificationDeadline) > new Date(input.submissionDeadline)
  )
    e.submissionDeadline = 'Quotation deadline must be after the clarification deadline.';
  if (!input.requiredBy) e.requiredBy = 'Required-by date is required.';
  if (!input.deliveryLocation.trim()) e.deliveryLocation = 'Delivery location is required.';
  return e;
}
