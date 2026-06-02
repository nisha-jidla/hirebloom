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
    const body = JSON.parse(event.body);
    const { jobRole, resume, jobDescription, questionCount = 5 } = body;

    if (!jobRole && !resume) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "jobRole or resume is required" }),
      };
    }

    let userPrompt;
    if (jobRole) {
      userPrompt = `Generate ${questionCount} interview questions for: ${jobRole}

Include behavioral, technical, and situational questions. For each include a tip.

Respond with ONLY a raw JSON object. No markdown. No backticks. No explanation.
Example: {"questions":[{"type":"behavioral","question":"Tell me about yourself","tip":"Focus on relevant experience"}]}`;
    } else {
      userPrompt = `Generate ${questionCount} interview questions tailored to this candidate.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Respond with ONLY a raw JSON object. No markdown. No backticks. No explanation.
Example: {"questions":[{"type":"technical","question":"Explain Python decorators","tip":"Use a simple example"}]}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Anthropic API error");
    }

    let raw = data.content[0].text.trim();
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    const result = JSON.parse(raw);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error("interview error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Interview prep failed", details: err.message }),
    };
  }
};