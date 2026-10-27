# apdfath

Apryse-shaped PDF text editor lab for Leasegen.

## Workflow (same loop as Apryse Content Edit)

1. **Open** PDF or DOCX (DOCX → LibreOffice PDF via `/api/convert`)
2. **Paint** pages with pdf.js
3. **Extract** text into selectable boxes
4. **Edit** with a real caret (`contentEditable`)
5. **Style** via the right panel (font, size, bold/italic, align, order)
6. **Export** PDF bytes: whiteout original box + redraw text (pdf-lib) → real page content in Acrobat

UI tools: pan, select, edit text, add paragraph, add image, undo/redo, download / Save PDF.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

DOCX conversion needs Docker image `leasegen-app` (or `linuxserver/libreoffice`) or a local `soffice`.

```bash
npm run typecheck
npm run build
```

## Embed later

```ts
const ref = useRef<PdfTextEditorHandle>(null)
const bytes = await ref.current?.exportPdf()
// feed bytes into Leasegen savePdfLayoutAction
```

Props: `onExported`, `onDirtyChange`. Handle: `exportPdf()`, `getFileLabel()`, `isDirty()`.
