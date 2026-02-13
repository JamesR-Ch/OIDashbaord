## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.

### Available skills
- brainstorming: Facilitates creative exploration of features or ideas before implementation. Use when the user wants to discuss a new feature, idea, or vague requirement. (file: /Users/9digits/Desktop/myWork/2026/Skills Master/.agent/skills/brainstorming/SKILL.md)
- brand-identity: Provides the single source of truth for brand guidelines, design tokens, technology choices, and voice/tone. Use this skill whenever generating UI components, styling applications, writing copy, or creating user-facing assets to ensure brand consistency. (file: /Users/9digits/Desktop/myWork/2026/Skills Master/.agent/skills/brand-identity/SKILL.md)
- creating-skills: Generates high-quality, predictable, and efficient .agent/skills/ directories based on user requirements. Use when the user asks to create a new skill. (file: /Users/9digits/Desktop/myWork/2026/Skills Master/.agent/skills/creating-skills/SKILL.md)
- frontend-design: Plan and produce intentional frontend visual design direction for web apps and landing pages using a structured five-dimension system (layout pattern, style aesthetic, color theme, typography, and motion). Use when designing a new UI, redesigning an existing interface, creating design prompts/specs for implementation, choosing visual language for product categories (SaaS, ecommerce, fintech, dashboard, portfolio), or auditing UI quality/accessibility/performance anti-patterns. (file: /Users/9digits/Desktop/myWork/2026/Skills Master/.agent/skills/frontend-design/SKILL.md)
- planning: Generates detailed implementation plans for multi-step tasks. Use when the user has approved a design or spec and needs a concrete plan to execute. (file: /Users/9digits/Desktop/myWork/2026/Skills Master/.agent/skills/planning/SKILL.md)
- troubleshooting: Comprehensive guide and patterns for troubleshooting applications, including error handling strategies, linguistic patterns (Python, TS, Rust, Go), and universal resilience patterns. use when the user needs help fixing bugs or improving system reliability. (file: /Users/9digits/Desktop/myWork/2026/Skills Master/.agent/skills/troubleshooting/SKILL.md)

### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2) When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5) If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
