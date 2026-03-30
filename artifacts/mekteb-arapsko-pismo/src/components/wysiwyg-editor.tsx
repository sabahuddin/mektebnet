import React, { useCallback, useRef, useState, useEffect } from "react";
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
  BookOpen, AlertTriangle, ChevronDown, Plus, Trash2, GripVertical
} from "lucide-react";

interface ParsedSection {
  id: string;
  title: string;
  iconText: string;
  contentHtml: string;
  isActive: boolean;
}

function parseAccordionSections(fullHtml: string): { beforeAccordions: string; sections: ParsedSection[]; afterAccordions: string; hasAccordions: boolean } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const accordions = doc.querySelectorAll(".lesson-accordion");

  if (accordions.length === 0) {
    return { beforeAccordions: fullHtml, sections: [], afterAccordions: "", hasAccordions: false };
  }

  const container = doc.querySelector(".lesson-container") || doc.body;
  let beforeAccordions = "";
  const children = Array.from(container.children);
  for (const child of children) {
    if (child.classList.contains("lesson-accordion")) break;
    beforeAccordions += child.outerHTML;
  }

  let afterAccordions = "";
  let pastLastAccordion = false;
  for (let i = children.length - 1; i >= 0; i--) {
    if (children[i].classList.contains("lesson-accordion")) {
      pastLastAccordion = true;
      break;
    }
  }
  if (pastLastAccordion) {
    let foundLast = false;
    for (const child of children) {
      if (foundLast) afterAccordions += child.outerHTML;
      if (child.classList.contains("lesson-accordion")) foundLast = false;
    }
    let lastAccIdx = -1;
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i].classList.contains("lesson-accordion")) { lastAccIdx = i; break; }
    }
    afterAccordions = "";
    for (let i = lastAccIdx + 1; i < children.length; i++) {
      afterAccordions += children[i].outerHTML;
    }
  }

  const sections: ParsedSection[] = [];
  accordions.forEach(acc => {
    const btn = acc.querySelector(".lesson-section-btn");
    if (!btn) return;

    const onclickAttr = btn.getAttribute("onclick") || "";
    const idMatch = onclickAttr.match(/toggleSection\('([^']+)'/);
    const sectionId = idMatch ? idMatch[1] : `section-${sections.length}`;

    const iconSpan = btn.querySelector(".section-icon");
    const iconText = iconSpan?.textContent || "▶";
    const clonedBtn = btn.cloneNode(true) as HTMLElement;
    const clonedIcon = clonedBtn.querySelector(".section-icon");
    if (clonedIcon) clonedIcon.remove();
    const title = clonedBtn.textContent?.trim() || sectionId;

    const contentDiv = acc.querySelector(".lesson-content");
    const contentHtml = contentDiv ? contentDiv.innerHTML.trim() : "";
    const isActive = contentDiv?.classList.contains("active") || contentDiv?.getAttribute("style")?.includes("display: block") || false;

    sections.push({ id: sectionId, title, iconText, contentHtml, isActive });
  });

  return { beforeAccordions, sections, afterAccordions, hasAccordions: true };
}

function reassembleHtml(beforeAccordions: string, sections: ParsedSection[], afterAccordions: string, hasContainer: boolean): string {
  let html = "";
  if (hasContainer) html += '<div class="lesson-container">\n';
  html += beforeAccordions + "\n";

  for (const sec of sections) {
    const activeClass = sec.isActive ? " active" : "";
    const activeStyle = sec.isActive ? ' style="display: block;"' : "";
    html += `    <div class="lesson-accordion">\n`;
    html += `        <button class="lesson-section-btn" onclick="toggleSection('${sec.id}', this)">${sec.title} <span class="section-icon">${sec.iconText}</span></button>\n`;
    html += `        <div id="${sec.id}" class="lesson-content${activeClass}"${activeStyle}>\n`;
    html += `            ${sec.contentHtml}\n`;
    html += `        </div>\n`;
    html += `    </div>\n`;
  }

  html += afterAccordions;
  if (hasContainer) html += "</div>";
  return html;
}

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

const sectionTypeColors: Record<string, { bg: string; border: string; icon: string }> = {
  story: { bg: "bg-amber-50", border: "border-amber-300", icon: "📖" },
  ilmihal: { bg: "bg-emerald-50", border: "border-emerald-300", icon: "📗" },
  quiz_box: { bg: "bg-blue-50", border: "border-blue-300", icon: "❓" },
  pitanja: { bg: "bg-purple-50", border: "border-purple-300", icon: "💬" },
  zadatak: { bg: "bg-orange-50", border: "border-orange-300", icon: "📝" },
  default: { bg: "bg-gray-50", border: "border-gray-300", icon: "📄" },
};

function getSectionStyle(sectionId: string) {
  const sid = sectionId.toUpperCase();
  if (sid === "STORY" || sid.includes("PRIČA") || sid.includes("PRICA") || sid.includes("PUTOKAZ")) return sectionTypeColors.story;
  if (sid === "ILMIHAL" || sid.includes("ILMIHAL")) return sectionTypeColors.ilmihal;
  if (sid === "QUIZ_BOX" || sid === "QUIZ" || sid === "KVIZ") return sectionTypeColors.quiz_box;
  if (sid.includes("PITAN") || sid.includes("RAZGOVOR")) return sectionTypeColors.pitanja;
  if (sid.includes("ZADATAK") || sid.includes("ZADACI") || sid.includes("AKTIVNOST")) return sectionTypeColors.zadatak;
  return sectionTypeColors.default;
}

function SectionEditor({ section, token, onContentChange }: {
  section: ParsedSection;
  token: string;
  onContentChange: (html: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Piši sadržaj sekcije..." }),
    ],
    content: section.contentHtml,
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
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
    } catch {
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
    const blockHtml = `<div class="${type}"><p>${label}</p></div><p></p>`;
    editor.chain().focus().insertContent(blockHtml).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50/80 rounded-t-lg">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Precrtano">
          <Strikethrough className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()} active={editor.isActive("highlight")} title="Markiraj">
          <Highlighter className="w-3.5 h-3.5" />
        </MenuButton>
        <Separator />
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="H3">
          <Heading3 className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="H4">
          <Heading4 className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraf">
          <Pilcrow className="w-3.5 h-3.5" />
        </MenuButton>
        <Separator />
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista">
          <List className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numerisana">
          <ListOrdered className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citat">
          <Quote className="w-3.5 h-3.5" />
        </MenuButton>
        <Separator />
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Lijevo">
          <AlignLeft className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centar">
          <AlignCenter className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Desno">
          <AlignRight className="w-3.5 h-3.5" />
        </MenuButton>
        <Separator />
        <MenuButton onClick={() => fileInputRef.current?.click()} title="Slika">
          <ImageIcon className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => insertCustomBlock("arabic-card")} title="Zeleni box (ajet/hadis)">
          <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
        </MenuButton>
        <MenuButton onClick={() => insertCustomBlock("info-box")} title="Žuti box (ZAPAMTI)">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        </MenuButton>
        <Separator />
        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Poništi">
          <Undo2 className="w-3.5 h-3.5" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ponovi">
          <Redo2 className="w-3.5 h-3.5" />
        </MenuButton>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />

      <div className="wysiwyg-editor-content">
        <style>{`
          .wysiwyg-editor-content .ProseMirror {
            min-height: 200px;
            padding: 1rem;
            font-family: 'Nunito', sans-serif;
            font-size: 0.95rem;
            line-height: 1.75;
          }
          .wysiwyg-editor-content .ProseMirror:focus { outline: none; }
          .wysiwyg-editor-content .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left; color: #adb5bd; pointer-events: none; height: 0;
          }
          .wysiwyg-editor-content .ProseMirror h2 { font-size: 1.4rem; font-weight: 800; margin: 1.5rem 0 0.75rem; color: #0d9488; }
          .wysiwyg-editor-content .ProseMirror h3 { font-size: 1.2rem; font-weight: 700; margin: 1.25rem 0 0.5rem; color: #1a1a1a; }
          .wysiwyg-editor-content .ProseMirror h4 { font-size: 1.05rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #374151; }
          .wysiwyg-editor-content .ProseMirror ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
          .wysiwyg-editor-content .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
          .wysiwyg-editor-content .ProseMirror li { margin: 0.25rem 0; }
          .wysiwyg-editor-content .ProseMirror blockquote { border-left: 4px solid #0d9488; padding-left: 1rem; margin: 0.75rem 0; color: #4b5563; font-style: italic; }
          .wysiwyg-editor-content .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.75rem; margin: 0.75rem 0; }
          .wysiwyg-editor-content .ProseMirror mark { background-color: #fef08a; padding: 0.1em 0.2em; border-radius: 0.2em; }
          .wysiwyg-editor-content .ProseMirror hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.5rem 0; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function WysiwygEditor({ content, onChange, token }: WysiwygEditorProps) {
  const [parsed, setParsed] = useState(() => parseAccordionSections(content));
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set([0]));
  const sectionsRef = useRef(parsed.sections.map(s => s.contentHtml));

  useEffect(() => {
    sectionsRef.current = parsed.sections.map(s => s.contentHtml);
  }, []);

  const hasContainer = content.includes('class="lesson-container"');

  const handleSectionContentChange = useCallback((index: number, newHtml: string) => {
    sectionsRef.current[index] = newHtml;
    const updated = { ...parsed };
    updated.sections = updated.sections.map((s, i) =>
      i === index ? { ...s, contentHtml: newHtml } : s
    );
    const fullHtml = reassembleHtml(updated.beforeAccordions, updated.sections, updated.afterAccordions, hasContainer);
    onChange(fullHtml);
  }, [parsed, hasContainer, onChange]);

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!parsed.hasAccordions) {
    return (
      <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-white">
        <SectionEditor
          section={{ id: "full", title: "Sadržaj", iconText: "▶", contentHtml: content, isActive: true }}
          token={token}
          onContentChange={(html) => onChange(html)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50/50 p-3 gap-3">
      {parsed.sections.map((section, idx) => {
        const style = getSectionStyle(section.id);
        const isExpanded = expandedSections.has(idx);
        return (
          <div key={section.id} className={`border ${style.border} rounded-xl overflow-hidden bg-white shadow-sm`}>
            <button
              type="button"
              onClick={() => toggleSection(idx)}
              className={`w-full flex items-center gap-2 px-4 py-3 ${style.bg} text-left transition-colors hover:brightness-95`}
            >
              <span className="text-lg">{style.icon}</span>
              <span className="font-bold text-sm text-gray-800 flex-1">{section.title}</span>
              <span className="text-xs text-gray-500 font-mono">#{section.id}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>
            {isExpanded && (
              <SectionEditor
                section={section}
                token={token}
                onContentChange={(html) => handleSectionContentChange(idx, html)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
