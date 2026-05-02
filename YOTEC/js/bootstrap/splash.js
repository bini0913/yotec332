// Splash screen bootstrap module

export function initSplashScreen() {
  const splashProgress = document.getElementById('splash-progress');
  const splashStatus = document.getElementById('splash-status');

  if (!splashProgress || !splashStatus) return;

  const statusSteps = [
    'Loading departments…',
    'Activating AI workers…',
    'Initializing QA…',
    'Starting autonomous agents…',
    'ARIA online — ready!'
  ];

  let progress = 0;

  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 22 + 5, 100);
    splashProgress.style.width = `${progress}%`;

    const step = Math.floor(progress / 20);
    if (statusSteps[step]) splashStatus.textContent = statusSteps[step];

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
          splash.style.opacity = '0';
          setTimeout(() => splash.remove(), 650);
        }
      }, 350);
    }
  }, 80);
}
