// Stub API hooks
import { useState, useEffect } from 'react';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  return { categories, loading, error };
}

export function useVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  return { vendors, loading, error };
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);

  return { announcements, loading };
}

export function useSubcategoryCountByCategory() {
  return { data: {}, loading: false };
}