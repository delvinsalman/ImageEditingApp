import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

export type EditAction = "background_remove" | "upscale" | "custom" | "smart_select";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, maskBase64, prompt, action = "custom", apiKey: clientApiKey } = body as {
      imageBase64: string;
      maskBase64?: string;
      prompt?: string;
      action?: EditAction;
      apiKey?: string;
    };

    const apiKey = clientApiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key required. Enter your OpenAI API key in the app (key icon)." },
        { status: 400 }
      );
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const imageFile = await toFile(buffer, "image.png", { type: "image/png" });

    // Background remove: strict prompt so the model only removes background and does not edit the subject.
    // Smart select: refine the masked region (transparent in mask = where to edit) to isolate subject with transparency.
    // Custom (AI Edit): always use the user's prompt for creative edits.
    const resolvedPrompt =
      action === "background_remove"
        ? "Remove only the background. Do not modify, alter, recolor, or edit the subject in any way. Keep the subject exactly as it is. Make the background transparent."
        : action === "smart_select"
          ? "Only edit the region that is transparent in the mask. In that region ONLY: remove the background and make it transparent. Keep the subject that is already there exactly as it is—do not add, generate, or create any new objects. Do not change anything outside the masked region. Output the same image with only that region's background removed."
          : action === "upscale"
            ? "Upscale and enhance this image while preserving all details and quality."
            : action === "custom" && prompt
              ? prompt
              : "Apply the requested edits to this image.";

    const openai = new OpenAI({ apiKey });
    const editParams: Parameters<typeof openai.images.edit>[0] = {
      model: "gpt-image-1-mini",
      image: imageFile,
      prompt: resolvedPrompt,
      size: "auto",
      quality: "medium",
      ...(action === "background_remove" && {
        background: "transparent" as const,
        output_format: "png" as const,
      }),
      ...(action === "smart_select" && {
        background: "transparent" as const,
        output_format: "png" as const,
      }),
    };

    if (action === "smart_select" && maskBase64) {
      const maskBuffer = Buffer.from(maskBase64, "base64");
      editParams.mask = await toFile(maskBuffer, "mask.png", { type: "image/png" });
    }

    const result = await openai.images.edit(editParams) as { data?: Array<{ b64_json?: string }> };

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "No image data in response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ imageBase64: b64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image edit failed";
    const status = err instanceof Error && "status" in err ? (err as { status?: number }).status : 500;
    return NextResponse.json(
      { error: message },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}
