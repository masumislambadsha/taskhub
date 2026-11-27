import mongoose, { Schema, Model } from "mongoose";

export interface ITaskViewDoc {
  taskId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  /** The first time this worker opened the task. Never moved later, so reopening does not restart the clock. */
  viewedAt: Date;
}

const TaskViewSchema = new Schema<ITaskViewDoc>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    viewedAt: { type: Date, required: true },
  },
  { collection: "task_views", versionKey: false },
);

TaskViewSchema.index({ taskId: 1, workerId: 1 }, { unique: true });
TaskViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const TaskView: Model<ITaskViewDoc> =
  mongoose.models.TaskView || mongoose.model<ITaskViewDoc>("TaskView", TaskViewSchema);

export default TaskView;
