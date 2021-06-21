import { decimal } from "../fhir-types/fhir-r4";

export interface CQLSummary {
  dispensations: [MedicationDispenseSummary],
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

export interface PDMPReport {
  Name: string,
  MME: string,
  Quantity: decimal,
  DaysSupply: decimal,
  Given: Date,
  Dispenser: string
}

/*

    "dateFilled": ToDate(medDisp.whenPrepared),
    "medicationName": medication.code.coding[0].display.value,
    "quantity": System.Quantity { value: medDisp.quantity.value }.value,
    "daysSupply": System.Quantity { value: medDisp.daysSupply.value }.value,
    "patientName": PatientNameText(patient),
    "patientBirthDate": ToString(patient.birthDate),
    "patientAddress": ToString(patient.address[0]),
    "prescriberName": HumanNameText(prescriber.name[0]),
    "prescriberCity": prescriber.address[0].city.value,
    "pharmacyName": pharmacy.name.value,
    "pharmacyCity": pharmacy.address[0].city.value,
    "reportingState": ReportingState
*/