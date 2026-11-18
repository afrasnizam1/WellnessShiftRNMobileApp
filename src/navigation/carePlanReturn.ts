import type { EventArg, NavigationProp, ParamListBase } from '@react-navigation/native';
import { Screen } from './screenNames';

/** When a Fitness/Home screen was opened from My Care Plan, Back returns there instead of Home. */
export function carePlanReturnListeners({
  navigation,
  route,
}: {
  navigation: NavigationProp<ParamListBase>;
  route: { params?: object };
}) {
  const fromCarePlan =
    route.params != null &&
    'fromCarePlan' in route.params &&
    (route.params as { fromCarePlan?: boolean }).fromCarePlan === true;
  return {
    beforeRemove: (e: EventArg<'beforeRemove', true, { action: { type: string } }>) => {
      if (!fromCarePlan) return;
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') return;
      e.preventDefault();
      navigation.getParent()?.navigate(Screen.tabMyCare, { screen: Screen.carePlan });
    },
  };
}
