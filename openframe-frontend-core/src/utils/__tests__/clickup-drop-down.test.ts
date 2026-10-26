import { describe, expect, it } from 'vitest';
import { clickUpDropDownOption } from '../clickup-drop-down';

const FIELD = 'team-field';
const options = (names: string[]) => names.map((name, i) => ({ id: `opt-${name.toLowerCase()}`, name, orderindex: i }));
const fields = (value: unknown, names = ['Platform', 'Product Engineering', 'Product']) => [
  { id: 'other', value: 1 },
  { id: FIELD, value, type_config: { options: options(names) } },
];

describe('clickUpDropDownOption', () => {
  it('maps the stored position to the chosen option', () => {
    expect(clickUpDropDownOption(fields(1), FIELD)).toEqual({
      id: 'opt-product engineering',
      name: 'Product Engineering',
    });
    expect(clickUpDropDownOption(fields(0), FIELD)).toEqual({ id: 'opt-platform', name: 'Platform' });
  });

  it('accepts the option id as the value', () => {
    expect(clickUpDropDownOption(fields('opt-product'), FIELD)).toEqual({ id: 'opt-product', name: 'Product' });
  });

  it('reads a position sent as a string', () => {
    expect(clickUpDropDownOption(fields('2'), FIELD)?.name).toBe('Product');
  });

  it('is null with no value, an unknown position, no such field or no fields', () => {
    expect(clickUpDropDownOption(fields(null), FIELD)).toBeNull();
    expect(clickUpDropDownOption(fields(''), FIELD)).toBeNull();
    expect(clickUpDropDownOption(fields(9), FIELD)).toBeNull();
    expect(clickUpDropDownOption([{ id: 'other', value: 0 }], FIELD)).toBeNull();
    expect(clickUpDropDownOption(null, FIELD)).toBeNull();
  });
});
