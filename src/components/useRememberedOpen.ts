import { useState } from "react";
import { usePathname } from "next/navigation";
import { recall, remember } from "@/lib/viewMemory";

// Open/closed state that comes back when you return to this page (see
// viewMemory). Arriving afresh starts everything closed.
export function useRememberedOpen(key: string): [boolean, () => void] {
  const pathname = usePathname();
  const memoryKey = `open:${key}`;
  const [open, setOpen] = useState(() => recall(pathname, memoryKey) === "1");

  function toggle() {
    setOpen(!open);
    remember(pathname, memoryKey, open ? null : "1");
  }

  return [open, toggle];
}
