import { state } from './00-state.js';

export function checkOnboarding() {
    let seen = false;
    try {
      seen = localStorage.getItem("bakkal_onboarding_seen") === "true";
    } catch (e) {}
    if (seen) return;
    state.onboardingSlideIndex = 0;
    showOnboardingSlide(0);
    document.getElementById("onboardingModal").style.display = "flex";
  }

export function showOnboardingSlide(index) {
    document.querySelectorAll(".onboarding-slide").forEach((slide) => {
      slide.style.display = Number(slide.dataset.slide) === index ? "block" : "none";
    });
    document.querySelectorAll(".onboarding-dot").forEach((dot) => {
      dot.classList.toggle("active", Number(dot.dataset.dot) === index);
    });
    const nextBtn = document.getElementById("onboardingNextBtn");
    nextBtn.textContent = index === state.ONBOARDING_SLIDE_COUNT - 1 ? state.t("onboardFinish") : state.t("onboardNext");
  }

export function onboardingNext() {
    if (state.onboardingSlideIndex >= state.ONBOARDING_SLIDE_COUNT - 1) {
      finishOnboarding();
      return;
    }
    state.onboardingSlideIndex++;
    showOnboardingSlide(state.onboardingSlideIndex);
  }

export function finishOnboarding() {
    try {
      localStorage.setItem("bakkal_onboarding_seen", "true");
    } catch (e) {}
    document.getElementById("onboardingModal").style.display = "none";
  }
