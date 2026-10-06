import { archive } from '../../../_lib/archive';

const a = archive({ collection: 'categories', filter: 'category', segment: 'category', label: 'Category' });
export const generateMetadata = a.generateMetadata;
export default a.Page;
