import { useState, useRef, useEffect } from 'react';

export function Button({ variant = 'primary', block, type = 'button', children, ...props }) {
  const cls = `btn btn-${variant}${block ? ' btn-block' : ''}`;
  return <button type={type} className={cls} {...props}>{children}</button>;
}

export function Card({ children, style, ...props }) {
  return <div className="card" style={style} {...props}>{children}</div>;
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Textarea(props) {
  return <textarea className="textarea" {...props} />;
}

export function Select({ value, onChange, options = [], placeholder = 'Оберіть...', style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className="select-wrap" style={style}>
      <button type="button" className="select-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected ? selected.label : placeholder}</span>
        <span className="select-chevron">▾</span>
      </button>
      {open && (
        <div className="select-menu">
          {options.map((o) => (
            <div
              key={o.value}
              className={`select-option${String(o.value) === String(value) ? ' selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {children}
    </div>
  );
}

export function Modal({ onClose, title, children, width }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        {title && <h3 style={{ marginTop: 0 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}