"use client";

import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export interface BiasHighlightFlag {
  term: string;
  severity: "high" | "medium" | "low";
}

interface BiasHighlightState {
  flags: BiasHighlightFlag[];
  flashTerm: string | null;
}

export const biasHighlightPluginKey = new PluginKey<BiasHighlightState>(
  "biasHighlight",
);

function severityClass(severity: BiasHighlightFlag["severity"]): string {
  switch (severity) {
    case "high":
      return "bias-mark bias-mark--high";
    case "medium":
      return "bias-mark bias-mark--medium";
    case "low":
    default:
      return "bias-mark bias-mark--low";
  }
}

function buildDecorations(
  doc: PMNode,
  state: BiasHighlightState,
): DecorationSet {
  if (state.flags.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const flashLower = state.flashTerm?.toLowerCase() ?? null;
  const flashedFirstByTerm = new Set<string>();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const lowerText = text.toLowerCase();

    for (const flag of state.flags) {
      const lowerTerm = flag.term.toLowerCase();
      if (lowerTerm.length === 0) continue;

      let cursor = 0;
      while (true) {
        const idx = lowerText.indexOf(lowerTerm, cursor);
        if (idx === -1) break;

        const from = pos + idx;
        const to = from + flag.term.length;
        const isFlashTarget =
          flashLower !== null &&
          lowerTerm === flashLower &&
          !flashedFirstByTerm.has(lowerTerm);

        const cls = isFlashTarget
          ? `${severityClass(flag.severity)} bias-mark--flash`
          : severityClass(flag.severity);

        decorations.push(
          Decoration.inline(from, to, {
            class: cls,
            "data-bias-term": flag.term,
            "data-bias-severity": flag.severity,
          }),
        );

        if (isFlashTarget) flashedFirstByTerm.add(lowerTerm);
        cursor = idx + flag.term.length;
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const BiasHighlightExtension = Extension.create({
  name: "biasHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<BiasHighlightState>({
        key: biasHighlightPluginKey,
        state: {
          init: (): BiasHighlightState => ({ flags: [], flashTerm: null }),
          apply: (
            tr: Transaction,
            prev: BiasHighlightState,
          ): BiasHighlightState => {
            const meta = tr.getMeta(biasHighlightPluginKey) as
              | Partial<BiasHighlightState>
              | undefined;
            if (!meta) return prev;
            return {
              flags: meta.flags !== undefined ? meta.flags : prev.flags,
              flashTerm:
                meta.flashTerm !== undefined ? meta.flashTerm : prev.flashTerm,
            };
          },
        },
        props: {
          decorations(state: EditorState): DecorationSet {
            const pluginState = biasHighlightPluginKey.getState(state);
            if (!pluginState) return DecorationSet.empty;
            return buildDecorations(state.doc, pluginState);
          },
        },
      }),
    ];
  },
});

export function setBiasFlags(editor: Editor, flags: BiasHighlightFlag[]): void {
  const { view } = editor;
  view.dispatch(view.state.tr.setMeta(biasHighlightPluginKey, { flags }));
}

export function flashBiasTerm(editor: Editor, term: string): void {
  const { view } = editor;
  view.dispatch(
    view.state.tr.setMeta(biasHighlightPluginKey, { flashTerm: term }),
  );
  // Auto-clear the flash after the animation completes.
  window.setTimeout(() => {
    if (!editor.isDestroyed) {
      editor.view.dispatch(
        editor.view.state.tr.setMeta(biasHighlightPluginKey, {
          flashTerm: null,
        }),
      );
    }
  }, 1600);
}

export function findFirstTermPosition(
  editor: Editor,
  term: string,
): number | null {
  const lowerTerm = term.toLowerCase();
  if (lowerTerm.length === 0) return null;

  let foundPos: number | null = null;
  editor.state.doc.descendants((node: PMNode, pos: number) => {
    if (foundPos !== null) return false;
    if (!node.isText || !node.text) return;
    const idx = node.text.toLowerCase().indexOf(lowerTerm);
    if (idx !== -1) {
      foundPos = pos + idx;
      return false;
    }
    return;
  });
  return foundPos;
}
