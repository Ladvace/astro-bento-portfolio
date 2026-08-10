export type WipeVariantPaths = {
  id: string;
  label: string;
  collapsedBottom: string;
  enterFromBottom: string;
  filledFromBottom: string;
  leaveFromTop: string;
  unfilledTop: string;
};

const classic: WipeVariantPaths = {
  id: "classic",
  label: "Classic",
  collapsedBottom: "M 0 100 V 100 Q 50 100 100 100 V 100 z",
  enterFromBottom: "M 0 100 V 50 Q 50 0 100 50 V 100 z",
  filledFromBottom: "M 0 100 V 0 Q 50 0 100 0 V 100 z",
  leaveFromTop: "M 0 0 V 50 Q 50 0 100 50 V 0 z",
  unfilledTop: "M 0 0 V 0 Q 50 0 100 0 V 0 z",
};

const asymmetric: WipeVariantPaths = {
  id: "asymmetric",
  label: "Asymmetric",
  collapsedBottom: "M 0 100 V 100 Q 50 100 100 100 V 100 z",
  enterFromBottom: "M 0 100 V 50 Q 35 0 100 55 V 100 z",
  filledFromBottom: "M 0 100 V 0 Q 50 0 100 0 V 100 z",
  leaveFromTop: "M 0 0 V 50 Q 65 0 100 45 V 0 z",
  unfilledTop: "M 0 0 V 0 Q 50 0 100 0 V 0 z",
};

export const WIPE_VARIANT_LIST: readonly WipeVariantPaths[] = [
  classic,
  asymmetric,
] as const;

export const WIPE_VARIANTS: Readonly<Record<string, WipeVariantPaths>> =
  Object.fromEntries(WIPE_VARIANT_LIST.map((v) => [v.id, v]));
