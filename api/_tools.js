'use strict';

const PLATFORM_TOOLS = [
  { id: 'gage-rr', label: 'Gage R&R' },
  { id: 'six-sigma', label: 'Six Sigma' },
  { id: 'feed-forward', label: 'FeedFoward' },
];

const buildDefaultToolFlags = (value = true) =>
  PLATFORM_TOOLS.reduce((acc, tool) => {
    acc[tool.id] = value;
    return acc;
  }, {});

const normalizeToolFlags = (value, defaultValue = true) =>
  PLATFORM_TOOLS.reduce((acc, tool) => {
    acc[tool.id] =
      value && typeof value[tool.id] === 'boolean' ? value[tool.id] : defaultValue;
    return acc;
  }, {});

const isToolEnabled = (flags, toolId, defaultValue = true) =>
  normalizeToolFlags(flags, defaultValue)[toolId] === true;

module.exports = {
  PLATFORM_TOOLS,
  buildDefaultToolFlags,
  normalizeToolFlags,
  isToolEnabled,
};
