import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import type { RootStackParamList } from '../types';
import { Screen } from './screenNames';

type AuthStackParamList = {
  [Screen.signIn]: { role?: 'patient' | 'clinician' } | undefined;
  [Screen.createAccount]: { savePlan?: boolean; role?: 'patient' | 'clinician' } | undefined;
  [Screen.chooseRole]: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

type Props = {
  route: RouteProp<RootStackParamList, typeof Screen.authentication>;
};

export function AuthNavigator({ route }: Props) {
  // No nested screen means the pre-auth funnel finished. Open Save your plan,
  // not the old purple Create Account / Sign In / Try as Guest landing.
  const requested = route.params?.screen;
  const initial =
    requested === Screen.signIn || requested === Screen.chooseRole
      ? requested
      : Screen.createAccount;
  const createAccountParams =
    requested === Screen.createAccount
      ? route.params?.params
      : requested
        ? undefined
        : { savePlan: true };
  const signInParams =
    requested === Screen.signIn ? route.params?.params : undefined;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initial}>
      <Stack.Screen
        name={Screen.signIn}
        component={SignInScreen}
        initialParams={signInParams}
      />
      <Stack.Screen
        name={Screen.createAccount}
        component={SignUpScreen}
        initialParams={createAccountParams}
      />
      <Stack.Screen name={Screen.chooseRole} component={RoleSelectScreen} />
    </Stack.Navigator>
  );
}
