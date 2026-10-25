/**
 * Transcribe audio using Deepgram Nova-3 via REST API (no SDK, avoids version drift).
 * Free tier: 12,000 minutes/year.
 * Accepts any Blob the browser sends (webm, ogg, mp4, wav).
 */
export async function transcribeDeepgram(opts: {
  apiKey: string;
  audio: Blob;
  filename?: string;
}): Promise<string> {
  const { apiKey, audio } = opts;

  const arrayBuffer = await audio.arrayBuffer();

  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&language=en", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": audio.type || "audio/webm",
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Deepgram API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
  };

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return transcript.trim();
}
