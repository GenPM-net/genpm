// @core/catalog — API pública. Importa desde aquí.
export { catalogAdminResources, categoriesAdminResource, productsAdminResource } from './admin.js';
export {
  type Availability,
  availability,
  CatalogError,
  createProduct,
  getProduct,
  getProductById,
  getVariants,
  type ListProductsOptions,
  listProducts,
  lowStockVariants,
  ProductInput,
  type ProductInputData,
  type ProductSort,
  type ProductSummary,
  type ProductView,
  releaseStock,
  reserveStock,
  storeCurrency,
  updateProduct,
  VariantInput,
  variantPrice,
} from './products.js';
export {
  type Category,
  type Collection,
  categories,
  collectionProducts,
  collections,
  type Product,
  type ProductOption,
  type ProductTranslation,
  productCategories,
  productMedia,
  products,
  productVariants,
  type Variant,
} from './schema.js';
export { productSearchSource, productSitemapSource } from './sources.js';
export { CategoryInput, type CategoryNode, categoryTree, setCollection, upsertCategory } from './taxonomy.js';
