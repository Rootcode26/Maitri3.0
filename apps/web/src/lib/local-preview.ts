export const localPreviewEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_LOCAL_PREVIEW === "true";
