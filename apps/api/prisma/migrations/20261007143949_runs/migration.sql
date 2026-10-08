-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "RunKind" AS ENUM ('MANUAL', 'SCHEDULE', 'FAILURE');

-- CreateEnum
CREATE TYPE "NodeRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "failure_workflow_id" UUID;

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "kind" "RunKind" NOT NULL,
    "graph" JSONB NOT NULL,
    "trigger_input" JSONB NOT NULL,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_runs" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_key" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "NodeRunStatus" NOT NULL,
    "port" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "node_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_workflow_id_created_at_idx" ON "runs"("workflow_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "node_runs_run_id_node_key_attempt_key" ON "node_runs"("run_id", "node_key", "attempt");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_failure_workflow_id_fkey" FOREIGN KEY ("failure_workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_runs" ADD CONSTRAINT "node_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 같은 워크플로우에서 대기·실행 중인 기록은 하나만. 실패 알림 실행은 제외한다(DECISIONS 7-5, A-1).
-- 부분 유니크 인덱스는 Prisma 스키마로 쓸 수 없어서 직접 작성한다.
CREATE UNIQUE INDEX "runs_one_active_per_workflow" ON "runs"("workflow_id")
  WHERE "status" IN ('PENDING', 'RUNNING') AND "kind" <> 'FAILURE';
