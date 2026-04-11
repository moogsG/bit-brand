import { Badge } from "@/components/ui/badge";

interface ClientStatusBadgeProps {
  isActive: boolean;
}

export function ClientStatusBadge({ isActive }: ClientStatusBadgeProps) {
  return (
    <Badge
      variant={isActive ? "default" : "secondary"}
      className={
        isActive
          ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
          : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
