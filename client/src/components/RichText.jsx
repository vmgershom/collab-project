import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';

const modules = {
  toolbar: [
    [{ size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};
const formats = ['size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'list', 'bullet', 'link'];

export function isEmptyRich(html) {
  if (!html) return true;
  const text = html.replace(/<(.|\n)*?>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text === '';
}

export function RichTextEditor({ value, onChange, placeholder }) {
  const handle = (html) => onChange(isEmptyRich(html) ? '' : html);
  return (
    <ReactQuill theme="snow" value={value || ''} onChange={handle} modules={modules} formats={formats} placeholder={placeholder} />
  );
}

export function RichTextView({ html, style }) {
  if (isEmptyRich(html)) return null;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'span', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
  });
  return <div className="rich-view ql-editor" style={style} dangerouslySetInnerHTML={{ __html: clean }} />;
}