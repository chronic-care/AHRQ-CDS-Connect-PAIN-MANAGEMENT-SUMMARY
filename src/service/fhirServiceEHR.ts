import FHIR from 'fhirclient';
import { fhirclient } from 'fhirclient/lib/types';
import { Resource, Patient, Practitioner, Condition, Observation,
        Procedure, MedicationRequest } from '../fhir-types/fhir-r4';
import { EHRData } from '../models/fhirResources';
// import { properties } from './properties';
import { format } from 'date-fns';

const resourcesFrom = (response: fhirclient.JsonObject): [Resource] => {
  const entries = response[0].entry || [];
  return entries.map((entry: fhirclient.JsonObject) => entry.resource)
                .filter((resource: Resource) => resource.resourceType !== 'OperationOutcome');
};

export const getObservationDateParameter = (d: Date): string => `ge${format(d, 'yyyy-MM-dd')}`;

const conditionsPath = 'Condition?category=problem-list-item&clinical-status=active';
const labResultsPath = 'Observation?category=laboratory';
const medicationRequestPath = 'MedicationRequest?status=active';
// const proceduresPath = 'Procedure';

const fhirOptions: fhirclient.FhirOptions = {
  pageLimit: 0,
};

export const getEHRData = async (): Promise<EHRData> => {
  const client = await FHIR.oauth2.ready();

  function hasScope(resourceType: string) {
    return client?.state?.scope?.includes(resourceType)
  }

  const patient: Patient = await client.patient.read() as Patient;
  const clinicianPath = client.getFhirUser();
  const fhirUser: Practitioner | undefined = clinicianPath ? await client.request(clinicianPath) : undefined;

  const conditions = resourcesFrom(await client.patient.request(conditionsPath, fhirOptions) as fhirclient.JsonObject) as [Condition];
  const prescriptions = resourcesFrom(await client.patient.request(medicationRequestPath, fhirOptions) as fhirclient.JsonObject) as [MedicationRequest];
  const labResults = resourcesFrom(await client.patient.request(labResultsPath, fhirOptions) as fhirclient.JsonObject) as [Observation];
  // const procedures = resourcesFrom(await client.patient.request(proceduresPath, fhirOptions) as fhirclient.JsonObject) as [Procedure];
  const procedures = new Array() as [Procedure];

  return {
    patient,
    fhirUser,
    conditions,
    prescriptions,
    procedures,
    labResults
  };
};
