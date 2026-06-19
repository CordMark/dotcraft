"use client";

import { type FormEvent, useState } from "react";

type FormState = {
  kind: "idle" | "success" | "error";
  message: string;
  pending: boolean;
};

const initialState: FormState = {
  kind: "idle",
  message: "",
  pending: false,
};

async function submitForm(
  event: FormEvent<HTMLFormElement>,
  setState: (state: FormState) => void,
) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  setState({ kind: "idle", message: "", pending: true });

  try {
    const response = await fetch("/api/contact", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      setState({
        kind: "error",
        message: result.message || "送信に失敗しました。",
        pending: false,
      });
      return;
    }

    form.reset();
    setState({
      kind: "success",
      message: result.message || "送信しました。",
      pending: false,
    });
  } catch {
    setState({
      kind: "error",
      message: "通信に失敗しました。時間をおいて再度お試しください。",
      pending: false,
    });
  }
}

function FormStatus({ state }: { state: FormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={`form-status ${state.kind}`} aria-live="polite">
      {state.message}
    </p>
  );
}

export function NewsletterForm() {
  const [state, setState] = useState<FormState>(initialState);

  return (
    <form className="newsletter-form" onSubmit={(event) => submitForm(event, setState)}>
      <label className="sr-only" htmlFor="newsletter-email">
        メールアドレス
      </label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        placeholder="メールアドレスを入力"
        autoComplete="email"
        required
      />
      <button type="submit" disabled={state.pending}>
        {state.pending ? "送信中..." : "登録する"}
      </button>
      <p>
        登録することで、
        <a href="/privacy-policy">プライバシーポリシー</a>
        に同意したものとみなされます。
      </p>
      <FormStatus state={state} />
      <input type="hidden" name="formType" value="newsletter" />
      <input
        className="sr-only"
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
    </form>
  );
}

export function ContactForm() {
  const [state, setState] = useState<FormState>(initialState);

  return (
    <form className="contact-form" onSubmit={(event) => submitForm(event, setState)}>
      <label>
        お名前
        <input
          type="text"
          name="name"
          placeholder="例）山田 太郎"
          autoComplete="name"
          maxLength={120}
          required
        />
      </label>
      <label>
        メールアドレス
        <input
          type="email"
          name="email"
          placeholder="例）yamada@example.com"
          autoComplete="email"
          required
        />
      </label>
      <label>
        カテゴリ
        <select name="category" defaultValue="" required>
          <option value="" disabled>
            選択してください
          </option>
          <option value="コラボレーション">コラボレーション</option>
          <option value="取材・メディア掲載">取材・メディア掲載</option>
          <option value="講演・登壇">講演・登壇</option>
          <option value="その他">その他</option>
        </select>
      </label>
      <label>
        メッセージ
        <textarea
          name="message"
          placeholder="ご用件の詳細をご記入ください"
          rows={5}
          maxLength={5000}
          required
        />
      </label>
      <button type="submit" disabled={state.pending}>
        {state.pending ? "送信中..." : "送信する"}
      </button>
      <FormStatus state={state} />
      <input type="hidden" name="formType" value="contact" />
      <input
        className="sr-only"
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
    </form>
  );
}
