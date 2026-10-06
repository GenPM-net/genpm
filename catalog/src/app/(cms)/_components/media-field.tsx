'use client';
// Campo `media` del panel: elegir de la biblioteca o subir un archivo nuevo (URL firmada de @core/storage).
import { useEffect, useId, useState } from 'react';
import type { FieldRendererProps } from '@/lib/admin/client';
import { Button, SelectField } from '@/lib/ui';

type Option = { value: string; label: string };

async function upload(file: File, alt: string): Promise<string> {
  const headers = { 'content-type': 'application/json', 'x-admin-request': '1' };
  const res = await fetch('/api/media/uploads', { method: 'POST', headers, body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size, alt }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'upload_failed');
  const { id, upload: u } = (await res.json()) as { id: string; upload: { url: string; method?: string; headers?: Record<string, string> } };
  const put = await fetch(u.url, { method: u.method ?? 'PUT', headers: u.headers ?? {}, body: file });
  if (!put.ok) throw new Error('upload_failed');
  const confirm = await fetch(`/api/media/uploads/${encodeURIComponent(id)}/confirm`, { method: 'POST', headers });
  if (!confirm.ok) throw new Error(((await confirm.json().catch(() => ({}))) as { error?: string }).error ?? 'rejected');
  return id;
}

export function MediaField(p: FieldRendererProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const fileId = useId();
  const altId = useId();
  const load = () =>
    p.api
      .list('media', { pageSize: 100 })
      .then((r) => setOptions(r.rows.map((m) => ({ value: m.id, label: m._title ?? m.id }))))
      .catch(() => setOptions([]));
  useEffect(() => {
    void load();
    // biome-ignore lint/correctness/useExhaustiveDependencies: carga inicial
  }, []);
  const value = typeof p.value === 'string' ? p.value : '';
  return (
    <fieldset className="ui-field admin-list">
      <legend className="ui-field__label">{p.field.label}</legend>
      <SelectField
        label="Library"
        options={options}
        placeholder={p.labels.selectPlaceholder}
        value={value}
        disabled={p.disabled || busy}
        onChange={(e) => p.onChange(e.currentTarget.value || null)}
        {...(p.error ? { error: p.error } : {})}
      />
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={altId}>
          Alt text for a new upload
        </label>
        <input id={altId} className="ui-input" value={alt} onChange={(e) => setAlt(e.currentTarget.value)} disabled={busy} />
      </div>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={fileId}>
          Upload a new file
        </label>
        <input
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
          disabled={p.disabled || busy}
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              const id = await upload(file, alt);
              await load();
              p.onChange(id);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'upload_failed');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {busy && <p role="status">Uploading…</p>}
      {error && (
        <p className="ui-field__error" role="alert">
          Upload failed ({error}).
        </p>
      )}
      {value && (
        <Button size="sm" onClick={() => p.onChange(null)} disabled={p.disabled || busy}>
          Remove image
        </Button>
      )}
    </fieldset>
  );
}
