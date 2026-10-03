import { z } from 'zod';
import { DEMO_PERSONAS, type DemoPersonaKey } from './demoPersonas';

const PERSONA_KEYS = DEMO_PERSONAS.map((persona) => persona.key) as [
  DemoPersonaKey,
  ...DemoPersonaKey[],
];

/* The personas live in their own module (no zod), so pages that only list them stay small. */
export const demoSignInSchema = z.object({ persona: z.enum(PERSONA_KEYS) }).strict();

export type DemoSignInInput = z.infer<typeof demoSignInSchema>;

/** Whether one-click demo sign-in is offered on this deployment. */
export interface DemoStatusResponse {
  enabled: boolean;
}
