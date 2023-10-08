import express from "express";
import { errorMiddleware } from "./middlewares/error.js";
import { blogAnalytics, blogSearch } from "./controllers/blog.js";

const app = express();

// middlewares
app.use(express.json());

// routes

// Data Retrieval endpoint
app.get("/api/blog-stats", blogAnalytics);

// Blog Search Endpoint
app.get("/api/blog-search", blogSearch)

app.get("/", (req, res) => {
  res.send("Hello Everybody");
});

// Using error middleware
app.use(errorMiddleware);

export default app;