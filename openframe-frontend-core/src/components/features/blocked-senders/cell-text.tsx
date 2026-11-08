'use client';

import { useLoadingScope } from '../../ui/loading-scope';
import { TruncateText, type TruncateTextProps } from '../../ui/truncate-text';

/** A table cell's text. Every one is read data (or derived from it), so in a loading scope it is its own bar. */
export function CellText(props: Omit<TruncateTextProps, 'loading'>) {
  const loading = useLoadingScope();
  return <TruncateText {...props} loading={loading} />;
}
