// Searchable currency picker used for both the source and target selectors.
// Filters the codes from the cached rate table by ISO code or display name.
// Functional/near-unstyled — visual design lands in the Phase 6 sweep.

import { useMemo, useState } from 'react';
import { getCurrencyName } from '../shared/currencies';

interface Props {
  label: string;
  /** Currently selected ISO code. */
  value: string;
  /** All selectable ISO codes (keys of the cached rate table). */
  codes: string[];
  onChange: (code: string) => void;
}

export default function CurrencyCombobox({ label, value, codes, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => codes.map((code) => ({ code, name: getCurrencyName(code) })),
    [codes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      ({ code, name }) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q),
    );
  }, [options, query]);

  function select(code: string) {
    onChange(code);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="oc-combobox">
      <label>
        {label}
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          // Show the current selection when closed; the live query while searching.
          value={open ? query : `${value} — ${getCurrencyName(value)}`}
          placeholder="Search currency"
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setOpen(false)}
        />
      </label>
      {open && (
        <ul className="oc-combobox-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="oc-combobox-empty">No matches</li>
          ) : (
            filtered.map(({ code, name }) => (
              <li
                key={code}
                role="option"
                aria-selected={code === value}
                // mousedown fires before the input's blur; preventDefault keeps
                // focus so the click selects instead of just closing the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(code);
                }}
              >
                {code} — {name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
