import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyBottomSheet } from '../../components/family/FamilyBottomSheet';
import { ProfileChangePasswordPanel } from '../../components/family/ProfileChangePasswordPanel';
import { ProfileNotificationSettingsPanel } from '../../components/family/ProfileNotificationSettingsPanel';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
import {
  resolveFamilyProfileAvatarMobile,
  uploadFamilyProfileAvatarToCloudMobile,
  FAMILY_PROFILE_AVATAR_CHANGED,
} from '../../lib/familyProfileAvatarMobile';
import { invalidateFamilyUserCacheMobile } from '../../lib/useFamilyUserMobile';
import { performFamilyLogoutMobile } from '../../lib/familyLogoutMobile';
import { FamilyLogoutConfirmModal } from '../../components/family/FamilyLogoutConfirmModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_COMPLETENESS_DISMISSED_KEY = 'family_profile_completeness_dismissed_v1';

function getMissingProfileFields(fields: {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}) {
  const missing: string[] = [];
  if (!String(fields.fullName || '').trim()) missing.push('Full name');
  if (!String(fields.email || '').trim()) missing.push('Email');
  if (!String(fields.phone || '').trim()) missing.push('Phone number');
  const addr = fields.address === '—' ? '' : fields.address;
  if (!String(addr || '').trim()) missing.push('Address');
  return missing;
}

function deriveInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'FU';
}

function joinAddressParts(row: {
  house_block_lot?: string | null;
  street?: string | null;
  municipality?: string | null;
  province?: string | null;
}): string {
  return [row.house_block_lot, row.street, row.municipality, row.province]
    .filter((p) => p && String(p).trim())
    .join(', ');
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [settingsSheet, setSettingsSheet] = useState<null | 'password' | 'notifications'>(null);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState('Family User');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [draftFullName, setDraftFullName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [completenessDismissed, setCompletenessDismissed] = useState(false);
  const [completenessHydrated, setCompletenessHydrated] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setProfileLoading(false);
        return;
      }

      const metaName =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        [user.user_metadata?.first_name, user.user_metadata?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        'Family User';
      const metaPhone =
        (user.user_metadata?.phone as string | undefined)?.trim() ||
        (user.user_metadata?.contact_number as string | undefined)?.trim() ||
        '';

      let name = metaName;
      let phoneVal = metaPhone;
      let addr = '';

      if (user.id) {
        const { data: row } = await supabase
          .from('profiles')
          .select('full_name, phone, province, municipality, street, house_block_lot')
          .eq('id', user.id)
          .maybeSingle();

        if (row?.full_name?.trim()) name = row.full_name.trim();
        if (row?.phone?.trim()) phoneVal = row.phone.trim();
        addr = joinAddressParts(row || {});
      }

      setEmail(user.email ?? '');
      setFullName(name);
      setPhone(phoneVal);
      setAddress(addr || '—');
      setDraftFullName(name);
      setDraftPhone(phoneVal);
      setDraftAddress(addr);

      const url = await resolveFamilyProfileAvatarMobile(user.id);
      setProfileImageUri(url);
    } catch {
      /* keep defaults */
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshAvatar = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setProfileImageUri(null);
      return;
    }
    const url = await resolveFamilyProfileAvatarMobile(uid);
    setProfileImageUri(url);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      void refreshAvatar();
    }, [refreshAvatar])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(FAMILY_PROFILE_AVATAR_CHANGED, () => {
      void refreshAvatar();
    });
    return () => sub.remove();
  }, [refreshAvatar]);

  useEffect(() => {
    void AsyncStorage.getItem(PROFILE_COMPLETENESS_DISMISSED_KEY).then((value) => {
      setCompletenessDismissed(value === '1');
      setCompletenessHydrated(true);
    });
  }, []);

  const addressDisplay = address === '—' ? '' : address;
  const missingProfileFields = getMissingProfileFields({
    fullName,
    email,
    phone,
    address: addressDisplay,
  });
  const isProfileComplete = missingProfileFields.length === 0;
  const completenessPct = Math.round(
    ([fullName, email, phone, addressDisplay].filter((v) => String(v || '').trim()).length / 4) * 100
  );
  const completenessMeta = `${completenessPct}% complete · ${fullName} · last viewed ${new Date().toLocaleString()}`;

  useEffect(() => {
    if (!isProfileComplete) {
      setCompletenessDismissed(false);
      void AsyncStorage.removeItem(PROFILE_COMPLETENESS_DISMISSED_KEY);
    }
  }, [isProfileComplete]);

  const dismissCompletenessCard = useCallback(() => {
    setCompletenessDismissed(true);
    void AsyncStorage.setItem(PROFILE_COMPLETENESS_DISMISSED_KEY, '1');
  }, []);

  const showCompletenessCard =
    completenessHydrated && !profileLoading && (!isProfileComplete || !completenessDismissed);

  const handleEditToggle = () => {
    setDraftFullName(fullName);
    setDraftPhone(phone);
    setDraftAddress(address === '—' ? '' : address);
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setDraftFullName(fullName);
    setDraftPhone(phone);
    setDraftAddress(address === '—' ? '' : address);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!isSupabaseConfigured()) {
      setFullName(draftFullName.trim() || fullName);
      setPhone(draftPhone.trim());
      setAddress(draftAddress.trim() || '—');
      setIsEditingProfile(false);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user?.id) {
      Alert.alert('Not signed in', 'Sign in to save your profile.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: draftFullName.trim() || fullName,
          phone: draftPhone.trim() || null,
          street: draftAddress.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      setFullName(draftFullName.trim() || fullName);
      setPhone(draftPhone.trim());
      setAddress(draftAddress.trim() || '—');
      setIsEditingProfile(false);
    } catch (e) {
      Alert.alert('Could not save', String(e));
    } finally {
      setSaving(false);
    }
  };

  const applyProfilePhoto = async (uri: string) => {
    setProfileImageUri(uri);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const publicUrl = await uploadFamilyProfileAvatarToCloudMobile(uri, uid);
      setProfileImageUri(publicUrl);
      invalidateFamilyUserCacheMobile();
    } catch (e) {
      Alert.alert('Photo saved locally', String(e instanceof Error ? e.message : e));
    }
  };

  const pickImageFromLibrary = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0]?.uri;
      if (uri) await applyProfilePhoto(uri);
    }
    setShowPhotoModal(false);
  };

  const takePhotoWithCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0]?.uri;
      if (uri) await applyProfilePhoto(uri);
    }
    setShowPhotoModal(false);
  };

  const confirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await performFamilyLogoutMobile(router);
    } finally {
      setLogoutLoading(false);
      setShowLogoutModal(false);
    }
  };

  const inputProps = {
    editable: isEditingProfile,
    placeholderTextColor: '#94A3B8',
  };

  return (
    <View style={styles.screen}>
      <FamilyMobilePageHeader title="Profile" onBrandPress={scrollToTop} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {profileLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#F54E25" />
          </View>
        ) : null}

        {showCompletenessCard ? (
          <View
            style={[
              styles.completenessCard,
              !isProfileComplete ? styles.completenessCardWarning : null,
            ]}
          >
            <View style={styles.completenessHead}>
              <View style={styles.completenessTitleRow}>
                {!isProfileComplete ? (
                  <Ionicons name="warning" size={18} color="#D97706" style={{ marginRight: 6 }} />
                ) : null}
                <Text style={styles.completenessTitle}>
                  {isProfileComplete ? 'Profile Completeness' : 'Complete your profile'}
                </Text>
              </View>
              <View style={styles.completenessHeadRight}>
                <View
                  style={[
                    styles.completenessBadge,
                    isProfileComplete ? styles.completenessBadgeComplete : styles.completenessBadgeIncomplete,
                  ]}
                >
                  <Text
                    style={[
                      styles.completenessBadgeText,
                      isProfileComplete ? styles.completenessBadgeTextComplete : styles.completenessBadgeTextIncomplete,
                    ]}
                  >
                    {isProfileComplete ? 'Complete' : 'Incomplete'}
                  </Text>
                </View>
                {isProfileComplete ? (
                  <TouchableOpacity
                    onPress={dismissCompletenessCard}
                    style={styles.completenessDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss profile completeness"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {!isProfileComplete ? (
              <Text style={styles.completenessWarningText}>
                Add the missing details below so your care team can reach you.
              </Text>
            ) : null}

            <View style={styles.completenessTrack}>
              <View style={[styles.completenessFillWrap, { width: `${Math.max(completenessPct, 4)}%` }]}>
                <LinearGradient
                  colors={isProfileComplete ? ['#F54E25', '#EA580C'] : ['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>

            {!isProfileComplete ? (
              <View style={styles.completenessMissingList}>
                {missingProfileFields.map((field) => (
                  <View key={field} style={styles.completenessMissingRow}>
                    <Ionicons name="alert-circle" size={14} color="#D97706" />
                    <Text style={styles.completenessMissingText}>{field} required</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.completenessMeta} numberOfLines={2}>
                {completenessMeta}
              </Text>
            )}
          </View>
        ) : null}

        <View style={styles.profileShell}>
          <LinearGradient
            colors={['#0F172A', '#1A2744', '#243056']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHero}
          >
            <View style={styles.heroDecoA} />
            <View style={styles.heroDecoB} />
            <View style={styles.heroBody}>
              <View style={styles.avatarWrap}>
                <LinearGradient
                  colors={['#F54E25', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}
                >
                  <TouchableOpacity
                    style={styles.avatarCircle}
                    onPress={() => setShowPhotoModal(true)}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                  >
                    {profileImageUri ? (
                      <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitials}>{deriveInitials(fullName)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
                <TouchableOpacity
                  style={styles.avatarEditFab}
                  onPress={() => setShowPhotoModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile photo"
                >
                  <Ionicons name="camera" size={16} color="#F54E25" />
                </TouchableOpacity>
              </View>
              <Text style={styles.displayName} numberOfLines={2}>
                {fullName}
              </Text>
              {email ? (
                <Text style={styles.displayEmail} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
            </View>
          </LinearGradient>

          <View style={styles.profileSheet}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionTitleIcon}>
                    <Ionicons name="person" size={14} color="#F54E25" />
                  </View>
                  <Text style={styles.sectionTitle}>Profile Information</Text>
                </View>
              </View>
              {!isEditingProfile ? (
                <TouchableOpacity style={styles.editPrimaryBtn} onPress={handleEditToggle} activeOpacity={0.88}>
                  <Ionicons name="pencil" size={14} color="#FFFFFF" />
                  <Text style={styles.editPrimaryBtnText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <ProfileField
              label="Full Name"
              value={isEditingProfile ? draftFullName : fullName}
              onChangeText={setDraftFullName}
              {...inputProps}
            />
            <ProfileField
              label="Email"
              value={email}
              onChangeText={() => {}}
              editable={false}
              placeholderTextColor="#94A3B8"
            />
            <ProfileField
              label="Phone Number"
              value={isEditingProfile ? draftPhone : phone}
              onChangeText={setDraftPhone}
              keyboardType="phone-pad"
              {...inputProps}
            />
            <ProfileField
              label="Address"
              value={isEditingProfile ? draftAddress : address}
              onChangeText={setDraftAddress}
              multiline
              {...inputProps}
            />

            <Text style={styles.groupLabel}>Settings</Text>
            <View style={styles.settingsGroup}>
              <TouchableOpacity style={styles.settingsRow} onPress={() => setSettingsSheet('password')}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color="#4338CA" />
                </View>
                <Text style={styles.settingsLink}>Change Password</Text>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
              <View style={styles.hDivider} />
              <TouchableOpacity style={styles.settingsRow} onPress={() => setSettingsSheet('notifications')}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="notifications-outline" size={18} color="#4338CA" />
                </View>
                <Text style={styles.settingsLink}>Notification Settings</Text>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)} activeOpacity={0.88}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <FamilyLogoutConfirmModal
        visible={showLogoutModal}
        loading={logoutLoading}
        onCancel={() => {
          if (!logoutLoading) setShowLogoutModal(false);
        }}
        onConfirm={() => void confirmLogout()}
      />

      <Modal
        animationType="slide"
        transparent
        visible={showPhotoModal}
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalBackdropBottom}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowPhotoModal(false)} />
          <View style={styles.photoModalCard}>
            <View style={styles.photoModalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add a Profile Picture</Text>
                <Text style={styles.photoModalSub}>Choose how you&apos;d like to upload your profile photo.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)} style={styles.photoModalClose}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.photoOptionRow} onPress={takePhotoWithCamera} activeOpacity={0.9}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="camera-outline" size={22} color="#F54E25" />
              </View>
              <View style={styles.photoOptionBody}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionDesc}>Use your device camera to capture a new photo.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoOptionRow} onPress={pickImageFromLibrary} activeOpacity={0.9}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="image-outline" size={22} color="#F54E25" />
              </View>
              <View style={styles.photoOptionBody}>
                <Text style={styles.photoOptionTitle}>Upload from gallery</Text>
                <Text style={styles.photoOptionDesc}>Choose an existing image from your library.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FamilyBottomSheet
        visible={settingsSheet === 'password'}
        onClose={() => setSettingsSheet(null)}
        title="Change Password"
        subtitle="Update your account password"
        icon="lock-closed-outline"
        sheetHeight={Math.min(580, Dimensions.get('window').height * 0.78)}
      >
        <ProfileChangePasswordPanel onClose={() => setSettingsSheet(null)} />
      </FamilyBottomSheet>

      <FamilyBottomSheet
        visible={settingsSheet === 'notifications'}
        onClose={() => setSettingsSheet(null)}
        title="Notification Settings"
        subtitle="Sounds and mute preferences"
        icon="notifications-outline"
        sheetHeight={340}
      >
        <ProfileNotificationSettingsPanel />
      </FamilyBottomSheet>

      <FamilyWebMobileNav active="profile" />
    </View>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  editable = true,
  multiline,
  keyboardType,
  placeholderTextColor,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  placeholderTextColor?: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, !editable && styles.fieldInputReadonly, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={editable ? `Enter ${label.toLowerCase()}` : undefined}
        placeholderTextColor={placeholderTextColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  completenessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 28,
      },
      android: { elevation: 3 },
    }),
  },
  completenessCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  completenessHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  completenessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  completenessHeadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  completenessDismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  completenessTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  completenessBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  completenessBadgeComplete: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  completenessBadgeIncomplete: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  completenessBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  completenessBadgeTextComplete: { color: '#166534' },
  completenessBadgeTextIncomplete: { color: '#92400E' },
  completenessTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    marginBottom: 10,
  },
  completenessFillWrap: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 8,
  },
  completenessMeta: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
  completenessWarningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  completenessMissingList: {
    gap: 6,
    marginTop: 2,
  },
  completenessMissingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completenessMissingText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },
  profileShell: {
    overflow: 'hidden',
    marginBottom: 8,
  },
  profileHero: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
    overflow: 'hidden',
  },
  heroDecoA: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroDecoB: {
    position: 'absolute',
    bottom: -30,
    left: '20%',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 78, 37, 0.15)',
  },
  heroBody: {
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    padding: 4,
    borderRadius: 64,
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.35,
        shadowRadius: 40,
      },
      android: { elevation: 8 },
    }),
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  avatarEditFab: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  displayName: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  displayEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '500',
    textAlign: 'center',
  },
  profileSheet: {
    marginTop: -22,
    marginHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  sectionTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
    marginLeft: 4,
  },
  settingsGroup: {
    backgroundColor: '#F8FAFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#FFF5F0',
    borderWidth: 1,
    borderColor: '#FFDFD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  editPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F54E25',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 40,
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  editPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minHeight: 42,
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    minWidth: 72,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  fieldInputReadonly: {
    backgroundColor: '#F8FAFC',
    color: '#475569',
    borderColor: '#E9EDF7',
  },
  fieldInputMulti: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLink: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1B2559',
  },
  hDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E9EDF7',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    marginBottom: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalPrimaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    minHeight: 44,
    justifyContent: 'center',
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdropBottom: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  photoModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 3,
    borderTopColor: '#F54E25',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  photoModalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  photoModalSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '500',
  },
  photoModalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    minHeight: 44,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
      },
      android: { elevation: 2 },
    }),
  },
  photoOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F0',
    borderWidth: 1,
    borderColor: '#FFDFD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionBody: {
    flex: 1,
    minWidth: 0,
  },
  photoOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  photoOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    fontWeight: '500',
  },
});
