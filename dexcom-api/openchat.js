import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const corsOptions = {
  origin: 'http://localhost:3000', // or use a function to dynamically set the allowed origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // add any headers your client needs
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

//app.use(cors(corsOptions));

app.use(cors());
app.use(express.json());

app.post("/ask-gpt", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Set streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    //res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    // Call OpenAI with streaming enabled
    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      stream: true,
      messages: [
        {
          role: "assistant",
          content:
            "As an endocrinologist diabetes coach, provide a 2-paragraph summary (max 95 words) based on the events below. In a second paragraph provide 2 self-management recommendations (bullets) . Briefly explain glucose trends and bolus timing (early, late, expected) based on the input data and cleanly format your answer, starting with '<h2>Daily Summary:</h2>, using <p> and <br /> tags. Do not reiterate the input data: |" +
            message,
        },
      ],
    });

    // Process the stream and send chunks as they arrive
    for await (const chunk of stream) {
      // Depending on the library, the chunk structure might vary.
      // Here we assume each chunk contains a 'choices' array with a 'delta' object.
      const text = chunk.choices[0].delta?.content;
      if (text) {
        // Write the text chunk as an SSE data event
        res.write(`${text}`);
      }
    }
    res.end();
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    // If an error occurs, it's best to send a final event before ending the stream
    res.write(`data: [ERROR] Internal Server Error\n\n`);
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
