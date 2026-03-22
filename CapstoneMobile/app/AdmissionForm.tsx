import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Modal, Alert, Animated} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdmissionForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [reason, setReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const options = ["Drugs", "Alcohol", "Gambling", "Others"];

  const progressAnim = useRef(new Animated.Value(0)).current;

  const handleNumericChange = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/\D/g, ''); 
    setter(cleaned);
  };

  const handleBirthdayChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setBirthday(formatted);
  };

  const validateEmail = (emailStr: string) => {
    return /\S+@\S+\.\S+/.test(emailStr);
  };

  const isValidDate = (dateString: string) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return false;
    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      year > 1900 && year <= new Date().getFullYear()
    );
  };

  const handleSubmit = () => {
    if (!firstName || !lastName || !email || !phone || !patientName || !birthday || !reason || !agreed) {
      Alert.alert("Missing Information", "Please fill in all required fields and agree to the terms.");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (phone.length < 11) {
      Alert.alert("Invalid Phone", "Phone number must be exactly 11 digits.");
      return;
    }

    if (!isValidDate(birthday)) {
      Alert.alert("Invalid Date", "Please enter a valid birthday (MM/DD/YYYY).");
      return;
    }

    setIsSubmitting(true);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000, 
      useNativeDriver: false,
    }).start(() => {
      Alert.alert("Success", "Admission request submitted!");
      setIsSubmitting(false);
      router.replace('/tabs/home');
    });
  };

  if (isSubmitting) {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '85%'], 
    });

    return (
      <View style={styles.splashContainer}>
        <Image 
          source={require('../assets/images/checkedenvelope.png')} 
          style={styles.splashIcon}
          resizeMode="contain"
        />

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressLabel}>Sending your Admission Request</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[
        styles.header, 
        { 
          paddingTop: insets.top,
          height: 70 + insets.top 
        }
      ]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        
        <Image 
          source={require('../assets/images/BOHLogo.png')}
          style={styles.headerLogo} 
          resizeMode="contain" 
        />
        
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flexContainer}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          <InputField label="First Name" placeholder="Enter your First Name" icon="person-outline" value={firstName} onChangeText={setFirstName} />
          <InputField label="Last Name" placeholder="Enter your Last Name" icon="person-outline" value={lastName} onChangeText={setLastName} />
          <InputField label="Email Address" placeholder="your.email@example.com" icon="mail-outline" keyboardType="email-address" value={email} onChangeText={setEmail} />
          
          <InputField 
            label="Phone Number" 
            placeholder="09123456789" 
            icon="call-outline" 
            keyboardType="phone-pad" 
            value={phone} 
            onChangeText={(text: string) => handleNumericChange(text, setPhone)}
            maxLength={11}
          />
          
          <InputField 
            label="Emergency Contact Number" 
            placeholder="09123456789" 
            icon="call-outline" 
            keyboardType="phone-pad" 
            value={emergencyPhone} 
            onChangeText={(text: string) => handleNumericChange(text, setEmergencyPhone)}
            maxLength={11}
          />

          <InputField label="Patient Name" placeholder="Enter patient's full name" icon="person-outline" value={patientName} onChangeText={setPatientName} />
          
          <InputField 
            label="Patient Birthday" 
            placeholder="MM/DD/YYYY" 
            icon="calendar-outline" 
            keyboardType="numeric"
            maxLength={10}
            value={birthday}
            onChangeText={handleBirthdayChange}
          />

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Reason for Admission</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={() => setIsModalVisible(true)}>
              <Ionicons name="help-circle-outline" size={20} color="#AAA" style={styles.icon} />
              <Text style={[styles.pickerText, !reason && {color: '#AAA'}]}>
                {reason || "Select a reason"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxText}>
              I agree to the <Text style={styles.linkText}>Privacy Policy</Text> and <Text style={styles.linkText}>Terms of Service</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Admission Request</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setIsModalVisible(false)} 
          activeOpacity={1}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Reason</Text>
            {options.map((item) => (
              <TouchableOpacity 
                key={item} 
                style={styles.optionItem} 
                onPress={() => { setReason(item); setIsModalVisible(false); }}
              >
                <Text style={styles.optionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const InputField = ({ label, placeholder, icon, keyboardType = "default", value, onChangeText, maxLength }: any) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={20} color="#AAA" style={styles.icon} />
      <TextInput 
        placeholder={placeholder} 
        placeholderTextColor="#AAA" 
        style={styles.input} 
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFF' 
  },
  flexContainer: {
    flex: 1
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    zIndex: 1000,
    elevation: 5,
  },
  backButton: { 
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  headerLogo: { 
    width: 80, 
    height: 40 
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: { 
    paddingHorizontal: 25, 
    paddingBottom: 40,
    paddingTop: 10
  },
  inputWrapper: { 
    marginBottom: 15 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: '#444', 
    marginBottom: 8 
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E8E8E8', 
    borderRadius: 15,
    height: 60, 
    paddingHorizontal: 15 
  },
  icon: { 
    marginRight: 10 
  },
  input: { 
    flex: 1, 
    fontSize: 14, 
    color: '#000' 
  },
  pickerText: { 
    fontSize: 14, 
    color: '#000' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: '85%', 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 20, 
    elevation: 5 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15, 
    textAlign: 'center', 
    color: '#333' 
  },
  optionItem: { 
    paddingVertical: 18, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  optionText: { 
    fontSize: 16, 
    textAlign: 'center', 
    color: '#555' 
  },
  checkboxRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 20 
  },
  checkbox: { 
    width: 22, 
    height: 22, 
    borderWidth: 1, 
    borderColor: '#DDD', 
    borderRadius: 6, 
    marginRight: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  checkboxChecked: { 
    backgroundColor: '#F54E25', 
    borderColor: '#F54E25' 
  },
  checkboxText: { 
    fontSize: 13, 
    color: '#666', 
    flex: 1 
  },
  linkText: { 
    fontWeight: 'bold', 
    color: '#444' 
  },
  submitButton: { 
    backgroundColor: '#F54E25', 
    height: 60, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  submitButtonText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },

  // --- Splash Styles ---
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashIcon: {
    width: 200,
    height: 200,
    marginBottom: 100,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 80,
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '80%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F54E25',
  },
  progressLabel: {
    marginTop: 20,
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
});