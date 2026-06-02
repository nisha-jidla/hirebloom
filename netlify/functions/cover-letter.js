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
    const { name, jobTitle, companyName, skills, resume, jobDescription, tone = "professional" } = body;

    if (!name && !resume) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Name or resume is required" }),
      };
    }

    let userPrompt;
    if (name) {
      userPrompt = `Write a cover letter for this applicant.

Name: ${name}
Job Title: ${jobTitle || "the advertised position"}
Company: ${companyName || "the company"}
Skills: ${skills || "not specified"}
Tone: ${tone}

Respond with ONLY a raw JSON object. No markdown. No backticks. No explanation.
Example: {"subject":"Application for Software Developer","coverLetter":"Dear Hiring Manager,\\n\\nI am writing..."}`;
    } else {
      userPrompt = `Write a cover letter based on this resume and job description. Tone: ${tone}.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Respond with ONLY a raw JSON object. No markdown. No backticks. No explanation.
Example: {"subject":"Application for Software Developer","coverLetter":"Dear Hiring Manager,\\n\\nI am writing..."}`;
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
    console.error("cover-letter error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Cover letter generation failed", details: err.message }),
    };
  }
};