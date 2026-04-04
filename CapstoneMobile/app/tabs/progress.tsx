import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/BOHLogo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greetingText}>
          <Text style={styles.highlightText}>Hello,</Text> Jane Doe
        </Text>
        <Text style={styles.subGreeting}>Here's an overview of your family members</Text>

        {/* Patient Card */}
        <View style={styles.patientCard}>
          <View style={styles.patientHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={30} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.patientName}>John Doe</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Recovering</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoItem 
              icon="calendar" 
              label="Date of Admission" 
              value="January 15, 2026" 
              iconColor="#2B31ED" 
            />
            <InfoItem 
              icon="target" 
              label="Success Rate" 
              value="83%" 
              iconColor="#E91E63" 
              isCommunityIcon 
            />
            <View style={styles.progressSection}>
               <View style={styles.infoIconBox}>
                  <MaterialCommunityIcons name="trending-up" size={20} color="#4CAF50" />
               </View>
               <View style={{ flex: 1 }}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.infoLabel}>Recovery Progress</Text>
                    <Text style={styles.progressPercent}>65%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '65%' }]} />
                  </View>
               </View>
            </View>
            <InfoItem 
              icon="puzzle-outline" 
              label="Activities" 
              value="View list" 
              iconColor="#2196F3" 
              isCommunityIcon
              hideValue 
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.viewDetailsBtn}
              onPress={() => router.navigate(TAB_ROUTES.weeklyReport)}
            >
              <MaterialCommunityIcons name="pulse" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>View Details</Text>
            </TouchableOpacity>
            
            {/* UPDATED DISCHARGE BUTTON */}
            <TouchableOpacity 
              style={styles.dischargeBtn}
              onPress={() => router.navigate(TAB_ROUTES.discharge)}
              activeOpacity={0.7}
            >
              <Ionicons name="person-remove" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Discharge</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dashed Admit Button */}
        <TouchableOpacity 
          style={styles.dashedButton}
          onPress={() => router.navigate(TAB_ROUTES.admission)}
        >
          <Ionicons name="add" size={30} color="#CCCCCC" />
          <Text style={styles.dashedButtonText}>Admit a Patient</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TabItem
          img={require('../../assets/images/home-icon.png')}
          label="Home"
          onPress={() => router.navigate(TAB_ROUTES.home)}
        />
        <TabItem
          img={require('../../assets/images/progress-icon.png')}
          label="Progress"
          active
          onPress={() => router.navigate(TAB_ROUTES.progress)}
        />
        <TabItem
          img={require('../../assets/images/messages-icon.png')}
          label="Message"
          onPress={() => router.navigate(TAB_ROUTES.messages)}
        />
        <TabItem
          img={require('../../assets/images/profile-icon.png')}
          label="Profile"
          onPress={() => router.navigate(TAB_ROUTES.profile)}
        />
      </View>
    </View>
  );
}

const InfoItem = ({ icon, label, value, iconColor, isCommunityIcon, hideValue }: any) => (
  <View style={styles.infoItem}>
    <View style={[styles.infoIconBox, { backgroundColor: '#F5F5F5' }]}>
      {isCommunityIcon ? (
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      ) : (
        <Ionicons name={icon} size={20} color={iconColor} />
      )}
    </View>
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      {!hideValue && <Text style={styles.infoValue}>{value}</Text>}
      {label === "Activities" && (
        <View style={styles.activitiesIconRow}>
           <MaterialCommunityIcons name="puzzle-outline" size={16} color="#2196F3" />
        </View>
      )}
    </View>
  </View>
);

const TabItem = ({ img, label, active, onPress }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Image
      source={img}
      style={[styles.tabIcon, { tintColor: active ? "#F54E25" : "#999999" }]}
      resizeMode="contain"
    />
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
  },
  headerLogo: {
    width: 60,
    height: 30,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 20,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
  },
  highlightText: {
    color: '#F54E25',
  },
  subGreeting: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginBottom: 30,
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    marginBottom: 20,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F54E25',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#FBC02D',
    fontWeight: 'bold',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    width: '48%',
    marginBottom: 20,
    alignItems: 'center',
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 10,
    color: '#999',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  progressSection: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#EEE',
    borderRadius: 3,
    marginTop: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2B31ED',
  },
  buttonRow: {
    marginTop: 10,
  },
  viewDetailsBtn: {
    backgroundColor: '#F54E25',
    flexDirection: 'row',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dischargeBtn: {
    backgroundColor: '#F54E25',
    flexDirection: 'row',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  dashedButton: {
    height: 70,
    borderWidth: 2,
    borderColor: '#EEE',
    borderStyle: 'dashed',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  dashedButtonText: {
    color: '#BBB',
    fontWeight: '600',
    marginLeft: 10,
    fontSize: 16,
  },
  activitiesIconRow: {
    marginTop: 2,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F5F5F5',
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