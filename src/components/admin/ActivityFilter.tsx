"use client";

import {
  Dropdown,
  DropdownMenu,
  DropdownPopover,
  DropdownItem,
  DropdownItemIndicator,
  Button,
  Label,
} from "@heroui/react";
import { MdFilterList, MdExpandMore } from "react-icons/md";
import { useRouter, useSearchParams } from "next/navigation";
import type { Selection } from "@heroui/react";

const filters = [
  { key: "all", label: "All Events" },
  { key: "users", label: "New Users" },
  { key: "tasks", label: "Task Events" },
  { key: "submissions", label: "Submissions" },
  { key: "withdrawals", label: "Withdrawals" },
];

export default function ActivityFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") || "all";

  const selectedLabel =
    filters.find((f) => f.key === currentFilter)?.label || "All Events";

  const handleAction = (keys: Selection) => {
    const key = Array.from(keys)[0] as string;
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("filter");
    } else {
      params.set("filter", key);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <Dropdown>
      <div className="relative">
        <Button
          variant="outline"
          className="bg-white border-primary/10 text-primary/60 h-10 px-4 min-w-[160px] justify-between font-medium shadow-sm"
        >
          <div className="flex items-center gap-2">
            <MdFilterList className="text-lg opacity-60" />
            {selectedLabel}
          </div>
          <MdExpandMore className="text-lg opacity-40 ml-2" />
        </Button>
      </div>
      <DropdownPopover className="min-w-[180px] bg-transparent backdrop-blur-sm">
        <DropdownMenu
          aria-label="Filter activity"
          onSelectionChange={handleAction}
          selectedKeys={new Set([currentFilter])}
          selectionMode="single"
          className="text-primary"
        >
          {filters.map((f) => (
            <DropdownItem key={f.key} id={f.key} textValue={f.label}>
              <DropdownItemIndicator />
              <Label className="capitalize font-medium">{f.label}</Label>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  );
}
