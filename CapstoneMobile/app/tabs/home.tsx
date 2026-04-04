import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';

const { width } = Dimensions.get('window');

const statusItems = [
  { title: 'Admission Request', status: 'In Review', color: '#F59E0B' },
  { title: 'Medical Requirements', status: 'Needs Action', color: '#EF4444' },
  { title: 'Weekly Report', status: 'Approved', color: '#10B981' },
];

const notifications = [
  { icon: 'notifications-outline', text: 'Submit missing lab result before Friday.' },
  { icon: 'calendar-outline', text: 'Family session scheduled on April 5, 10:00 AM.' },
  { icon: 'checkmark-circle-outline', text: 'Weekly report was reviewed by your counselor.' },
];

const recentActivities = [
  { time: 'Today', text: 'You submitted your weekly report.' },
  { time: 'Yesterday', text: 'Admin updated your admission status.' },
  { time: '2 days ago', text: 'You uploaded a supporting document.' },
];

const reminders = [
  'Complete profile details',
  'Upload latest medical test result',
  'Review appointment schedule',
];

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

        <Text style={styles.sectionTitle}>Your Dashboard</Text>
        <View style={styles.metricsRow}>
          <DashboardMetric icon="document-text-outline" label="Requests" value="3" />
          <DashboardMetric icon="checkmark-done-circle-outline" label="Completed" value="1" />
          <DashboardMetric icon="warning-outline" label="Pending" value="2" />
        </View>

        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionTitle}>Recommended Next Step</Text>
          <Text style={styles.suggestionText}>
            Update your profile and submit missing requirements to speed up approval.
          </Text>
          <TouchableOpacity style={styles.suggestionButton} onPress={() => router.navigate(TAB_ROUTES.profile)}>
            <Text style={styles.suggestionButtonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          <ActionButton 
            icon="document-text" 
            label="Admission" 
            color="#F54E25" 
            onPress={() => router.navigate(TAB_ROUTES.admission)}
          />
          <ActionButton 
            icon="reader" 
            label="Weekly Report" 
            color="#F54E25" 
            onPress={() => router.navigate(TAB_ROUTES.weeklyReport)}
          />
          <ActionButton 
            icon="chatbubble" 
            label="Chat" 
            color="#F54E25" 
            onPress={() => router.navigate(TAB_ROUTES.messages)}
          />
          <ActionButton 
            icon="cube" 
            label="Services" 
            color="#F54E25" 
            onPress={() => router.navigate(TAB_ROUTES.services)}
          />
        </View>

        <Text style={styles.sectionTitle}>Request Status</Text>
        <View style={styles.cardSection}>
          {statusItems.map(item => (
            <View key={item.title} style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>{item.title}</Text>
                <Text style={[styles.statusText, { color: item.color }]}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Notification Center</Text>
        <View style={styles.cardSection}>
          {notifications.map(note => (
            <View key={note.text} style={styles.infoRow}>
              <Ionicons name={note.icon as any} size={18} color="#2B31ED" />
              <Text style={styles.infoRowText}>{note.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.cardSection}>
          {recentActivities.map(activity => (
            <View key={activity.text} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineTime}>{activity.time}</Text>
                <Text style={styles.timelineText}>{activity.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Document Vault</Text>
        <View style={styles.cardSection}>
          <View style={styles.infoRow}>
            <Ionicons name="folder-open-outline" size={18} color="#2B31ED" />
            <Text style={styles.infoRowText}>3 documents uploaded</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
            <Text style={styles.infoRowText}>1 file needs re-upload due to low quality</Text>
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.navigate(TAB_ROUTES.admission)}>
            <Text style={styles.secondaryButtonText}>Upload Documents</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Calendar & Reminders</Text>
        <View style={styles.cardSection}>
          {reminders.map(item => (
            <View key={item} style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#2B31ED" />
              <Text style={styles.infoRowText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Resources & Support</Text>
        <View style={styles.grid}>
          <ActionButton
            icon="help-circle"
            label="FAQ"
            color="#F54E25"
            onPress={() => router.navigate(TAB_ROUTES.services)}
          />
          <ActionButton
            icon="chatbox-ellipses"
            label="Support"
            color="#F54E25"
            onPress={() => router.navigate(TAB_ROUTES.messages)}
          />
        </View>

        <Text style={styles.sectionTitle}>Community Updates</Text>
        <View style={styles.cardSection}>
          <Text style={styles.announcementTitle}>Family Wellness Talk - April 9</Text>
          <Text style={styles.announcementText}>
            Join the monthly support session to learn practical ways families can help recovery.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Feedback</Text>
        <View style={styles.cardSection}>
          <Text style={styles.feedbackTitle}>How was your recent service experience?</Text>
          <View style={styles.feedbackRow}>
            {['😟', '😐', '🙂', '😀', '😍'].map(rate => (
              <TouchableOpacity key={rate} style={styles.feedbackEmoji}>
                <Text style={styles.feedbackEmojiText}>{rate}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
            onPress={() => router.navigate(TAB_ROUTES.admission)}
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
          onPress={() => router.navigate(TAB_ROUTES.home)}
        />
        <TabItem
          img={require('../../assets/images/progress-icon.png')}
          label="Progress"
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

const DashboardMetric = ({ icon, label, value }: any) => (
  <View style={styles.metricCard}>
    <Ionicons name={icon} size={20} color="#F54E25" />
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
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
    marginLeft: 5,
    marginTop: 4
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
    color: '#111827'
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  suggestionCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7AA'
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412'
  },
  suggestionText: {
    fontSize: 12,
    color: '#7C2D12',
    marginTop: 6
  },
  suggestionButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#F54E25',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  suggestionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12
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
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10
  },
  statusTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600'
  },
  statusText: {
    fontSize: 12,
    marginTop: 2
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  infoRowText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12,
    color: '#374151'
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F54E25',
    marginTop: 6,
    marginRight: 10
  },
  timelineTime: {
    fontSize: 11,
    color: '#6B7280'
  },
  timelineText: {
    fontSize: 12,
    color: '#111827',
    marginTop: 2
  },
  secondaryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F54E25',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: '#F54E25',
    fontSize: 12,
    fontWeight: '600'
  },
  announcementTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  announcementText: {
    fontSize: 12,
    color: '#4B5563'
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827'
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  feedbackEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  feedbackEmojiText: {
    fontSize: 20
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