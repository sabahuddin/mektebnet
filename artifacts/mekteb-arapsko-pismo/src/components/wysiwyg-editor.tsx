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
  Plus, ChevronUp, ChevronDown, Trash2, Pencil,
  Maximize, RectangleHorizontal, Square, Loader2,
  FolderOpen, X, Copy, Check, FileText, Minus
} from "lucide-react";
import { parsePripremaContent, renderPripremaContent, type PripremaStruct } from "@/lib/priprema-design";

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-align": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-align"),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs["data-align"]) return {};
          return { "data-align": attrs["data-align"] };
        },
      },
      "data-size": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-size"),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs["data-size"]) return {};
          return { "data-size": attrs["data-size"] };
        },
      },
    };
  },
});

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
  isPriprema?: boolean;
}

function parseAccordionSections(fullHtml: string): { beforeAccordions: string; sections: ParsedSection[]; afterAccordions: string; hasAccordions: boolean } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const accordions = doc.querySelectorAll(".lesson-accordion");

  if (accordions.length === 0) {
    return { beforeAccordions: fullHtml, sections: [], afterAccordions: "", hasAccordions: false };
  }

  // Sektori mogu biti DIREKTNA djeca containera, ALI mogu biti i ugnijezdjeni
  // u wrapper div-ovima (legacy HTML). Koristimo "host child" — najbliži predak
  // accordion-a koji je direktno dijete containera. Sve hostove brišemo iz
  // before/after — accordioni se emit-uju fresh u reassembleHtml.
  const container = (doc.querySelector(".lesson-container") || doc.body) as HTMLElement;
  const findHostChild = (descendant: Element): Element | null => {
    let node: Node | null = descendant;
    while (node && node.parentNode !== container) node = node.parentNode;
    return node as Element | null;
  };

  const children = Array.from(container.children);
  const accHostIndices = new Set<number>();
  accordions.forEach(acc => {
    const host = findHostChild(acc);
    if (host) {
      const idx = children.indexOf(host);
      if (idx >= 0) accHostIndices.add(idx);
    }
  });

  const sortedHostIdx = Array.from(accHostIndices).sort((a, b) => a - b);
  const firstHostIdx = sortedHostIdx[0] ?? children.length;
  const lastHostIdx = sortedHostIdx[sortedHostIdx.length - 1] ?? -1;

  let beforeAccordions = "";
  for (let i = 0; i < firstHostIdx; i++) {
    beforeAccordions += children[i].outerHTML;
  }
  let afterAccordions = "";
  for (let i = lastHostIdx + 1; i < children.length; i++) {
    // Preskoči host indekse koji se mogu naći između (rijetko, ali za svaki slučaj)
    if (accHostIndices.has(i)) continue;
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
    // KRITIČNO: ako je HTML nepravilno zatvoren, browser ugnijezdi sljedeće accordion-e
    // unutar contentDiv. Klonira-j i ukloni sve ugnijezđene .lesson-accordion prije
    // ekstrakcije inner HTML-a — inače save bi duplicirao sve sekcije.
    let contentHtml = "";
    if (contentDiv) {
      const cloned = contentDiv.cloneNode(true) as Element;
      cloned.querySelectorAll(".lesson-accordion").forEach(nested => nested.remove());
      contentHtml = cloned.innerHTML.trim();
    }
    const isActive = contentDiv?.classList.contains("active") || contentDiv?.getAttribute("style")?.includes("display: block") || false;

    const isPriprema = sectionId === "priprema" || /PRIPREMA ZA NASTAVU/i.test(title);

    sections.push({ id: sectionId, title, iconText, contentHtml, isActive, isPriprema });
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
  CustomImage.configure({ inline: false, allowBase64: false }),
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

function extractHeroImage(beforeHtml: string): string | null {
  const match = beforeHtml.match(/<div class="hero-box">\s*<img\s+src="([^"]*)"[^>]*>/);
  if (match) return match[1];
  const imgMatch = beforeHtml.match(/<img\s+src="([^"]*)"[^>]*>/);
  return imgMatch ? imgMatch[1] : null;
}

function replaceHeroImage(beforeHtml: string, newSrc: string): string {
  if (/<div class="hero-box">/.test(beforeHtml)) {
    return beforeHtml.replace(
      /(<div class="hero-box">\s*<img\s+src=")[^"]*(")/,
      `$1${newSrc}$2`
    );
  }
  if (/<img\s+src="[^"]*"/.test(beforeHtml)) {
    return beforeHtml.replace(/<img\s+src="[^"]*"/, `<img src="${newSrc}"`);
  }
  return `<div class="hero-box"><img src="${newSrc}"></div>\n${beforeHtml}`;
}

export function WysiwygEditor({ content, onChange, token }: WysiwygEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState(() => parseAccordionSections(content));
  const hasContainer = content.includes('class="lesson-container"');
  const sectionContentsRef = useRef<string[]>(parsed.sections.map(s => s.contentHtml));
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  activeIdxRef.current = activeIdx;
  const switchingRef = useRef(false);
  // Priprema form state (per section; index matches parsed.sections)
  const [pripremaStructs, setPripremaStructs] = useState<Record<number, PripremaStruct>>(() => {
    const out: Record<number, PripremaStruct> = {};
    parsed.sections.forEach((sec, i) => {
      if (sec.isPriprema) {
        const parsedStruct = parsePripremaContent(sec.contentHtml);
        if (parsedStruct) out[i] = parsedStruct;
        else out[i] = {
          predmet: "Ahlak",
          nastavnaJedinica: "",
          tipSata: "Obrada novog gradiva",
          odgojni: "",
          obrazovni: "",
          funkcionalni: "",
          obliciRada: "Frontalni, individualni",
          sredstva: "Udžbenik, tabla, kreda",
          metode: "Metoda usmenog izlaganja, demonstrativna metoda, razgovor",
          uvodniDio: "",
          glavniDio: "",
          zavrsniDio: "",
        };
      }
    });
    return out;
  });
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [heroImage, setHeroImage] = useState<string | null>(() => extractHeroImage(parsed.beforeAccordions));
  const [heroUploading, setHeroUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{name:string;url:string;size:number;modified:string}[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [galleryMode, setGalleryMode] = useState<"hero" | "insert">("hero");
  const [docUploading, setDocUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/admin/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setGalleryImages(Array.isArray(data) ? data : data.files || []);
    } catch { }
    setGalleryLoading(false);
  }, [token]);

  const openGallery = useCallback((mode: "hero" | "insert") => {
    setGalleryMode(mode);
    setShowGallery(true);
    loadGallery();
  }, [loadGallery]);

  const initialSection = parsed.sections[0];
  const editor = useEditor({
    extensions: editorExtensions,
    content: parsed.hasAccordions ? (initialSection?.isPriprema ? "" : initialSection?.contentHtml || "") : content,
    onUpdate: ({ editor: ed }) => {
      if (switchingRef.current) return;
      // Priprema sekcija koristi formu, ne TipTap — ignoriši TipTap update-e kad je ona aktivna
      if (parsed.hasAccordions && parsed.sections[activeIdxRef.current]?.isPriprema) return;
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

  const selectGalleryImage = useCallback((url: string) => {
    if (galleryMode === "hero") {
      setHeroImage(url);
      setParsed(prev => ({
        ...prev,
        beforeAccordions: replaceHeroImage(prev.beforeAccordions, url),
      }));
      onChange("");
      toast({ title: "Hero slika postavljena ✓" });
    } else if (editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    setShowGallery(false);
  }, [galleryMode, editor, onChange, toast]);

  const onDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = "";
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const resp = await fetch(`${getApiBase()}/admin/upload-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Upload nije uspio");
      }
      const data = await resp.json();
      if (data.html) {
        editor.chain().focus().insertContent(data.html).run();
        toast({ title: `${data.filename} umetnut ✓`, description: `Format: ${data.format.toUpperCase()}` });
      }
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    }
    setDocUploading(false);
  }, [editor, token, toast]);

  const switchSection = useCallback((newIdx: number) => {
    if (!editor || !parsed.hasAccordions) return;
    if (newIdx === activeIdxRef.current) return;
    switchingRef.current = true;
    // Sačuvaj trenutnu sekciju iz TipTap-a (osim ako je priprema — ona ima svoj form state)
    if (!parsed.sections[activeIdxRef.current]?.isPriprema) {
      sectionContentsRef.current[activeIdxRef.current] = editor.getHTML();
    }
    activeIdxRef.current = newIdx;
    setActiveIdx(newIdx);
    // Kad prelazim na priprema, TipTap-ov content ne treba — forma preuzima
    const target = parsed.sections[newIdx];
    editor.commands.setContent(target?.isPriprema ? "" : (sectionContentsRef.current[newIdx] || ""));
    switchingRef.current = false;
  }, [editor, parsed.hasAccordions, parsed.sections]);

  // Update priprema struct field, rebuild HTML, propagate change
  const updatePripremaField = useCallback((idx: number, field: keyof PripremaStruct, value: string) => {
    setPripremaStructs(prev => {
      const current = prev[idx];
      if (!current) return prev;
      const next = { ...current, [field]: value };
      const newHtml = renderPripremaContent(next);
      sectionContentsRef.current[idx] = newHtml;
      // Trigger onChange so parent dirty-flag works
      onChange(newHtml);
      return { ...prev, [idx]: next };
    });
  }, [onChange]);

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
    const newIdx = idx + dir;
    // Sačuvaj content iz TipTap-a SAMO ako trenutna sekcija nije priprema —
    // priprema koristi svoju formu, TipTap je prazan i prepisao bi pripremu.
    if (!parsed.sections[activeIdxRef.current]?.isPriprema) {
      sectionContentsRef.current[activeIdxRef.current] = editor.getHTML();
    }
    setParsed(prev => {
      if (newIdx < 0 || newIdx >= prev.sections.length) return prev;
      const newSections = prev.sections.map((s, i) => ({
        ...s,
        contentHtml: sectionContentsRef.current[i] ?? s.contentHtml,
      }));
      [newSections[idx], newSections[newIdx]] = [newSections[newIdx], newSections[idx]];
      const newContents = [...sectionContentsRef.current];
      [newContents[idx], newContents[newIdx]] = [newContents[newIdx], newContents[idx]];
      sectionContentsRef.current = newContents;
      // Premjesti i priprema form state ako je jedna od pomjerenih sekcija priprema
      setPripremaStructs(prevStructs => {
        const next: Record<number, PripremaStruct> = {};
        for (const [k, v] of Object.entries(prevStructs)) {
          const i = Number(k);
          const target = i === idx ? newIdx : i === newIdx ? idx : i;
          next[target] = v;
        }
        return next;
      });
      const focusIdx = activeIdxRef.current === idx ? newIdx : activeIdxRef.current === newIdx ? idx : activeIdxRef.current;
      activeIdxRef.current = focusIdx;
      setActiveIdx(focusIdx);
      switchingRef.current = true;
      setTimeout(() => {
        const targetSec = newSections[focusIdx];
        editor.commands.setContent(targetSec?.isPriprema ? "" : (sectionContentsRef.current[focusIdx] || ""));
        switchingRef.current = false;
      }, 0);
      return { ...prev, sections: newSections };
    });
    onChange("");
  }, [editor, onChange, parsed.sections]);

  const renameSection = useCallback((idx: number, newTitle: string) => {
    setParsed(prev => {
      const newSections = [...prev.sections];
      newSections[idx] = { ...newSections[idx], title: newTitle };
      return { ...prev, sections: newSections };
    });
    setRenamingIdx(null);
    onChange("");
  }, [onChange]);

  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;
  const hasContainerRef = useRef(hasContainer);
  hasContainerRef.current = hasContainer;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const contentRef = useRef(content);
  contentRef.current = content;
  const heroImageRef = useRef(heroImage);
  heroImageRef.current = heroImage;

  const handleHeroUpload = useCallback(async (file: File) => {
    setHeroUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
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
        setHeroImage(data.url);
        setParsed(prev => ({
          ...prev,
          beforeAccordions: replaceHeroImage(prev.beforeAccordions, data.url),
        }));
        onChange("");
        toast({ title: "Hero slika ažurirana ✓" });
      }
    } catch {
      toast({ title: "Upload nije uspio", variant: "destructive" });
    } finally {
      setHeroUploading(false);
    }
  }, [token, toast, onChange]);

  (window as any).__wysiwygGetFullHtml = () => {
    const p = parsedRef.current;
    const ed = editorRef.current;
    if (!p.hasAccordions) {
      let baseHtml = ed?.getHTML() || contentRef.current;
      if (heroImageRef.current) {
        const existingHero = extractHeroImage(baseHtml);
        if (existingHero) {
          baseHtml = baseHtml.replace(/<img\s+src="[^"]*"/, `<img src="${heroImageRef.current}"`);
        } else {
          baseHtml = `<div class="hero-box"><img src="${heroImageRef.current}"></div>\n${baseHtml}`;
        }
      }
      return baseHtml;
    }
    // Ne overwrite-uj priprema sekciju iz TipTap-a — ona se builda iz forme
    if (ed && !p.sections[activeIdxRef.current]?.isPriprema) {
      sectionContentsRef.current[activeIdxRef.current] = ed.getHTML();
    }
    const updatedSections = p.sections.map((s, i) => {
      const refContent = sectionContentsRef.current[i];
      return {
        ...s,
        contentHtml: refContent != null ? refContent : s.contentHtml,
      };
    });
    let before = p.beforeAccordions;
    if (heroImageRef.current && heroImageRef.current !== extractHeroImage(before)) {
      before = replaceHeroImage(before, heroImageRef.current);
    }
    return reassembleHtml(before, updatedSections, p.afterAccordions, hasContainerRef.current);
  };

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
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50/80">
        <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleHeroUpload(f);
          e.target.value = "";
        }} />
        <div className="flex items-center gap-3 mb-2">
          {heroImage ? (
            <div className="relative group/hero flex items-center gap-3 w-full">
              <img src={heroImage} alt="Hero" className="h-14 w-24 object-cover rounded-lg border-2 border-teal-400" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-600 truncate">Hero slika: <span className="text-teal-600">{heroImage}</span></p>
              </div>
              <button type="button" onClick={() => openGallery("hero")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors shrink-0">
                <FolderOpen className="w-3.5 h-3.5" />
                Galerija
              </button>
              <button type="button" onClick={() => heroFileRef.current?.click()} disabled={heroUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors shrink-0">
                {heroUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                {heroUploading ? "Uploadujem..." : "Upload"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button type="button" onClick={() => openGallery("hero")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors flex-1 justify-center">
                <FolderOpen className="w-4 h-4" />
                Iz galerije
              </button>
              <button type="button" onClick={() => heroFileRef.current?.click()} disabled={heroUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-teal-50 hover:border-teal-300 text-gray-500 hover:text-teal-700 transition-colors flex-1 justify-center">
                {heroUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                {heroUploading ? "Uploadujem..." : "Upload novu"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowGallery(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-800">
                {galleryMode === "hero" ? "Odaberi hero sliku" : "Umetni sliku iz galerije"}
              </h3>
              <button type="button" onClick={() => setShowGallery(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                </div>
              ) : galleryImages.length === 0 ? (
                <p className="text-center text-gray-400 py-12">Nema uploadovanih slika</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {galleryImages.map(img => (
                    <div key={img.url} className="group relative">
                      <button
                        type="button"
                        onClick={() => selectGalleryImage(img.url)}
                        className="w-full aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-teal-400 transition-colors bg-gray-50"
                      >
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" }} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(img.url);
                          setCopiedUrl(img.url);
                          setTimeout(() => setCopiedUrl(null), 2000);
                        }}
                        title="Kopiraj URL"
                        className="absolute top-1 right-1 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-teal-50"
                      >
                        {copiedUrl === img.url ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                      </button>
                      <p className="text-[10px] text-gray-400 truncate mt-1 px-0.5">{img.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                    <div className="flex items-center gap-1 ml-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }} disabled={idx === 0} title="Pomjeri lijevo" className="p-1 rounded hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp className="w-4 h-4 -rotate-90" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }} disabled={idx === parsed.sections.length - 1} title="Pomjeri desno" className="p-1 rounded hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown className="w-4 h-4 -rotate-90" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setRenamingIdx(idx); setRenameValue(sec.title); }} title="Preimenuj" className="p-1 rounded hover:bg-teal-100"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm("Obrisati ovu sekciju?")) removeSection(idx); }} title="Obriši" className="p-1 rounded hover:bg-red-100 text-red-500" disabled={parsed.sections.length <= 1}><Trash2 className="w-4 h-4" /></button>
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
        <MenuButton onClick={() => fileInputRef.current?.click()} title="Upload sliku">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => openGallery("insert")} title="Umetni iz galerije">
          <FolderOpen className="w-4 h-4 text-amber-600" />
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
        <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Umetni horizontalnu liniju">
          <Minus className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => docInputRef.current?.click()} disabled={docUploading} title="Umetni PDF / DOCX">
          {docUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-blue-600" />}
        </MenuButton>
        <ToolSeparator />
        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Poništi">
          <Undo2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ponovi">
          <Redo2 className="w-4 h-4" />
        </MenuButton>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
      <input ref={docInputRef} type="file" accept=".pdf,.docx" onChange={onDocumentUpload} className="hidden" />

      <div className="flex-1 overflow-y-auto wysiwyg-editor-content relative">
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
          .wysiwyg-editor-content .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.75rem; margin: 0.75rem 0; cursor: pointer; transition: outline 0.15s; }
          .wysiwyg-editor-content .ProseMirror img.ProseMirror-selectednode { outline: 3px solid #0d9488; outline-offset: 2px; }
          .wysiwyg-editor-content .ProseMirror img[data-size="medium"] { max-width: 50%; width: 50%; }
          .wysiwyg-editor-content .ProseMirror img[data-size="small"] { max-width: 33%; width: 33%; }
          .wysiwyg-editor-content .ProseMirror img[data-align="left"] { float: left; margin: 0.5rem 1.25rem 0.75rem 0; }
          .wysiwyg-editor-content .ProseMirror img[data-align="right"] { float: right; margin: 0.5rem 0 0.75rem 1.25rem; }
          .wysiwyg-editor-content .ProseMirror img[data-align="center"] { display: block; margin-left: auto; margin-right: auto; }
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
        {parsed.sections[activeIdx]?.isPriprema ? (
          <PripremaForm
            struct={pripremaStructs[activeIdx]}
            onChange={(field, value) => updatePripremaField(activeIdx, field, value)}
          />
        ) : (
          <>
            <EditorContent editor={editor} />
            <ImageToolbar editor={editor} />
          </>
        )}
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, multiline, hint, rows }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows || 3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none text-sm resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none text-sm"
        />
      )}
      {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

function PripremaForm({ struct, onChange }: {
  struct: PripremaStruct | undefined;
  onChange: (field: keyof PripremaStruct, value: string) => void;
}) {
  if (!struct) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl m-4">
        Priprema nije mogla biti učitana. Pokušaj spremiti lekciju kako bi se inicijalizirala prazna forma.
      </div>
    );
  }
  return (
    <div className="p-4 space-y-5">
      <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-sm flex items-start gap-2">
        <span className="text-base">✏️</span>
        <div>
          <div className="font-extrabold mb-0.5">Uredi pripremu za nastavu</div>
          <div>Izmijeni tekst u poljima dolje. Dizajn (gradient kartica, obojeni ciljevi) automatski se primjenjuje pri spremanju — ne moraš ništa dizajnirati ručno.</div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 space-y-3">
        <div className="text-white font-extrabold text-base flex items-center gap-2">📋 Osnovni podaci</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Predmet" value={struct.predmet} onChange={(v) => onChange("predmet", v)} />
          <FormField label="Tip sata" value={struct.tipSata} onChange={(v) => onChange("tipSata", v)} />
        </div>
        <FormField label="Nastavna jedinica" value={struct.nastavnaJedinica} onChange={(v) => onChange("nastavnaJedinica", v)} />
      </div>

      <div className="space-y-3">
        <div className="font-extrabold text-teal-700 flex items-center gap-2">🎯 Ciljevi nastavnog sata</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-red-50 border-t-4 border-red-500 p-3">
            <FormField label="❤️ Odgojni cilj" value={struct.odgojni} onChange={(v) => onChange("odgojni", v)} multiline rows={4} />
          </div>
          <div className="rounded-xl bg-blue-50 border-t-4 border-blue-500 p-3">
            <FormField label="📚 Obrazovni cilj" value={struct.obrazovni} onChange={(v) => onChange("obrazovni", v)} multiline rows={4} />
          </div>
          <div className="rounded-xl bg-green-50 border-t-4 border-green-500 p-3">
            <FormField label="💪 Funkcionalni cilj" value={struct.funkcionalni} onChange={(v) => onChange("funkcionalni", v)} multiline rows={4} />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
        <div className="font-extrabold text-slate-700 flex items-center gap-2">🗂️ Organizacija nastave</div>
        <FormField label="Oblici rada" value={struct.obliciRada} onChange={(v) => onChange("obliciRada", v)} />
        <FormField label="Sredstva" value={struct.sredstva} onChange={(v) => onChange("sredstva", v)} />
        <FormField label="Metode" value={struct.metode} onChange={(v) => onChange("metode", v)} />
      </div>

      <div className="space-y-3">
        <div className="font-extrabold text-teal-700 flex items-center gap-2">📖 Struktura sata</div>
        <div className="rounded-xl bg-blue-50 border-l-4 border-blue-500 p-3">
          <FormField
            label="🔵 Uvodni dio"
            value={struct.uvodniDio}
            onChange={(v) => onChange("uvodniDio", v)}
            multiline
            rows={5}
            hint="HTML je dozvoljen: <p>, <strong>, <em>, <br> — bit će očuvan u finalnom dizajnu."
          />
        </div>
        <div className="rounded-xl bg-green-50 border-l-4 border-green-500 p-3">
          <FormField
            label="🟢 Glavni dio"
            value={struct.glavniDio}
            onChange={(v) => onChange("glavniDio", v)}
            multiline
            rows={8}
          />
        </div>
        <div className="rounded-xl bg-yellow-50 border-l-4 border-yellow-500 p-3">
          <FormField
            label="🟡 Završni dio"
            value={struct.zavrsniDio}
            onChange={(v) => onChange("zavrsniDio", v)}
            multiline
            rows={5}
          />
        </div>
      </div>
    </div>
  );
}

function ImageToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [attrs, setAttrs] = useState<{ align: string | null; size: string | null }>({ align: null, size: null });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { selection } = editor.state;
      const node = (selection as any).node;
      if (node && node.type.name === "image") {
        const dom = editor.view.nodeDOM(selection.from) as HTMLElement | null;
        if (dom) {
          const editorEl = editor.view.dom.closest(".wysiwyg-editor-content");
          if (editorEl) {
            const editorRect = editorEl.getBoundingClientRect();
            const imgRect = dom.getBoundingClientRect();
            setPos({
              top: imgRect.top - editorRect.top - 48,
              left: imgRect.left - editorRect.left + imgRect.width / 2,
            });
          }
        }
        setAttrs({
          align: node.attrs["data-align"] || null,
          size: node.attrs["data-size"] || null,
        });
      } else {
        setPos(null);
      }
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const setImageAttr = (key: string, value: string | null) => {
    if (!editor) return;
    const { selection } = editor.state;
    const selNode = (selection as any).node;
    if (!selNode || selNode.type.name !== "image") return;
    const current = selNode.attrs[key];
    const newVal = current === value ? null : value;
    editor.chain().focus().updateAttributes("image", { [key]: newVal }).run();
    setAttrs(prev => ({ ...prev, [key === "data-align" ? "align" : "size"]: newVal }));
  };

  if (!pos || !editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded-md text-xs font-bold transition-colors ${
      active ? "bg-teal-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-lg px-2 py-1.5"
      style={{
        top: Math.max(0, pos.top),
        left: pos.left,
        transform: "translateX(-50%)",
      }}
    >
      <span className="text-[10px] text-gray-400 font-bold mr-1">Pozicija:</span>
      <button type="button" className={btnClass(attrs.align === "left")} onClick={() => setImageAttr("data-align", "left")} title="Lijevo (tekst desno)">
        <AlignLeft className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btnClass(attrs.align === "center" || !attrs.align)} onClick={() => setImageAttr("data-align", "center")} title="Centar">
        <AlignCenter className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btnClass(attrs.align === "right")} onClick={() => setImageAttr("data-align", "right")} title="Desno (tekst lijevo)">
        <AlignRight className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <span className="text-[10px] text-gray-400 font-bold mr-1">Veličina:</span>
      <button type="button" className={btnClass(!attrs.size)} onClick={() => setImageAttr("data-size", null)} title="Puna širina">
        <Maximize className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btnClass(attrs.size === "medium")} onClick={() => setImageAttr("data-size", "medium")} title="Srednja (50%)">
        <RectangleHorizontal className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btnClass(attrs.size === "small")} onClick={() => setImageAttr("data-size", "small")} title="Mala (33%)">
        <Square className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
