import { Router } from "express";
import { taskSchema } from "../middleware/validate.js";
import { createTask, listTasks } from "../services/repositories.js";

export const tasksRouter = Router();

tasksRouter.get("/tasks", (_req, res) => {
  res.json({ items: listTasks() });
});

tasksRouter.post("/tasks", (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const created = createTask(parsed.data);
  return res.status(201).json(created);
});
