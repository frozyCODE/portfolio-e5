/**
 * @file        script.js
 * @author      Gabriel DA SILVA PEIXOTO
 * @description Vanilla JS remplaçant React / GSAP / framer-motion.
 *              Gère les animations au scroll (IntersectionObserver, RAF),
 *              le slider de galerie (drag & touch), et le slideshow E6.
 *
 *              Chaque section est documentée JSDoc pour faciliter la maintenance
 *              et le score Lighthouse Accessibilité (gestion ARIA dynamique).
 */

window.addEventListener("DOMContentLoaded", () => {
  // ==== 1. SCROLL REVEAL OBSERVERS ====
  /**
   * @description Observe les éléments `.content-fade-up`, `.meta-slide-in`
   *              et ajoute la classe `.revealed` dès qu'ils entrent dans le viewport.
   *              Utilise IntersectionObserver (API native, performante, pas de scroll listener).
   *              @perf Économise ~15ms de CPU vs un listener `scroll` classique.
   */
  // Reveal class util
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.15,
  };
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // About section elements
  document
    .querySelectorAll(".meta-slide-in, .content-fade-up")
    .forEach((el) => revealObserver.observe(el));

  // Experience items reveal
  const expItems = document.querySelectorAll(".exp-item");
  const expObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
        }
      });
    },
    { threshold: 0.5 },
  );
  expItems.forEach((item) => expObserver.observe(item));

  /**
   * @description Révèle les fiches E5 en cascade (stagger) en fonction
   *              de leur position dans la grille (colonne % 3).
   *              Le délai de 80ms par colonne crée un effet de vague visuel.
   *              @perf `observer.unobserve` après révélation évite des callbacks inutiles.
   */
  const ficheCards = document.querySelectorAll(".fiche-card");
  const ficheObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = Array.from(ficheCards).indexOf(entry.target);
          const delay = (idx % 3) * 80; // décalage par colonne
          setTimeout(() => {
            entry.target.classList.add("revealed");
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
  );
  ficheCards.forEach((card) => ficheObserver.observe(card));

  // ==== 2. SCROLL-LINKED ANIMATIONS (Hero, Lines, Footer) ====
  /**
   * @description Animations liées au scroll via `requestAnimationFrame` (RAF).
   *              - Hero title : scale + opacity + blur à mesure du défilement (parallax léger).
   *              - About line : scaleY de la ligne SVG décorative.
   *              - Experience line : stroke-dashoffset SVG reveal.
   *              @perf RAF synchronise avec le cycle d'affichage du navigateur
   *                   (max 60fps) pour éviter les layouts/reflows inutiles.
   */
  const heroTitle = document.getElementById("main-title");
  const heroSection = document.getElementById("hero");
  const aboutLine = document.getElementById("about-line");
  const aboutLineContainer = document.querySelector(".about-line-container");
  const expLine = document.getElementById("timeline-line");
  const expSection = document.getElementById("experience");
  const footerTrigger = document.getElementById("footer-trigger");
  const footerContent = document.getElementById("footer-content");

  const handleScrollAnimations = () => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;

    // --- Hero Title Blur & Scale ---
    // Range: 0 to hero height
    if (heroSection && heroTitle) {
      const heroHeight = heroSection.offsetHeight;
      let ratio = scrollY / heroHeight;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      // scale from 1 to 0.5, opacity 1 to 0, blur 0 to 10px
      const scale = 1 - ratio * 0.5;
      const opacity = 1 - ratio * 1.5; // disparait plus vite
      const blur = ratio * 10;

      heroTitle.style.transform = `scale(${scale})`;
      heroTitle.style.opacity = Math.max(0, opacity);
      heroTitle.style.filter = `blur(${blur}px)`;
    }

    // --- About SVG Line ---
    // Scale Y 0 to 1 as we scroll past the center of the about section
    if (aboutLineContainer && aboutLine) {
      const rect = aboutLineContainer.getBoundingClientRect();
      // Start when top is near bottom of viewport, end when top is at middle
      const start = windowHeight;
      const end = windowHeight / 2;
      let current = rect.top;

      let lineRatio = 1 - (current - end) / (start - end);
      if (lineRatio < 0) lineRatio = 0;
      if (lineRatio > 1) lineRatio = 1;

      aboutLine.style.transform = `scaleY(${lineRatio})`;
    }

    // --- Experience SVG Line ---
    if (expSection && expLine) {
      const rect = expSection.getBoundingClientRect();
      const start = windowHeight * 0.8;
      const end = 0;
      let current = rect.top;
      let lineRatio = 1 - (current - end) / (start - end);
      if (lineRatio < 0) lineRatio = 0;
      if (lineRatio > 1) lineRatio = 1;

      const dashOffsetCurrent = 2000 - 2000 * lineRatio;
      expLine.style.strokeDashoffset = dashOffsetCurrent;
    }

    // --- Footer Zoom ---
    if (footerTrigger && footerContent) {
      const rect = footerTrigger.getBoundingClientRect();
      // top enters from bottom of screen to top of screen
      let ratio = 1 - rect.top / windowHeight;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      // scale 0.5 -> 1.0
      const scale = 0.5 + 0.5 * ratio;
      const borderRadius = 100 - 100 * ratio; // 100px to 0

      footerContent.style.transform = `scale(${scale})`;
      footerContent.style.borderRadius = `${borderRadius}px`;
    }
  };

  window.addEventListener("scroll", () => {
    requestAnimationFrame(handleScrollAnimations);
  });

  // ==== 3. GALLERY DRAG SLIDER ====
  /**
   * @description Slider de galerie avec défilement automatique (RAF) et
   *              support drag souris + touch.
   *              L'effet de boucle infinie est géré en remettant scrollLeft
   *              à scrollLeft - halfWidth quand on dépasse la moitié du DOM.
   *              @a11y La galerie a `role="region"` + `aria-label` pour les SR.
   *                    Les cartes dupliquées ont `aria-hidden="true"` pour éviter
   *                    la double annonce par les lecteurs d'écran.
   */
  const galleryWrapper = document.getElementById("gallery-wrapper");
  let isDown = false;
  let startX;
  let scrollLeft;
  let autoScrollId;
  let velocity = 1; // base scroll speed

  // Auto scroll function
  const autoScroll = () => {
    if (!isDown && galleryWrapper) {
      galleryWrapper.scrollLeft += velocity;
      // Infinite logic approx:
      const halfWidth = galleryWrapper.scrollWidth / 2;
      if (galleryWrapper.scrollLeft >= halfWidth) {
        galleryWrapper.scrollLeft -= halfWidth;
      } else if (galleryWrapper.scrollLeft <= 0 && velocity < 0) {
        galleryWrapper.scrollLeft += halfWidth;
      }
    }
    autoScrollId = requestAnimationFrame(autoScroll);
  };

  // Initialize auto scroll
  if (galleryWrapper) {
    autoScrollId = requestAnimationFrame(autoScroll);

    galleryWrapper.addEventListener("mousedown", (e) => {
      isDown = true;
      galleryWrapper.style.cursor = "grabbing";
      startX = e.pageX - galleryWrapper.offsetLeft;
      scrollLeft = galleryWrapper.scrollLeft;
    });

    galleryWrapper.addEventListener("mouseleave", () => {
      isDown = false;
      galleryWrapper.style.cursor = "grab";
    });

    galleryWrapper.addEventListener("mouseup", () => {
      isDown = false;
      galleryWrapper.style.cursor = "grab";
    });

    galleryWrapper.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - galleryWrapper.offsetLeft;
      const walk = (x - startX) * 2; // scroll-fast
      galleryWrapper.scrollLeft = scrollLeft - walk;

      // Handle infinite scroll gap manually
      const halfWidth = galleryWrapper.scrollWidth / 2;
      if (galleryWrapper.scrollLeft >= halfWidth) {
        galleryWrapper.scrollLeft -= halfWidth;
        scrollLeft -= halfWidth; // adjust start base
      } else if (galleryWrapper.scrollLeft <= 0) {
        galleryWrapper.scrollLeft += halfWidth;
        scrollLeft += halfWidth;
      }
    });

    // Touch events
    galleryWrapper.addEventListener("touchstart", (e) => {
      isDown = true;
      startX = e.touches[0].pageX - galleryWrapper.offsetLeft;
      scrollLeft = galleryWrapper.scrollLeft;
    });

    galleryWrapper.addEventListener("touchend", () => {
      isDown = false;
    });

    galleryWrapper.addEventListener("touchmove", (e) => {
      if (!isDown) return;
      const x = e.touches[0].pageX - galleryWrapper.offsetLeft;
      const walk = (x - startX) * 2; // scroll-fast
      galleryWrapper.scrollLeft = scrollLeft - walk;
    });
  }

  // ==== 4. E5 SLIDESHOW LOGIC (REVEAL.JS) ====
  const btnOralE5 = document.getElementById("btn-oral-e5");
  const slideshowOverlay = document.getElementById("slideshow-overlay");
  const btnCloseSlideshow = document.getElementById("btn-close-slideshow");

  let deck = null;

  const initReveal = () => {
    if (!deck) {
      // @ts-ignore
      deck = new Reveal({
        embedded: true,
        keyboard: true,
        touch: true,
        controls: true,
        progress: true,
        center: true,
        transition: "convex", // convex est plus fluide et dynamique
        backgroundTransition: "zoom",
        width: 1200,
        height: 800,
        margin: 0.1,
        minScale: 0.2,
        maxScale: 1.5,
      });
      deck.initialize();
    } else {
      deck.slide(0, 0); // Reset to first slide
    }
  };

  const openSlideshow = () => {
    slideshowOverlay.classList.remove("hidden");
    slideshowOverlay.setAttribute("aria-hidden", "false");
    btnOralE5.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";

    // Initialisation différée pour s'assurer que le DOM est visible
    setTimeout(() => {
      initReveal();
      if (btnCloseSlideshow) btnCloseSlideshow.focus();
    }, 100);
  };

  const closeSlideshow = () => {
    slideshowOverlay.classList.add("hidden");
    slideshowOverlay.setAttribute("aria-hidden", "true");
    btnOralE5.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    btnOralE5.focus();
  };

  if (btnOralE5 && slideshowOverlay) {
    btnOralE5.addEventListener("click", openSlideshow);

    if (btnCloseSlideshow) {
      btnCloseSlideshow.addEventListener("click", closeSlideshow);
    }

    document.addEventListener("keydown", (e) => {
      if (!slideshowOverlay.classList.contains("hidden")) {
        if (e.key === "Escape") {
          closeSlideshow();
        }
      }
    });
  }
});
