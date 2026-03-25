"use client";
import { MdCalendarToday, MdExpandLess, MdExpandMore } from 'react-icons/md';

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { parseDate } from "@internationalized/date";

const PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last 12 months", value: "12m" },
  { label: "Month to date", value: "mtd" },
  { label: "Year to date", value: "ytd" },
  { label: "Custom range", value: "custom" },
];

function getPresetLabel(value: string) {
  return PRESETS.find((p) => p.value === value)?.label ?? "Last 30 days";
}

export default function StatsDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const preset = searchParams.get("preset") ?? "30d";
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";

  const [open, setOpen] = useState(false);
  const [localPreset, setLocalPreset] = useState(preset);
  const [from, setFrom] = useState(fromParam);
  const [to, setTo] = useState(toParam);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function apply(p: string, f?: string, t?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", p);
    if (p === "custom") {
      if (f) params.set("from", f);
      if (t) params.set("to", t);
    } else {
      params.delete("from");
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function handlePresetClick(value: string) {
    setLocalPreset(value);
    if (value !== "custom") apply(value);
  }

  const displayLabel =
    preset === "custom" && fromParam && toParam
      ? `${fromParam} – ${toParam}`
      : getPresetLabel(preset);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-primary/10 rounded-lg text-xs sm:text-sm text-primary/70 shadow-sm hover:border-primary/30 transition-colors"
      >
        <MdCalendarToday
          className="text-primary/40"
          style={{ fontSize: "16px" }}
        />
        <span className="font-medium">{displayLabel}</span>
        {open ? (
          <MdExpandLess
            className="text-primary/40"
            style={{ fontSize: "16px" }}
          />
        ) : (
          <MdExpandMore
            className="text-primary/40"
            style={{ fontSize: "16px" }}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-transparent backdrop-blur-sm border border-primary/10 rounded-xl shadow-xl w-72 overflow-hidden">
          <div className="p-2">
            {PRESETS.filter((p) => p.value !== "custom").map((p) => (
              <button
                key={p.value}
                onClick={() => handlePresetClick(p.value)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  localPreset === p.value && preset !== "custom"
                    ? "bg-primary text-white font-semibold"
                    : "text-primary/70 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-primary/5 p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-primary/40 mb-3">
              Custom range
            </p>
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <DatePicker
                  className="w-full"
                  value={from ? parseDate(from) : null}
                  onChange={(date) => {
                    if (date) {
                      setFrom(date.toString());
                      setLocalPreset("custom");
                    }
                  }}
                >
                  <Label>From</Label>
                  <DateField.Group>
                    <DateField.Input>
                      {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DatePicker.Popover>
                    <Calendar aria-label="Start date">
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => (
                            <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                          )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => (
                            <Calendar.YearPickerCell year={year} />
                          )}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
              </div>

              <div className="space-y-1">
                <DatePicker
                  className="w-full"
                  value={to ? parseDate(to) : null}
                  onChange={(date) => {
                    if (date) {
                      setTo(date.toString());
                      setLocalPreset("custom");
                    }
                  }}
                >
                  <Label>To</Label>
                  <DateField.Group>
                    <DateField.Input>
                      {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DatePicker.Popover>
                    <Calendar aria-label="End date">
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => (
                            <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                          )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => (
                            <Calendar.YearPickerCell year={year} />
                          )}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
              </div>
              <button
                onClick={() => apply("custom", from, to)}
                disabled={!from || !to}
                className="mt-1 w-full bg-primary text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
