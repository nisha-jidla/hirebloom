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
    // Style A (simple UI): { name, jobTitle, companyName, skills }
    // Style B (advanced):  { resume, jobDescription, tone }
    const { name, jobTitle, companyName, skills, resume, jobDescription, tone = "professional" } = body;

    if (!name && !resume) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Either (name + jobTitle + companyName) or (resume + jobDescription) are required" }),
      };
    }

    let userPrompt;
    if (name) {
      // Simple mode — matches the cover-letter.html UI
      userPrompt = `Write a compelling, professional cover letter for the following applicant.

Applicant Name: ${name}
Job Title Applying For: ${jobTitle || "the advertised position"}
Company Name: ${companyName || "the company"}
${skills ? `Key Skills / Background: ${skills}` : ""}
Tone: ${tone}

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Format:
{
  "subject": "<email subject line>",
  "coverLetter": "<full cover letter with \\n for paragraph breaks>"
}`;
    } else {
      // Advanced mode — resume + job description
      userPrompt = `Write a compelling cover letter based on this resume and job description. Tone: ${tone}.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Format:
{
  "subject": "<email subject line>",
  "coverLetter": "<full cover letter with \\n for paragraph breaks>"
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
    console.error("cover-letter error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Cover letter generation failed", details: err.message }),
    };
  }
};