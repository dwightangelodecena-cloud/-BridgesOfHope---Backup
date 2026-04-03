import React, { useEffect, useMemo, useState } from 'react';
import { User, Mail, ArrowLeft, X, Calendar, ClipboardList, Phone, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { appendActivityFeed } from '@/lib/activityFeed';
import logo from '@/assets/logo.png';

const Admission = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine where the user came from (defaults to progress if unknown)
  const fromPage = location.state?.from || '/progress';

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveBanner, setSaveBanner] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    patientName: '',
    patientBirthday: '',
    reasonForAdmission: '',
    agreeToTerms: false
  });

  const requiredFields = useMemo(() => ([
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email Address' },
    { key: 'phoneNumber', label: 'Phone Number' },
    { key: 'patientName', label: 'Patient Name' },
    { key: 'patientBirthday', label: 'Patient Birthday' },
    { key: 'reasonForAdmission', label: 'Reason for Admission' },
  ]), []);

  const completedFields = requiredFields.filter((field) => String(formData[field.key]).trim()).length;
  const progressPercent = Math.round((completedFields / requiredFields.length) * 100);

  useEffect(() => {
    const savedDraft = localStorage.getItem('bh_admission_draft');
    if (savedDraft) {
      try {
        setFormData(JSON.parse(savedDraft));
      } catch {
        localStorage.removeItem('bh_admission_draft');
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    let newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format";

    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required";
    if (!formData.patientName.trim()) newErrors.patientName = "Patient name is required";
    if (!formData.patientBirthday) newErrors.patientBirthday = "Birthday is required";
    if (!formData.reasonForAdmission) newErrors.reasonForAdmission = "Please select a reason";
    if (!formData.agreeToTerms) newErrors.agreeToTerms = "You must agree to the terms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const newPatient = {
        id: Date.now(),
        name: formData.patientName,
        date: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        progress: 0,
        isNew: true
      };

      const savedPending = localStorage.getItem('bh_pending_admissions');
      const currentPending = savedPending ? JSON.parse(savedPending) : [];

      const admissionRequest = {
        ...newPatient,
        reason: formData.reasonForAdmission,
        familyNumber: formData.phoneNumber,
        familyEmail: formData.email,
        patientNumber: formData.phoneNumber, // Reusing form phone number
        requestTime: "Just now"
      };

      const updatedPending = [...currentPending, admissionRequest];

      localStorage.setItem('bh_pending_admissions', JSON.stringify(updatedPending));
      window.dispatchEvent(new Event('storage'));

      appendActivityFeed(
        `Admission request submitted for ${formData.patientName.trim()}. Pending admin review.`
      );

      setShowSuccessModal(true);
    }
  };

  const saveDraft = () => {
    localStorage.setItem('bh_admission_draft', JSON.stringify(formData));
    setSaveBanner('Draft saved locally.');
    setTimeout(() => setSaveBanner(''), 1800);
  };

  const clearForm = () => {
    const resetState = {
      fullName: '',
      email: '',
      phoneNumber: '',
      patientName: '',
      patientBirthday: '',
      reasonForAdmission: '',
      agreeToTerms: false
    };
    setFormData(resetState);
    setErrors({});
    localStorage.removeItem('bh_admission_draft');
    setSaveBanner('Form has been reset.');
    setTimeout(() => setSaveBanner(''), 1800);
  };

  return (
    <div className="signup-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .signup-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .signup-content-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 120px;
          width: 90%;
          max-width: 1400px;
        }

        .brand-side { flex: 1; display: flex; justify-content: flex-end; }
        .brand-side img { width: 100%; max-width: 550px; height: auto; }
        .form-side { flex: 1; display: flex; justify-content: flex-start; }

        .signup-card {
          background: #ffffff;
          padding: 50px 45px;
          border-radius: 50px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 480px;
          text-align: center;
          border: 1px solid #f1f5f9;
          position: relative;
        }

        .back-button {
          position: absolute;
          left: 25px;
          top: 50px;
          cursor: pointer;
          color: #1e293b;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .back-button:hover { color: #F54E25; }
        .card-header-logo { height: 70px; margin-bottom: 35px; object-fit: contain; }

        .form-group { text-align: left; margin-bottom: 20px; position: relative; }
        .form-group label {
          display: block;
          font-size: 0.95rem;
          color: #475569;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .input-wrapper { position: relative; display: flex; align-items: center; }

        .input-wrapper input, .input-wrapper select {
          width: 100%;
          padding: 14px 15px 14px 48px;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          color: #1e293b;
          background-color: #ffffff;
          outline: none;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .input-wrapper input.input-error, .input-wrapper select.input-error {
          border-color: #ef4444;
          background-color: #fef2f2;
        }

        .error-message {
          color: #ef4444;
          font-size: 0.75rem;
          margin-top: 5px;
          font-weight: 500;
          margin-left: 4px;
        }

        .input-wrapper input:focus, .input-wrapper select:focus {
          border-color: #F54E25;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.1);
        }

        .input-icon { position: absolute; left: 18px; color: #94a3b8; pointer-events: none; z-index: 1; }

        .terms-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 25px 0 5px 0;
          font-size: 0.9rem;
          color: #64748b;
        }

        .terms-group input[type="checkbox"] {
          appearance: none;
          width: 18px;
          height: 18px;
          border: 2px solid #e2e8f0;
          border-radius: 4px;
          background-color: #ffffff;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }

        .terms-group input[type="checkbox"]:checked {
          background-color: #F54E25;
          border-color: #F54E25;
        }

        .terms-group input[type="checkbox"]:checked::after {
          content: '✔';
          position: absolute;
          color: white;
          font-size: 11px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .terms-group span { color: #F54E25; font-weight: 600; cursor: pointer; }

        .btn-primary {
          width: 100%;
          background: #F54E25;
          color: white;
          padding: 16px;
          border: none;
          border-radius: 14px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        }

        .btn-secondary {
          width: 100%;
          background: #FFF4F1;
          color: #F54E25;
          padding: 14px;
          border: 1px solid #FECACA;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          margin-top: 10px;
        }

        .meta-card {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          text-align: left;
          margin-bottom: 16px;
          background: #F8FAFC;
        }

        .save-banner {
          background: #ECFDF3;
          color: #166534;
          border: 1px solid #A7F3D0;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2000;
          backdrop-filter: blur(2px);
        }

        .modal-card {
          background: #ffffff;
          width: 100%;
          max-width: 850px;
          max-height: 90vh;
          border-radius: 40px;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px rgba(0,0,0,0.2);
          overflow: hidden;
          animation: modalPop 0.3s ease-out;
        }

        @keyframes modalPop {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .modal-close-btn {
          position: absolute;
          right: 30px; top: 30px;
          background: none; border: none;
          cursor: pointer; color: #000; z-index: 10;
        }

        .modal-content-area { flex: 1; overflow-y: auto; padding: 50px 60px; }
        .modal-header { text-align: center; margin-bottom: 40px; }
        .modal-header h1 { font-size: 2.2rem; font-weight: 800; margin: 0; color: #000; }
        .modal-header p { font-size: 1rem; color: #475569; margin-top: 5px; font-weight: 500; }
        .terms-text-container { text-align: left; color: #1e293b; line-height: 1.5; font-size: 0.95rem; }
        .terms-section { margin-bottom: 25px; }
        .terms-section h3 { font-size: 1rem; font-weight: 700; margin-bottom: 10px; color: #000; }
        .modal-footer { padding: 30px 60px 50px 60px; background: #ffffff; }

        .btn-modal-agree {
          width: 100%;
          background: #F54E25;
          color: white;
          padding: 18px;
          border: none;
          border-radius: 15px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .modal-card { width: 95%; max-width: 500px; max-height: 88vh; border-radius: 35px; }
          .signup-card { border: none; box-shadow: none; padding: 20px; border-radius: 0; }
          .brand-side { display: none; }
          .signup-content-wrapper { gap: 0; width: 100%; }
        }
      `}</style>

      <div className="signup-content-wrapper">
        <div className="brand-side">
          <img src={logo} alt="Bridges of Hope" />
        </div>

        <div className="form-side">
          <div className="signup-card">
            <button type="button" className="back-button" onClick={() => navigate(-1)}>
              <ArrowLeft size={24} />
            </button>
            <img src={logo} alt="BH Logo" className="card-header-logo" />

            {saveBanner && <div className="save-banner">{saveBanner}</div>}

            <div className="meta-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>Form Completion</span>
                <span style={{ fontWeight: 700, color: '#F54E25', fontSize: '0.86rem' }}>{progressPercent}%</span>
              </div>
              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 999 }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: '#F54E25', borderRadius: 999 }} />
              </div>
              <p style={{ marginTop: 8, color: '#64748b', fontSize: '0.8rem' }}>
                {completedFields} of {requiredFields.length} required fields completed
              </p>
            </div>

            <div className="meta-card">
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.86rem', marginBottom: 6 }}>Admission Checklist</div>
              {requiredFields.map((field) => (
                <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 5 }}>
                  <span style={{ color: '#475569' }}>{field.label}</span>
                  <span style={{ color: String(formData[field.key]).trim() ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                    {String(formData[field.key]).trim() ? 'Done' : 'Pending'}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#64748b' }}>
                Estimated review: 1-3 business days after submission.
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label>Full Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={22} />
                  <input name="fullName" type="text" placeholder="Your full name" className={errors.fullName ? 'input-error' : ''} value={formData.fullName} onChange={handleChange} />
                </div>
                {errors.fullName && <div className="error-message">{errors.fullName}</div>}
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={22} />
                  <input name="email" type="email" placeholder="Email address" className={errors.email ? 'input-error' : ''} value={formData.email} onChange={handleChange} />
                </div>
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={22} />
                  <input name="phoneNumber" type="text" placeholder="Contact number" className={errors.phoneNumber ? 'input-error' : ''} value={formData.phoneNumber} onChange={handleChange} />
                </div>
                {errors.phoneNumber && <div className="error-message">{errors.phoneNumber}</div>}
              </div>

              <div className="form-group">
                <label>Patient Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={22} />
                  <input name="patientName" type="text" placeholder="Patient's full name" className={errors.patientName ? 'input-error' : ''} value={formData.patientName} onChange={handleChange} />
                </div>
                {errors.patientName && <div className="error-message">{errors.patientName}</div>}
              </div>

              <div className="form-group">
                <label>Patient Birthday</label>
                <div className="input-wrapper">
                  <Calendar className="input-icon" size={22} />
                  <input name="patientBirthday" type="date" required className={errors.patientBirthday ? 'input-error' : ''} value={formData.patientBirthday} onChange={handleChange} />
                </div>
                {errors.patientBirthday && <div className="error-message">{errors.patientBirthday}</div>}
              </div>

              <div className="form-group">
                <label>Reason for Admission</label>
                <div className="input-wrapper">
                  <ClipboardList className="input-icon" size={22} />
                  <select name="reasonForAdmission" className={errors.reasonForAdmission ? 'input-error' : ''} value={formData.reasonForAdmission} onChange={handleChange}>
                    <option value="">Select Reason</option>
                    <option value="Substance Abuse">Substance Abuse</option>
                    <option value="Non-Substance Abuse">Non-Substance Abuse</option>
                  </select>
                </div>
                {errors.reasonForAdmission && <div className="error-message">{errors.reasonForAdmission}</div>}
              </div>

              <div className="terms-group">
                <input type="checkbox" name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange} />
                <p>I agree to the <span onClick={() => setShowTermsModal(true)}>Privacy Policy</span> and <span onClick={() => setShowTermsModal(true)}>Terms</span></p>
              </div>
              {errors.agreeToTerms && <div className="error-message" style={{ textAlign: 'center', marginBottom: '10px' }}>{errors.agreeToTerms}</div>}

              <button type="submit" className="btn-primary">Submit Admission</button>
              <button type="button" className="btn-secondary" onClick={saveDraft}>Save Draft</button>
              <button type="button" className="btn-secondary" onClick={clearForm}>Reset Form</button>
            </form>
          </div>
        </div>
      </div>

      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowTermsModal(false)}>
              <X size={28} />
            </button>
            <div className="modal-content-area">
              <div className="modal-header">
                <h1>TERMS AND CONDITIONS</h1>
                <p>Clinic Admission and Patient Management System</p>
              </div>
              <div className="terms-text-container">
                <div className="terms-section">
                  <h3>1. Acceptance of Terms</h3>
                  <p>By accessing, registering, or using this application and web system (“the System”), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the System immediately.</p>
                </div>

                <div className="terms-section">
                  <h3>2. Purpose of the System</h3>
                  <p>The System is designed to facilitate admission processing, patient record management, scheduling, monitoring, and communication between the clinic, patients, and authorized guardians. The System supports administrative and informational functions only and does not replace professional medical judgment, diagnosis, or treatment.</p>
                </div>

                <div className="terms-section">
                  <h3>3. User Eligibility and Accounts</h3>
                  <p>Users must provide accurate and complete information during registration and admission application. Guardians submitting applications on behalf of patients confirm they are legally authorized to provide the patient’s information. Users are responsible for maintaining the confidentiality of their login credentials and all activities performed under their account.</p>
                </div>

                <div className="terms-section">
                  <h3>4. Data Collection and Privacy</h3>
                  <p>The System collects personal and health-related information necessary for admission processing, monitoring, and care coordination. By using the System, you consent to the storage and processing of submitted information within the secure clinic database. Access to records is restricted to authorized personnel only and handled in accordance with applicable data privacy regulations and institutional policies.</p>
                </div>

                <div className="terms-section">
                  <h3>5. Accuracy of Information</h3>
                  <p>Users agree to provide truthful, current, and complete information. Submission of false, misleading, or incomplete data may result in delayed admission processing, suspension of account access, or rejection of applications.</p>
                </div>

                <div className="terms-section">
                  <h3>6. Communication and Notification</h3>
                  <p>The System may send notifications regarding admission status, schedules, updates, and relevant announcements. These notifications are informational and should not be interpreted as medical advice or emergency instructions.</p>
                </div>

                <div className="terms-section">
                  <h3>7. System Availability</h3>
                  <p>The clinic will make reasonable efforts to maintain continuous system availability. However, temporary interruptions may occur due to maintenance, updates, technical issues, or network conditions. The clinic is not liable for delays caused by such interruptions.</p>
                </div>

                <div className="terms-section">
                  <h3>8. Acceptable Use</h3>
                  <p>Users agree not to misuse the System. Prohibited actions include unauthorized access, attempting to alter records without permission, uploading harmful content, sharing accounts, or interfering with system operations. Violations may result in account suspension and further action as permitted by law.</p>
                </div>

                <div className="terms-section">
                  <h3>9. Record Access and Confidentiality</h3>
                  <p>Patient records are confidential and may only be accessed by authorized staff and the registered patient or guardian. Users agree not to share retrieved information with unauthorized individuals and to respect the privacy of all patients within the System.</p>
                </div>

                <div className="terms-section">
                  <h3>10. Limitation of Liability</h3>
                  <p>The System is intended to support administrative processes. The clinic is not responsible for decisions made solely based on system information without consultation with qualified healthcare professionals. The System does not provide emergency medical services.</p>
                </div>

                <div className="terms-section">
                  <h3>11. Modifications to Terms</h3>
                  <p>The clinic reserves the right to modify these Terms and Conditions at any time. Continued use of the System after updates indicates acceptance of the revised terms.</p>
                </div>

                <div className="terms-section">
                  <h3>12. Termination of Access</h3>
                  <p>The clinic may suspend or terminate access if users violate these Terms, misuse the System, or compromise security or patient confidentiality.</p>
                </div>

                <div className="terms-section">
                  <h3>13. Contact Information</h3>
                  <p>For questions, corrections to records, or concerns regarding these Terms, users may contact the clinic administration through the official communication channels provided within the System.</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-agree" onClick={() => { setFormData(prev => ({ ...prev, agreeToTerms: true })); setShowTermsModal(false); }}>
                I agree to the Terms of Service
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center', padding: '40px 30px', margin: 'auto' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px auto' }}>
              <CheckCircle size={40} />
            </div>
            <h2 style={{ fontSize: '1.6rem', color: '#1e293b', marginBottom: '15px', fontWeight: '800' }}>Application Submitted!</h2>
            <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '35px', lineHeight: '1.5' }}>Your request has been sent to the admin for approval.</p>
            <button style={{ width: '100%', background: '#F54E25', color: 'white', padding: '16px', border: 'none', borderRadius: '14px', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer' }} onClick={() => { setShowSuccessModal(false); navigate(fromPage); }}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admission;