import { useRef, useState, type DragEvent } from 'react';

interface DropzoneProps {
  multiple?: boolean;
  hint?: string;
  onFiles: (files: File[]) => void;
}

export function Dropzone({ multiple, hint, onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
    >
      <div className="dz-icon">⬇</div>
      <div className="dz-title">Drop file{multiple ? 's' : ''} here, or click to browse</div>
      {hint && <div className="dz-hint">{hint}</div>}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="visually-hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
