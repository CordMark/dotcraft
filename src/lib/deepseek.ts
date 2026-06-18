type DeepSeekMessage = {
  content: string;
  role: "system" | "user";
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getDeepSeekModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
}

function getDeepSeekMaxTokens() {
  const value = Number.parseInt(process.env.DEEPSEEK_MAX_TOKENS || "", 10);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return 12000;
}

function parseJsonContent<T>(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : trimmed;

  return JSON.parse(json) as T;
}

export async function createDeepSeekJson<T>(messages: DeepSeekMessage[]) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    body: JSON.stringify({
      max_tokens: getDeepSeekMaxTokens(),
      messages,
      model: getDeepSeekModel(),
      response_format: {
        type: "json_object",
      },
      stream: false,
      thinking: {
        type: "disabled",
      },
    }),
    headers: {
      Authorization: `Bearer ${getRequiredEnv("DEEPSEEK_API_KEY")}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as
    | DeepSeekResponse
    | null;

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        `DeepSeek request failed with status ${response.status}`,
    );
  }

  const content = result?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek response did not include content.");
  }

  return parseJsonContent<T>(content);
}
