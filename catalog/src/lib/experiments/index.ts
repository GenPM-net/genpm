// @core/experiments — API pública. `<Experiment>` en `./react.js`.
export { type ExperimentAdminRow, experimentsAdminResource, summarize } from './admin.js';
export {
  type Assignment,
  ExperimentError,
  ExperimentInput,
  experimentResults,
  getVariant,
  pickVariant,
  pruneExperimentsJob,
  pruneParticipants,
  recordConversion,
  setExperimentStatus,
  upsertExperiment,
  type VariantResult,
} from './experiments.js';
export { type Experiment, type ExperimentVariant, experimentParticipants, experiments } from './schema.js';
export { type Comparison, compare, normalCdf } from './stats.js';
