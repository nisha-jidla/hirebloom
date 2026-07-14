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

    const name = String(payload.name || "").trim();

    const resume = String(
      payload.resume ||
      payload.background ||
      payload.skills ||
      ""
    ).trim();

    const jobdesc = String(
      payload.jobdesc ||
      payload.jobDescription ||
      payload.job_description ||
      ""
    ).trim();

    const jobTitle = String(
      payload.jobTitle ||
      payload.role ||
      ""
    ).trim();

    const company = String(
      payload.company ||
      payload.companyName ||
      ""
    ).trim();

    const tone = String(
      payload.tone || "professional"
    ).trim();

    /*
      Supports both request formats:

      Full form:
      { name, resume, jobdesc, tone }

      Simple test form:
      { name, jobTitle, company, skills }
    */

    const resolvedJobDescription =
      jobdesc ||
      [
        jobTitle ? `Job title: ${jobTitle}` : "",
        company ? `Company: ${company}` : "",
      ]
        .filter(Boolean)
        .join("\n");

    if (!name || !resume || !resolvedJobDescription) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error:
            "Name, applicant background, and job details are required.",
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
          temperature: 0.5,
          messages: [
            {
              role: "user",
              content: `Write a ${tone} cover letter for ${name}.

JOB TITLE:
${jobTitle || "Not separately provided"}

COMPANY:
${company || "Not separately provided"}

APPLICANT RESUME / BACKGROUND:
${resume}

JOB DESCRIPTION / JOB DETAILS:
${resolvedJobDescription}

Requirements:
- Address it to "Dear Hiring Manager"
- Use 3 to 4 concise paragraphs
- Open with a strong, natural introduction
- Highlight 2 to 3 relevant skills or experiences
- Show genuine interest in the role
- End with a confident call to action
- Sign off with the applicant's name
- Sound professional and human
- Do not invent qualifications, employers, or achievements
- Return only the cover letter`,
            },
          ],
        }),
      }
    );

    const anthropicData = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      console.error(
        "Anthropic cover-letter error:",
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

    const coverLetter = Array.isArray(anthropicData.content)
      ? anthropicData.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim()
      : "";

    if (!coverLetter) {
      throw new Error("Anthropic returned no cover-letter text.");
    }

    /*
      Return a simple shape for the HireBloom page,
      while also keeping the raw Anthropic response for debugging.
    */
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        coverLetter,
        content: coverLetter,
        raw: anthropicData,
      }),
    };
  } catch (error) {
    console.error("Cover-letter function error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || "Cover-letter generation failed.",
      }),
    };
  }
};
