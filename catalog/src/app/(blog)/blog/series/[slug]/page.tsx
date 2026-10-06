import { archive } from '../../../_lib/archive';

const a = archive({ collection: 'series', filter: 'series', segment: 'series', label: 'Series' });
export const generateMetadata = a.generateMetadata;
export default a.Page;
