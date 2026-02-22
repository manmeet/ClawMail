export const easings = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  inOutCubic: [0.65, 0, 0.35, 1] as const,
  springSmooth: { type: "spring" as const, stiffness: 400, damping: 30 },
  springBouncy: { type: "spring" as const, stiffness: 500, damping: 25 },
};

export const transitions = {
  pageEntry: { duration: 0.25, ease: easings.outExpo },
  threadOpen: { duration: 0.2, ease: easings.inOutCubic },
  replyDock: { type: "spring" as const, stiffness: 400, damping: 30 },
  commandPalette: { duration: 0.15, ease: "easeOut" },
  aiPanel: { type: "spring" as const, stiffness: 400, damping: 30 },
};
