import React, { useCallback, useRef, useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, mergeAttributes } from "@tiptap/core";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { getApiBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading3, Heading4, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Image as ImageIcon, Highlighter, Undo2, Redo2,
  Quote, Pilcrow,
  BookOpen, AlertTriangle, TableIcon,
  Plus, ChevronUp, ChevronDown, Trash2, Pencil
} from "lucide-react";

function createCustomBlock(name: string, cssClass: string) {
  return Node.create({
    name,
    group: "block",
    content: "block+",
    defining: true,
    parseHTML() {
      return [{ tag: `div.${cssClass}` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { class: cssClass }), 0];
    },
  });
}

const ArabicCard = createCustomBlock("arabicCard", "arabic-card");
const InfoBox = createCustomBlock("infoBox", "info-box");
const InfoCard = createCustomBlock("infoCard", "info-card");

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

  let lastAccIdx = -1;
  for (let i = children.length - 1; i >= 0; i--) {
    if (children[i].classList.contains("lesson-accordion")) { lastAccIdx = i; break; }
  }
  let afterAccordions = "";
  for (let i = lastAccIdx + 1; i < children.length; i++) {
    afterAccordions += children[i].outerHTML;
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

function ToolSeparator() {
  return <div className="w-px h-6 bg-gray-200 mx-0.5" />;
}

const sectionStyles: Record<string, { bg: string; activeBg: string; icon: string }> = {
  story: { bg: "bg-amber-50 hover:bg-amber-100", activeBg: "bg-amber-200 ring-2 ring-amber-400", icon: "📖" },
  ilmihal: { bg: "bg-emerald-50 hover:bg-emerald-100", activeBg: "bg-emerald-200 ring-2 ring-emerald-400", icon: "📗" },
  quiz_box: { bg: "bg-blue-50 hover:bg-blue-100", activeBg: "bg-blue-200 ring-2 ring-blue-400", icon: "❓" },
  pitanja: { bg: "bg-purple-50 hover:bg-purple-100", activeBg: "bg-purple-200 ring-2 ring-purple-400", icon: "💬" },
  zadatak: { bg: "bg-orange-50 hover:bg-orange-100", activeBg: "bg-orange-200 ring-2 ring-orange-400", icon: "📝" },
  default: { bg: "bg-gray-50 hover:bg-gray-100", activeBg: "bg-gray-200 ring-2 ring-gray-400", icon: "📄" },
};

function getSectionStyle(sectionId: string) {
  const sid = sectionId.toUpperCase();
  if (sid === "STORY" || sid.includes("PRIČA") || sid.includes("PRICA") || sid.includes("PUTOKAZ")) return sectionStyles.story;
  if (sid === "ILMIHAL" || sid.includes("ILMIHAL")) return sectionStyles.ilmihal;
  if (sid === "QUIZ_BOX" || sid === "QUIZ" || sid === "KVIZ") return sectionStyles.quiz_box;
  if (sid.includes("PITAN") || sid.includes("RAZGOVOR")) return sectionStyles.pitanja;
  if (sid.includes("ZADATAK") || sid.includes("ZADACI") || sid.includes("AKTIVNOST")) return sectionStyles.zadatak;
  return sectionStyles.default;
}

const editorExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
  Image.configure({ inline: false, allowBase64: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  Highlight.configure({ multicolor: true }),
  Placeholder.configure({ placeholder: "Piši sadržaj sekcije..." }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  ArabicCard,
  InfoBox,
  InfoCard,
];

export function WysiwygEditor({ content, onChange, token }: WysiwygEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState(() => parseAccordionSections(content));
  const hasContainer = content.includes('class="lesson-container"');
  const sectionContentsRef = useRef<string[]>(parsed.sections.map(s => s.contentHtml));
  const [activeIdx, setActiveIdx] = useState(0);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const editor = useEditor({
    extensions: editorExtensions,
    content: parsed.hasAccordions ? parsed.sections[0]?.contentHtml || "" : content,
    onUpdate: ({ editor: ed }) => {
      if (switchingRef.current) return;
      const html = ed.getHTML();
      if (parsed.hasAccordions) {
        sectionContentsRef.current[activeIdxRef.current] = html;
      }
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
  });

  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;
  const switchingRef = useRef(false);

  const switchSection = useCallback((newIdx: number) => {
    if (!editor || !parsed.hasAccordions) return;
    if (newIdx === activeIdxRef.current) return;
    switchingRef.current = true;
    sectionContentsRef.current[activeIdxRef.current] = editor.getHTML();
    activeIdxRef.current = newIdx;
    setActiveIdx(newIdx);
    editor.commands.setContent(sectionContentsRef.current[newIdx] || "");
    switchingRef.current = false;
  }, [editor, parsed.hasAccordions]);

  const addSection = useCallback((afterIdx: number) => {
    if (!editor) return;
    sectionContentsRef.current[activeIdxRef.current] = editor.getHTML();
    const newId = `section-${Date.now()}`;
    const newSection: ParsedSection = {
      id: newId,
      title: "NOVA SEKCIJA",
      iconText: "▶",
      contentHtml: "<p></p>",
      isActive: false,
    };
    const insertAt = afterIdx + 1;
    setParsed(prev => {
      const newSections = [...prev.sections];
      newSections.splice(insertAt, 0, newSection);
      return { ...prev, sections: newSections };
    });
    sectionContentsRef.current.splice(insertAt, 0, "<p></p>");
    switchingRef.current = true;
    activeIdxRef.current = insertAt;
    setActiveIdx(insertAt);
    editor.commands.setContent("<p></p>");
    switchingRef.current = false;
    onChange("");
  }, [editor, onChange]);

  const removeSection = useCallback((idx: number) => {
    if (!editor) return;
    setParsed(prev => {
      if (prev.sections.length <= 1) return prev;
      const newSections = prev.sections.filter((_, i) => i !== idx);
      sectionContentsRef.current.splice(idx, 1);
      const newIdx = Math.min(idx, newSections.length - 1);
      switchingRef.current = true;
      activeIdxRef.current = newIdx;
      setActiveIdx(newIdx);
      editor.commands.setContent(sectionContentsRef.current[newIdx] || "");
      switchingRef.current = false;
      return { ...prev, sections: newSections };
    });
    onChange("");
  }, [editor, onChange]);

  const moveSection = useCallback((idx: number, dir: -1 | 1) => {
    if (!editor) return;
    setParsed(prev => {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.sections.length) return prev;
      sectionContentsRef.current[activeIdxRef.current] = editor.getHTML();
      const newSections = [...prev.sections];
      [newSections[idx], newSections[newIdx]] = [newSections[newIdx], newSections[idx]];
      const newContents = [...sectionContentsRef.current];
      [newContents[idx], newContents[newIdx]] = [newContents[newIdx], newContents[idx]];
      sectionContentsRef.current = newContents;
      const focusIdx = activeIdxRef.current === idx ? newIdx : activeIdxRef.current === newIdx ? idx : activeIdxRef.current;
      activeIdxRef.current = focusIdx;
      setActiveIdx(focusIdx);
      return { ...prev, sections: newSections };
    });
    onChange("");
  }, [editor, onChange]);

  const renameSection = useCallback((idx: number, newTitle: string) => {
    setParsed(prev => {
      const newSections = [...prev.sections];
      newSections[idx] = { ...newSections[idx], title: newTitle };
      return { ...prev, sections: newSections };
    });
    setRenamingIdx(null);
    onChange("");
  }, [onChange]);

  const getFullHtml = useCallback((): string => {
    if (!parsed.hasAccordions) return editor?.getHTML() || content;
    if (editor) {
      sectionContentsRef.current[activeIdxRef.current] = editor.getHTML();
    }
    const updatedSections = parsed.sections.map((s, i) => ({
      ...s,
      contentHtml: sectionContentsRef.current[i] ?? s.contentHtml,
    }));
    return reassembleHtml(parsed.beforeAccordions, updatedSections, parsed.afterAccordions, hasContainer);
  }, [editor, parsed, hasContainer, content]);

  useEffect(() => {
    (window as any).__wysiwygGetFullHtml = getFullHtml;
    return () => { delete (window as any).__wysiwygGetFullHtml; };
  }, [getFullHtml]);

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
      toast({ title: "Upload nije uspio", description: "Provjerite konekciju", variant: "destructive" });
    }
  }, [editor, token, toast]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  }, [handleImageUpload]);

  const insertCustomBlock = useCallback((type: "arabic-card" | "info-box" | "info-card") => {
    if (!editor) return;
    const nodeMap: Record<string, string> = { "arabic-card": "arabicCard", "info-box": "infoBox", "info-card": "infoCard" };
    const nodeName = nodeMap[type];
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().wrapIn(nodeName).run();
    } else {
      editor.chain().focus().insertContent({
        type: nodeName,
        content: [{ type: "paragraph" }],
      }).run();
    }
  }, [editor]);

  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ r: 0, c: 0 });

  const insertTable = useCallback((rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
    setShowTablePicker(false);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      {parsed.hasAccordions && (
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50/80">
          <div className="flex flex-wrap gap-1.5 items-center">
            {parsed.sections.map((sec, idx) => {
              const style = getSectionStyle(sec.id);
              const isActive = idx === activeIdx;
              return (
                <div key={sec.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => switchSection(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive ? style.activeBg : style.bg
                    }`}
                  >
                    <span>{style.icon}</span>
                    {renamingIdx === idx ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameSection(idx, renameValue)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameSection(idx, renameValue); if (e.key === "Escape") setRenamingIdx(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white border rounded px-1 py-0.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-teal-400"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate max-w-[150px]">{sec.title}</span>
                    )}
                  </button>
                  {isActive && (
                    <div className="flex items-center gap-0.5 ml-0.5">
                      <button type="button" onClick={() => moveSection(idx, -1)} disabled={idx === 0} title="Pomjeri gore" className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moveSection(idx, 1)} disabled={idx === parsed.sections.length - 1} title="Pomjeri dolje" className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => { setRenamingIdx(idx); setRenameValue(sec.title); }} title="Preimenuj" className="p-0.5 rounded hover:bg-gray-200"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => { if (confirm("Obrisati ovu sekciju?")) removeSection(idx); }} title="Obriši" className="p-0.5 rounded hover:bg-red-100 text-red-500" disabled={parsed.sections.length <= 1}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => addSection(parsed.sections.length - 1)}
              title="Dodaj novu sekciju"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Precrtano">
          <Strikethrough className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()} active={editor.isActive("highlight")} title="Markiraj">
          <Highlighter className="w-4 h-4" />
        </MenuButton>
        <ToolSeparator />
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="H3">
          <Heading3 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="H4">
          <Heading4 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraf">
          <Pilcrow className="w-4 h-4" />
        </MenuButton>
        <ToolSeparator />
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numerisana">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citat">
          <Quote className="w-4 h-4" />
        </MenuButton>
        <ToolSeparator />
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Lijevo">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centar">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Desno">
          <AlignRight className="w-4 h-4" />
        </MenuButton>
        <ToolSeparator />
        <MenuButton onClick={() => fileInputRef.current?.click()} title="Umetni sliku">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => insertCustomBlock("arabic-card")} title="Zeleni box — označi tekst pa klikni">
          <BookOpen className="w-4 h-4 text-emerald-600" />
        </MenuButton>
        <MenuButton onClick={() => insertCustomBlock("info-box")} title="Žuti box — označi tekst pa klikni">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </MenuButton>
        <MenuButton onClick={() => insertCustomBlock("info-card")} title="Crveni isprekidani box (ZAPAMTI)">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </MenuButton>
        <div className="relative">
          <MenuButton onClick={() => setShowTablePicker(!showTablePicker)} title="Umetni tabelu">
            <TableIcon className="w-4 h-4" />
          </MenuButton>
          {showTablePicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50">
              <div className="text-xs text-gray-500 text-center mb-1">{tableHover.r}×{tableHover.c}</div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
                {Array.from({ length: 36 }, (_, i) => {
                  const r = Math.floor(i / 6) + 1;
                  const c = (i % 6) + 1;
                  return (
                    <div
                      key={i}
                      className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                        r <= tableHover.r && c <= tableHover.c ? "bg-teal-400 border-teal-500" : "bg-gray-100 border-gray-200"
                      }`}
                      onMouseEnter={() => setTableHover({ r, c })}
                      onClick={() => insertTable(r, c)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <ToolSeparator />
        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Poništi">
          <Undo2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ponovi">
          <Redo2 className="w-4 h-4" />
        </MenuButton>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />

      <div className="flex-1 overflow-y-auto wysiwyg-editor-content">
        <style>{`
          .wysiwyg-editor-content .ProseMirror {
            min-height: 300px;
            padding: 1rem;
            font-family: 'Nunito', sans-serif;
            font-size: 1rem;
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
          .wysiwyg-editor-content .ProseMirror div.arabic-card {
            background: linear-gradient(135deg, #ecfdf5, #d1fae5);
            border-left: 4px solid #10b981;
            padding: 0.75rem 1rem;
            border-radius: 0.75rem;
            margin: 0.75rem 0;
          }
          .wysiwyg-editor-content .ProseMirror div.info-box {
            background: linear-gradient(135deg, #fefce8, #fef9c3);
            border-left: 4px solid #eab308;
            padding: 0.75rem 1rem;
            border-radius: 0.75rem;
            margin: 0.75rem 0;
          }
          .wysiwyg-editor-content .ProseMirror div.info-card {
            border: 2px dashed #e30a17;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            margin: 0.75rem 0;
          }
          .wysiwyg-editor-content .ProseMirror table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.75rem 0;
          }
          .wysiwyg-editor-content .ProseMirror td,
          .wysiwyg-editor-content .ProseMirror th {
            border: 1px solid #145234;
            padding: 5px 10px;
            min-width: 80px;
            vertical-align: top;
          }
          .wysiwyg-editor-content .ProseMirror th {
            background: #f0fdf4;
            font-weight: 700;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
