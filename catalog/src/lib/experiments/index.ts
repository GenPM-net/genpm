// @core/experiments — API pública. `<Experiment>` en `./react.js`.
export { type ExperimentAdminRow, experimentsAdminResource, summarize } from './admin.ts';
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
} from './experiments.ts';
export { type Experiment, type ExperimentVariant, experimentParticipants, experiments } from './schema.ts';
export { type Comparison, compare, normalCdf } from './stats.ts';
