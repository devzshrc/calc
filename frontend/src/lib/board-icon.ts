import CubeIcon from "@/assets/icons/cube-01.svg?react";
import LayersIcon from "@/assets/icons/layers-three-01.svg?react";
import UsersIcon from "@/assets/icons/users-02.svg?react";
import ClipboardCheckIcon from "@/assets/icons/clipboard-check.svg?react";

export function boardIcon(title: string) {
  const key = title.toLowerCase();
  if (key.includes("goal")) return CubeIcon;
  if (key.includes("stud") || key.includes("school") || key.includes("learn")) {
    return ClipboardCheckIcon;
  }
  if (key.includes("life") || key.includes("home")) return UsersIcon;
  return LayersIcon;
}
