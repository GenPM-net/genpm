import { archive } from '../../../_lib/archive';

const a = archive({ collection: 'authors', filter: 'author', segment: 'author', label: 'Author' });
export const generateMetadata = a.generateMetadata;
export default a.Page;
