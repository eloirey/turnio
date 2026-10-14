import { roleStyle, type Role } from "@/lib/roles";

export function RoleBadge({ role, fallback }: { role?: Role; fallback?: string }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-semibold" style={roleStyle(role?.color)}>
      {role?.name ?? fallback ?? "Sin puesto"}
    </span>
  );
}
