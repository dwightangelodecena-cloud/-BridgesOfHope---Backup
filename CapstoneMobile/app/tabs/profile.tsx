import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';

const TAGALOG_PREF_KEY = 'profile_translate_tagalog';

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
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [translateTagalog, setTranslateTagalog] = useState(false);
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

  useEffect(() => {
    AsyncStorage.getItem(TAGALOG_PREF_KEY).then((v) => {
      if (v === '1') setTranslateTagalog(true);
    });
  }, []);

  const persistTagalog = useCallback(async (value: boolean) => {
    setTranslateTagalog(value);
    try {
      await AsyncStorage.setItem(TAGALOG_PREF_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

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
    } catch {
      /* keep defaults */
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      if (uri) setProfileImageUri(uri);
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
      if (uri) setProfileImageUri(uri);
    }
    setShowPhotoModal(false);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await supabase.auth.signOut();
    } catch {
      /* still navigate */
    }
    router.replace('/login');
  };

  const inputProps = {
    editable: isEditingProfile,
    placeholderTextColor: '#A3AED0',
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate(TAB_ROUTES.home)} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#1B2559" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {profileLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#F54E25" />
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={48} color="#FFFFFF" />
              )}
            </View>
            <TouchableOpacity style={styles.avatarEditFab} onPress={() => setShowPhotoModal(true)}>
              <Ionicons name="pencil" size={14} color="#F54E25" />
            </TouchableOpacity>
          </View>
          <Text style={styles.displayName}>{fullName}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            {!isEditingProfile ? (
              <TouchableOpacity style={styles.editOutlineBtn} onPress={handleEditToggle}>
                <Text style={styles.editOutlineBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.textBtn} onPress={handleCancelEdit}>
                  <Text style={styles.textBtnLabel}>Cancel</Text>
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
            label="Email"
            value={email}
            onChangeText={() => {}}
            editable={false}
            placeholderTextColor="#A3AED0"
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
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/newpassword')}>
            <Text style={styles.settingsLink}>Change Password</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.hDivider} />
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/notification')}>
            <Text style={styles.settingsLink}>Notification Settings</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Translate to Tagalog</Text>
            <Switch
              value={translateTagalog}
              onValueChange={persistTagalog}
              trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
              thumbColor={translateTagalog ? '#F54E25' : '#F4F4F5'}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.logoutRow} onPress={() => setShowLogoutModal(true)}>
            <Text style={styles.logoutText}>Logout</Text>
            <Ionicons name="log-out-outline" size={22} color="#E53935" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm logout</Text>
            <Text style={styles.modalText}>Are you sure you want to log out?</Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={confirmLogout}>
                <Text style={styles.modalPrimaryText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={showPhotoModal}
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalBackdropBottom}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowPhotoModal(false)} />
          <View style={styles.photoModalCard}>
            <Text style={styles.modalTitle}>Add a Profile Picture</Text>
            <TouchableOpacity style={styles.photoOptionRow} onPress={takePhotoWithCamera}>
              <Ionicons name="camera-outline" size={20} color="#1B2559" style={{ marginRight: 10 }} />
              <Text style={styles.photoOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoOptionRow} onPress={pickImageFromLibrary}>
              <Ionicons name="image-outline" size={20} color="#1B2559" style={{ marginRight: 10 }} />
              <Text style={styles.photoOptionText}>Upload from gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FamilyWebMobileNav active="profile" />
      <FamilyFloatingChat />
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
    backgroundColor: '#F8F9FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B2559',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 22,
  },
  avatarWrap: {
    position: 'relative',
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarEditFab: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  displayName: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: '#1B2559',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B2559',
  },
  editOutlineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  editOutlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B2559',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textBtn: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  textBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F54E25',
    minWidth: 72,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#F4F6F9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1B2559',
  },
  fieldInputReadonly: {
    opacity: 0.85,
    color: '#334155',
  },
  fieldInputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B2559',
  },
  hDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8ECF0',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  prefLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B2559',
    flex: 1,
    paddingRight: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53935',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B2559',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalPrimaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#F54E25',
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdropBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  photoModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  photoOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  photoOptionText: {
    fontSize: 15,
    color: '#1B2559',
    fontWeight: '500',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  tabIcon: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999',
  },
  activeTabLabel: {
    color: '#F54E25',
    fontWeight: '600',
  },
});
