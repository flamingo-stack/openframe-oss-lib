/**
 * The design system's required-field mark: an accent asterisk after the label.
 * `aria-hidden` on purpose — the CONTROL carries `required`/`aria-required` for
 * assistive tech; the star is only the visual. ONE owner, used by `Field`,
 * `FieldWrapper` and every form that marks its own labels.
 */
export function RequiredMark() {
  return (
    <span aria-hidden className="text-ods-accent">
      *
    </span>
  );
}
