import React, { useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { getApiBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading2, Heading3, Heading4, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Image as ImageIcon, Highlighter, Undo2, Redo2,
  Quote, Minus, Pilcrow,
  BookOpen, AlertTriangle
} from "lucide-react";

interface WysiwygEditorProps {
  content: string;
  onChange: (html: string) => void;
  token: string;
}

function MenuButton({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active ? "bg-teal-100 text-teal-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-gray-200 mx-0.5" />;
}

export function WysiwygEditor({ content, onChange, token }: WysiwygEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Počnite pisati sadržaj lekcije..." }),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4",
      },
    },
  });

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const resp = await fetch(`${getApiBase()}/admin/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Greška pri uploadu", description: data.error || "Nepoznata greška", variant: "destructive" });
        return;
      }
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (e) {
      toast({ title: "Upload nije uspio", description: "Provjerite konekciju i pokušajte ponovo", variant: "destructive" });
    }
  }, [editor, token, toast]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  }, [handleImageUpload]);

  const insertCustomBlock = useCallback((type: "arabic-card" | "info-box") => {
    if (!editor) return;
    const label = type === "arabic-card" ? "Ajet / Hadis tekst ovdje..." : "ZAPAMTI: Važna informacija ovdje...";
    const html = `<div class="${type}"><p>${label}</p></div><p></p>`;
    editor.chain().focus().insertContent(html).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Precrtano">
          <Strikethrough className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()} active={editor.isActive("highlight")} title="Markiraj žutom">
          <Highlighter className="w-4 h-4" />
        </MenuButton>

        <Separator />

        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Naslov H2">
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Naslov H3">
          <Heading3 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="Naslov H4">
          <Heading4 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraf">
          <Pilcrow className="w-4 h-4" />
        </MenuButton>

        <Separator />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Nabrajanje">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numerisana lista">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citat">
          <Quote className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontalna linija">
          <Minus className="w-4 h-4" />
        </MenuButton>

        <Separator />

        <MenuButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Lijevo">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centrirano">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Desno (za arapski tekst)">
          <AlignRight className="w-4 h-4" />
        </MenuButton>

        <Separator />

        <MenuButton onClick={() => fileInputRef.current?.click()} title="Umetni sliku">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>

        <Separator />

        <MenuButton onClick={() => insertCustomBlock("arabic-card")} title="Zeleni box (ajet/hadis)">
          <BookOpen className="w-4 h-4 text-emerald-600" />
        </MenuButton>
        <MenuButton onClick={() => insertCustomBlock("info-box")} title="Žuti box (ZAPAMTI)">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </MenuButton>

        <Separator />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Poništi (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ponovi (Ctrl+Y)">
          <Redo2 className="w-4 h-4" />
        </MenuButton>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />

      <div className="flex-1 overflow-y-auto wysiwyg-editor-content">
        <style>{`
          .wysiwyg-editor-content .ProseMirror {
            min-height: 400px;
            padding: 1rem;
            font-family: 'Nunito', sans-serif;
            font-size: 0.95rem;
            line-height: 1.75;
          }
          .wysiwyg-editor-content .ProseMirror:focus {
            outline: none;
          }
          .wysiwyg-editor-content .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: #adb5bd;
            pointer-events: none;
            height: 0;
          }
          .wysiwyg-editor-content .ProseMirror h2 { font-size: 1.4rem; font-weight: 800; margin: 1.5rem 0 0.75rem; color: #0d9488; }
          .wysiwyg-editor-content .ProseMirror h3 { font-size: 1.2rem; font-weight: 700; margin: 1.25rem 0 0.5rem; color: #1a1a1a; }
          .wysiwyg-editor-content .ProseMirror h4 { font-size: 1.05rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #374151; }
          .wysiwyg-editor-content .ProseMirror ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
          .wysiwyg-editor-content .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
          .wysiwyg-editor-content .ProseMirror li { margin: 0.25rem 0; }
          .wysiwyg-editor-content .ProseMirror blockquote {
            border-left: 4px solid #0d9488;
            padding-left: 1rem;
            margin: 0.75rem 0;
            color: #4b5563;
            font-style: italic;
          }
          .wysiwyg-editor-content .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: 0.75rem;
            margin: 0.75rem 0;
          }
          .wysiwyg-editor-content .ProseMirror mark {
            background-color: #fef08a;
            padding: 0.1em 0.2em;
            border-radius: 0.2em;
          }
          .wysiwyg-editor-content .ProseMirror hr {
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 1.5rem 0;
          }
          .wysiwyg-editor-content .ProseMirror .arabic-card {
            background: linear-gradient(135deg, #ecfdf5, #d1fae5);
            border-left: 4px solid #10b981;
            padding: 0.75rem 1rem;
            border-radius: 0.75rem;
            margin: 0.75rem 0;
          }
          .wysiwyg-editor-content .ProseMirror .info-box {
            background: linear-gradient(135deg, #fefce8, #fef9c3);
            border-left: 4px solid #eab308;
            padding: 0.75rem 1rem;
            border-radius: 0.75rem;
            margin: 0.75rem 0;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
