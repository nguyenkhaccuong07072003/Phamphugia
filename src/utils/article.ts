export interface ArticleCategory {
  id: number
  name: string
}

export interface ArticleListItem {
  slug: string
  thumbnail_url?: string | null
  image_urls?: string[] | null
  category?: ArticleCategory | null
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function isProductCategory(categoryName?: string | null) {
  if (!categoryName) return false
  return normalizeText(categoryName) === 'san pham'
}

export function getArticleRoute(item: Pick<ArticleListItem, 'slug' | 'category'>) {
  const basePath = isProductCategory(item.category?.name) ? '/products' : '/news'
  return `${basePath}/${item.slug}`
}

export function getArticleCoverImage(item: Pick<ArticleListItem, 'thumbnail_url' | 'image_urls'>) {
  if (item.thumbnail_url) return item.thumbnail_url
  if (Array.isArray(item.image_urls) && item.image_urls.length > 0) {
    return item.image_urls[0] || null
  }
  return null
}
