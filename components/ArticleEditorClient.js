"use client";

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

export default function ArticleEditorClient({ onReady, initial = "" }) {
  const [imageUrlInput, setImageUrlInput] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({ levels: [1, 2, 3] }),
      Link.configure({ openOnClick: false }),
      Image
    ],
    content: initial,
    editorProps: {
      attributes: { class: "prose max-w-none p-2 outline-none" }
    }
  });

  useEffect(() => {
    if (!onReady) return;
    const api = {
      getHTML: () => (editor ? editor.getHTML() : ""),
      getText: () => (editor ? editor.getText() : ""),
      focus: () => editor && editor.commands.focus(),
      setImage: url => editor && editor.chain().focus().setImage({ src: url }).run()
    };
    onReady(api);
  }, [editor, onReady]);

  if (!editor) {
    return <div className="min-h-[180px] border rounded-md bg-white p-3">Memuat editor…</div>;
  }

  return (
    <div className="border rounded-md bg-white">
      <div className="flex gap-2 items-center p-2 border-b bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 text-sm rounded hover:bg-gray-100">B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 text-sm rounded hover:bg-gray-100">i</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="px-2 py-1 text-sm rounded hover:bg-gray-100">H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="px-2 py-1 text-sm rounded hover:bg-gray-100">H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 text-sm rounded hover:bg-gray-100">• List</button>

        <button
          type="button"
          onClick={() => {
            const url = prompt("Masukkan URL gambar:");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          className="px-2 py-1 text-sm rounded hover:bg-gray-100"
        >
          Img
        </button>

        <button
          type="button"
          onClick={() => {
            const url = prompt("Masukkan URL link:");
            if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
          className="px-2 py-1 text-sm rounded hover:bg-gray-100"
        >
          Link
        </button>

        <div className="ml-auto text-xs text-gray-500">Tiptap</div>
      </div>

      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
