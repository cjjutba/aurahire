"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BiasHighlightExtension,
  type BiasHighlightFlag,
  findFirstTermPosition,
  flashBiasTerm,
  setBiasFlags,
} from "./_bias-highlight-extension";

interface TiptapEditorProps {
  value: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  biasFlags?: BiasHighlightFlag[];
}

export interface TiptapEditorHandle {
  scrollToTerm: (term: string) => void;
}

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor({ value, onChange, placeholder, biasFlags }, ref) {
    const editor = useEditor({
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: placeholder ?? "Describe the role…",
        }),
        Link.configure({ openOnClick: false }),
        BiasHighlightExtension,
      ],
      content: value,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML(), editor.getText());
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none min-h-[240px] rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
        },
      },
    });

    const editorContainerRef = useRef<HTMLDivElement | null>(null);

    // Push the latest flags into the ProseMirror plugin whenever the prop
    // changes. The plugin recomputes decorations on the next state read.
    useEffect(() => {
      if (!editor) return;
      setBiasFlags(editor, biasFlags ?? []);
    }, [editor, biasFlags]);

    useImperativeHandle(
      ref,
      (): TiptapEditorHandle => ({
        scrollToTerm: (term: string) => {
          if (!editor) return;
          const pos = findFirstTermPosition(editor, term);
          if (pos === null) return;

          // Move selection to the term so the user gets a caret cue, then
          // scroll the surrounding DOM node into view and trigger the flash
          // decoration (a short brighter highlight that auto-clears).
          editor.commands.focus();
          editor.commands.setTextSelection(pos);

          try {
            const domAt = editor.view.domAtPos(pos);
            const node: Node = domAt.node;
            const target =
              node.nodeType === Node.ELEMENT_NODE
                ? (node as HTMLElement)
                : node.parentElement;
            target?.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            // domAtPos can throw if the doc is mid-update; skip the scroll.
          }

          flashBiasTerm(editor, term);
        },
      }),
      [editor],
    );

    if (!editor) return null;

    return (
      <div className="space-y-2" ref={editorContainerRef}>
        <div className="flex flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive("bold")}
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-pressed={editor.isActive("italic")}
            aria-label="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-pressed={editor.isActive("bulletList")}
            aria-label="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-pressed={editor.isActive("orderedList")}
            aria-label="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const url = window.prompt("URL");
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            aria-pressed={editor.isActive("link")}
            aria-label="Insert Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  },
);
