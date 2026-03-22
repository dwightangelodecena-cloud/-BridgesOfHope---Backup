import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, FlatList, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import WeeklyReportModal from '../WeeklyReport';

const { width } = Dimensions.get('window');

const weeksData = Array.from({ length: 12 }, (_, i) => ({
  id: (i + 1).toString(),
  weekNumber: i + 1,
}));

const dummyReportData: Record<number, any> = {
  1: {
    weekNumber: 1,
    patientName: "John Doe",
    overallProgress: 65,
    summary: "The patient shows steady improvement this week and is assessed at approximately 65% progress in recovery. Engagement in the rehabilitation program remains consistent.",
    behaviorParticipation: [
      "Actively participates in counseling and group sessions",
      "Demonstrates improved coping strategies and self-awareness",
      "Maintains cooperation with staff and peers"
    ],
    challenges: [
      "Occasional cravings reported",
      "Continues to work on stress management and emotional regulation"
    ],
    planForNextWeek: [
      "Continue counseling and relapse prevention strategies",
      "Strengthen coping skills and support system involvement"
    ],
    overallAssessment: "The patient is making positive progress and remains motivated toward continued recovery."
  },
};

export default function ViewDetailsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const handleWeekSelect = (weekNumber: number) => {
    const report = dummyReportData[weekNumber];
    
    if (report) {
      setSelectedReport(report);
      setModalVisible(true);
    } else {
      alert(`Detailed report for Week ${weekNumber} is not yet available.`);
    }
  };

  const renderWeekCard = ({ item }: { item: typeof weeksData[0] }) => (
    <TouchableOpacity 
      style={styles.weekCard} 
      onPress={() => handleWeekSelect(item.weekNumber)}
      activeOpacity={0.7}
    >
      <View style={styles.weekCircle}>
        <Text style={styles.weekCircleText}>{item.weekNumber}</Text>
      </View>
      <Text style={styles.weekLabel}>Week</Text>
      <Text style={styles.weekNumberText}>{item.weekNumber}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <View style={styles.mainInfoCard}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          
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

          <View style={styles.admissionGrid}>
            <View style={styles.gridItem}>
              <View style={styles.iconLabelRow}>
                <Ionicons name="calendar-outline" size={18} color="#2B31ED" />
                <Text style={styles.gridLabel}>Admission</Text>
              </View>
              <Text style={styles.gridValue}>Jan 15, 2026</Text>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.iconLabelRow}>
                <MaterialCommunityIcons name="pulse" size={18} color="#2B31ED" />
                <Text style={styles.gridLabel}>Reason</Text>
              </View>
              <Text style={styles.gridValue}>Substance Abuse</Text>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.iconLabelRow}>
                <Ionicons name="person-outline" size={18} color="#2B31ED" />
                <Text style={styles.gridLabel}>Admitted by</Text>
              </View>
              <Text style={styles.gridValue}>Mathil Doe</Text>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.iconLabelRow}>
                <MaterialCommunityIcons name="bed-outline" size={18} color="#2B31ED" />
                <Text style={styles.gridLabel}>Bed Level</Text>
              </View>
              <Text style={styles.gridValue}>Second Level</Text>
            </View>
          </View>

          <View style={styles.activitiesBar}>
            <View style={styles.activitiesLeft}>
               <MaterialCommunityIcons name="puzzle-outline" size={20} color="#2196F3" />
               <Text style={styles.activitiesText}>Activities</Text>
            </View>
            <Text style={styles.noActivitiesText}>No Current Activities</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="target" size={20} color="#E91E63" />
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
            <Text style={styles.statMainValue}>
              <Text style={styles.percentText}>83%</Text> Success
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="trending-up" size={20} color="#2B31ED" />
              <Text style={styles.statLabel}>Progress</Text>
            </View>
            <Text style={styles.statMainValue}>65%</Text>
            <View style={styles.statProgressBg}>
              <View style={[styles.statProgressFill, { width: '65%' }]} />
            </View>
          </View>
        </View>

        <View style={styles.reportHeaderRow}>
          <Text style={styles.sectionTitle}>Report History</Text>
          <TouchableOpacity>
            <Text style={styles.selectWeekText}>Select a week</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={weeksData}
          renderItem={renderWeekCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToInterval={170} 
          decelerationRate="fast"
        />
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TabItem img={require('../../assets/images/home-icon.png')} label="Home" onPress={() => router.push('./home')} />
        <TabItem img={require('../../assets/images/progress-icon.png')} label="Progress" active onPress={() => {}} />
        <TabItem img={require('../../assets/images/messages-icon.png')} label="Message" onPress={() => {}} />
        <TabItem img={require('../../assets/images/profile-icon.png')} label="Profile" onPress={() => {}} />
      </View>

      <WeeklyReportModal 
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        reportData={selectedReport}
      />
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
    height: 60,
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
  mainInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 20,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  closeButton: { 
    position: 'absolute', 
    right: 20, top: 20, 
    zIndex: 10 
  },
  patientHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20 
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
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333' 
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
    fontWeight: 'bold' 
  },
  admissionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
  },
  gridItem: { 
    width: '48%', 
    marginBottom: 15 
  },
  iconLabelRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  gridLabel: { 
    fontSize: 11, 
    color: '#999', 
    marginLeft: 6 
  },
  gridValue: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  activitiesBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 15,
  },
  activitiesLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  activitiesText: { 
    fontSize: 13, 
    color: '#666', 
    marginLeft: 10 
  },
  noActivitiesText: { 
    fontSize: 12, 
    color: '#999' 
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 25 
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  statLabel: { 
    fontSize: 12, 
    color: '#999', 
    marginLeft: 8 
  },
  statMainValue: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  percentText: { 
    color: '#2B31ED' 
  },
  statProgressBg: { 
    height: 6, 
    backgroundColor: '#EEE', 
    borderRadius: 3, 
    marginTop: 10, 
    overflow: 'hidden' 
  },
  statProgressFill: { 
    height: '100%', 
    backgroundColor: '#2B31ED' 
  },
  reportHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  selectWeekText: { 
    fontSize: 12, 
    color: '#999' 
  },
  carouselContainer: { 
    paddingRight: 20 
  },
  weekCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    alignItems: 'center',
    marginRight: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 30,
    marginTop: 10,
  },
  weekCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  weekCircleText: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  weekLabel: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333' 
  },
  weekNumberText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333' 
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
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
});