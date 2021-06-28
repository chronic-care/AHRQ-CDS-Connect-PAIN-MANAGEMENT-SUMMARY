import { decimal } from "../fhir-types/fhir-r4";

export interface CQLSummary {
  pdmpStatus: PDMPStatus,
  dispensations: [MedicationDispenseSummary],
}

export interface PDMPStatus {
  reportingState: string,
  status: string,
  message: string,
}

export interface MedicationDispenseSummary {
  dateFilled: Date,
  medicationName: String,
  quantity: decimal,
  daysSupply: decimal,
  patientName: string,
  patientBirthDate: string,
  patientAddress: string,
  prescriberName: String,
  prescriberCity: string,
  pharmacyName: string,
  pharmacyCity: string,
  reportingState: string,
}
