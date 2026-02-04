# ImageEditingApp

An image editing app that uses AI API integration alongside a programmatic interface.

## Features

- **Upload & export** – Load images and export edited results as PNG.
- **AI tools** – Generate from text (DALL·E 3), remove background, edit with prompts, upscale via OpenAI.
- **Layers** – Each edit adds a new layer; delete layers or reset the project.
- **Adjust** – Brightness, contrast, saturation, rotation, and fade/erase brush.
- **Undo / redo** – History of layer states.

## Getting Started

1. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000). Enter your **OpenAI API key** (key icon in the header) when prompted; it’s stored only in your browser session.

3. Upload an image or use **Generate from text** to create one, then use Adjust, Remove background, or Export as needed.

## Tech

- Next.js 16 (App Router), React 19, Tailwind CSS.
- API routes: `POST /api/edit` (image edits), `POST /api/generate` (text-to-image). API key is sent from the client so you can deploy without putting a key in the repo.

## License

MIT.
