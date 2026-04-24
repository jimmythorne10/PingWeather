import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = 'pingweather-walkthrough-seen';

interface UseWalkthroughReturn {
  visible: boolean;
  show: () => void;
  dismiss: () => Promise<void>;
}

interface UseWalkthroughOptions {
  autoShow?: boolean;
}

export function useWalkthrough(options: UseWalkthroughOptions = {}): UseWalkthroughReturn {
  const { autoShow = false } = options;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!autoShow) return;
    AsyncStorage.getItem(SEEN_KEY).then((value) => {
      if (value === null) {
        setVisible(true);
      }
    });
  }, [autoShow]);

  const show = () => {
    setVisible(true);
  };

  const dismiss = async (): Promise<void> => {
    setVisible(false);
    await AsyncStorage.setItem(SEEN_KEY, 'true');
  };

  return { visible, show, dismiss };
}
