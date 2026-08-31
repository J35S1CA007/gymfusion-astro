import { useEffect, useState } from "react";
import DateTimePicker from "./shadix-ui/DateTimePicker";

function localISODate(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function dateFromISO(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export default function HealthDateTimePicker() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("#healthInformationDate");
    const initialDate = dateFromISO(input?.value || "") || new Date();
    setDate(initialDate);
    if (input) input.value = localISODate(initialDate);
  }, []);

  function updateDate(selectedDate: Date) {
    const input = document.querySelector<HTMLInputElement>("#healthInformationDate");
    setDate(selectedDate);
    if (!input) return;
    input.value = localISODate(selectedDate);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <div
      data-datetimepicker-provider="@shadix-ui/datetimepicker"
      data-datetimepicker-ready={date ? "true" : "false"}
    >
      <DateTimePicker
        id="healthInformationDateTrigger"
        value={date}
        onDateChange={updateDate}
      />
    </div>
  );
}
