import { useState } from "preact/hooks";

export default function SettingsSaveButton() {
  const [saving, setSaving] = useState(false);
  return (
    <button
      class="settings-save"
      type="submit"
      disabled={saving}
      onClick={() => setSaving(true)}
    >
      {saving ? "Saving…" : "Save settings"}
    </button>
  );
}
