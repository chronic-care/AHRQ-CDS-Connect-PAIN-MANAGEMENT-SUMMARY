// @ts-ignore
import cql from 'cql-execution';
// @ts-ignore
import cqlfhir from '../helpers/cql-exec-fhir';

import { Resource, Basic, Medication, MedicationDispense, MedicationRequest } from '../fhir-types/fhir-r4';
import { EHRData, PDMPData } from '../models/fhirResources';
import { CQLSummary, MedicationDispenseSummary, PDMPStatus } from '../models/cqlSummary';
import { uuidv4 } from './fhirServicePDMP'

import FHIRHelpers from '../cql/pdmpR4/FHIRHelpers.json';
import PDMPMedicationDispense from '../cql/pdmpR4/PDMPMedicationDispense.json';
import valueSetDB from '../cql/valueset-db.json';

let cqlFhirModule: any = cqlfhir;

const getSummaryLibrary = () => new cql.Library(PDMPMedicationDispense, new cql.Repository({
  FHIRHelpers,
}));

const summaryLibrary = getSummaryLibrary();
const codeService = new cql.CodeService(valueSetDB);
const executor = new cql.Executor(summaryLibrary, codeService);

function getBundleEntries(resources: [Resource]) {
  return resources.map((r: Resource) => ({ resource: r }))
}

function getHeadersSource(headers: [Basic], ehrData: EHRData): unknown {
  let patientHeaders = headers.map((b) => {
    b.subject = {reference: 'Patient/'+ (ehrData.patient.id ?? 'unknown')}
    return b
  }) as [Basic]
  // console.log("headers = " + JSON.stringify(patientHeaders))

  const fhirBundle = {
    resourceType: 'Bundle',
    entry: [{ resource: ehrData.patient }, { resource: ehrData.fhirUser },
      ...getBundleEntries(patientHeaders)
    ]
  };

  const patientSource = cqlFhirModule.PatientSource.FHIRv401();
  patientSource.loadBundles([fhirBundle]);

  return patientSource;
}

function getPatientSource(medDispense: MedicationDispense, ehrData: EHRData): unknown {
  const fhirBundle = {
    resourceType: 'Bundle',
    entry: [{ resource: ehrData.fhirUser },
      { resource: medDispense },
      ...getBundleEntries(extractContained(medDispense) ?? [])
    ]
  };

  const patientSource = cqlFhirModule.PatientSource.FHIRv401();
  patientSource.loadBundles([fhirBundle]);

  return patientSource;
}

function extractContained(medDispense: MedicationDispense): [Resource] {
  var resources = new Array() as [Resource]

  // TODO Patient unique ID already assigned in fhirServicePDMP, don't create new UUID here.
  let patient = extractFirstContained(medDispense, 'Patient')
  if (patient != null) {
    resources.push(patient)
    medDispense.subject = {reference: 'Patient/'+patient.id}
  }
  let med = extractFirstContained(medDispense, 'Medication')
  if (med != null) {
    // If Medication name contains '/', add a space to improve display word wrap.
    let coding = (med as Medication).code?.coding?.[0]
    if (coding !== null) {
      coding!.display = coding?.display?.replace('/', '/ ')
    }
    resources.push(med)
    medDispense.medicationReference = {reference: 'Medication/'+med.id}
  }
  let medReq = extractFirstContained(medDispense, 'MedicationRequest') as MedicationRequest
  if (medReq != null) {
    resources.push(medReq)
    medDispense.authorizingPrescription = [{reference: 'MedicationRequest/'+medReq.id}]
  }
  let practitioner = extractFirstContained(medDispense, 'Practitioner')
  if (practitioner != null) {
    resources.push(practitioner)
    medReq.requester = {reference: 'Practitioner/'+practitioner.id}
  }
  let organization = extractFirstContained(medDispense, 'Organization')
  if (organization != null) {
    resources.push(organization)
    medDispense.performer = [{actor: {reference: 'Organization/'+organization.id}}]
  }

  return resources
}

const extractFirstContained = (container: MedicationDispense, type: string) => {
  let resource = container.contained?.filter((resource) => resource.resourceType === type)?.[0]
  if (resource != null) { resource!.id = uuidv4() }
  return resource
}

export const executeCQLSummary = (pdmpData: PDMPData, ehrData: EHRData): CQLSummary => {
  let headersSource = getHeadersSource(pdmpData.headers, ehrData)
  let statusResult = executor.exec(headersSource)
  let extractedSummary = statusResult.patientResults[Object.keys(statusResult.patientResults)[0]]
  let statusSummary = extractedSummary.StatusSummary as PDMPStatus

  let summaries = new Array() as [MedicationDispenseSummary]
  pdmpData.dispensations?.forEach((medDisp: MedicationDispense) => {
    let patientSource = getPatientSource(medDisp, ehrData)
    let results = executor.exec(patientSource)
    let extractedSummary = results.patientResults[Object.keys(results.patientResults)[0]]
    let dispenseSummary = extractedSummary.MedicationDispenseSummary as MedicationDispenseSummary
    dispenseSummary[0].reportingState = statusSummary.reportingState
    summaries.push (dispenseSummary?.[0])
  })
  // console.log(JSON.stringify(summaries))
    
  return { 
    pdmpStatus: statusSummary,
    dispensations: summaries 
  }
}

export const getPDMPDispenseSummary = ((summary: CQLSummary) => {
  let sortedList = summary.dispensations.sort((a, b) => new Date(b.dateFilled).getTime() - new Date(a.dateFilled).getTime())
  return sortedList.map((dispenseSummary) => {
    return {
      DateFilled: formatDate(dispenseSummary.dateFilled),
      Name: dispenseSummary.medicationName,
      Quantity: dispenseSummary.quantity,
      DaysSupply: dispenseSummary.daysSupply,
      PharmacyName: dispenseSummary.pharmacyName,
      PharmacyCity: dispenseSummary.pharmacyCity,
      PrescriberName: dispenseSummary.prescriberName,
      PrescriberCity: dispenseSummary.prescriberCity,
      PatientDOB: dispenseSummary.patientBirthDate,
      ReportingState: dispenseSummary.reportingState
    }
  })
})

function formatDate(date): string {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) 
      month = '0' + month;
  if (day.length < 2) 
      day = '0' + day;

  return [year, month, day].join('-');
}
