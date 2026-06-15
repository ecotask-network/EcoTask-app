import { fetchTasks, fetchTaskById } from "../api";

describe("API Integration", () => {
  it("fetchTasks returns paginated results", async () => {
    const result = await fetchTasks({ page: 1, limit: 5 });
    expect(result.tasks).toBeDefined();
    expect(Array.isArray(result.tasks)).toBe(true);
  });

  it("fetchTaskById returns a single task", async () => {
    const list = await fetchTasks({ page: 1, limit: 1 });
    if (list.tasks.length > 0) {
      const task = await fetchTaskById(list.tasks[0].id);
      expect(task.id).toBe(list.tasks[0].id);
      expect(task.title).toBeDefined();
    }
  });
});
