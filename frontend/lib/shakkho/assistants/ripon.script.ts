/* ------------------------------------------------------------------ *
 *  RiponScript — deterministic scripted conversation for the
 *  Ripon-as-caller / Moyuri-as-applicant 16699 demo.
 *
 *  The script produces a sequence of conversational turns:
 *    1. AI welcome (T5)
 *    2. Ripon says he is calling for his neighbour
 *    3. AI prompts for applicant name → "Moyuri Begum"
 *    4. Ripon gives incident date, category, location
 *    5. AI extracts a safe-contact time
 *    6. AI presents a read-back
 *    7. Ripon presses 0 → human handoff
 *    8. Human agent takes over; runs verification
 *
 *  No LLM. Pure data; panels feed utterances back in via
 *  `RiponScript.feed(text)` and the script advances state.
 * ------------------------------------------------------------------ */

import type {
  ConversationalIntakeTurn,
  SlotKey,
  SlotValue,
  UrgencyIndicator,
} from "../types";

export type RiponStep =
  | "ai_welcome"
  | "ask_for"
  | "ask_applicant_name"
  | "ask_category"
  | "ask_date"
  | "ask_office"
  | "ask_safe_contact"
  | "ask_press_zero"
  | "ask_urgency_keywords"
  | "ask_verify"
  | "readback"
  | "human_takeover"
  | "human_verify_applicant"
  | "human_confirm_facts"
  | "human_submit"
  | "done";

export interface RiponScriptState {
  step: RiponStep;
  history: ConversationalIntakeTurn[];
  facts: Partial<Record<SlotKey, SlotValue>>;
  indicators: UrgencyIndicator[];
  /** Pressed "0" for human — flips urgent-handoff flag. */
  pressedZero: boolean;
  /** Detected a child-safeguarding or threat keyword → urgent. */
  flaggedUrgent: boolean;
}

const bn = (s: string) => ({ bn: s, en: "" });
const both = (b: string, e: string) => ({ bn: b, en: e });

const T5 = (text: { bn: string; en: string }, slot?: SlotKey): ConversationalIntakeTurn => ({
  speaker: "t5",
  text,
  slot,
  simulationTag: "voice",
  spokenAt: new Date().toISOString(),
});

const C = (text: { bn: string; en: string }, slot?: SlotKey): ConversationalIntakeTurn => ({
  speaker: "caller",
  text,
  slot,
  simulationTag: "voice",
  spokenAt: new Date().toISOString(),
});

function setSlot(
  state: RiponScriptState,
  slot: SlotKey,
  value: string,
  source: SlotValue["source"] = "ripon_reported",
): void {
  state.facts = {
    ...state.facts,
    [slot]: { value, confidence: "stated", source },
  };
}

function push(
  state: RiponScriptState,
  turn: ConversationalIntakeTurn,
): void {
  state.history = [...state.history, turn];
}

export const RiponScript = {
  initial(): RiponScriptState {
    const welcome = T5(
      both(
        "আসসালামু আলাইকুম, ১৬৬৯৯ জাতীয় আইনি সহায়তা হেল্পলাইনে স্বাগতম। আমি টি-৫, আপনার সহায়তা করব। আপনি কি নিজের জন্য ফোন করছেন?",
        "As-salamu alaykum. Welcome to the 16699 National Legal Aid helpline. I am T5. Are you calling for yourself?",
      ),
    );
    const state: RiponScriptState = {
      step: "ai_welcome",
      history: [welcome],
      facts: {},
      indicators: [],
      pressedZero: false,
      flaggedUrgent: false,
    };
    return state;
  },

  /** Caller typed a free-text reply. Apply classification + advance. */
  feed(state: RiponScriptState, utterance: string): RiponScriptState {
    const next: RiponScriptState = {
      ...state,
      history: [...state.history],
      facts: { ...state.facts },
      indicators: [...state.indicators],
    };
    const text = utterance.trim();
    if (!text) return next;

    push(next, C(both(text, text), this.slotForStep(next.step)));

    const lower = text.toLowerCase();

    // Press-0 handler takes priority at any step.
    if (
      next.step !== "human_takeover" &&
      next.step !== "human_verify_applicant" &&
      next.step !== "human_confirm_facts" &&
      next.step !== "human_submit" &&
      next.step !== "done" &&
      (text === "0" || lower.includes("human") || lower.includes("এজেন্ট"))
    ) {
      next.pressedZero = true;
      push(
        next,
        T5(
          both(
            "আপনাকে একজন মানব এজেন্টের সাথে সংযুক্ত করছি…",
            "Connecting you to a human agent…",
          ),
        ),
      );
      next.step = "ask_press_zero";
      return next;
    }

    // Urgent-keyword detection runs at every step.
    if (
      lower.includes("violence") ||
      lower.includes("threat") ||
      lower.includes("সহিংস") ||
      lower.includes("খুন") ||
      lower.includes("মারধর") ||
      lower.includes("শিশু")
    ) {
      next.flaggedUrgent = true;
      next.indicators = [
        ...next.indicators,
        {
          code: lower.includes("শিশু") || lower.includes("child")
            ? "child_safeguarding"
            : "physical_safety_at_risk",
          weight: "urgent",
          source: "ripon_reported",
          notedAt: new Date().toISOString(),
          ruleId: lower.includes("শিশু") || lower.includes("child")
            ? "UR-02-child-safeguarding"
            : "UR-01-physical-safety",
          note: {
            bn: "রিপন জরুরি ইঙ্গিত দিয়েছেন",
            en: "Ripon flagged urgent indicator",
          },
        },
      ];
    }

    switch (next.step) {
      case "ai_welcome": {
        if (text.includes("প্রতিবেশী") || lower.includes("neighbour") || lower.includes("neighbor")) {
          setSlot(next, "caller_relation", "neighbour");
          setSlot(next, "caller_name", "Ripon");
          push(
            next,
            T5(
              both(
                "বুঝেছি। আবেদনকারীর পুরো নাম বলবেন কি?",
                "Understood. What is the applicant's full name?",
              ),
              "applicant_name",
            ),
          );
          next.step = "ask_applicant_name";
        } else if (text.includes("নিজে") || lower.includes("self") || lower.includes("myself")) {
          setSlot(next, "caller_relation", "self");
          setSlot(next, "caller_name", "Ripon");
          push(
            next,
            T5(
              both(
                "বুঝেছি। আপনার পুরো নাম কি?",
                "Understood. What is your full name?",
              ),
              "applicant_name",
            ),
          );
          next.step = "ask_applicant_name";
        } else {
          push(
            next,
            T5(
              both(
                "দয়া করে বলুন — নিজের জন্য, নাকি অন্য কারো জন্য?",
                "Please clarify — for yourself, or for someone else?",
              ),
            ),
          );
        }
        break;
      }
      case "ask_applicant_name": {
        const name = text.replace(/^(আমার নাম|my name is|i am)\s*/i, "").trim();
        setSlot(next, "applicant_name", name, "ripon_reported");
        push(
          next,
          T5(
            both(
              "ধন্যবাদ। বিষয়টি কোন ধরনের — পারিবারিক / ভূমি / শ্রম / অপরাধ / অন্যান্য?",
              "Thank you. What category — family / land / labour / criminal / other?",
            ),
            "category",
          ),
        );
        next.step = "ask_category";
        break;
      }
      case "ask_category": {
        const v = lower.match(/(family|land|labour|criminal|other|পারিবারিক|ভূমি|শ্রম|অপরাধ|অন্যান্য)/);
        setSlot(next, "category", v?.[0] ?? text.toLowerCase(), "ripon_reported");
        push(
          next,
          T5(
            both(
              "ঘটনার তারিখ কবে?",
              "On what date did the incident occur?",
            ),
            "incident_date",
          ),
        );
        next.step = "ask_date";
        break;
      }
      case "ask_date": {
        setSlot(next, "incident_date", text, "ripon_reported");
        push(
          next,
          T5(
            both(
              "কোন জেলা আইনি সহায়তা কেন্দ্রে আবেদন করতে চান?",
              "Which District Legal Aid office should receive the application?",
            ),
            "office",
          ),
        );
        next.step = "ask_office";
        break;
      }
      case "ask_office": {
        setSlot(next, "office", text, "ripon_reported");
        push(
          next,
          T5(
            both(
              "ময়ূরীর সাথে নিরাপদে কখন যোগাযোগ করা যাবে?",
              "When is it safe to contact Moyuri?",
            ),
            "safe_contact_time",
          ),
        );
        next.step = "ask_safe_contact";
        break;
      }
      case "ask_safe_contact": {
        setSlot(next, "safe_contact_time", text, "ripon_reported");
        push(
          next,
            T5(
              both(
                "এখন যেকোনো সময় ০ চেপে মানব এজেন্টের সাথে কথা বলতে পারেন — অন্যথায় আমি আপনার দেওয়া তথ্য পড়ব।",
                "You may press 0 at any time to speak with a human agent — otherwise I will read back your information.",
              ),
            ),
        );
        next.step = "ask_urgency_keywords";
        break;
      }
      case "ask_urgency_keywords": {
        if (next.flaggedUrgent) {
          push(
            next,
            T5(
              both(
                "আপনার তথ্যে নিরাপত্তা হুমকির ইঙ্গিত পেয়েছি — আমি এখনই জরুরি হস্তান্তর করছি।",
                "I detected a safety-threat signal in what you shared — escalating to urgent handoff now.",
              ),
            ),
          );
        }
        push(
          next,
          T5(
            both(
              "এখন আপনার তথ্য পড়ছি — ঠিক থাকলে 'হ্যাঁ' বলুন।",
              "I will read back your information now — say 'yes' to confirm.",
            ),
          ),
        );
        next.step = "readback";
        break;
      }
      case "ask_press_zero": {
        push(
          next,
          T5(
            both(
              "এজেন্ট আসছেন, এক মুহূর্ত অপেক্ষা করুন…",
              "An agent is on the line, please hold…",
            ),
          ),
        );
        next.step = "human_takeover";
        break;
      }
      case "readback": {
        if (lower.includes("yes") || lower.includes("হ্যাঁ") || lower.includes("ঠিক")) {
          push(
            next,
            T5(
              both(
                "ধন্যবাদ। আমি এখন মানব এজেন্টকে ডাকছি।",
                "Thank you. I will now call a human agent.",
              ),
            ),
          );
          next.step = "ask_press_zero";
        } else {
          push(
            next,
            T5(
              both(
                "কোনটি সংশোধন করতে চান?",
                "Which field would you like to correct?",
              ),
            ),
          );
          next.step = "ask_urgency_keywords";
        }
        break;
      }
      case "human_takeover": {
        // No-op; human agent panel handles next steps.
        break;
      }
      case "human_verify_applicant":
      case "human_confirm_facts":
      case "human_submit":
      case "done":
        // No-op terminal states.
        break;
    }
    return next;
  },

  slotForStep(step: RiponStep): SlotKey | undefined {
    switch (step) {
      case "ask_for":
        return "caller_relation";
      case "ask_applicant_name":
        return "applicant_name";
      case "ask_category":
        return "category";
      case "ask_date":
        return "incident_date";
      case "ask_office":
        return "office";
      case "ask_safe_contact":
        return "safe_contact_time";
      default:
        return undefined;
    }
  },

  /** Build a 22-turn demo transcript for seeded use. */
  buildDemoTranscript(): ConversationalIntakeTurn[] {
    let s = this.initial();
    const utterances: { text: string; step: RiponStep }[] = [
      { text: "আমি প্রতিবেশীর জন্য ফোন করছি", step: "ai_welcome" },
      { text: "ময়ূরী বেগম", step: "ask_applicant_name" },
      { text: "ভূমি", step: "ask_category" },
      { text: "২০২৬-০৮-২৮", step: "ask_date" },
      { text: "জয়পুরহাট", step: "ask_office" },
      { text: "সন্ধ্যা ৬টার পর", step: "ask_safe_contact" },
      { text: "0", step: "ask_press_zero" },
    ];
    for (const u of utterances) {
      s = this.feed(s, u.text);
    }
    return s.history;
  },

  /** Continue the demo past press-0 to the agent takeover stage. */
  buildHumanContinuation(): ConversationalIntakeTurn[] {
    let s = this.initial();
    s = this.feed(s, "আমি প্রতিবেশীর জন্য ফোন করছি");
    s = this.feed(s, "ময়ূরী বেগম");
    s = this.feed(s, "ভূমি");
    s = this.feed(s, "২০২৬-০৮-২৮");
    s = this.feed(s, "জয়পুরহাট");
    s = this.feed(s, "সন্ধ্যা ৬টার পর");
    s = this.feed(s, "0");
    // Human agent now drives the conversation.
    s.history = [
      ...s.history,
      T5(
        both(
          "আমি এজেন্ট রহমান। আপনার সাথে কথা বলছি। প্রথমে আবেদনকারী ময়ূরী বেগমকে ফোনে পেয়েছি কি?",
          "I am agent Rahman speaking with you. First, have we reached applicant Moyuri Begum on the phone?",
        ),
      ),
      C(both("হ্যাঁ, তিনি ফোনে আছেন।", "Yes, she is on the line.")),
      T5(
        both(
          "ময়ূরী আপনি কি আপনার নাম ও ঠিকানা নিশ্চিত করছেন?",
          "Moyuri, can you confirm your name and address?",
        ),
      ),
      C(
        both(
          "হ্যাঁ, আমি ময়ূরী বেগম, জয়পুরহাট।",
          "Yes, I am Moyuri Begum, Joypurhat.",
        ),
        "applicant_name",
      ),
      T5(
        both(
          "ভূমি বিরোধের তারিখ কি ২৮ আগস্ট ২০২৬?",
          "Is the land dispute date 28 August 2026?",
        ),
      ),
      C(
        both("হ্যাঁ, ঠিক আছে।", "Yes, that's correct."),
        "incident_date",
      ),
      T5(
        both(
          "আমরা এখন নিরাপদ সময়ে — সন্ধ্যা ৬টার পর যোগাযোগ করব।",
          "We will reach you at the safe time — after 6 PM.",
        ),
        "safe_contact_time",
      ),
    ];
    return s.history;
  },
};

void bn;
