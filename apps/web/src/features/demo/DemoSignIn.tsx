import { DEMO_PERSONAS, type DemoPersonaKey } from '@ru-lost-found/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../auth/authContext';

/**
 * One-click sign-in as a sample person. `available` stays false until the API confirms the
 * demo is switched on; while a sleeping server wakes up, `checking` is true.
 */
function useDemoSignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: queryKeys.demoStatus,
    queryFn: authApi.demoStatus,
    staleTime: Infinity,
    retry: 1,
  });
  const start = useMutation({
    mutationFn: (persona: DemoPersonaKey) => authApi.demoSignIn(persona),
    onSuccess: (session) => {
      signIn(session);
      navigate('/', { replace: true });
      window.scrollTo(0, 0); // the buttons sit halfway down the landing page
    },
    onError: (error) => toast.error(error.message),
  });
  return {
    available: status.data?.enabled === true,
    checking: status.isPending,
    start: start.mutate,
    startingAs: start.isPending ? start.variables : undefined,
  };
}

/** Persona cards for the landing page; nothing when this deployment has no demo. */
export function DemoPersonaCards() {
  const demo = useDemoSignIn();
  if (!demo.checking && !demo.available) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {DEMO_PERSONAS.map((persona) => {
        // The finder wears the Found colour, the owner the Lost colour, as on the posts.
        const finder = persona.key === 'asha.verma';
        return (
          <article
            key={persona.key}
            className="flex flex-col rounded-3xl bg-white p-7 text-left shadow-2xl ring-1 ring-white/10 transition duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between gap-3">
              <img
                src={persona.avatarUrl}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                className={`h-16 w-16 rounded-full object-cover ring-4 ${finder ? 'ring-secondary-light/50' : 'ring-primary/20'}`}
              />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${finder ? 'bg-secondary text-secondary-contrast' : 'bg-primary text-primary-contrast'}`}
              >
                {persona.role.replace(/^The /, '')}
              </span>
            </div>
            <h3 className="mt-5 font-sans text-xl font-semibold text-gray-900">
              {persona.firstName} {persona.lastName}
            </h3>
            <p className="mt-2 text-gray-700">{persona.story}</p>
            <p className="mb-6 mt-4 flex gap-2 rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {persona.tryThis}
            </p>
            <Button
              size="lg"
              variant={finder ? 'secondary' : 'primary'}
              className="mt-auto w-full"
              loading={demo.checking || demo.startingAs === persona.key}
              disabled={demo.startingAs !== undefined}
              onClick={() => demo.start(persona.key)}
            >
              Try as {persona.firstName} <ArrowRight className="h-4 w-4" />
            </Button>
          </article>
        );
      })}
    </div>
  );
}

/** A short "just looking?" line for the sign-in page. */
export function DemoSignInLinks() {
  const demo = useDemoSignIn();
  if (!demo.available) return null;

  return (
    <div className="mt-6 rounded-xl bg-white/70 p-4 text-center text-sm text-gray-600">
      <p>Just looking around? Try it as a sample student:</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {DEMO_PERSONAS.map((persona) => (
          <Button
            key={persona.key}
            size="sm"
            variant="outline"
            loading={demo.startingAs === persona.key}
            disabled={demo.startingAs !== undefined}
            onClick={() => demo.start(persona.key)}
          >
            {persona.firstName} ({persona.role.replace(/^The /, '').toLowerCase()})
          </Button>
        ))}
      </div>
    </div>
  );
}
