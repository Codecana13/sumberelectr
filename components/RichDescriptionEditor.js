// Dark mode rich text editor for description, like your reference image
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import TextAlign from '@tiptap/extension-text-align';
import Bold from '@tiptap/extension-bold';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';

import ListItem from '@tiptap/extension-list-item';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';

export default function RichDescriptionEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({ levels: [1, 2, 3] }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Bold,
      Underline,
      Strike,
      Link,
      ListItem,
      BulletList,
      OrderedList,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[200px] bg-[#181a20] text-white outline-none px-4 py-3 text-base rounded-b border border-[#36383f] focus:outline-none',
      },
    },
  });

  return (
    <div className="w-full">
      <div className="rounded-t border border-b-0 border-[#36383f] bg-[#181a20] px-2 py-1 flex items-center gap-1 text-gray-200">
        <select
          className="bg-transparent text-gray-300 text-sm border-none focus:ring-0 px-1"
          onChange={e => {
            const level = Number(e.target.value);
            if (level === 0) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level }).run();
          }}
          value={
            editor?.isActive('heading', { level: 1 }) ? '1' :
            editor?.isActive('heading', { level: 2 }) ? '2' :
            editor?.isActive('heading', { level: 3 }) ? '3' : '0'
          }
        >
          <option value="0">Normal</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
        </select>
        <button type="button" className={`px-1 ${editor?.isActive('bold') ? 'text-purple-400' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" className={`px-1 ${editor?.isActive('italic') ? 'text-purple-400' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" className={`px-1 ${editor?.isActive('underline') ? 'text-purple-400' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
        <button type="button" className={`px-1 ${editor?.isActive('strike') ? 'text-purple-400' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
        <button type="button" className={`px-1 ${editor?.isActive('bulletList') ? 'text-purple-400' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={`px-1 ${editor?.isActive('orderedList') ? 'text-purple-400' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className="px-1" onClick={() => {
          const url = window.prompt('Insert link');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}>🔗</button>
        <button type="button" className="px-1" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Tx</button>
        <button type="button" className="px-1" onClick={() => editor.chain().focus().setTextAlign('left').run()}>⇤</button>
        <button type="button" className="px-1" onClick={() => editor.chain().focus().setTextAlign('center').run()}>⎯</button>
        <button type="button" className="px-1" onClick={() => editor.chain().focus().setTextAlign('right').run()}>⇥</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}