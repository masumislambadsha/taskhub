import { Suspense } from "react";
import MessagesUI from "@/components/messages/MessagesUI";

export default function WorkerMessagesPage() {
  return (
    <Suspense>
      <MessagesUI
        role="worker"
        emptyHint="Start by messaging a buyer from a task page"
        selectHint="Or start one from a task page"
      />
    </Suspense>
  );
}
