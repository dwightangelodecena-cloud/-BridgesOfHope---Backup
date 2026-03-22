import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
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
        <Text style={styles.headerTitle}>Home</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Recovery Streak Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakHeader}>
            <View>
              <Text style={styles.welcomeText}>
                <Text style={styles.highlightText}>Welcome back,</Text> Jane
              </Text>
              <Text style={styles.streakDays}>42 Days</Text>
              <Text style={styles.streakSubtext}>Recovery Streak</Text>
            </View>
            <View style={styles.fireCircle}>
              <MaterialCommunityIcons name="fire" size={32} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '65%' }]} />
            </View>
            <View style={styles.progressLabelRow}>
              <Text style={styles.milestoneText}>Next Milestone: 60 Days</Text>
              <Text style={styles.percentageText}>65%</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          <ActionButton 
            icon="document-text" 
            label="Admission" 
            color="#F54E25" 
            onPress={() => router.push('../AdmissionForm')} 
          />
          <ActionButton 
            icon="reader" 
            label="Weekly Report" 
            color="#F54E25" 
            onPress={() => router.push('./ViewDetailPage')}
          />
          <ActionButton 
            icon="chatbubble" 
            label="Chat" 
            color="#F54E25" 
            onPress={() => router.push('../tabs/Messages')}
          />
          <ActionButton 
            icon="cube" 
            label="Services" 
            color="#F54E25" 
            onPress={() => router.push('../services')} 
          />
        </View>

        {/* Patient Admission Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={30} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.detailsName}>Patient Admission</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>Status: Pending</Text></View>
            </View>
          </View>

          <View style={styles.detailsInfoRow}>
            <View style={styles.infoItem}>
              <View style={styles.infoIconBox}>
                <Ionicons name="calendar-outline" size={20} color="#2B31ED" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Date of Admission</Text>
                <Text style={styles.infoValue}>-- -- --</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIconBox, { backgroundColor: '#E8E9FF' }]}>
                <Ionicons name="trending-up" size={20} color="#2B31ED" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Recovery Progress</Text>
                <View style={styles.miniProgressBar} />
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.admitButton}
            onPress={() => router.push('../AdmissionForm')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
            <Text style={styles.admitButtonText}>Admit a Patient</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TabItem
          img={require('../../assets/images/home-icon.png')}
          label="Home"
          active
          onPress={() => router.push('./home')}
        />
        <TabItem
          img={require('../../assets/images/progress-icon.png')}
          label="Progress"
          onPress={() => router.push('./progress')}
        />
        <TabItem
          img={require('../../assets/images/messages-icon.png')}
          label="Message"
          onPress={() => router.push('../tabs/Messages')}
        />
        <TabItem
          img={require('../../assets/images/profile-icon.png')}
          label="Profile"
          onPress={() => router.push('../profile')}
        />
      </View>
    </View>
  );
}

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

const ActionButton = ({ icon, label, color, onPress }: any) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress}>
    <View style={styles.actionIconBox}>
      <Ionicons name={icon} size={30} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60
  },
  headerLogo: {
    width: 60,
    height: 30
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10
  },
  streakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 25
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  welcomeText: {
    fontSize: 24,
    color: '#333333'
  },
  highlightText: {
    color: '#F54E25',
    fontWeight: 'bold'
  },
  streakDays: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 5
  },
  streakSubtext: {
    color: '#999999',
    fontSize: 14
  },
  fireCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F54E25',
    justifyContent: 'center',
    alignItems: 'center'
  },
  progressContainer: {
    marginTop: 20
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F54E25'
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  milestoneText: {
    fontSize: 12,
    color: '#999999'
  },
  percentageText: {
    fontSize: 12,
    color: '#F54E25',
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    marginLeft: 5
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  actionItem: {
    width: (width - 60) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  actionIconBox: {
    marginBottom: 10
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333'
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F9F9F9'
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F54E25',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  detailsName: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  badge: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4
  },
  badgeText: {
    fontSize: 10,
    color: '#000000'
  },
  detailsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  infoIconBox: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  infoLabel: {
    fontSize: 10,
    color: '#999999'
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600'
  },
  miniProgressBar: {
    width: 60,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginTop: 4
  },
  admitButton: {
    backgroundColor: '#F54E25',
    flexDirection: 'row',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F54E25',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6
  },
  admitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10
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
    right: 0
  },
  tabItem: {
    alignItems: 'center',
    flex: 1
  },
  tabIcon: {
    width: 24,
    height: 24,
    marginBottom: 4
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999'
  },
  activeTabLabel: {
    color: '#F54E25',
    fontWeight: '600'
  },
  bottomNavDark: {
    backgroundColor: '#020617',
    borderColor: '#1F2937'
  }
});