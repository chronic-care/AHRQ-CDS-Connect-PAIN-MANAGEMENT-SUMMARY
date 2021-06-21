// # Introduction

// Summarize PMDP Medication Dispense responses from RxCheck.

library PDMPMedicationDispense version '1.0.0'

// # Data model #

using FHIR version '3.0.0'

// # Referenced libraries #

// The FHIRHelpers library provides common functions for simplifying interaction w/ the FHIR R4 data model.
include FHIRHelpers version '3.0.0'

// # CDS logic #

// context Unfiltered   // not supported
context Patient

define ReportingState: 'KY'

/*
define ReportingState:
  First([Basic] B
    let value: Extension(B, 'http://rxcheck.org/fhir/profiles/status-resource#system').value
    return Last(Split(value,':'))
  )

define PDMPStatus:
  First([Basic] B
    return Extension(B, 'http://rxcheck.org/fhir/profiles/status-resource#status').value
  )

define PDMPMessage:
  First([Basic] B
    return Extension(B, 'http://rxcheck.org/fhir/profiles/status-resource#message').value
  )
*/

define MedicationDispenseSummary:
  [MedicationDispense] medDisp
    let patient: Patient,
        medication: ResolveMedication(medDisp.medication),
        pharmacy: ResolveOrganization(medDisp.performer[0].actor),
        prescription: ResolveMedicationRequest(medDisp.authorizingPrescription[0]),
        prescriber: ResolvePractitioner(prescription.requester)
  return {
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
  }
  sort by dateFilled desc

// Returns full name preferring 'official' use, if available.
define function PatientNameText(patient Patient):
  ( Coalesce(GetPatientName(patient, 'official'),
    GetPatientName(patient, 'usual'),
    patient.name[0]) ) Name
  return HumanNameText(Name)
  //return Coalesce(Name.text.value,
  // (Combine(Name.given G return G.value, ' ') + ' ' + Name.family.value)
  //)

define function HumanNameText(name HumanName):
  Coalesce(name.text.value,
   (Combine(name.given G return G.value, ' ') + ' ' + name.family.value),
   name.family.value   // when given name is missing
  )

define function GetPatientName(patient Patient, use String):
  First((patient.name N where N.use.value = use) Name
    return Name
  )

define function ToString(address Address):
  Combine(address.line L return L.value, ' ') + ', ' + address.city.value + ', ' + address.state.value

/*
@description: Returns any extensions defined on the given resource with the specified url.
@comment: NOTE: Extensions are not the preferred approach, but are used as a way to access
content that is defined by extensions but not yet surfaced in the
CQL model info.
*/
define function Extensions(domainResource DomainResource, url String):
  domainResource.extension E
	  where E.url = url
		return E

/*
@description: Returns the single extension (if present) on the given resource with the specified url.
@comment: This function uses singleton from to ensure that a run-time exception is thrown if there
is more than one extension on the given resource with the specified url.
*/
define function Extension(domainResource DomainResource, url String):
  singleton from "Extensions"(domainResource, url)

define function ResolveMedication(reference FHIR.Reference):
  First([Medication] med
    where reference.reference.value = 'Medication/'+med.id.value
  )

define function ResolveOrganization(reference FHIR.Reference):
  First([Organization] org
    where reference.reference.value = 'Organization/'+org.id.value
  )

define function ResolveMedicationRequest(reference FHIR.Reference):
  First([MedicationRequest] medReq
    where reference.reference.value = 'MedicationRequest/'+medReq.id.value
  )

define function ResolvePractitioner(reference FHIR.Reference):
  First([Practitioner] resource
    where reference.reference.value = 'Practitioner/'+resource.id.value
  )



define function ResolveContainedPatient(reference FHIR.Reference, owner FHIR.DomainResource):
  First((owner.contained) resource
    where resource.Patient.id.value = reference.reference.value
    return resource.Patient
  )

define function ResolveContainedMedication(reference FHIR.Reference, owner FHIR.MedicationDispense):
  First((owner.contained) resource
    where resource.Medication.id.value = reference.reference.value
    return resource.Medication
  )

define function ResolveContainedPractitioner(reference FHIR.Reference, owner FHIR.MedicationDispense):
  First((owner.contained) resource
    where resource.Practitioner.id.value = reference.reference.value
    return resource.Practitioner
  )

define function ResolveContainedOrganization(reference FHIR.Reference, owner FHIR.MedicationDispense):
  First((owner.contained) resource
    where resource.Organization.id.value = reference.reference.value
    return resource.Organization
  )

define function ResolveContainedMedicationRequest(reference FHIR.Reference, owner FHIR.MedicationDispense):
  First((owner.contained) resource
    where resource.MedicationRequest.id.value = reference.reference.value
    return resource.MedicationRequest
  )
