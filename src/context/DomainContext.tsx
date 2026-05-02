import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { schoolSiteService } from '@/services/schoolSiteService';
import type { School } from '@/types/school.types';

// Hostnames that belong to SchoolSync itself — not custom school domains
const PLATFORM_HOSTS = [
  'schoolsyncedu.com',
  'www.schoolsyncedu.com',
  'localhost',
];

const PLATFORM_APEX = 'schoolsyncedu.com';

/**
 * Returns the branded subdomain name if the hostname is a first-level subdomain
 * of schoolsyncedu.com (e.g. "newcovenant.schoolsyncedu.com" → "newcovenant").
 * Returns null for the apex, www, Vercel preview URLs, or nested subdomains.
 */
function extractPlatformSubdomain(hostname: string): string | null {
  // Must not be one of the known platform hostnames (e.g. www.schoolsyncedu.com)
  if (PLATFORM_HOSTS.includes(hostname)) return null;
  if (!hostname.endsWith(`.${PLATFORM_APEX}`)) return null;
  const sub = hostname.slice(0, -(`.${PLATFORM_APEX}`).length);
  // Must be a single label (no dots = not nested like a.b.schoolsyncedu.com)
  if (!sub || sub.includes('.')) return null;
  return sub;
}

function isPlatformHost(hostname: string) {
  return (
    PLATFORM_HOSTS.includes(hostname) ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.localhost')
  );
}

interface DomainContextValue {
  isCustomDomain: boolean;
  school: School | null;       // school resolved from the custom domain / subdomain
  schoolSlug: string | null;   // convenience shortcut
  isLoading: boolean;
  notFound: boolean;
}

const DomainContext = createContext<DomainContextValue>({
  isCustomDomain: false,
  school: null,
  schoolSlug: null,
  isLoading: false,
  notFound: false,
});

export function DomainProvider({ children }: { children: ReactNode }) {
  const hostname = window.location.hostname;

  // A branded subdomain like newcovenant.schoolsyncedu.com is still "our" domain
  // but should resolve to a school — treat it as a custom domain for routing purposes.
  const platformSubdomain = extractPlatformSubdomain(hostname);
  const isCustomDomain = platformSubdomain !== null || !isPlatformHost(hostname);

  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(isCustomDomain);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!isCustomDomain) return;

    const lookup = platformSubdomain
      ? schoolSiteService.getBySubdomain(platformSubdomain)
      : schoolSiteService.getByCustomDomain(hostname);

    lookup
      .then((data) => {
        setSchool(data as School | null);
        setNotFound(!data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [hostname, isCustomDomain, platformSubdomain]);

  return (
    <DomainContext.Provider
      value={{
        isCustomDomain,
        school,
        schoolSlug: school?.slug ?? null,
        isLoading,
        notFound,
      }}
    >
      {children}
    </DomainContext.Provider>
  );
}

export function useDomainContext() {
  return useContext(DomainContext);
}
