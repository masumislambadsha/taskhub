import { Suspense } from "react";
import MessagesUI from "@/components/messages/MessagesUI";

export default function BuyerMessagesPage() {
  return (
    <Suspense>
      <MessagesUI
        role="buyer"
        emptyHint="Workers will message you about your tasks"
        selectHint="Workers will message you about your tasks"
      />
    </Suspense>
  );
}
