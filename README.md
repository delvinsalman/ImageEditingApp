# ImageEditingApp

**Video full demo coming soon** 🔜

An AI-powered image editing application that integrates AI APIs with a programmatic interface 

**⚠️ Requires a valid OpenAI API key with available credits**.⚠️ 

---

## Demos

*Top features, from the interface down to AI editing.*

### This is the interface

Blank canvas, toolbars, and AI tools ready to use.

<img width="1510" height="771" alt="Interface" src="https://github.com/user-attachments/assets/8be08304-46c2-4463-ad81-d05f0dbb0597" />

---

### Generate from text

Default example: *"A dog dancing with a cat on the beach"* — create images from a prompt, then edit or export them.

<img width="1510" height="771" alt="Text - Image" src="https://github.com/user-attachments/assets/0ba7ad63-0ab6-4834-8d9e-8055c851ddf9" />

---

### Adjust

Use brightness, contrast, saturation, rotation, and the fade/erase brush on any layer.

<img width="1510" height="771" alt="Adjust" src="https://github.com/user-attachments/assets/cb1b1363-7173-47b0-b87a-0d8b4cddf97a" />

---

### AI Edit

Edit the image you generated (or uploaded) with prompts — e.g. put the dog and cat in a car on the beach.

<img width="1510" height="771" alt="AI Edit" src="https://github.com/user-attachments/assets/06cea3bb-9f32-495d-b079-13353762ac62" />

Multi layer, and brush features.

<img width="1510" height="771" alt="Erase" src="https://github.com/user-attachments/assets/229f0e1a-0bbb-49ff-a7c7-8dbe87c310e8" />

---

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
