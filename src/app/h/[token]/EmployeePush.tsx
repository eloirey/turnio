"use client";

import { useCallback } from "react";
import { PushToggle } from "@/components/avisos/PushToggle";
import { removePushEmployee, savePushEmployee } from "./actions";

/** «Activar avisos» en la página del empleado. */
export function EmployeePush({ token }: { token: string }) {
  const save = useCallback((sub: unknown) => savePushEmployee(token, sub), [token]);
  const remove = useCallback((endpoint: string) => removePushEmployee(token, endpoint), [token]);
  return <PushToggle save={save} remove={remove} />;
}
