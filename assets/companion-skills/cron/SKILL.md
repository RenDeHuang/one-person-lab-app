---
name: cron
description: Scheduled task management - create, query, update scheduled tasks to automatically execute operations at specified times.
---

# Scheduled Task Skill

Use this skill when the user asks to create, list, or update a scheduled task.

## Important Rules

1. One task per conversation.
2. Output cron commands directly. Do not wrap them in markdown code blocks.
3. Always include closing tags. `[CRON_CREATE]` must end with `[/CRON_CREATE]`, and `[CRON_UPDATE]` must end with `[/CRON_UPDATE]`.

## Workflow

This is a two-step workflow. Each step is one message turn.

Step 1: Query

Output `[CRON_LIST]` and nothing else, then wait for the system response.

Step 2: Act

- If no scheduled task exists, output `[CRON_CREATE]` in this message.
- If a task exists and the user wants to change it, output `[CRON_UPDATE: <job-id>]` to modify it in place.
- If a task exists and the user wants something different, ask the user how to proceed.

## Create

Output this format directly:

[CRON_CREATE]
name: Task name
schedule: Cron expression
schedule_description: Human-readable description
message: Message content
[/CRON_CREATE]

Required fields:

- `name`: short descriptive name.
- `schedule`: valid cron expression.
- `schedule_description`: human-readable schedule.
- `message`: complete self-contained instruction sent to the AI when the task fires.

The `message` must tell the AI exactly what to do. Do not restate the user's scheduling request.

Example:

[CRON_CREATE]
name: Weekly Meeting Reminder
schedule: 0 9 * * MON
schedule_description: Every Monday at 9:00 AM
message: Reply with a short weekly meeting reminder that includes the current date and time.
[/CRON_CREATE]

## Update

Use this to modify an existing task in place:

[CRON_UPDATE: <job-id>]
name: Updated task name
schedule: New cron expression
schedule_description: Human-readable description
message: Updated message content
[/CRON_UPDATE]

Replace `<job-id>` with the real job ID from `[CRON_LIST]`. All four fields are required.

## Query

Output `[CRON_LIST]` directly.

## Cron Expression

Format: `minute hour day-of-month month day-of-week`.

Example: `0 9 * * MON-FRI` means weekdays at 9:00 AM.
