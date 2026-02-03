export interface SoapNote {
  summary: string;
  patientInfo: {
    chiefComplaint: string;
    duration: string;
  };
  soap: {
    subjective: {
      presentIllness: string;
      symptoms: string[];
      severity: string;
      onset: string;
      associatedSymptoms: string[];
      pastMedicalHistory: string;
      medications: string[];
    };
    objective: {
      vitalSigns: {
        bloodPressure: string;
        pulse: string;
        temperature: string;
        respiratoryRate: string;
      };
      physicalExam: string;
      laboratoryFindings: string;
    };
    assessment: {
      diagnosis: string;
      icd10: string;
      differentialDiagnosis: string[];
      clinicalImpression: string;
    };
    plan: {
      treatment: string;
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
      }>;
      tests: string[];
      referral: string;
      followUp: string;
      patientEducation: string;
    };
  };
}
