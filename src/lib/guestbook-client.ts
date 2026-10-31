import {
  avatarColorForSeed,
  getInitials,
  GUESTBOOK_NAME_CLASS,
  type GuestbookEntry,
} from "./guestbook";

export type CreatedGuestbookEntry = Pick<
  GuestbookEntry,
  "id" | "name" | "message" | "website" | "parentId"
>;

type GuestbookSubmission = {
  name: string;
  message: string;
  website: string | undefined;
};

type GuestbookReplySubmission = {
  message: string;
  parentId: number;
};

type GuestbookErrorBody = {
  error?: string;
};

const GENERIC_ERROR_MESSAGE = "Failed to submit. Please try again.";

// Templates are rendered with a placeholder entry (id 0, website set), so the
// markup lives only in the Astro components.
export const createEntryElement = (
  templateId: string,
  entry: CreatedGuestbookEntry,
): HTMLElement | null => {
  const template = document.getElementById(
    templateId,
  ) as HTMLTemplateElement | null;
  const article = template?.content.querySelector("article");
  if (!article) return null;

  const element = article.cloneNode(true) as HTMLElement;
  const message = element.querySelector("[data-entry-message]");
  const avatar = element.querySelector("[data-entry-avatar]");
  const link = element.querySelector<HTMLAnchorElement>("[data-entry-link]");
  const name = element.querySelector("[data-entry-name]");
  if (!message || !avatar || !link || !name) return null;

  element.dataset.entryId = String(entry.id);
  message.textContent = entry.message;
  avatar.textContent = getInitials(entry.name);
  avatar.classList.replace(avatarColorForSeed(0), avatarColorForSeed(entry.id));
  name.textContent = entry.name;

  if (entry.website) {
    link.href = entry.website;
  } else {
    name.className = GUESTBOOK_NAME_CLASS;
    link.replaceWith(name);
  }

  return element;
};

export const createFormStatus = (form: HTMLFormElement) => {
  const errorElement = form.querySelector<HTMLElement>("[data-form-error]");
  const submitButton = form.querySelector<HTMLButtonElement>(
    "button[type=submit]",
  );
  const idleLabel = submitButton?.textContent?.trim() ?? "";

  return {
    showError: (errorMessage: string | null): void => {
      if (!errorElement) return;
      errorElement.textContent = errorMessage ?? "";
      errorElement.classList.toggle("hidden", !errorMessage);
    },
    setSubmitting: (isSubmitting: boolean): void => {
      if (!submitButton) return;
      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? "Sending..." : idleLabel;
    },
  };
};

export const readGuestbookSubmission = (
  form: HTMLFormElement,
): GuestbookSubmission => {
  const formData = new FormData(form);
  const website = (formData.get("website") ?? "").toString().trim();
  return {
    name: (formData.get("name") ?? "").toString().trim(),
    message: (formData.get("message") ?? "").toString().trim(),
    website: website || undefined,
  };
};

export const postGuestbookEntry = async (
  submission: GuestbookSubmission | GuestbookReplySubmission,
): Promise<{ entry: CreatedGuestbookEntry } | { error: string }> => {
  try {
    const response = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const errorBody: GuestbookErrorBody = await response
        .json()
        .catch(() => ({}));
      return { error: errorBody.error ?? GENERIC_ERROR_MESSAGE };
    }

    return { entry: (await response.json()) as CreatedGuestbookEntry };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
};
