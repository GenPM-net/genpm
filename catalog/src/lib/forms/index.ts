// @core/forms — API pública. Importa desde aquí; endpoint en adapters/hono.ts y adapters/next.ts.
export {
  deleteSubmissionsByEmail,
  exportSubmissionsCsv,
  formsAdminResources,
  pruneSubmissions,
  submissionsAdminResource,
} from './admin.ts';
export {
  type BuilderField,
  type ConsentConfig,
  clearForms,
  defineForm,
  type FormDefinition,
  FormBuilderSchema,
  forms,
  getForm,
  schemaFromFields,
} from './definitions.ts';
export { type FormSubmission, formSubmissions } from './schema.ts';
export {
  CONSENT_FIELD,
  clearSubmissionHandlers,
  onSubmission,
  processSubmissionJob,
  type SubmitResult,
  sourceInfo,
  submitForm,
  webhookSignature,
} from './submit.ts';
export { Form, type FormLabels, type FormProps, fieldsFromSchema, formLabels } from './react.ts';
