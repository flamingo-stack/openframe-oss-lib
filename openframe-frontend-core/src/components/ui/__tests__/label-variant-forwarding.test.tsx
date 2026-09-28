import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Autocomplete } from '../autocomplete';
import { FieldWrapper } from '../field-wrapper';
import { Select, SelectTrigger, SelectValue } from '../select';
import { TabSelector } from '../tab-selector';

/**
 * `labelVariant` reaches four components through three forwarding hops, and the
 * whole point of it is that a screen CAN opt out of the converged small label
 * scale without every other form drifting with it. Nothing pinned that: the
 * prop is plumbing, so a hop dropped in a refactor (or in a merge) type-checks
 * and renders — just at the wrong scale, on one screen, which nobody notices
 * until a designer does.
 *
 * `text-h6` is the default and `text-h4` the opt-in (see `labelVariants` in
 * ui/label.tsx), so the assertions read the emitted class rather than a
 * variant name.
 */

const labelFor = (text: string) => screen.getByText(text);
const OPTIONS = [{ label: 'A', value: 'a' }];

describe('FieldWrapper labelVariant', () => {
  it('defaults to the converged small scale', () => {
    render(<FieldWrapper label="Owner">{<input aria-label="owner" />}</FieldWrapper>);
    expect(labelFor('Owner').className).toContain('text-h6');
    expect(labelFor('Owner').className).not.toContain('text-h4');
  });

  it('opts into the body scale on request', () => {
    render(
      <FieldWrapper label="Owner" labelVariant="large">
        {<input aria-label="owner" />}
      </FieldWrapper>,
    );
    expect(labelFor('Owner').className).toContain('text-h4');
  });
});

describe('labelVariant forwarding', () => {
  it('Select forwards it to FieldWrapper', () => {
    render(
      <Select>
        <SelectTrigger label="Region" labelVariant="large">
          <SelectValue placeholder="pick" />
        </SelectTrigger>
      </Select>,
    );
    expect(labelFor('Region').className).toContain('text-h4');
  });

  it('Select without it keeps the default scale', () => {
    render(
      <Select>
        <SelectTrigger label="Region">
          <SelectValue placeholder="pick" />
        </SelectTrigger>
      </Select>,
    );
    expect(labelFor('Region').className).toContain('text-h6');
    expect(labelFor('Region').className).not.toContain('text-h4');
  });

  it('Autocomplete forwards it to FieldWrapper', () => {
    render(<Autocomplete label="Vendor" labelVariant="large" options={OPTIONS} value={null} onChange={() => {}} />);
    expect(labelFor('Vendor').className).toContain('text-h4');
  });

  it('Autocomplete without it keeps the default scale', () => {
    render(<Autocomplete label="Vendor" options={OPTIONS} value={null} onChange={() => {}} />);
    expect(labelFor('Vendor').className).toContain('text-h6');
  });
});

describe('TabSelector label', () => {
  const items = [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
  ];

  it('renders its label through Label at the large scale, not a bare paragraph', () => {
    render(<TabSelector label="View" items={items} value="one" onValueChange={() => {}} />);
    const label = labelFor('View');
    // It used to be a hand-rolled `<p className="… text-h4">`. The point of the
    // move is that the scale now comes FROM Label, so a change there reaches
    // this too — hence asserting the element, not just the class.
    expect(label.tagName).toBe('LABEL');
    expect(label.className).toContain('text-h4');
  });

  it('omits the label element entirely when unlabelled', () => {
    render(<TabSelector items={items} value="one" onValueChange={() => {}} />);
    expect(screen.queryByText('View')).toBeNull();
  });
});
