import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, apiKey: clientApiKey } = body as { prompt?: string; apiKey?: string };

    const apiKey = clientApiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key required. Enter your OpenAI API key in the app (key icon)." },
        { status: 400 }
      );
    }

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.trim(),
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      quality: "standard",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "No image data in response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ imageBase64: b64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    const status = err instanceof Error && "status" in err ? (err as { status?: number }).status : 500;
    return NextResponse.json(
      { error: message },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}
