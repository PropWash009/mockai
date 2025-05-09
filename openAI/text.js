const express = require("express");
const { getRandomContents } = require("../utils/randomContents");
const { tokenize } = require("../utils/tokenize");
const delay = require("../utils/delay")
const { requestCounter, requestLatency, payloadSize } = require("../utils/metrics")


const router = express.Router();

router.post("/v1/completions", async (req, res) => {
  then = Date.now();
  const delayHeader = req.headers["x-set-response-delay-ms"]

  let delayTime = parseInt(delayHeader) || parseInt(process.env.RESPONSE_DELAY_MS) || 0

  await delay(delayTime)
  const defaultMockType = process.env.MOCK_TYPE || "random";
  const {
    model,
    prompt,
    stream,
    mockType = defaultMockType,
    mockFixedContents,
  } = req.body;
  const randomResponses = getRandomContents();

  // Check if 'messages' is provided and is an array
  if (!prompt) {
    requestCounter.inc({ method: "POST", path: "/v1/completions", status: 400 });
    requestLatency.observe({ method: "POST", path: "/v1/completions", status: 400 }, (Date.now() - then));
    payloadSize.observe({ method: "POST", path: "/v1/completions", status: 400 }, req.socket.bytesRead);
    return res
      .status(400)
      .json({ error: 'Missing or invalid "prompt" in request body' });
  }
  if (!model) {
    requestCounter.inc({ method: "POST", path: "/v1/completions", status: 400 });
    requestLatency.observe({ method: "POST", path: "/v1/completions", status: 400 }, (Date.now() - then));
    payloadSize.observe({ method: "POST", path: "/v1/completions", status: 400 }, req.socket.bytesRead);
    return res
      .status(400)
      .json({ error: 'Missing or invalid "model" in request body' });
  }

  // Check if 'stream' is a boolean
  if (stream !== undefined && typeof stream !== "boolean") {
    requestCounter.inc({ method: "POST", path: "/v1/completions", status: 400 });
    requestLatency.observe({ method: "POST", path: "/v1/completions", status: 400 }, (Date.now() - then));
    payloadSize.observe({ method: "POST", path: "/v1/completions", status: 400 }, req.socket.bytesRead);
    return res.status(400).json({ error: 'Invalid "stream" in request body' });
  }

  // Get response content
  let content;
  switch (mockType) {
    case "echo":
      content = messages[messages.length - 1].content;
      break;
    case "random":
      content =
        randomResponses[Math.floor(Math.random() * randomResponses.length)];
      break;
    case "fixed":
      content = mockFixedContents;
      break;
  }

  // Generate a mock response
  // If 'stream' is true, set up a Server-Sent Events stream
  if (stream) {
    // Set the headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const data = {
      id: "cmpl-7UR4UcvmeD79Xva3UxkKkL2es6b5W",
      object: "text_completion",
      created: Date.now(),
      model: model,
      choices: [
        {
          index: 0,
          text: "",
          logprobs: null,
          finish_reason: null,
        },
      ],
    };

    const intervalTime = 100;
    let chunkIndex = 0;
    let tokens = tokenize(content); // Tokenize the content
    let intervalId = setInterval(() => {
      if (chunkIndex < tokens.length) {
        data.choices[0].text = tokens[chunkIndex];
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        chunkIndex++;
      } else {
        clearInterval(intervalId);
        data.choices[0] = {
          delta: {},
          finish_reason: "stop",
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.write(`data: [DONE]\n\n`);
        requestCounter.inc({ method: "POST", path: "/v1/completions", status: 200 });
        requestLatency.observe({ method: "POST", path: "/v1/completions", status: 200 }, (Date.now() - then));
        payloadSize.observe({ method: "POST", path: "/v1/completions", status: 200 }, req.socket.bytesRead);
        res.end();
      }
    }, intervalTime);
  } else {
    const n = req.body.n || 1; // Get 'n' from request body, default to 1 if not provided
    const choices = [];

    for (let i = 0; i < n; i++) {
      choices.push({
        text: content,
        finish_reason: "stop",
        logprobs: null,
        index: i,
      });
    }

    const response = {
      id: "cmpl-2nYZXNHxx1PeK1u8xXcE1Fqr1U6Ve",
      object: "text_completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 50,
        total_tokens: 60,
      },
      choices: choices,
    };
    // Send the response
    requestCounter.inc({ method: "POST", path: "/v1/completions", status: 200 });
    requestLatency.observe({ method: "POST", path: "/v1/completions", status: 200 }, (Date.now() - then));
    payloadSize.observe({ method: "POST", path: "/v1/completions", status: 200 }, req.socket.bytesRead);
    res.json(response);
  }
});

module.exports = router;
