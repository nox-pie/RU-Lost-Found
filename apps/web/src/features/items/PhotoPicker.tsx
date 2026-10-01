import { ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface PhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  maxBytes: number;
  error?: string;
}

/** Drag-and-drop or tap to add photos, with previews; checks type and size before upload. */
export function PhotoPicker({ files, onChange, max, maxBytes, error }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string>();
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function add(list: FileList | null) {
    if (!list) return;
    setProblem(undefined);
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!ACCEPTED.includes(file.type)) {
        setProblem(`${file.name} is not a JPEG, PNG or WebP image.`);
        continue;
      }
      if (file.size > maxBytes) {
        setProblem(`${file.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
        continue;
      }
      if (next.length >= max) {
        setProblem(`You can add up to ${max} photos.`);
        break;
      }
      next.push(file);
    }
    onChange(next);
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    add(event.dataTransfer.files);
  };

  const message = problem ?? error;

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-700">
        Photos <span className="font-normal text-gray-500">(1–{max}, required)</span>
      </p>
      <div className="grid grid-cols-3 gap-3">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="relative aspect-square overflow-hidden rounded-xl bg-gray-100"
          >
            <img
              src={previews[index]}
              alt={`Photo ${index + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-gray-700 shadow hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed text-xs text-gray-500 transition ${dragging ? 'border-primary bg-primary/5' : message ? 'border-red-300' : 'border-gray-300 hover:border-primary hover:text-primary'}`}
          >
            <ImagePlus className="mb-1 h-6 w-6" />
            Add photo
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        className="hidden"
        onChange={(event) => {
          add(event.target.files);
          event.target.value = '';
        }}
      />
      {message ? (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {message}
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG or WebP, up to {Math.round(maxBytes / 1024 / 1024)} MB each. Location data is
          removed from photos automatically.
        </p>
      )}
    </div>
  );
}
