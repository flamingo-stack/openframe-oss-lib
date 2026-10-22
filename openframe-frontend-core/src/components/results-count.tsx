'use client';

import { TextLineSkeleton } from './loading/unified-skeleton';
import { useLoadingScope } from './ui/loading-scope';

export interface ResultsCountProps {
  currentPage: number;
  pageSize: number;
  totalResults: number;
  resultType: 'vendors' | 'posts';
  sortingMessage?: string;
}

/** The row's box and its line, read by the count and by its skeleton, so the skeleton is the row's size. */
const RESULTS_COUNT_ROW_CLASS = 'mb-6';
const RESULTS_COUNT_TEXT_CLASS = 'text-ods-text-secondary text-h6';
const RESULTS_COUNT_SORTING_CLASS = 'ml-2 text-ods-accent';

const resultLabel = (resultType: ResultsCountProps['resultType'], one: boolean) =>
  resultType === 'vendors' ? (one ? 'vendor' : 'vendors') : one ? 'post' : 'posts';

export function ResultsCount({ currentPage, pageSize, totalResults, resultType, sortingMessage }: ResultsCountProps) {
  // While the list is read the count is not known: the row is drawn with its numbers as bars, never left out.
  if (useLoadingScope()) return <ResultsCountSkeleton resultType={resultType} sortingMessage={sortingMessage} />;

  if (totalResults === 0) {
    return null;
  }

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalResults);
  const displayType = resultLabel(resultType, totalResults === 1);

  return (
    <div className={RESULTS_COUNT_ROW_CLASS}>
      <p className={RESULTS_COUNT_TEXT_CLASS}>
        {totalResults > 0 && (
          <>
            Showing {startIndex}-{endIndex} of {totalResults} {displayType}
            {sortingMessage && <span className={RESULTS_COUNT_SORTING_CLASS}>• {sortingMessage}</span>}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The results count while the list is read: the same row and line, the words its own ("Showing", "of", the result
 * type, the sorting message) and the two numbers as bars.
 */
export function ResultsCountSkeleton({
  resultType,
  sortingMessage,
}: Pick<ResultsCountProps, 'resultType' | 'sortingMessage'>) {
  return (
    <div className={RESULTS_COUNT_ROW_CLASS} aria-hidden>
      <p className={RESULTS_COUNT_TEXT_CLASS}>
        Showing <TextLineSkeleton type="inherit" as="span" className="inline-block w-10 align-top" /> of{' '}
        <TextLineSkeleton type="inherit" as="span" className="inline-block w-6 align-top" />{' '}
        {resultLabel(resultType, false)}
        {sortingMessage && <span className={RESULTS_COUNT_SORTING_CLASS}>• {sortingMessage}</span>}
      </p>
    </div>
  );
}
