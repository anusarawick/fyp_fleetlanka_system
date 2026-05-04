import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Fuel,
  MapPinned,
  Smartphone,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const BRAND_LOGO_SRC = "/icons/fleetlanka-logo.png";
const DASHBOARD_IMAGE_SRC = "/icons/dashboard.png";
const HOMEPAGE_SECTION_IDS = ["hero", "platform", "workflows", "intelligence", "cta"] as const;

type HomeSectionId = (typeof HOMEPAGE_SECTION_IDS)[number];

type PublicHomePageProps = {
  accessToken: string | null;
  role: string | null;
};

type Feature = {
  title: string;
  copy: string;
  icon: LucideIcon;
};

const platformFeatures: Feature[] = [
  {
    title: "Live fleet visibility",
    copy: "Track active trips, vehicle readiness, route activity, and operational exceptions from one command center.",
    icon: MapPinned,
  },
  {
    title: "Predictive maintenance",
    copy: "Use vehicle history, service data, and operating patterns to spot maintenance risk before downtime spreads.",
    icon: Wrench,
  },
  {
    title: "Fuel cost intelligence",
    copy: "Review fuel logs, weekly forecasts, and consumption signals for better planning across smaller fleets.",
    icon: Fuel,
  },
  {
    title: "Driver and service workflows",
    copy: "Connect managers, drivers, and service centers through role-based portals with approval-backed records.",
    icon: Users,
  },
];

const roleWorkflows = [
  {
    title: "Manager portal",
    copy: "Dispatch trips, manage vehicles and drivers, monitor compliance, review service bookings, and export reports.",
    icon: BarChart3,
  },
  {
    title: "Driver PWA",
    copy: "Drivers can start trips, sync GPS activity, log fuel, update profiles, and continue key work offline.",
    icon: Smartphone,
  },
  {
    title: "Service center portal",
    copy: "Partner workshops can confirm bookings, complete jobs, and submit reviewed maintenance details.",
    icon: CalendarCheck,
  },
];

function appTargetForRole(role: string | null) {
  if (role === "driver") return { href: "/driver", label: "Open driver app" };
  if (role === "service") return { href: "/service", label: "Open service portal" };
  return { href: "/dashboard", label: "Open dashboard" };
}

function ProductMockup() {
  return (
    <div className="public-hero__visual">
      <div className="hero-dashboard-frame">
        <img src={DASHBOARD_IMAGE_SRC} alt="FleetLanka manager dashboard preview" />
      </div>
    </div>
  );
}

function isGuidedScrollEnabled() {
  return window.matchMedia("(min-width: 981px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, textarea, select, summary, [contenteditable='true']"));
}

export default function PublicHomePage({ accessToken, role }: PublicHomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>("hero");
  const scrollLockRef = useRef<number | null>(null);
  const appTarget = appTargetForRole(role);
  const primaryHref = accessToken ? appTarget.href : "/login";
  const primaryLabel = accessToken ? appTarget.label : "Log in";

  const getCurrentSectionIndex = useCallback(() => {
    const viewportAnchor = window.innerHeight * 0.36;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    HOMEPAGE_SECTION_IDS.forEach((sectionId, index) => {
      const section = document.getElementById(sectionId);
      if (!section) return;

      const distance = Math.abs(section.getBoundingClientRect().top - viewportAnchor);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }, []);

  const scrollToSection = useCallback(
    (sectionId: HomeSectionId, updateHash = false) => {
      const section = document.getElementById(sectionId);
      if (!section) return;

      section.scrollIntoView({
        behavior: isGuidedScrollEnabled() ? "smooth" : "auto",
        block: "start",
      });
      setActiveSection(sectionId);

      if (updateHash) {
        window.history.replaceState(null, "", sectionId === "hero" ? window.location.pathname : `#${sectionId}`);
      }
    },
    [],
  );

  const moveSection = useCallback(
    (direction: 1 | -1) => {
      const nextIndex = Math.max(0, Math.min(HOMEPAGE_SECTION_IDS.length - 1, getCurrentSectionIndex() + direction));
      scrollToSection(HOMEPAGE_SECTION_IDS[nextIndex]);
    },
    [getCurrentSectionIndex, scrollToSection],
  );

  const handleSectionLinkClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, sectionId: HomeSectionId) => {
      if (!isGuidedScrollEnabled()) return;
      event.preventDefault();
      scrollToSection(sectionId, true);
    },
    [scrollToSection],
  );

  useEffect(() => {
    const sections = HOMEPAGE_SECTION_IDS.map((sectionId) => document.getElementById(sectionId)).filter(
      (section): section is HTMLElement => section !== null,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target.id && HOMEPAGE_SECTION_IDS.includes(visibleEntry.target.id as HomeSectionId)) {
          setActiveSection(visibleEntry.target.id as HomeSectionId);
        }
      },
      { threshold: [0.36, 0.56, 0.72] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const unlockScroll = () => {
      if (scrollLockRef.current) {
        window.clearTimeout(scrollLockRef.current);
      }
      scrollLockRef.current = window.setTimeout(() => {
        scrollLockRef.current = null;
      }, 850);
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isGuidedScrollEnabled() || Math.abs(event.deltaY) < 18 || scrollLockRef.current) return;

      event.preventDefault();
      moveSection(event.deltaY > 0 ? 1 : -1);
      unlockScroll();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isGuidedScrollEnabled() || isInteractiveTarget(event.target) || scrollLockRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

      const nextKeys = ["ArrowDown", "PageDown", " "];
      const previousKeys = ["ArrowUp", "PageUp"];

      if (nextKeys.includes(event.key)) {
        event.preventDefault();
        moveSection(1);
        unlockScroll();
      }

      if (previousKeys.includes(event.key)) {
        event.preventDefault();
        moveSection(-1);
        unlockScroll();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      if (scrollLockRef.current) {
        window.clearTimeout(scrollLockRef.current);
      }
    };
  }, [moveSection]);

  const panelClass = (sectionId: HomeSectionId, baseClassName: string) =>
    `${baseClassName} public-panel${activeSection === sectionId ? " public-panel--active" : ""}`;

  return (
    <main className="public-home">
      <section className={panelClass("hero", "public-hero")} id="hero">
        <header className="public-nav">
          <Link className="public-nav__brand" to="/">
            <img src={BRAND_LOGO_SRC} alt="" />
            <span>FleetLanka</span>
          </Link>
          <nav className="public-nav__links" aria-label="Homepage sections">
            <a href="#platform" onClick={(event) => handleSectionLinkClick(event, "platform")}>Platform</a>
            <a href="#workflows" onClick={(event) => handleSectionLinkClick(event, "workflows")}>Workflows</a>
            <a href="#intelligence" onClick={(event) => handleSectionLinkClick(event, "intelligence")}>Intelligence</a>
          </nav>
          <div className="public-nav__actions">
            <Link className="public-link-btn" to={primaryHref}>{primaryLabel}</Link>
            {!accessToken ? <Link className="public-solid-btn" to="/signup">Sign up</Link> : null}
          </div>
        </header>

        <div className="public-hero__content">
          <div className="public-hero__copy">
            <span className="public-eyebrow">Fleet operations platform</span>
            <h1>Fleet operations, controlled from one workspace.</h1>
            <p>
              FleetLanka helps managers coordinate trips, monitor vehicles, track fuel costs, and act on maintenance risk before
              small issues become downtime.
            </p>
            <div className="public-hero__actions">
              <Link className="public-solid-btn public-solid-btn--large" to={primaryHref}>
                {primaryLabel}
                <ArrowRight aria-hidden="true" />
              </Link>
              {!accessToken ? (
                <Link className="public-outline-btn" to="/signup">Create manager account</Link>
              ) : (
                <a className="public-outline-btn" href="#platform" onClick={(event) => handleSectionLinkClick(event, "platform")}>Explore platform</a>
              )}
            </div>
            <div className="public-hero__proof">
              <span><CheckCircle2 /> Live dispatch</span>
              <span><CheckCircle2 /> Predictive maintenance</span>
              <span><CheckCircle2 /> Fuel forecasting</span>
            </div>
          </div>
          <ProductMockup />
        </div>
      </section>

      <section className={panelClass("platform", "public-section public-section--intro")} id="platform">
        <div className="public-section__header">
          <span className="public-eyebrow">One operating layer</span>
          <h2>Built around the fleet work that happens every day.</h2>
          <p>From dispatch to service approval, the system keeps daily records and planning signals in the same workflow.</p>
        </div>
        <div className="public-feature-grid">
          {platformFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="public-feature" key={feature.title}>
                <span className="public-feature__icon"><Icon aria-hidden="true" /></span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={panelClass("workflows", "public-section public-section--split")} id="workflows">
        <div className="public-split__copy">
          <span className="public-eyebrow">Role-based execution</span>
          <h2>Every team gets the portal they need.</h2>
          <p>
            FleetLanka separates manager controls, mobile driver actions, and service-center updates without losing the shared
            vehicle, trip, and maintenance record.
          </p>
        </div>
        <div className="public-workflow-list">
          {roleWorkflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <article className="public-workflow" key={workflow.title}>
                <span><Icon aria-hidden="true" /></span>
                <div>
                  <h3>{workflow.title}</h3>
                  <p>{workflow.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={panelClass("intelligence", "public-section public-intelligence")} id="intelligence">
        <div className="public-intelligence__panel">
          <span className="public-eyebrow">Predictive operations</span>
          <h2>Turn operational history into next-step decisions.</h2>
          <p>
            The platform combines application data with ML-backed prediction workflows so managers can review risk, forecast fuel
            demand, and prioritize service before a vehicle becomes a blocker.
          </p>
          <div className="public-intelligence__stats">
            <div><strong>7-day</strong><span>Fuel forecasting</span></div>
            <div><strong>Risk</strong><span>Maintenance checks</span></div>
            <div><strong>Live</strong><span>Trip activity</span></div>
          </div>
        </div>
        <div className="public-process">
          <article><ClipboardCheck /><strong>Capture</strong><span>Trips, fuel, services, documents, and driver records.</span></article>
          <article><Bot /><strong>Predict</strong><span>Run maintenance risk and fuel planning checks from fleet data.</span></article>
          <article><Wrench /><strong>Act</strong><span>Book service, approve completion, and sync records back to the fleet.</span></article>
        </div>
      </section>

      <section className={panelClass("cta", "public-section public-final")} id="cta">
        <div className="public-final__content">
          <span className="public-eyebrow">Get started</span>
          <h2>Bring your fleet workflow into one connected system.</h2>
          <p>Create a manager workspace, connect drivers, and coordinate service work from the same operational record.</p>
          <div className="public-final__actions">
            <Link className="public-solid-btn public-solid-btn--large" to={primaryHref}>{primaryLabel}</Link>
            {!accessToken ? <Link className="public-outline-btn" to="/signup">Create manager account</Link> : null}
          </div>
        </div>
        <div className="public-final__path" aria-label="FleetLanka onboarding path">
          <article>
            <span>01</span>
            <strong>Manager workspace</strong>
            <p>Set up fleet records, vehicles, drivers, service centers, and reporting access.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Driver app</strong>
            <p>Connect trip execution, location activity, fuel logs, and mobile workflow updates.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Service center flow</strong>
            <p>Coordinate bookings, completion details, review steps, and maintenance history.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
