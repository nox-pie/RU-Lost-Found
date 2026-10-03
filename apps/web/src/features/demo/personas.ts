import { DEMO_PERSONAS, type DemoPersona } from '@ru-lost-found/shared';

/** The sample person a demo account belongs to (demo addresses are `<persona key>@demo.invalid`). */
export function personaOf(email: string): DemoPersona | undefined {
  const key = email.split('@')[0];
  return DEMO_PERSONAS.find((persona) => persona.key === key);
}
