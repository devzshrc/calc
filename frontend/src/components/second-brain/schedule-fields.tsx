import { Field, Input } from "@/components/_ui/form";
import { localDateTime } from "@/lib/scheduling";
export type ScheduleDraft = {
  scheduledStart: string;
  scheduledEnd: string;
  reminderAt: string;
};
export function scheduleDraft(task?: {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  reminderAt?: string | null;
}): ScheduleDraft {
  return {
    scheduledStart: localDateTime(task?.scheduledStart),
    scheduledEnd: localDateTime(task?.scheduledEnd),
    reminderAt: localDateTime(task?.reminderAt),
  };
}
export function schedulePayload(draft: ScheduleDraft) {
  if (Boolean(draft.scheduledStart) !== Boolean(draft.scheduledEnd))
    throw new Error("Choose both a start and end time");
  if (
    draft.scheduledStart &&
    new Date(draft.scheduledEnd) <= new Date(draft.scheduledStart)
  )
    throw new Error("End time must be after start time");
  return {
    scheduledStart: draft.scheduledStart
      ? new Date(draft.scheduledStart).toISOString()
      : null,
    scheduledEnd: draft.scheduledEnd
      ? new Date(draft.scheduledEnd).toISOString()
      : null,
    reminderAt: draft.reminderAt
      ? new Date(draft.reminderAt).toISOString()
      : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
export default function ScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleDraft;
  onChange: (patch: Partial<ScheduleDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Start time" htmlFor="schedule-start">
          <Input
            id="schedule-start"
            type="datetime-local"
            step={900}
            value={value.scheduledStart}
            onChange={(e) =>
              onChange({
                scheduledStart: e.target.value,
                ...(!value.scheduledEnd && e.target.value
                  ? {
                      scheduledEnd: localDateTime(
                        new Date(
                          new Date(e.target.value).getTime() + 30 * 60000,
                        ).toISOString(),
                      ),
                    }
                  : {}),
              })
            }
          />
        </Field>
        <Field label="End time" htmlFor="schedule-end">
          <Input
            id="schedule-end"
            type="datetime-local"
            step={900}
            value={value.scheduledEnd}
            onChange={(e) => onChange({ scheduledEnd: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Remind me"
        htmlFor="schedule-reminder"
        hint="Uses your device’s timezone. Enable phone reminders in Connections."
      >
        <Input
          id="schedule-reminder"
          type="datetime-local"
          value={value.reminderAt}
          onChange={(e) => onChange({ reminderAt: e.target.value })}
        />
      </Field>
    </div>
  );
}
