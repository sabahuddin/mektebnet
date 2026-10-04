import { Fragment } from "react";
import { linkifyText } from "../lib/linkify-text";

export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {linkifyText(text).map((part, index) => part.href ? (
        <a
          key={index}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
          onClick={(event) => event.stopPropagation()}
        >
          {part.text}
        </a>
      ) : (
        <Fragment key={index}>{part.text}</Fragment>
      ))}
    </>
  );
}