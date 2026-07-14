exports.handler = async function (event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "ANTHROPIC_API_KEY is not configured in Netlify.",
        }),
      };
    }

    let payload;

    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON request body." }),
      };
    }

    const resume = String(payload.resume || "").trim();
    const jobdesc = String(
      payload.jobdesc ||
      payload.jobDescription ||
      payload.job_description ||
      ""
    ).trim();

    if (!resume || !jobdesc) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Resume and job description are required.",
        }),
      };
    }

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: `You are an ATS resume expert.

Analyse the resume against the job description.

Return ONLY valid JSON using this exact structure:
{
  "score": 85,
  "strengths": ["Example strength"],
  "improvements": ["Example improvement"],
  "keywords_matched": ["Example keyword"],
  "keywords_missing": ["Example missing keyword"]
}

Rules:
- score must be an integer from 0 to 100
- each list must contain short, useful strings
- do not include markdown
- do not include code fences
- do not include any explanation outside the JSON

RESUME:
${resume}

JOB DESCRIPTION:
${jobdesc}`,
            },
          ],
        }),
      }
    );

    const anthropicData = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      console.error(
        "Anthropic analyze error:",
        JSON.stringify(anthropicData)
      );

      return {
        statusCode: anthropicResponse.status || 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error:
            anthropicData?.error?.message ||
            "Anthropic API request failed.",
        }),
      };
    }

    const rawText = Array.isArray(anthropicData.content)
      ? anthropicData.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim()
      : "";

    if (!rawText) {
      throw new Error("Anthropic returned no text content.");
    }

    const cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let result;

    try {
      result = JSON.parse(cleanedText);
    } catch {
      const firstBrace = cleanedText.indexOf("{");
      const lastBrace = cleanedText.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("The AI response was not valid JSON.");
      }

      result = JSON.parse(
        cleanedText.slice(firstBrace, lastBrace + 1)
      );
    }

    const normalisedResult = {
      score: Math.max(
        0,
        Math.min(100, Math.round(Number(result.score) || 0))
      ),
      strengths: Array.isArray(result.strengths)
        ? result.strengths
        : [],
      improvements: Array.isArray(result.improvements)
        ? result.improvements
        : [],
      keywords_matched: Array.isArray(result.keywords_matched)
        ? result.keywords_matched
        : [],
      keywords_missing: Array.isArray(result.keywords_missing)
        ? result.keywords_missing
        : [],
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(normalisedResult),
    };
  } catch (error) {
    console.error("Analyze function error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || "Resume analysis failed.",
      }),
    };
  }
};
