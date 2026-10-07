import { archive } from '../../../_lib/archive';

const a = archive({ collection: 'tags', filter: 'tag', segment: 'tag', label: 'Tag' });
export const generateMetadata = a.generateMetadata;
export default a.Page;
