// From-filter control: which SOURCE currencies on a page get rewritten. An empty
// list means "All". Unchecking "All currencies" restricts to a chosen set built
// via the combobox. Functional/near-unstyled — Phase 6 owns the visual design.

import CurrencyCombobox from './CurrencyCombobox';

interface Props {
  /** Chosen source codes; empty = All. */
  value: string[];
  /** All selectable ISO codes (keys of the cached rate table). */
  codes: string[];
  onChange: (list: string[]) => void;
}

export default function FromFilter({ value, codes, onChange }: Props) {
  const all = value.length === 0;

  return (
    <fieldset className="oc-from-filter">
      <legend>Convert page prices from</legend>
      <label className="oc-inline">
        <input
          type="checkbox"
          checked={all}
          // Leaving "All" seeds a starting list so the state isn't ambiguous;
          // removing the last chip flips back to All automatically.
          onChange={(e) => onChange(e.target.checked ? [] : ['USD'])}
        />
        All currencies
      </label>

      {!all && (
        <>
          <CurrencyCombobox
            label="Add source currency"
            value=""
            codes={codes.filter((c) => !value.includes(c))}
            onChange={(code) => {
              if (!value.includes(code)) onChange([...value, code]);
            }}
          />
          <ul className="oc-chips">
            {value.map((code) => (
              <li key={code}>
                {code}{' '}
                <button
                  type="button"
                  aria-label={`Remove ${code}`}
                  onClick={() => onChange(value.filter((c) => c !== code))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </fieldset>
  );
}
