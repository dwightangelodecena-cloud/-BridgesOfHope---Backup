import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface WeeklyReportData {
  weekNumber: number;
  patientName: string;
  overallProgress: number;
  summary: string;
  behaviorParticipation: string[];
  challenges: string[];
  planForNextWeek: string[];
  overallAssessment: string;
}

interface WeeklyReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  reportData: WeeklyReportData | null;
}

export default function WeeklyReportModal({ isVisible, onClose, reportData }: WeeklyReportModalProps) {
  
  if (!reportData) {
    return null;
  }

  const ReportItem = ({ text }: { text: string }) => (
    <View style={styles.listItem}>
      <View style={styles.bulletContainer}>
         <View style={styles.bulletOuter}>
            <View style={styles.bulletInner} />
         </View>
      </View>
      <Text style={styles.listItemText}>{text}</Text>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                 <Ionicons name="document-text" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Week {reportData.weekNumber}</Text>
                <Text style={styles.headerTitleSub}>Report</Text>
              </View>
            </View>
            <Text style={styles.patientLabel}>Patient: {reportData.patientName}</Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>Overall Progress</Text>
                <Text style={[styles.progressPercent, {color: reportData.overallProgress >= 50 ? '#4CAF50' : '#F44336'}]}>
                    {reportData.overallProgress}%
                </Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${reportData.overallProgress}%` }]} />
            </View>
          </View>

          <ScrollView 
            style={styles.scrollBody} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>{reportData.summary}</Text>
            </View>

            <Text style={styles.sectionTitle}>Behavior and Participation</Text>
            {reportData.behaviorParticipation.map((item, index) => (
              <ReportItem key={`behavior-${index}`} text={item} />
            ))}

            <Text style={styles.sectionTitle}>Challenges</Text>
            {reportData.challenges.map((item, index) => (
              <ReportItem key={`challenge-${index}`} text={item} />
            ))}

            <Text style={styles.sectionTitle}>Plan for Next Week</Text>
            {reportData.planForNextWeek.map((item, index) => (
              <ReportItem key={`plan-${index}`} text={item} />
            ))}

            <View style={styles.assessmentCard}>
              <Text style={styles.assessmentTitle}>Overall Assessment</Text>
              <Text style={styles.cardText}>{reportData.overallAssessment}</Text>
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close Report</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#F54E25',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 20,
    paddingTop: Platform.OS === 'ios' ? 25 : 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTitleSub: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: -5,
  },
  patientLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
    alignSelf: 'flex-start',
    marginTop: 5
  },
  progressSection: {
    paddingHorizontal: 25,
    paddingVertical: 15,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2B31ED',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginTop: 20,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F54E25',
    paddingLeft: 10,
    marginLeft: -10,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#666666',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  bulletContainer: {
    marginRight: 15,
  },
  bulletOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulletInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F54E25',
  },
  listItemText: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  assessmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginTop: 25,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#EEEEEE'
  },
  assessmentTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  footer: {
    paddingHorizontal: 25,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
    paddingTop: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEEEEE',
  },
  closeButton: {
    backgroundColor: '#F54E25',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});