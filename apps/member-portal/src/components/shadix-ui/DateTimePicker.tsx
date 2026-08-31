import { useEffect, useRef, useState } from "react";

export interface DateTimePickerProps {
  id: string;
  onDateChange: (date: Date) => void;
  value: Date | null;
}

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(left: Date | null, right: Date) {
  return Boolean(
    left
      && left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate(),
  );
}

function localISODate(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

// Adapted from the MIT-licensed @shadix-ui/datetimepicker registry component.
export default function DateTimePicker({ id, onDateChange, value }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => value || new Date(2000, 0, 1));
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (value) setCurrentMonth(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !focusedDate) return;
    const frame = requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date-value="${localISODate(focusedDate)}"]`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentMonth, focusedDate, isOpen]);

  const days = calendarDays(currentMonth);
  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
  }).format(currentMonth);
  const selectedLabel = value
    ? new Intl.DateTimeFormat("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(value)
    : "Select date";

  function changeMonth(offset: number) {
    const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(month);
    setFocusedDate(month);
  }

  function selectDate(date: Date) {
    onDateChange(date);
    setCurrentMonth(date);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function toggleCalendar() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const date = value || new Date();
    setCurrentMonth(date);
    setFocusedDate(date);
    setIsOpen(true);
  }

  function moveDayFocus(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    const dayOffsets: Record<string, number> = {
      ArrowDown: 7,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      End: 6 - date.getDay(),
      Home: -date.getDay(),
    };
    let nextDate: Date | null = null;

    if (event.key in dayOffsets) {
      nextDate = new Date(date);
      nextDate.setDate(date.getDate() + dayOffsets[event.key]);
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      const monthOffset = event.key === "PageDown" ? 1 : -1;
      const targetMonth = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
      const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
      nextDate = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth(),
        Math.min(date.getDate(), lastDay),
      );
    }

    if (!nextDate) return;
    event.preventDefault();
    setFocusedDate(nextDate);
    if (
      nextDate.getMonth() !== currentMonth.getMonth()
      || nextDate.getFullYear() !== currentMonth.getFullYear()
    ) {
      setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }

  return (
    <div ref={rootRef} className="gf-datetimepicker">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="gf-datetimepicker-trigger"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggleCalendar}
      >
        <span>{selectedLabel}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
          <path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="gf-datetimepicker-popover" role="dialog" aria-label="Choose date">
          <div className="gf-datetimepicker-header">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
              <span aria-hidden="true">&#8249;</span>
            </button>
            <strong aria-live="polite">{monthLabel}</strong>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
              <span aria-hidden="true">&#8250;</span>
            </button>
          </div>

          <div className="gf-datetimepicker-weekdays" aria-hidden="true">
            {weekDays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="gf-datetimepicker-grid">
            {days.map((date) => {
              const selected = sameDay(value, date);
              const isToday = sameDay(today, date);
              const outsideMonth = date.getMonth() !== currentMonth.getMonth();
              return (
                <button
                  key={localISODate(date)}
                  type="button"
                  className="gf-datetimepicker-day"
                  data-date-value={localISODate(date)}
                  data-outside-month={outsideMonth || undefined}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={new Intl.DateTimeFormat("en-AU", { dateStyle: "full" }).format(date)}
                  aria-pressed={selected}
                  tabIndex={sameDay(focusedDate, date) ? 0 : -1}
                  onClick={() => selectDate(date)}
                  onKeyDown={(event) => moveDayFocus(event, date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
