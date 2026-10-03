import { Camera, ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Spinner } from '../../components/ui/Spinner';
import { UPLOADABLE_TYPES, prepareImage } from '../../lib/images';

/** Phones and tablets: offer the camera directly. */
const hasTouchScreen = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

interface PhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  maxBytes: number;
  error?: string;
}

/**
 * Drag-and-drop, choose or (on phones) take photos, with previews. Each photo is shrunk on the
 * device first (see prepareImage), then checked against the size limit.
 */
export function PhotoPicker({ files, onChange, max, maxBytes, error }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const canCapture = useMemo(hasTouchScreen, []);
  const [problem, setProblem] = useState<string>();
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function add(list: FileList | null) {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;
    setProblem(undefined);
    setPreparing(true);
    const next = [...files];
    try {
      for (const file of incoming) {
        if (next.length >= max) {
          setProblem(`You can add up to ${max} photos.`);
          break;
        }
        const prepared = await prepareImage(file);
        if (!prepared) {
          setProblem(`${file.name} can't be read as a photo. Use a JPEG, PNG or WebP image.`);
          continue;
        }
        if (prepared.size > maxBytes) {
          setProblem(`${file.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
          continue;
        }
        next.push(prepared);
      }
    } finally {
      setPreparing(false);
    }
    onChange(next);
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void add(event.dataTransfer.files);
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
        {preparing && (
          <div
            className="flex aspect-square flex-col items-center justify-center rounded-xl bg-gray-50 text-xs text-gray-500"
            role="status"
          >
            <Spinner className="mb-1 h-5 w-5 text-primary" />
            Preparing…
          </div>
        )}
        {files.length < max && !preparing && canCapture && (
          <button
            type="button"
            onClick={() => camera.current?.click()}
            className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed text-xs text-gray-500 transition ${message ? 'border-red-300' : 'border-gray-300 hover:border-primary hover:text-primary'}`}
          >
            <Camera className="mb-1 h-6 w-6" />
            Take photo
          </button>
        )}
        {files.length < max && !preparing && (
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
            {canCapture ? 'Choose photo' : 'Add photo'}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={UPLOADABLE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(event) => {
          void add(event.target.files);
          event.target.value = '';
        }}
      />
      {canCapture && (
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            void add(event.target.files);
            event.target.value = '';
          }}
        />
      )}
      {message ? (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {message}
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG or WebP. Large photos are made smaller on your device before upload, and
          location data is removed.
        </p>
      )}
    </div>
  );
}
