import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FieldValueSkeleton } from '../field-value-skeleton';
import { Input } from '../input';
import { InputTrigger } from '../input-trigger';
import { LoadingScope } from '../loading-scope';
import { Select, SelectTrigger, SelectValue } from '../select';
import { TAGS_INPUT_CLASS, TAGS_INPUT_ROW_CLASS, TagsInput, TagsInputSkeleton } from '../tags-input';
import { TEXTAREA_BOX_CLASS, Textarea, textareaBoxHeight } from '../textarea';

/** Every class a constant names, as a rendered markup's `class` tokens. */
const classTokensOf = (markup: string) =>
  new Set([...markup.matchAll(/class="([^"]*)"/g)].flatMap(([, classes]) => classes.split(' ')));
const expectClasses = (markup: string, constant: string) => {
  const tokens = classTokensOf(markup);
  for (const cls of constant.split(' ')) expect(tokens).toContain(cls);
};

describe('Textarea loading form', () => {
  it('is the textarea’s own box, at the height its rows take', () => {
    render(<Textarea rows={3} />);
    for (const cls of TEXTAREA_BOX_CLASS.split(' ')) expect(screen.getByRole('textbox')).toHaveClass(cls);
    const loading = renderToStaticMarkup(
      <LoadingScope>
        <Textarea rows={3} />
      </LoadingScope>,
    );
    expectClasses(loading, TEXTAREA_BOX_CLASS);
    expect(loading).toContain(`height:${textareaBoxHeight(3)}`);
    expect(loading).toContain('aria-hidden="true"');
  });

  it('takes the browser’s default two rows when none are named', () => {
    expect(
      renderToStaticMarkup(
        <LoadingScope>
          <Textarea />
        </LoadingScope>,
      ),
    ).toContain(`height:${textareaBoxHeight(2)}`);
  });
});

describe('TagsInputSkeleton', () => {
  it('draws the field’s layout with its label and an inert Add button for real', () => {
    render(<TagsInputSkeleton label="Specialties" maxTags={10} />);
    expect(screen.getByText('Specialties')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shares the loaded field’s layout', () => {
    const loaded = renderToStaticMarkup(<TagsInput label="Specialties" value={[]} onChange={() => {}} />);
    const loading = renderToStaticMarkup(<TagsInputSkeleton label="Specialties" />);
    for (const markup of [loaded, loading]) {
      const tokens = classTokensOf(markup);
      for (const cls of `${TAGS_INPUT_CLASS} ${TAGS_INPUT_ROW_CLASS}`.split(' ')) expect(tokens).toContain(cls);
    }
  });

  it('draws the count line only when the field has a limit', () => {
    const withLimit = renderToStaticMarkup(<TagsInputSkeleton label="Tags" maxTags={10} />);
    const without = renderToStaticMarkup(<TagsInputSkeleton label="Tags" />);
    const bars = (markup: string) => markup.split('aria-hidden="true"').length - 1;
    expect(bars(withLimit)).toBeGreaterThan(bars(without));
  });
});

describe('FieldValueSkeleton', () => {
  const bar = renderToStaticMarkup(<FieldValueSkeleton />);

  it.each([
    ['Input', <Input key="input" label="Name" defaultValue="Ada" />],
    [
      'SelectTrigger',
      <Select key="select" value="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
      </Select>,
    ],
    ['InputTrigger', <InputTrigger key="trigger" selectedLabel="Ada" />],
  ])('is the value %s draws in a loading scope, never its value', (_name, field) => {
    const loaded = renderToStaticMarkup(field);
    const loading = renderToStaticMarkup(<LoadingScope>{field}</LoadingScope>);
    expect(loaded).not.toContain(bar);
    expect(loading).toContain(bar);
  });
});
