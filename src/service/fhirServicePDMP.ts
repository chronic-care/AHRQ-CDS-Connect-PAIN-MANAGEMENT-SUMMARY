// import FHIR from 'fhirclient';
import { fhirclient } from 'fhirclient/lib/types';
import { Basic, MedicationDispense, Resource, Patient } from '../fhir-types/fhir-r4';
import { EHRData, PDMPData } from '../models/fhirResources';
// import { properties } from './properties';
import { format } from 'date-fns';

const resourcesFrom = (response: fhirclient.JsonObject): [Resource] => {
  const entries = response.entry ?? [];
  return entries.map((entry: fhirclient.JsonObject) => entry.resource)
                .filter((resource: Resource) => resource.resourceType !== 'OperationOutcome');
};

const todayDate = new Date();
const yearAgoDate = new Date();
yearAgoDate.setDate(todayDate.getDate() - 365);

const getStartDateArg = (d: Date): string => `ge${format(d, 'yyyy-MM-dd')}`;
const getEndDateArg = (d: Date): string => `le${format(d, 'yyyy-MM-dd')}`;

// https://rxcheck-srs.ahrqdev.org/rxoutbound/fhir/MedicationDispense?subject:Patient.name.given=Rachel&subject:Patient.name.family=Green&subject:Patient.birthdate=1972-12-19&authorizingPrescription.dispenseRequest.validityPeriod=ge2020-04-01&authorizingPrescription.dispenseRequest.validityPeriod=le2021-04-23&_include=MedicationDispense:subject&_include=MedicationDispense:medication&_include:recurse=MedicationDispense:authorizingPrescription&practitioner.name=FC4358316/Jack%20Jons&practitioner.role=Physicians&_state=KY&_format=json&subject:Patient.gender=female&practitioner.deaNumber=AA4343WEQ111&practitioner.npi=887987136545645465465

const pdmpEndpoint = 'https://rxcheck-srs.ahrqdev.org/rxoutbound/fhir';
// const dispenseQuery = '/MedicationDispense?subject:Patient.name.given=Rachel&subject:Patient.name.family=Green&subject:Patient.birthdate=1972-12-19&authorizingPrescription.dispenseRequest.validityPeriod=ge2020-04-01&authorizingPrescription.dispenseRequest.validityPeriod=le2021-04-23&_include=MedicationDispense:subject&_include=MedicationDispense:medication&_include:recurse=MedicationDispense:authorizingPrescription&practitioner.name=FC4358316/Jack%20Jons&practitioner.role=Physicians&_state=KY&_format=json&subject:Patient.gender=female&practitioner.deaNumber=AA4343WEQ111&practitioner.npi=887987136545645465465';
// const dispenseQuery = '/MedicationDispense?subject:Patient.name.given=Rachel&subject:Patient.name.family=Green&subject:Patient.birthdate=1972-12-19&subject:Patient.gender=female&authorizingPrescription.dispenseRequest.validityPeriod=ge2020-04-01&authorizingPrescription.dispenseRequest.validityPeriod=le2021-04-23&practitioner.name=FC4358316/Jack%20Jons&practitioner.role=Physicians&_state=KY&_format=json';

// const pdmpEndpoint = 'https://api.logicahealth.org/ahrqpdmp/open';
// const dispenseQuery = '/MedicationDispense';

const fhirOptions: fhirclient.FhirOptions = {
  pageLimit: 0,
};

//export const getPDMPData = async (patient: Patient, clinician: Practitioner, state: String): Promise<PDMPData> => {
export const getPDMPData = async (ehrData: EHRData, state: String): Promise<PDMPData> => {
  const patient = ehrData.patient;
  const practitioner = ehrData.fhirUser;

  const givenName = patient.name?.[0]?.given?.[0];
  const familyName = patient.name?.[0]?.family;
  const birthDate = patient.birthDate;
  const gender = patient.gender ?? 'unknown';
  const periodStart = getStartDateArg(yearAgoDate);
  const periodEnd = getEndDateArg(todayDate);
  const practitionerName = practitioner?.name?.[0].family;
  const practitionerRole = 'Physicians';
  // practitionerDEA
  // practitionerNPI

  // query MedicationDispense
  const requestOptions = { 
    // headers: {
    //   'Content-Type': 'application/json',
    //   'Accept': 'application/json'
    // }
  };

  const dispenseQuery = '/MedicationDispense?subject:Patient.name.given=' + givenName + '&subject:Patient.name.family=' + familyName + '&subject:Patient.birthdate=' + birthDate + '&subject:Patient.gender=' + gender 
    + '&authorizingPrescription.dispenseRequest.validityPeriod=' + periodStart + '&authorizingPrescription.dispenseRequest.validityPeriod=' + periodEnd + '&practitioner.name=' + practitionerName + '&practitioner.role=' + practitionerRole + '&_state=' + state + '&_format=json';
  // console.log("PDMP Query = " + dispenseQuery)

  const response = await fetch(pdmpEndpoint + dispenseQuery, requestOptions);
  if (!response.ok) {
    const message = `A PDMP server error has occured: ${response.status}`;
    // throw new Error(message);
    console.log(message);
  }
  const responseBody = await response.json();

  const pdmpBundle = resourcesFrom(responseBody);
  const dispensations = pdmpBundle.filter((resource: Resource) => resource.resourceType === 'MedicationDispense') as [MedicationDispense];
  const headers = pdmpBundle.filter((resource: Resource) => resource.resourceType === 'Basic') as [Basic];

  // Extract Patient resources and assign unique id
  const patients = dispensations.flatMap((d: MedicationDispense) => 
      d.contained?.filter((c: Resource) => c.resourceType === 'Patient')) as [Patient]
  patients.forEach((patient) => patient!.id = uuidv4())

  // Update MedicationDispense to refer to extracted Patient
  dispensations.forEach((dispense, idx) => dispense.subject!.reference! = 'Patient/'+patients[idx]?.id)

  return {
    dispensations,
    patients,
    headers
  };
};

// TODO replace with UUID package from npm, https://github.com/uuidjs/uuid
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}