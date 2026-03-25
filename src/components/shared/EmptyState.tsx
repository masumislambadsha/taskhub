import { MdAccountBalanceWallet, MdAssignment, MdChatBubbleOutline, MdForum, MdGroup, MdInbox, MdMail, MdPayments, MdSearch, MdTask } from 'react-icons/md';
import { IconType } from "react-icons";

const ICON_MAP: Record<string, IconType> = {
  inbox: MdInbox,
  assignment: MdAssignment,
  task: MdTask,
  search: MdSearch,
  group: MdGroup,
  account_balance_wallet: MdAccountBalanceWallet,
  payments: MdPayments,
  mail: MdMail,
  forum: MdForum,
  chat_bubble_outline: MdChatBubbleOutline,
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: EmptyStateProps) {
  const Icon = ICON_MAP[icon] ?? MdInbox;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="text-6xl text-primary/20 mb-4" />
      <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-primary/60 text-sm max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
