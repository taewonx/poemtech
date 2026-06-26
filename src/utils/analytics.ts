import ReactGA from 'react-ga4';

const GA_TRACKING_ID = import.meta.env.VITE_GA_TRACKING_ID;

export const initGA = () => {
  if (GA_TRACKING_ID) {
    ReactGA.initialize(GA_TRACKING_ID);
    console.log('GA4 Initialized');
  }
};

export const logPageView = (path: string) => {
  if (GA_TRACKING_ID) {
    ReactGA.send({ hitType: 'pageview', page: path });
  }
};

export const logEvent = (category: string, action: string, label?: string) => {
  if (GA_TRACKING_ID) {
    ReactGA.event({
      category,
      action,
      label,
    });
  }
};
