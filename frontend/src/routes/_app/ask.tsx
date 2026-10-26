import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/_ui/button";
import { PageHeader } from "@/components/second-brain/page";
import { errorMessage } from "@/components/second-brain/capture-dialog";
import { aiAsk } from "@/server/ai";
import { listJournal } from "@/server/workspace";
import { todayKey } from "@/lib/dates";
import { EASE_OUT } from "@/lib/easings";
import { cn } from "@/lib/utils";
import StarsIcon from "@/assets/icons/stars.svg?react";
import ArrowUpIcon from "@/assets/icons/arrow-narrow-up.svg?react";

// A private conversation with nothing to index: render it on the client only.
export const Route = createFileRoute("/_app/ask")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ask - Kanban" }] }),
  loader: () => listJournal({ data: { limit: 14 } }),
  pendingComponent: () => <PageHeader icon={StarsIcon} title="Ask" />,
  component: Ask,
});

type Message = { role: "user" | "assistant"; content: string; error?: boolean };

const PROMPTS = [
  "What should I focus on this week?",
  "Which goals are stalling, and what's one next step for each?",
  "What did I get done in the last 7 days?",
  "Is my week overloaded? What could I drop?",
];

function Ask() {
  const journal = Route.useLoaderData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    const history = messages
      .filter((m) => !m.error)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    setMessages((all) => [...all, { role: "user", content: text }]);
    setInput("");
    setPending(true);
    try {
      const { answer } = await aiAsk({
        data: {
          question: text,
          today: todayKey(),
          history,
          journal: journal.map(({ day, text }) => ({ day, text: text.slice(0, 4000) })),
        },
      });
      setMessages((all) => [...all, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessages((all) => [
        ...all,
        { role: "assistant", content: errorMessage(error, "Couldn't get an answer"), error: true },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <>
      <PageHeader
        icon={StarsIcon}
        title="Ask"
        actions={
          messages.length > 0 && (
            <Button variant="secondary" size="md" onClick={() => setMessages([])}>
              New chat
            </Button>
          )
        }
      />
      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="bg-secondary shadow-ring flex size-12 items-center justify-center rounded-2xl">
                <StarsIcon aria-hidden className="text-icon size-5" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h2>Ask your second brain</h2>
                <p className="text-muted-foreground max-w-[30em]">
                  Answers come from your boards, habits, goals and the last two weeks of your journal.
                </p>
              </div>
              <div className="flex max-w-[560px] flex-wrap justify-center gap-2">
                {PROMPTS.map((prompt) => (
                  <Button key={prompt} variant="chip" size="md" onClick={() => send(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, transform: "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role === "user" ? (
                  <p className="bg-secondary shadow-ring max-w-[80%] rounded-2xl px-3.5 py-2.5 leading-[150%] whitespace-pre-line">
                    {message.content}
                  </p>
                ) : (
                  <div className="shadow-card flex max-w-[90%] gap-3 rounded-2xl bg-card p-4">
                    <StarsIcon aria-hidden className="text-icon mt-[3px] size-3.5 shrink-0" />
                    <p
                      className={cn(
                        "leading-[150%] whitespace-pre-line",
                        message.error && "text-danger",
                      )}
                    >
                      {message.content}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {pending && (
            <div className="shadow-card flex w-fit items-center gap-3 rounded-2xl bg-card p-4">
              <StarsIcon aria-hidden className="text-icon size-3.5 animate-pulse" />
              <span className="text-subtle">Thinking…</span>
            </div>
          )}
        </div>
      </div>
      <form onSubmit={onSubmit} className="border-border border-t p-4">
        <div className="shadow-control focus-within:shadow-focus ease-[ease] mx-auto flex max-w-[720px] items-end gap-2 rounded-2xl bg-card p-2 transition-[box-shadow] duration-150">
          <textarea
            ref={inputRef}
            autoFocus
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            aria-label="Ask a question"
            placeholder="Ask about your tasks, goals or week…"
            className="text-foreground placeholder:text-subtle field-sizing-content max-h-40 min-h-[30px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-[5px] text-[14px] font-medium tracking-[-0.02em] outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            aria-label="Send"
            disabled={!input.trim() || pending}
          >
            <ArrowUpIcon aria-hidden className="size-3.5" />
          </Button>
        </div>
      </form>
    </>
  );
}
