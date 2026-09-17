"use client";

import { useEffect, useRef } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  ImagePlus,
  Table as TableIcon,
  Undo2,
  Redo2,
  type LucideIcon,
} from "lucide-react";

// WYSIWYG blog editor (Amit, 2026-09-17) so Manoj doesn't need to know
// markdown. Content still loads and saves as markdown via
// @tiptap/markdown, so the DB and the public /blogs renderer
// (react-markdown + remark-gfm) are unchanged. Only enable nodes/marks
// that have a markdown form — e.g. underline has none, so it's off.
export function RichMarkdownEditor({
  initialMarkdown,
  onChange,
  placeholder = "Start writing your post…",
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  // Keep the latest callback without re-creating the editor.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    // Next.js renders client components on the server too; TipTap must
    // not touch the DOM until hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        },
      }),
      Image,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
      Markdown,
    ],
    content: initialMarkdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class:
          "blog-markdown min-h-[24rem] px-4 py-3 text-sm focus:outline-none sm:text-base",
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getMarkdown());
    },
  });

  return (
    <div className="rich-editor rounded-md border bg-card focus-within:ring-2 focus-within:ring-ring">
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
        </>
      ) : (
        <div className="min-h-[24rem] px-4 py-3 text-sm text-muted-foreground">
          Loading editor…
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render the toolbar on selection/transaction changes so active
  // states and undo/redo availability stay in sync.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      inTable: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  if (!state) return null;

  function editLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "Link URL (leave empty to remove the link)",
      previous ?? "https://",
    );
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      window.alert("Links must start with https://, http:// or mailto:");
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();
  }

  function insertImage() {
    const src = window.prompt("Image URL (https://…)");
    if (!src) return;
    const trimmed = src.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      window.alert("Image URL must start with https://");
      return;
    }
    const alt = window.prompt("Short image description (for Google)") ?? "";
    editor.chain().focus().setImage({ src: trimmed, alt: alt.trim() }).run();
  }

  return (
    <div className="sticky top-[57px] z-[5] rounded-t-md border-b bg-card">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5">
        <ToolButton
          icon={Bold}
          label="Bold"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolButton
          icon={Italic}
          label="Italic"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          icon={Strikethrough}
          label="Strikethrough"
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Divider />
        <ToolButton
          icon={Heading2}
          label="Heading"
          active={state.h2}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolButton
          icon={Heading3}
          label="Sub-heading"
          active={state.h3}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <Divider />
        <ToolButton
          icon={List}
          label="Bullet list"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          icon={ListOrdered}
          label="Numbered list"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          icon={Quote}
          label="Quote"
          active={state.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          icon={Minus}
          label="Divider line"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <Divider />
        <ToolButton
          icon={LinkIcon}
          label="Link"
          active={state.link}
          onClick={editLink}
        />
        <ToolButton icon={ImagePlus} label="Image" onClick={insertImage} />
        <ToolButton
          icon={TableIcon}
          label="Table"
          active={state.inTable}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        />
        <Divider />
        <ToolButton
          icon={Undo2}
          label="Undo"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          icon={Redo2}
          label="Redo"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      {state.inTable && (
        <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">Table:</span>
          <TextButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            + Row
          </TextButton>
          <TextButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            + Column
          </TextButton>
          <TextButton onClick={() => editor.chain().focus().deleteRow().run()}>
            − Row
          </TextButton>
          <TextButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            − Column
          </TextButton>
          <TextButton
            destructive
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            Delete table
          </TextButton>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor selection when clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-md disabled:opacity-40 ${
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function TextButton({
  children,
  destructive = false,
  onClick,
}: {
  children: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 ${
        destructive ? "border-destructive/40 text-destructive" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}
