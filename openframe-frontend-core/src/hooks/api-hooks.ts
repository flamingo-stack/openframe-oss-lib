// Stub API hooks
import { useEffect, useState } from 'react';

export function useCategories() {
  const [categories, _setCategories] = useState([]);
  const [loading, _setLoading] = useState(false);
  const [error, _setError] = useState(null);

  return { categories, loading, error };
}

export function useVendors() {
  const [vendors, _setVendors] = useState([]);
  const [loading, _setLoading] = useState(false);
  const [error, _setError] = useState(null);

  return { vendors, loading, error };
}

export function useAnnouncements() {
  const [announcements, _setAnnouncements] = useState([]);
  const [loading, _setLoading] = useState(false);

  return { announcements, loading };
}

export function useSubcategoryCountByCategory() {
  return { data: {}, loading: false };
}
