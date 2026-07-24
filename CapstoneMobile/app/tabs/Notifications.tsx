import React from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { NotificationsPanel } from '../../components/family/NotificationsPanel';

export default function Notifications() {
  const router = useRouter();
  const { userId } = useFamilyUserMobile();

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate(TAB_ROUTES.home as never));

  return (
    <>
      <StatusBar style="dark" />
      <NotificationsPanel userId={userId} onClose={goBack} />
    </>
  );
}
