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
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { resume, jobdesc } = JSON.parse(event.body);

    if (!resume || !jobdesc) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Resume and job description are required",
        }),
      };
    }

    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-1-20250805",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `
You are an ATS Resume Expert.

Analyze the resume against the job description.

Return ONLY valid JSON in this exact format:

{
  "score": 85,
  "strengths": [
    "Strong experience in AWS",
    "Good Terraform knowledge"
  ],
  "improvements": [
    "Add more measurable achievements",
    "Include CI/CD project details"
  ],
  "keywords_matched": [
    "AWS",
    "Terraform"
  ],
  "keywords_missing": [
    "Docker",
    "Kubernetes"
  ]
}

RESUME:
${resume}

JOB DESCRIPTION:
${jobdesc}
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            data.error?.message || "Anthropic API error",
        }),
      };
    }

    let raw = data.content[0].text.trim();

    raw = raw
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const result = JSON.parse(raw);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Analyze error:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};