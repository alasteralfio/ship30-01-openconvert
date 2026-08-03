// Formatting controls: precision (decimal places) and the number-format picker,
// applied to converted output in both the popup and the page.

import type { Settings } from '../shared/storage';
import { FORMAT_LABELS } from '../shared/format';
import type { NumberFormat } from '../shared/format';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const PRECISIONS = [0, 1, 2, 3, 4];
const FORMATS = Object.keys(FORMAT_LABELS) as NumberFormat[];

export default function FormatSettings({ settings, onChange }: Props) {
  return (
    <fieldset className="oc-format">
      <legend>Number formatting</legend>

      <label>
        Decimal places
        <select
          value={settings.precision}
          onChange={(e) => onChange({ precision: Number(e.target.value) })}
        >
          {PRECISIONS.map((p) => (
            <option key={p} value={p}>
              {p === 0 ? 'Nearest whole (0)' : p}
            </option>
          ))}
        </select>
      </label>

      <label>
        Number format
        <select
          value={settings.numberFormat}
          onChange={(e) => onChange({ numberFormat: e.target.value as NumberFormat })}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
