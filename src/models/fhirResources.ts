import { fhirclient } from 'fhirclient/lib/types';
import { Basic, Condition, Medication, MedicationDispense, MedicationRequest, Observation, Organization, Patient, Practitioner, Procedure, Resource } from '../fhir-types/fhir-r4';

export interface EHRData {
  patient: Patient,
  fhirUser?: Practitioner,
  conditions: [Condition],
  prescriptions: [MedicationRequest],
  procedures: [Procedure],
  labResults: [Observation]
}

export interface PDMPData {
  dispensations: [MedicationDispense],
  patients: [Patient],
  headers: [Basic]
}

export interface PDMPResults {
  dispensations: [PDMPDispense],
  reportingState: String,
  message: String
}

export interface PDMPDispense {
  dispense: MedicationDispense,
  dispenser: Organization,
  medication: Medication,
  patient: Patient,
  prescriber: Practitioner,
  prescription: MedicationRequest
}
