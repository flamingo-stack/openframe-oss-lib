import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PagePicture, PageTitle } from '../layout/page-picture';
import { TitleBlock } from '../layout/title-block';

/** A page's title is the page's `<h1>`; a picture of a page inside another page holds no heading of its own. */
describe('a page title inside a picture of a page', () => {
  it('is the h1 of a page', () => {
    render(<TitleBlock title="Devices" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Devices');
  });

  it('is drawn as it is, in no heading, inside a picture', () => {
    render(
      <PagePicture>
        <TitleBlock title="New laptop runbook" />
      </PagePicture>,
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('New laptop runbook').tagName).toBe('DIV');
  });

  it('keeps the classes it is given in both elements', () => {
    render(
      <>
        <PageTitle className="text-h2">Page</PageTitle>
        <PagePicture>
          <PageTitle className="text-h2">Picture</PageTitle>
        </PagePicture>
      </>,
    );
    expect(screen.getByText('Page').className).toBe('text-h2');
    expect(screen.getByText('Picture').className).toBe('text-h2');
  });
});
