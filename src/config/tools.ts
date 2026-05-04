export const PLATFORM_TOOLS = [
  { id: 'gage-rr', label: 'Gage R&R' },
  { id: 'six-sigma', label: 'Six Sigma' },
  { id: 'feed-forward', label: 'FeedFoward' },
] as const;

export type ToolId = (typeof PLATFORM_TOOLS)[number]['id'];
export type ToolFlags = Record<ToolId, boolean>;

export const buildDefaultToolFlags = (value = true): ToolFlags =>
  PLATFORM_TOOLS.reduce((acc, tool) => {
    acc[tool.id] = value;
    return acc;
  }, {} as ToolFlags);

export const normalizeToolFlags = (
  value: Partial<Record<string, unknown>> | null | undefined,
  defaultValue = true
): ToolFlags =>
  PLATFORM_TOOLS.reduce((acc, tool) => {
    acc[tool.id] = typeof value?.[tool.id] === 'boolean' ? Boolean(value[tool.id]) : defaultValue;
    return acc;
  }, {} as ToolFlags);

export const isToolEnabled = (
  flags: Partial<Record<string, unknown>> | null | undefined,
  toolId: ToolId,
  defaultValue = true
) => normalizeToolFlags(flags, defaultValue)[toolId];
