// @core/forms — API pública. Importa desde aquí; endpoint en adapters/hono.ts y adapters/next.ts.
export {
  deleteSubmissionsByEmail,
  exportSubmissionsCsv,
  formsAdminResources,
  pruneSubmissions,
  submissionsAdminResource,
} from './admin.js';
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
} from './definitions.js';
export { type FormSubmission, formSubmissions } from './schema.js';
export {
  CONSENT_FIELD,
  clearSubmissionHandlers,
  onSubmission,
  processSubmissionJob,
  type SubmitResult,
  sourceInfo,
  submitForm,
  webhookSignature,
} from './submit.js';
