/**
 * 19-onboarding.js
 * İlk kullanım rehberi (tanıtım turu).
 */

function checkOnboarding() {
    let seen = false;
    try {
      seen = localStorage.getItem("bakkal_onboarding_seen") === "true";
    } catch (e) {}
    if (seen) return;
    onboardingSlideIndex = 0;
    showOnboardingSlide(0);
    document.getElementById("onboardingModal").style.display = "flex";
  }

function showOnboardingSlide(index) {
    document.querySelectorAll(".onboarding-slide").forEach((slide) => {
      slide.style.display = Number(slide.dataset.slide) === index ? "block" : "none";
    });
    document.querySelectorAll(".onboarding-dot").forEach((dot) => {
      dot.classList.toggle("active", Number(dot.dataset.dot) === index);
    });
    const nextBtn = document.getElementById("onboardingNextBtn");
    nextBtn.textContent = index === ONBOARDING_SLIDE_COUNT - 1 ? t("onboardFinish") : t("onboardNext");
  }

function onboardingNext() {
    if (onboardingSlideIndex >= ONBOARDING_SLIDE_COUNT - 1) {
      finishOnboarding();
      return;
    }
    onboardingSlideIndex++;
    showOnboardingSlide(onboardingSlideIndex);
  }

function finishOnboarding() {
    try {
      localStorage.setItem("bakkal_onboarding_seen", "true");
    } catch (e) {}
    document.getElementById("onboardingModal").style.display = "none";
  }
