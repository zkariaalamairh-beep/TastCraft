import { apiRequest } from './api.js';

// GET /api/categories — عام
export function getCategories() {
  return apiRequest('/categories');
}

// GET /api/menu-items — عام، مع بحث وفلاتر وصفحات
export function getMenuItems({
  search,
  categoryId,
  isFeatured,
  isAvailable,
  page = 1,
  pageSize = 12,
} = {}) {
  const params = new URLSearchParams();

  if (search?.trim()) params.set('search', search.trim());
  if (categoryId != null) params.set('categoryId', String(categoryId));
  if (isFeatured != null) params.set('isFeatured', String(isFeatured));
  if (isAvailable != null) params.set('isAvailable', String(isAvailable));

  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  return apiRequest(`/menu-items?${params}`);
}

// GET /api/menu-items/{id} — عام
export function getMenuItem(id) {
  return apiRequest(`/menu-items/${id}`);
}