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

    // Support BOTH input styles:
    // Style A (simple UI):  { jobRole }
    // Style B (advanced):   { resume, jobDescription, questionCount }
    const { jobRole, resume, jobDescription, questionCount = 5 } = body;

    if (!jobRole && !resume) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Either jobRole or (resume + jobDescription) are required" }),
      };
    }

    let userPrompt;
    if (jobRole) {
      // Simple mode — matches the interview-prep.html UI
      userPrompt = `Generate ${questionCount} realistic interview questions for a candidate applying for the role of: ${jobRole}.

Include a mix of behavioral, technical, and situational questions. For each, include a helpful answering tip.

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Format:
{
  "questions": [
    {
      "type": "behavioral|technical|situational",
      "question": "<the interview question>",
      "tip": "<concise tip on how to answer this well>"
    }
  ]
}`;
    } else {
      // Advanced mode — resume + job description
      userPrompt = `Generate ${questionCount} tailored interview questions for this candidate and role.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Include behavioral, technical, and situational questions. For each, include a tip personalized to the candidate's background.

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Format:
{
  "questions": [
    {
      "type": "behavioral|technical|situational",
      "question": "<the interview question>",
      "tip": "<personalized tip based on the resume>"
    }
  ]
}`;
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
      console.error("Anthropic API error:", data);
      throw new Error(data.error?.message || "Anthropic API error");
    }

    const raw = data.content[0].text.trim().replace(/```json|```/g, "").trim();
    const result = JSON.parse(raw);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error("interview error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Interview prep failed", details: err.message }),
    };
  }
};