// Searchable currency picker, used for both the source and target. An MUI Autocomplete
// over the cached table's codes, matching on ISO code or name, with the same
// onChange(code) shape everywhere it's used.
//
// Focusing the field clears it so you can start typing a search right away; if you don't
// pick anything, blurring puts the current selection back. We get that by controlling
// `inputValue`: empty while focused (unless you've typed), otherwise the option's label.

import { useMemo, useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { getCurrencyName } from '../shared/currencies';

interface Option {
  code: string;
  name: string;
}

interface Props {
  label: string;
  /** Currently selected ISO code, or '' for an empty picker (e.g. "add currency"). */
  value: string;
  /** All selectable ISO codes (keys of the cached rate table). */
  codes: string[];
  onChange: (code: string) => void;
  /** Clear the field after a pick (used by the "add currency" pickers). */
  clearOnSelect?: boolean;
  /** Show a favourite star on each dropdown row. It doesn't save anywhere yet — this is
   *  just the look of the pinning feature. */
  showFavourite?: boolean;
}

export default function CurrencyCombobox({
  label,
  value,
  codes,
  onChange,
  clearOnSelect = false,
  showFavourite = false,
}: Props) {
  // Which codes are starred. Lives only for as long as the popup is open.
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const toggleFavourite = (e: MouseEvent, code: string) => {
    // Keep focus + stop the row's select handler from firing.
    e.preventDefault();
    e.stopPropagation();
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };
  const options = useMemo<Option[]>(
    () => codes.map((code) => ({ code, name: getCurrencyName(code) })),
    [codes],
  );

  const selected = clearOnSelect ? null : (options.find((o) => o.code === value) ?? null);
  const selectedLabel = selected ? `${selected.code} — ${selected.name}` : '';

  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  // Blank while focused (clear so the user can type); restore the selection on blur.
  const inputValue = focused ? (typed ?? '') : selectedLabel;

  return (
    <Autocomplete<Option, false, boolean, false>
      options={options}
      value={selected}
      autoHighlight
      openOnFocus
      selectOnFocus={false}
      blurOnSelect
      disableClearable={!clearOnSelect}
      inputValue={inputValue}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') setTyped(val);
      }}
      getOptionLabel={(o) => `${o.code} — ${o.name}`}
      isOptionEqualToValue={(o, v) => o.code === v.code}
      onChange={(_, option) => {
        if (option) onChange(option.code);
        setTyped(null);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Search currency"
          inputProps={{
            ...params.inputProps,
            onFocus: (e: FocusEvent<HTMLInputElement>) => {
              params.inputProps.onFocus?.(e);
              setFocused(true);
              setTyped(null);
            },
            onBlur: (e: FocusEvent<HTMLInputElement>) => {
              params.inputProps.onBlur?.(e);
              setFocused(false);
              setTyped(null);
            },
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.code} style={{ ...props.style, display: 'flex' }}>
          <strong style={{ marginRight: 6 }}>{option.code}</strong>
          <span style={{ flex: 1 }}>{option.name}</span>
          {showFavourite && (
            <IconButton
              size="small"
              edge="end"
              aria-label={
                favourites.has(option.code)
                  ? `Unfavourite ${option.code}`
                  : `Favourite ${option.code}`
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => toggleFavourite(e, option.code)}
            >
              {favourites.has(option.code) ? (
                <StarIcon fontSize="small" color="warning" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </li>
      )}
    />
  );
}
