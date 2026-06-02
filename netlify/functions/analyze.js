exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { resume, jobDescription } = JSON.parse(event.body);

    if (!resume || !jobDescription) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Resume and job description are required" }),
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are an ATS expert. Analyze this resume against the job description.

You MUST respond with ONLY a raw JSON object. No markdown. No backticks. No explanation. Just the JSON.

Example format:
{"score":72,"strengths":["Has Python skills"],"improvements":["Add metrics"],"keywords_matched":["Python"],"keywords_missing":["SQL"]}

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Anthropic API error");
    }

    // Robust parsing - strip any markdown fences
    let raw = data.content[0].text.trim();
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    const result = JSON.parse(raw);

    // Ensure score is a number
    result.score = Number(result.score);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error("analyze error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Analysis failed", details: err.message }),
    };
  }
};